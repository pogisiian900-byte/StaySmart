import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { collection, onSnapshot, orderBy, query, updateDoc, where, doc, serverTimestamp, getDoc, addDoc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { processPayPalPayout } from '../../config/firebase'
import ContinuousCalendar from '../../components/ContinuousCalendar'
import { createOrGetConversation } from '../for-all/messages/createOrGetConversation'
import 'dialog-polyfill/dist/dialog-polyfill.css'
import dialogPolyfill from 'dialog-polyfill'

const HostBookings = () => {
  const { hostId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(null)
  const [updating, setUpdating] = useState(null)
  const [selectedReservation, setSelectedReservation] = useState(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [reservationToConfirm, setReservationToConfirm] = useState(null)
  const [hostPayPalInfo, setHostPayPalInfo] = useState(null)
  const confirmDialogRef = React.useRef(null)

  // Read date from URL params on mount
  useEffect(() => {
    const dateParam = searchParams.get('date')
    if (dateParam) {
      // Parse date string as local date (YYYY-MM-DD format)
      const [year, month, day] = dateParam.split('-').map(Number)
      if (year && month && day) {
        const date = new Date(year, month - 1, day)
        date.setHours(0, 0, 0, 0) // Ensure midnight in local time
        if (!isNaN(date.getTime())) {
          setSelectedDate(date)
        }
      }
    }
  }, [searchParams])

  useEffect(() => {
    if (!hostId) return
    const q = query(
      collection(db, 'Reservation'),
      where('hostId', '==', hostId)
    )
    const unsub = onSnapshot(q, (snap) => {
      const list = []
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }))
      // Sort client-side by createdAt desc
      const toMs = (v) => (v?.toMillis ? v.toMillis() : (v?.seconds ? v.seconds * 1000 : (Date.parse(v) || 0)))
      list.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt))
      setReservations(list)
      setLoading(false)
    })
    return () => unsub()
  }, [hostId])

  const handleMessageGuest = async () => {
    if (!selectedReservation?.guestId) {
      alert('Guest information not available')
      return
    }
    try {
      const conversationId = await createOrGetConversation(hostId, selectedReservation.guestId)
      navigate(`/host/${hostId}/chat/${conversationId}`)
    } catch (error) {
      console.error('Error creating conversation:', error)
      alert('Failed to start conversation. Please try again.')
    }
  }

  // Register dialog polyfill
  useEffect(() => {
    if (confirmDialogRef.current && !confirmDialogRef.current.showModal) {
      dialogPolyfill.registerDialog(confirmDialogRef.current)
    }
  }, [])

  const showConfirmBookingDialog = async (reservation) => {
    setReservationToConfirm(reservation)
    setShowConfirmDialog(true)
    
    // Fetch host PayPal info
    try {
      const hostRef = doc(db, 'Users', hostId)
      const hostSnap = await getDoc(hostRef)
      if (hostSnap.exists()) {
        const hostData = hostSnap.data()
        setHostPayPalInfo({
          paypalEmail: hostData.paymentMethod?.paypalEmail || null,
          payerId: hostData.paymentMethod?.payerId || null,
        })
      }
    } catch (error) {
      console.error('Error fetching host PayPal info:', error)
    }
    
    setTimeout(() => {
      if (confirmDialogRef.current) {
        try {
          if (typeof confirmDialogRef.current.showModal === 'function') {
            confirmDialogRef.current.showModal()
          } else {
            dialogPolyfill.registerDialog(confirmDialogRef.current)
            confirmDialogRef.current.showModal()
          }
        } catch (err) {
          console.error('Error showing confirm dialog:', err)
          confirmDialogRef.current.style.display = 'block'
        }
      }
    }, 50)
  }

  const handleCloseConfirmDialog = () => {
    setShowConfirmDialog(false)
    confirmDialogRef.current?.close()
    setReservationToConfirm(null)
    setHostPayPalInfo(null)
  }

  const handleConfirmBooking = async () => {
    if (!reservationToConfirm) return
    handleCloseConfirmDialog()
    await handleDecision(reservationToConfirm.id, 'confirmed')
  }

  const handleDecision = async (id, status) => {
    try {
      setUpdating(id)
      
      // Get reservation details
      const reservationRef = doc(db, 'Reservation', id)
      const reservationSnap = await getDoc(reservationRef)
      
      if (!reservationSnap.exists()) {
        alert('Reservation not found')
        return
      }

      const reservationData = reservationSnap.data()
      
      // Update reservation status
      await updateDoc(reservationRef, {
        status,
        updatedAt: serverTimestamp(),
      })

      // If confirmed, credit the amount to host
      if (status === 'confirmed' && reservationData.pricing) {
        const hostEarnings = reservationData.pricing.subtotal || 0 // Host gets subtotal (excluding service fee)
        
        if (hostEarnings > 0 && hostId) {
          // Get host document
          const hostRef = doc(db, 'Users', hostId)
          const hostSnap = await getDoc(hostRef)
          
          if (hostSnap.exists()) {
            const hostData = hostSnap.data()
            const currentEarnings = hostData.totalEarnings || 0
            const newTotalEarnings = currentEarnings + hostEarnings
            
            // Get host's PayPal email for payout
            const hostPayPalEmail = hostData.paymentMethod?.paypalEmail || null
            const hostPayerId = hostData.paymentMethod?.payerId || null
            const paymentMethod = reservationData.paymentSummary?.methodType || 'card'
            
            // Update host's total earnings
            await updateDoc(hostRef, {
              totalEarnings: newTotalEarnings,
              updatedAt: serverTimestamp(),
            })

            // Create transaction record with payment details
            const transaction = {
              hostId,
              reservationId: id,
              guestId: reservationData.guestId,
              listingId: reservationData.listingId,
              listingTitle: reservationData.listingTitle || '',
              amount: hostEarnings,
              type: 'booking_earnings',
              status: 'completed',
              paymentMethod: paymentMethod,
              guestPayPalEmail: reservationData.paymentSummary?.paypalEmail || null,
              hostPayPalEmail: hostPayPalEmail,
              payoutStatus: hostPayPalEmail ? 'pending_payout' : 'manual_payout_required',
              checkIn: reservationData.checkIn,
              checkOut: reservationData.checkOut,
              nights: reservationData.nights || 0,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }

            await addDoc(collection(db, 'HostTransactions'), transaction)
            
            // If host has PayPal email or payerId, create payout record and process immediately
            if (hostPayPalEmail || hostPayerId) {
              // Create payout record that will be processed
              const payoutRecord = {
                hostId,
                hostPayPalEmail: hostPayPalEmail || null,
                payerId: hostPayerId || null,
                reservationId: id,
                transactionId: reservationData.paymentSummary?.transactionId || null,
                amount: hostEarnings,
                currency: 'PHP',
                status: 'pending',
                type: 'booking_payout',
                guestPaymentMethod: paymentMethod,
                guestPayPalEmail: reservationData.paymentSummary?.paypalEmail || null,
                createdAt: serverTimestamp(),
              }
              
              // Add payout record to Firestore
              const payoutRef = await addDoc(collection(db, 'PayPalPayouts'), payoutRecord)
              const payoutId = payoutRef.id
              
              // Immediately process PayPal payout via Cloud Function
              let payoutResult = null
              try {
                console.log(`Processing PayPal payout: ₱${hostEarnings} to ${hostPayPalEmail || 'PAYER_ID: ' + hostPayerId}`)
                
                payoutResult = await processPayPalPayout({
                  payoutId: payoutId,
                  hostPayPalEmail: hostPayPalEmail || '',
                  payerId: hostPayerId || null,
                  amount: hostEarnings.toString(),
                  currency: 'PHP',
                })

                // Update payout record with result
                await updateDoc(payoutRef, {
                  payoutBatchId: payoutResult.data.payoutBatchId,
                  status: payoutResult.data.status === 'PENDING' ? 'processing' : payoutResult.data.status.toLowerCase(),
                  processedAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                })

                console.log(`PayPal payout successful: ${payoutResult.data.payoutBatchId}`)
                
                // Update notification with success message including all payment details
                const notification = {
                  type: 'earnings_credited',
                  hostId,
                  reservationId: id,
                  title: 'Earnings Credited & Payment Sent',
                  body: `₱${hostEarnings.toLocaleString()} has been sent to your PayPal account.\n\nPayment Details:\nPayPal Email: ${hostPayPalEmail}\nPayPal ID: ${hostData.paymentMethod?.payerId || 'N/A'}\nPayout Batch ID: ${payoutResult.data.payoutBatchId}\nTransaction ID: ${reservationData.paymentSummary?.transactionId || 'N/A'}`,
                  read: false,
                  createdAt: serverTimestamp(),
                }
                await addDoc(collection(db, 'Notifications'), notification)
                
                // Show detailed success alert
                alert(`Reservation confirmed successfully!\n\nPayment Details:\nPayPal Email: ${hostPayPalEmail}\nPayPal ID: ${hostData.paymentMethod?.payerId || 'N/A'}\nPayout Batch ID: ${payoutResult.data.payoutBatchId}\nTransaction ID: ${reservationData.paymentSummary?.transactionId || 'N/A'}\n\nAmount: ₱${hostEarnings.toLocaleString()}`)
              } catch (payoutError) {
                console.error('PayPal payout error:', payoutError)
                
                // Update payout record with error status
                await updateDoc(payoutRef, {
                  status: 'failed',
                  error: payoutError.message || 'Payout processing failed',
                  updatedAt: serverTimestamp(),
                })

                // Still create notification but with error message
                const notification = {
                  type: 'earnings_credited',
                  hostId,
                  reservationId: id,
                  title: 'Earnings Credited - Payout Pending',
                  body: `₱${hostEarnings.toLocaleString()} has been credited to your account. PayPal payout failed: ${payoutError.message || 'Please contact support'}.\n\nTransaction ID: ${reservationData.paymentSummary?.transactionId || 'N/A'}`,
                  read: false,
                  createdAt: serverTimestamp(),
                }
                await addDoc(collection(db, 'Notifications'), notification)
                
                alert(`Reservation confirmed successfully!\n\nPayment Details:\nPayPal Email: ${hostPayPalEmail}\nPayPal ID: ${hostData.paymentMethod?.payerId || 'N/A'}\nTransaction ID: ${reservationData.paymentSummary?.transactionId || 'N/A'}\n\nAmount: ₱${hostEarnings.toLocaleString()}\n\nNote: PayPal payout failed. Please contact support.`)
              }
            } else {
              // No PayPal email - create notification for manual payout
              const notification = {
                type: 'earnings_credited',
                hostId,
                reservationId: id,
                title: 'Earnings Credited',
                body: `₱${hostEarnings.toLocaleString()} has been credited to your account for booking ${reservationData.listingTitle || 'reservation'}. Manual payout required - please add your PayPal email in profile.\n\nTransaction ID: ${reservationData.paymentSummary?.transactionId || 'N/A'}`,
                read: false,
                createdAt: serverTimestamp(),
              }
              await addDoc(collection(db, 'Notifications'), notification)
              
              alert(`Reservation confirmed successfully!\n\nEarnings: ₱${hostEarnings.toLocaleString()}\nTransaction ID: ${reservationData.paymentSummary?.transactionId || 'N/A'}\n\nNote: Please add your PayPal email in profile to receive payments.`)
            }
          }
        }
      }

      // Only show generic alert if status is not 'confirmed' (already shown specific alerts above)
      if (status !== 'confirmed') {
        alert(`Reservation ${status} successfully!`)
      }
    } catch (e) {
      console.error('Failed to update reservation:', e)
      alert('Failed to update reservation. Please try again.')
    } finally {
      setUpdating(null)
    }
  }

  const filtered = useMemo(() => {
    if (!selectedDate) return reservations
    // Normalize selected date to midnight for comparison using date components
    const selected = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate())
    
    return reservations.filter((r) => {
      if (!r.checkIn || !r.checkOut) return false
      
      // Normalize dates to midnight local time using date components
      const startDate = new Date(r.checkIn)
      const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
      
      const endDate = new Date(r.checkOut)
      const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())
      // Exclude check-out date (guests check out on this day)
      
      return selected >= start && selected < end
    })
  }, [reservations, selectedDate])

  const bookedDates = useMemo(() => {
    const priority = { Pending: 3, Confirmed: 2, Declined: 1 }
    const map = {}
    reservations.forEach((r) => {
      if (!r.checkIn || !r.checkOut) return
      
      // Normalize dates to midnight local time using date components
      const startDate = new Date(r.checkIn)
      const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
      
      const endDate = new Date(r.checkOut)
      const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())
      // Note: end date is exclusive (check-out day is not included)
      
      const label = (r.status || '').toString().toLowerCase()
      const statusLabel = label.charAt(0).toUpperCase() + label.slice(1) || 'Booked'
      const score = priority[statusLabel] || 0
      const dayMs = 86400000
      
      // Loop from check-in to day before check-out (inclusive)
      for (let t = start.getTime(); t < end.getTime(); t += dayMs) {
        const d = new Date(t)
        const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
        const existing = map[key]
        if (!existing || (priority[existing] || 0) < score) {
          map[key] = statusLabel
        }
      }
    })
    return map
  }, [reservations])

  const handleCalendarClick = (day, month, year) => {
    const d = new Date(year, month - 1, day)
    d.setHours(0, 0, 0, 0) // Ensure midnight in local time
    setSelectedDate(d)
    // Update URL params when date is selected via calendar
    // Use local date components to avoid timezone issues
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    setSearchParams({ date: dateStr })
  }

  if (loading) return <div style={{ padding: 20 }}>Loading reservations...</div>

  return (
    <>
    <br />
      <button onClick={() => navigate(`/host/${hostId}`)} className="back-btn">
        <span className="back-btn-arrow">❮</span>
      </button>
    <div className="bookings-layout">
      <div>
        <div className="bookings-header">
          <div>
            <h2 className="bookings-title">Incoming Reservations</h2>
            <p className="bookings-subtext">Review and manage guest requests</p>
          </div>
          <div className="status-legend" style={{ display:'flex', gap:8, alignItems:'center' }}>
            <span className="status-badge status-pending">Pending</span>
            <span className="status-badge status-confirmed">Confirmed</span>
            <span className="status-badge status-declined">Declined</span>
          </div>
        </div>
        {filtered.length === 0 && (<div style={{ padding: 12, color: '#666' }}>No reservations{selectedDate ? ' on selected date' : ''}.</div>)}
        <div className="booking-list">
          {filtered.map((r) => (
            <div key={r.id} className="booking-card" onClick={() => setSelectedReservation(r)} style={{ cursor: 'pointer' }}>
              <div className="booking-row">
                {r.listingThumbnail && (
                  <img src={r.listingThumbnail} alt={r.listingTitle} className="booking-thumb" />
                )}
                <div className="booking-content">
                  <div className="booking-title">{r.listingTitle || 'Listing'}</div>
                  <div className="booking-meta">
                    {new Date(r.checkIn).toLocaleDateString()} — {new Date(r.checkOut).toLocaleDateString()} • {r.nights} nights
                  </div>
                  <div className="booking-meta">Guest message: {r.guestMessage || '—'}</div>
                  <div className="booking-meta">Total: ₱{r?.pricing?.total || 0}</div>
                  <div>
                    <span className={`status-badge status-${(r.status||'').toLowerCase()}`}>{r.status}</span>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, color: '#666' }}>Click to Check</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h3 style={{ margin: '0 0 12px 0' }}>Calendar</h3>
        <ContinuousCalendar 
          onClick={handleCalendarClick} 
          bookedDates={bookedDates} 
          selectedDate={selectedDate}
          onBack={() => navigate(`/host/${hostId}`)}
        />
        {selectedDate && (
          <div style={{ marginTop: 8, color: '#666' }}>Selected: {selectedDate.toDateString()}</div>
        )}
      </div>
      {selectedReservation && (
        <div role="dialog" aria-modal="true" className="modal-overlay" onClick={() => setSelectedReservation(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{selectedReservation.listingTitle || 'Reservation Details'}</h3>
              <button className="btn btn-ghost" onClick={() => setSelectedReservation(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', gap: 12 }}>
                {selectedReservation.listingThumbnail && (
                  <img src={selectedReservation.listingThumbnail} alt={selectedReservation.listingTitle} style={{ width: 160, height: 120, objectFit: 'cover', borderRadius: 8 }} />
                )}
                <div style={{ flex: 1, fontSize: 14, display:'flex', flexDirection:'column', gap:6 }}>
                  <div><b>Check-in:</b> {new Date(selectedReservation.checkIn).toLocaleString()}</div>
                  <div><b>Check-out:</b> {new Date(selectedReservation.checkOut).toLocaleString()}</div>
                  <div><b>Nights:</b> {selectedReservation.nights}</div>
                  <div>
                    <b>Status:</b> <span className={`status-badge status-${(selectedReservation.status||'').toLowerCase()}`}>{selectedReservation.status}</span>
                  </div>
                  <div><b>Total:</b> ₱{selectedReservation?.pricing?.total || 0}</div>
                  {selectedReservation.guestMessage && (
                    <div style={{ marginTop: 4 }}><b>Message:</b> {selectedReservation.guestMessage}</div>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ justifyContent:'space-between' }}>
              <button className="btn btn-ghost" onClick={() => setSelectedReservation(null)}>Close</button>
              <div style={{ display:'flex', gap:8 }}>
                <button 
                  className="btn btn-secondary" 
                  onClick={handleMessageGuest}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    background: '#4a90e2',
                    color: 'white',
                    border: 'none'
                  }}
                >
                  <span>💬</span>
                  Message Guest
                </button>
                <button className="btn btn-primary" disabled={updating===selectedReservation.id || selectedReservation.status!=='pending'} onClick={() => showConfirmBookingDialog(selectedReservation)}>Confirm</button>
                <button className="btn btn-danger" disabled={updating===selectedReservation.id || selectedReservation.status!=='pending'} onClick={() => handleDecision(selectedReservation.id, 'declined')}>Decline</button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Confirmation Dialog */}
      <dialog ref={confirmDialogRef} className="confirm-booking-dialog-host" style={{ maxWidth: '500px', width: '90%', border: 'none', borderRadius: '16px', padding: 0, boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)' }}>
        <style>{`
          .confirm-booking-dialog-host::backdrop {
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(4px);
          }
        `}</style>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            padding: '32px 24px 24px', 
            position: 'relative',
            background: 'linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)',
            borderRadius: '16px 16px 0 0'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              background: '#3b82f6',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              marginBottom: '16px'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1f2937', margin: '0 0 8px 0', textAlign: 'center' }}>
              Confirm Booking
            </h3>
            <button 
              onClick={handleCloseConfirmDialog} 
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'rgba(255, 255, 255, 0.8)',
                border: 'none',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#6b7280'
              }}
            >
              ✕
            </button>
          </div>
          <div style={{ padding: '24px' }}>
            {reservationToConfirm && (
              <>
                <p style={{ fontSize: '1.1rem', color: '#4b5563', marginBottom: '20px', textAlign: 'center' }}>
                  Are you sure you want to confirm this booking?
                </p>
                <div style={{ 
                  background: '#f9fafb', 
                  borderRadius: '12px', 
                  padding: '20px', 
                  border: '1px solid #e5e7eb',
                  marginBottom: '20px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ color: '#6b7280', fontWeight: 500 }}>Listing:</span>
                    <span style={{ color: '#1f2937', fontWeight: 600 }}>{reservationToConfirm.listingTitle || 'N/A'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ color: '#6b7280', fontWeight: 500 }}>Earnings:</span>
                    <span style={{ color: '#3b82f6', fontWeight: 700, fontSize: '1.2rem' }}>₱{((reservationToConfirm?.pricing?.subtotal || 0).toLocaleString())}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ color: '#6b7280', fontWeight: 500 }}>Nights:</span>
                    <span style={{ color: '#1f2937', fontWeight: 600 }}>{reservationToConfirm.nights || 0} night(s)</span>
                  </div>
                  {hostPayPalInfo?.paypalEmail && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ color: '#6b7280', fontWeight: 500 }}>PayPal Email:</span>
                      <span style={{ color: '#1f2937', fontWeight: 600 }}>{hostPayPalInfo.paypalEmail}</span>
                    </div>
                  )}
                  {hostPayPalInfo?.payerId && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ color: '#6b7280', fontWeight: 500 }}>PayPal ID:</span>
                      <span style={{ color: '#1f2937', fontWeight: 600, fontSize: '0.9rem', wordBreak: 'break-all', textAlign: 'right' }}>{hostPayPalInfo.payerId}</span>
                    </div>
                  )}
                  {reservationToConfirm.paymentSummary?.transactionId && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                      <span style={{ color: '#6b7280', fontWeight: 500 }}>Transaction ID:</span>
                      <span style={{ color: '#1f2937', fontWeight: 600, fontSize: '0.9rem', wordBreak: 'break-all' }}>{reservationToConfirm.paymentSummary.transactionId}</span>
                    </div>
                  )}
                </div>
                <p style={{ fontSize: '0.9rem', color: '#6b7280', textAlign: 'center', marginBottom: '20px' }}>
                  {hostPayPalInfo?.paypalEmail 
                    ? `Payment will be sent to your PayPal account (${hostPayPalInfo.paypalEmail}) once confirmed.`
                    : 'Please add your PayPal email in profile to receive payments.'}
                </p>
              </>
            )}
          </div>
          <div style={{ padding: '20px 24px 24px', display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #f3f4f6' }}>
            <button 
              onClick={handleCloseConfirmDialog}
              style={{
                background: '#f3f4f6',
                color: '#4b5563',
                border: 'none',
                borderRadius: '10px',
                padding: '12px 24px',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button 
              onClick={handleConfirmBooking}
              disabled={updating === reservationToConfirm?.id}
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                padding: '12px 28px',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
              }}
            >
              {updating === reservationToConfirm?.id ? 'Processing...' : 'Yes, Confirm Booking'}
            </button>
          </div>
        </div>
      </dialog>
    </div>
      </>
  )
}

export default HostBookings


