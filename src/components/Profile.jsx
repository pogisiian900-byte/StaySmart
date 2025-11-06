import React, { useEffect, useState, useRef } from 'react'
import me from '/static/no photo.webp'
import bgBlue from '/static/Bluebg.png'
import { useNavigate, useParams } from 'react-router-dom'
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from ".././config/firebase";
import "../pages/host/profile-new.css";
import 'dialog-polyfill/dist/dialog-polyfill.css';
import dialogPolyfill from 'dialog-polyfill';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
const Profile = () => {
const { hostId, guestId } = useParams();
const [user, setUser] = useState(null);
const [loading, setLoading] = useState(true);
const [editedUser, setEditedUser] = useState(null);
const [isSaving, setIsSaving] = useState(false);
const [paymentMethod, setPaymentMethod] = useState(null);
const [paymentMethodType, setPaymentMethodType] = useState('card');
const navigate = useNavigate();
const dialogRef = useRef(null);
const fileInputRef = useRef(null);
const paymentDialogRef = useRef(null);

// Payment method form state
const [paymentForm, setPaymentForm] = useState({
  cardNumber: '',
  cardHolder: '',
  expiryDate: '',
  cvv: '',
  billingAddress: ''
});


useEffect(() => {
  // Register dialog polyfills when component mounts
  if (dialogRef.current && !dialogRef.current.showModal) {
    dialogPolyfill.registerDialog(dialogRef.current);
  }
  if (paymentDialogRef.current && !paymentDialogRef.current.showModal) {
    dialogPolyfill.registerDialog(paymentDialogRef.current);
  }

  const fetchUserData = async () => {
    try {
      const userId = hostId || guestId;
      const docRef = doc(db, "Users", userId);
      const snapshot = await getDoc(docRef);

      if (snapshot.exists()) {
        console.log("User data:", snapshot.data());
        const userData = snapshot.data();
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
    } catch (err) {
      console.error("Error fetching user:", err);
    } finally {
      setLoading(false);
    }
  };

  fetchUserData();
}, [hostId, guestId]);


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
    billingAddress: ''
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

const handlePayPalSuccess = async (data, actions) => {
  const details = await actions.order.capture();
  
  try {
    setIsSaving(true);
    const userId = hostId || guestId;
    const userRef = doc(db, 'Users', userId);
    
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
    setPaymentMethodType('paypal');
    setUser(prev => ({ ...prev, paymentMethod: paymentData }));
    handleClosePaymentDialog();
    alert('PayPal payment method connected successfully!');
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
      {/* Header with Back Button */}
      <div className="profile-header-new">
        <button className='profile-back-btn-new' onClick={handleBack}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 19-7-7 7-7"/>
            <path d="M19 12H5"/>
          </svg>
          Back
        </button>
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
                      <p className="payment-method-type">PayPal Account</p>
                      <p className="payment-method-detail">{paymentMethod.paypalEmail}</p>
                      <p className="payment-method-name">{paymentMethod.payerName}</p>
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
              <button className="change-payment-btn-profile" onClick={handleOpenPaymentDialog}>
                Change Payment Method
              </button>
            </div>
          ) : (
            <div className="no-payment-method-profile">
              <p className="no-payment-text">No payment method added</p>
              <button className="add-payment-btn-profile" onClick={handleOpenPaymentDialog}>
                Add Payment Method
              </button>
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
                <p className="paypal-description">Connect your PayPal account to use for payments.</p>
                <PayPalButtons
                  createOrder={(data, actions) => {
                    return actions.order.create({
                      purchase_units: [{
                        amount: {
                          value: "0.01",
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
                  <button onClick={handleSavePaymentMethod} className="save-payment-btn" disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save Payment Method'}
                  </button>
                </div>
              </>
            )}
          </div>
        </dialog>
      </PayPalScriptProvider>
    </div>
  )
}

export default Profile
