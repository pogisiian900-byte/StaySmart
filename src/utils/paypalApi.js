// PayPal API Utility Functions
// NOTE: These functions now call Firebase Cloud Functions (server-side)
// PayPal API calls are made server-side to keep secrets secure
// DO NOT use PayPal secrets in client-side code

import { 
  processPayPalPayoutRest, 
  getPayPalBalance as getPayPalBalanceFunction, 
  syncPayPalBalanceToFirebase as syncBalanceToFirebase 
} from '../config/firebase';

/**
 * Get PayPal OAuth Access Token
 * NOTE: This is now handled server-side in Firebase Functions
 * @deprecated Use Firebase Cloud Functions instead
 */
export const getPayPalAccessToken = async () => {
  console.warn('⚠️ getPayPalAccessToken is deprecated. Use Firebase Cloud Functions instead.');
  throw new Error('PayPal API calls must be made server-side. Use Firebase Cloud Functions.');
};

/**
 * Process PayPal Payout (Withdrawal)
 * Sends money from platform to user's PayPal account
 * NOTE: This now calls Firebase Cloud Function (server-side)
 * @param {string} payoutEmail - User's PayPal email
 * @param {number} amount - Amount to withdraw
 * @param {string} currency - Currency code (default: PHP)
 * @param {string} payerId - Optional PayPal payer ID (preferred over email)
 * @returns {Promise<Object>} Payout response with batch ID and status
 */
