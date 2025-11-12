import React, { useEffect, useState, useMemo } from 'react'
import { collection, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../config/firebase'
import './admin-dashboard.css'
import 'dialog-polyfill/dist/dialog-polyfill.css'
import dialogPolyfill from 'dialog-polyfill'

const AdminUsers = () => {
  const [users, setUsers] = useState([])
  const [bookings, setBookings] = useState([])
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState(null)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [filterRole, setFilterRole] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [updatingRole, setUpdatingRole] = useState(null)
  const [userStats, setUserStats] = useState({}) // Cache for user statistics
  const detailsDialogRef = React.useRef(null)

  // Fetch all users
  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'Users'), (snap) => {
      const list = []
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }))
      
      // Sort by createdAt descending (client-side)
      const toMs = (v) => (v?.toMillis ? v.toMillis() : (v?.seconds ? v.seconds * 1000 : (Date.parse(v) || 0)))
      list.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt))
      
      setUsers(list)
      setLoading(false)
    })

    // Fetch bookings and listings for statistics
    const unsubBookings = onSnapshot(collection(db, 'Reservation'), (snap) => {
      const list = []
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }))
      setBookings(list)
    })

    const unsubListings = onSnapshot(collection(db, 'Listings'), (snap) => {
      const list = []
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }))
      setListings(list)
    })

    return () => {
      unsubUsers()
      unsubBookings()
      unsubListings()
    }
  }, [])

  // Calculate user statistics from bookings and listings data (optimized)
  useEffect(() => {
    if (users.length === 0 || (bookings.length === 0 && listings.length === 0)) {
      return
    }

    const stats = {}
    
    users.forEach(user => {
      if (user.role === 'guest') {
        // Count bookings for guests
        const guestBookings = bookings.filter(b => b.guestId === user.id)
        stats[user.id] = {
          bookingsCount: guestBookings.length,
          listingsCount: 0
        }
      } else if (user.role === 'host') {
        // Count listings and bookings for hosts
        const hostListings = listings.filter(l => l.hostId === user.id)
        const hostBookings = bookings.filter(b => b.hostId === user.id)
        stats[user.id] = {
          listingsCount: hostListings.length,
          bookingsCount: hostBookings.length
        }
      } else if (user.role === 'admin') {
        // Admin has no specific stats
        stats[user.id] = {
          listingsCount: 0,
          bookingsCount: 0
        }
      } else {
        stats[user.id] = {
          listingsCount: 0,
          bookingsCount: 0
        }
      }
    })
    
    setUserStats(stats)
  }, [users, bookings, listings])

  // Register dialog polyfill
  useEffect(() => {
    if (detailsDialogRef.current && !detailsDialogRef.current.showModal) {
      dialogPolyfill.registerDialog(detailsDialogRef.current)
    }
  }, [])

  // Filter and search users
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      // Role filter
      if (filterRole !== 'all') {
        const userRole = (user.role || '').toLowerCase()
        if (userRole !== filterRole.toLowerCase()) {
          return false
        }
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const fullName = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase()
        const email = (user.emailAddress || '').toLowerCase()
        const phone = (user.phoneNumber || '').toLowerCase()
        const userId = user.id.toLowerCase()

        if (
          !fullName.includes(query) &&
          !email.includes(query) &&
          !phone.includes(query) &&
          !userId.includes(query)
        ) {
          return false
        }
      }

      return true
    })
  }, [users, filterRole, searchQuery])

  // Calculate statistics
  const stats = useMemo(() => {
    const total = users.length
    const hosts = users.filter(u => (u.role || '').toLowerCase() === 'host').length
    const guests = users.filter(u => (u.role || '').toLowerCase() === 'guest').length
    const admins = users.filter(u => (u.role || '').toLowerCase() === 'admin').length

    return { total, hosts, guests, admins }
  }, [users])

  const handleViewDetails = (user) => {
    setSelectedUser(user)
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

  const handleUpdateRole = async (userId, newRole) => {
    try {
      setUpdatingRole(userId)
      const userRef = doc(db, 'Users', userId)
      
      await updateDoc(userRef, {
        role: newRole,
        updatedAt: serverTimestamp()
      })

      alert(`User role updated to ${newRole}`)
      handleCloseDetailsDialog()
    } catch (error) {
      console.error('Error updating user role:', error)
      alert('Failed to update user role. Please try again.')
    } finally {
      setUpdatingRole(null)
    }
  }

  const formatDate = (date) => {
    if (!date) return 'N/A'
    const d = date?.toDate ? date.toDate() : new Date(date)
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  const formatCurrency = (amount) => {
    return `₱${(parseFloat(amount) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const getRoleBadgeClass = (role) => {
    const r = (role || '').toLowerCase()
    if (r === 'admin') return 'status-badge cancelled' // Gray
    if (r === 'host') return 'status-badge confirmed' // Green
    if (r === 'guest') return 'status-badge pending' // Yellow
    return 'status-badge'
  }

  if (loading) {
    return (
      <div className='admin-mainContent'>
        <div style={{ padding: 40, textAlign: 'center' }}>Loading users...</div>
      </div>
    )
  }

  return (
    <div className='admin-mainContent'>
      <div className="admin-dashboard-header">
        <h1>User Management</h1>
        <p>Manage all users and their accounts</p>
      </div>

      {/* Statistics Cards */}
      <div className="admin-kpi-grid">
        <div className="admin-kpi-card">
          <div className="admin-kpi-icon" style={{ background: '#e8f0ff' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <div className="admin-kpi-content">
            <h3>Total Users</h3>
            <p className="admin-kpi-value">{stats.total}</p>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-icon" style={{ background: '#d1fae5' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
          </div>
          <div className="admin-kpi-content">
            <h3>Hosts</h3>
            <p className="admin-kpi-value">{stats.hosts}</p>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-icon" style={{ background: '#fef3c7' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
          <div className="admin-kpi-content">
            <h3>Guests</h3>
            <p className="admin-kpi-value">{stats.guests}</p>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-icon" style={{ background: '#f3f4f6' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <div className="admin-kpi-content">
            <h3>Admins</h3>
            <p className="admin-kpi-value">{stats.admins}</p>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="admin-section-card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search by name, email, phone, or user ID..."
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
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              style={{
                padding: '10px 16px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px',
                background: 'white',
                cursor: 'pointer'
              }}
            >
              <option value="all">All Roles</option>
              <option value="host">Hosts</option>
              <option value="guest">Guests</option>
              <option value="admin">Admins</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="admin-section-card">
        <h3>All Users ({filteredUsers.length})</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '16px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>User ID</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Name</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Email</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Phone</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Role</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Activity</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Created</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
                    No users found
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const stats = userStats[user.id] || { listingsCount: 0, bookingsCount: 0 }
                  
                  return (
                    <tr key={user.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '12px', fontSize: '14px', color: '#6b7280' }}>
                        {user.id.substring(0, 8)}...
                      </td>
                      <td style={{ padding: '12px', fontSize: '14px' }}>
                        {`${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A'}
                      </td>
                      <td style={{ padding: '12px', fontSize: '14px' }}>
                        {user.emailAddress || 'N/A'}
                      </td>
                      <td style={{ padding: '12px', fontSize: '14px' }}>
                        {user.phoneNumber || 'N/A'}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span className={getRoleBadgeClass(user.role)}>
                          {(user.role || 'unknown').toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '12px', fontSize: '14px' }}>
                        {user.role === 'host' && (
                          <span>{stats.listingsCount} listings, {stats.bookingsCount} bookings</span>
                        )}
                        {user.role === 'guest' && (
                          <span>{stats.bookingsCount} bookings</span>
                        )}
                        {user.role === 'admin' && (
                          <span>-</span>
                        )}
                      </td>
                      <td style={{ padding: '12px', fontSize: '14px' }}>
                        {formatDate(user.createdAt)}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <button
                          onClick={() => handleViewDetails(user)}
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

      {/* User Details Dialog */}
      {showDetailsDialog && selectedUser && (
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
                User Details
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
              {/* Basic Info */}
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>
                  Basic Information
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
                  <div>
                    <strong>User ID:</strong> {selectedUser.id}
                  </div>
                  <div>
                    <strong>Role:</strong>{' '}
                    <span className={getRoleBadgeClass(selectedUser.role)}>
                      {(selectedUser.role || 'unknown').toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <strong>First Name:</strong> {selectedUser.firstName || 'N/A'}
                  </div>
                  <div>
                    <strong>Last Name:</strong> {selectedUser.lastName || 'N/A'}
                  </div>
                  <div>
                    <strong>Middle Name:</strong> {selectedUser.middleName || 'N/A'}
                  </div>
                  <div>
                    <strong>Email:</strong> {selectedUser.emailAddress || 'N/A'}
                  </div>
                  <div>
                    <strong>Phone:</strong> {selectedUser.phoneNumber || 'N/A'}
                  </div>
                  <div>
                    <strong>Birthday:</strong> {formatDate(selectedUser.birthday)}
                  </div>
                  <div>
                    <strong>Created:</strong> {formatDate(selectedUser.createdAt)}
                  </div>
                </div>
              </div>

              {/* Address Info */}
              {(selectedUser.street || selectedUser.city || selectedUser.province) && (
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>
                    Address Information
                  </h3>
                  <div style={{ fontSize: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <strong>Street:</strong> {selectedUser.street || 'N/A'}
                    </div>
                    <div>
                      <strong>Barangay:</strong> {selectedUser.barangay || 'N/A'}
                    </div>
                    <div>
                      <strong>City:</strong> {selectedUser.city || 'N/A'}
                    </div>
                    <div>
                      <strong>Province:</strong> {selectedUser.province || 'N/A'}
                    </div>
                    <div>
                      <strong>Zip Code:</strong> {selectedUser.zipCode || 'N/A'}
                    </div>
                  </div>
                </div>
              )}

              {/* Host Specific Info */}
              {selectedUser.role === 'host' && (
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>
                    Host Information
                  </h3>
                  <div style={{ fontSize: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <strong>Total Earnings:</strong> {formatCurrency(selectedUser.totalEarnings || 0)}
                    </div>
                    <div>
                      <strong>PayPal Balance:</strong> {formatCurrency(selectedUser.paypalBalance || 0)}
                    </div>
                    <div>
                      <strong>PayPal Email:</strong> {selectedUser.paymentMethod?.paypalEmail || 'N/A'}
                    </div>
                    <div>
                      <strong>Listings:</strong> {userStats[selectedUser.id]?.listingsCount || 0}
                    </div>
                    <div>
                      <strong>Bookings:</strong> {userStats[selectedUser.id]?.bookingsCount || 0}
                    </div>
                  </div>
                </div>
              )}

              {/* Guest Specific Info */}
              {selectedUser.role === 'guest' && (
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>
                    Guest Information
                  </h3>
                  <div style={{ fontSize: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <strong>Total Bookings:</strong> {userStats[selectedUser.id]?.bookingsCount || 0}
                    </div>
                    <div>
                      <strong>Favourites:</strong> {selectedUser.favourites?.length || 0}
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Method Info */}
              {selectedUser.paymentMethod && (
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>
                    Payment Method
                  </h3>
                  <div style={{ fontSize: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <strong>Type:</strong> {selectedUser.paymentMethod.type || 'N/A'}
                    </div>
                    {selectedUser.paymentMethod.paypalEmail && (
                      <div>
                        <strong>PayPal Email:</strong> {selectedUser.paymentMethod.paypalEmail}
                      </div>
                    )}
                    {selectedUser.paymentMethod.payerId && (
                      <div>
                        <strong>PayPal ID:</strong> {selectedUser.paymentMethod.payerId}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Role Update */}
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>
                  Update Role
                </h3>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {['host', 'guest', 'admin'].map((role) => (
                    <button
                      key={role}
                      onClick={() => handleUpdateRole(selectedUser.id, role)}
                      disabled={updatingRole === selectedUser.id || (selectedUser.role || '').toLowerCase() === role.toLowerCase()}
                      style={{
                        padding: '8px 16px',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: updatingRole === selectedUser.id ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: '500',
                        background: (selectedUser.role || '').toLowerCase() === role.toLowerCase() 
                          ? '#31326F' 
                          : '#f3f4f6',
                        color: (selectedUser.role || '').toLowerCase() === role.toLowerCase()
                          ? 'white'
                          : '#374151',
                        opacity: updatingRole === selectedUser.id ? 0.6 : 1
                      }}
                    >
                      {updatingRole === selectedUser.id && role === selectedUser.role ? 'Updating...' : role.charAt(0).toUpperCase() + role.slice(1)}
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

export default AdminUsers

