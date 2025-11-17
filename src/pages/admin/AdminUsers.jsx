import React, { useEffect, useState, useMemo } from 'react'
import { collection, onSnapshot, doc, updateDoc, getDoc, setDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore'
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
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [deletingUser, setDeletingUser] = useState(null)
  const [editFormData, setEditFormData] = useState({})
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [filterRole, setFilterRole] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [updatingRole, setUpdatingRole] = useState(null)
  const [userStats, setUserStats] = useState({}) // Cache for user statistics
  const detailsDialogRef = React.useRef(null)
  const editDialogRef = React.useRef(null)
  const deleteDialogRef = React.useRef(null)

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
    if (editDialogRef.current && !editDialogRef.current.showModal) {
      dialogPolyfill.registerDialog(editDialogRef.current)
    }
    if (deleteDialogRef.current && !deleteDialogRef.current.showModal) {
      dialogPolyfill.registerDialog(deleteDialogRef.current)
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

  const handleEdit = (user) => {
    setEditingUser(user)
    setEditFormData({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      middleName: user.middleName || '',
      emailAddress: user.emailAddress || '',
      phoneNumber: user.phoneNumber || '',
      birthday: user.birthday ? (user.birthday?.toDate ? user.birthday.toDate().toISOString().split('T')[0] : new Date(user.birthday).toISOString().split('T')[0]) : '',
      street: user.street || '',
      barangay: user.barangay || '',
      city: user.city || '',
      province: user.province || '',
      zipCode: user.zipCode || ''
    })
    setShowEditDialog(true)
    if (editDialogRef.current) {
      try {
        if (typeof editDialogRef.current.showModal === 'function') {
          editDialogRef.current.showModal()
        } else {
          dialogPolyfill.registerDialog(editDialogRef.current)
          editDialogRef.current.showModal()
        }
      } catch (err) {
        console.error('Error showing edit dialog:', err)
        editDialogRef.current.style.display = 'block'
      }
    }
  }

  const handleCloseEditDialog = () => {
    setShowEditDialog(false)
    setEditingUser(null)
    setEditFormData({})
    editDialogRef.current?.close()
  }

  const handleSaveEdit = async () => {
    if (!editingUser) return
    
    try {
      setIsSaving(true)
      const userRef = doc(db, 'Users', editingUser.id)
      const updateData = {
        ...editFormData,
        updatedAt: serverTimestamp()
      }

      // Convert birthday string back to timestamp if provided
      if (updateData.birthday) {
        updateData.birthday = Timestamp.fromDate(new Date(updateData.birthday))
      } else {
        // Remove birthday from updateData if it's empty
        delete updateData.birthday
      }

      await updateDoc(userRef, updateData)
      alert('User information updated successfully!')
      handleCloseEditDialog()
    } catch (error) {
      console.error('Error updating user:', error)
      alert('Failed to update user. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = (user) => {
    setDeletingUser(user)
    setShowDeleteDialog(true)
    if (deleteDialogRef.current) {
      try {
        if (typeof deleteDialogRef.current.showModal === 'function') {
          deleteDialogRef.current.showModal()
        } else {
          dialogPolyfill.registerDialog(deleteDialogRef.current)
          deleteDialogRef.current.showModal()
        }
      } catch (err) {
        console.error('Error showing delete dialog:', err)
        deleteDialogRef.current.style.display = 'block'
      }
    }
  }

  const handleCloseDeleteDialog = () => {
    setShowDeleteDialog(false)
    setDeletingUser(null)
    deleteDialogRef.current?.close()
  }

  const handleConfirmDelete = async () => {
    if (!deletingUser) return
    
    try {
      setIsDeleting(true)
      const userRef = doc(db, 'Users', deletingUser.id)
      await deleteDoc(userRef)
      alert('User deleted successfully!')
      handleCloseDeleteDialog()
    } catch (error) {
      console.error('Error deleting user:', error)
      alert('Failed to delete user. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleUpdateRole = async (userId, newRole) => {
    try {
      setUpdatingRole(userId)
      const userRef = doc(db, 'Users', userId)
      const userSnap = await getDoc(userRef)
      
      const updateData = {
        role: newRole,
        updatedAt: serverTimestamp()
      }

      // ✅ Add default 700 points when role is changed to 'host' (if user doesn't already have points)
      if (newRole === 'host') {
        const userData = userSnap.exists() ? userSnap.data() : {}
        const currentPoints = userData.loyaltyPoints || userData.points || 0
        
        // Only add default points if user has no points or very low points (less than 10)
        if (currentPoints < 10) {
          updateData.loyaltyPoints = 700
          updateData.points = 700 // Legacy support
          updateData.lifetimeLoyaltyPoints = 700
          updateData.lifetimePoints = 700 // Legacy support
        }
        
        // Create Host record if it doesn't exist
        const hostRef = doc(db, 'Host', userId)
        const hostSnap = await getDoc(hostRef)
        if (!hostSnap.exists()) {
          await setDoc(hostRef, { userId: userId })
        }
      }
      
      await updateDoc(userRef, updateData)

      alert(`User role updated to ${newRole}${newRole === 'host' && updateData.loyaltyPoints ? ' (700 points added)' : ''}`)
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
          {/* Search Bar */}
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
              Search Users
            </label>
            <input
              type="text"
              placeholder="Search by name, email, phone, or user ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px',
                transition: 'all 0.2s ease'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#31326F'
                e.target.style.boxShadow = '0 0 0 3px rgba(49, 50, 111, 0.1)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e5e7eb'
                e.target.style.boxShadow = 'none'
              }}
            />
          </div>

          {/* Quick Filter Buttons */}
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
              Filter by Role
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setFilterRole('all')}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  background: filterRole === 'all' ? '#31326F' : '#f3f4f6',
                  color: filterRole === 'all' ? 'white' : '#374151',
                  boxShadow: filterRole === 'all' ? '0 2px 8px rgba(49, 50, 111, 0.3)' : 'none'
                }}
                onMouseEnter={(e) => {
                  if (filterRole !== 'all') {
                    e.target.style.background = '#e5e7eb'
                  }
                }}
                onMouseLeave={(e) => {
                  if (filterRole !== 'all') {
                    e.target.style.background = '#f3f4f6'
                  }
                }}
              >
                All Users ({stats.total})
              </button>
              <button
                onClick={() => setFilterRole('host')}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  background: filterRole === 'host' ? '#10b981' : '#f3f4f6',
                  color: filterRole === 'host' ? 'white' : '#374151',
                  boxShadow: filterRole === 'host' ? '0 2px 8px rgba(16, 185, 129, 0.3)' : 'none'
                }}
                onMouseEnter={(e) => {
                  if (filterRole !== 'host') {
                    e.target.style.background = '#e5e7eb'
                  }
                }}
                onMouseLeave={(e) => {
                  if (filterRole !== 'host') {
                    e.target.style.background = '#f3f4f6'
                  }
                }}
              >
                Hosts ({stats.hosts})
              </button>
              <button
                onClick={() => setFilterRole('guest')}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  background: filterRole === 'guest' ? '#f59e0b' : '#f3f4f6',
                  color: filterRole === 'guest' ? 'white' : '#374151',
                  boxShadow: filterRole === 'guest' ? '0 2px 8px rgba(245, 158, 11, 0.3)' : 'none'
                }}
                onMouseEnter={(e) => {
                  if (filterRole !== 'guest') {
                    e.target.style.background = '#e5e7eb'
                  }
                }}
                onMouseLeave={(e) => {
                  if (filterRole !== 'guest') {
                    e.target.style.background = '#f3f4f6'
                  }
                }}
              >
                Guests ({stats.guests})
              </button>
              <button
                onClick={() => setFilterRole('admin')}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  background: filterRole === 'admin' ? '#6b7280' : '#f3f4f6',
                  color: filterRole === 'admin' ? 'white' : '#374151',
                  boxShadow: filterRole === 'admin' ? '0 2px 8px rgba(107, 114, 128, 0.3)' : 'none'
                }}
                onMouseEnter={(e) => {
                  if (filterRole !== 'admin') {
                    e.target.style.background = '#e5e7eb'
                  }
                }}
                onMouseLeave={(e) => {
                  if (filterRole !== 'admin') {
                    e.target.style.background = '#f3f4f6'
                  }
                }}
              >
                Admins ({stats.admins})
              </button>
            </div>
          </div>

          {/* Active Filter Indicator */}
          {filterRole !== 'all' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '6px',
              fontSize: '14px',
              color: '#1e40af'
            }}>
              <span>Filtering by:</span>
              <span style={{ fontWeight: '600', textTransform: 'capitalize' }}>{filterRole}</span>
              <button
                onClick={() => setFilterRole('all')}
                style={{
                  marginLeft: 'auto',
                  background: 'none',
                  border: 'none',
                  color: '#1e40af',
                  cursor: 'pointer',
                  fontSize: '14px',
                  textDecoration: 'underline',
                  padding: '0'
                }}
              >
                Clear filter
              </button>
            </div>
          )}
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
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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
                          <button
                            onClick={() => handleEdit(user)}
                            style={{
                              padding: '6px 12px',
                              background: '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '14px',
                              fontWeight: '500'
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(user)}
                            style={{
                              padding: '6px 12px',
                              background: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '14px',
                              fontWeight: '500'
                            }}
                          >
                            Delete
                          </button>
                        </div>
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

      {/* Edit User Dialog */}
      {showEditDialog && editingUser && (
        <dialog
          ref={editDialogRef}
          style={{
            maxWidth: '600px',
            width: '90%',
            border: 'none',
            borderRadius: '16px',
            padding: 0,
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)'
          }}
        >
          <style>
            {`.edit-user-dialog::backdrop {
              background: rgba(0, 0, 0, 0.5);
              backdrop-filter: blur(4px);
            }`}
          </style>
          <div style={{ padding: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '600', color: '#1f2937' }}>
                Edit User
              </h2>
              <button
                onClick={handleCloseEditDialog}
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    First Name
                  </label>
                  <input
                    type="text"
                    value={editFormData.firstName || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={editFormData.lastName || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Middle Name
                  </label>
                  <input
                    type="text"
                    value={editFormData.middleName || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, middleName: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={editFormData.emailAddress || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, emailAddress: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={editFormData.phoneNumber || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, phoneNumber: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Birthday
                  </label>
                  <input
                    type="date"
                    value={editFormData.birthday || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, birthday: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Street
                  </label>
                  <input
                    type="text"
                    value={editFormData.street || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, street: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Barangay
                  </label>
                  <input
                    type="text"
                    value={editFormData.barangay || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, barangay: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    City
                  </label>
                  <input
                    type="text"
                    value={editFormData.city || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Province
                  </label>
                  <input
                    type="text"
                    value={editFormData.province || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, province: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Zip Code
                  </label>
                  <input
                    type="text"
                    value={editFormData.zipCode || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, zipCode: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>
            </div>

            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={handleCloseEditDialog}
                disabled={isSaving}
                style={{
                  padding: '10px 24px',
                  background: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  opacity: isSaving ? 0.6 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSaving}
                style={{
                  padding: '10px 24px',
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  opacity: isSaving ? 0.6 : 1
                }}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </dialog>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && deletingUser && (
        <dialog
          ref={deleteDialogRef}
          style={{
            maxWidth: '500px',
            width: '90%',
            border: 'none',
            borderRadius: '16px',
            padding: 0,
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)'
          }}
        >
          <style>
            {`.delete-user-dialog::backdrop {
              background: rgba(0, 0, 0, 0.5);
              backdrop-filter: blur(4px);
            }`}
          </style>
          <div style={{ padding: '30px' }}>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '600', color: '#1f2937', marginBottom: '12px' }}>
                Delete User
              </h2>
              <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
                Are you sure you want to delete this user? This action cannot be undone.
              </p>
            </div>

            <div style={{ 
              background: '#fef2f2', 
              border: '1px solid #fecaca', 
              borderRadius: '8px', 
              padding: '16px', 
              marginBottom: '24px' 
            }}>
              <div style={{ fontSize: '14px', color: '#374151' }}>
                <div><strong>Name:</strong> {`${deletingUser.firstName || ''} ${deletingUser.lastName || ''}`.trim() || 'N/A'}</div>
                <div><strong>Email:</strong> {deletingUser.emailAddress || 'N/A'}</div>
                <div><strong>Role:</strong> {(deletingUser.role || 'unknown').toUpperCase()}</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={handleCloseDeleteDialog}
                disabled={isDeleting}
                style={{
                  padding: '10px 24px',
                  background: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  opacity: isDeleting ? 0.6 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                style={{
                  padding: '10px 24px',
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  opacity: isDeleting ? 0.6 : 1
                }}
              >
                {isDeleting ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </dialog>
      )}
    </div>
  )
}

export default AdminUsers

