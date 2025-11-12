import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, doc, updateDoc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { processPayPalPayout as processPayPalPayoutAPI, syncPayPalBalanceToFirebase } from '../utils/paypalApi';
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
          
          // If user has PayPal account, try to fetch actual balance for comparison (via Firebase Function)
          if (userData.paypalAccountId || userData.paymentMethod?.payerId) {
            try {
              const { getPayPalBalance } = await import('../utils/paypalApi');
              console.log('Calling Firebase Function to get PayPal balance for user:', userId);
              const balanceResult = await getPayPalBalance(userId, 'PHP');
              const actualPayPalBalance = balanceResult.balance;
              
              console.log('💰💰💰 ACTUAL PAYPAL SANDBOX ACCOUNT BALANCE (from API via Firebase Function):', actualPayPalBalance);
              console.log('📊📊📊 FIREBASE BALANCE:', newBalance);
              console.log('Difference:', actualPayPalBalance - newBalance);
              
              if (Math.abs(actualPayPalBalance - newBalance) > 0.01) {
                console.warn('⚠️⚠️⚠️ BALANCE MISMATCH!');
                console.warn('PayPal Account has:', actualPayPalBalance);
                console.warn('Firebase shows:', newBalance);
                console.warn('Difference:', actualPayPalBalance - newBalance);
              } else {
                console.log('✅✅✅ Balances match!');
              }
            } catch (balanceError) {
              console.warn('⚠️ Could not fetch PayPal balance (via Firebase Function):', balanceError.message);
              console.warn('Error code:', balanceError.code);
              console.warn('Error details:', balanceError.details);
              
              // Provide more specific warnings
              if (balanceError.message && (
                balanceError.message.includes('Reporting API') || 
                balanceError.message.includes('not available') ||
                balanceError.message.includes('forbidden') ||
                balanceError.message.includes('403')
              )) {
                console.warn('⚠️ PayPal Reporting API is not available. This is normal for sandbox accounts.');
                console.warn('⚠️ The balance shown is from Firebase transactions only.');
              } else if (balanceError.code === 'functions/not-found') {
                console.warn('⚠️ Firebase Functions not deployed. Please deploy functions first.');
              } else if (balanceError.code === 'functions/failed-precondition') {
                console.warn('⚠️ PayPal credentials not configured in Firebase Functions.');
              } else {
                console.warn('⚠️ This might be expected if Firebase Functions are not deployed or PayPal credentials are not configured.');
              }
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
      
      // Fetch transactions from both collections
      const paypalTransactionsQuery = query(
        collection(db, 'PayPalTransactions'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      
      const transactionsQuery = query(
        collection(db, 'Transactions'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );

      // Listen to PayPalTransactions
      const unsubPayPal = onSnapshot(paypalTransactionsQuery, async (snapshot) => {
        const transList = [];

        snapshot.forEach((doc) => {
          const data = doc.data();
          const trans = { id: doc.id, ...data, source: 'PayPalTransactions' };
          transList.push(trans);
        });

        // Also fetch from Transactions collection for top-up transactions
        const transactionsSnap = await getDocs(transactionsQuery);
        transactionsSnap.forEach((doc) => {
          const data = doc.data();
          // Only include top-up transactions from Transactions collection
          if (data.type === 'topup') {
            const trans = { id: doc.id, ...data, source: 'Transactions' };
            transList.push(trans);
          }
        });

        // Sort by date (most recent first)
        transList.sort((a, b) => {
          const dateA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds * 1000 || 0);
          const dateB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds * 1000 || 0);
          return dateB - dateA;
        });

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
      }, (error) => {
        console.error('Error fetching PayPal data:', error);
        setLoading(false);
      });

      return unsubPayPal;
    } catch (error) {
      console.error('Error fetching PayPal data:', error);
      setLoading(false);
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
      alert('Failed to process top-up. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handlePayPalTopUpError = (err) => {
    console.error('PayPal Top-Up Error:', err);
    alert('An error occurred with PayPal payment. Please try again.');
    setProcessing(false);
  };

  const handlePayPalTopUpCancel = () => {
    console.log('PayPal top-up payment cancelled');
    setProcessing(false);
  };

  // 💸 Handle Withdrawal (wallet balance → PayPal account)
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

      console.log('PayPal payout info:', {
        payoutEmail: payoutEmail || 'Not provided',
        payerId: payerId || 'Not provided',
        usingPayerId: !!payerId
      });

      // 3️⃣ Process PayPal payout using REST API
      console.log('Sending payout request to PayPal...');
      const payoutResult = await processPayPalPayoutAPI(
        payoutEmail || '',
        amount,
        'PHP',
        payerId || null
      );

      console.log('✅ PayPal payout response:', payoutResult);

      // 4️⃣ Verify payout succeeded
      if (!payoutResult.success || !payoutResult.payoutBatchId) {
        console.error('❌ Payout failed - no batch ID received:', payoutResult);
        throw new Error('Withdrawal failed. PayPal did not return a valid payout batch ID. Please try again or contact support.');
      }

      // Verify batch status
      const batchStatus = payoutResult.batchStatus || 'PENDING';
      const transactionStatus = payoutResult.transactionStatus || 'PENDING';
      
      console.log('Payout batch status:', batchStatus);
      console.log('Transaction status:', transactionStatus);
      console.log('Payout batch ID:', payoutResult.payoutBatchId);

      // 5️⃣ Calculate new balance
      const newBalance = currentBalance - amount;

      // 6️⃣ Create withdrawal transaction record in PayPalTransactions
      const withdrawalTransaction = {
        userId: userId,
        userRole: userRole || 'guest',
        type: 'withdrawal',
        amount: amount,
        currency: 'PHP',
        status: transactionStatus === 'SUCCESS' ? 'completed' : 'pending',
        description: `Withdrawal to PayPal${payoutEmail ? ` (${payoutEmail})` : ''}`,
        paymentMethod: 'paypal',
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

      // 7️⃣ Update balance in user document
      await updateDoc(userRef, {
        balance: newBalance,
        paypalBalance: newBalance, // Keep for backward compatibility
        updatedAt: serverTimestamp()
      });
      console.log('✅ Balance updated in user document');

      // 8️⃣ Success message
      const successMessage = `Successfully withdrawn ₱${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} to your PayPal account!\n\n` +
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
      
      // Provide user-friendly error messages
      let errorMessage = 'Failed to process withdrawal. Please try again.';
      
      if (error.message) {
        // Check for specific PayPal errors
        const errorMsg = error.message.toUpperCase();
        
        if (errorMsg.includes('INSUFFICIENT_FUNDS') || errorMsg.includes('INSUFFICIENT')) {
          errorMessage = 'Insufficient funds in platform PayPal account for withdrawal. Please contact support.';
        } else if (errorMsg.includes('INVALID_RECEIVER') || errorMsg.includes('INVALID')) {
          errorMessage = 'Invalid PayPal receiver. Please check your PayPal email or payer ID in your profile.';
        } else if (errorMsg.includes('AUTHENTICATION') || errorMsg.includes('AUTH')) {
          errorMessage = 'PayPal authentication failed. Please contact support.';
        } else if (errorMsg.includes('NOT_FOUND')) {
          errorMessage = 'PayPal account not found. Please verify your PayPal email or payer ID.';
        } else {
          errorMessage = error.message;
        }
      }
      
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
                  {transactions.map((transaction) => (
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
                        <div className="transaction-title">{transaction.description || `${transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}`}</div>
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
                  ))}
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

