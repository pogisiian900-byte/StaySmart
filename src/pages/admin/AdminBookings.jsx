import React, { useEffect, useState, useMemo } from 'react'
import { collection, onSnapshot, doc, getDoc, updateDoc, serverTimestamp, addDoc, getDocs } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { useAuth } from '../../layout/AuthContext'
import './admin-dashboard.css'
import 'dialog-polyfill/dist/dialog-polyfill.css'
import dialogPolyfill from 'dialog-polyfill'

const AdminBookings = () => {
  const { user: authUser } = useAuth()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [userDetails, setUserDetails] = useState({}) // Cache for guest and host details
  const [listingDetails, setListingDetails] = useState({}) // Cache for listing details
  const [updatingStatus, setUpdatingStatus] = useState(null)
  const detailsDialogRef = React.useRef(null)

  // Fetch all bookings
  useEffect(() => {
    const q = collection(db, 'Reservation')
    const unsub = onSnapshot(q, async (snap) => {
      const list = []
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }))
      
      // Sort by createdAt descending (client-side to avoid index requirements)
      const toMs = (v) => (v?.toMillis ? v.toMillis() : (v?.seconds ? v.seconds * 1000 : (Date.parse(v) || 0)))
      list.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt))
      
      setBookings(list)
      setLoading(false)

      // Fetch user and listing details for all bookings
      const userIds = new Set()
      const listingIds = new Set()
      
      list.forEach(booking => {
        if (booking.guestId) userIds.add(booking.guestId)
        if (booking.hostId) userIds.add(booking.hostId)
        if (booking.listingId) listingIds.add(booking.listingId)
      })

      // Fetch user details
      const userDetailsPromises = Array.from(userIds).map(async (userId) => {
        try {
          const userRef = doc(db, 'Users', userId)
          const userSnap = await getDoc(userRef)
          if (userSnap.exists()) {
            return { userId, data: userSnap.data() }
          }
        } catch (error) {
          console.error(`Error fetching user ${userId}:`, error)
        }
        return null
      })

      // Fetch listing details
      const listingDetailsPromises = Array.from(listingIds).map(async (listingId) => {
        try {
          const listingRef = doc(db, 'Listings', listingId)
          const listingSnap = await getDoc(listingRef)
          if (listingSnap.exists()) {
            return { listingId, data: listingSnap.data() }
          }
        } catch (error) {
          console.error(`Error fetching listing ${listingId}:`, error)
        }
        return null
      })

      const userResults = await Promise.all(userDetailsPromises)
      const listingResults = await Promise.all(listingDetailsPromises)

      // Update state with fetched details
      const newUserDetails = {}
      userResults.forEach(result => {
        if (result) {
          newUserDetails[result.userId] = result.data
        }
      })

      const newListingDetails = {}
      listingResults.forEach(result => {
        if (result) {
          newListingDetails[result.listingId] = result.data
        }
      })

      setUserDetails(newUserDetails)
      setListingDetails(newListingDetails)
    })

    return () => unsub()
  }, [])

  // Register dialog polyfill
  useEffect(() => {
    if (detailsDialogRef.current && !detailsDialogRef.current.showModal) {
      dialogPolyfill.registerDialog(detailsDialogRef.current)
    }
  }, [])

  // Filter and search bookings
  const filteredBookings = useMemo(() => {
    return bookings.filter(booking => {
      // Status filter
      if (filterStatus !== 'all') {
        const bookingStatus = (booking.status || '').toLowerCase()
        if (bookingStatus !== filterStatus.toLowerCase()) {
          return false
        }
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const guestName = userDetails[booking.guestId] 
          ? `${userDetails[booking.guestId].firstName || ''} ${userDetails[booking.guestId].lastName || ''}`.toLowerCase()
          : ''
        const hostName = userDetails[booking.hostId]
          ? `${userDetails[booking.hostId].firstName || ''} ${userDetails[booking.hostId].lastName || ''}`.toLowerCase()
          : ''
        const listingTitle = listingDetails[booking.listingId]?.title || ''
        const bookingId = booking.id.toLowerCase()

        if (
          !guestName.includes(query) &&
          !hostName.includes(query) &&
          !listingTitle.toLowerCase().includes(query) &&
          !bookingId.includes(query)
        ) {
          return false
        }
      }

      return true
    })
  }, [bookings, filterStatus, searchQuery, userDetails, listingDetails])

  // Calculate statistics
  const stats = useMemo(() => {
    const total = bookings.length
    const confirmed = bookings.filter(b => (b.status || '').toLowerCase() === 'confirmed').length
    const pending = bookings.filter(b => (b.status || '').toLowerCase() === 'pending').length
    const declined = bookings.filter(b => (b.status || '').toLowerCase() === 'declined').length
    const cancelled = bookings.filter(b => (b.status || '').toLowerCase() === 'cancelled').length
    const totalRevenue = bookings
      .filter(b => (b.status || '').toLowerCase() === 'confirmed')
      .reduce((sum, b) => sum + (b.pricing?.total || b.pricing?.grandTotal || 0), 0)

    return { total, confirmed, pending, declined, cancelled, totalRevenue }
  }, [bookings])

  const handleViewDetails = (booking) => {
    setSelectedBooking(booking)
    setShowDetailsDialog(true)
    if (detailsDialogRef.current) {
      try {
        if (typeof detailsDialogRef.current.showModal === 'function') {
          detailsDialogRef.current.showModal()
        } else {
          dialogPolyfill.registerDialog(detailsDialogRef.current)
          detailsDialogRef.current.showModal()
        }
      } catch (err) {
        console.error('Error showing dialog:', err)
        detailsDialogRef.current.style.display = 'block'
      }
    }
  }

  const handleCloseDetailsDialog = () => {
    setShowDetailsDialog(false)
    detailsDialogRef.current?.close()
  }

  const handleUpdateStatus = async (bookingId, newStatus) => {
    try {
      setUpdatingStatus(bookingId)
      const bookingRef = doc(db, 'Reservation', bookingId)
      const bookingSnap = await getDoc(bookingRef)
      
      if (!bookingSnap.exists()) {
        alert('Booking not found')
        return
      }

      const bookingData = bookingSnap.data()

      // Update booking status
      await updateDoc(bookingRef, {
        status: newStatus,
        updatedAt: serverTimestamp()
      })

      // If confirmed, process payments (host gets subtotal, admin gets service fee)
      if (newStatus === 'confirmed' && bookingData.pricing) {
        const hostEarnings = bookingData.pricing.subtotal || 0 // Host gets subtotal
        // Service fee is 10% of subtotal (fallback for old bookings)
        const serviceFee = bookingData.pricing.serviceFee || Math.round(hostEarnings * 0.1)
        const hostId = bookingData.hostId

        if (hostEarnings > 0 && hostId) {
          try {
            // Get host document
            const hostRef = doc(db, 'Users', hostId)
            const hostSnap = await getDoc(hostRef)

            if (hostSnap.exists()) {
              const hostData = hostSnap.data()
              const currentEarnings = hostData.totalEarnings || 0
              const newTotalEarnings = currentEarnings + hostEarnings
              const currentPayPalBalance = hostData.paypalBalance || 0
              const newPayPalBalance = currentPayPalBalance + hostEarnings

              // Get host account ID
              const hostPayerId = hostData.paymentMethod?.payerId || null
              
              // Update host's total earnings (balance will be auto-synced by Firebase Function)
              const hostUpdateData = {
                totalEarnings: newTotalEarnings,
                updatedAt: serverTimestamp(),
              }
              
              // Store account ID if available
              if (hostPayerId) {
                hostUpdateData.paypalAccountId = hostPayerId
              }
              
              await updateDoc(hostRef, hostUpdateData)
              
              // Note: PayPal balance will be automatically synced by onHostTransactionUpdated Firebase Function
              // when the HostTransaction is created below

              // Get host PayPal email for transaction record
              const hostPayPalEmail = hostData.paymentMethod?.paypalEmail || null
              
              // Create host transaction record with account ID
              const transaction = {
                hostId,
                reservationId: bookingId,
                guestId: bookingData.guestId,
                listingId: bookingData.listingId,
                listingTitle: bookingData.listingTitle || '',
                amount: hostEarnings,
                serviceFee: serviceFee,
                guestChargedAmount: bookingData.pricing.total || (bookingData.pricing.subtotal + serviceFee),
                type: 'booking_earnings',
                status: 'completed',
                paymentMethod: bookingData.paymentSummary?.methodType || 'card',
                hostPayPalEmail: hostPayPalEmail,
                hostPayerId: hostPayerId, // Store host account ID
                balanceBefore: currentPayPalBalance,
                balanceAfter: newPayPalBalance,
                accountId: hostPayerId || null, // Account ID for balance tracking
                checkIn: bookingData.checkIn,
                checkOut: bookingData.checkOut,
                nights: bookingData.nights || 0,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              }
              await addDoc(collection(db, 'HostTransactions'), transaction)
            }
          } catch (hostError) {
            console.error('Error updating host balance:', hostError)
          }
        }

        // Add service fee to admin's PayPal balance
        if (serviceFee > 0 && authUser) {
          try {
            // Use current admin's ID directly (we're in admin panel)
            const adminId = authUser.uid
            const adminRef = doc(db, 'Users', adminId)
            const adminSnap = await getDoc(adminRef)

            if (adminSnap.exists()) {
              const adminData = adminSnap.data()
              const currentAdminBalance = adminData.paypalBalance || 0
              const currentAdminEarnings = adminData.totalEarnings || 0
              const newAdminBalance = currentAdminBalance + serviceFee
              const newAdminEarnings = currentAdminEarnings + serviceFee

              // Get admin account ID
              const adminPayerId = adminData.paymentMethod?.payerId || null
              
              // Update admin's total earnings (balance will be auto-synced by Firebase Function)
              const adminUpdateData = {
                totalEarnings: newAdminEarnings,
                updatedAt: serverTimestamp(),
              }
              
              // Store account ID if available
              if (adminPayerId) {
                adminUpdateData.paypalAccountId = adminPayerId
              }
              
              await updateDoc(adminRef, adminUpdateData)
              
              // Note: PayPal balance will be automatically synced by onAdminTransactionUpdated Firebase Function
              // when the AdminTransaction is created below
              
              // Create admin transaction record with account ID
              const adminTransaction = {
                adminId,
                reservationId: bookingId,
                hostId: bookingData.hostId,
                guestId: bookingData.guestId,
                listingId: bookingData.listingId,
                listingTitle: bookingData.listingTitle || '',
                amount: serviceFee,
                type: 'service_fee',
                status: 'completed',
                paymentMethod: bookingData.paymentSummary?.methodType || 'card',
                transactionId: bookingData.paymentSummary?.transactionId || null,
                balanceBefore: currentAdminBalance,
                balanceAfter: newAdminBalance,
                adminPayerId: adminPayerId, // Store admin account ID
                accountId: adminPayerId || null, // Account ID for balance tracking
                checkIn: bookingData.checkIn,
                checkOut: bookingData.checkOut,
                nights: bookingData.nights || 0,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              }

              await addDoc(collection(db, 'AdminTransactions'), adminTransaction)
            }
          } catch (adminError) {
            console.error('Error updating admin balance:', adminError)
          }
        } else if (serviceFee > 0 && !authUser) {
          // Fallback: fetch all users and filter if authUser is not available
          try {
            const usersSnapshot = await getDocs(collection(db, 'Users'))
            const adminDocs = usersSnapshot.docs.filter(doc => doc.data().role === 'admin')

            if (adminDocs.length > 0) {
              const adminDoc = adminDocs[0]
              const adminId = adminDoc.id
              const adminData = adminDoc.data()

              const adminRef = doc(db, 'Users', adminId)
              const currentAdminBalance = adminData.paypalBalance || 0
              const currentAdminEarnings = adminData.totalEarnings || 0
              const newAdminBalance = currentAdminBalance + serviceFee
              const newAdminEarnings = currentAdminEarnings + serviceFee

              await updateDoc(adminRef, {
                paypalBalance: newAdminBalance,
                totalEarnings: newAdminEarnings,
                paypalLastUpdated: serverTimestamp(),
                updatedAt: serverTimestamp(),
              })

              const adminTransaction = {
                adminId,
                reservationId: bookingId,
                hostId: bookingData.hostId,
                guestId: bookingData.guestId,
                listingId: bookingData.listingId,
                listingTitle: bookingData.listingTitle || '',
                amount: serviceFee,
                type: 'service_fee',
                status: 'completed',
                paymentMethod: bookingData.paymentSummary?.methodType || 'card',
                transactionId: bookingData.paymentSummary?.transactionId || null,
                balanceBefore: currentAdminBalance,
                balanceAfter: newAdminBalance,
                checkIn: bookingData.checkIn,
                checkOut: bookingData.checkOut,
                nights: bookingData.nights || 0,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              }

              await addDoc(collection(db, 'AdminTransactions'), adminTransaction)
            }
          } catch (adminError) {
            console.error('Error updating admin balance (fallback):', adminError)
          }
        }
      }

      // Create notification for guest
      if (bookingData.guestId) {
        const guestNotification = {
          type: newStatus === 'confirmed' ? 'booking_confirmed' : newStatus === 'declined' ? 'booking_declined' : 'booking_updated',
          recipientId: bookingData.guestId,
          guestId: bookingData.guestId,
          hostId: bookingData.hostId,
          reservationId: bookingId,
          listingId: bookingData.listingId,
          listingTitle: bookingData.listingTitle || '',
          title: newStatus === 'confirmed' ? 'Booking Confirmed!' : newStatus === 'declined' ? 'Booking Declined' : 'Booking Updated',
          body: newStatus === 'confirmed' 
            ? `Your booking for ${bookingData.listingTitle || 'listing'} has been confirmed by admin!`
            : newStatus === 'declined'
            ? `Your booking request for ${bookingData.listingTitle || 'listing'} has been declined by admin.`
            : `Your booking status has been updated to ${newStatus}.`,
          message: `Your booking status has been updated to ${newStatus}.`,
          read: false,
          createdAt: serverTimestamp(),
        }
        await addDoc(collection(db, 'Notifications'), guestNotification)
      }

      // Create notification for host
      if (bookingData.hostId) {
        const hostNotification = {
          type: 'booking_updated',
          recipientId: bookingData.hostId,
          guestId: bookingData.guestId,
          hostId: bookingData.hostId,
          reservationId: bookingId,
          listingId: bookingData.listingId,
          listingTitle: bookingData.listingTitle || '',
          title: 'Booking Status Updated',
          body: `Booking ${bookingId} status has been updated to ${newStatus} by admin.`,
          message: `Booking status updated to ${newStatus}.`,
          read: false,
          createdAt: serverTimestamp(),
        }
        await addDoc(collection(db, 'Notifications'), hostNotification)
      }

      alert(`Booking status updated to ${newStatus}`)
      handleCloseDetailsDialog()
    } catch (error) {
      console.error('Error updating booking status:', error)
      alert('Failed to update booking status. Please try again.')
    } finally {
      setUpdatingStatus(null)
    }
  }

  const formatDate = (date) => {
    if (!date) return 'N/A'
    const d = date?.toDate ? date.toDate() : new Date(date)
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  const formatCurrency = (amount) => {
    return `₱${(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const getStatusBadgeClass = (status) => {
    const s = (status || '').toLowerCase()
    if (s === 'confirmed') return 'status-badge confirmed'
    if (s === 'pending') return 'status-badge pending'
    if (s === 'declined') return 'status-badge declined'
    if (s === 'cancelled') return 'status-badge cancelled'
    return 'status-badge'
  }

  if (loading) {
    return (
      <div className='admin-mainContent'>
        <div style={{ padding: 40, textAlign: 'center' }}>Loading bookings...</div>
      </div>
    )
  }

  return (
    <div className='admin-mainContent'>
      <div className="admin-dashboard-header">
        <h1>Booking Management</h1>
        <p>Manage all reservations and bookings</p>
      </div>

      {/* Statistics Cards */}
      <div className="admin-kpi-grid">
        <div className="admin-kpi-card">
          <div className="admin-kpi-icon" style={{ background: '#fef3c7' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          </div>
          <div className="admin-kpi-content">
            <h3>Total Bookings</h3>
            <p className="admin-kpi-value">{stats.total}</p>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-icon" style={{ background: '#d1fae5' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <div className="admin-kpi-content">
            <h3>Confirmed</h3>
            <p className="admin-kpi-value">{stats.confirmed}</p>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-icon" style={{ background: '#fef3c7' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div className="admin-kpi-content">
            <h3>Pending</h3>
            <p className="admin-kpi-value">{stats.pending}</p>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-icon" style={{ background: '#f0fdf4' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          </div>
          <div className="admin-kpi-content">
            <h3>Total Revenue</h3>
            <p className="admin-kpi-value">{formatCurrency(stats.totalRevenue)}</p>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="admin-section-card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search by guest, host, listing, or booking ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: '1',
                minWidth: '200px',
                padding: '10px 16px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{
                padding: '10px 16px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px',
                background: 'white',
                cursor: 'pointer'
              }}
            >
              <option value="all">All Status</option>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
              <option value="declined">Declined</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bookings Table */}
      <div className="admin-section-card">
        <h3>All Bookings ({filteredBookings.length})</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '16px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Booking ID</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Guest</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Host</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Listing</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Check-in</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Check-out</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Amount</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Status</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
                    No bookings found
                  </td>
                </tr>
              ) : (
                filteredBookings.map((booking) => {
                  const guest = userDetails[booking.guestId]
                  const host = userDetails[booking.hostId]
                  const listing = listingDetails[booking.listingId]
                  
                  return (
                    <tr key={booking.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '12px', fontSize: '14px', color: '#6b7280' }}>
                        {booking.id.substring(0, 8)}...
                      </td>
                      <td style={{ padding: '12px', fontSize: '14px' }}>
                        {guest 
                          ? `${guest.firstName || ''} ${guest.lastName || ''}`.trim() || guest.emailAddress
                          : 'N/A'
                        }
                      </td>
                      <td style={{ padding: '12px', fontSize: '14px' }}>
                        {host
                          ? `${host.firstName || ''} ${host.lastName || ''}`.trim() || host.emailAddress
                          : 'N/A'
                        }
                      </td>
                      <td style={{ padding: '12px', fontSize: '14px' }}>
                        {listing?.title || booking.listingTitle || 'N/A'}
                      </td>
                      <td style={{ padding: '12px', fontSize: '14px' }}>
                        {formatDate(booking.checkIn)}
                      </td>
                      <td style={{ padding: '12px', fontSize: '14px' }}>
                        {formatDate(booking.checkOut)}
                      </td>
                      <td style={{ padding: '12px', fontSize: '14px', fontWeight: '600' }}>
                        {formatCurrency(booking.pricing?.total || booking.pricing?.grandTotal || 0)}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span className={getStatusBadgeClass(booking.status)}>
                          {(booking.status || 'unknown').toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <button
                          onClick={() => handleViewDetails(booking)}
                          style={{
                            padding: '6px 12px',
                            background: '#31326F',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '500'
                          }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Booking Details Dialog */}
      {showDetailsDialog && selectedBooking && (
        <dialog
          ref={detailsDialogRef}
          style={{
            maxWidth: '700px',
            width: '90%',
            border: 'none',
            borderRadius: '16px',
            padding: 0,
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)'
          }}
        >
          <style>
            {`.logout-confirmation-dialog::backdrop {
              background: rgba(0, 0, 0, 0.5);
              backdrop-filter: blur(4px);
            }`}
          </style>
          <div style={{ padding: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '600', color: '#1f2937' }}>
                Booking Details
              </h2>
              <button
                onClick={handleCloseDetailsDialog}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#6b7280',
                  padding: '0',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Booking Info */}
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>
                  Booking Information
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
                  <div>
                    <strong>Booking ID:</strong> {selectedBooking.id}
                  </div>
                  <div>
                    <strong>Status:</strong>{' '}
                    <span className={getStatusBadgeClass(selectedBooking.status)}>
                      {(selectedBooking.status || 'unknown').toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <strong>Check-in:</strong> {formatDate(selectedBooking.checkIn)}
                  </div>
                  <div>
                    <strong>Check-out:</strong> {formatDate(selectedBooking.checkOut)}
                  </div>
                  <div>
                    <strong>Nights:</strong> {selectedBooking.nights || 'N/A'}
                  </div>
                  <div>
                    <strong>Guests:</strong> {selectedBooking.guests || 'N/A'}
                  </div>
                  <div>
                    <strong>Created:</strong> {formatDate(selectedBooking.createdAt)}
                  </div>
                </div>
              </div>

              {/* Guest Info */}
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>
                  Guest Information
                </h3>
                {userDetails[selectedBooking.guestId] ? (
                  <div style={{ fontSize: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <strong>Name:</strong> {userDetails[selectedBooking.guestId].firstName} {userDetails[selectedBooking.guestId].lastName}
                    </div>
                    <div>
                      <strong>Email:</strong> {userDetails[selectedBooking.guestId].emailAddress}
                    </div>
                    <div>
                      <strong>Phone:</strong> {userDetails[selectedBooking.guestId].phoneNumber || 'N/A'}
                    </div>
                  </div>
                ) : (
                  <div>Loading guest information...</div>
                )}
              </div>

              {/* Host Info */}
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>
                  Host Information
                </h3>
                {userDetails[selectedBooking.hostId] ? (
                  <div style={{ fontSize: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <strong>Name:</strong> {userDetails[selectedBooking.hostId].firstName} {userDetails[selectedBooking.hostId].lastName}
                    </div>
                    <div>
                      <strong>Email:</strong> {userDetails[selectedBooking.hostId].emailAddress}
                    </div>
                    <div>
                      <strong>Phone:</strong> {userDetails[selectedBooking.hostId].phoneNumber || 'N/A'}
                    </div>
                  </div>
                ) : (
                  <div>Loading host information...</div>
                )}
              </div>

              {/* Listing Info */}
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>
                  Listing Information
                </h3>
                {listingDetails[selectedBooking.listingId] ? (
                  <div style={{ fontSize: '14px' }}>
                    <div style={{ marginBottom: '8px' }}>
                      <strong>Title:</strong> {listingDetails[selectedBooking.listingId].title}
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <strong>Location:</strong> {listingDetails[selectedBooking.listingId].location || 'N/A'}
                    </div>
                    <div>
                      <strong>Price per night:</strong> {formatCurrency(listingDetails[selectedBooking.listingId].price || 0)}
                    </div>
                  </div>
                ) : (
                  <div>Loading listing information...</div>
                )}
              </div>

              {/* Pricing Info */}
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>
                  Pricing Information
                </h3>
                <div style={{ fontSize: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <strong>Subtotal:</strong> {formatCurrency(selectedBooking.pricing?.subtotal || 0)}
                  </div>
                  <div>
                    <strong>Service Fee:</strong> {formatCurrency(selectedBooking.pricing?.serviceFee || 0)}
                  </div>
                  <div>
                    <strong>Total:</strong> {formatCurrency(selectedBooking.pricing?.total || selectedBooking.pricing?.grandTotal || 0)}
                  </div>
                  <div>
                    <strong>Payment Method:</strong> {selectedBooking.paymentSummary?.methodType || 'N/A'}
                  </div>
                </div>
              </div>

              {/* Status Update */}
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>
                  Update Status
                </h3>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {['pending', 'confirmed', 'declined', 'cancelled'].map((status) => (
                    <button
                      key={status}
                      onClick={() => handleUpdateStatus(selectedBooking.id, status)}
                      disabled={updatingStatus === selectedBooking.id || (selectedBooking.status || '').toLowerCase() === status.toLowerCase()}
                      style={{
                        padding: '8px 16px',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: updatingStatus === selectedBooking.id ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: '500',
                        background: (selectedBooking.status || '').toLowerCase() === status.toLowerCase() 
                          ? '#31326F' 
                          : '#f3f4f6',
                        color: (selectedBooking.status || '').toLowerCase() === status.toLowerCase()
                          ? 'white'
                          : '#374151',
                        opacity: updatingStatus === selectedBooking.id ? 0.6 : 1
                      }}
                    >
                      {updatingStatus === selectedBooking.id && status === selectedBooking.status ? 'Updating...' : status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={handleCloseDetailsDialog}
                style={{
                  padding: '10px 24px',
                  background: '#31326F',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </dialog>
      )}
    </div>
  )
}

export default AdminBookings

