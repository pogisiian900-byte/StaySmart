import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { collection, onSnapshot, orderBy, query, where, updateDoc, doc, serverTimestamp, addDoc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import ContinuousCalendar from '../../components/ContinuousCalendar'
import Guest_Logged_Navigation from './guest-navigation-logged'
import './guest-bookingConfirmation.css'
import '../booking-responsive.css'

const GuestBookings = () => {
  const { guestId } = useParams()
  const navigate = useNavigate()
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedReservation, setSelectedReservation] = useState(null)
  const [processingRefund, setProcessingRefund] = useState(false)

  useEffect(() => {
    if (!guestId) return
    const q = query(
      collection(db, 'Reservation'),
      where('guestId', '==', guestId)
    )
    const unsub = onSnapshot(q, (snap) => {
      const list = []
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }))
      // Sort client-side by createdAt desc to avoid composite index requirement
      const toMs = (v) => (v?.toMillis ? v.toMillis() : (v?.seconds ? v.seconds * 1000 : (Date.parse(v) || 0)))
      list.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt))
      setReservations(list)
      setLoading(false)
    })
    return () => unsub()
  }, [guestId])

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

  const handleCalendarClick = (day, month, year) => {
    const d = new Date(year, month - 1, day)
    setSelectedDate(d)
  }

  const handleRequestRefund = async () => {
    if (!selectedReservation) return

    const status = (selectedReservation.status || '').toLowerCase()
    if (status !== 'confirmed' && status !== 'pending') {
      alert('Refunds can only be requested for confirmed or pending reservations.')
      return
    }

    const checkInDate = new Date(selectedReservation.checkIn)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    checkInDate.setHours(0, 0, 0, 0)

    // Check if check-in date has passed
    if (checkInDate < today) {
      alert('Refunds cannot be requested for reservations that have already started.')
      return
    }

    const confirmRefund = window.confirm(
      `Are you sure you want to request a refund for this reservation?\n\n` +
      `Listing: ${selectedReservation.listingTitle}\n` +
      `Amount: ₱${selectedReservation?.pricing?.total || 0}\n\n` +
      `The refund will be processed and your reservation will be cancelled.`
    )

    if (!confirmRefund) return

    try {
      setProcessingRefund(true)
      const reservationRef = doc(db, 'Reservation', selectedReservation.id)

      // Update reservation status to refunded
      await updateDoc(reservationRef, {
        status: 'refunded',
        refundRequestedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })

      // Create refund record
      const refundRecord = {
        reservationId: selectedReservation.id,
        guestId: guestId,
        hostId: selectedReservation.hostId,
        listingId: selectedReservation.listingId,
        listingTitle: selectedReservation.listingTitle,
        amount: selectedReservation?.pricing?.total || 0,
        currency: selectedReservation?.pricing?.currency || 'PHP',
        paymentMethod: selectedReservation?.paymentSummary?.methodType || 'unknown',
        transactionId: selectedReservation?.paymentSummary?.transactionId || null,
        status: 'pending',
        requestedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      }

      await addDoc(collection(db, 'Refunds'), refundRecord)

      // Create notification for host
      if (selectedReservation.hostId) {
        const notification = {
          type: 'refund_requested',
          recipientId: selectedReservation.hostId, // Fixed: Use recipientId instead of hostId for query matching
          hostId: selectedReservation.hostId,
          guestId: guestId,
          reservationId: selectedReservation.id,
          listingId: selectedReservation.listingId,
          title: 'Refund Requested',
          body: `Guest has requested a refund for reservation: ${selectedReservation.listingTitle}. Amount: ₱${selectedReservation?.pricing?.total || 0}`,
          message: `Guest has requested a refund for reservation: ${selectedReservation.listingTitle}.`,
          read: false,
          createdAt: serverTimestamp()
        }
        await addDoc(collection(db, 'Notifications'), notification)
      }

      alert('Refund request submitted successfully! Your reservation has been cancelled and the refund is being processed.')
      setSelectedReservation(null)
    } catch (error) {
      console.error('Error processing refund:', error)
      alert('Failed to process refund request. Please try again.')
    } finally {
      setProcessingRefund(false)
    }
  }

  if (loading) {
    return <div style={{ padding: 20 }}>Loading your bookings...</div>
  }

  return (
    <>
      {/* Back Button */}
      <div style={{ padding: '20px 20px 0 20px' }}>
        <button className="back-btn" onClick={() => navigate(`/guest/${guestId}`)} title="Go back">
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
          <span className="back-btn-text">Back</span>
        </button>
      </div>
    <div className="bookings-layout">
      <div>
        <div className="bookings-header">
          <div>
            <h2 className="bookings-title">Your Reservations</h2>
            <p className="bookings-subtext">Manage and review your stays</p>
          </div>
          <div className="status-legend" style={{ display:'flex', gap:8, alignItems:'center' }}>
            <span className="status-badge status-pending">Pending</span>
            <span className="status-badge status-confirmed">Confirmed</span>
            <span className="status-badge status-declined">Declined</span>
          </div>
        </div>
        {filtered.length === 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 20px',
            textAlign: 'center',
            background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
            borderRadius: '16px',
            border: '2px dashed #d1d5db',
            margin: '20px 0'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              background: 'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
            </div>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              color: '#374151',
              margin: '0 0 8px 0'
            }}>
              {selectedDate ? `No reservations on ${selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}` : 'No reservations found'}
            </h3>
            <p style={{
              fontSize: '0.95rem',
              color: '#6b7280',
              margin: 0,
              maxWidth: '400px'
            }}>
              {selectedDate ? 'You don\'t have any reservations scheduled for this date. Try selecting a different date from the calendar.' : 'You don\'t have any reservations yet. Start exploring listings and book your next stay!'}
            </p>
          </div>
        )}
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
                  <div className="booking-meta">Total: ₱{r?.pricing?.total || 0}</div>
                  <div>
                    <span className={`status-badge status-${(r.status||'').toLowerCase()}`}>{r.status}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <ContinuousCalendar 
          onClick={handleCalendarClick} 
          bookedDates={bookedDates} 
          selectedDate={selectedDate}
          onBack={() => navigate(`/guest/${guestId}`)}
        />
        {selectedDate && (
          <div style={{ marginTop: 8, color: '#666' }}>Selected: {selectedDate.toDateString()}</div>
        )}
        <div style={{ marginTop: 12, fontSize: 12, color: '#999' }}>
          Dates with reservations are highlighted internally; click a date to filter.
        </div>
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
                  {selectedReservation?.paymentSummary?.transactionId && (
                    <div style={{ marginTop: 4 }}><b>Transaction ID:</b> {selectedReservation.paymentSummary.transactionId}</div>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              {(selectedReservation.status?.toLowerCase() === 'confirmed' || selectedReservation.status?.toLowerCase() === 'pending') && (
                <button 
                  className="btn btn-danger" 
                  onClick={handleRequestRefund}
                  disabled={processingRefund}
                  style={{ 
                    cursor: processingRefund ? 'not-allowed' : 'pointer',
                    opacity: processingRefund ? 0.6 : 1
                  }}
                >
                  {processingRefund ? 'Processing...' : 'Request Refund'}
                </button>
              )}
              <button className="btn btn-ghost" onClick={() => setSelectedReservation(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
      </>
  )
}

export default GuestBookings


