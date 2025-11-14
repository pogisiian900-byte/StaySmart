import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, getDoc, updateDoc, collection, getDocs, onSnapshot, serverTimestamp, query, where, orderBy, addDoc } from "firebase/firestore"
import { db } from "../../config/firebase"
import { useAuth } from "../../layout/AuthContext"
import { syncPayPalBalanceToFirebase } from '../../utils/paypalApi'
import me from '/static/no photo.webp'
import bgBlue from '/static/Bluebg.png'
import '../host/profile-new.css'
import './admin-dashboard.css'
import 'dialog-polyfill/dist/dialog-polyfill.css'
import dialogPolyfill from 'dialog-polyfill'
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js'

const AdminProfile = () => {
  const { user: authUser } = useAuth()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editedUser, setEditedUser] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState(null)
  const [paymentMethodType, setPaymentMethodType] = useState('card')
  const [showPayPalDialog, setShowPayPalDialog] = useState(false)
  const [adminStats, setAdminStats] = useState({
    totalUsers: 0,
    totalHosts: 0,
    totalGuests: 0,
    totalBookings: 0,
    totalListings: 0,
    totalRevenue: 0
  })
  const [transactions, setTransactions] = useState([])
  const [loadingTransactions, setLoadingTransactions] = useState(true)
  const dialogRef = useRef(null)
  const fileInputRef = useRef(null)
  const paymentDialogRef = useRef(null)

  // Payment method form state
  const [paymentForm, setPaymentForm] = useState({
    cardNumber: '',
    cardHolder: '',
    expiryDate: '',
    cvv: '',
    billingAddress: '',
    paypalBusinessEmail: '',
    paypalBusinessName: ''
  })

  // Fetch admin data and stats with real-time updates
  useEffect(() => {
    if (!authUser) return

    // Real-time listener for admin user data (for balance updates)
    const userRef = doc(db, "Users", authUser.uid)
    const unsubscribeUser = onSnapshot(userRef, (userSnap) => {
      if (userSnap.exists()) {
        const userData = userSnap.data()
        setUser(userData)
        setEditedUser(userData)

        // Set payment method if exists
        if (userData.paymentMethod) {
          setPaymentMethod(userData.paymentMethod)
          setPaymentMethodType(userData.paymentMethod.type || 'card')
        }
      }
      setLoading(false)
    }, (error) => {
      console.error("Error fetching user data:", error)
      setLoading(false)
    })

    // Fetch admin statistics (one-time)
    const fetchStats = async () => {
      try {
        const [usersSnapshot, bookingsSnapshot, listingsSnapshot] = await Promise.all([
          getDocs(collection(db, 'Users')),
          getDocs(collection(db, 'Reservation')),
          getDocs(collection(db, 'Listings'))
        ])

        const users = usersSnapshot.docs.map(d => d.data())
        const bookings = bookingsSnapshot.docs.map(d => d.data())
        const listings = listingsSnapshot.docs.map(d => d.data())

        const totalRevenue = bookings
          .filter(b => b.status?.toLowerCase() === 'confirmed')
          .reduce((sum, b) => sum + (b.pricing?.total || b.pricing?.grandTotal || 0), 0)

        setAdminStats({
          totalUsers: users.length,
          totalHosts: users.filter(u => u.role === 'host').length,
          totalGuests: users.filter(u => u.role === 'guest').length,
          totalBookings: bookings.length,
          totalListings: listings.length,
          totalRevenue
        })
      } catch (error) {
        console.error("Error fetching admin stats:", error)
      }
    }

    fetchStats()

    // Fetch admin transactions
    const fetchTransactions = async () => {
      if (!authUser) return
      try {
        setLoadingTransactions(true)
        
        // Query both Transactions and AdminTransactions collections
        const [transactionsSnap, adminTransactionsSnap] = await Promise.all([
          getDocs(query(
            collection(db, 'Transactions'),
            where('userId', '==', authUser.uid),
            orderBy('createdAt', 'desc')
          )).catch(() => {
            // Fallback without orderBy if index doesn't exist
            return getDocs(query(
              collection(db, 'Transactions'),
              where('userId', '==', authUser.uid)
            ))
          }),
          getDocs(query(
            collection(db, 'AdminTransactions'),
            where('adminId', '==', authUser.uid),
            orderBy('createdAt', 'desc')
          )).catch(() => {
            // Fallback without orderBy if index doesn't exist
            return getDocs(query(
              collection(db, 'AdminTransactions'),
              where('adminId', '==', authUser.uid)
            ))
          })
        ])

        const allTransactions = []
        
        transactionsSnap.forEach((doc) => {
          allTransactions.push({ id: doc.id, ...doc.data(), source: 'Transactions' })
        })
        
        adminTransactionsSnap.forEach((doc) => {
          allTransactions.push({ id: doc.id, ...doc.data(), source: 'AdminTransactions' })
        })

        // Sort by date (newest first)
        allTransactions.sort((a, b) => {
          const dateA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0)
          const dateB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0)
          return dateB - dateA
        })

        setTransactions(allTransactions.slice(0, 50)) // Limit to 50 most recent
        setLoadingTransactions(false)
      } catch (error) {
        console.error('Error fetching transactions:', error)
        setLoadingTransactions(false)
      }
    }

    fetchTransactions()

    return () => {
      unsubscribeUser()
    }
  }, [authUser])

  // Register dialog polyfills
  useEffect(() => {
    if (dialogRef.current && !dialogRef.current.showModal) {
      dialogPolyfill.registerDialog(dialogRef.current)
    }
    if (paymentDialogRef.current && !paymentDialogRef.current.showModal) {
      dialogPolyfill.registerDialog(paymentDialogRef.current)
    }
  }, [])

  const handleBack = () => {
    navigate("/admin")
  }

  const handleEditClick = () => {
    setEditedUser(user)
    setTimeout(() => {
      if (dialogRef.current) {
        try {
          if (typeof dialogRef.current.showModal === 'function') {
            dialogRef.current.showModal()
          } else {
            dialogPolyfill.registerDialog(dialogRef.current)
            dialogRef.current.showModal()
          }
        } catch (err) {
          console.error('Error showing dialog:', err)
          dialogRef.current.style.display = 'block'
        }
      }
    }, 50)
  }

  const handleCloseDialog = () => {
    setEditedUser(user)
    dialogRef.current?.close()
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setEditedUser(prev => ({
      ...prev,
      [name]: value
    }))
  }

  // Cloudinary upload function
  const uploadImageToCloudinary = async (file) => {
    const uploadPreset = "listing_uploads"
    const cloudName = "ddckoojwo"

    const formData = new FormData()
    formData.append("file", file)
    formData.append("upload_preset", uploadPreset)

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    )

    if (!response.ok) {
      throw new Error("Upload failed")
    }

    const data = await response.json()
    return data.secure_url
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setIsSaving(true)
      const imageUrl = await uploadImageToCloudinary(file)
      setEditedUser(prev => ({ ...prev, profilePicture: imageUrl }))
    } catch (error) {
      console.error('Error uploading image:', error)
      alert(`Failed to upload image: ${error.message || 'Please try again.'}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      if (!authUser) return
      const userRef = doc(db, 'Users', authUser.uid)
      await updateDoc(userRef, editedUser)
      setUser(editedUser)
      handleCloseDialog()
      alert('Profile updated successfully!')
    } catch (error) {
      console.error('Error updating profile:', error)
      alert('Failed to update profile. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  // Payment Method Functions
  const handleOpenPaymentDialog = () => {
    setPaymentForm({
      cardNumber: '',
      cardHolder: '',
      expiryDate: '',
      cvv: '',
      billingAddress: ''
    })
    if (paymentMethod) {
      setPaymentMethodType(paymentMethod.type || 'card')
    }
    
    setTimeout(() => {
      if (paymentDialogRef.current) {
        try {
          if (typeof paymentDialogRef.current.showModal === 'function') {
            paymentDialogRef.current.showModal()
          } else {
            dialogPolyfill.registerDialog(paymentDialogRef.current)
            paymentDialogRef.current.showModal()
          }
        } catch (err) {
          console.error('Error showing payment dialog:', err)
          paymentDialogRef.current.style.display = 'block'
        }
      }
    }, 50)
  }

  const handleClosePaymentDialog = () => {
    paymentDialogRef.current?.close()
    setPaymentForm({
      cardNumber: '',
      cardHolder: '',
      expiryDate: '',
      cvv: '',
      billingAddress: ''
    })
    setPaymentMethodType('card')
  }

  const handlePaymentFormChange = (e) => {
    const { name, value } = e.target
    let formattedValue = value

    // Format card number with spaces
    if (name === 'cardNumber') {
      const digits = value.replace(/\D/g, '')
      formattedValue = digits.match(/.{1,4}/g)?.join(' ') || digits
      if (formattedValue.length > 19) {
        formattedValue = formattedValue.slice(0, 19)
      }
    }

    // Format expiry date (MM/YY)
    if (name === 'expiryDate') {
      const digits = value.replace(/\D/g, '')
      if (digits.length >= 2) {
        formattedValue = `${digits.slice(0, 2)}/${digits.slice(2, 4)}`
      } else {
        formattedValue = digits
      }
      if (formattedValue.length > 5) {
        formattedValue = formattedValue.slice(0, 5)
      }
    }

    // Format CVV
    if (name === 'cvv') {
      formattedValue = value.replace(/\D/g, '').slice(0, 4)
    }

    setPaymentForm(prev => ({
      ...prev,
      [name]: formattedValue
    }))
  }

  const handleSavePaymentMethod = async () => {
    if (paymentMethodType === 'card') {
      if (!paymentForm.cardNumber || !paymentForm.cardHolder || !paymentForm.expiryDate || !paymentForm.cvv) {
        alert('Please fill in all card details')
        return
      }

      const cardDigits = paymentForm.cardNumber.replace(/\D/g, '')
      if (cardDigits.length < 13 || cardDigits.length > 19) {
        alert('Please enter a valid card number')
        return
      }

      const paymentData = {
        type: 'card',
        cardNumber: `**** **** **** ${cardDigits.slice(-4)}`,
        cardHolder: paymentForm.cardHolder,
        expiryDate: paymentForm.expiryDate,
        billingAddress: paymentForm.billingAddress || '',
        last4: cardDigits.slice(-4),
        fullCardNumber: cardDigits // Store for reference (in production, this should be encrypted)
      }

      if (!authUser) return
      const userRef = doc(db, 'Users', authUser.uid)
      await updateDoc(userRef, {
        paymentMethod: paymentData
      })

      setPaymentMethod(paymentData)
      setUser(prev => ({ ...prev, paymentMethod: paymentData }))
      handleClosePaymentDialog()
      alert('Payment method saved successfully!')
    }
  }

  const handlePayPalBusinessSuccess = async (data, actions) => {
    try {
      setIsSaving(true)
      const details = await actions.order.capture()
      if (!authUser) return
      const userRef = doc(db, 'Users', authUser.uid)

      const paymentData = {
        type: 'paypal',
        accountType: 'business', // Admin uses business account
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
      }

      // Prompt user to enter their current PayPal account balance to sync with Firebase
      const currentBalanceInput = prompt(
        'PayPal account connected successfully!\n\n' +
        'To sync your PayPal balance with Firebase, please enter your current PayPal account balance (PHP):\n\n' +
        'Example: If you have ₱20,000 in your PayPal account, enter: 20000\n\n' +
        '(Leave empty or 0 if starting fresh)'
      )
      
      let initialBalance = 0
      if (currentBalanceInput && currentBalanceInput.trim() !== '') {
        const parsedBalance = parseFloat(currentBalanceInput)
        if (!isNaN(parsedBalance) && parsedBalance >= 0) {
          initialBalance = parsedBalance
        }
      }

      // Update user document with PayPal info and initial balance
      await updateDoc(userRef, {
        paymentMethod: paymentData,
        paypalAccountId: details.payer.payer_id,
        paypalBalance: initialBalance, // Set initial balance to match actual PayPal account
        paypalLastUpdated: serverTimestamp(),
        balanceSyncedAt: serverTimestamp() // Mark when balance was synced
      })

      // If user entered a balance, create an initial balance sync transaction record
      if (initialBalance > 0) {
        await addDoc(collection(db, 'PayPalTransactions'), {
          userId: authUser.uid,
          userRole: 'admin',
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
        })
      }

      setPaymentMethod(paymentData)
      setPaymentMethodType('paypal')
      setUser(prev => ({ ...prev, paymentMethod: paymentData, paypalAccountId: details.payer.payer_id, paypalBalance: initialBalance }))
      setPaymentForm({
        cardNumber: '',
        cardHolder: '',
        expiryDate: '',
        cvv: '',
        billingAddress: '',
        paypalBusinessEmail: '',
        paypalBusinessName: ''
      })
      handleClosePaymentDialog()
      alert(`PayPal Business account connected successfully!\n\n${initialBalance > 0 ? `Balance synced: ₱${initialBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Balance set to ₱0. You can sync your balance later.'}\n\nAccount verified through PayPal API.`)
    } catch (error) {
      console.error('Error saving PayPal payment method:', error)
      alert('Failed to save PayPal payment method. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handlePayPalError = (err) => {
    console.error('PayPal Error:', err)
    
    // Check for specific PayPal error messages
    const errorMessage = err?.message || err?.toString() || ''
    
    // Check if error is about seller account
    if (errorMessage.includes('seller') || 
        errorMessage.includes('logging into the account') ||
        errorMessage.includes('change your login information')) {
      alert('⚠️ PayPal Account Conflict\n\nYou cannot use the same PayPal account that is registered as the merchant/seller account.\n\nPlease use a different PayPal Business account to receive payments.\n\nIf you are the platform owner, you should use a separate PayPal account for receiving payments.')
      return
    }
    
    // Generic error message
    alert(`An error occurred with PayPal: ${errorMessage || 'Please try again or use a different PayPal account.'}`)
  }

  const handlePayPalCancel = () => {
    console.log('PayPal payment cancelled')
  }

  const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID || "AWzCyB0viVv8_sS4aT309bhLLTMGLBYXexAJmIHkbrmTKp0hswkl1OHImpQDOWBnRncPBd7Us4dkNGbi"

  if (loading) {
    return (
      <div className="profile-page-new">
        <div style={{ textAlign: 'center', padding: '100px 20px', color: '#666' }}>
          <div style={{ fontSize: '1.2rem' }}>Loading profile...</div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="profile-page-new">
        <div style={{ textAlign: 'center', padding: '100px 20px', color: '#666' }}>
          <div style={{ fontSize: '1.2rem' }}>User not found</div>
        </div>
      </div>
    )
  }

  return (
    <div className="profile-page-new">
      {/* Header */}
      <div className="profile-header-new">
        <button className='profile-back-btn-new' onClick={handleBack}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m12 19-7-7 7-7"/>
            <path d="M19 12H5"/>
          </svg>
          Back to Dashboard
        </button>
        <button className="profile-edit-btn-new" onClick={handleEditClick}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                e.target.src = me
              }}
            />
            <div className="profile-status-badge" style={{ background: '#31326F' }}>
              <div className="status-dot" style={{ background: '#10b981' }}></div>
              <span>Admin</span>
            </div>
          </div>
          
          <div className="profile-info-main">
            <h1 className="profile-name-new">
              {user?.firstName || ""} {user?.middleName || ""} {user?.lastName || "Admin"}
            </h1>
            <p className="profile-bio">Administrator Account</p>
          </div>
        </div>
      </div>

      {/* Info Cards Grid */}
      <div className="profile-content-grid">
        {/* Personal Information Card */}
        <div className="profile-info-card">
          <div className="card-header">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

        {/* Admin Statistics Card */}
        <div className="profile-info-card">
          <div className="card-header">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23"/>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
            <h3>Platform Statistics</h3>
          </div>
          
          <div className="info-item">
            <div className="info-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div className="info-content">
              <span className="info-label">Total Users</span>
              <span className="info-value">{adminStats.totalUsers}</span>
            </div>
          </div>

          <div className="info-item">
            <div className="info-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <div className="info-content">
              <span className="info-label">Hosts</span>
              <span className="info-value">{adminStats.totalHosts}</span>
            </div>
          </div>

          <div className="info-item">
            <div className="info-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div className="info-content">
              <span className="info-label">Guests</span>
              <span className="info-value">{adminStats.totalGuests}</span>
            </div>
          </div>

          <div className="info-item">
            <div className="info-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" x2="16" y1="2" y2="6"/>
                <line x1="8" x2="8" y1="2" y2="6"/>
                <line x1="3" x2="21" y1="10" y2="10"/>
              </svg>
            </div>
            <div className="info-content">
              <span className="info-label">Total Bookings</span>
              <span className="info-value">{adminStats.totalBookings}</span>
            </div>
          </div>

          <div className="info-item">
            <div className="info-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              </svg>
            </div>
            <div className="info-content">
              <span className="info-label">Total Listings</span>
              <span className="info-value">{adminStats.totalListings}</span>
            </div>
          </div>

          <div className="info-item">
            <div className="info-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="1" x2="12" y2="23"/>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </div>
            <div className="info-content">
              <span className="info-label">Total Revenue</span>
              <span className="info-value">₱{adminStats.totalRevenue.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Stay Smart Balance Card - Digital Payment App Style */}
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
          </div>
        </div>

        {/* Payment Method Card */}
        <div className="profile-info-card">
          <div className="card-header">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect width="20" height="14" x="2" y="5" rx="2"/>
              <line x1="2" x2="22" y1="10" y2="10"/>
            </svg>
            <h3>Payment Setup</h3>
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
                        <p className="payment-method-type">PayPal Business Account</p>
                        <span style={{ 
                          background: '#31326F', 
                          color: 'white', 
                          padding: '2px 8px', 
                          borderRadius: '4px', 
                          fontSize: '10px',
                          fontWeight: '600',
                          textTransform: 'uppercase'
                        }}>
                          Business
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
                <button className="change-payment-btn-profile" onClick={handleOpenPaymentDialog}>
                  Change Payment Method
                </button>
              </div>
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
              <span className="info-value">Administrator</span>
            </div>
          </div>

          {user?.createdAt && (
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

        {/* Transaction History Card */}
        <div className="profile-info-card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-header">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23"/>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
            <h3>Transaction History</h3>
          </div>

          {loadingTransactions ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
              <div style={{ fontSize: '1rem' }}>Loading transactions...</div>
            </div>
          ) : transactions.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ margin: '0 auto 16px', opacity: 0.5 }}>
                <line x1="12" y1="1" x2="12" y2="23"/>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
              <p style={{ margin: 0, fontSize: '0.95rem' }}>No transactions found</p>
            </div>
          ) : (
            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {transactions.map((transaction) => {
                  const amount = parseFloat(transaction.amount || 0)
                  const isPositive = amount >= 0
                  const formatDate = (dateValue) => {
                    if (!dateValue) return 'N/A'
                    if (dateValue.toDate) return dateValue.toDate().toLocaleString()
                    if (dateValue.toMillis) return new Date(dateValue.toMillis()).toLocaleString()
                    if (dateValue.seconds) return new Date(dateValue.seconds * 1000).toLocaleString()
                    return new Date(dateValue).toLocaleString()
                  }

                  return (
                    <div
                      key={transaction.id}
                      style={{
                        padding: '16px',
                        background: '#f9fafb',
                        borderRadius: '12px',
                        border: '1px solid #e5e7eb',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'all 0.2s',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f3f4f6'
                        e.currentTarget.style.borderColor = '#d1d5db'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#f9fafb'
                        e.currentTarget.style.borderColor = '#e5e7eb'
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '10px',
                            background: isPositive 
                              ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.05))'
                              : 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.05))',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: isPositive ? '#10b981' : '#ef4444'
                          }}>
                            {isPositive ? (
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 5v14M19 12l-7 7-7-7"/>
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 19V5M5 12l7-7 7 7"/>
                              </svg>
                            )}
                          </div>
                          <div style={{ flex: 1 }}>
                            <p style={{
                              margin: '0 0 4px 0',
                              fontSize: '0.95rem',
                              fontWeight: '600',
                              color: '#1f2937'
                            }}>
                              {transaction.description || transaction.type || 'Transaction'}
                            </p>
                            <p style={{
                              margin: 0,
                              fontSize: '0.85rem',
                              color: '#6b7280'
                            }}>
                              {formatDate(transaction.createdAt)}
                            </p>
                          </div>
                        </div>
                        {transaction.reservationId && (
                          <p style={{
                            margin: '4px 0 0 0',
                            fontSize: '0.8rem',
                            color: '#9ca3af'
                          }}>
                            Reservation ID: {transaction.reservationId}
                          </p>
                        )}
                      </div>
                      <div style={{
                        textAlign: 'right',
                        marginLeft: '16px'
                      }}>
                        <p style={{
                          margin: 0,
                          fontSize: '1.1rem',
                          fontWeight: '700',
                          color: isPositive ? '#10b981' : '#ef4444'
                        }}>
                          {isPositive ? '+' : ''}₱{Math.abs(amount).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
                        </p>
                        {transaction.balanceAfter !== undefined && (
                          <p style={{
                            margin: '4px 0 0 0',
                            fontSize: '0.8rem',
                            color: '#9ca3af'
                          }}>
                            Balance: ₱{parseFloat(transaction.balanceAfter || 0).toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Profile Dialog */}
      <dialog ref={dialogRef} className="edit-profile-dialog">
        <div className="edit-dialog-content">
          <div className="edit-dialog-header">
            <h3>Edit Profile</h3>
            <button onClick={handleCloseDialog} className="close-dialog-btn" disabled={isSaving}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
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
      <dialog ref={paymentDialogRef} className="edit-profile-dialog">
        <div className="edit-dialog-content">
          <div className="edit-dialog-header">
            <h3>Payment Setup</h3>
            <button onClick={handleClosePaymentDialog} className="close-dialog-btn" disabled={isSaving}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
              <button
                onClick={() => setPaymentMethodType('card')}
                style={{
                  flex: 1,
                  padding: '12px',
                  border: `2px solid ${paymentMethodType === 'card' ? '#393b92' : '#e5e7eb'}`,
                  borderRadius: '8px',
                  background: paymentMethodType === 'card' ? '#f3f4ff' : 'white',
                  color: paymentMethodType === 'card' ? '#393b92' : '#6b7280',
                  fontWeight: paymentMethodType === 'card' ? '600' : '500',
                  cursor: 'pointer'
                }}
              >
                Credit/Debit Card
              </button>
              <button
                onClick={() => setPaymentMethodType('paypal')}
                style={{
                  flex: 1,
                  padding: '12px',
                  border: `2px solid ${paymentMethodType === 'paypal' ? '#393b92' : '#e5e7eb'}`,
                  borderRadius: '8px',
                  background: paymentMethodType === 'paypal' ? '#f3f4ff' : 'white',
                  color: paymentMethodType === 'paypal' ? '#393b92' : '#6b7280',
                  fontWeight: paymentMethodType === 'paypal' ? '600' : '500',
                  cursor: 'pointer'
                }}
              >
                PayPal
              </button>
            </div>

            {paymentMethodType === 'card' ? (
              <div className="edit-form-grid">
                <div className="edit-form-group" style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="cardNumber">Card Number</label>
                  <input
                    type="text"
                    id="cardNumber"
                    name="cardNumber"
                    placeholder="1234 5678 9012 3456"
                    value={paymentForm.cardNumber}
                    onChange={handlePaymentFormChange}
                    maxLength={19}
                  />
                </div>

                <div className="edit-form-group" style={{ gridColumn: '1 / -1' }}>
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

                <div className="edit-form-group">
                  <label htmlFor="expiryDate">Expiry Date</label>
                  <input
                    type="text"
                    id="expiryDate"
                    name="expiryDate"
                    placeholder="MM/YY"
                    value={paymentForm.expiryDate}
                    onChange={handlePaymentFormChange}
                    maxLength={5}
                  />
                </div>

                <div className="edit-form-group">
                  <label htmlFor="cvv">CVV</label>
                  <input
                    type="text"
                    id="cvv"
                    name="cvv"
                    placeholder="123"
                    value={paymentForm.cvv}
                    onChange={handlePaymentFormChange}
                    maxLength={4}
                  />
                </div>

                <div className="edit-form-group" style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="billingAddress">Billing Address (Optional)</label>
                  <input
                    type="text"
                    id="billingAddress"
                    name="billingAddress"
                    placeholder="123 Main St, City, State"
                    value={paymentForm.billingAddress}
                    onChange={handlePaymentFormChange}
                  />
                </div>
              </div>
            ) : (
              <div style={{ padding: '20px', textAlign: 'center' }}>
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
                  <p style={{ margin: '0 0 12px 0', color: '#6b7280', fontSize: '14px' }}>
                    Connect your PayPal Business account through PayPal Sandbox to receive payments and manage transactions.
                  </p>
                  <p style={{ margin: 0, color: '#9ca3af', fontSize: '12px' }}>
                    This will verify your PayPal Business account through PayPal's API and enable payment processing.
                  </p>
                </div>
                {PAYPAL_CLIENT_ID && (
                  <PayPalScriptProvider options={{ clientId: PAYPAL_CLIENT_ID, currency: "PHP" }}>
                    <div style={{ maxWidth: '300px', margin: '0 auto' }}>
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
                          })
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
                    </div>
                    <p style={{ 
                      marginTop: '16px', 
                      fontSize: '12px', 
                      color: '#6b7280',
                      fontStyle: 'italic'
                    }}>
                      A ₱1.00 verification payment will be processed to verify your PayPal Business account
                    </p>
                  </PayPalScriptProvider>
                )}
              </div>
            )}
          </div>

          <div className="edit-dialog-actions">
            <button onClick={handleClosePaymentDialog} className="cancel-btn-edit" disabled={isSaving}>
              Cancel
            </button>
            {paymentMethodType === 'card' && (
              <button onClick={handleSavePaymentMethod} className="save-btn-edit" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Payment Method'}
              </button>
            )}
          </div>
        </div>
      </dialog>
    </div>
  )
}

export default AdminProfile

