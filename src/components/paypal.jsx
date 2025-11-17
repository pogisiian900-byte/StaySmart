import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, doc, updateDoc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { processPayPalPayout as processPayPalPayoutAPI, syncPayPalBalanceToFirebase } from '../utils/paypalApi';
import { extractPayPalErrorMessage } from '../utils/paypalErrorHandler';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import 'dialog-polyfill/dist/dialog-polyfill.css';
import dialogPolyfill from 'dialog-polyfill';
import './paypal.css';

const PayPal = ({ userId, userRole, paymentMethod, onClose }) => {
  const [balance, setBalance] = useState(0);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [processingWithdrawal, setProcessingWithdrawal] = useState(false);
  const [activeTab, setActiveTab] = useState('topup');
  const [showPayPalButtons, setShowPayPalButtons] = useState(false);
  const dialogRef = useRef(null);
  
  // PayPal Client ID
  const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID || "AWzCyB0viVv8_sS4aT309bhLLTMGLBYXexAJmIHkbrmTKp0hswkl1OHImpQDOWBnRncPBd7Us4dkNGbi";

  useEffect(() => {
    if (dialogRef.current && !dialogRef.current.showModal) {
      dialogPolyfill.registerDialog(dialogRef.current);
    }
    
    if (dialogRef.current) {
      dialogRef.current.showModal();
    }

    // Set up real-time listener for user balance - updates immediately when balance changes
    const userRef = doc(db, 'Users', userId);
    const unsubscribeUser = onSnapshot(
      userRef, 
      async (userSnap) => {
        if (userSnap.exists()) {
          const userData = userSnap.data();
          // Use balance or walletBalance field (Firebase balance system)
          let newBalance = userData.balance || userData.walletBalance || userData.paypalBalance || 0;
          
          console.log('=== BALANCE UPDATE DETECTED ===');
          console.log('User ID:', userId);
          console.log('New Firebase Balance:', newBalance);
          console.log('Previous Balance (local state):', balance);
          
          // Initialize balance if it doesn't exist
          if ((userData.balance === undefined && userData.walletBalance === undefined && userData.paypalBalance === undefined) || newBalance === null) {
            console.log('Balance not initialized, setting to 0');
            newBalance = 0;
            // Initialize balance field in Firebase
            try {
              await updateDoc(userRef, {
                balance: 0,
                updatedAt: serverTimestamp()
              });
              console.log('✅ Balance initialized to 0 in Firestore');
            } catch (error) {
              console.error('❌ Error initializing balance:', error);
            }
          }
          
          
          setBalance(newBalance);
          console.log('✅ Balance updated in real-time:', newBalance);
        }
      }, 
      (error) => {
        console.error('❌ Error listening to user balance:', error);
      }
    );

    // Also set up real-time listener for transactions to recalculate balance if needed
    const unsubscribeTransactions = fetchPayPalData();

    return () => {
      unsubscribeUser();
      if (unsubscribeTransactions) {
        unsubscribeTransactions();
      }
    };
  }, [userId]);

  const fetchPayPalData = () => {
    try {
      setLoading(true);
      console.log('🔄 Starting to fetch PayPal data for userId:', userId);
      
      // Set a timeout to ensure loading doesn't hang forever
      const loadingTimeout = setTimeout(() => {
        console.warn('⚠️ Transaction loading timeout - setting loading to false');
        setLoading(false);
      }, 10000); // 10 second timeout
      
      // Fetch transactions from both collections
      // Try with orderBy first, fallback to without if index doesn't exist
      let paypalTransactionsQuery;
      let transactionsQuery;
      
      try {
        paypalTransactionsQuery = query(
          collection(db, 'PayPalTransactions'),
          where('userId', '==', userId),
          orderBy('createdAt', 'desc')
        );
        
        transactionsQuery = query(
          collection(db, 'Transactions'),
          where('userId', '==', userId),
          orderBy('createdAt', 'desc')
        );
      } catch (queryError) {
        // If orderBy fails (missing index), try without orderBy
        console.warn('OrderBy query failed, trying without orderBy:', queryError);
        paypalTransactionsQuery = query(
          collection(db, 'PayPalTransactions'),
          where('userId', '==', userId)
        );
        
        transactionsQuery = query(
          collection(db, 'Transactions'),
          where('userId', '==', userId)
        );
      }

      // Listen to PayPalTransactions
      const unsubPayPal = onSnapshot(
        paypalTransactionsQuery, 
        async (snapshot) => {
          try {
            clearTimeout(loadingTimeout);
            const transList = [];

            console.log('📊 PayPalTransactions snapshot received:', snapshot.size, 'documents');
            
            snapshot.forEach((doc) => {
              const data = doc.data();
              console.log('📄 Transaction document:', {
                id: doc.id,
                userId: data.userId,
                type: data.type,
                amount: data.amount,
                createdAt: data.createdAt
              });
              
              // Only include transactions for this user
              if (data.userId === userId) {
                const trans = { id: doc.id, ...data, source: 'PayPalTransactions' };
                transList.push(trans);
              }
            });

            console.log('✅ PayPalTransactions added:', transList.length, 'transactions');

            // Also fetch from Transactions collection for top-up transactions
            try {
              const transactionsSnap = await getDocs(transactionsQuery);
              console.log('📊 Transactions collection snapshot received:', transactionsSnap.size, 'documents');
              
              transactionsSnap.forEach((doc) => {
                const data = doc.data();
                // Include all transaction types from Transactions collection (not just topup)
                // Only include if userId matches
                if (data.userId === userId) {
                  const trans = { id: doc.id, ...data, source: 'Transactions' };
                  // Avoid duplicates - check if transaction already exists from PayPalTransactions
                  const exists = transList.some(t => 
                    t.paypalTransactionId === data.paypalTransactionId && 
                    t.paypalTransactionId !== undefined
                  );
                  if (!exists) {
                    transList.push(trans);
                  }
                }
              });
              
              console.log('✅ Total transactions after adding from Transactions collection:', transList.length);
            } catch (transError) {
              console.error('Error fetching from Transactions collection:', transError);
              // Continue with what we have from PayPalTransactions
            }

            // Sort by date (most recent first)
            transList.sort((a, b) => {
              const dateA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds * 1000 || 0);
              const dateB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds * 1000 || 0);
              return dateB - dateA;
            });

            console.log('✅ Final transaction list:', transList.length, 'transactions');
            console.log('📋 Transaction types:', transList.map(t => ({ type: t.type, amount: t.amount })));
            
            setTransactions(transList);
            
            // Verify balance is in sync with transactions (optional safety check)
            // Calculate balance from transactions
            let calculatedBalance = 0;
            transList.forEach((trans) => {
              if (trans.type === 'topup' || trans.type === 'deposit') {
                calculatedBalance += trans.amount || 0;
              } else if (trans.type === 'payment' || trans.type === 'withdrawal') {
                calculatedBalance -= trans.amount || 0;
              }
            });

            // Get current balance from user document
            try {
              const userRef = doc(db, 'Users', userId);
              const userSnap = await getDoc(userRef);
              if (userSnap.exists()) {
                const userData = userSnap.data();
                const storedBalance = userData.balance || userData.walletBalance || userData.paypalBalance || 0;
                
                // If there's a discrepancy, sync the balance (use stored balance as source of truth)
                if (Math.abs(storedBalance - calculatedBalance) > 0.01) {
                  console.warn('Balance discrepancy detected. Using stored balance:', storedBalance);
                }
              }
            } catch (error) {
              console.error('Error verifying balance:', error);
            }
            
            setLoading(false);
          } catch (innerError) {
            console.error('Error processing snapshot data:', innerError);
            clearTimeout(loadingTimeout);
            setLoading(false);
            setTransactions([]);
          }
        }, 
        (error) => {
          console.error('Error fetching PayPal data:', error);
          clearTimeout(loadingTimeout);
          setLoading(false);
          setTransactions([]);
          
          // If it's a missing index error, try without orderBy
          if (error.code === 'failed-precondition' || error.message?.includes('index')) {
            console.log('Attempting to fetch without orderBy due to missing index...');
            try {
              const fallbackQuery = query(
                collection(db, 'PayPalTransactions'),
                where('userId', '==', userId)
              );
              
              const unsubFallback = onSnapshot(fallbackQuery, async (snapshot) => {
                try {
                  const transList = [];
                  console.log('📊 Fallback query snapshot received:', snapshot.size, 'documents');
                  
                  snapshot.forEach((doc) => {
                    const data = doc.data();
                    // Only include transactions for this user
                    if (data.userId === userId) {
                      console.log('📄 Fallback transaction:', {
                        id: doc.id,
                        userId: data.userId,
                        type: data.type,
                        amount: data.amount
                      });
                      transList.push({ id: doc.id, ...data, source: 'PayPalTransactions' });
                    }
                  });
                  
                  // Also try to fetch from Transactions collection
                  try {
                    const fallbackTransQuery = query(
                      collection(db, 'Transactions'),
                      where('userId', '==', userId)
                    );
                    const transactionsSnap = await getDocs(fallbackTransQuery);
                    transactionsSnap.forEach((doc) => {
                      const data = doc.data();
                      if (data.userId === userId) {
                        const exists = transList.some(t => 
                          t.paypalTransactionId === data.paypalTransactionId && 
                          t.paypalTransactionId !== undefined
                        );
                        if (!exists) {
                          transList.push({ id: doc.id, ...data, source: 'Transactions' });
                        }
                      }
                    });
                  } catch (transError) {
                    console.error('Error fetching Transactions in fallback:', transError);
                  }
                  
                  // Sort client-side
                  transList.sort((a, b) => {
                    const dateA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds * 1000 || 0);
                    const dateB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds * 1000 || 0);
                    return dateB - dateA;
                  });
                  
                  console.log('✅ Fallback query result:', transList.length, 'transactions');
                  setTransactions(transList);
                  setLoading(false);
                } catch (fallbackInnerError) {
                  console.error('Error processing fallback snapshot:', fallbackInnerError);
                  setLoading(false);
                  setTransactions([]);
                }
              }, (fallbackError) => {
                console.error('Fallback query also failed:', fallbackError);
                setLoading(false);
                setTransactions([]);
              });
              
              return unsubFallback;
            } catch (fallbackError) {
              console.error('Error setting up fallback query:', fallbackError);
              setLoading(false);
              setTransactions([]);
            }
          }
        }
      );

      return () => {
        clearTimeout(loadingTimeout);
        unsubPayPal();
      };
    } catch (error) {
      console.error('Error setting up PayPal data fetch:', error);
      setLoading(false);
      setTransactions([]);
      return () => {}; // Return empty function if error
    }
  };

  // Handle Top Up with PayPal Checkout
  const handleTopUpAmountChange = (e) => {
    const value = e.target.value;
    setTopUpAmount(value);
    // Show PayPal buttons if amount is valid
    const amount = parseFloat(value);
    if (amount && amount >= 100) {
      setShowPayPalButtons(true);
    } else {
      setShowPayPalButtons(false);
    }
  };

  const handlePayPalTopUpSuccess = async (data, actions) => {
    try {
      console.log('PayPal top-up payment approved, capturing order...', data);
      
      // Capture the payment
      const details = await actions.order.capture();
      console.log('PayPal payment captured successfully:', details);
      
      const amount = parseFloat(details.purchase_units[0].amount.value);
      
      setProcessing(true);

      const userRef = doc(db, 'Users', userId);
      
      // Get current balance atomically
      const userSnap = await getDoc(userRef);
      let currentBalance = 0;
      if (userSnap.exists()) {
        const userData = userSnap.data();
        currentBalance = userData.balance || userData.walletBalance || userData.paypalBalance || 0;
      }

      const newBalance = currentBalance + amount;

      // Create transaction record
      const transaction = {
        userId: userId,
        userRole: userRole,
        type: 'topup',
        amount: amount,
        currency: 'PHP',
        status: 'completed',
        description: `Top up via PayPal`,
        paymentMethod: 'paypal',
        paypalTransactionId: details.id,
        paypalPayerEmail: details.payer?.email_address || null,
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Add to Transactions collection (for Firebase balance system)
      await addDoc(collection(db, 'Transactions'), transaction);
      
      // Also add to PayPalTransactions for backward compatibility
      await addDoc(collection(db, 'PayPalTransactions'), {
        ...transaction,
        type: 'deposit' // Keep as deposit for backward compatibility
      });

      // Update balance in user document
      await updateDoc(userRef, {
        balance: newBalance,
        updatedAt: serverTimestamp()
      });

      console.log(`✅ Top-up successful: ₱${amount}. New balance: ₱${newBalance}`);
      
      alert(`Successfully topped up ₱${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} to your account!`);
      setTopUpAmount('');
      setShowPayPalButtons(false);
      setActiveTab('history');
    } catch (error) {
      console.error('Error processing top-up:', error);
      
      // Use standardized error handler
      const errorMessage = extractPayPalErrorMessage(error, {
        defaultMessage: 'Failed to process top-up. Please try again.',
        operation: 'top-up'
      });
      
      alert(errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  const handlePayPalTopUpError = (err) => {
    console.error('PayPal Top-Up Error:', err);
    
    // Use standardized error handler
    const errorMessage = extractPayPalErrorMessage(err, {
      defaultMessage: 'An error occurred with PayPal payment. Please try again.',
      operation: 'top-up'
    });
    
    alert(errorMessage);
    setProcessing(false);
  };

  const handlePayPalTopUpCancel = () => {
    console.log('PayPal top-up payment cancelled');
    setProcessing(false);
  };

  // 💸 Handle Withdrawal (Firebase user balance → PayPal account)
  // Flow: 1. Deduct from user's Firebase balance
  //       2. Use PayPal Payout API to add funds to user's PayPal account
  //       3. If payout fails, refund the balance automatically
  const handleWithdrawal = async () => {
    // Validate withdrawal amount
    const amount = parseFloat(withdrawalAmount);
    
    if (!amount || isNaN(amount) || amount <= 0) {
      alert('Please enter a valid withdrawal amount.');
      return;
    }

    if (amount < 100) {
      alert('Minimum withdrawal amount is ₱100.');
      return;
    }

    try {
      setProcessingWithdrawal(true);
      console.log('=== PROCESSING WITHDRAWAL ===');
      console.log('Amount:', amount);
      console.log('User ID:', userId);

      // 1️⃣ Get user data and validate
      const userRef = doc(db, 'Users', userId);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        alert('User account not found. Please contact support.');
        setProcessingWithdrawal(false);
        return;
      }

      const userData = userSnap.data();
      const currentBalance = userData.balance || userData.walletBalance || userData.paypalBalance || 0;

      console.log('Current balance:', currentBalance);

      // Check if user has sufficient balance
      if (amount > currentBalance) {
        alert(`Insufficient balance. You have ₱${currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} available.`);
        setProcessingWithdrawal(false);
        return;
      }

      // 2️⃣ Get PayPal payout email or payer ID (where money will be sent)
      // Check multiple possible locations for PayPal info
      const payoutEmail = paymentMethod?.paypalEmail ||
                         userData.paymentMethod?.paypalEmail || 
                         userData.paymentInfo?.payoutEmail || 
                         userData?.payoutEmail;
      const payerId = paymentMethod?.payerId ||
                     userData.paymentMethod?.payerId || 
                     userData.paypalAccountId ||
                     userData.paymentMethod?.payer_id;

      if (!payoutEmail && !payerId) {
        alert('No PayPal account found. Please connect your PayPal account in your profile first.');
        setProcessingWithdrawal(false);
        return;
      }

      console.log('=== PAYPAL PAYOUT INFO ===');
      console.log('Receiver Email:', payoutEmail || 'Not provided');
      console.log('Payer ID:', payerId || 'Not provided');
      console.log('Using Payer ID:', !!payerId);
      console.log('Recipient Type:', payerId ? 'PAYER_ID' : 'EMAIL');
      console.log('Recipient Value:', payerId || payoutEmail || 'Not provided');

      // 3️⃣ Calculate new balance and deduct from user's Firebase balance FIRST
      // IMPORTANT: We deduct from Firebase balance, NOT from platform PayPal balance
      const newBalance = currentBalance - amount;
      
      console.log('Deducting from user Firebase balance...');
      console.log('Balance before:', currentBalance);
      console.log('Amount to withdraw:', amount);
      console.log('Balance after:', newBalance);

      // Update balance in user document FIRST (before PayPal payout)
      // This ensures user's balance is deducted even if PayPal payout fails later
      await updateDoc(userRef, {
        balance: newBalance,
        paypalBalance: newBalance, // Keep for backward compatibility
        updatedAt: serverTimestamp()
      });
      console.log('✅ Balance deducted from user Firebase account');

      // 4️⃣ Process PayPal payout using REST API (adds funds to user's PayPal account)
      // NOTE: PayPal Payout API requires the platform PayPal account to have funds to send.
      // This is how PayPal's API works - it sends money FROM platform account TO user account.
      // For sandbox testing: Add test funds to your platform PayPal sandbox account.
      // The user's Firebase balance has already been deducted above.
      console.log('=== SENDING PAYPAL PAYOUT REQUEST ===');
      console.log('Receiver Email:', payoutEmail || 'Not provided');
      console.log('Payer ID:', payerId || 'Not provided');
      console.log('Amount:', amount);
      console.log('Currency: PHP');
      console.log('Sending payout request to PayPal to add funds to user PayPal account...');
      let payoutResult;
      try {
        payoutResult = await processPayPalPayoutAPI(
          payoutEmail || '',
          amount,
          'PHP',
          payerId || null
        );

        console.log('✅ PayPal payout response:', payoutResult);

        // Verify payout succeeded
        if (!payoutResult.success || !payoutResult.payoutBatchId) {
          console.error('❌ Payout failed - no batch ID received:', payoutResult);
          // Refund the balance back to user
          await updateDoc(userRef, {
            balance: currentBalance,
            paypalBalance: currentBalance,
            updatedAt: serverTimestamp()
          });
          console.log('✅ Balance refunded due to PayPal payout failure');
          throw new Error('Withdrawal failed. PayPal did not return a valid payout batch ID. Your balance has been refunded. Please try again or contact support.');
        }
      } catch (payoutError) {
        // If PayPal payout fails, refund the balance
        console.error('PayPal payout error, refunding balance...', payoutError);
        try {
          await updateDoc(userRef, {
            balance: currentBalance,
            paypalBalance: currentBalance,
            updatedAt: serverTimestamp()
          });
          console.log('✅ Balance refunded due to PayPal payout error');
        } catch (refundError) {
          console.error('❌ Failed to refund balance:', refundError);
        }
        throw payoutError;
      }

      // Verify batch status
      const batchStatus = payoutResult.batchStatus || 'PENDING';
      const transactionStatus = payoutResult.transactionStatus || 'PENDING';
      
      console.log('Payout batch status:', batchStatus);
      console.log('Transaction status:', transactionStatus);
      console.log('Payout batch ID:', payoutResult.payoutBatchId);

      // 5️⃣ Create withdrawal transaction record in PayPalTransactions
      const withdrawalTransaction = {
        userId: userId,
        userRole: userRole || 'guest',
        type: 'withdrawal',
        amount: amount,
        currency: 'PHP',
        status: transactionStatus === 'SUCCESS' ? 'completed' : 'pending',
        description: `Withdrawal from Firebase balance to PayPal${payoutEmail ? ` (${payoutEmail})` : ''}`,
        paymentMethod: 'paypal',
        source: 'user_balance', // Indicates this came from user's Firebase balance
        payoutBatchId: payoutResult.payoutBatchId,
        batchStatus: batchStatus,
        payoutItemId: payoutResult.payoutItemId || null,
        transactionId: payoutResult.transactionId || null,
        transactionStatus: transactionStatus,
        payerId: payerId || null,
        accountId: payerId || null,
        paypalEmail: payoutEmail || null,
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      console.log('Creating withdrawal transaction record...');
      const transactionRef = await addDoc(collection(db, 'PayPalTransactions'), withdrawalTransaction);
      console.log('✅ Transaction record created:', transactionRef.id);
      
      // Also add to Transactions collection for consistency
      await addDoc(collection(db, 'Transactions'), withdrawalTransaction);
      console.log('✅ Transaction also added to Transactions collection');

      // 6️⃣ Success message
      const successMessage = `Successfully withdrawn ₱${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} from your Firebase balance to your PayPal account!\n\n` +
                            `Your Firebase balance: ₱${newBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` +
                            `Payout Batch ID: ${payoutResult.payoutBatchId}\n` +
                            `Status: ${batchStatus}\n\n` +
                            `The funds should arrive in your PayPal account shortly.`;
      
      alert(successMessage);
      console.log('✅ Withdrawal completed successfully');
      
      // Reset form and switch to history tab
      setWithdrawalAmount('');
      setActiveTab('history');
      
    } catch (error) {
      console.error('❌ WITHDRAWAL ERROR:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      
      // Use standardized error handler
      const errorMessage = extractPayPalErrorMessage(error, {
        defaultMessage: 'Failed to process withdrawal. Please try again.',
        operation: 'withdrawal'
      });
      
      alert(`Withdrawal Error: ${errorMessage}`);
    } finally {
      setProcessingWithdrawal(false);
    }
  };

  const handleClose = () => {
    if (dialogRef.current) {
      dialogRef.current.close();
    }
    if (onClose) {
      onClose();
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toMillis ? new Date(timestamp.toMillis()) : new Date(timestamp.seconds * 1000);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <dialog ref={dialogRef} className="paypal-dialog" onClose={handleClose}>
      <div className="paypal-dialog-content">
        <div className="paypal-header">
          <div className="paypal-header-left">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="#0070ba">
              <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.533zm14.146-14.42a.915.915 0 0 0-.867-.675H9.407c-.524 0-.968.382-1.05.9L7.15 18.367h4.53c.524 0 .968-.382 1.05-.9l1.12-7.533h2.19c4.298 0 7.664-1.747 8.647-6.797.03-.149.054-.294.077-.437z"/>
            </svg>
            <div>
              <h2>PayPal Account</h2>
              <p className="paypal-email">{paymentMethod?.paypalEmail || 'No email'}</p>
            </div>
          </div>
          <button className="paypal-close-btn" onClick={handleClose}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="paypal-balance-card">
          <div className="balance-label">Available Balance</div>
          <div className="balance-amount">₱{balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>

        <div className="paypal-tabs">
          <button 
            className={`paypal-tab ${activeTab === 'topup' ? 'active' : ''}`}
            onClick={() => setActiveTab('topup')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Top Up
          </button>
          <button 
            className={`paypal-tab ${activeTab === 'withdraw' ? 'active' : ''}`}
            onClick={() => setActiveTab('withdraw')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Withdraw Money
          </button>
          <button 
            className={`paypal-tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
            Payment History
          </button>
        </div>

        <div className="paypal-content">
          {activeTab === 'topup' && (
            <div className="deposit-section">
              <div className="deposit-form">
                <label htmlFor="topUpAmount">Top Up Amount</label>
                <div className="deposit-input-wrapper">
                  <span className="currency-symbol">₱</span>
                  <input
                    type="number"
                    id="topUpAmount"
                    placeholder="0.00"
                    value={topUpAmount}
                    onChange={handleTopUpAmountChange}
                    min="100"
                    step="0.01"
                    disabled={processing}
                  />
                </div>
                <p className="deposit-note">Minimum top-up: ₱100.00</p>
                
                {showPayPalButtons && parseFloat(topUpAmount) >= 100 && (
                  <div style={{ marginTop: '20px' }}>
                    <PayPalScriptProvider 
                      options={{ 
                        "client-id": PAYPAL_CLIENT_ID,
                        currency: "PHP",
                        intent: "capture"
                      }}
                    >
                      <PayPalButtons
                        createOrder={(data, actions) => {
                          const amount = parseFloat(topUpAmount);
                          if (isNaN(amount) || amount <= 0) {
                            throw new Error('Invalid top-up amount');
                          }
                          
                          return actions.order.create({
                            purchase_units: [{
                              amount: {
                                value: amount.toFixed(2),
                                currency_code: "PHP"
                              },
                              description: `Top up account balance`
                            }],
                            application_context: {
                              brand_name: "StaySmart",
                              landing_page: "NO_PREFERENCE",
                              user_action: "PAY_NOW"
                            }
                          });
                        }}
                        onApprove={handlePayPalTopUpSuccess}
                        onError={handlePayPalTopUpError}
                        onCancel={handlePayPalTopUpCancel}
                        style={{
                          layout: "vertical",
                          color: "blue",
                          shape: "rect",
                          label: "paypal"
                        }}
                      />
                    </PayPalScriptProvider>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'withdraw' && (
            <div className="deposit-section">
              <div className="deposit-form">
                <label htmlFor="withdrawalAmount">Withdrawal Amount</label>
                <div className="deposit-input-wrapper">
                  <span className="currency-symbol">₱</span>
                  <input
                    type="number"
                    id="withdrawalAmount"
                    placeholder="0.00"
                    value={withdrawalAmount}
                    onChange={(e) => setWithdrawalAmount(e.target.value)}
                    min="100"
                    step="0.01"
                    disabled={processingWithdrawal}
                  />
                </div>
                <p className="deposit-note">
                  Minimum withdrawal: ₱100.00<br/>
                  Available balance: ₱{balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                {(!paymentMethod?.paypalEmail && !paymentMethod?.payerId) && (
                  <div style={{ 
                    padding: '12px', 
                    backgroundColor: '#fef2f2', 
                    border: '1px solid #fecaca', 
                    borderRadius: '8px', 
                    marginTop: '12px' 
                  }}>
                    <p style={{ color: '#ef4444', fontSize: '14px', margin: 0 }}>
                      ⚠️ Please connect your PayPal account in your profile to withdraw funds.
                    </p>
                  </div>
                )}
                <button 
                  className="deposit-btn"
                  onClick={handleWithdrawal}
                  disabled={
                    processingWithdrawal || 
                    !withdrawalAmount || 
                    parseFloat(withdrawalAmount) < 100 ||
                    parseFloat(withdrawalAmount) > balance ||
                    (!paymentMethod?.paypalEmail && !paymentMethod?.payerId)
                  }
                  style={{
                    backgroundColor: processingWithdrawal ? '#9ca3af' : '#10b981',
                    opacity: (processingWithdrawal || !withdrawalAmount || parseFloat(withdrawalAmount) < 100 || parseFloat(withdrawalAmount) > balance || (!paymentMethod?.paypalEmail && !paymentMethod?.payerId)) ? 0.5 : 1
                  }}
                >
                  {processingWithdrawal ? 'Processing Withdrawal...' : 'Withdraw to PayPal'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="history-section">
              {loading ? (
                <div className="paypal-loading">
                  <p>Loading transaction history...</p>
                </div>
              ) : transactions.length === 0 ? (
                <div className="paypal-empty">
                  <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                  </svg>
                  <p>No transactions yet</p>
                  <p className="empty-subtitle">Start by topping up your account</p>
                </div>
              ) : (
                <div className="transaction-list">
                  {transactions.map((transaction) => {
                    // Map transaction types to user-friendly labels
                    const getTransactionLabel = (transaction) => {
                      if (transaction.description) return transaction.description
                      
                      const type = transaction.type || ''
                      const typeMap = {
                        'service_fee': 'Service Fee',
                        'booking_earnings': 'Booking Earnings',
                        'deposit': 'Deposit',
                        'withdrawal': 'Withdrawal',
                        'payment': 'Payment',
                        'topup': 'Top Up',
                        'refund': 'Refund',
                        'earnings': 'Earnings'
                      }
                      
                      return typeMap[type] || type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ') || 'Transaction'
                    }

                    return (
                    <div key={transaction.id} className="transaction-item">
                      <div className="transaction-icon">
                        {(transaction.type === 'deposit' || transaction.type === 'topup') ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                          </svg>
                        ) : transaction.type === 'withdrawal' ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                            <polyline points="12 5 19 12 12 19"></polyline>
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                          </svg>
                        )}
                      </div>
                      <div className="transaction-details" style={{ flex: 1 }}>
                        <div className="transaction-title">{getTransactionLabel(transaction)}</div>
                        <div className="transaction-date">{formatDate(transaction.createdAt)}</div>
                        {transaction.payoutBatchId && (
                          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                            Batch ID: {transaction.payoutBatchId}
                          </div>
                        )}
                        {transaction.status && transaction.status !== 'completed' && (
                          <div style={{ fontSize: '11px', color: transaction.status === 'pending' ? '#f59e0b' : '#ef4444', marginTop: '2px' }}>
                            Status: {transaction.status}
                          </div>
                        )}
                      </div>
                      <div className={`transaction-amount ${(transaction.type === 'deposit' || transaction.type === 'topup') ? 'positive' : 'negative'}`}>
                        {(transaction.type === 'deposit' || transaction.type === 'topup') ? '+' : '-'}₱{transaction.amount?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
};

export default PayPal;

