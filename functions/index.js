// Load environment variables from .env file for local development
if (process.env.NODE_ENV !== 'production' && !process.env.FIREBASE_CONFIG) {
  require('dotenv').config();
}

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const paypal = require('@paypal/payouts-sdk');
const fetch = require('node-fetch');

admin.initializeApp();

/**
 * Initialize PayPal SDK Client
 */
function getPayPalClient() {
  console.log('Getting PayPal client configuration...');
  
  const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
  const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
  const PAYPAL_MODE = 'sandbox'; // Hardcoded to sandbox only

  console.log('PayPal configuration:', {
    hasClientId: !!PAYPAL_CLIENT_ID,
    hasClientSecret: !!PAYPAL_CLIENT_SECRET,
    mode: PAYPAL_MODE,
    clientIdLength: PAYPAL_CLIENT_ID ? PAYPAL_CLIENT_ID.length : 0,
    clientSecretLength: PAYPAL_CLIENT_SECRET ? PAYPAL_CLIENT_SECRET.length : 0
  });

  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    const errorMsg = 'PayPal credentials not configured. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET environment variables. For local development, create a .env file in the functions directory. For production, set environment variables in Firebase.';
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  try {
    // Always use sandbox environment
    const environment = new paypal.core.SandboxEnvironment(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET);

    console.log('PayPal environment created:', PAYPAL_MODE);
    const client = new paypal.core.PayPalHttpClient(environment);
    console.log('PayPal client created successfully');
    return client;
  } catch (error) {
    console.error('Error creating PayPal client:', error);
    throw new Error(`Failed to create PayPal client: ${error.message}`);
  }
}

/**
 * Shared PayPal payout processing logic using PayPal SDK
 */
async function processPayPalPayoutLogic(payoutId, hostPayPalEmail, amount, currency = 'PHP', payerId = null) {
  console.log('processPayPalPayoutLogic called:', {
    payoutId,
    hostPayPalEmail,
    payerId,
    amount,
    currency
  });

  try {
    // Get PayPal client
    console.log('Initializing PayPal client...');
    const client = getPayPalClient();
    console.log('PayPal client initialized successfully');

    // Create payout request
    const request = new paypal.payouts.PayoutsPostRequest();
    
    // Build payout item - use PAYER_ID if available (better for business accounts), otherwise EMAIL
    const payoutItem = {
      recipient_type: payerId ? 'PAYER_ID' : 'EMAIL',
      amount: {
        value: parseFloat(amount).toFixed(2),
        currency: currency,
      },
      note: 'Payment for confirmed booking',
      notification_language: 'en-US',
    };

    // Add receiver based on available identifier
    if (payerId) {
      payoutItem.receiver = payerId;
      console.log('Using PAYER_ID for payout:', payerId);
    } else {
      payoutItem.receiver = hostPayPalEmail;
      console.log('Using EMAIL for payout:', hostPayPalEmail);
    }
    
    const requestBody = {
      sender_batch_header: {
        sender_batch_id: `BATCH_${Date.now()}_${payoutId}`,
        recipient_type: payerId ? 'PAYER_ID' : 'EMAIL',
        email_subject: 'StaySmart Booking Payment',
        email_message: `You have received ₱${parseFloat(amount).toFixed(2)} for your booking on StaySmart.`,
      },
      items: [payoutItem],
    };

    console.log('Payout request body:', JSON.stringify(requestBody, null, 2));
    request.requestBody(requestBody);

    // Execute payout
    console.log('Executing PayPal payout request...');
    const response = await client.execute(request);
    console.log('PayPal payout response:', JSON.stringify(response, null, 2));
    
    const payoutBatchId = response.result.batch_header.payout_batch_id;
    const payoutStatus = response.result.batch_header.batch_status;

    console.log('Payout successful:', { payoutBatchId, payoutStatus });

    return { payoutBatchId, payoutStatus };
  } catch (error) {
    console.error('Error in processPayPalPayoutLogic:', error);
    console.error('Error details:', {
      message: error.message,
      statusCode: error.statusCode,
      response: error.response ? {
        status: error.response.status,
        body: error.response.body
      } : null
    });
    throw error;
  }
}

/**
 * PayPal Payouts API Integration - Callable Function
 * This function processes PayPal payouts to hosts when bookings are confirmed
 */
