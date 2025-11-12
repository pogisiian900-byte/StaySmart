import React, { useEffect, useState, useRef } from 'react'
import me from '/static/no photo.webp'
import bgBlue from '/static/Bluebg.png'
import { useNavigate, useParams } from 'react-router-dom'
import { doc, getDoc, updateDoc, collection, query, where, getDocs, onSnapshot, serverTimestamp, orderBy, addDoc } from "firebase/firestore";
import { db } from ".././config/firebase";
import "../pages/host/profile-new.css";
import 'dialog-polyfill/dist/dialog-polyfill.css';
import dialogPolyfill from 'dialog-polyfill';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import PayPal from './paypal';
import SlideshowWheel from './sildeshowWheel';
const Profile = () => {
const { hostId, guestId } = useParams();
const [user, setUser] = useState(null);
const [loading, setLoading] = useState(true);
const [editedUser, setEditedUser] = useState(null);
const [isSaving, setIsSaving] = useState(false);
const [paymentMethod, setPaymentMethod] = useState(null);
const [paymentMethodType, setPaymentMethodType] = useState('card');
const [showPayPalDialog, setShowPayPalDialog] = useState(false);
const [recentBookings, setRecentBookings] = useState([]);
const [loadingBookings, setLoadingBookings] = useState(true);
const [showWithdrawalDialog, setShowWithdrawalDialog] = useState(false);
const [withdrawalAmount, setWithdrawalAmount] = useState('');
const [withdrawalMethod, setWithdrawalMethod] = useState('bank'); // 'bank', 'paypal', 'gcash'
const [withdrawalAccount, setWithdrawalAccount] = useState('');
const [processingWithdrawal, setProcessingWithdrawal] = useState(false);
const navigate = useNavigate();
const dialogRef = useRef(null);
const fileInputRef = useRef(null);
const paymentDialogRef = useRef(null);
const withdrawalDialogRef = useRef(null);

// Payment method form state
const [paymentForm, setPaymentForm] = useState({
  cardNumber: '',
  cardHolder: '',
  expiryDate: '',
  cvv: '',
  billingAddress: '',
  paypalBusinessEmail: '',
  paypalBusinessName: ''
});


const loadRecentBookings = async () => {
  if (!guestId) return;
  
  try {
    setLoadingBookings(true);
    const reservationsQuery = query(
      collection(db, 'Reservation'),
      where('guestId', '==', guestId)
    );
    const reservationsSnapshot = await getDocs(reservationsQuery);
    
    const bookings = [];
    const seenListingIds = new Set(); // Track listing IDs to avoid duplicates
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    for (const reservationDoc of reservationsSnapshot.docs) {
      const reservation = { id: reservationDoc.id, ...reservationDoc.data() };
      
      // Filter by status (confirmed or pending) and date (last 30 days)
      const status = (reservation.status || '').toLowerCase();
      if (status !== 'confirmed' && status !== 'pending') continue;
      
      const createdAt = reservation.createdAt?.toDate ? reservation.createdAt.toDate() : new Date(reservation.createdAt);
      if (createdAt < thirtyDaysAgo) continue;
      
      // Fetch the listing details
      if (reservation.listingId) {
        // Skip if we've already added this listing
        if (seenListingIds.has(reservation.listingId)) continue;
        
        try {
          const listingRef = doc(db, 'Listings', reservation.listingId);
          const listingDoc = await getDoc(listingRef);
          
          if (listingDoc.exists()) {
            const listingData = { id: listingDoc.id, ...listingDoc.data() };
            bookings.push({
              ...listingData,
              bookingDate: createdAt,
              reservationId: reservation.id
            });
            seenListingIds.add(reservation.listingId); // Mark as seen
          }
        } catch (error) {
          console.error('Error fetching listing:', error);
        }
      }
    }
    
    // Sort by booking date (most recent first) and limit to 10
    bookings.sort((a, b) => b.bookingDate - a.bookingDate);
    setRecentBookings(bookings.slice(0, 10));
  } catch (error) {
    console.error('Error loading recent bookings:', error);
  } finally {
    setLoadingBookings(false);
  }
};

useEffect(() => {
  // Register dialog polyfills when component mounts
  if (dialogRef.current && !dialogRef.current.showModal) {
    dialogPolyfill.registerDialog(dialogRef.current);
  }
  if (paymentDialogRef.current && !paymentDialogRef.current.showModal) {
    dialogPolyfill.registerDialog(paymentDialogRef.current);
  }
  if (withdrawalDialogRef.current && !withdrawalDialogRef.current.showModal) {
    dialogPolyfill.registerDialog(withdrawalDialogRef.current);
  }

  const userId = hostId || guestId;
  if (!userId) {
    setLoading(false);
    return;
  }

  // Real-time listener for user data (for balance updates)
  const userRef = doc(db, "Users", userId);
  const unsubscribeUser = onSnapshot(userRef, async (userSnap) => {
    if (userSnap.exists()) {
      const userData = userSnap.data();
      
      console.log('=== USER DATA LOADED (Profile Component) ===');
      console.log('User ID:', userId);
      console.log('Firebase paypalBalance:', userData.paypalBalance);
      console.log('PayPal Account ID:', userData.paypalAccountId);
      console.log('Payment Method:', userData.paymentMethod);
      
      // If user has PayPal account connected, fetch actual balance from PayPal API
      if (userData.paypalAccountId || userData.paymentMethod?.payerId) {
        console.log('=== FETCHING ACTUAL PAYPAL SANDBOX BALANCE ===');
        console.log('PayPal Account ID:', userData.paypalAccountId || userData.paymentMethod?.payerId);
        console.log('PayPal Email:', userData.paymentMethod?.paypalEmail);
        
        try {
          const { getPayPalBalance } = await import('../utils/paypalApi');
          console.log('Calling Firebase Function to get PayPal balance for user:', userId);
          const balanceResult = await getPayPalBalance(userId, 'PHP');
          const actualPayPalBalance = balanceResult.balance;
          
          console.log('💰💰💰 ACTUAL PAYPAL SANDBOX ACCOUNT BALANCE (from API via Firebase Function):', actualPayPalBalance);
          console.log('📊📊📊 FIREBASE BALANCE:', userData.paypalBalance);
          console.log('Difference:', actualPayPalBalance - (userData.paypalBalance || 0));
          console.log('Full PayPal balance data:', balanceResult.balanceData);
          
          if (Math.abs(actualPayPalBalance - (userData.paypalBalance || 0)) > 0.01) {
            console.warn('⚠️⚠️⚠️ BALANCE MISMATCH DETECTED!');
            console.warn('PayPal Sandbox Account Balance:', actualPayPalBalance);
            console.warn('Firebase Balance:', userData.paypalBalance);
            console.warn('Difference:', actualPayPalBalance - (userData.paypalBalance || 0));
            console.warn('Consider using "Sync Balance" button to sync them.');
          } else {
            console.log('✅✅✅ Balances are in sync!');
          }
        } catch (balanceError) {
          console.warn('⚠️ Could not fetch PayPal balance from API (via Firebase Function):', balanceError.message);
          console.warn('Error code:', balanceError.code);
          console.warn('This might be expected if:');
          console.warn('  1. Firebase Functions are not deployed');
          console.warn('  2. The balance API requires different permissions');
          console.warn('  3. PayPal credentials are not configured in Firebase Functions');
          console.warn('Error details:', balanceError);
        }
      } else {
        console.log('No PayPal account connected yet.');
      }
      
      setUser(userData);
      setEditedUser(userData);
      
      // Set payment method if exists
      if (userData.paymentMethod) {
        setPaymentMethod(userData.paymentMethod);
        setPaymentMethodType(userData.paymentMethod.type || 'card');
      }
    } else {
      console.log("No such user found!");
    }
    setLoading(false);
  }, (error) => {
    console.error("❌ Error fetching user data:", error);
    setLoading(false);
  });

  return () => {
    unsubscribeUser();
  };
}, [hostId, guestId]);

// Separate useEffect for loading recent bookings
useEffect(() => {
  if (guestId) {
    loadRecentBookings();
  }
}, [guestId]);

const handleBack = ()=>{
  if(user?.role == "host"){
    navigate("/host/"+hostId);
  }else{
    navigate("/guest/"+guestId);
  }
}

const handleEditClick = () => {
  setEditedUser(user);
  
  setTimeout(() => {
    if (dialogRef.current) {
      try {
        if (typeof dialogRef.current.showModal === 'function') {
          dialogRef.current.showModal();
        } else {
          dialogPolyfill.registerDialog(dialogRef.current);
          dialogRef.current.showModal();
        }
      } catch (err) {
        console.error('Error showing dialog:', err);
        dialogRef.current.style.display = 'block';
      }
    }
  }, 50);
};

const handleCloseDialog = () => {
  setEditedUser(user);
  dialogRef.current?.close();
};

const handleInputChange = (e) => {
  const { name, value } = e.target;
  setEditedUser(prev => ({
    ...prev,
    [name]: value
  }));
};

// Cloudinary upload function
const uploadImageToCloudinary = async (file) => {
  const uploadPreset = "listing_uploads";
  const cloudName = "ddckoojwo";

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Upload failed");
  return data.secure_url;
};

const handleImageUpload = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // Validate file type
  if (!file.type.startsWith('image/')) {
    alert('Please select an image file');
    return;
  }

  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    alert('Image size must be less than 5MB');
    return;
  }

  try {
    setIsSaving(true);
    const url = await uploadImageToCloudinary(file);
    
    setEditedUser(prev => ({
      ...prev,
      profilePicture: url
    }));
    
    alert('Profile picture uploaded successfully!');
  } catch (error) {
    console.error('Error uploading image:', error);
    alert(`Failed to upload image: ${error.message || 'Please try again.'}`);
  } finally {
    setIsSaving(false);
  }
};

