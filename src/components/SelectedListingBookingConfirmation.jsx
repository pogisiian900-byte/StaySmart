import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase'; 
import '../pages/guest/guest-bookingConfirmation.css';
import Loading from '../components/Loading';
import 'dialog-polyfill/dist/dialog-polyfill.css';
import dialogPolyfill from 'dialog-polyfill';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';

const SelectedListingBookingConfirmation = () => {
  const { listingId, guestId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const bookingData = location.state;

  const [userInfo, setUserInfo] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [message, setMessage] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [paymentMethodType, setPaymentMethodType] = useState('card'); // 'card' or 'paypal'
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const paymentDialogRef = useRef(null);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const errorDialogRef = useRef(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const confirmDialogRef = useRef(null);
  const [selectedPaymentMethodType, setSelectedPaymentMethodType] = useState(null); // For confirmation dialog
  const [showInsufficientBalanceDialog, setShowInsufficientBalanceDialog] = useState(false);
  const insufficientBalanceDialogRef = useRef(null);
  
  // Payment method form state
  const [paymentForm, setPaymentForm] = useState({
    cardNumber: '',
    cardHolder: '',
    expiryDate: '',
    cvv: '',
    billingAddress: ''
  });

  if (!bookingData) {
    return <Loading fullScreen message="No booking data found. Please go back and select again." />;
  }

  const { listing, checkIn, checkOut, guestCounts } = bookingData;

  // Calculate actual nights from dates
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24)) || 1;
  
  // Calculate base price
  const basePrice = listing.price || 0;
  const baseTotal = basePrice * nights;
  
  // Apply discount from listing (if available)
  const discountPercent = listing.discount || 0;
  const discountAmount = discountPercent > 0 ? (baseTotal * discountPercent / 100) : 0;
  const subtotal = baseTotal - discountAmount;
  const serviceFee = 300;
  const grandTotal = subtotal + serviceFee;
  
  // Legacy total for backwards compatibility (used in some places)
  const total = subtotal;

  const formatStayDates = (checkIn, checkOut) => {
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);

  const options = { month: 'short', day: 'numeric' };

  // Example: Apr 17 and Apr 19
  const checkInFormatted = checkInDate.toLocaleDateString('en-US', options);
  const checkOutFormatted = checkOutDate.toLocaleDateString('en-US', options);

  // Example: 2026
  const year = checkOutDate.getFullYear();

  // Combine
  return `${checkInFormatted} – ${checkOutFormatted}, ${year}`;
};

  // PayPal Sandbox Client ID - Replace with your actual Sandbox Client ID from PayPal Developer Dashboard
  // For Vite, use import.meta.env instead of process.env
  const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID || "AWzCyB0viVv8_sS4aT309bhLLTMGLBYXexAJmIHkbrmTKp0hswkl1OHImpQDOWBnRncPBd7Us4dkNGbi"; // Fallback to hardcoded for development

  // Register dialog polyfills
  useEffect(() => {
    if (paymentDialogRef.current && !paymentDialogRef.current.showModal) {
      dialogPolyfill.registerDialog(paymentDialogRef.current);
    }
    if (confirmDialogRef.current && !confirmDialogRef.current.showModal) {
      dialogPolyfill.registerDialog(confirmDialogRef.current);
    }
    if (errorDialogRef.current && !errorDialogRef.current.showModal) {
      dialogPolyfill.registerDialog(errorDialogRef.current);
    }
    if (insufficientBalanceDialogRef.current && !insufficientBalanceDialogRef.current.showModal) {
      dialogPolyfill.registerDialog(insufficientBalanceDialogRef.current);
    }
  }, []);

  // Validate PayPal Client ID format
  useEffect(() => {
    if (PAYPAL_CLIENT_ID && PAYPAL_CLIENT_ID.length < 10) {
      console.warn('PayPal Client ID appears to be invalid. Please check your VITE_PAYPAL_CLIENT_ID environment variable.');
    }
    console.log('PayPal Client ID:', PAYPAL_CLIENT_ID);
  }, [PAYPAL_CLIENT_ID]);

  const showError = (message) => {
    setErrorMessage(message);
    setShowErrorDialog(true);
    setTimeout(() => {
      if (errorDialogRef.current) {
        try {
          if (typeof errorDialogRef.current.showModal === 'function') {
            errorDialogRef.current.showModal();
          } else {
            dialogPolyfill.registerDialog(errorDialogRef.current);
            errorDialogRef.current.showModal();
          }
        } catch (err) {
          console.error('Error showing error dialog:', err);
          errorDialogRef.current.style.display = 'block';
        }
      }
    }, 50);
  };

  const handleCloseErrorDialog = () => {
    setShowErrorDialog(false);
    errorDialogRef.current?.close();
  };

  const showInsufficientBalance = () => {
    setShowInsufficientBalanceDialog(true);
    setTimeout(() => {
      if (insufficientBalanceDialogRef.current) {
        try {
          if (typeof insufficientBalanceDialogRef.current.showModal === 'function') {
            insufficientBalanceDialogRef.current.showModal();
          } else {
            dialogPolyfill.registerDialog(insufficientBalanceDialogRef.current);
            insufficientBalanceDialogRef.current.showModal();
          }
        } catch (err) {
          console.error('Error showing insufficient balance dialog:', err);
          insufficientBalanceDialogRef.current.style.display = 'block';
        }
      }
    }, 50);
  };

  const handleCloseInsufficientBalanceDialog = () => {
    setShowInsufficientBalanceDialog(false);
    insufficientBalanceDialogRef.current?.close();
  };

  const showConfirmBookingDialog = () => {
    setShowConfirmDialog(true);
    // Reset payment method selection when opening dialog
    setSelectedPaymentMethodType(null);
    setTimeout(() => {
      if (confirmDialogRef.current) {
        try {
          if (typeof confirmDialogRef.current.showModal === 'function') {
            confirmDialogRef.current.showModal();
          } else {
            dialogPolyfill.registerDialog(confirmDialogRef.current);
            confirmDialogRef.current.showModal();
          }
        } catch (err) {
          console.error('Error showing confirmation dialog:', err);
          confirmDialogRef.current.style.display = 'block';
        }
      }
    }, 100); // Increased timeout to ensure dialog is fully rendered
  };

  const handleCloseConfirmDialog = () => {
    setShowConfirmDialog(false);
    confirmDialogRef.current?.close();
  };

  // ✅ Fetch user data from Firestore
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userRef = doc(db, 'Users', guestId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setUserInfo(userData);
          
          // Optional: Check if user has saved payment method (can be used for quick selection)
          if (userData.paymentMethod) {
            setPaymentMethod(userData.paymentMethod);
            setPaymentMethodType(userData.paymentMethod.type || 'card');
          }
        } else {
          console.error('User not found');
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      } finally {
        setLoadingUser(false);
      }
    };

    if (guestId) {
      fetchUser();
    }
  }, [guestId]);

  const handlePaymentFormChange = (e) => {
    const { name, value } = e.target;
    let formattedValue = value;

    // Format card number with spaces (XXXX XXXX XXXX XXXX)
    if (name === 'cardNumber') {
      // Remove all non-digits
      const digits = value.replace(/\D/g, '');
      // Add spaces every 4 digits
      formattedValue = digits.match(/.{1,4}/g)?.join(' ') || digits;
      // Limit to 16 digits (19 characters with spaces)
      if (formattedValue.length > 19) {
        formattedValue = formattedValue.slice(0, 19);
      }
    }

    // Format expiry date (MM/YY)
    if (name === 'expiryDate') {
      // Remove all non-digits
      const digits = value.replace(/\D/g, '');
      if (digits.length >= 2) {
        formattedValue = `${digits.slice(0, 2)}/${digits.slice(2, 4)}`;
      } else {
        formattedValue = digits;
      }
      // Limit to 5 characters (MM/YY)
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

  const handlePayPalSuccess = async (data, actions) => {
    try {
      console.log('PayPal payment approved, capturing order...', data);
      
      // Check balance before processing payment
      const userRef = doc(db, 'Users', guestId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        const currentBalance = userData.paypalBalance || 0;
        
        // Check if balance is sufficient
        if (currentBalance < grandTotal) {
          const shortage = grandTotal - currentBalance;
          setErrorMessage(`Insufficient PayPal balance. You need ₱${shortage.toLocaleString()} more to complete this booking.\n\nCurrent Balance: ₱${currentBalance.toLocaleString()}\nRequired Amount: ₱${grandTotal.toLocaleString()}`);
          showInsufficientBalance();
          return;
        }
      } else {
        // User document doesn't exist or no balance set
        setErrorMessage(`Insufficient PayPal balance. Please add funds to your PayPal account.\n\nRequired Amount: ₱${grandTotal.toLocaleString()}`);
        showInsufficientBalance();
        return;
      }
      
      // Capture the payment
      const details = await actions.order.capture();
      
      console.log('PayPal payment captured successfully:', details);
      
      // Set payment method for booking
      const paymentData = {
        type: 'paypal',
        paypalEmail: details.payer.email_address,
        payerId: details.payer.payer_id,
        payerName: `${details.payer.name.given_name} ${details.payer.name.surname}`,
        transactionId: details.id,
        status: details.status
      };

      console.log('Payment data prepared:', paymentData);

      // Save payment method to user profile (optional)
      await updateDoc(userRef, {
        paymentMethod: paymentData
      });

      setPaymentMethod(paymentData);
      setPaymentMethodType('paypal');
      setSelectedPaymentMethodType('paypal');
      setUserInfo(prev => ({ ...prev, paymentMethod: paymentData }));
      
      // Close confirmation dialog before submitting booking
      handleCloseConfirmDialog();
      
      // Payment successful, now submit the booking
      await submitBookingWithPayment(paymentData);
    } catch (error) {
      console.error('Error processing PayPal payment:', error);
      showError(`Failed to process PayPal payment: ${error.message || 'Please try again.'}`);
    }
  };

  const handlePayPalError = (err) => {
    console.error('PayPal Error:', err);
    alert('An error occurred with PayPal payment. Please try again.');
  };

  const handlePayPalCancel = () => {
    console.log('PayPal payment cancelled');
  };

  const handleOpenPaymentDialog = () => {
    setShowPaymentDialog(true);
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
    setShowPaymentDialog(false);
    paymentDialogRef.current?.close();
    setPaymentForm({
      cardNumber: '',
      cardHolder: '',
      expiryDate: '',
      cvv: '',
      billingAddress: ''
    });
    setPaymentMethodType('card');
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
      const userRef = doc(db, 'Users', guestId);
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
      setUserInfo(prev => ({ ...prev, paymentMethod: paymentData }));
      handleClosePaymentDialog();
      alert('Payment method saved successfully!');
    } catch (error) {
      console.error('Error saving payment method:', error);
      alert('Failed to save payment method. Please try again.');
    }
  };

  const handleConfirmBooking = async () => {
    // Validate required booking data
    if (!listing || !listing.id && !listingId) {
      showError('Listing information is missing.');
      return;
    }

    // Build reservation payload
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    // Validate dates
    if (checkOutDate <= checkInDate) {
      showError('Check-out date must be after check-in date.');
        return;
      }

    // Check for existing reservations with overlapping dates for the same listing
    const listingIdFinal = listing.id || listingId;
    const existingReservationsQuery = query(
      collection(db, 'Reservation'),
      where('listingId', '==', listingIdFinal)
    );
    
    const existingReservationsSnapshot = await getDocs(existingReservationsQuery);
    const existingReservations = existingReservationsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Check for date conflicts - only block if status is 'pending' or 'confirmed'
    const hasConflict = existingReservations.some(reservation => {
      const status = reservation.status?.toLowerCase();
      // Only check conflicts with pending or confirmed reservations
      if (status !== 'pending' && status !== 'confirmed') {
        return false;
      }

      const existingCheckIn = reservation.checkIn?.toDate 
        ? reservation.checkIn.toDate() 
        : new Date(reservation.checkIn);
      const existingCheckOut = reservation.checkOut?.toDate 
        ? reservation.checkOut.toDate() 
        : new Date(reservation.checkOut);

      // Normalize dates to midnight for comparison
      const existingCheckInNormalized = new Date(existingCheckIn.getFullYear(), existingCheckIn.getMonth(), existingCheckIn.getDate());
      const existingCheckOutNormalized = new Date(existingCheckOut.getFullYear(), existingCheckOut.getMonth(), existingCheckOut.getDate());
      const newCheckInNormalized = new Date(checkInDate.getFullYear(), checkInDate.getMonth(), checkInDate.getDate());
      const newCheckOutNormalized = new Date(checkOutDate.getFullYear(), checkOutDate.getMonth(), checkOutDate.getDate());

      // Check for overlap: dates overlap if new check-in is before existing check-out 
      // AND new check-out is after existing check-in
      const overlaps = newCheckInNormalized < existingCheckOutNormalized && 
                       newCheckOutNormalized > existingCheckInNormalized;

      return overlaps;
    });

    if (hasConflict) {
      showError('This listing is already reserved for the selected dates. Please choose different dates.');
      return;
    }

    // Check PayPal balance before showing confirmation dialog
    const userRef = doc(db, 'Users', guestId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const userData = userSnap.data();
      const currentBalance = userData.paypalBalance || 0;
      const paymentMethodData = userData.paymentMethod;
      
      // Only check balance if user has PayPal payment method
      if (paymentMethodData?.type === 'paypal') {
        // Check if balance is sufficient
        if (currentBalance < grandTotal) {
          const shortage = grandTotal - currentBalance;
          setErrorMessage(`Insufficient PayPal balance. You need ₱${shortage.toLocaleString()} more to complete this booking.\n\nCurrent Balance: ₱${currentBalance.toLocaleString()}\nRequired Amount: ₱${grandTotal.toLocaleString()}`);
          showInsufficientBalance();
          return;
        }
      }
    } else {
      // User document doesn't exist - check if they have payment method set
      // If no payment method, allow them to proceed to set one up
    }

    // If validation passes and balance is sufficient, show confirmation dialog
    showConfirmBookingDialog();
  };

  const submitBookingWithPayment = async (paymentData = null) => {
    try {
      console.log('Submitting booking with payment data:', paymentData);
      
      // Check PayPal balance if using PayPal payment method
      const finalPaymentMethod = paymentData || (selectedPaymentMethodType === 'paypal' ? paymentMethod : null);
      
      if (finalPaymentMethod?.type === 'paypal' || selectedPaymentMethodType === 'paypal') {
        // Get user's current PayPal balance
        const userRef = doc(db, 'Users', guestId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          const currentBalance = userData.paypalBalance || 0;
          
          // Check if balance is sufficient
          if (currentBalance < grandTotal) {
            const shortage = grandTotal - currentBalance;
            setErrorMessage(`Insufficient PayPal balance. You need ₱${shortage.toLocaleString()} more to complete this booking.\n\nCurrent Balance: ₱${currentBalance.toLocaleString()}\nRequired Amount: ₱${grandTotal.toLocaleString()}`);
            showInsufficientBalance();
            return;
          }
        } else {
          // User document doesn't exist or no balance set
          setErrorMessage(`Insufficient PayPal balance. Please add funds to your PayPal account.\n\nRequired Amount: ₱${grandTotal.toLocaleString()}`);
          showInsufficientBalance();
          return;
        }
      }
      
      // Close confirmation dialog if still open
      if (showConfirmDialog) {
        handleCloseConfirmDialog();
      }

      // Determine hostId from listing
      const hostId = listing.hostId || null;

      // Build reservation payload
      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);

      // Use provided payment data or card payment data (already defined above for balance check)
      const finalPaymentMethodForReservation = paymentData || (selectedPaymentMethodType === 'card' ? {
        type: 'card',
        last4: paymentForm.cardNumber.replace(/\D/g, '').slice(-4),
        cardHolder: paymentForm.cardHolder,
        expiryDate: paymentForm.expiryDate
      } : finalPaymentMethod);

      const reservation = {
        status: 'pending', // pending -> confirmed/cancelled
        guestId,
        hostId,
        listingId: listing.id || listingId,
        listingTitle: listing.title || listing.name || '',
        listingThumbnail: Array.isArray(listing.photos) ? listing.photos[0] : null,
        checkIn: checkInDate.toISOString(),
        checkOut: checkOutDate.toISOString(),
        nights,
        guestCounts: guestCounts || {},
        pricing: {
          currency: 'PHP',
          nightly: listing.price || 0,
          baseTotal: baseTotal,
          discountPercent: discountPercent,
          discountAmount: discountAmount,
          subtotal: subtotal,
          serviceFee,
          total: grandTotal,
        },
        promoCode: listing.promoCode || null,
        guestMessage: message || '',
        paymentSummary: {
          methodType: finalPaymentMethodForReservation?.type || selectedPaymentMethodType || 'card',
          last4: finalPaymentMethodForReservation?.last4 || paymentForm.cardNumber.replace(/\D/g, '').slice(-4) || null,
          paypalEmail: finalPaymentMethodForReservation?.paypalEmail || null,
          transactionId: finalPaymentMethodForReservation?.transactionId || null,
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // Create the Reservation document
      const reservationRef = await addDoc(collection(db, 'Reservation'), reservation);

      // Deduct PayPal balance if using PayPal payment method
      if (finalPaymentMethodForReservation?.type === 'paypal' || selectedPaymentMethodType === 'paypal') {
        const userRef = doc(db, 'Users', guestId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          const currentBalance = userData.paypalBalance || 0;
          const newBalance = currentBalance - grandTotal;

          // Create payment transaction record
          const paymentTransaction = {
            userId: guestId,
            userRole: 'guest',
            type: 'payment',
            amount: grandTotal,
            currency: 'PHP',
            status: 'completed',
            description: `Payment for booking: ${reservation.listingTitle}`,
            reservationId: reservationRef.id,
            listingId: reservation.listingId,
            listingTitle: reservation.listingTitle,
            balanceBefore: currentBalance,
            balanceAfter: newBalance,
            paymentMethod: 'paypal',
            transactionId: finalPaymentMethodForReservation?.transactionId || null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          };

          // Deduct balance and create transaction record atomically
          await Promise.all([
            updateDoc(userRef, {
              paypalBalance: newBalance,
              paypalLastUpdated: serverTimestamp(),
              updatedAt: serverTimestamp()
            }),
            addDoc(collection(db, 'PayPalTransactions'), paymentTransaction)
          ]);

          console.log(`Deducted ₱${grandTotal} from PayPal balance. New balance: ₱${newBalance}`);
        }
      }

      // Create a notification for the host about the new reservation request
      // IMPORTANT: Do NOT add any money to host account at this point
      // Money is only added when host confirms the booking (in HostBookings.jsx)
      // and only the subtotal is added, NOT the total (which includes service fee)
      if (hostId) {
        const hostNotification = {
          type: 'reservation_request',
          recipientId: hostId, // Fixed: Use recipientId instead of hostId for query matching
          hostId,
          guestId,
          listingId: reservation.listingId,
          reservationId: reservationRef.id,
          title: 'New reservation request',
          body: `${userInfo?.firstName || 'A guest'} requested to book ${reservation.listingTitle}`,
          message: `${userInfo?.firstName || 'A guest'} requested to book ${reservation.listingTitle}`,
          read: false,
          createdAt: serverTimestamp(),
        };
        console.log('🔔 Creating host notification:', hostNotification);
        const hostNotificationRef = await addDoc(collection(db, 'Notifications'), hostNotification);
        console.log('✅ Host notification created with ID:', hostNotificationRef.id);
      } else {
        console.log('⚠️ No hostId available, skipping host notification');
      }

      // Create a notification for the guest confirming their booking request was submitted
      if (guestId) {
        const guestNotification = {
          type: 'booking_requested',
          recipientId: guestId, // Guest receives the notification
          guestId,
          hostId,
          listingId: reservation.listingId,
          reservationId: reservationRef.id,
          title: 'Booking Request Sent',
          body: `Your booking request for ${reservation.listingTitle} has been sent to the host. You'll be notified when they respond.`,
          message: `Your booking request for ${reservation.listingTitle} has been sent.`,
          read: false,
          createdAt: serverTimestamp(),
        };
        console.log('🔔 Creating guest notification:', guestNotification);
        const guestNotificationRef = await addDoc(collection(db, 'Notifications'), guestNotification);
        console.log('✅ Guest notification created with ID:', guestNotificationRef.id);
      } else {
        console.log('⚠️ No guestId available, skipping guest notification');
      }

      alert('Booking request sent successfully!');
      // Navigate to guest bookings page or reservation details
      navigate(`/guest/${guestId}/bookings`);
    } catch (err) {
      console.error('Error creating reservation:', err);
      showError('Failed to create reservation. Please try again.');
    }
  };

  const submitBooking = async () => {
    // Check if payment method is selected
    if (!selectedPaymentMethodType) {
      showError('Please select a payment method.');
      return;
    }

    // If PayPal is selected, payment will be handled by PayPal buttons
    if (selectedPaymentMethodType === 'paypal') {
      // Payment will be processed through PayPal buttons in the dialog
      // The handlePayPalSuccess will call submitBookingWithPayment
      return;
    }

    // For card payment, validate card details
    if (selectedPaymentMethodType === 'card') {
      if (!paymentForm.cardNumber || !paymentForm.cardHolder || !paymentForm.expiryDate || !paymentForm.cvv) {
        showError('Please fill in all card details.');
        return;
      }

      // Validate card number
      const cardDigits = paymentForm.cardNumber.replace(/\D/g, '');
      if (cardDigits.length !== 16) {
        showError('Please enter a valid 16-digit card number.');
        return;
      }

      // Validate expiry date
      if (!/^\d{2}\/\d{2}$/.test(paymentForm.expiryDate)) {
        showError('Please enter a valid expiry date (MM/YY).');
        return;
      }

      // Validate CVV
      if (paymentForm.cvv.length < 3) {
        showError('Please enter a valid CVV (3-4 digits).');
        return;
      }
    }

    // Submit booking with card payment
    await submitBookingWithPayment();
  };

  if (loadingUser) {
    return <Loading fullScreen message="Loading user information..." />;
  }

  return (
    <div className="booking-container">
      {/* Back Button */}
      <button className="back-btn" onClick={() => navigate(-1)} title="Go back">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="30"
          height="30"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m12 19-7-7 7-7" />
          <path d="M19 12H5" />
        </svg>
        <span className="back-btn-text">Back</span>
      </button>

      <div className="booking-main">
        {/* Left Side: Booking Steps */}
        <div className="booking-fields">

          {/* Guest Info Display */}
          {userInfo && (
            <div className="guest-info">
              <p><strong>Guest:</strong> {userInfo.firstName} {userInfo.lastName}</p>
              <p><strong>Email:</strong> {userInfo.emailAddress}</p>
            </div>
          )}

          {/* Step 1: Payment */}
          <div className="booking-step1">
            <p className="step-title">1. Choose when to pay</p>
            <label className="checkbox-option">
              <input type="checkbox" checked readOnly />
              <div className="option-content">
                <span className="option-title">Pay ₱{grandTotal.toLocaleString()} now</span>
                <span className="option-desc">You'll be charged the full amount immediately.</span>
              </div>
            </label>
          </div>

          {/* Step 2: Message Host */}
          <div className="messageHost-step3">
            <p className="step-title">2. Message the host</p>
            <textarea
              className="message-box"
              rows="4"
              placeholder="Introduce yourself and share why you're visiting..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          {/* Step 3: Confirm Booking */}
          <div className="confirmation-step4">
            <p className="step-title">3. Confirm your booking</p>
            <button 
              className="confirm-btn"
              onClick={handleConfirmBooking}
            >
              Request to Book
            </button>
          </div>
        </div>

        {/* Right Side: Booking Invoice - Receipt Style */}
        <div className="booking-invoice receipt-style">
          <div className="receipt-header">
            <div className="receipt-logo">
              <h2>StaySmart</h2>
              <p className="receipt-tagline">Booking Receipt</p>
            </div>
            <div className="receipt-date">
              <p>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
              <p className="receipt-time">{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>

          <div className="receipt-divider-top">
            <div className="receipt-dots"></div>
          </div>

          <div className="receipt-body">
            {/* Listing Info */}
            <div className="receipt-section">
              <div className="receipt-listing-image">
                <img src={listing.photos[0]} alt={listing.name} />
              </div>
              <h3 className="receipt-listing-title">{listing.title}</h3>
              <div className="receipt-booking-dates">
                <div className="receipt-date-row">
                  <span className="receipt-label">Check-in:</span>
                  <span className="receipt-value">{new Date(checkIn).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
                <div className="receipt-date-row">
                  <span className="receipt-label">Check-out:</span>
                  <span className="receipt-value">{new Date(checkOut).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
                <div className="receipt-date-row">
                  <span className="receipt-label">Duration:</span>
                  <span className="receipt-value">{nights} night{nights !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>

            <div className="receipt-divider"></div>

            {/* Discount Badge */}
            {discountPercent > 0 && (
              <>
                <div className="receipt-discount-badge">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                  </svg>
                  <div>
                    <p className="discount-badge-title">{discountPercent}% DISCOUNT APPLIED</p>
                    {listing.promoCode && (
                      <p className="discount-badge-code">Promo Code: {listing.promoCode}</p>
                    )}
                  </div>
                </div>
                <div className="receipt-divider"></div>
              </>
            )}

            {/* Itemized List */}
            <div className="receipt-items">
              <div className="receipt-item">
                <div className="receipt-item-details">
                  <span className="receipt-item-name">Price per Night</span>
                  <span className="receipt-item-qty">× {nights}</span>
                </div>
                <span className="receipt-item-price">₱{basePrice.toLocaleString()}</span>
              </div>

              <div className="receipt-item receipt-item-total">
                <span className="receipt-item-name">Base Price ({nights} night{nights !== 1 ? 's' : ''})</span>
                <span className="receipt-item-price">₱{baseTotal.toLocaleString()}</span>
              </div>

              {discountPercent > 0 && (
                <div className="receipt-item receipt-item-discount">
                  <div className="receipt-item-details">
                    <span className="receipt-item-name">Discount ({discountPercent}%)</span>
                  </div>
                  <span className="receipt-item-price discount-amount">-₱{discountAmount.toLocaleString()}</span>
                </div>
              )}

              <div className="receipt-item receipt-item-subtotal">
                <span className="receipt-item-name">{discountPercent > 0 ? 'Subtotal (After Discount)' : 'Subtotal'}</span>
                <span className="receipt-item-price">₱{subtotal.toLocaleString()}</span>
              </div>

              <div className="receipt-item">
                <span className="receipt-item-name">Service Fee</span>
                <span className="receipt-item-price">₱{serviceFee.toLocaleString()}</span>
              </div>
            </div>

            <div className="receipt-divider-bold"></div>

            {/* Total */}
            <div className="receipt-total-section">
              <div className="receipt-total-row">
                <span className="receipt-total-label">TOTAL</span>
                <span className="receipt-total-amount">₱{grandTotal.toLocaleString()}</span>
              </div>
              {discountPercent > 0 && (
                <div className="receipt-savings">
                  <p className="receipt-savings-text">
                    You saved ₱{discountAmount.toLocaleString()}!
                  </p>
                </div>
              )}
            </div>

            <div className="receipt-divider-bottom">
              <div className="receipt-dots"></div>
            </div>

            {/* Footer */}
            <div className="receipt-footer">
              <p className="receipt-footer-text">Thank you for choosing StaySmart!</p>
              <p className="receipt-footer-note">Payment will be processed upon booking confirmation</p>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Method Dialog */}
      <PayPalScriptProvider 
        options={{ 
          "client-id": PAYPAL_CLIENT_ID,
          currency: "PHP",
          intent: "capture"
        }}
      >
      <dialog ref={paymentDialogRef} className="payment-method-dialog">
        <div className="payment-dialog-content">
          <div className="payment-dialog-header">
            <h3>Add Payment Method</h3>
            <button onClick={handleClosePaymentDialog} className="close-payment-dialog-btn">
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
              <p className="paypal-description">Pay ₱{grandTotal.toFixed(2)} using your PayPal account.</p>
              <PayPalButtons
                    createOrder={(data, actions) => {
                      // Ensure grandTotal is a number and properly formatted
                      const amount = Number(grandTotal);
                      
                      if (isNaN(amount) || amount <= 0) {
                        console.error('Invalid amount:', grandTotal);
                        throw new Error('Invalid payment amount');
                      }
                      
                      const formattedAmount = amount.toFixed(2);
                      
                      console.log('Creating PayPal order:', {
                        amount: formattedAmount,
                        currency: 'PHP',
                        total: grandTotal,
                        nights: nights,
                        listingPrice: listing.price
                      });
                      
                      // Create order with the actual booking total
                      return actions.order.create({
                        purchase_units: [{
                          amount: {
                            value: formattedAmount, // Use actual booking total
                            currency_code: "PHP" // PayPal supports PHP
                          },
                          description: `Booking payment for ${listing.title} - ${nights} night(s)`
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
            </div>
          ) : (
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
          )}

          {paymentMethodType === 'card' && (
            <div className="payment-dialog-actions">
              <button onClick={handleClosePaymentDialog} className="cancel-payment-btn">
                Cancel
              </button>
              <button onClick={handleSavePaymentMethod} className="save-payment-btn">
                Save Payment Method
              </button>
            </div>
          )}
        </div>
      </dialog>
      </PayPalScriptProvider>

      {/* Error Dialog */}
      <dialog ref={errorDialogRef} className="error-dialog">
        <div className="error-dialog-content">
          <div className="error-dialog-header">
            <div className="error-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <h3 className="error-dialog-title">Booking Not Available</h3>
            <button onClick={handleCloseErrorDialog} className="close-error-dialog-btn" aria-label="Close">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div className="error-dialog-body">
            <p className="error-message">{errorMessage}</p>
          </div>
          <div className="error-dialog-actions">
            <button onClick={handleCloseErrorDialog} className="error-ok-btn">
              OK, I Understand
            </button>
          </div>
        </div>
      </dialog>

      {/* Insufficient Balance Dialog */}
      <dialog ref={insufficientBalanceDialogRef} className="error-dialog">
        <div className="error-dialog-content">
          <div className="error-dialog-header">
            <div className="error-icon" style={{ color: '#ef4444' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <h3 className="error-dialog-title">Insufficient Balance</h3>
            <button onClick={handleCloseInsufficientBalanceDialog} className="close-error-dialog-btn" aria-label="Close">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div className="error-dialog-body">
            <p className="error-message" style={{ whiteSpace: 'pre-line' }}>{errorMessage}</p>
            <p style={{ marginTop: '16px', fontSize: '0.9rem', color: '#666' }}>
              Please add funds to your PayPal account to complete this booking.
            </p>
          </div>
          <div className="error-dialog-actions">
            <button onClick={handleCloseInsufficientBalanceDialog} className="error-ok-btn">
              OK, I Understand
            </button>
          </div>
        </div>
      </dialog>

      {/* Confirmation Dialog */}
      <PayPalScriptProvider 
        options={{ 
          "client-id": PAYPAL_CLIENT_ID,
          currency: "PHP",
          intent: "capture"
        }}
      >
      <dialog ref={confirmDialogRef} className="confirm-booking-dialog">
        <div className="confirm-dialog-content">
          <div className="confirm-dialog-header">
            <div className="confirm-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>
            <h3 className="confirm-dialog-title">Confirm Booking Request</h3>
            <button onClick={handleCloseConfirmDialog} className="close-confirm-dialog-btn" aria-label="Close">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div className="confirm-dialog-body">
            <div className="confirm-booking-details">
              <h4>Booking Details</h4>
              <div className="confirm-detail-row">
                <span className="confirm-label">Listing:</span>
                <span className="confirm-value">{listing.title || listing.name}</span>
              </div>
              <div className="confirm-detail-row">
                <span className="confirm-label">Check-in:</span>
                <span className="confirm-value">{new Date(checkIn).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>
              <div className="confirm-detail-row">
                <span className="confirm-label">Check-out:</span>
                <span className="confirm-value">{new Date(checkOut).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>
              <div className="confirm-detail-row">
                <span className="confirm-label">Nights:</span>
                <span className="confirm-value">{nights} night{nights !== 1 ? 's' : ''}</span>
              </div>
              <div className="confirm-detail-row">
                <span className="confirm-label">Price per Night:</span>
                <span className="confirm-value">₱{basePrice.toLocaleString()}</span>
              </div>
              <div className="confirm-detail-row">
                <span className="confirm-label">Base Price ({nights} night{nights !== 1 ? 's' : ''}):</span>
                <span className="confirm-value">₱{baseTotal.toLocaleString()}</span>
              </div>
              {discountPercent > 0 && (
                <>
                  <div className="confirm-detail-row" style={{ 
                    background: '#f0fdf4', 
                    padding: '10px', 
                    borderRadius: '8px', 
                    margin: '8px 0',
                    border: '2px solid #10b981'
                  }}>
                    <span className="confirm-label" style={{ color: '#10b981', fontWeight: '700' }}>
                      ✨ Discount ({discountPercent}%):
                    </span>
                    <span className="confirm-value" style={{ color: '#10b981', fontWeight: '700', fontSize: '1.1rem' }}>
                      -₱{discountAmount.toLocaleString()}
                    </span>
                  </div>
                  {listing.promoCode && (
                    <div className="confirm-detail-row" style={{ fontSize: '0.9rem', color: '#666' }}>
                      <span className="confirm-label">Promo Code:</span>
                      <span className="confirm-value"><strong>{listing.promoCode}</strong></span>
                    </div>
                  )}
                </>
              )}
              <div className="confirm-detail-row">
                <span className="confirm-label" style={{ color: discountPercent > 0 ? '#065f46' : '#6b7280', fontWeight: discountPercent > 0 ? '700' : '500' }}>
                  {discountPercent > 0 ? 'Subtotal (After Discount):' : 'Subtotal:'}
                </span>
                <span className="confirm-value" style={{ color: discountPercent > 0 ? '#065f46' : '#1f2937', fontWeight: discountPercent > 0 ? '700' : '600', fontSize: discountPercent > 0 ? '1.1rem' : '0.95rem' }}>
                  ₱{subtotal.toLocaleString()}
                </span>
              </div>
              <div className="confirm-detail-row">
                <span className="confirm-label">Service fee:</span>
                <span className="confirm-value">₱{serviceFee.toLocaleString()}</span>
              </div>
              <div className="confirm-detail-row confirm-total">
                <span className="confirm-label">Total Amount:</span>
                <span className="confirm-value" style={{ color: discountPercent > 0 ? '#10b981' : '#3b82f6' }}>
                  ₱{grandTotal.toLocaleString()}
                </span>
              </div>
              {discountPercent > 0 && (
                <div style={{ 
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
                  color: 'white', 
                  padding: '12px', 
                  borderRadius: '8px', 
                  marginTop: '12px',
                  textAlign: 'center'
                }}>
                  <p style={{ margin: 0, fontSize: '1rem', fontWeight: '700' }}>
                    💚 You Save ₱{discountAmount.toLocaleString()}!
                  </p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', opacity: 0.9 }}>
                    Original: ₱{baseTotal.toLocaleString()} → Discounted: ₱{subtotal.toLocaleString()}
                  </p>
                </div>
              )}
            </div>

            {/* Payment Method Selection */}
            <div className="confirm-payment-section">
              <h4>Select Payment Method</h4>
              <div className="confirm-payment-options">
                <button 
                  className={`confirm-payment-option ${selectedPaymentMethodType === 'card' ? 'selected' : ''}`}
                  onClick={() => setSelectedPaymentMethodType('card')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect width="20" height="14" x="2" y="5" rx="2"/>
                    <line x1="2" x2="22" y1="10" y2="10"/>
                  </svg>
                  <span>Credit/Debit Card</span>
                </button>
                <button 
                  className={`confirm-payment-option ${selectedPaymentMethodType === 'paypal' ? 'selected' : ''}`}
                  onClick={() => setSelectedPaymentMethodType('paypal')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                    <path d="M2 17l10 5 10-5"/>
                    <path d="M2 12l10 5 10-5"/>
                  </svg>
                  <span>PayPal</span>
                </button>
              </div>

              {/* Card Payment Form */}
              {selectedPaymentMethodType === 'card' && (
                <div className="confirm-card-form">
                  <div className="confirm-form-group">
                    <label>Card Number</label>
                    <input
                      type="text"
                      name="cardNumber"
                      placeholder="1234 5678 9012 3456"
                      value={paymentForm.cardNumber}
                      onChange={handlePaymentFormChange}
                      maxLength="19"
                    />
                  </div>
                  <div className="confirm-form-group">
                    <label>Card Holder Name</label>
                    <input
                      type="text"
                      name="cardHolder"
                      placeholder="John Doe"
                      value={paymentForm.cardHolder}
                      onChange={handlePaymentFormChange}
                    />
                  </div>
                  <div className="confirm-form-row">
                    <div className="confirm-form-group">
                      <label>Expiry Date</label>
                      <input
                        type="text"
                        name="expiryDate"
                        placeholder="MM/YY"
                        value={paymentForm.expiryDate}
                        onChange={handlePaymentFormChange}
                        maxLength="5"
                      />
                    </div>
                    <div className="confirm-form-group">
                      <label>CVV</label>
                      <input
                        type="text"
                        name="cvv"
                        placeholder="123"
                        value={paymentForm.cvv}
                        onChange={handlePaymentFormChange}
                        maxLength="4"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* PayPal Payment */}
              {selectedPaymentMethodType === 'paypal' && (
                <div className="confirm-paypal-section" key="paypal-confirm-section">
                  <p className="paypal-info-text">Complete your PayPal payment below to confirm your booking</p>
                  <div id="paypal-button-container-confirm" style={{ minHeight: '200px', width: '100%', display: 'flex', justifyContent: 'center' }}>
                    <PayPalButtons
                      createOrder={(data, actions) => {
                        // Ensure grandTotal is a number and properly formatted
                        const amount = Number(grandTotal);
                        
                        if (isNaN(amount) || amount <= 0) {
                          console.error('Invalid amount:', grandTotal);
                          throw new Error('Invalid payment amount');
                        }
                        
                        const formattedAmount = amount.toFixed(2);
                        
                        console.log('Creating PayPal order (Confirm Dialog):', {
                          amount: formattedAmount,
                          currency: 'PHP',
                          total: grandTotal,
                          nights: nights,
                          listingPrice: listing.price
                        });
                        
                        // Create order with the actual booking total
                        return actions.order.create({
                          purchase_units: [{
                            amount: {
                              value: formattedAmount, // Use actual booking total
                              currency_code: "PHP" // PayPal supports PHP
                            },
                            description: `Booking payment for ${listing.title} - ${nights} night(s)`
                          }],
                          application_context: {
                            brand_name: "StaySmart",
                            landing_page: "NO_PREFERENCE",
                            user_action: "PAY_NOW"
                          }
                        });
                      }}
                      onApprove={async (data, actions) => {
                        console.log('PayPal onApprove triggered:', data);
                        try {
                          await handlePayPalSuccess(data, actions);
                        } catch (error) {
                          console.error('Error in PayPal onApprove:', error);
                          handlePayPalError(error);
                        }
                      }}
                      onError={(err) => {
                        console.error('PayPal Error (Confirm Dialog):', err);
                        handlePayPalError(err);
                      }}
                      onCancel={() => {
                        console.log('PayPal payment cancelled (Confirm Dialog)');
                        handlePayPalCancel();
                      }}
                      style={{
                        layout: "vertical",
                        color: "blue",
                        shape: "rect",
                        label: "paypal"
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="confirm-dialog-actions">
            <button onClick={handleCloseConfirmDialog} className="confirm-cancel-btn">
              Cancel
            </button>
            {selectedPaymentMethodType === 'card' && (
              <button onClick={submitBooking} className="confirm-submit-btn">
                Confirm Booking Request
              </button>
            )}
            {selectedPaymentMethodType === 'paypal' && (
              <button onClick={submitBooking} className="confirm-submit-btn" disabled>
                Complete PayPal Payment Above
              </button>
            )}
            {!selectedPaymentMethodType && (
              <button onClick={() => showError('Please select a payment method.')} className="confirm-submit-btn" disabled>
                Select Payment Method
              </button>
            )}
          </div>
        </div>
      </dialog>
      </PayPalScriptProvider>
    </div>
  );
};

export default SelectedListingBookingConfirmation;
