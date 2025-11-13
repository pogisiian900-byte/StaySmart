// PayPal API Utility Functions
// NOTE: These functions now call Firebase Cloud Functions (server-side)
// PayPal API calls are made server-side to keep secrets secure
// DO NOT use PayPal secrets in client-side code

import { 
  processPayPalPayoutRest, 
  syncPayPalBalanceToFirebase as syncBalanceToFirebase 
} from '../config/firebase';
import { extractPayPalErrorMessage } from './paypalErrorHandler';

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
    
    // Use standardized error handler
    const errorMessage = extractPayPalErrorMessage(error, {
      defaultMessage: 'PayPal payout failed. Please try again.',
      operation: 'payout'
    });
    
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
    
    // Use standardized error handler
    const errorMessage = extractPayPalErrorMessage(error, {
      defaultMessage: 'Failed to sync PayPal balance. Please try again.',
      operation: 'balance sync'
    });
    
    throw new Error(errorMessage);
  }
};
