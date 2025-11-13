import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase'; 
import '../pages/guest/guest-bookingConfirmation.css';
import Loading from '../components/Loading';
import 'dialog-polyfill/dist/dialog-polyfill.css';
import dialogPolyfill from 'dialog-polyfill';
// Removed PayPal imports - using Firebase balance instead

const SelectedListingBookingConfirmation = () => {
  const { listingId, guestId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const bookingData = location.state;

  const [userInfo, setUserInfo] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingListing, setLoadingListing] = useState(false);
  const [message, setMessage] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [paymentMethodType, setPaymentMethodType] = useState('balance'); // 'balance' for Firebase balance
  const [userBalance, setUserBalance] = useState(0);
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
  // Recommendations dialog state
  const [showRecommendationsDialog, setShowRecommendationsDialog] = useState(false);
  const recommendationsDialogRef = useRef(null);
  const [recommendedListings, setRecommendedListings] = useState([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  // Removed PayPal-related states - using Firebase balance instead
  
  // Booking data state (fallback if location.state is missing)
  const [listing, setListing] = useState(bookingData?.listing || null);
  const [checkIn, setCheckIn] = useState(bookingData?.checkIn || null);
  const [checkOut, setCheckOut] = useState(bookingData?.checkOut || null);
  const [guestCounts, setGuestCounts] = useState(bookingData?.guestCounts || { adults: 1, children: 0, infants: 0, pets: 0 });
  
  // Payment method form state
  const [paymentForm, setPaymentForm] = useState({
    cardNumber: '',
    cardHolder: '',
    expiryDate: '',
    cvv: '',
    billingAddress: ''
  });

  // Fetch listing from Firestore if bookingData is missing (e.g., page refresh)
  useEffect(() => {
    const fetchListingData = async () => {
      // If we have bookingData from location.state, use it
      if (bookingData && bookingData.listing) {
        setListing(bookingData.listing);
        setCheckIn(bookingData.checkIn);
        setCheckOut(bookingData.checkOut);
        setGuestCounts(bookingData.guestCounts || { adults: 1, children: 0, infants: 0, pets: 0 });
        return;
      }

      // Otherwise, fetch from Firestore
      if (listingId && !listing) {
        try {
          setLoadingListing(true);
          const listingRef = doc(db, 'Listings', listingId);
          const listingSnap = await getDoc(listingRef);
          
          if (listingSnap.exists()) {
            const listingData = { id: listingSnap.id, ...listingSnap.data() };
            setListing(listingData);
            
            // Try to get dates from URL search params if available
            const searchParams = new URLSearchParams(location.search);
            const urlCheckIn = searchParams.get('checkIn');
            const urlCheckOut = searchParams.get('checkOut');
            
            if (urlCheckIn) setCheckIn(urlCheckIn);
            if (urlCheckOut) setCheckOut(urlCheckOut);
            
            console.log('✅ Listing data fetched from Firestore');
          } else {
            console.error('Listing not found:', listingId);
            setErrorMessage('Listing not found. Please go back and try again.');
          }
        } catch (error) {
          console.error('Error fetching listing:', error);
          setErrorMessage('Failed to load listing data. Please go back and try again.');
        } finally {
          setLoadingListing(false);
        }
      }
    };

    fetchListingData();
  }, [listingId, bookingData, location.search]);

  // Show loading if we don't have required data
  if (loadingListing || (!listing && listingId)) {
    return <Loading fullScreen message="Loading booking details..." />;
  }

  // Show error if we still don't have listing after trying to fetch
  if (!listing) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Booking Data Not Found</h2>
        <p>Unable to load booking details. Please go back and select your dates again.</p>
        <button onClick={() => navigate(-1)} style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}>
          Go Back
        </button>
      </div>
    );
  }

  // Show error if dates are missing (required for booking)
  if (!checkIn || !checkOut) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Booking Dates Required</h2>
        <p>Please go back and select your check-in and check-out dates.</p>
        <button 
          onClick={() => navigate(`/guest/${guestId}/listing/${listingId}`)} 
          style={{ marginTop: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }}
        >
          Go Back to Listing
        </button>
      </div>
    );
  }

  // Helper function to normalize dates consistently (midnight local time)
  // This handles Firestore Timestamps, date strings (YYYY-MM-DD), ISO strings, and Date objects
  const normalizeDate = (dateInput) => {
    if (!dateInput) {
      return null;
    }
    
    let date;
    
    // Handle Firestore Timestamp
    if (dateInput?.toDate && typeof dateInput.toDate === 'function') {
      date = dateInput.toDate();
    }
    // Handle date string (YYYY-MM-DD format from input type="date")
    else if (typeof dateInput === 'string' && dateInput.match(/^\d{4}-\d{2}-\d{2}/)) {
      // Parse YYYY-MM-DD string in local timezone to avoid UTC conversion issues
      const [year, month, day] = dateInput.split('-').map(Number);
      date = new Date(year, month - 1, day);
    }
    // Handle Date object or ISO string
    else {
      date = new Date(dateInput);
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return null;
    }
    
    // Normalize to midnight in local timezone
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  };

  // Calculate actual nights from dates - use normalizeDate for consistent parsing
  const checkInDate = normalizeDate(checkIn);
  const checkOutDate = normalizeDate(checkOut);
  
  // Validate dates
  if (!checkInDate || !checkOutDate) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Invalid Booking Dates</h2>
        <p>Please go back and select valid check-in and check-out dates.</p>
        <button 
          onClick={() => navigate(`/guest/${guestId}/listing/${listingId}`)} 
          style={{ marginTop: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }}
        >
          Go Back to Listing
        </button>
      </div>
    );
  }
  
  const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24)) || 1;
  
  // Calculate base price
  const basePrice = listing.price || 0;
  const baseTotal = basePrice * nights;
  
  // Apply discount ONLY if promo code was entered by user
  // Check if user entered a promo code (appliedPromoCode exists in listing)
  const hasEnteredPromoCode = listing.appliedPromoCode && listing.appliedPromoCode.trim() !== '';
  const discountPercent = (hasEnteredPromoCode && listing.discount) ? listing.discount : 0;
  const discountAmount = discountPercent > 0 ? (baseTotal * discountPercent / 100) : 0;
  const subtotal = baseTotal - discountAmount;
  // Service fee is 10% of the booking subtotal
  const serviceFee = Math.round(subtotal * 0.1);
  const grandTotal = subtotal + serviceFee;
  
  // Legacy total for backwards compatibility (used in some places)
  const total = subtotal;

  const formatStayDates = (checkIn, checkOut) => {
  const checkInDate = normalizeDate(checkIn);
  const checkOutDate = normalizeDate(checkOut);

  const options = { month: 'short', day: 'numeric' };

  // Example: Apr 17 and Apr 19
  const checkInFormatted = checkInDate.toLocaleDateString('en-US', options);
  const checkOutFormatted = checkOutDate.toLocaleDateString('en-US', options);

  // Example: 2026
  const year = checkOutDate.getFullYear();

  // Combine
  return `${checkInFormatted} – ${checkOutFormatted}, ${year}`;
};

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
    if (recommendationsDialogRef.current && !recommendationsDialogRef.current.showModal) {
      dialogPolyfill.registerDialog(recommendationsDialogRef.current);
    }
  }, []);

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
    // Set default payment method to balance
    setSelectedPaymentMethodType('balance');
    // Refresh user balance before showing dialog
    const refreshBalance = async () => {
      try {
        const userRef = doc(db, 'Users', guestId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          const balance = userData.balance || userData.walletBalance || 0;
          setUserBalance(balance);
        }
      } catch (error) {
        console.error('Error refreshing balance:', error);
      }
    };
    refreshBalance();
    
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
          
          // Get user balance
          const balance = userData.balance || userData.walletBalance || 0;
          setUserBalance(balance);
          
          // Optional: Check if user has saved payment method (can be used for quick selection)
          if (userData.paymentMethod) {
            setPaymentMethod(userData.paymentMethod);
            setPaymentMethodType(userData.paymentMethod.type || 'balance');
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

  // Removed PayPal info fetching - using Firebase balance instead

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

  // Firebase Balance Payment Handler
  const handleBalancePayment = async () => {
    try {
      console.log('Processing Firebase balance payment...');
      
      // Check balance before processing payment
      const userRef = doc(db, 'Users', guestId);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        setErrorMessage(`User account not found. Please contact support.`);
        showError();
        return;
      }

      const userData = userSnap.data();
      const currentBalance = userData.balance || userData.walletBalance || 0;
      
      // Check if balance is sufficient
      if (currentBalance < grandTotal) {
        const shortage = grandTotal - currentBalance;
        setErrorMessage(`Insufficient balance. You need ₱${shortage.toLocaleString()} more to complete this booking.\n\nCurrent Balance: ₱${currentBalance.toLocaleString()}\nRequired Amount: ₱${grandTotal.toLocaleString()}\n\nPlease add funds to your account.`);
        showInsufficientBalance();
        return;
      }
      
      // Deduct balance from guest
      const newGuestBalance = currentBalance - grandTotal;
      
      // Get host and admin info for balance distribution
      let hostBalance = 0;
      let adminBalance = 0;
      
      // Add subtotal to host balance
      if (listing?.hostId) {
        try {
          const hostRef = doc(db, 'Users', listing.hostId);
          const hostSnap = await getDoc(hostRef);
          if (hostSnap.exists()) {
            const hostData = hostSnap.data();
            hostBalance = (hostData.balance || hostData.walletBalance || 0) + subtotal;
            await updateDoc(hostRef, {
              balance: hostBalance,
              updatedAt: serverTimestamp()
            });
            console.log(`✅ Added ₱${subtotal} to host balance. New host balance: ₱${hostBalance}`);
          }
        } catch (hostError) {
          console.error('Error updating host balance:', hostError);
        }
      }
      
      // Add service fee to admin balance
      try {
        const adminQuery = query(collection(db, 'Users'), where('role', '==', 'admin'));
        const adminSnapshot = await getDocs(adminQuery);
        if (!adminSnapshot.empty) {
          const adminDoc = adminSnapshot.docs[0];
          const adminRef = doc(db, 'Users', adminDoc.id);
          const adminData = adminDoc.data();
          adminBalance = (adminData.balance || adminData.walletBalance || 0) + serviceFee;
          await updateDoc(adminRef, {
            balance: adminBalance,
            updatedAt: serverTimestamp()
          });
          console.log(`✅ Added ₱${serviceFee} to admin balance. New admin balance: ₱${adminBalance}`);
        }
      } catch (adminError) {
        console.error('Error updating admin balance:', adminError);
      }
      
      // Update guest balance
      await updateDoc(userRef, {
        balance: newGuestBalance,
        updatedAt: serverTimestamp()
      });
      
      // Create payment transaction record
      const paymentTransaction = {
        userId: guestId,
        userRole: 'guest',
        type: 'payment',
        amount: grandTotal,
        currency: 'PHP',
        status: 'completed',
        description: `Payment for booking: ${listing?.title || 'Listing'}`,
        listingId: listing?.id || listingId,
        listingTitle: listing?.title || '',
        balanceBefore: currentBalance,
        balanceAfter: newGuestBalance,
        paymentMethod: 'balance',
        splitPayment: {
          hostAmount: subtotal,
          adminAmount: serviceFee,
          hostId: listing?.hostId || null
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      // Add transaction and get the document reference
      const transactionRef = await addDoc(collection(db, 'Transactions'), paymentTransaction);
      
      console.log(`✅ Deducted ₱${grandTotal} from guest balance. New balance: ₱${newGuestBalance}`);
      console.log(`💰 Payment split - Host: ₱${subtotal}, Admin: ₱${serviceFee}`);
      console.log(`📝 Transaction ID: ${transactionRef.id}`);
      
      // Set payment method for booking
      const paymentData = {
        type: 'balance',
        transactionId: transactionRef.id,
        status: 'completed'
      };

      // Update user balance state
      setUserBalance(newGuestBalance);
      setUserInfo(prev => ({ ...prev, balance: newGuestBalance }));
      
      // Close confirmation dialog before submitting booking
      handleCloseConfirmDialog();
      
      // Payment successful, now submit the booking
      await submitBookingWithPayment(paymentData);
    } catch (error) {
      console.error('Error processing balance payment:', error);
      showError(`Failed to process payment: ${error.message || 'Please try again.'}`);
    }
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
    const checkInDate = normalizeDate(checkIn);
    const checkOutDate = normalizeDate(checkOut);

    // Validate dates
    if (!checkInDate || !checkOutDate) {
      showError('Please select valid check-in and check-out dates.');
      return;
    }

    // Prevent same-day reservations - check-in must be at least tomorrow
    const today = new Date();
    const todayNormalized = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    if (checkInDate.getTime() <= todayNormalized.getTime()) {
      showError('Check-in date must be at least tomorrow. Same-day reservations are not allowed.');
      return;
    }

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

      // Normalize existing reservation dates consistently
      const existingCheckInNormalized = normalizeDate(reservation.checkIn);
      const existingCheckOutNormalized = normalizeDate(reservation.checkOut);

      // Skip if dates are invalid/null
      if (!existingCheckInNormalized || !existingCheckOutNormalized || !checkInDate || !checkOutDate) {
        return false;
      }

      // Check for overlap: 
      // Dates overlap if the new booking's stay period intersects with existing booking's stay period.
      // A booking occupies nights from check-in (inclusive) to check-out (exclusive).
      // So: new check-in must be >= existing check-out OR new check-out must be <= existing check-in for NO overlap.
      // Overlap exists when: new check-in < existing check-out AND new check-out > existing check-in
      const overlaps = checkInDate.getTime() < existingCheckOutNormalized.getTime() && 
                       checkOutDate.getTime() > existingCheckInNormalized.getTime();

      if (overlaps) {
        console.log('Date conflict detected:', {
          existing: {
            checkIn: existingCheckInNormalized.toISOString().split('T')[0],
            checkOut: existingCheckOutNormalized.toISOString().split('T')[0],
            status: reservation.status
          },
          new: {
            checkIn: checkInDate.toISOString().split('T')[0],
            checkOut: checkOutDate.toISOString().split('T')[0]
          }
        });
      }

      return overlaps;
    });

    if (hasConflict) {
      showError('This listing is already reserved for the selected dates. Please choose different dates.');
      return;
    }

    // Check Firebase balance before showing confirmation dialog
    const userRef = doc(db, 'Users', guestId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const userData = userSnap.data();
      const currentBalance = userData.balance || userData.walletBalance || 0;
      
      // Check if balance is sufficient
      if (currentBalance < grandTotal) {
        const shortage = grandTotal - currentBalance;
        setErrorMessage(`Insufficient balance. You need ₱${shortage.toLocaleString()} more to complete this booking.\n\nCurrent Balance: ₱${currentBalance.toLocaleString()}\nRequired Amount: ₱${grandTotal.toLocaleString()}\n\nPlease add funds to your account.`);
        showInsufficientBalance();
        return;
      }
    } else {
      // User document doesn't exist
      setErrorMessage(`User account not found. Please contact support.`);
      showError();
      return;
    }

    // If validation passes and balance is sufficient, show confirmation dialog
    showConfirmBookingDialog();
  };

  const submitBookingWithPayment = async (paymentData = null) => {
    try {
      console.log('Submitting booking with payment data:', paymentData);
      
      // Payment is already processed in handleBalancePayment, so we just proceed with booking creation
      
      // Close confirmation dialog if still open
      if (showConfirmDialog) {
        handleCloseConfirmDialog();
      }

      // Determine hostId from listing
      const hostId = listing.hostId || null;

      // Build reservation payload - use normalizeDate for consistent parsing
      const checkInDate = normalizeDate(checkIn);
      const checkOutDate = normalizeDate(checkOut);

      // Use provided payment data or card payment data (already defined above for balance check)
      const finalPaymentMethodForReservation = paymentData || (selectedPaymentMethodType === 'card' ? {
        type: 'card',
        last4: paymentForm.cardNumber.replace(/\D/g, '').slice(-4),
        cardHolder: paymentForm.cardHolder,
        expiryDate: paymentForm.expiryDate
      } : {
        type: 'balance',
        transactionId: paymentData?.transactionId || null
      });

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

      // Payment is already processed in handleBalancePayment before this function is called
      // Balance deduction and distribution to host/admin is handled there

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
        const hostNotificationRef = await addDoc(collection(db, 'Notifications'), hostNotification);
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
        const guestNotificationRef = await addDoc(collection(db, 'Notifications'), guestNotification);
      }

      // Fetch recommended listings before showing dialog
      await fetchRecommendedListings();
      
      // Show recommendations dialog
      setShowRecommendationsDialog(true);
      setTimeout(() => {
        if (recommendationsDialogRef.current) {
          try {
            if (typeof recommendationsDialogRef.current.showModal === 'function') {
              recommendationsDialogRef.current.showModal();
            } else {
              dialogPolyfill.registerDialog(recommendationsDialogRef.current);
              recommendationsDialogRef.current.showModal();
            }
          } catch (err) {
            console.error('Error showing recommendations dialog:', err);
            recommendationsDialogRef.current.style.display = 'block';
          }
        }
      }, 100);
    } catch (err) {
      console.error('Error creating reservation:', err);
      showError('Failed to create reservation. Please try again.');
    }
  };

  // Fetch recommended listings based on serviceType
  const fetchRecommendedListings = async () => {
    try {
      setLoadingRecommendations(true);
      const currentListingId = listing.id || listingId;
      const currentServiceType = listing.serviceType || '';
      
      console.log('Fetching recommendations for serviceType:', currentServiceType);
      
      if (!currentServiceType) {
        console.log('No serviceType found in current listing');
        setRecommendedListings([]);
        setLoadingRecommendations(false);
        return;
      }

      // Fetch all listings
      const listingsRef = collection(db, 'Listings');
      const snapshot = await getDocs(listingsRef);
      
      // Filter listings with exact same serviceType, exclude current listing
      const allListings = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(item => {
          // Exclude current listing
          if (item.id === currentListingId) return false;
          
          // Get serviceType from item (handle different possible field names)
          const itemServiceType = (item.serviceType || item.service || '').toString().trim().toLowerCase();
          const currentServiceTypeLower = currentServiceType.toString().trim().toLowerCase();
          
          // Exact match for serviceType (case-insensitive)
          const matches = itemServiceType === currentServiceTypeLower;
          
          if (matches) {
            console.log('Found matching listing:', item.id, item.title || item.name, 'serviceType:', item.serviceType);
          }
          
          return matches;
        });

      console.log(`Found ${allListings.length} listings with serviceType "${currentServiceType}"`);

      // Shuffle and get 3 random listings
      const shuffled = allListings.sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, 3);
      
      console.log('Selected recommendations:', selected.length);
      setRecommendedListings(selected);
    } catch (error) {
      console.error('Error fetching recommended listings:', error);
      setRecommendedListings([]);
    } finally {
      setLoadingRecommendations(false);
    }
  };

  const handleCloseRecommendationsDialog = () => {
    setShowRecommendationsDialog(false);
    recommendationsDialogRef.current?.close();
    // Navigate to bookings page after closing
    navigate(`/guest/${guestId}/bookings`);
  };

  const handleViewRecommendedListing = (recommendedListingId) => {
    handleCloseRecommendationsDialog();
    navigate(`/guest/${guestId}/listing/${recommendedListingId}`);
  };

  const submitBooking = async () => {
    // Use Firebase balance payment
    if (selectedPaymentMethodType === 'balance') {
      await handleBalancePayment();
      return;
    }

    // Fallback: if no payment method selected, use balance
    await handleBalancePayment();
  };

  if (loadingUser) {
    return <Loading fullScreen message="Loading user information..." />;
  }

  return (
    <div className="booking-container">
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
                    {listing.appliedPromoCode && (
                      <p className="discount-badge-code">Promo Code: {listing.appliedPromoCode}</p>
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

      {/* Payment Method Dialog - Balance Payment */}
      <dialog ref={paymentDialogRef} className="payment-method-dialog">
        <div className="payment-dialog-content">
          <div className="payment-dialog-header">
            <h3>Payment Method</h3>
            <button onClick={handleClosePaymentDialog} className="close-payment-dialog-btn">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          {/* Balance Payment Section */}
          <div className="balance-payment-section">
            <div className="balance-info">
              <h4>Your Account Balance</h4>
              <p className="balance-amount">₱{userBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="balance-description">
                Total amount needed: <strong>₱{grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </p>
              {userBalance < grandTotal && (
                <div className="insufficient-balance-warning">
                  <p>⚠️ Insufficient balance. You need ₱{(grandTotal - userBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} more.</p>
                  <button 
                    className="add-balance-btn"
                    onClick={() => {
                      handleClosePaymentDialog();
                      // Navigate to add balance page or open add balance dialog
                      alert('Please add funds to your account to complete this booking.');
                    }}
                  >
                    Add Funds
                  </button>
                </div>
              )}
            </div>
          </div>
          
          {/* Card payment form removed - using balance only */}
          {false && (
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

          <div className="payment-dialog-actions">
            <button onClick={handleClosePaymentDialog} className="cancel-payment-btn">
              Close
            </button>
            {userBalance >= grandTotal && (
              <button 
                onClick={() => {
                  handleClosePaymentDialog();
                  showConfirmBookingDialog();
                }} 
                className="save-payment-btn"
              >
                Proceed to Confirm
              </button>
            )}
          </div>
        </div>
      </dialog>

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
              Please add funds to your account balance to complete this booking.
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
                  {listing.appliedPromoCode && (
                    <div className="confirm-detail-row" style={{ fontSize: '0.9rem', color: '#666' }}>
                      <span className="confirm-label">Promo Code:</span>
                      <span className="confirm-value"><strong>{listing.appliedPromoCode}</strong></span>
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
              {message && (
                <div className="confirm-detail-row" style={{ 
                  marginTop: '12px',
                  padding: '12px',
                  background: '#f9fafb',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb'
                }}>
                  <span className="confirm-label">Message to Host:</span>
                  <span className="confirm-value" style={{ fontStyle: 'italic', color: '#4b5563' }}>
                    "{message}"
                  </span>
                </div>
              )}
            </div>

            {/* Balance Payment Section */}
            <div className="confirm-payment-section">
              <h4>Payment Method</h4>
              <div className="balance-payment-confirm">
                <div className="balance-info-confirm">
                  <p className="balance-label">Your Account Balance:</p>
                  <p className="balance-amount-large">₱{userBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  {userBalance < grandTotal ? (
                    <div className="insufficient-balance-alert">
                      <p>⚠️ Insufficient balance. You need ₱{(grandTotal - userBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} more.</p>
                    </div>
                  ) : (
                    <div className="sufficient-balance-success">
                      <p>✅ Sufficient balance available</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="confirm-dialog-actions">
            <button onClick={handleCloseConfirmDialog} className="confirm-cancel-btn">
              Cancel
            </button>
            {userBalance >= grandTotal ? (
              <button onClick={handleBalancePayment} className="confirm-submit-btn">
                Confirm Booking & Pay
              </button>
            ) : (
              <button 
                onClick={() => {
                  handleCloseConfirmDialog();
                  alert('Please add funds to your account to complete this booking.');
                }} 
                className="confirm-submit-btn" 
                style={{ opacity: 0.6, cursor: 'not-allowed' }}
                disabled
              >
                Insufficient Balance
              </button>
            )}
          </div>
        </div>
      </dialog>

      {/* Recommendations Dialog */}
      <dialog ref={recommendationsDialogRef} className="recommendations-dialog">
        <div className="recommendations-dialog-content">
          <div className="recommendations-dialog-header">
            <div className="recommendations-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                <path d="M2 17l10 5 10-5"></path>
                <path d="M2 12l10 5 10-5"></path>
              </svg>
            </div>
            <h3 className="recommendations-dialog-title">🎉 Booking Confirmed!</h3>
            <button onClick={handleCloseRecommendationsDialog} className="close-recommendations-dialog-btn" aria-label="Close">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div className="recommendations-dialog-body">
            <p className="recommendations-success-message">
              Your booking request has been sent successfully! The host will review and confirm your reservation.
            </p>
            <div className="recommendations-section">
              <h4 className="recommendations-section-title">
                🌟 You might also like these {listing.serviceType || 'similar'} listings:
              </h4>
              {loadingRecommendations ? (
                <div className="recommendations-loading">
                  <div className="spinner-small"></div>
                  <p>Loading recommendations...</p>
                </div>
              ) : recommendedListings.length > 0 ? (
                <div className="recommendations-grid">
                  {recommendedListings.map((recommendedListing) => (
                    <div 
                      key={recommendedListing.id} 
                      className="recommended-listing-card"
                      onClick={() => handleViewRecommendedListing(recommendedListing.id)}
                    >
                      <div className="recommended-listing-image">
                        {recommendedListing.photos?.[0] || recommendedListing.images?.[0] ? (
                          <img 
                            src={recommendedListing.photos?.[0] || recommendedListing.images?.[0]} 
                            alt={recommendedListing.title || recommendedListing.name}
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div className="recommended-image-placeholder" style={{ display: (recommendedListing.photos?.[0] || recommendedListing.images?.[0]) ? 'none' : 'flex' }}>
                          <span>🏠</span>
                        </div>
                      </div>
                      <div className="recommended-listing-info">
                        <h5 className="recommended-listing-title">
                          {recommendedListing.title || recommendedListing.name || 'Untitled Listing'}
                        </h5>
                        <div className="recommended-listing-details">
                          {recommendedListing.rating && (
                            <div className="recommended-listing-rating">
                              <span className="star-filled">★</span>
                              <span>{Number(recommendedListing.rating).toFixed(1)}</span>
                            </div>
                          )}
                          {recommendedListing.price && (
                            <div className="recommended-listing-price">
                              <span className="price-amount">₱{Number(recommendedListing.price).toLocaleString()}</span>
                              <span className="price-period">/night</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="recommendations-empty">
                  <p>No similar listings found at the moment.</p>
                </div>
              )}
            </div>
          </div>
          <div className="recommendations-dialog-actions">
            <button onClick={handleCloseRecommendationsDialog} className="recommendations-close-btn">
              View My Bookings
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
};

export default SelectedListingBookingConfirmation;