const handleSave = async () => {
  try {
    setIsSaving(true);
    const userId = hostId || guestId;
    const userRef = doc(db, 'Users', userId);
    await updateDoc(userRef, editedUser);
    setUser(editedUser);
    handleCloseDialog();
    alert('Profile updated successfully!');
  } catch (error) {
    console.error('Error updating profile:', error);
    alert('Failed to update profile. Please try again.');
  } finally {
    setIsSaving(false);
  }
};

// Withdrawal Functions
const handleWithdrawal = async () => {
  const userId = hostId || guestId;
  if (!userId) return;

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
    
    // Get user data and validate balance
    const userRef = doc(db, 'Users', userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      alert('User account not found. Please contact support.');
      setProcessingWithdrawal(false);
      return;
    }

    const userData = userSnap.data();
    const currentBalance = userData.balance || userData.walletBalance || 0;

    // Check if user has sufficient balance
    if (amount > currentBalance) {
      alert(`Insufficient balance. You have ₱${currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} available.`);
      setProcessingWithdrawal(false);
      return;
    }

    // Handle PayPal withdrawal differently - process directly via PayPal API
    if (withdrawalMethod === 'paypal') {
      // Get PayPal account info
      const payoutEmail = withdrawalAccount.trim() || 
                         paymentMethod?.paypalEmail ||
                         userData.paymentMethod?.paypalEmail || 
                         userData.paymentInfo?.payoutEmail || 
                         userData?.payoutEmail;
      const payerId = paymentMethod?.payerId ||
                     userData.paymentMethod?.payerId || 
                     userData.paypalAccountId ||
                     userData.paymentMethod?.payer_id;

      if (!payoutEmail && !payerId) {
        alert('No PayPal account found. Please connect your PayPal account in your profile first or enter your PayPal email.');
        setProcessingWithdrawal(false);
        return;
      }

      if (!payoutEmail && !withdrawalAccount.trim()) {
        alert('Please enter your PayPal email address.');
        setProcessingWithdrawal(false);
        return;
      }

      try {
        // Import PayPal payout function
        const { processPayPalPayout } = await import('../utils/paypalApi');
        
        console.log('Processing PayPal withdrawal...', {
          payoutEmail: payoutEmail || withdrawalAccount.trim(),
          amount,
          payerId
        });

        // Process PayPal payout
        const payoutResult = await processPayPalPayout(
          payoutEmail || withdrawalAccount.trim(),
          amount,
          'PHP',
          payerId || null
        );

        console.log('PayPal payout result:', payoutResult);

        // Verify payout succeeded
        if (!payoutResult.success || !payoutResult.payoutBatchId) {
          throw new Error('PayPal withdrawal failed. Please try again or contact support.');
        }

        const batchStatus = payoutResult.batchStatus || 'PENDING';
        const transactionStatus = payoutResult.transactionStatus || 'PENDING';

        // Calculate new balance
        const newBalance = currentBalance - amount;

        // Create withdrawal transaction record
        const withdrawalTransaction = {
          userId: userId,
          userRole: userData.role || 'guest',
          type: 'withdrawal',
          amount: amount,
          currency: 'PHP',
          status: transactionStatus === 'SUCCESS' ? 'completed' : 'pending',
          description: `Withdrawal to PayPal${payoutEmail ? ` (${payoutEmail})` : ` (${withdrawalAccount.trim()})`}`,
          paymentMethod: 'paypal',
          payoutBatchId: payoutResult.payoutBatchId,
          batchStatus: batchStatus,
          payoutItemId: payoutResult.payoutItemId || null,
          transactionId: payoutResult.transactionId || null,
          transactionStatus: transactionStatus,
          payerId: payerId || null,
          paypalEmail: payoutEmail || withdrawalAccount.trim(),
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        // Add to PayPalTransactions collection
        await addDoc(collection(db, 'PayPalTransactions'), withdrawalTransaction);
        
        // Also add to Transactions collection
        await addDoc(collection(db, 'Transactions'), withdrawalTransaction);

        // Update balance in user document
        await updateDoc(userRef, {
          balance: newBalance,
          walletBalance: newBalance,
          updatedAt: serverTimestamp()
        });

        // Create notification for user
        await addDoc(collection(db, 'Notifications'), {
          type: 'withdrawal_completed',
          recipientId: userId,
          title: 'PayPal Withdrawal Successful',
          body: `Successfully withdrawn ₱${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} to your PayPal account. The funds should arrive shortly.`,
          message: `Withdrawal of ₱${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} completed.`,
          read: false,
          createdAt: serverTimestamp()
        });

        alert(`✅ Successfully withdrawn ₱${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} to your PayPal account!\n\nPayout Batch ID: ${payoutResult.payoutBatchId}\nStatus: ${batchStatus}\n\nThe funds should arrive in your PayPal account shortly.`);
        
        // Reset form and close dialog
        setWithdrawalAmount('');
        setWithdrawalAccount('');
        setWithdrawalMethod('bank');
        setShowWithdrawalDialog(false);
        withdrawalDialogRef.current?.close();
        
        return;
      } catch (paypalError) {
        console.error('PayPal withdrawal error:', paypalError);
        alert(`PayPal withdrawal failed: ${paypalError.message || 'Please try again or contact support.'}`);
        setProcessingWithdrawal(false);
        return;
      }
    }

    // Handle other withdrawal methods (bank, gcash, paymaya) - create pending request
    if (!withdrawalAccount || withdrawalAccount.trim() === '') {
      alert('Please enter your account details.');
      setProcessingWithdrawal(false);
      return;
    }

    // Calculate new balance
    const newBalance = currentBalance - amount;

    // Create withdrawal transaction record
    const withdrawalTransaction = {
      userId: userId,
      userRole: userData.role || 'guest',
      type: 'withdrawal',
      amount: amount,
      currency: 'PHP',
      status: 'pending', // Admin will approve/process
      description: `Withdrawal request via ${withdrawalMethod}`,
      paymentMethod: withdrawalMethod,
      accountDetails: withdrawalAccount,
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // Add to Transactions collection
    const transactionRef = await addDoc(collection(db, 'Transactions'), withdrawalTransaction);
    
    // Also add to Withdrawals collection for admin management
    await addDoc(collection(db, 'Withdrawals'), {
      ...withdrawalTransaction,
      requestId: transactionRef.id
    });

    // Update balance in user document (hold the funds)
    await updateDoc(userRef, {
      balance: newBalance,
      walletBalance: newBalance, // Keep for backward compatibility
      updatedAt: serverTimestamp()
    });

    // Create notification for user
    await addDoc(collection(db, 'Notifications'), {
      type: 'withdrawal_requested',
      recipientId: userId,
      title: 'Withdrawal Request Submitted',
      body: `Your withdrawal request of ₱${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} has been submitted and is pending admin approval.`,
      message: `Withdrawal request of ₱${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} submitted.`,
      read: false,
      createdAt: serverTimestamp()
    });

    alert(`Withdrawal request submitted successfully!\n\nAmount: ₱${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nMethod: ${withdrawalMethod}\n\nYour request is pending admin approval. You will be notified once it's processed.`);
    
    // Reset form and close dialog
    setWithdrawalAmount('');
    setWithdrawalAccount('');
    setWithdrawalMethod('bank');
    setShowWithdrawalDialog(false);
    withdrawalDialogRef.current?.close();
    
  } catch (error) {
    console.error('Error processing withdrawal:', error);
    alert(`Failed to process withdrawal: ${error.message || 'Please try again.'}`);
  } finally {
    setProcessingWithdrawal(false);
  }
};

// Payment Method Functions
const handleOpenPaymentDialog = () => {
  setPaymentForm({
    cardNumber: '',
    cardHolder: '',
    expiryDate: '',
    cvv: '',
    billingAddress: ''
  });
  if (paymentMethod) {
    setPaymentMethodType(paymentMethod.type || 'card');
  }
  
  setTimeout(() => {
    if (paymentDialogRef.current) {
      try {
        if (typeof paymentDialogRef.current.showModal === 'function') {
          paymentDialogRef.current.showModal();
        } else {
          dialogPolyfill.registerDialog(paymentDialogRef.current);
          paymentDialogRef.current.showModal();
        }
      } catch (err) {
        console.error('Error showing payment dialog:', err);
        paymentDialogRef.current.style.display = 'block';
      }
    }
  }, 50);
};

const handleClosePaymentDialog = () => {
  paymentDialogRef.current?.close();
  setPaymentForm({
    cardNumber: '',
    cardHolder: '',
    expiryDate: '',
    cvv: '',
    billingAddress: '',
    paypalBusinessEmail: '',
    paypalBusinessName: ''
  });
  setPaymentMethodType('card');
};

const handlePaymentFormChange = (e) => {
  const { name, value } = e.target;
  let formattedValue = value;

  // Format card number with spaces (XXXX XXXX XXXX XXXX)
  if (name === 'cardNumber') {
    const digits = value.replace(/\D/g, '');
    formattedValue = digits.match(/.{1,4}/g)?.join(' ') || digits;
    if (formattedValue.length > 19) {
      formattedValue = formattedValue.slice(0, 19);
    }
  }

  // Format expiry date (MM/YY)
  if (name === 'expiryDate') {
    const digits = value.replace(/\D/g, '');
    if (digits.length >= 2) {
      formattedValue = `${digits.slice(0, 2)}/${digits.slice(2, 4)}`;
    } else {
      formattedValue = digits;
    }
    if (formattedValue.length > 5) {
      formattedValue = formattedValue.slice(0, 5);
    }
  }

  // Format CVV - only digits, max 4
  if (name === 'cvv') {
    formattedValue = value.replace(/\D/g, '').slice(0, 4);
  }

  setPaymentForm(prev => ({
    ...prev,
    [name]: formattedValue
  }));
};

const handleSavePaymentMethod = async () => {
  // Basic validation
  if (!paymentForm.cardNumber || !paymentForm.cardHolder || !paymentForm.expiryDate || !paymentForm.cvv) {
    alert('Please fill in all payment method fields');
    return;
  }

  // Validate card number (should be 16 digits)
  const cardDigits = paymentForm.cardNumber.replace(/\D/g, '');
  if (cardDigits.length !== 16) {
    alert('Please enter a valid 16-digit card number');
    return;
  }

  // Validate expiry date (should be MM/YY format)
  if (!/^\d{2}\/\d{2}$/.test(paymentForm.expiryDate)) {
    alert('Please enter a valid expiry date (MM/YY)');
    return;
  }

  // Validate CVV (should be 3-4 digits)
  if (paymentForm.cvv.length < 3) {
    alert('Please enter a valid CVV (3-4 digits)');
    return;
  }

  try {
    setIsSaving(true);
    const userId = hostId || guestId;
    const userRef = doc(db, 'Users', userId);
    const last4 = cardDigits.slice(-4);
    const maskedCardNumber = `**** **** **** ${last4}`;
    
    const paymentData = {
      type: 'card',
      cardNumber: maskedCardNumber,
      cardHolder: paymentForm.cardHolder,
      expiryDate: paymentForm.expiryDate,
      billingAddress: paymentForm.billingAddress,
      last4: last4
    };

    await updateDoc(userRef, {
      paymentMethod: paymentData
    });

    setPaymentMethod(paymentData);
    setUser(prev => ({ ...prev, paymentMethod: paymentData }));
    handleClosePaymentDialog();
    alert('Payment method saved successfully!');
  } catch (error) {
    console.error('Error saving payment method:', error);
    alert('Failed to save payment method. Please try again.');
  } finally {
    setIsSaving(false);
  }
};

const handlePayPalBusinessSuccess = async (data, actions) => {
  // This is for business accounts (hosts)
  const details = await actions.order.capture();
  
  try {
    setIsSaving(true);
    const userId = hostId || guestId;
    const userRef = doc(db, 'Users', userId);

    const paymentData = {
      type: 'paypal',
      accountType: 'business',
      paypalEmail: details.payer.email_address,
      payerId: details.payer.payer_id,
      payerName: `${details.payer.name.given_name} ${details.payer.name.surname}`,
      transactionId: details.id,
      status: details.status,
      environment: 'sandbox',
      connectedAt: new Date().toISOString(),
      // Business account specific fields
      businessAccount: true,
      merchantId: details.payer.payer_id,
      // PayPal API connection - verified through payment
      connectionMethod: 'paypal_api',
      verified: true,
      // Store order details for reference
      orderId: details.id,
      intent: details.intent || 'CAPTURE'
    };

    await updateDoc(userRef, {
      paymentMethod: paymentData,
      paypalAccountId: details.payer.payer_id, // Store account ID for quick access
      paypalLastUpdated: serverTimestamp()
    });

    setPaymentMethod(paymentData);
    setPaymentMethodType('paypal');
    setUser(prev => ({ ...prev, paymentMethod: paymentData, paypalAccountId: details.payer.payer_id }));
    setPaymentForm({
      cardNumber: '',
      cardHolder: '',
      expiryDate: '',
      cvv: '',
      billingAddress: '',
      paypalBusinessEmail: '',
      paypalBusinessName: ''
    });
    handleClosePaymentDialog();
    alert('PayPal Business account connected successfully via PayPal Sandbox!\n\nAccount verified through PayPal API.');
  } catch (error) {
    console.error('Error saving PayPal payment method:', error);
    alert('Failed to save PayPal payment method. Please try again.');
  } finally {
    setIsSaving(false);
  }
};

const handlePayPalSuccess = async (data, actions) => {
  // This is only for personal accounts (guests)
  console.log('=== PAYPAL ACCOUNT CONNECTION STARTED ===');
  console.log('PayPal approval data:', data);
  
  let details;
  try {
    details = await actions.order.capture();
    console.log('✅ PayPal payment captured successfully:', details);
  } catch (captureError) {
    console.error('❌ Error capturing PayPal payment:', captureError);
    alert('Failed to capture PayPal payment. Please try again.');
    return;
  }
  
  try {
    setIsSaving(true);
    const userId = hostId || guestId;
    const userRef = doc(db, 'Users', userId);
    
    console.log('=== PAYPAL ACCOUNT CONNECTION DETAILS ===');
    console.log('User ID:', userId);
    console.log('PayPal Email:', details.payer.email_address);
    console.log('PayPal Payer ID:', details.payer.payer_id);
    console.log('PayPal Name:', `${details.payer.name.given_name} ${details.payer.name.surname}`);
    console.log('Transaction ID:', details.id);
    console.log('Order ID:', data.orderID);
    console.log('Status:', details.status);
    
    // Personal account for guests
    const paymentData = {
      type: 'paypal',
      accountType: 'personal',
      paypalEmail: details.payer.email_address,
      payerId: details.payer.payer_id,
      payerName: `${details.payer.name.given_name} ${details.payer.name.surname}`,
      transactionId: details.id,
      status: details.status,
      environment: 'sandbox',
      sandboxAccountId: details.payer.payer_id,
      sandboxEmail: details.payer.email_address,
      connectedAt: new Date().toISOString(),
      accountId: details.payer.payer_id,
      accountStatus: details.status,
      orderId: details.id,
      intent: details.intent || 'CAPTURE'
    };

    // Try to fetch actual PayPal balance from API
    console.log('=== ATTEMPTING TO FETCH ACTUAL PAYPAL BALANCE ===');
    let actualPayPalBalance = null;
    let balanceFetchError = null;
    
    try {
      // Import the balance sync function
      const { syncPayPalBalanceToFirebase } = await import('../utils/paypalApi');
      console.log('Fetching balance from PayPal API for account:', details.payer.email_address);
      
      const balanceResult = await syncPayPalBalanceToFirebase(userId, 'PHP');
      actualPayPalBalance = balanceResult.balance;
      
      console.log('✅ ACTUAL PAYPAL ACCOUNT BALANCE (from PayPal API):', actualPayPalBalance);
      console.log('Full balance data from PayPal:', balanceResult.balanceData);
      
      if (actualPayPalBalance !== null && actualPayPalBalance !== undefined) {
        console.log(`💰 Guest's PayPal Sandbox Account Balance: ₱${actualPayPalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      }
    } catch (balanceError) {
      console.warn('⚠️ Could not fetch balance from PayPal API:', balanceError);
      console.warn('Error code:', balanceError.code);
      console.warn('Error message:', balanceError.message);
      console.warn('Error details:', balanceError.details);
      
      // Check if it's a permissions/API availability issue
      if (balanceError.message && (
        balanceError.message.includes('Reporting API') || 
        balanceError.message.includes('not available') ||
        balanceError.message.includes('forbidden') ||
        balanceError.message.includes('403')
      )) {
        console.warn('⚠️ PayPal Reporting API is not available. This is normal for sandbox accounts or accounts without Reporting API permissions.');
        console.warn('⚠️ You can still manually enter your PayPal balance.');
      } else if (balanceError.code === 'functions/not-found') {
        console.warn('⚠️ Firebase Functions not deployed. Please deploy functions first.');
      } else if (balanceError.code === 'functions/failed-precondition') {
        console.warn('⚠️ PayPal credentials not configured in Firebase Functions.');
      }
      
      balanceFetchError = balanceError.message;
      actualPayPalBalance = null;
    }

    // Prompt user to enter their current PayPal account balance to sync with Firebase
    let promptMessage = 'PayPal account connected successfully!\n\n';
    promptMessage += `PayPal Email: ${details.payer.email_address}\n`;
    promptMessage += `PayPal Payer ID: ${details.payer.payer_id}\n\n`;
    
    if (actualPayPalBalance !== null) {
      promptMessage += `💰 Your PayPal Sandbox Account Balance: ₱${actualPayPalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n`;
      promptMessage += 'This balance will be synced to Firebase.\n\n';
      promptMessage += 'Press OK to use this balance, or enter a different amount:';
    } else {
      promptMessage += 'To sync your PayPal balance with Firebase, please enter your current PayPal account balance (PHP):\n\n';
      promptMessage += 'Example: If you have ₱20,000 in your PayPal account, enter: 20000\n\n';
      promptMessage += '(Leave empty or 0 if starting fresh)';
    }
    
    const currentBalanceInput = prompt(promptMessage);
    
    let initialBalance = 0;
    if (actualPayPalBalance !== null && (!currentBalanceInput || currentBalanceInput.trim() === '')) {
      // Use the fetched balance if user didn't enter anything
      initialBalance = actualPayPalBalance;
      console.log('Using fetched PayPal balance:', initialBalance);
    } else if (currentBalanceInput && currentBalanceInput.trim() !== '') {
      const parsedBalance = parseFloat(currentBalanceInput);
      if (!isNaN(parsedBalance) && parsedBalance >= 0) {
        initialBalance = parsedBalance;
        console.log('Using manually entered balance:', initialBalance);
      }
    }
    
    console.log('=== BALANCE SYNC INFORMATION ===');
    console.log('Actual PayPal Account Balance (from API):', actualPayPalBalance);
    console.log('Initial Balance to set in Firebase:', initialBalance);
    console.log('Balance difference:', actualPayPalBalance !== null ? (initialBalance - actualPayPalBalance) : 'N/A');

    // Update user document with PayPal info and initial balance
    console.log('=== UPDATING FIRESTORE USER DOCUMENT ===');
    console.log('Setting paypalBalance to:', initialBalance);
    console.log('Setting paypalAccountId to:', details.payer.payer_id);
    
    await updateDoc(userRef, {
      paymentMethod: paymentData,
      paypalAccountId: details.payer.payer_id,
      paypalBalance: initialBalance, // Set initial balance to match actual PayPal account
      paypalLastUpdated: serverTimestamp(),
      balanceSyncedAt: serverTimestamp(), // Mark when balance was synced
      paypalBalanceData: actualPayPalBalance !== null ? { 
        actualBalance: actualPayPalBalance,
        firebaseBalance: initialBalance,
        syncedAt: new Date().toISOString()
      } : null
    });
    
    console.log('✅ Firestore user document updated');
    
    // Verify the update
    const verifySnap = await getDoc(userRef);
    if (verifySnap.exists()) {
      const verifyData = verifySnap.data();
      console.log('=== VERIFICATION: FIRESTORE BALANCE ===');
      console.log('paypalBalance in Firestore:', verifyData.paypalBalance);
      console.log('paypalAccountId in Firestore:', verifyData.paypalAccountId);
      console.log('paymentMethod in Firestore:', verifyData.paymentMethod);
      
      if (verifyData.paypalBalance !== initialBalance) {
        console.error('❌ WARNING: Balance mismatch!');
        console.error('Expected:', initialBalance);
        console.error('Actual in Firestore:', verifyData.paypalBalance);
      } else {
        console.log('✅ Balance matches! Firebase balance updated correctly.');
      }
    }

    // If user entered a balance, create an initial balance sync transaction record
    if (initialBalance > 0) {
      await addDoc(collection(db, 'PayPalTransactions'), {
        userId: userId,
        userRole: user?.role || 'guest',
        type: 'deposit',
        amount: initialBalance,
        currency: 'PHP',
        status: 'completed',
        description: 'Initial PayPal balance sync - Balance from actual PayPal account',
        paymentMethod: 'paypal',
        payerId: details.payer.payer_id,
        accountId: details.payer.payer_id,
        balanceBefore: 0,
        balanceAfter: initialBalance,
        isInitialSync: true, // Mark as initial sync from actual PayPal account
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }

    setPaymentMethod(paymentData);
    setPaymentMethodType('paypal');
    setUser(prev => ({ ...prev, paymentMethod: paymentData, paypalAccountId: details.payer.payer_id, paypalBalance: initialBalance }));
    handleClosePaymentDialog();
    alert(`PayPal Personal account connected successfully!\n\n${initialBalance > 0 ? `Balance synced: ₱${initialBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Balance set to ₱0. You can sync your balance later.'}`);
  } catch (error) {
    console.error('Error saving PayPal payment method:', error);
    alert('Failed to save PayPal payment method. Please try again.');
  } finally {
    setIsSaving(false);
  }
};

const handlePayPalError = (err) => {
  console.error('PayPal Error:', err);
  alert('An error occurred with PayPal payment. Please try again.');
};

const handlePayPalCancel = () => {
  console.log('PayPal payment cancelled');
};
  if (loading) {
    return (
      <div className="profile-page-new">
        <div style={{ textAlign: 'center', padding: '100px 20px', color: '#666' }}>
          <div style={{ fontSize: '1.2rem' }}>Loading profile...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="profile-page-new">
        <div style={{ textAlign: 'center', padding: '100px 20px', color: '#666' }}>
          <div style={{ fontSize: '1.2rem' }}>User not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page-new">
      {/* Header with Edit Button */}
      <div className="profile-header-new" style={{ justifyContent: 'flex-end' }}>
        <button className="profile-edit-btn-new" onClick={handleEditClick}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Edit Profile
        </button>
      </div>

      {/* Cover & Profile Section */}
      <div className="profile-cover-section">
        <div className="profile-cover-image">
          <img src={bgBlue} alt="Cover" />
          <div className="profile-cover-overlay"></div>
        </div>
        
        <div className="profile-main-card">
          <div className="profile-avatar-wrapper">
            <img 
              src={user?.profilePicture || me} 
              alt="Profile" 
              className="profile-avatar"
              onError={(e) => {
                e.target.src = me;
              }}
            />
            <div className="profile-status-badge">
              <div className="status-dot"></div>
              <span>{user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "User"}</span>
            </div>
          </div>
          
          <div className="profile-info-main">
            <h1 className="profile-name-new">
              {user?.firstName || ""} {user?.middleName || ""} {user?.lastName || "User"}
            </h1>
            <p className="profile-bio">{user?.role ? `${user.role.charAt(0).toUpperCase() + user.role.slice(1)} Account` : "User Account"}</p>
          </div>
        </div>
      </div>

      {/* Info Cards Grid */}
      <div className="profile-content-grid">
        {/* Personal Information Card */}
        <div className="profile-info-card">
          <div className="card-header">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <h3>Personal Information</h3>
          </div>
          
          <div className="info-item">
            <div className="info-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/>
                <rect x="2" y="4" width="20" height="16" rx="2"/>
              </svg>
            </div>
            <div className="info-content">
              <span className="info-label">Email</span>
              <span className="info-value">{user?.emailAddress || "Not provided"}</span>
            </div>
          </div>

          <div className="info-item">
            <div className="info-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            </div>
            <div className="info-content">
              <span className="info-label">Phone</span>
              <span className="info-value">{user?.phoneNumber || "Not provided"}</span>
            </div>
          </div>

          {user?.birthday && (
            <div className="info-item">
              <div className="info-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
                  <line x1="16" x2="16" y1="2" y2="6"/>
                  <line x1="8" x2="8" y1="2" y2="6"/>
                  <line x1="3" x2="21" y1="10" y2="10"/>
                </svg>
              </div>
              <div className="info-content">
                <span className="info-label">Birthday</span>
                <span className="info-value">
                  {new Date(user.birthday).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Address Information Card */}
        <div className="profile-info-card">
          <div className="card-header">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            <h3>Address</h3>
          </div>
          
          <div className="info-item">
            <div className="info-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/>
                <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              </svg>
            </div>
            <div className="info-content">
              <span className="info-label">Location</span>
              <span className="info-value">
                {[user?.street, user?.barangay, user?.city, user?.province].filter(Boolean).join(", ") || "Not provided"}
              </span>
            </div>
          </div>

          {user?.zipCode && (
            <div className="info-item">
              <div className="info-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <div className="info-content">
                <span className="info-label">Zip Code</span>
                <span className="info-value">{user.zipCode}</span>
              </div>
            </div>
          )}
        </div>

        {/* Account Information Card */}
        <div className="profile-info-card">
          <div className="card-header">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
              <line x1="16" x2="16" y1="2" y2="6"/>
              <line x1="8" x2="8" y1="2" y2="6"/>
              <line x1="3" x2="21" y1="10" y2="10"/>
            </svg>
            <h3>Account Details</h3>
          </div>
          
          <div className="info-item">
            <div className="info-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <div className="info-content">
              <span className="info-label">Account Type</span>
              <span className="info-value">{user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "User"}</span>
            </div>
          </div>

          {(user?.createdAt || user?.createdAt?.seconds) && (
            <div className="info-item">
              <div className="info-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v6m0 6v6"/>
                  <circle cx="12" cy="12" r="10"/>
                </svg>
              </div>
              <div className="info-content">
                <span className="info-label">Member Since</span>
                <span className="info-value">
                  {user.createdAt?.seconds 
                    ? new Date(user.createdAt.seconds * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                    : user.createdAt instanceof Date
                    ? user.createdAt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                    : new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                  }
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Stay Smart Balance Card - Only for Hosts */}
        {user?.role === 'host' && (
          <div className="profile-info-card" style={{ 
            background: 'linear-gradient(135deg, #0070ba 0%, #003087 100%)',
            color: 'white',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute',
              top: '-50px',
              right: '-50px',
              width: '200px',
              height: '200px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.1)',
              zIndex: 0
            }}></div>
            <div style={{
              position: 'absolute',
              bottom: '-30px',
              left: '-30px',
              width: '150px',
              height: '150px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.05)',
              zIndex: 0
            }}></div>
            
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                    </svg>
                    <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: 'white' }}>Stay Smart Balance</h3>
                  </div>
                  <p style={{ margin: 0, fontSize: '14px', color: 'rgba(255, 255, 255, 0.8)' }}>Digital Wallet</p>
                </div>
                <button
                  onClick={() => {
                    setShowWithdrawalDialog(true);
                    setTimeout(() => {
                      if (withdrawalDialogRef.current) {
                        try {
                          if (typeof withdrawalDialogRef.current.showModal === 'function') {
                            withdrawalDialogRef.current.showModal();
                          } else {
                            dialogPolyfill.registerDialog(withdrawalDialogRef.current);
                            withdrawalDialogRef.current.showModal();
                          }
                        } catch (err) {
                          console.error('Error showing withdrawal dialog:', err);
                          withdrawalDialogRef.current.style.display = 'block';
                        }
                      }
                    }, 50);
                  }}
                  style={{
                    padding: '8px 16px',
                    background: 'rgba(255, 255, 255, 0.2)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: '8px',
                    color: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseOver={(e) => {
                    e.target.style.background = 'rgba(255, 255, 255, 0.3)'
                  }}
                  onMouseOut={(e) => {
                    e.target.style.background = 'rgba(255, 255, 255, 0.2)'
                  }}
                  title="Withdraw funds"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22v-8M6 12l6-6 6 6"/>
                    <path d="M2 4h20"/>
                  </svg>
                  Withdraw
                </button>
              </div>

              <div style={{ marginBottom: '32px' }}>
                <p style={{ 
                  margin: '0 0 8px 0', 
                  fontSize: '14px', 
                  color: 'rgba(255, 255, 255, 0.8)',
                  fontWeight: '500'
                }}>
                  Available Balance
                </p>
                <p style={{ 
                  margin: 0, 
                  fontSize: '42px', 
                  fontWeight: '700', 
                  color: 'white',
                  letterSpacing: '-1px'
                }}>
                  ₱{((user?.balance || user?.walletBalance || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>

              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '16px',
                padding: '16px',
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                backdropFilter: 'blur(10px)'
              }}>
                <div>
                  <p style={{ 
                    margin: '0 0 4px 0', 
                    fontSize: '12px', 
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontWeight: '500'
                  }}>
                    Total Earnings
                  </p>
                  <p style={{ 
                    margin: 0, 
                    fontSize: '18px', 
                    fontWeight: '600', 
                    color: 'white'
                  }}>
                    ₱{(user?.totalEarnings || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p style={{ 
                    margin: '0 0 4px 0', 
                    fontSize: '12px', 
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontWeight: '500'
                  }}>
                    Account Status
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <p style={{ 
                      margin: 0, 
                      fontSize: '18px', 
                      fontWeight: '600', 
                      color: '#10b981'
                    }}>
                      Active
                    </p>
                    {user?.paymentMethod?.accountType === 'business' && (
                      <span style={{ 
                        background: 'rgba(255, 255, 255, 0.3)', 
                        color: 'white', 
                        padding: '2px 6px', 
                        borderRadius: '4px', 
                        fontSize: '10px',
                        fontWeight: '600',
                        textTransform: 'uppercase'
                      }}>
                        Business
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {!user?.paymentMethod?.paypalEmail && (
                <div style={{ 
                  marginTop: '16px',
                  padding: '16px',
                  background: 'rgba(255, 255, 255, 0.15)',
                  borderRadius: '12px',
                  textAlign: 'center',
                  border: '2px solid rgba(255, 255, 255, 0.2)'
                }}>
                  <p style={{ 
                    margin: '0 0 8px 0', 
                    fontSize: '16px', 
                    color: 'white',
                    fontWeight: '600'
                  }}>
                    No Business Account Connected
                  </p>
                  <p style={{ 
                    margin: '0 0 16px 0', 
                    fontSize: '14px', 
                    color: 'rgba(255, 255, 255, 0.9)'
                  }}>
                    Connect your PayPal Business account to receive payments and view your balance
                  </p>
                  <button
                    onClick={handleOpenPaymentDialog}
                    style={{
                      padding: '12px 24px',
                      background: 'white',
                      color: '#0070ba',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                    onMouseOver={(e) => {
                      e.target.style.background = '#f3f4f6'
                      e.target.style.transform = 'translateY(-2px)'
                      e.target.style.boxShadow = '0 6px 12px rgba(0, 0, 0, 0.3)'
                    }}
                    onMouseOut={(e) => {
                      e.target.style.background = 'white'
                      e.target.style.transform = 'translateY(0)'
                      e.target.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.2)'
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 7h-4V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2H2a1 1 0 0 0-1 1v11a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V8a1 1 0 0 0-1-1z"/>
                      <path d="M9 12h6M9 16h6"/>
                    </svg>
                    Create Business Account
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Payment Method Card */}
        <div className="profile-info-card">
          <div className="card-header">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="14" x="2" y="5" rx="2"/>
              <line x1="2" x2="22" y1="10" y2="10"/>
            </svg>
            <h3>Payment Method</h3>
          </div>
          
          {paymentMethod ? (
            <div className="payment-method-display-profile">
              <div className="payment-method-card-profile">
                {paymentMethod.type === 'paypal' ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                      <line x1="7" y1="7" x2="7.01" y2="7"/>
                    </svg>
                    <div className="payment-method-info-profile">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <p className="payment-method-type">
                          PayPal {paymentMethod.accountType === 'business' ? 'Business' : 'Personal'} Account
                        </p>
                        <span style={{ 
                          background: paymentMethod.accountType === 'business' ? '#31326F' : '#3b82f6', 
                          color: 'white', 
                          padding: '2px 8px', 
                          borderRadius: '4px', 
                          fontSize: '10px',
                          fontWeight: '600',
                          textTransform: 'uppercase'
                        }}>
                          {paymentMethod.accountType === 'business' ? 'Business' : 'Personal'}
                        </span>
                      </div>
                      <p className="payment-method-detail">{paymentMethod.paypalEmail}</p>
                      <p className="payment-method-name">{paymentMethod.payerName}</p>
                      {paymentMethod.connectedAt && (
                        <p className="payment-method-date">
                          Connected: {new Date(paymentMethod.connectedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect width="20" height="14" x="2" y="5" rx="2"/>
                      <line x1="2" x2="22" y1="10" y2="10"/>
                    </svg>
                    <div className="payment-method-info-profile">
                      <p className="payment-method-type">Credit/Debit Card</p>
                      <p className="payment-method-detail">{paymentMethod.cardNumber}</p>
                      <p className="payment-method-name">{paymentMethod.cardHolder}</p>
                      <p className="payment-method-expiry">Expires: {paymentMethod.expiryDate}</p>
                    </div>
                  </>
                )}
              </div>
              <div className="payment-method-actions">
                {paymentMethod.type === 'paypal' && (
                  <button className="manage-paypal-btn-profile" onClick={() => setShowPayPalDialog(true)}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                    </svg>
                    Manage PayPal
                  </button>
                )}
                <button className="change-payment-btn-profile" onClick={handleOpenPaymentDialog}>
                  Change Payment Method
                </button>
              </div>
            </div>
          ) : (
            <div className="no-payment-method-profile">
              {user?.role === 'host' ? (
                <>
                  <div style={{ 
                    background: 'linear-gradient(135deg, rgba(49, 50, 111, 0.1) 0%, rgba(49, 50, 111, 0.05) 100%)',
                    padding: '16px',
                    borderRadius: '12px',
                    marginBottom: '16px',
                    border: '2px solid rgba(49, 50, 111, 0.2)',
                    textAlign: 'center'
                  }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      gap: '8px',
                      marginBottom: '8px'
                    }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#31326F" strokeWidth="2">
                        <path d="M20 7h-4V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2H2a1 1 0 0 0-1 1v11a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V8a1 1 0 0 0-1-1z"/>
                        <path d="M9 12h6M9 16h6"/>
                      </svg>
                      <strong style={{ color: '#31326F', fontSize: '16px' }}>Business Account Required</strong>
                    </div>
                    <p className="no-payment-text" style={{ margin: '0 0 12px 0', color: '#6b7280' }}>
                      Connect your PayPal Business account to receive payments from bookings
                    </p>
                    <button 
                      className="add-payment-btn-profile" 
                      onClick={handleOpenPaymentDialog}
                      style={{
                        background: 'linear-gradient(135deg, #31326F 0%, #5758a2 100%)',
                        color: 'white',
                        border: 'none',
                        padding: '12px 24px',
                        borderRadius: '8px',
                        fontSize: '16px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 4px 6px rgba(49, 50, 111, 0.3)'
                      }}
                      onMouseOver={(e) => {
                        e.target.style.background = 'linear-gradient(135deg, #252550 0%, #4a4b8f 100%)'
                        e.target.style.transform = 'translateY(-2px)'
                        e.target.style.boxShadow = '0 6px 12px rgba(49, 50, 111, 0.4)'
                      }}
                      onMouseOut={(e) => {
                        e.target.style.background = 'linear-gradient(135deg, #31326F 0%, #5758a2 100%)'
                        e.target.style.transform = 'translateY(0)'
                        e.target.style.boxShadow = '0 4px 6px rgba(49, 50, 111, 0.3)'
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '8px', verticalAlign: 'middle', display: 'inline-block' }}>
                        <path d="M20 7h-4V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2H2a1 1 0 0 0-1 1v11a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V8a1 1 0 0 0-1-1z"/>
                        <path d="M9 12h6M9 16h6"/>
                      </svg>
                      Create Business Account
                    </button>
                  </div>
                  <p style={{ 
                    textAlign: 'center', 
                    fontSize: '12px', 
                    color: '#9ca3af',
                    marginTop: '8px'
                  }}>
                    Or add a credit/debit card as an alternative payment method
                  </p>
                </>
              ) : (
                <>
                  <p className="no-payment-text">No payment method added</p>
                  <button className="add-payment-btn-profile" onClick={handleOpenPaymentDialog}>
                    Add Payment Method
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Rating Card */}
        <div className="profile-rating-card">
          <div className="card-header">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            <h3>Rating</h3>
          </div>
          <div className="rating-display-new">
            <div className="rating-stars-new">
              {[...Array(5)].map((_, i) => (
                <svg key={i} xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="#FFD700" stroke="#FFD700" strokeWidth="1.5">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              ))}
            </div>
            <p className="rating-text-new">Excellent Profile</p>
          </div>
        </div>
      </div>

      {/* Recently Booked Section - Only for Guests */}
      {guestId && user?.role === 'guest' && (
        <div style={{ 
          marginTop: '40px', 
          padding: '0 20px',
          maxWidth: '100%'
        }}>
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ 
              fontSize: '24px', 
              fontWeight: '700', 
              color: '#1f2937',
              margin: 0
            }}>
              {loadingBookings ? 'Loading...' : recentBookings.length > 0 
                ? `Recently Booked (${recentBookings.length})` 
                : 'Recently Booked'}
            </h2>
            {recentBookings.length === 0 && !loadingBookings && (
              <p style={{ 
                fontSize: '14px', 
                color: '#6b7280', 
                marginTop: '8px' 
              }}>
                You don't have any recent bookings. Start exploring and book your next stay!
              </p>
            )}
          </div>
          
          {loadingBookings ? (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '40px 20px',
              color: '#6b7280'
            }}>
              Loading your bookings...
            </div>
          ) : recentBookings.length > 0 ? (
            <div style={{ padding: "20px 0" }}>
              <SlideshowWheel 
                data={recentBookings} 
                useCase={`Recently Booked (${recentBookings.length})`} 
              />
            </div>
          ) : null}
        </div>
      )}

      {/* Edit Profile Dialog */}
      <dialog ref={dialogRef} className="edit-profile-dialog">
        <div className="edit-dialog-content">
          <div className="edit-dialog-header">
            <h3>Edit Profile</h3>
            <button onClick={handleCloseDialog} className="close-dialog-btn" disabled={isSaving}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div className="edit-profile-image-section">
            <img
              src={editedUser?.profilePicture || me}
              alt="Profile preview"
              className="edit-profile-preview"
            />
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              ref={fileInputRef}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="change-photo-btn-edit"
              disabled={isSaving}
            >
              {isSaving ? 'Uploading...' : 'Change Photo'}
            </button>
          </div>

          <div className="edit-form-grid">
            <div className="edit-form-group">
              <label htmlFor="firstName">First Name</label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={editedUser?.firstName || ''}
                onChange={handleInputChange}
              />
            </div>

            <div className="edit-form-group">
              <label htmlFor="middleName">Middle Name</label>
              <input
                type="text"
                id="middleName"
                name="middleName"
                value={editedUser?.middleName || ''}
                onChange={handleInputChange}
              />
            </div>

            <div className="edit-form-group">
              <label htmlFor="lastName">Last Name</label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={editedUser?.lastName || ''}
                onChange={handleInputChange}
              />
            </div>

            <div className="edit-form-group">
              <label htmlFor="phoneNumber">Phone Number</label>
              <input
                type="tel"
                id="phoneNumber"
                name="phoneNumber"
                value={editedUser?.phoneNumber || ''}
                onChange={handleInputChange}
              />
            </div>

            <div className="edit-form-group">
              <label htmlFor="birthday">Birthday</label>
              <input
                type="date"
                id="birthday"
                name="birthday"
                value={editedUser?.birthday ? (typeof editedUser.birthday === 'string' ? editedUser.birthday.split('T')[0] : new Date(editedUser.birthday.seconds * 1000).toISOString().split('T')[0]) : ''}
                onChange={handleInputChange}
              />
            </div>

            <div className="edit-form-group">
              <label htmlFor="street">Street</label>
              <input
                type="text"
                id="street"
                name="street"
                value={editedUser?.street || ''}
                onChange={handleInputChange}
              />
            </div>

            <div className="edit-form-group">
              <label htmlFor="barangay">Barangay</label>
              <input
                type="text"
                id="barangay"
                name="barangay"
                value={editedUser?.barangay || ''}
                onChange={handleInputChange}
              />
            </div>

            <div className="edit-form-group">
              <label htmlFor="city">City</label>
              <input
                type="text"
                id="city"
                name="city"
                value={editedUser?.city || ''}
                onChange={handleInputChange}
              />
            </div>

            <div className="edit-form-group">
              <label htmlFor="province">Province</label>
              <input
                type="text"
                id="province"
                name="province"
                value={editedUser?.province || ''}
                onChange={handleInputChange}
              />
            </div>

            <div className="edit-form-group">
              <label htmlFor="zipCode">Zip Code</label>
              <input
                type="text"
                id="zipCode"
                name="zipCode"
                value={editedUser?.zipCode || ''}
                onChange={handleInputChange}
              />
            </div>
          </div>

          <div className="edit-dialog-actions">
            <button onClick={handleCloseDialog} className="cancel-btn-edit" disabled={isSaving}>
              Cancel
            </button>
            <button onClick={handleSave} className="save-btn-edit" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </dialog>

      {/* Payment Method Dialog */}
      <PayPalScriptProvider 
        options={{ 
          "client-id": import.meta.env.VITE_PAYPAL_CLIENT_ID || "AWzCyB0viVv8_sS4aT309bhLLTMGLBYXexAJmIHkbrmTKp0hswkl1OHImpQDOWBnRncPBd7Us4dkNGbi",
          currency: "PHP",
          intent: "capture"
        }}
      >
        <dialog ref={paymentDialogRef} className="payment-method-dialog">
          <div className="payment-dialog-content">
            <div className="payment-dialog-header">
              <h3>{paymentMethod ? 'Change' : 'Add'} Payment Method</h3>
              <button onClick={handleClosePaymentDialog} className="close-payment-dialog-btn" disabled={isSaving}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* Payment Method Type Selector */}
            <div className="payment-method-selector">
              <button 
                className={`payment-type-btn ${paymentMethodType === 'card' ? 'active' : ''}`}
                onClick={() => setPaymentMethodType('card')}
              >
                Credit/Debit Card
              </button>
              <button 
                className={`payment-type-btn ${paymentMethodType === 'paypal' ? 'active' : ''}`}
                onClick={() => setPaymentMethodType('paypal')}
              >
                PayPal
              </button>
            </div>

            {paymentMethodType === 'paypal' ? (
              <div className="paypal-section">
                {user?.role === 'host' ? (
                  <>
                    <div style={{ 
                      background: 'linear-gradient(135deg, rgba(49, 50, 111, 0.1) 0%, rgba(49, 50, 111, 0.05) 100%)',
                      padding: '16px',
                      borderRadius: '12px',
                      marginBottom: '20px',
                      border: '2px solid rgba(49, 50, 111, 0.2)'
                    }}>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        gap: '8px',
                        marginBottom: '12px'
                      }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#31326F" strokeWidth="2">
                          <path d="M20 7h-4V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2H2a1 1 0 0 0-1 1v11a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V8a1 1 0 0 0-1-1z"/>
                          <path d="M9 12h6M9 16h6"/>
                        </svg>
                        <strong style={{ color: '#31326F', fontSize: '16px' }}>Business Account Required</strong>
                      </div>
                      <p className="paypal-description" style={{ margin: '0 0 8px 0', color: '#6b7280' }}>
                        Connect your PayPal Business account through PayPal Sandbox to receive payments from bookings and manage payouts.
                      </p>
                      <p style={{ margin: 0, color: '#9ca3af', fontSize: '12px' }}>
                        This will verify your PayPal Business account through PayPal's API and enable payment processing.
                      </p>
                    </div>
                    <PayPalButtons
                      createOrder={(data, actions) => {
                        return actions.order.create({
                          purchase_units: [{
                            amount: {
                              value: "1.00",
                              currency_code: "PHP"
                            },
                            description: "Verify PayPal Business Account - StaySmart"
                          }],
                          application_context: {
                            brand_name: "StaySmart",
                            landing_page: "BILLING",
                            user_action: "PAY_NOW",
                            shipping_preference: "NO_SHIPPING"
                          }
                        });
                      }}
                      onApprove={handlePayPalBusinessSuccess}
                      onError={handlePayPalError}
                      onCancel={handlePayPalCancel}
                      style={{
                        layout: "vertical",
                        color: "blue",
                        shape: "rect",
                        label: "paypal",
                        tagline: false
                      }}
                    />
                    <p style={{ 
                      marginTop: '12px', 
                      fontSize: '12px', 
                      color: '#6b7280',
                      fontStyle: 'italic',
                      textAlign: 'center'
                    }}>
                      A ₱1.00 verification payment will be processed to verify your PayPal Business account
                    </p>
                  </>
                ) : (
                  <>
                    <div style={{ 
                      background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%)',
                      padding: '16px',
                      borderRadius: '12px',
                      marginBottom: '20px',
                      border: '2px solid rgba(59, 130, 246, 0.2)'
                    }}>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        gap: '8px',
                        marginBottom: '12px'
                      }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                          <circle cx="12" cy="7" r="4"/>
                        </svg>
                        <strong style={{ color: '#3b82f6', fontSize: '16px' }}>Personal Account</strong>
                      </div>
                      <p className="paypal-description" style={{ margin: '0 0 8px 0', color: '#6b7280' }}>
                        Connect your PayPal Personal account to make payments for bookings.
                      </p>
                      <p style={{ margin: 0, color: '#9ca3af', fontSize: '12px' }}>
                        Personal accounts are perfect for making payments and managing your booking transactions.
                      </p>
                    </div>
                    <PayPalButtons
                      createOrder={(data, actions) => {
                        return actions.order.create({
                          purchase_units: [{
                            amount: {
                              value: "0.01",
                              currency_code: "PHP"
                            },
                            description: "Connect PayPal Personal Account"
                          }],
                          application_context: {
                            brand_name: "StaySmart",
                            landing_page: "NO_PREFERENCE",
                            user_action: "PAY_NOW"
                          }
                        });
                      }}
                      onApprove={handlePayPalSuccess}
                      onError={handlePayPalError}
                      onCancel={handlePayPalCancel}
                      style={{
                        layout: "vertical",
                        color: "blue",
                        shape: "rect",
                        label: "paypal"
                      }}
                    />
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="payment-form">
                  <div className="payment-form-group">
                    <label htmlFor="cardNumber">Card Number</label>
                    <input
                      type="text"
                      id="cardNumber"
                      name="cardNumber"
                      placeholder="1234 5678 9012 3456"
                      value={paymentForm.cardNumber}
                      onChange={handlePaymentFormChange}
                      maxLength="19"
                    />
                  </div>

                  <div className="payment-form-group">
                    <label htmlFor="cardHolder">Card Holder Name</label>
                    <input
                      type="text"
                      id="cardHolder"
                      name="cardHolder"
                      placeholder="John Doe"
                      value={paymentForm.cardHolder}
                      onChange={handlePaymentFormChange}
                    />
                  </div>

                  <div className="payment-form-row">
                    <div className="payment-form-group">
                      <label htmlFor="expiryDate">Expiry Date</label>
                      <input
                        type="text"
                        id="expiryDate"
                        name="expiryDate"
                        placeholder="MM/YY"
                        value={paymentForm.expiryDate}
                        onChange={handlePaymentFormChange}
                        maxLength="5"
                      />
                    </div>

                    <div className="payment-form-group">
                      <label htmlFor="cvv">CVV</label>
                      <input
                        type="text"
                        id="cvv"
                        name="cvv"
                        placeholder="123"
                        value={paymentForm.cvv}
                        onChange={handlePaymentFormChange}
                        maxLength="4"
                      />
                    </div>
                  </div>

                  <div className="payment-form-group">
                    <label htmlFor="billingAddress">Billing Address</label>
                    <input
                      type="text"
                      id="billingAddress"
                      name="billingAddress"
                      placeholder="Street address"
                      value={paymentForm.billingAddress}
                      onChange={handlePaymentFormChange}
                    />
                  </div>
                </div>

                <div className="payment-dialog-actions">
                  <button onClick={handleClosePaymentDialog} className="cancel-payment-btn" disabled={isSaving}>
                    Cancel
                  </button>
                  {paymentMethodType === 'card' && (
                    <button onClick={handleSavePaymentMethod} className="save-payment-btn" disabled={isSaving}>
                      {isSaving ? 'Saving...' : 'Save Payment Method'}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </dialog>
      </PayPalScriptProvider>

      {/* PayPal Management Dialog */}
      {showPayPalDialog && paymentMethod?.type === 'paypal' && (
        <PayPal
          userId={hostId || guestId}
          userRole={user?.role}
          paymentMethod={paymentMethod}
          onClose={() => setShowPayPalDialog(false)}
        />
      )}

      {/* Withdrawal Dialog */}
      <dialog 
        ref={withdrawalDialogRef} 
        style={{ 
          maxWidth: '500px', 
          width: '90%', 
          border: 'none', 
          borderRadius: '16px', 
          padding: 0, 
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)' 
        }}
      >
        <style>{`
          dialog::backdrop {
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(4px);
          }
        `}</style>
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#1f2937' }}>Withdraw Funds</h2>
            <button
              onClick={() => {
                setShowWithdrawalDialog(false);
                withdrawalDialogRef.current?.close();
                setWithdrawalAmount('');
                setWithdrawalAccount('');
                setWithdrawalMethod('bank');
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
              Withdrawal Amount (₱)
            </label>
            <input
              type="number"
              value={withdrawalAmount}
              onChange={(e) => setWithdrawalAmount(e.target.value)}
              placeholder="Enter amount"
              min="100"
              step="0.01"
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
              disabled={processingWithdrawal}
            />
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#6b7280' }}>
              Minimum withdrawal: ₱100.00
              {user && (
                <span style={{ display: 'block', marginTop: '4px' }}>
                  Available balance: ₱{((user?.balance || user?.walletBalance || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              )}
            </p>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
              Withdrawal Method
            </label>
            <select
              value={withdrawalMethod}
              onChange={(e) => {
                setWithdrawalMethod(e.target.value);
                // Auto-fill PayPal email if available
                if (e.target.value === 'paypal' && paymentMethod?.paypalEmail) {
                  setWithdrawalAccount(paymentMethod.paypalEmail);
                } else if (e.target.value === 'paypal' && user?.paymentMethod?.paypalEmail) {
                  setWithdrawalAccount(user.paymentMethod.paypalEmail);
                } else if (e.target.value !== 'paypal') {
                  setWithdrawalAccount('');
                }
              }}
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '16px',
                boxSizing: 'border-box',
                background: 'white'
              }}
              disabled={processingWithdrawal}
            >
              <option value="bank">Bank Transfer</option>
              <option value="paypal">PayPal (Instant Transfer)</option>
              <option value="gcash">GCash</option>
              <option value="paymaya">PayMaya</option>
            </select>
          </div>

          {withdrawalMethod === 'paypal' && (paymentMethod?.paypalEmail || user?.paymentMethod?.paypalEmail) && (
            <div style={{
              marginBottom: '16px',
              padding: '12px',
              background: '#f0f9ff',
              border: '1px solid #3b82f6',
              borderRadius: '8px',
              fontSize: '14px',
              color: '#1e40af'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  <path d="M9 12l2 2 4-4"/>
                </svg>
                <strong>Connected PayPal Account</strong>
              </div>
              <p style={{ margin: 0, fontSize: '13px' }}>
                {paymentMethod?.paypalEmail || user?.paymentMethod?.paypalEmail}
              </p>
            </div>
          )}

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
              {withdrawalMethod === 'paypal' ? 'PayPal Email Address' : 'Account Details'}
            </label>
            <input
              type={withdrawalMethod === 'paypal' ? 'email' : 'text'}
              value={withdrawalAccount}
              onChange={(e) => setWithdrawalAccount(e.target.value)}
              placeholder={withdrawalMethod === 'bank' ? 'Account name, Bank name, Account number' : withdrawalMethod === 'paypal' ? 'PayPal email address' : 'Mobile number'}
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
              disabled={processingWithdrawal}
            />
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#6b7280' }}>
              {withdrawalMethod === 'bank' && 'Enter your bank account details'}
              {withdrawalMethod === 'paypal' && 'Enter or confirm your PayPal email address. Funds will be transferred instantly to your PayPal account.'}
              {(withdrawalMethod === 'gcash' || withdrawalMethod === 'paymaya') && 'Enter your mobile number'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => {
                setShowWithdrawalDialog(false);
                withdrawalDialogRef.current?.close();
                setWithdrawalAmount('');
                setWithdrawalAccount('');
                setWithdrawalMethod('bank');
              }}
              disabled={processingWithdrawal}
              style={{
                flex: 1,
                padding: '12px',
                background: '#f3f4f6',
                color: '#4b5563',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: processingWithdrawal ? 'not-allowed' : 'pointer',
                opacity: processingWithdrawal ? 0.6 : 1
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleWithdrawal}
              disabled={
                processingWithdrawal || 
                !withdrawalAmount || 
                parseFloat(withdrawalAmount) < 100 ||
                parseFloat(withdrawalAmount) > (user?.balance || user?.walletBalance || 0) ||
                !withdrawalAccount
              }
              style={{
                flex: 1,
                padding: '12px',
                background: processingWithdrawal || !withdrawalAmount || parseFloat(withdrawalAmount) < 100 || parseFloat(withdrawalAmount) > (user?.balance || user?.walletBalance || 0) || !withdrawalAccount ? '#9ca3af' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: processingWithdrawal || !withdrawalAmount || parseFloat(withdrawalAmount) < 100 || parseFloat(withdrawalAmount) > (user?.balance || user?.walletBalance || 0) || !withdrawalAccount ? 'not-allowed' : 'pointer',
                opacity: processingWithdrawal || !withdrawalAmount || parseFloat(withdrawalAmount) < 100 || parseFloat(withdrawalAmount) > (user?.balance || user?.walletBalance || 0) || !withdrawalAccount ? 0.6 : 1
              }}
            >
              {processingWithdrawal 
                ? 'Processing...' 
                : withdrawalMethod === 'paypal' 
                  ? 'Withdraw to PayPal' 
                  : 'Submit Withdrawal Request'}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  )
}

export default Profile