exports.processPayPalPayout = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { payoutId, hostPayPalEmail, amount, currency = 'PHP', payerId = null } = data;

  if (!payoutId || (!hostPayPalEmail && !payerId) || !amount) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
  }

  try {
    console.log('PayPal Payout Function Called:', {
      payoutId,
      hostPayPalEmail,
      payerId,
      amount,
      currency,
      userId: context.auth.uid
    });

    // Validate inputs
    if (!amount || parseFloat(amount) <= 0) {
      throw new Error('Invalid amount: Amount must be greater than 0');
    }

    if (!hostPayPalEmail && !payerId) {
      throw new Error('Invalid receiver: Either PayPal email or payer ID is required');
    }

    // Process PayPal payout using PayPal SDK
    console.log('Calling processPayPalPayoutLogic...');
    const { payoutBatchId, payoutStatus } = await processPayPalPayoutLogic(
      payoutId,
      hostPayPalEmail,
      amount,
      currency,
      payerId
    );

    console.log('Payout processed successfully:', { payoutBatchId, payoutStatus });

    // Update Firestore payout record
    const db = admin.firestore();
    const payoutRef = db.collection('PayPalPayouts').doc(payoutId);
    
    await payoutRef.update({
      payoutBatchId: payoutBatchId,
      status: payoutStatus === 'PENDING' ? 'processing' : payoutStatus.toLowerCase(),
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('Payout record updated in Firestore');

    return {
      success: true,
      payoutBatchId: payoutBatchId,
      status: payoutStatus,
      message: `Payout initiated successfully. Batch ID: ${payoutBatchId}`,
    };
  } catch (error) {
    console.error('PayPal Payout Error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      response: error.response ? {
        status: error.response.status,
        body: error.response.body,
        headers: error.response.headers
      } : null
    });
    
    // Update payout record with error status
    const db = admin.firestore();
    const payoutRef = db.collection('PayPalPayouts').doc(payoutId);
    
    // Extract detailed error message
    let errorMessage = 'Unknown error occurred';
    let errorDetails = {};
    
    if (error.message) {
      errorMessage = error.message;
    }
    
    if (error.response) {
      if (error.response.body) {
        errorDetails = error.response.body;
        if (error.response.body.message) {
          errorMessage = error.response.body.message;
        } else if (error.response.body.name) {
          errorMessage = error.response.body.name;
        }
      }
      if (error.response.status) {
        errorDetails.statusCode = error.response.status;
      }
    }
    
    // Check for specific PayPal errors and map to appropriate error codes
    let firebaseErrorCode = 'internal'; // Default for truly unexpected errors
    const errorMessageUpper = errorMessage.toUpperCase();
    
    if (errorMessage.includes('credentials') || errorMessage.includes('not configured')) {
      errorMessage = 'PayPal credentials not configured. Please set PayPal client ID and secret in Firebase Functions config.';
      firebaseErrorCode = 'failed-precondition';
    } else if (errorMessage.includes('AUTHENTICATION_FAILURE') || errorMessage.includes('401')) {
      errorMessage = 'PayPal authentication failed. Please check your PayPal credentials.';
      firebaseErrorCode = 'unauthenticated';
    } else if (errorMessage.includes('INSUFFICIENT_FUNDS')) {
      errorMessage = 'Insufficient funds in PayPal account for payout.';
      firebaseErrorCode = 'failed-precondition';
    } else if (errorMessage.includes('INVALID_RECEIVER')) {
      errorMessage = 'Invalid PayPal receiver. Please check the host PayPal email or payer ID.';
      firebaseErrorCode = 'invalid-argument';
    } else if (errorMessageUpper.includes('INVALID')) {
      firebaseErrorCode = 'invalid-argument';
    } else if (errorMessageUpper.includes('AUTHENTICATION') || errorMessageUpper.includes('AUTH')) {
      firebaseErrorCode = 'unauthenticated';
    } else if (errorMessageUpper.includes('CREDENTIALS') || errorMessageUpper.includes('CONFIGURATION')) {
      firebaseErrorCode = 'failed-precondition';
    }
    
    // Check HTTP status code if available
    if (errorDetails.statusCode) {
      if (errorDetails.statusCode === 401 || errorDetails.statusCode === 403) {
        firebaseErrorCode = 'unauthenticated';
      } else if (errorDetails.statusCode === 400 || errorDetails.statusCode === 422) {
        if (firebaseErrorCode === 'internal') {
          firebaseErrorCode = 'invalid-argument';
        }
      } else if (errorDetails.statusCode === 402) {
        firebaseErrorCode = 'failed-precondition';
      }
    }
    
    try {
      await payoutRef.update({
        status: 'failed',
        error: errorMessage,
        errorCode: error.code || 'unknown',
        errorDetails: errorDetails,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (updateError) {
      console.error('Failed to update payout record with error:', updateError);
    }

    // Throw error with appropriate Firebase error code
    // This ensures the error message is accessible on the client
    throw new functions.https.HttpsError(
      firebaseErrorCode,
      `PayPal payout failed: ${errorMessage}`,
      {
        originalError: error.message,
        errorCode: error.code,
        details: errorDetails,
        stack: error.stack
      }
    );
  }
});

/**
 * Firebase Cloud Function triggered when a new payout record is created
 * This automatically processes payouts when added to PayPalPayouts collection
 */
exports.onPayoutCreated = functions.firestore
  .document('PayPalPayouts/{payoutId}')
  .onCreate(async (snap, context) => {
    const payoutData = snap.data();
    const payoutId = context.params.payoutId;

    // Only process if status is 'pending'
    if (payoutData.status !== 'pending') {
      console.log(`Payout ${payoutId} skipped - status is ${payoutData.status}`);
      return null;
    }

    try {
      // Process PayPal payout using PayPal SDK
      const { payoutBatchId, payoutStatus } = await processPayPalPayoutLogic(
        payoutId,
        payoutData.hostPayPalEmail,
        payoutData.amount,
        payoutData.currency || 'PHP',
        payoutData.payerId || null
      );

      // Update Firestore payout record
      const db = admin.firestore();
      const payoutRef = db.collection('PayPalPayouts').doc(payoutId);
      
      await payoutRef.update({
        payoutBatchId: payoutBatchId,
        status: payoutStatus === 'PENDING' ? 'processing' : payoutStatus.toLowerCase(),
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Update host balance after payout is processed
      if (payoutData.hostId && payoutStatus === 'PENDING') {
        const hostRef = db.collection('Users').doc(payoutData.hostId);
        const hostDoc = await hostRef.get();
        
        if (hostDoc.exists()) {
          const hostData = hostDoc.data();
          const currentBalance = hostData.paypalBalance || 0;
          const newBalance = currentBalance + parseFloat(payoutData.amount);
          
          await hostRef.update({
            paypalBalance: newBalance,
            paypalLastUpdated: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          
          console.log(`Updated host ${payoutData.hostId} balance: ${newBalance}`);
        }
      }

      console.log(`Payout ${payoutId} processed successfully. Batch ID: ${payoutBatchId}`);
      return { success: true, payoutBatchId, status: payoutStatus };
    } catch (error) {
      console.error(`Error processing payout ${payoutId}:`, error);
      
      // Update payout record with error status
      const db = admin.firestore();
      const payoutRef = db.collection('PayPalPayouts').doc(payoutId);
      
      const errorMessage = error.message || 
        (error.response?.body?.message || 'Unknown error occurred');
      
      await payoutRef.update({
        status: 'failed',
        error: errorMessage,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      throw error;
    }
  });

/**
 * Sync PayPal balance from transactions - Callable Function
 * This recalculates balance from all transaction records
 */
exports.syncPayPalBalance = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { userId } = data;
  const requestingUserId = context.auth.uid;

  // Users can only sync their own balance, unless they're admin
  if (userId !== requestingUserId) {
    // Check if user is admin
    const db = admin.firestore();
    const userDoc = await db.collection('Users').doc(requestingUserId).get();
    if (!userDoc.exists() || userDoc.data().role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'You can only sync your own balance');
    }
  }

  const targetUserId = userId || requestingUserId;
  const db = admin.firestore();
  let calculatedBalance = 0;

  try {
    // Get PayPal transactions (deposits/payments) - order doesn't matter for balance calculation
    const paypalTransactions = await db.collection('PayPalTransactions')
      .where('userId', '==', targetUserId)
      .get();

    paypalTransactions.forEach((doc) => {
      const trans = doc.data();
      if (trans.type === 'deposit') {
        calculatedBalance += parseFloat(trans.amount || 0);
      } else if (trans.type === 'payment' || trans.type === 'withdrawal') {
        calculatedBalance -= parseFloat(trans.amount || 0);
      }
    });

    // Get user data to check role
    const userDoc = await db.collection('Users').doc(targetUserId).get();
    if (!userDoc.exists()) {
      throw new functions.https.HttpsError('not-found', 'User not found');
    }

    const userData = userDoc.data();

    // If user is a host, add earnings from HostTransactions
    if (userData.role === 'host') {
      const hostTransactions = await db.collection('HostTransactions')
        .where('hostId', '==', targetUserId)
        .where('status', '==', 'completed')
        .get();

      hostTransactions.forEach((doc) => {
        const trans = doc.data();
        if (trans.type === 'booking_earnings') {
          calculatedBalance += parseFloat(trans.amount || 0);
        }
      });
    }

    // If user is admin, add service fees from AdminTransactions
    if (userData.role === 'admin') {
      const adminTransactions = await db.collection('AdminTransactions')
        .where('adminId', '==', targetUserId)
        .where('status', '==', 'completed')
        .get();

      adminTransactions.forEach((doc) => {
        const trans = doc.data();
        if (trans.type === 'service_fee') {
          calculatedBalance += parseFloat(trans.amount || 0);
        }
      });
    }

    // Update balance in Firebase
    await db.collection('Users').doc(targetUserId).update({
      paypalBalance: calculatedBalance,
      paypalLastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      balanceSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      balance: calculatedBalance,
      message: `Balance synced successfully: ₱${calculatedBalance.toFixed(2)}`,
    };
  } catch (error) {
    console.error('Error syncing PayPal balance:', error);
    throw new functions.https.HttpsError(
      'internal',
      `Failed to sync balance: ${error.message}`
    );
  }
});

/**
 * Auto-sync balance when PayPal transaction is created
 */
exports.onPayPalTransactionCreated = functions.firestore
  .document('PayPalTransactions/{transactionId}')
  .onCreate(async (snap, context) => {
    const transactionData = snap.data();
    const db = admin.firestore();

    if (!transactionData.userId) {
      return null;
    }

    try {
      // Recalculate balance for this user
      let calculatedBalance = 0;

      // Get all PayPal transactions (order doesn't matter for balance calculation)
      const paypalTransactions = await db.collection('PayPalTransactions')
        .where('userId', '==', transactionData.userId)
        .get();

      paypalTransactions.forEach((doc) => {
        const trans = doc.data();
        if (trans.type === 'deposit') {
          calculatedBalance += parseFloat(trans.amount || 0);
        } else if (trans.type === 'payment' || trans.type === 'withdrawal') {
          calculatedBalance -= parseFloat(trans.amount || 0);
        }
      });

      // Get user data to check role
      const userDoc = await db.collection('Users').doc(transactionData.userId).get();
      if (userDoc.exists()) {
        const userData = userDoc.data();

        // If user is a host, add earnings
        if (userData.role === 'host') {
          const hostTransactions = await db.collection('HostTransactions')
            .where('hostId', '==', transactionData.userId)
            .where('status', '==', 'completed')
            .get();

          hostTransactions.forEach((doc) => {
            const trans = doc.data();
            if (trans.type === 'booking_earnings') {
              calculatedBalance += parseFloat(trans.amount || 0);
            }
          });
        }

        // If user is admin, add service fees
        if (userData.role === 'admin') {
          const adminTransactions = await db.collection('AdminTransactions')
            .where('adminId', '==', transactionData.userId)
            .where('status', '==', 'completed')
            .get();

          adminTransactions.forEach((doc) => {
            const trans = doc.data();
            if (trans.type === 'service_fee') {
              calculatedBalance += parseFloat(trans.amount || 0);
            }
          });
        }

        // Update balance
        await db.collection('Users').doc(transactionData.userId).update({
          paypalBalance: calculatedBalance,
          paypalLastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`Auto-synced balance for user ${transactionData.userId}: ${calculatedBalance}`);
      }
    } catch (error) {
      console.error('Error auto-syncing balance:', error);
    }

    return null;
  });

/**
 * Auto-sync balance when Host transaction is created/updated
 */
exports.onHostTransactionUpdated = functions.firestore
  .document('HostTransactions/{transactionId}')
  .onWrite(async (change, context) => {
    const transactionData = change.after.exists ? change.after.data() : null;
    
    if (!transactionData || !transactionData.hostId) {
      return null;
    }

    // Only sync if status is completed
    if (transactionData.status !== 'completed') {
      return null;
    }

    const db = admin.firestore();

    try {
      let calculatedBalance = 0;

      // Get PayPal transactions (order doesn't matter for balance calculation)
      const paypalTransactions = await db.collection('PayPalTransactions')
        .where('userId', '==', transactionData.hostId)
        .get();

      paypalTransactions.forEach((doc) => {
        const trans = doc.data();
        if (trans.type === 'deposit') {
          calculatedBalance += parseFloat(trans.amount || 0);
        } else if (trans.type === 'payment' || trans.type === 'withdrawal') {
          calculatedBalance -= parseFloat(trans.amount || 0);
        }
      });

      // Get host transactions
      const hostTransactions = await db.collection('HostTransactions')
        .where('hostId', '==', transactionData.hostId)
        .where('status', '==', 'completed')
        .get();

      hostTransactions.forEach((doc) => {
        const trans = doc.data();
        if (trans.type === 'booking_earnings') {
          calculatedBalance += parseFloat(trans.amount || 0);
        }
      });

      // Update balance
      await db.collection('Users').doc(transactionData.hostId).update({
        paypalBalance: calculatedBalance,
        paypalLastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`Auto-synced balance for host ${transactionData.hostId}: ${calculatedBalance}`);
    } catch (error) {
      console.error('Error auto-syncing host balance:', error);
    }

    return null;
  });

/**
 * Auto-sync balance when Admin transaction is created/updated
 */
exports.onAdminTransactionUpdated = functions.firestore
  .document('AdminTransactions/{transactionId}')
  .onWrite(async (change, context) => {
    const transactionData = change.after.exists ? change.after.data() : null;
    
    if (!transactionData || !transactionData.adminId) {
      return null;
    }

    // Only sync if status is completed
    if (transactionData.status !== 'completed') {
      return null;
    }

    const db = admin.firestore();

    try {
      let calculatedBalance = 0;

      // Get PayPal transactions (order doesn't matter for balance calculation)
      const paypalTransactions = await db.collection('PayPalTransactions')
        .where('userId', '==', transactionData.adminId)
        .get();

      paypalTransactions.forEach((doc) => {
        const trans = doc.data();
        if (trans.type === 'deposit') {
          calculatedBalance += parseFloat(trans.amount || 0);
        } else if (trans.type === 'payment' || trans.type === 'withdrawal') {
          calculatedBalance -= parseFloat(trans.amount || 0);
        }
      });

      // Get admin transactions
      const adminTransactions = await db.collection('AdminTransactions')
        .where('adminId', '==', transactionData.adminId)
        .where('status', '==', 'completed')
        .get();

      adminTransactions.forEach((doc) => {
        const trans = doc.data();
        if (trans.type === 'service_fee') {
          calculatedBalance += parseFloat(trans.amount || 0);
        }
      });

      // Update balance
      await db.collection('Users').doc(transactionData.adminId).update({
        paypalBalance: calculatedBalance,
        paypalLastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`Auto-synced balance for admin ${transactionData.adminId}: ${calculatedBalance}`);
    } catch (error) {
      console.error('Error auto-syncing admin balance:', error);
    }

    return null;
  });

/**
 * Get PayPal Balance from API - Callable Function
 * Fetches the actual balance from PayPal account using REST API
 */
exports.getPayPalBalance = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { currency = 'PHP' } = data;

  try {
    console.log('Getting PayPal balance from API for user:', context.auth.uid);

    // Get PayPal credentials from environment
    const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
    const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
    const PAYPAL_API_BASE = 'https://api-m.sandbox.paypal.com';

    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      throw new functions.https.HttpsError('failed-precondition', 'PayPal credentials not configured. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET environment variables.');
    }

    // Get PayPal access token
    const credentials = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
    
    const tokenResponse = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      throw new Error(`Failed to get PayPal access token: ${errorData.error_description || tokenResponse.statusText}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Get balance from PayPal API
    const balanceResponse = await fetch(`${PAYPAL_API_BASE}/v1/reporting/balances?currency_code=${currency}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!balanceResponse.ok) {
      const errorData = await balanceResponse.json().catch(() => ({}));
      console.error('PayPal balance API error:', errorData);
      throw new Error(`Failed to get PayPal balance: ${errorData.message || balanceResponse.statusText}`);
    }

    const balanceData = await balanceResponse.json();
    console.log('PayPal balance API response:', JSON.stringify(balanceData, null, 2));

    // Extract balance amount
    let balance = 0;
    
    if (balanceData.balances && Array.isArray(balanceData.balances)) {
      // Find the balance for the specified currency
      const currencyBalance = balanceData.balances.find(b => b.currency === currency);
      if (currencyBalance) {
        balance = parseFloat(currencyBalance.available_balance?.value || currencyBalance.total_balance?.value || 0);
      }
    } else if (balanceData.available_balance) {
      balance = parseFloat(balanceData.available_balance.value || balanceData.available_balance || 0);
    } else if (balanceData.total_balance) {
      balance = parseFloat(balanceData.total_balance.value || balanceData.total_balance || 0);
    } else if (typeof balanceData.balance === 'number') {
      balance = balanceData.balance;
    }

    console.log(`💰 PayPal balance for user ${context.auth.uid}: ${balance} ${currency}`);

    return {
      success: true,
      balance: balance,
      currency: currency,
      balanceData: balanceData,
      syncedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting PayPal balance:', error);
    console.error('Error stack:', error.stack);
    
    // If it's already an HttpsError, rethrow it
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    // Check for specific error types
    if (error.message.includes('authentication failed') || error.message.includes('401')) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        error.message,
        { originalError: error.message, statusCode: 401 }
      );
    } else if (error.message.includes('forbidden') || error.message.includes('403')) {
      throw new functions.https.HttpsError(
        'permission-denied',
        error.message,
        { originalError: error.message, statusCode: 403 }
      );
    } else if (error.message.includes('not found') || error.message.includes('404')) {
      throw new functions.https.HttpsError(
        'not-found',
        error.message,
        { originalError: error.message, statusCode: 404 }
      );
    }
    
    // Default to internal error
    throw new functions.https.HttpsError(
      'internal',
      `Failed to get PayPal balance: ${error.message}`,
      { 
        originalError: error.message,
        stack: error.stack,
        name: error.name
      }
    );
  }
});

/**
 * Sync PayPal Balance to Firebase - Callable Function
 * Fetches balance from PayPal API and updates Firebase user document
 */
exports.syncPayPalBalanceToFirebase = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { userId: targetUserId, currency = 'PHP' } = data;
  const requestingUserId = context.auth.uid;
  const db = admin.firestore();

  // Users can only sync their own balance, unless they're admin
  const finalUserId = targetUserId || requestingUserId;
  if (finalUserId !== requestingUserId) {
    const userDoc = await db.collection('Users').doc(requestingUserId).get();
    if (!userDoc.exists() || userDoc.data().role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'You can only sync your own balance');
    }
  }

  try {
    console.log(`Syncing PayPal balance for user: ${finalUserId}`);

    // Get user data to check PayPal account
    const userDoc = await db.collection('Users').doc(finalUserId).get();
    if (!userDoc.exists()) {
      throw new functions.https.HttpsError('not-found', 'User not found');
    }

    const userData = userDoc.data();
    const hasPayPalAccount = userData.paypalAccountId || userData.paymentMethod?.payerId;

    if (!hasPayPalAccount) {
      throw new functions.https.HttpsError('failed-precondition', 'No PayPal account connected');
    }

    // Get PayPal credentials from environment
    const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
    const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
    const PAYPAL_API_BASE = 'https://api-m.sandbox.paypal.com';

    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      throw new functions.https.HttpsError('failed-precondition', 'PayPal credentials not configured. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET environment variables.');
    }

    // Get PayPal access token
    const credentials = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
    
    const tokenResponse = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      throw new Error(`Failed to get PayPal access token: ${errorData.error_description || tokenResponse.statusText}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Get balance from PayPal API
    const balanceResponse = await fetch(`${PAYPAL_API_BASE}/v1/reporting/balances?currency_code=${currency}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!balanceResponse.ok) {
      const errorData = await balanceResponse.json().catch(() => ({}));
      console.error('PayPal balance API error:', errorData);
      throw new Error(`Failed to get PayPal balance: ${errorData.message || balanceResponse.statusText}`);
    }

    const balanceData = await balanceResponse.json();
    console.log('PayPal balance API response:', JSON.stringify(balanceData, null, 2));

    // Extract balance amount
    let actualBalance = 0;
    
    if (balanceData.balances && Array.isArray(balanceData.balances)) {
      const currencyBalance = balanceData.balances.find(b => b.currency === currency);
      if (currencyBalance) {
        actualBalance = parseFloat(currencyBalance.available_balance?.value || currencyBalance.total_balance?.value || 0);
      }
    } else if (balanceData.available_balance) {
      actualBalance = parseFloat(balanceData.available_balance.value || balanceData.available_balance || 0);
    } else if (balanceData.total_balance) {
      actualBalance = parseFloat(balanceData.total_balance.value || balanceData.total_balance || 0);
    } else if (typeof balanceData.balance === 'number') {
      actualBalance = balanceData.balance;
    }

    const currentFirebaseBalance = userData.paypalBalance || 0;
    const difference = actualBalance - currentFirebaseBalance;

    console.log(`💰💰💰 ACTUAL PAYPAL SANDBOX ACCOUNT BALANCE: ${actualBalance}`);
    console.log(`📊📊📊 FIREBASE BALANCE: ${currentFirebaseBalance}`);
    console.log(`Difference: ${difference}`);

    // Update Firebase balance
    await db.collection('Users').doc(finalUserId).update({
      paypalBalance: actualBalance,
      paypalLastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      balanceSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
      paypalBalanceData: {
        actualBalance: actualBalance,
        firebaseBalance: currentFirebaseBalance,
        difference: difference,
        syncedAt: new Date().toISOString(),
        balanceData: balanceData
      }
    });

    // Create adjustment transaction if there's a difference
    if (Math.abs(difference) > 0.01) {
      await db.collection('PayPalTransactions').add({
        userId: finalUserId,
        userRole: userData.role || 'guest',
        type: difference > 0 ? 'deposit' : 'withdrawal',
        amount: Math.abs(difference),
        currency: currency,
        status: 'completed',
        description: `Balance sync adjustment - ${difference > 0 ? 'Increased' : 'Decreased'} to match PayPal account`,
        paymentMethod: 'paypal',
        payerId: userData.paypalAccountId || userData.paymentMethod?.payerId || null,
        accountId: userData.paypalAccountId || userData.paymentMethod?.payerId || null,
        balanceBefore: currentFirebaseBalance,
        balanceAfter: actualBalance,
        isBalanceSync: true,
        isApiSync: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    return {
      success: true,
      balance: actualBalance,
      previousBalance: currentFirebaseBalance,
      difference: difference,
      currency: currency,
      message: `Balance synced successfully. PayPal: ₱${actualBalance.toFixed(2)}, Firebase: ₱${currentFirebaseBalance.toFixed(2)}`
    };
  } catch (error) {
    console.error('Error syncing PayPal balance to Firebase:', error);
    throw new functions.https.HttpsError(
      'internal',
      `Failed to sync balance: ${error.message}`,
      { originalError: error.message }
    );
  }
});

/**
 * Process PayPal Payout (Withdrawal) using REST API - Callable Function
 * This is the server-side version that uses REST API directly
 */
exports.processPayPalPayoutRest = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { payoutEmail, amount, currency = 'PHP', payerId = null } = data;

  if (!payoutEmail && !payerId) {
    throw new functions.https.HttpsError('invalid-argument', 'PayPal email or payer ID is required');
  }

  if (!amount || amount <= 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid payout amount');
  }

  try {
    console.log('=== PROCESSING PAYPAL PAYOUT (REST API) ===');
    console.log('Receiver Email:', payoutEmail || 'Not provided');
    console.log('Payer ID:', payerId || 'Not provided');
    console.log('Amount:', amount);
    console.log('Currency:', currency);
    console.log('Recipient Type:', payerId ? 'PAYER_ID' : 'EMAIL');
    console.log('Recipient Value:', payerId || payoutEmail || 'Not provided');

    // Get PayPal credentials from environment
    const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
    const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
    const PAYPAL_API_BASE = 'https://api-m.sandbox.paypal.com';

    console.log('=== PAYPAL CREDENTIALS CHECK ===');
    console.log('PAYPAL_CLIENT_ID exists:', !!PAYPAL_CLIENT_ID);
    console.log('PAYPAL_CLIENT_SECRET exists:', !!PAYPAL_CLIENT_SECRET);
    console.log('PAYPAL_CLIENT_ID length:', PAYPAL_CLIENT_ID ? PAYPAL_CLIENT_ID.length : 0);
    console.log('PAYPAL_CLIENT_SECRET length:', PAYPAL_CLIENT_SECRET ? PAYPAL_CLIENT_SECRET.length : 0);
    console.log('PAYPAL_CLIENT_ID starts with:', PAYPAL_CLIENT_ID ? PAYPAL_CLIENT_ID.substring(0, 10) : 'N/A');
    console.log('Is placeholder?', PAYPAL_CLIENT_ID ? PAYPAL_CLIENT_ID.includes('your_paypal') : true);

    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      const errorMsg = 'PayPal credentials not configured. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET environment variables. For local development, create a .env file in the functions directory. For production, set environment variables in Firebase Console.';
      console.error('❌', errorMsg);
      throw new functions.https.HttpsError('failed-precondition', errorMsg);
    }

    // Check if credentials are placeholders
    if (PAYPAL_CLIENT_ID.includes('your_paypal') || PAYPAL_CLIENT_SECRET.includes('your_paypal')) {
      const errorMsg = 'PayPal credentials are still placeholders. Please update functions/.env file with actual Client ID and Secret from PayPal Developer Dashboard. IMPORTANT: The Client ID and Secret should be from a PayPal App associated with lhanie@business.example.com account (the sender account).';
      console.error('❌', errorMsg);
      throw new functions.https.HttpsError('failed-precondition', errorMsg);
    }

    // Get PayPal access token
    console.log('=== REQUESTING PAYPAL ACCESS TOKEN ===');
    console.log('API Base:', PAYPAL_API_BASE);
    const credentials = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
    
    const tokenResponse = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    console.log('Token response status:', tokenResponse.status);
    console.log('Token response statusText:', tokenResponse.statusText);

    if (!tokenResponse.ok) {
      const tokenErrorData = await tokenResponse.json().catch(() => ({}));
      console.error('❌ Failed to get PayPal access token');
      console.error('Token error response:', JSON.stringify(tokenErrorData, null, 2));
      
      let tokenErrorMessage = 'Failed to authenticate with PayPal API. ';
      if (tokenErrorData.error === 'invalid_client') {
        tokenErrorMessage += 'Invalid Client ID or Secret. Please verify your PayPal App credentials in functions/.env file. Make sure the Client ID and Secret are from a PayPal App associated with lhanie@business.example.com account (the sender account).';
      } else if (tokenErrorData.error_description) {
        tokenErrorMessage += tokenErrorData.error_description;
      } else {
        tokenErrorMessage += `HTTP ${tokenResponse.status}: ${tokenResponse.statusText}`;
      }
      
      throw new functions.https.HttpsError('failed-precondition', tokenErrorMessage, {
        message: tokenErrorMessage,
        paypalError: tokenErrorData
      });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Generate unique batch ID
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 9);
    const senderBatchId = `batch_${timestamp}_${randomStr}`;
    const senderItemId = `item_${timestamp}_${randomStr}`;

    // Prepare payout request
    // NOTE: PayPal Payout API sends money FROM the platform PayPal account TO the user's PayPal account.
    // The platform PayPal account (associated with PAYPAL_CLIENT_ID) must have sufficient funds.
    // For sandbox: Add test funds to your platform PayPal sandbox account.
    const payoutData = {
      sender_batch_header: {
        sender_batch_id: senderBatchId,
        email_subject: 'StaySmart Withdrawal',
        email_message: `You have received ₱${parseFloat(amount).toFixed(2)} withdrawal from StaySmart.`,
      },
      items: [
        {
          recipient_type: payerId ? 'PAYER_ID' : 'EMAIL',
          amount: {
            value: parseFloat(amount).toFixed(2),
            currency: currency,
          },
          receiver: payerId || payoutEmail,
          note: `Wallet withdrawal from StaySmart - ₱${parseFloat(amount).toFixed(2)}`,
          sender_item_id: senderItemId,
        },
      ],
    };

    console.log('=== PAYPAL PAYOUT REQUEST DATA ===');
    console.log('Receiver Email:', payoutEmail || 'Not provided');
    console.log('Payer ID:', payerId || 'Not provided');
    console.log('Recipient Type:', payerId ? 'PAYER_ID' : 'EMAIL');
    console.log('Receiver (in request):', payerId || payoutEmail);
    console.log('Full payout request:', JSON.stringify(payoutData, null, 2));

    // Send payout request
    const response = await fetch(`${PAYPAL_API_BASE}/v1/payments/payouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payoutData),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('PayPal payout API error response:', JSON.stringify(responseData, null, 2));
      console.error('Response status:', response.status);
      console.error('Response statusText:', response.statusText);
      
      // Extract error message from PayPal response
      let errorMessage = 'PayPal payout failed';
      
      if (responseData.message) {
        errorMessage = responseData.message;
      } else if (responseData.details && Array.isArray(responseData.details) && responseData.details[0]) {
        errorMessage = responseData.details[0].description || responseData.details[0].issue || errorMessage;
      } else if (responseData.name) {
        errorMessage = responseData.name;
      } else if (response.statusText) {
        errorMessage = `PayPal API error: ${response.statusText}`;
      }
      
      console.error('Extracted error message:', errorMessage);
      
      // Map PayPal errors to appropriate Firebase error codes
      // This ensures error messages are passed to the client
      let firebaseErrorCode = 'internal'; // Default for truly unexpected errors
      const paypalErrorName = responseData.name || '';
      const paypalErrorIssue = responseData.details?.[0]?.issue || '';
      const errorMessageUpper = errorMessage.toUpperCase();
      
      // Check HTTP status codes first
      if (response.status === 401 || response.status === 403) {
        firebaseErrorCode = 'unauthenticated';
      } else if (response.status === 400 || response.status === 422) {
        // Check if it's an invalid argument error
        if (errorMessageUpper.includes('INVALID_RECEIVER') || 
            errorMessageUpper.includes('INVALID') ||
            paypalErrorIssue.includes('INVALID') ||
            paypalErrorName.includes('VALIDATION_ERROR')) {
          firebaseErrorCode = 'invalid-argument';
        } else {
          firebaseErrorCode = 'invalid-argument'; // Most 400/422 are invalid arguments
        }
      } else if (response.status === 402) {
        firebaseErrorCode = 'failed-precondition'; // Payment required / insufficient funds
      } else {
        // Check PayPal-specific error codes
        if (errorMessageUpper.includes('INSUFFICIENT_FUNDS') || 
            errorMessageUpper.includes('INSUFFICIENT') ||
            paypalErrorIssue.includes('INSUFFICIENT')) {
          firebaseErrorCode = 'failed-precondition';
        } else if (errorMessageUpper.includes('INVALID_RECEIVER') || 
                   errorMessageUpper.includes('INVALID') ||
                   paypalErrorIssue.includes('INVALID') ||
                   paypalErrorName.includes('VALIDATION_ERROR')) {
          firebaseErrorCode = 'invalid-argument';
        } else if (errorMessageUpper.includes('AUTHENTICATION') || 
                   errorMessageUpper.includes('AUTH') ||
                   paypalErrorName.includes('AUTHENTICATION')) {
          firebaseErrorCode = 'unauthenticated';
        } else if (errorMessageUpper.includes('CREDENTIALS') || 
                   errorMessageUpper.includes('NOT_CONFIGURED') ||
                   errorMessageUpper.includes('CONFIGURATION')) {
          firebaseErrorCode = 'failed-precondition';
        }
      }
      
      // Throw error with appropriate Firebase error code
      // This ensures the error message is accessible on the client
      throw new functions.https.HttpsError(
        firebaseErrorCode,
        errorMessage, // This will be accessible via error.message on client
        {
          message: errorMessage,
          statusCode: response.status,
          errorCode: responseData.name || responseData.details?.[0]?.issue,
          paypalResponse: responseData
        }
      );
    }

    console.log('✅ PayPal payout successful:', responseData);

    return {
      success: true,
      payoutBatchId: responseData.batch_header?.payout_batch_id,
      batchStatus: responseData.batch_header?.batch_status,
      payoutItemId: responseData.items?.[0]?.payout_item_id,
      transactionStatus: responseData.items?.[0]?.transaction_status,
      transactionId: responseData.items?.[0]?.transaction_id,
      fullResponse: responseData
    };
  } catch (error) {
    console.error('PayPal payout error:', error);
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // If it's already an HttpsError, rethrow it (it should have the proper message)
    if (error instanceof functions.https.HttpsError) {
      console.error('Rethrowing HttpsError with message:', error.message);
      throw error;
    }
    
    // Extract detailed error message
    let errorMessage = error.message || 'Unknown error occurred';
    
    // Check if error has response data (from fetch)
    if (error.response) {
      const responseData = error.response.body || {};
      if (responseData.message) {
        errorMessage = responseData.message;
      } else if (responseData.details?.[0]?.description) {
        errorMessage = responseData.details[0].description;
      } else if (responseData.details?.[0]?.issue) {
        errorMessage = responseData.details[0].issue;
      }
    }
    
    // Throw with detailed message - include message in both parameter and details
    const finalErrorMessage = `PayPal payout failed: ${errorMessage}`;
    
    throw new functions.https.HttpsError(
      'internal',
      finalErrorMessage,
      { 
        message: finalErrorMessage, // Include in details for client access
        originalError: error.message,
        errorType: error.constructor.name,
        stack: error.stack,
        errorMessage: errorMessage // Include the extracted error message
      }
    );
  }
});
