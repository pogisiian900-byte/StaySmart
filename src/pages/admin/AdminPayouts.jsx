import React, { useEffect, useState, useMemo } from 'react'
import { collection, onSnapshot, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db, processPayPalPayout } from '../../config/firebase'
import './admin-dashboard.css'
import 'dialog-polyfill/dist/dialog-polyfill.css'
import dialogPolyfill from 'dialog-polyfill'

const AdminPayouts = () => {
  const [payouts, setPayouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPayout, setSelectedPayout] = useState(null)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [userDetails, setUserDetails] = useState({}) // Cache for host details
  const [processingRetry, setProcessingRetry] = useState(null)
  const detailsDialogRef = React.useRef(null)

  // Fetch all payouts
  useEffect(() => {
    const unsubPayouts = onSnapshot(collection(db, 'PayPalPayouts'), async (snap) => {
      const list = []
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }))
      
      // Sort by createdAt descending (client-side)
      const toMs = (v) => (v?.toMillis ? v.toMillis() : (v?.seconds ? v.seconds * 1000 : (Date.parse(v) || 0)))
      list.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt))
      
      setPayouts(list)

      // Fetch host details for all payouts
      const userIds = new Set()
      list.forEach(payout => {
        if (payout.hostId) userIds.add(payout.hostId)
      })

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

      const userResults = await Promise.all(userDetailsPromises)
      const newUserDetails = {}
      userResults.forEach(result => {
        if (result) {
          newUserDetails[result.userId] = result.data
        }
      })
      setUserDetails(newUserDetails)
      setLoading(false)
    })

    return () => {
      unsubPayouts()
    }
  }, [])

  // Register dialog polyfill
  useEffect(() => {
    if (detailsDialogRef.current && !detailsDialogRef.current.showModal) {
      dialogPolyfill.registerDialog(detailsDialogRef.current)
    }
  }, [])

  // Filter and search payouts
  const filteredPayouts = useMemo(() => {
    return payouts.filter(payout => {
      // Status filter
      if (filterStatus !== 'all') {
        const payoutStatus = (payout.status || '').toLowerCase()
        if (payoutStatus !== filterStatus.toLowerCase()) {
          return false
        }
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const hostName = userDetails[payout.hostId]
          ? `${userDetails[payout.hostId].firstName || ''} ${userDetails[payout.hostId].lastName || ''}`.toLowerCase()
          : ''
        const hostEmail = userDetails[payout.hostId]?.emailAddress || ''
        const payoutId = payout.id.toLowerCase()
        const batchId = payout.payoutBatchId || ''

        if (
          !hostName.includes(query) &&
          !hostEmail.toLowerCase().includes(query) &&
          !payoutId.includes(query) &&
          !batchId.toLowerCase().includes(query) &&
          !(payout.hostPayPalEmail || '').toLowerCase().includes(query)
        ) {
          return false
        }
      }

      return true
    })
  }, [payouts, filterStatus, searchQuery, userDetails])

  // Calculate statistics
  const stats = useMemo(() => {
    const total = payouts.length
    const pending = payouts.filter(p => (p.status || '').toLowerCase() === 'pending' || (p.status || '').toLowerCase() === 'processing').length
    const completed = payouts.filter(p => (p.status || '').toLowerCase() === 'completed' || (p.status || '').toLowerCase() === 'success').length
    const failed = payouts.filter(p => (p.status || '').toLowerCase() === 'failed').length
    
    const totalAmount = payouts.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
    const pendingAmount = payouts
      .filter(p => (p.status || '').toLowerCase() === 'pending' || (p.status || '').toLowerCase() === 'processing')
      .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
    const completedAmount = payouts
      .filter(p => (p.status || '').toLowerCase() === 'completed' || (p.status || '').toLowerCase() === 'success')
      .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
    const failedAmount = payouts
      .filter(p => (p.status || '').toLowerCase() === 'failed')
      .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)

    return { 
      total, 
      pending, 
      completed, 
      failed, 
      totalAmount, 
      pendingAmount, 
      completedAmount, 
      failedAmount 
    }
  }, [payouts])

  const handleViewDetails = (payout) => {
    setSelectedPayout(payout)
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

  const handleRetryPayout = async (payoutId) => {
    try {
      setProcessingRetry(payoutId)
      const payoutRef = doc(db, 'PayPalPayouts', payoutId)
      const payoutSnap = await getDoc(payoutRef)
      
      if (!payoutSnap.exists()) {
        alert('Payout not found')
        return
      }

      const payoutData = payoutSnap.data()

      // Update status to pending
      await updateDoc(payoutRef, {
        status: 'pending',
        error: null,
        updatedAt: serverTimestamp()
      })

      // Retry PayPal payout
      try {
        const payoutResult = await processPayPalPayout({
          payoutId: payoutId,
          hostPayPalEmail: payoutData.hostPayPalEmail || '',
          payerId: payoutData.payerId || null,
          amount: payoutData.amount.toString(),
          currency: payoutData.currency || 'PHP',
        })

        // Update payout record with result
        await updateDoc(payoutRef, {
          payoutBatchId: payoutResult.data.payoutBatchId,
          status: payoutResult.data.status === 'PENDING' ? 'processing' : payoutResult.data.status.toLowerCase(),
          processedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })

        alert(`Payout retry successful! Batch ID: ${payoutResult.data.payoutBatchId}`)
        handleCloseDetailsDialog()
      } catch (payoutError) {
        console.error('PayPal payout retry error:', payoutError)
        await updateDoc(payoutRef, {
          status: 'failed',
          error: payoutError.message || 'Payout processing failed',
          updatedAt: serverTimestamp(),
        })
        alert(`Payout retry failed: ${payoutError.message || 'Please try again.'}`)
      }
    } catch (error) {
      console.error('Error retrying payout:', error)
      alert('Failed to retry payout. Please try again.')
    } finally {
      setProcessingRetry(null)
    }
  }

  const formatDate = (date) => {
    if (!date) return 'N/A'
    const d = date?.toDate ? date.toDate() : new Date(date)
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const formatCurrency = (amount) => {
    return `₱${(parseFloat(amount) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const getStatusBadgeClass = (status) => {
    const s = (status || '').toLowerCase()
    if (s === 'completed' || s === 'success') return 'status-badge confirmed'
    if (s === 'pending' || s === 'processing') return 'status-badge pending'
    if (s === 'failed') return 'status-badge declined'
    return 'status-badge'
  }

  if (loading) {
    return (
      <div className='admin-mainContent'>
        <div style={{ padding: 40, textAlign: 'center' }}>Loading payouts...</div>
      </div>
    )
  }

  return (
    <div className='admin-mainContent'>
      <div className="admin-dashboard-header">
        <h1>Payout Control</h1>
        <p>Manage all host payouts and transactions</p>
      </div>

      {/* Statistics Cards */}
      <div className="admin-kpi-grid">
        <div className="admin-kpi-card">
          <div className="admin-kpi-icon" style={{ background: '#fef3c7' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          </div>
          <div className="admin-kpi-content">
            <h3>Total Payouts</h3>
            <p className="admin-kpi-value">{stats.total}</p>
            <p className="admin-kpi-change">Total: {formatCurrency(stats.totalAmount)}</p>
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
            <p className="admin-kpi-change">Amount: {formatCurrency(stats.pendingAmount)}</p>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-icon" style={{ background: '#d1fae5' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <div className="admin-kpi-content">
            <h3>Completed</h3>
            <p className="admin-kpi-value">{stats.completed}</p>
            <p className="admin-kpi-change">Amount: {formatCurrency(stats.completedAmount)}</p>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-icon" style={{ background: '#fee2e2' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
          </div>
          <div className="admin-kpi-content">
            <h3>Failed</h3>
            <p className="admin-kpi-value">{stats.failed}</p>
            <p className="admin-kpi-change">Amount: {formatCurrency(stats.failedAmount)}</p>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="admin-section-card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search by host name, email, PayPal email, payout ID, or batch ID..."
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
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Payouts Table */}
      <div className="admin-section-card">
        <h3>All Payouts ({filteredPayouts.length})</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '16px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Payout ID</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Host</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>PayPal Email</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Amount</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Status</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Batch ID</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Created</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayouts.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
                    No payouts found
                  </td>
                </tr>
              ) : (
                filteredPayouts.map((payout) => {
                  const host = userDetails[payout.hostId]
                  
                  return (
                    <tr key={payout.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '12px', fontSize: '14px', color: '#6b7280' }}>
                        {payout.id.substring(0, 8)}...
                      </td>
                      <td style={{ padding: '12px', fontSize: '14px' }}>
                        {host 
                          ? `${host.firstName || ''} ${host.lastName || ''}`.trim() || host.emailAddress
                          : 'N/A'
                        }
                      </td>
                      <td style={{ padding: '12px', fontSize: '14px' }}>
                        {payout.hostPayPalEmail || 'N/A'}
                      </td>
                      <td style={{ padding: '12px', fontSize: '14px', fontWeight: '600' }}>
                        {formatCurrency(payout.amount)}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span className={getStatusBadgeClass(payout.status)}>
                          {(payout.status || 'unknown').toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '12px', fontSize: '14px', color: '#6b7280' }}>
                        {payout.payoutBatchId || 'N/A'}
                      </td>
                      <td style={{ padding: '12px', fontSize: '14px' }}>
                        {formatDate(payout.createdAt)}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <button
                          onClick={() => handleViewDetails(payout)}
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

      {/* Payout Details Dialog */}
      {showDetailsDialog && selectedPayout && (
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
                Payout Details
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
              {/* Payout Info */}
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>
                  Payout Information
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
                  <div>
                    <strong>Payout ID:</strong> {selectedPayout.id}
                  </div>
                  <div>
                    <strong>Status:</strong>{' '}
                    <span className={getStatusBadgeClass(selectedPayout.status)}>
                      {(selectedPayout.status || 'unknown').toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <strong>Amount:</strong> {formatCurrency(selectedPayout.amount)}
                  </div>
                  <div>
                    <strong>Currency:</strong> {selectedPayout.currency || 'PHP'}
                  </div>
                  <div>
                    <strong>Type:</strong> {selectedPayout.type || 'N/A'}
                  </div>
                  <div>
                    <strong>Created:</strong> {formatDate(selectedPayout.createdAt)}
                  </div>
                  {selectedPayout.processedAt && (
                    <div>
                      <strong>Processed:</strong> {formatDate(selectedPayout.processedAt)}
                    </div>
                  )}
                  {selectedPayout.payoutBatchId && (
                    <div>
                      <strong>PayPal Batch ID:</strong> {selectedPayout.payoutBatchId}
                    </div>
                  )}
                </div>
              </div>

              {/* Host Info */}
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>
                  Host Information
                </h3>
                {userDetails[selectedPayout.hostId] ? (
                  <div style={{ fontSize: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <strong>Name:</strong> {userDetails[selectedPayout.hostId].firstName} {userDetails[selectedPayout.hostId].lastName}
                    </div>
                    <div>
                      <strong>Email:</strong> {userDetails[selectedPayout.hostId].emailAddress}
                    </div>
                    <div>
                      <strong>PayPal Email:</strong> {selectedPayout.hostPayPalEmail || 'N/A'}
                    </div>
                    <div>
                      <strong>PayPal ID:</strong> {selectedPayout.payerId || 'N/A'}
                    </div>
                  </div>
                ) : (
                  <div>Loading host information...</div>
                )}
              </div>

              {/* Reservation Info */}
              {selectedPayout.reservationId && (
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>
                    Reservation Information
                  </h3>
                  <div style={{ fontSize: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <strong>Reservation ID:</strong> {selectedPayout.reservationId}
                    </div>
                    <div>
                      <strong>Transaction ID:</strong> {selectedPayout.transactionId || 'N/A'}
                    </div>
                    <div>
                      <strong>Guest Payment Method:</strong> {selectedPayout.guestPaymentMethod || 'N/A'}
                    </div>
                  </div>
                </div>
              )}

              {/* Error Info */}
              {selectedPayout.error && (
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>
                    Error Information
                  </h3>
                  <div style={{ 
                    padding: '12px', 
                    background: '#fee2e2', 
                    borderRadius: '8px', 
                    color: '#991b1b',
                    fontSize: '14px'
                  }}>
                    {selectedPayout.error}
                  </div>
                </div>
              )}

              {/* Retry Button for Failed Payouts */}
              {(selectedPayout.status || '').toLowerCase() === 'failed' && (
                <div>
                  <button
                    onClick={() => handleRetryPayout(selectedPayout.id)}
                    disabled={processingRetry === selectedPayout.id}
                    style={{
                      padding: '10px 24px',
                      background: processingRetry === selectedPayout.id ? '#9ca3af' : '#31326F',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: processingRetry === selectedPayout.id ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                      width: '100%'
                    }}
                  >
                    {processingRetry === selectedPayout.id ? 'Retrying...' : 'Retry Payout'}
                  </button>
                </div>
              )}
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

export default AdminPayouts

