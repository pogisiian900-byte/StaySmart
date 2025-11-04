import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
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
  const [hasPaymentMethod, setHasPaymentMethod] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentMethodType, setPaymentMethodType] = useState('card'); // 'card' or 'paypal'
  const paymentDialogRef = useRef(null);
  
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

  const nights = 2; // temporary
  const total = listing.price * nights;
  const serviceFee = 300;
  const grandTotal = total + serviceFee;

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

  // Register dialog polyfill
  useEffect(() => {
    if (paymentDialogRef.current && !paymentDialogRef.current.showModal) {
      dialogPolyfill.registerDialog(paymentDialogRef.current);
    }
  }, []);

  // ✅ Fetch user data from Firestore
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userRef = doc(db, 'Users', guestId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setUserInfo(userData);
          
          // Check if user has payment method
          if (userData.paymentMethod) {
            setHasPaymentMethod(true);
            setPaymentMethod(userData.paymentMethod);
            setPaymentMethodType(userData.paymentMethod.type || 'card');
          } else {
            setHasPaymentMethod(false);
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
          console.error('Error showing dialog:', err);
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

  const handlePayPalSuccess = async (data, actions) => {
    // Capture the payment
    const details = await actions.order.capture();
    
    try {
      const userRef = doc(db, 'Users', guestId);
      
      const paymentData = {
        type: 'paypal',
        paypalEmail: details.payer.email_address,
        payerId: details.payer.payer_id,
        payerName: `${details.payer.name.given_name} ${details.payer.name.surname}`,
        transactionId: details.id,
        status: details.status
      };

      await updateDoc(userRef, {
        paymentMethod: paymentData
      });

      setPaymentMethod(paymentData);
      setHasPaymentMethod(true);
      setPaymentMethodType('paypal');
      setUserInfo(prev => ({ ...prev, paymentMethod: paymentData }));
      handleClosePaymentDialog();
      alert('PayPal payment method connected successfully!');
    } catch (error) {
      console.error('Error saving PayPal payment method:', error);
      alert('Failed to save PayPal payment method. Please try again.');
    }
  };

  const handlePayPalError = (err) => {
    console.error('PayPal Error:', err);
    alert('An error occurred with PayPal payment. Please try again.');
  };

  const handlePayPalCancel = () => {
    console.log('PayPal payment cancelled');
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
      setHasPaymentMethod(true);
      setUserInfo(prev => ({ ...prev, paymentMethod: paymentData }));
      handleClosePaymentDialog();
      alert('Payment method saved successfully!');
    } catch (error) {
      console.error('Error saving payment method:', error);
      alert('Failed to save payment method. Please try again.');
    }
  };

  const handleConfirmBooking = async () => {
    if (!hasPaymentMethod) {
      alert('Please add a payment method before confirming your booking.');
      return;
    }

    try {
      // Validate required booking data
      if (!listing || !listing.id && !listingId) {
        alert('Listing information is missing.');
        return;
      }

      // Determine hostId from listing (expect listing.hostId or ownerId)
      const hostId = listing.hostId || listing.ownerId || listing.userId || null;

      // Build reservation payload
      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);

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
          subtotal: total,
          serviceFee,
          total: grandTotal,
        },
        guestMessage: message || '',
        paymentSummary: {
          methodType: paymentMethod?.type || 'card',
          last4: paymentMethod?.last4 || null,
          paypalEmail: paymentMethod?.paypalEmail || null,
          transactionId: paymentMethod?.transactionId || null,
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // Create the Reservation document
      const reservationRef = await addDoc(collection(db, 'Reservation'), reservation);

      // Create a simple host notification if hostId available
      if (hostId) {
        const notification = {
          type: 'reservation_request',
          hostId,
          guestId,
          listingId: reservation.listingId,
          reservationId: reservationRef.id,
          title: 'New reservation request',
          body: `${userInfo?.firstName || 'A guest'} requested to book ${reservation.listingTitle}`,
          read: false,
          createdAt: serverTimestamp(),
        };
        await addDoc(collection(db, 'Notifications'), notification);
      }

      alert('Booking request sent successfully!');
      // Navigate to guest bookings page or reservation details
      navigate(`/guest/${guestId}/bookings`);
    } catch (err) {
      console.error('Error creating reservation:', err);
      alert('Failed to create reservation. Please try again.');
    }
  };

  if (loadingUser) {
    return <Loading fullScreen message="Loading user information..." />;
  }

  // PayPal Sandbox Client ID - Replace with your actual Sandbox Client ID from PayPal Developer Dashboard
  // For Vite, use import.meta.env instead of process.env
  const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID || "test"; // Default to "test" for development

  return (
    <PayPalScriptProvider 
      options={{ 
        "client-id": PAYPAL_CLIENT_ID,
        currency: "PHP",
        intent: "capture"
      }}
    >
    <div className="booking-container">
      {/* Back Button */}
      <button className="back-btn" onClick={() => navigate(-1)}>
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
                <span className="option-title">Pay ₱{total} now</span>
                <span className="option-desc">You’ll be charged the full amount immediately.</span>
              </div>
            </label>
          </div>

          {/* Step 2: Payment Method */}
          <div className="payment-step2">
            {hasPaymentMethod && paymentMethod ? (
              <div className="hasPaymentMethod">
                <p className="step-title">2. Payment Method</p>
                <div className="payment-method-display">
                  <div className="payment-method-card">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect width="20" height="14" x="2" y="5" rx="2"/>
                      <line x1="2" x2="22" y1="10" y2="10"/>
                    </svg>
                    <div className="payment-method-info">
                      {paymentMethod.type === 'paypal' ? (
                        <>
                          <p className="payment-card-number">PayPal Account</p>
                          <p className="payment-card-holder">{paymentMethod.paypalEmail}</p>
                          <p className="payment-card-expiry">{paymentMethod.payerName}</p>
                        </>
                      ) : (
                        <>
                          <p className="payment-card-number">{paymentMethod.cardNumber}</p>
                          <p className="payment-card-holder">{paymentMethod.cardHolder}</p>
                          <p className="payment-card-expiry">Expires: {paymentMethod.expiryDate}</p>
                        </>
                      )}
                    </div>
                  </div>
                  <button className="change-payment-btn" onClick={handleOpenPaymentDialog}>
                    Change Payment Method
                  </button>
                </div>
              </div>
            ) : (
              <div className="noPaymentMethod">
                <p className="step-title">2. Add payment method</p>
                <p className="payment-warning">You need to add a payment method to complete your booking.</p>
                <button onClick={handleOpenPaymentDialog}>Set a Payment Method</button>
              </div>
            )}
          </div>

          {/* Step 3: Message Host */}
          <div className="messageHost-step3">
            <p className="step-title">3. Message the host</p>
            <textarea
              className="message-box"
              rows="4"
              placeholder="Introduce yourself and share why you're visiting..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          {/* Step 4: Confirm Booking */}
          <div className="confirmation-step4">
            <p className="step-title">4. Confirm your booking</p>
            <button 
              className={`confirm-btn ${!hasPaymentMethod ? 'confirm-btn-disabled' : ''}`} 
              onClick={handleConfirmBooking}
              disabled={!hasPaymentMethod}
            >
              {hasPaymentMethod ? 'Request to Book' : 'Add Payment Method First'}
            </button>
          </div>
        </div>

        {/* Right Side: Booking Invoice */}
        <div className="booking-invoice">
          <img src={listing.photos[0]} alt={listing.name} className="invoice-photo" />
          <div className="invoice-details">
            <h3>{listing.title}</h3>
            <hr />
            <h4>Date</h4>
            <p>{formatStayDates(checkIn, checkOut)}</p>
            <hr />
            <h4>Subtotal:</h4>
            <p> ₱{total}</p>
            <hr />
            <h4>Service fee:</h4>
            <p> ₱{serviceFee}</p>
            <h3>Total: ₱{grandTotal}</h3>
          </div>
        </div>
      </div>

      {/* Payment Method Dialog */}
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
              <p className="paypal-description">Connect your PayPal account to use for payments.</p>
              <PayPalButtons
                createOrder={(data, actions) => {
                  // Create order for minimum amount to connect PayPal
                  return actions.order.create({
                    purchase_units: [{
                      amount: {
                        value: "0.01", // Minimum amount to connect PayPal
                        currency_code: "PHP"
                      },
                      description: "Connect PayPal Account"
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
    </div>
    </PayPalScriptProvider>
  );
};

export default SelectedListingBookingConfirmation;