export const processPayPalPayout = async (payoutEmail, amount, currency = 'PHP', payerId = null) => {

  try {
    console.log('=== PROCESSING PAYPAL PAYOUT (via Firebase Function) ===');
    console.log('Amount:', amount);
    console.log('Currency:', currency);
    console.log('Receiver:', payerId || payoutEmail);

    // Validate inputs
    if (!payoutEmail && !payerId) {
      throw new Error('PayPal payout email or payer ID is required.');
    }

    if (!amount || amount <= 0) {
      throw new Error('Invalid payout amount.');
    }

    // Call Firebase Cloud Function (server-side)
    const result = await processPayPalPayoutRest({
      payoutEmail: payoutEmail || '',
      amount: amount,
      currency: currency,
      payerId: payerId || null
    });

    console.log('✅ PayPal payout successful (via Cloud Function):', result.data);

    return result.data;
  } catch (error) {
    console.error('❌ PayPal payout error:', error);
    
    // Extract error message from Firebase Function error
    let errorMessage = 'PayPal payout failed. Please try again.';
    if (error.code === 'functions/not-found') {
      errorMessage = 'PayPal payout function not found. Please ensure Firebase Functions are deployed.';
    } else if (error.code === 'functions/internal') {
      errorMessage = error.message || error.details?.originalError || 'PayPal payout failed. Please try again.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    throw new Error(errorMessage);
  }
};

/**
 * Get Payout Batch Status
 * NOTE: This requires server-side implementation
 * @deprecated Use Firebase Cloud Functions instead
 */
export const getPayoutBatchStatus = async (payoutBatchId) => {
  console.warn('⚠️ getPayoutBatchStatus is deprecated. Use Firebase Cloud Functions instead.');
  throw new Error('PayPal API calls must be made server-side. Use Firebase Cloud Functions.');
};

/**
 * Get PayPal Account Balance
 * Fetches the actual balance from PayPal account
 * NOTE: This now calls Firebase Cloud Function (server-side)
 * @param {string} userId - User ID (ignored, uses authenticated user from context)
 * @param {string} currency - Currency code (default: PHP)
 * @returns {Promise<Object>} Balance information
 */
export const getPayPalBalance = async (userId = null, currency = 'PHP') => {
  try {
    console.log('=== FETCHING PAYPAL BALANCE (via Firebase Function) ===');
    console.log('Currency:', currency);
    console.log('Note: userId parameter is ignored - function uses authenticated user from context');

    // Call Firebase Cloud Function (server-side)
    // Note: userId is not needed as the function gets it from context.auth.uid
    const result = await getPayPalBalanceFunction({ currency });

    console.log('✅ PayPal balance fetched (via Cloud Function):', result.data);
    console.log('💰💰💰 ACTUAL PAYPAL SANDBOX ACCOUNT BALANCE:', result.data.balance);

    return result.data;
  } catch (error) {
    console.error('❌ Error getting PayPal balance:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Error details:', error.details);
    
    // Extract error message from Firebase Function error
    let errorMessage = 'Failed to get PayPal balance. Please try again.';
    
    if (error.code === 'functions/not-found') {
      errorMessage = 'PayPal balance function not found. Please ensure Firebase Functions are deployed.';
    } else if (error.code === 'functions/unauthenticated') {
      errorMessage = 'You must be logged in to fetch PayPal balance.';
    } else if (error.code === 'functions/failed-precondition') {
      errorMessage = 'PayPal credentials not configured in Firebase Functions. Please contact support.';
    } else if (error.code === 'functions/internal') {
      const details = error.details || {};
      const originalError = details.originalError || error.message || 'Unknown error';
      
      // Check for specific PayPal API errors
      if (originalError.includes('401') || originalError.includes('AUTHENTICATION')) {
        errorMessage = 'PayPal authentication failed. Please check Firebase Functions configuration.';
      } else if (originalError.includes('403') || originalError.includes('FORBIDDEN')) {
        errorMessage = 'PayPal API access forbidden. The Reporting API might not be enabled for your account.';
      } else if (originalError.includes('404') || originalError.includes('NOT_FOUND')) {
        errorMessage = 'PayPal balance endpoint not found. The Reporting API might not be available.';
      } else {
        errorMessage = `Failed to get PayPal balance: ${originalError}`;
      }
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    // Create a more informative error
    const enhancedError = new Error(errorMessage);
    enhancedError.code = error.code;
    enhancedError.details = error.details;
    throw enhancedError;
  }
};

/**
 * Sync PayPal Balance to Firebase
 * Fetches balance from PayPal API and updates Firebase user document
 * NOTE: This now calls Firebase Cloud Function (server-side)
 * @param {string} userId - User ID
 * @param {string} currency - Currency code (default: PHP)
 * @returns {Promise<Object>} Updated balance information
 */
export const syncPayPalBalanceToFirebase = async (userId, currency = 'PHP') => {
  try {
    console.log('=== SYNCING PAYPAL BALANCE TO FIREBASE (via Firebase Function) ===');
    console.log('User ID:', userId);
    console.log('Currency:', currency);

    // Call Firebase Cloud Function (server-side)
    const result = await syncBalanceToFirebase({
      userId: userId,
      currency: currency
    });

    console.log('✅ PayPal balance synced (via Cloud Function):', result.data);
    console.log('💰💰💰 ACTUAL PAYPAL SANDBOX ACCOUNT BALANCE:', result.data.balance);
    console.log('📊📊📊 FIREBASE BALANCE (before sync):', result.data.previousBalance);
    console.log('Difference:', result.data.difference);

    // Return the result with balance extracted for backward compatibility
    return {
      balance: result.data.balance,
      currency: result.data.currency,
      balanceData: result.data.balanceData || {},
      syncedAt: result.data.syncedAt || new Date().toISOString(),
      previousBalance: result.data.previousBalance,
      difference: result.data.difference
    };
  } catch (error) {
    console.error('❌ Error syncing PayPal balance:', error);
    
    // Extract error message from Firebase Function error
    let errorMessage = 'Failed to sync PayPal balance. Please try again.';
    if (error.code === 'functions/not-found') {
      errorMessage = 'PayPal balance sync function not found. Please ensure Firebase Functions are deployed.';
    } else if (error.code === 'functions/internal') {
      errorMessage = error.message || error.details?.originalError || 'Failed to sync PayPal balance.';
    } else if (error.code === 'functions/failed-precondition') {
      errorMessage = 'No PayPal account connected. Please connect your PayPal account first.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    throw new Error(errorMessage);
  }
};
