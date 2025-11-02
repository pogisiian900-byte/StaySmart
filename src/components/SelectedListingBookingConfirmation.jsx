import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase'; 
import '../pages/guest/guest-bookingConfirmation.css';

const SelectedListingBookingConfirmation = () => {
  const { listingId, guestId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const bookingData = location.state;

  const [guestInfo, setGuestInfo] = useState(null);
  const [loadingGuest, setLoadingGuest] = useState(true);
  const [message, setMessage] = useState('');

  if (!bookingData) {
    return <p>No booking data found. Please go back and select again.</p>;
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

  // ✅ Fetch guest data from Firestore
  useEffect(() => {
    const fetchGuest = async () => {
      try {
        const guestRef = doc(db, 'guests', guestId); // adjust collection name if needed
        const guestSnap = await getDoc(guestRef);
        if (guestSnap.exists()) {
          setGuestInfo(guestSnap.data());
        } else {
          console.error('Guest not found');
        }
      } catch (error) {
        console.error('Error fetching guest:', error);
      } finally {
        setLoadingGuest(false);
      }
    };

    fetchGuest();
  }, [guestId]);

  const handleConfirmBooking = () => {
    alert('Booking request sent successfully!');
    navigate(`/guest/${guestId}/bookings`);
  };

  if (loadingGuest) {
    return <p>Loading guest information...</p>;
  }

  return (
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
          {guestInfo && (
            <div className="guest-info">
              <p><strong>Guest:</strong> {guestInfo.name}</p>
              <p><strong>Email:</strong> {guestInfo.email}</p>
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

          {/* Step 2: Review Rules */}
          <div className="payment-step2">
            {/* <div className="hasPaymentMethod">
                <p className="step-title">2. Review house rules</p>
                <p className="option-desc">
                  Be respectful of the property and neighbors. No loud noise after 10PM.
                </p>
            </div> */}

            <div className="noPaymentMethod">
                <p className="step-title">2. Add payment method</p>
                <button>Set a Payment Method</button>
            </div>
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
            <button className="confirm-btn" onClick={handleConfirmBooking}>
              Request to Book
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
    </div>
  );
};

export default SelectedListingBookingConfirmation;
