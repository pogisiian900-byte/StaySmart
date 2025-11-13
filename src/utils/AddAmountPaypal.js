/**
 * AddAmountPaypal.js
 * Utility function for processing deposits from StaySmart platform to guest PayPal account
 * 
 * This function handles the complete deposit process:
 * 1. Validates deposit amount and platform balance
 * 2. Processes PayPal payout via Firebase Cloud Functions
 * 3. Deducts from platform (admin) balance in Firebase
 * 4. Creates transaction records
 */

import { doc, getDoc, updateDoc, addDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { processPayPalPayoutRest } from '../config/firebase';
import { extractPayPalErrorMessage } from './paypalErrorHandler';

/**
 * Process deposit from StaySmart platform to guest PayPal account
 * 
 * @param {string} guestId - Guest user ID
 * @param {number} amount - Amount to deposit/transfer (in PHP)
 * @param {Object} options - Optional configuration
 * @param {string} options.paypalEmail - PayPal email address (optional if stored in user profile)
 * @param {string} options.payerId - PayPal payer ID (optional, preferred over email)
 * @param {string} options.currency - Currency code (default: 'PHP')
 * @param {number} options.minimumAmount - Minimum deposit amount (default: 100)
 * @param {string} options.adminId - Specific admin ID to deduct from (optional, uses first admin if not provided)
 * @returns {Promise<Object>} Deposit result with status, transaction details, and updated balances
 * 
 * @example
 * // Basic usage (uses PayPal info from user profile, deducts from first admin account)
 * const result = await depositToPayPal(guestId, 500);
 * 
 * @example
 * // With specific PayPal email and admin account
 * const result = await depositToPayPal(guestId, 1000, {
 *   paypalEmail: 'user@example.com',
 *   adminId: 'specific-admin-id'
 * });
 */
export const depositToPayPal = async (guestId, amount, options = {}) => {
  const {
    paypalEmail = null,
    payerId = null,
    currency = 'PHP',
    minimumAmount = 100,
    adminId = null
  } = options;

  try {
    console.log('=== STAYSMART PLATFORM DEPOSIT TO GUEST PAYPAL ===');
    console.log('Guest ID:', guestId);
    console.log('Amount:', amount);
    console.log('Currency:', currency);

    // 1️⃣ Validate inputs
    if (!guestId) {
      throw new Error('Guest ID is required.');
    }

    const depositAmount = parseFloat(amount);
    if (!depositAmount || isNaN(depositAmount) || depositAmount <= 0) {
      throw new Error('Invalid deposit amount. Amount must be greater than 0.');
    }

    if (depositAmount < minimumAmount) {
      throw new Error(`Minimum deposit amount is ₱${minimumAmount.toFixed(2)}.`);
    }

    // 2️⃣ Get guest user data and PayPal account info
    const userRef = doc(db, 'Users', guestId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      throw new Error('Guest account not found. Please contact support.');
    }

    const userData = userSnap.data();

    // Get PayPal account information
    const payoutEmail = paypalEmail || 
                       userData.paymentMethod?.paypalEmail || 
                       userData.paymentInfo?.payoutEmail || 
                       userData?.payoutEmail;
    
    const payoutPayerId = payerId || 
                         userData.paymentMethod?.payerId || 
                         userData.paypalAccountId || 
                         userData.paymentMethod?.payer_id;

    if (!payoutEmail && !payoutPayerId) {
      throw new Error(
        'No PayPal account found for guest. Please connect PayPal account in profile first.'
      );
    }

    console.log('Guest PayPal payout info:', {
      payoutEmail: payoutEmail || 'Not provided',
      payerId: payoutPayerId || 'Not provided',
      usingPayerId: !!payoutPayerId
    });

    // 3️⃣ Get admin/platform account and validate balance
    let adminAccountId = adminId;
    let adminRef = null;
    let adminData = null;
    let currentPlatformBalance = 0;

    if (adminAccountId) {
      // Use specified admin account
      adminRef = doc(db, 'Users', adminAccountId);
      const adminSnap = await getDoc(adminRef);
      
      if (!adminSnap.exists()) {
        throw new Error('Specified admin account not found.');
      }
      
      adminData = adminSnap.data();
      if (adminData.role !== 'admin') {
        throw new Error('Specified user is not an admin account.');
      }
      
      currentPlatformBalance = adminData.balance || adminData.walletBalance || adminData.paypalBalance || 0;
    } else {
      // Find first admin account
      const adminQuery = query(collection(db, 'Users'), where('role', '==', 'admin'));
      const adminSnapshot = await getDocs(adminQuery);
      
      if (adminSnapshot.empty) {
        throw new Error('No admin account found. Cannot process platform deposit.');
      }
      
      // Use first admin account
      const adminDoc = adminSnapshot.docs[0];
      adminAccountId = adminDoc.id;
      adminRef = doc(db, 'Users', adminAccountId);
      adminData = adminDoc.data();
      currentPlatformBalance = adminData.balance || adminData.walletBalance || adminData.paypalBalance || 0;
    }

    // ✅ Get admin's PayPal email as central system account
    const adminPayPalEmail = adminData.paymentMethod?.paypalEmail || 
                            adminData.paymentInfo?.payoutEmail || 
                            adminData?.payoutEmail;

    if (!adminPayPalEmail) {
      throw new Error(
        'Admin account does not have a PayPal email configured. Please set up the payment method in the admin profile. The admin PayPal email is used as the central system account for sending money.'
      );
    }

    console.log('=== CENTRAL SYSTEM ACCOUNT ===');
    console.log('Admin PayPal Email (Sender Account):', adminPayPalEmail);
    console.log('NOTE: PayPal API credentials should be associated with this email account.');
    console.log('Platform balance info:', {
      adminId: adminAccountId,
      adminPayPalEmail: adminPayPalEmail,
      currentBalance: currentPlatformBalance
    });

    // Check if platform has sufficient balance
    if (depositAmount > currentPlatformBalance) {
      throw new Error(
        `Insufficient platform balance. Available: ₱${currentPlatformBalance.toLocaleString('en-US', { 
          minimumFractionDigits: 2, 
          maximumFractionDigits: 2 
        })}. Required: ₱${depositAmount.toLocaleString('en-US', { 
          minimumFractionDigits: 2, 
          maximumFractionDigits: 2 
        })}.`
      );
    }

    // 4️⃣ Process PayPal payout via Firebase Cloud Function
    console.log('Processing PayPal payout via Firebase Cloud Function...');
    
    const payoutResult = await processPayPalPayoutRest({
      payoutEmail: payoutEmail || '',
      amount: depositAmount,
      currency: currency,
      payerId: payoutPayerId || null
    });

    console.log('✅ PayPal payout response:', payoutResult.data);

    // 5️⃣ Verify payout succeeded
    if (!payoutResult.data.success || !payoutResult.data.payoutBatchId) {
      console.error('❌ Payout failed - no batch ID received:', payoutResult.data);
      throw new Error(
        'PayPal deposit failed. PayPal did not return a valid payout batch ID. Please try again or contact support.'
      );
    }

    const batchStatus = payoutResult.data.batchStatus || 'PENDING';
    const transactionStatus = payoutResult.data.transactionStatus || 'PENDING';
    
    console.log('Payout batch status:', batchStatus);
    console.log('Transaction status:', transactionStatus);
    console.log('Payout batch ID:', payoutResult.data.payoutBatchId);

    // 6️⃣ Calculate new platform balance
    const newPlatformBalance = currentPlatformBalance - depositAmount;

    // 7️⃣ Update platform (admin) balance
    await updateDoc(adminRef, {
      balance: newPlatformBalance,
      paypalBalance: newPlatformBalance, // Keep for backward compatibility
      updatedAt: serverTimestamp()
    });
    console.log('✅ Platform balance updated in admin account');

    // 8️⃣ Create deposit transaction records
    const depositTransaction = {
      userId: guestId,
      userRole: 'guest',
      type: 'topup', // Changed from 'withdrawal' to 'deposit'
      amount: depositAmount,
      currency: currency,
      status: transactionStatus === 'SUCCESS' ? 'completed' : 'pending',
      description: `Deposit from StaySmart platform to PayPal${payoutEmail ? ` (${payoutEmail})` : ''}`,
      paymentMethod: 'paypal',
      source: 'platform', // Indicates this is from platform balance
      platformAdminId: adminAccountId, // Track which admin account was used
      platformAdminPayPalEmail: adminPayPalEmail, // ✅ Central system account email
      payoutBatchId: payoutResult.data.payoutBatchId,
      batchStatus: batchStatus,
      payoutItemId: payoutResult.data.payoutItemId || null,
      transactionId: payoutResult.data.transactionId || null,
      transactionStatus: transactionStatus,
      payerId: payoutPayerId || null,
      accountId: payoutPayerId || null,
      paypalEmail: payoutEmail || null,
      platformBalanceBefore: currentPlatformBalance,
      platformBalanceAfter: newPlatformBalance,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // Add to PayPalTransactions collection
    console.log('Creating deposit transaction record in PayPalTransactions...');
    const paypalTransactionRef = await addDoc(
      collection(db, 'PayPalTransactions'), 
      depositTransaction
    );
    console.log('✅ PayPal transaction record created:', paypalTransactionRef.id);

    // Also add to Transactions collection for consistency
    const transactionRef = await addDoc(
      collection(db, 'Transactions'), 
      depositTransaction
    );
    console.log('✅ Transaction record created:', transactionRef.id);

    // 9️⃣ Return success result
    const result = {
      success: true,
      amount: depositAmount,
      currency: currency,
      platformBalanceBefore: currentPlatformBalance,
      platformBalanceAfter: newPlatformBalance,
      platformAdminId: adminAccountId,
      platformAdminPayPalEmail: adminPayPalEmail, // ✅ Central system account email
      payoutBatchId: payoutResult.data.payoutBatchId,
      batchStatus: batchStatus,
      transactionStatus: transactionStatus,
      payoutItemId: payoutResult.data.payoutItemId || null,
      transactionId: payoutResult.data.transactionId || null,
      paypalEmail: payoutEmail || null,
      payerId: payoutPayerId || null,
      transactionIds: {
        paypalTransactionId: paypalTransactionRef.id,
        transactionId: transactionRef.id
      },
      message: `Successfully deposited ₱${depositAmount.toLocaleString('en-US', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      })} from StaySmart platform to guest PayPal account.`
    };

    console.log('✅ Deposit completed successfully');
    return result;

  } catch (error) {
    console.error('❌ DEPOSIT ERROR:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });

    // Use standardized error handler
    // For validation errors (like insufficient balance), preserve the original message
    let errorMessage;
    if (error.message && (
      error.message.includes('Insufficient') || 
      error.message.includes('Invalid deposit amount') ||
      error.message.includes('Minimum deposit')
    )) {
      // Keep validation messages as-is since they contain specific details
      errorMessage = error.message;
    } else {
      // Use standardized handler for PayPal API errors
      errorMessage = extractPayPalErrorMessage(error, {
        defaultMessage: 'Failed to process deposit. Please try again.',
        operation: 'deposit'
      });
    }

    // Return error result
    return {
      success: false,
      error: errorMessage,
      code: error.code || 'DEPOSIT_ERROR',
      details: error.details || null
    };
  }
};

/**
 * Validate deposit amount and platform balance before processing
 * 
 * @param {string} guestId - Guest user ID
 * @param {number} amount - Amount to deposit
 * @param {number} minimumAmount - Minimum deposit amount (default: 100)
 * @param {string} adminId - Optional admin ID to check balance (uses first admin if not provided)
 * @returns {Promise<Object>} Validation result with balance info
 */
export const validateDeposit = async (guestId, amount, minimumAmount = 100, adminId = null) => {
  try {
    if (!guestId) {
      return {
        valid: false,
        error: 'Guest ID is required.'
      };
    }

    const depositAmount = parseFloat(amount);
    if (!depositAmount || isNaN(depositAmount) || depositAmount <= 0) {
      return {
        valid: false,
        error: 'Invalid deposit amount. Amount must be greater than 0.'
      };
    }

    if (depositAmount < minimumAmount) {
      return {
        valid: false,
        error: `Minimum deposit amount is ₱${minimumAmount.toFixed(2)}.`
      };
    }

    // Get guest PayPal account info
    const userRef = doc(db, 'Users', guestId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return {
        valid: false,
        error: 'Guest account not found.'
      };
    }

    const userData = userSnap.data();
    const payoutEmail = userData.paymentMethod?.paypalEmail || 
                       userData.paymentInfo?.payoutEmail || 
                       userData?.payoutEmail;
    const payerId = userData.paymentMethod?.payerId || 
                   userData.paypalAccountId || 
                   userData.paymentMethod?.payer_id;

    if (!payoutEmail && !payerId) {
      return {
        valid: false,
        error: 'No PayPal account found for guest. Please connect PayPal account in profile first.',
        hasPayPalAccount: false
      };
    }

    // Get platform balance
    let adminAccountId = adminId;
    let platformBalance = 0;
    let adminData = null;

    if (adminAccountId) {
      const adminRef = doc(db, 'Users', adminAccountId);
      const adminSnap = await getDoc(adminRef);
      
      if (!adminSnap.exists()) {
        return {
          valid: false,
          error: 'Specified admin account not found.'
        };
      }
      
      adminData = adminSnap.data();
      if (adminData.role !== 'admin') {
        return {
          valid: false,
          error: 'Specified user is not an admin account.'
        };
      }
      
      platformBalance = adminData.balance || adminData.walletBalance || adminData.paypalBalance || 0;
    } else {
      const adminQuery = query(collection(db, 'Users'), where('role', '==', 'admin'));
      const adminSnapshot = await getDocs(adminQuery);
      
      if (adminSnapshot.empty) {
        return {
          valid: false,
          error: 'No admin account found. Cannot process platform deposit.'
        };
      }
      
      const adminDoc = adminSnapshot.docs[0];
      adminAccountId = adminDoc.id;
      adminData = adminDoc.data();
      platformBalance = adminData.balance || adminData.walletBalance || adminData.paypalBalance || 0;
    }

    // ✅ Get admin's PayPal email as central system account
    const adminPayPalEmail = adminData.paymentMethod?.paypalEmail || 
                            adminData.paymentInfo?.payoutEmail || 
                            adminData?.payoutEmail;

    if (!adminPayPalEmail) {
      return {
        valid: false,
        error: 'Admin account does not have a PayPal email configured. Please set up the payment method in the admin profile. The admin PayPal email is used as the central system account for sending money.'
      };
    }

    if (depositAmount > platformBalance) {
      return {
        valid: false,
        error: `Insufficient platform balance. Available: ₱${platformBalance.toLocaleString('en-US', { 
          minimumFractionDigits: 2, 
          maximumFractionDigits: 2 
        })}.`,
        platformBalance: platformBalance
      };
    }

    return {
      valid: true,
      platformBalance: platformBalance,
      amount: depositAmount,
      newPlatformBalance: platformBalance - depositAmount,
      platformAdminId: adminAccountId,
      platformAdminPayPalEmail: adminPayPalEmail, // ✅ Central system account email
      hasPayPalAccount: true,
      paypalEmail: payoutEmail || null,
      payerId: payerId || null
    };

  } catch (error) {
    console.error('Error validating deposit:', error);
    return {
      valid: false,
      error: error.message || 'Failed to validate deposit.'
    };
  }
};

// Keep old function name for backward compatibility (but it now does deposit, not withdrawal)
export const withdrawToPayPal = depositToPayPal;

export default depositToPayPal;
