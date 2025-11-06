const functions = require('firebase-functions');
const admin = require('firebase-admin');
const paypal = require('@paypal/payouts-sdk');

admin.initializeApp();

/**
 * Initialize PayPal SDK Client
 */
function getPayPalClient() {
  const PAYPAL_CLIENT_ID = functions.config().paypal?.client_id || process.env.PAYPAL_CLIENT_ID;
  const PAYPAL_CLIENT_SECRET = functions.config().paypal?.client_secret || process.env.PAYPAL_CLIENT_SECRET;
  const PAYPAL_MODE = functions.config().paypal?.mode || 'sandbox'; // 'sandbox' or 'live'

  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error('PayPal credentials not configured');
  }

  const environment = PAYPAL_MODE === 'sandbox'
    ? new paypal.core.SandboxEnvironment(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET)
    : new paypal.core.LiveEnvironment(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET);

  return new paypal.core.PayPalHttpClient(environment);
}

/**
 * Shared PayPal payout processing logic using PayPal SDK
 */
async function processPayPalPayoutLogic(payoutId, hostPayPalEmail, amount, currency = 'PHP', payerId = null) {
  const client = getPayPalClient();

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
  } else {
    payoutItem.receiver = hostPayPalEmail;
  }
  
  request.requestBody({
    sender_batch_header: {
      sender_batch_id: `BATCH_${Date.now()}_${payoutId}`,
      recipient_type: payerId ? 'PAYER_ID' : 'EMAIL',
      email_subject: 'StaySmart Booking Payment',
      email_message: `You have received ₱${parseFloat(amount).toFixed(2)} for your booking on StaySmart.`,
    },
    items: [payoutItem],
  });

  // Execute payout
  const response = await client.execute(request);
  
  const payoutBatchId = response.result.batch_header.payout_batch_id;
  const payoutStatus = response.result.batch_header.batch_status;

  return { payoutBatchId, payoutStatus };
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
    // Process PayPal payout using PayPal SDK
    const { payoutBatchId, payoutStatus } = await processPayPalPayoutLogic(
      payoutId,
      hostPayPalEmail,
      amount,
      currency,
      payerId
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

    return {
      success: true,
      payoutBatchId: payoutBatchId,
      status: payoutStatus,
      message: `Payout initiated successfully. Batch ID: ${payoutBatchId}`,
    };
  } catch (error) {
    console.error('PayPal Payout Error:', error);
    
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

    throw new functions.https.HttpsError(
      'internal',
      `PayPal payout failed: ${errorMessage}`,
      error.response?.body || {}
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
