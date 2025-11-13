import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { collection, onSnapshot, orderBy, query, where, updateDoc, doc, serverTimestamp, addDoc, getDoc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import ContinuousCalendar from '../../components/ContinuousCalendar'
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
  const [showCompleteDialog, setShowCompleteDialog] = useState(false)
  const [processingComplete, setProcessingComplete] = useState(false)
  const [feedback, setFeedback] = useState({
    rating: 0,
    serviceThoughts: '',
    improvements: ''
  })
  const [hoveredRating, setHoveredRating] = useState(0)
  const [showCompleted, setShowCompleted] = useState(false)
  const [hostInfo, setHostInfo] = useState(null) // Store host information for selected reservation

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

  // Fetch host information when reservation is selected
  useEffect(() => {
    const fetchHostInfo = async () => {
      if (!selectedReservation?.hostId) {
        setHostInfo(null)
        return
      }
      
      try {
        const hostRef = doc(db, 'Users', selectedReservation.hostId)
        const hostSnap = await getDoc(hostRef)
        
        if (hostSnap.exists()) {
          setHostInfo(hostSnap.data())
        } else {
          setHostInfo(null)
        }
      } catch (error) {
        console.error('Error fetching host info:', error)
        setHostInfo(null)
      }
    }
    
    fetchHostInfo()
  }, [selectedReservation])

  const bookedDates = useMemo(() => {
    const priority = { Pending: 3, Confirmed: 2, Declined: 1 }
    const map = {}
    reservations.forEach((r) => {
      // Skip completed bookings
      const status = (r.status || '').toLowerCase()
      if (status === 'completed') return
      
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
    // Filter based on showCompleted toggle
    let filteredReservations = reservations
    if (!showCompleted) {
      // Filter out completed bookings when showing active
      filteredReservations = reservations.filter((r) => {
        const status = (r.status || '').toLowerCase()
        return status !== 'completed'
      })
    } else {
      // Show only completed bookings
      filteredReservations = reservations.filter((r) => {
        const status = (r.status || '').toLowerCase()
        return status === 'completed'
      })
    }

    if (!selectedDate) return filteredReservations
    // Normalize selected date to midnight for comparison using date components
    const selected = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate())
    
    return filteredReservations.filter((r) => {
      if (!r.checkIn || !r.checkOut) return false
      
      // Normalize dates to midnight local time using date components
      const startDate = new Date(r.checkIn)
      const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
      
      const endDate = new Date(r.checkOut)
      const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())
      // Exclude check-out date (guests check out on this day)
      
      return selected >= start && selected < end
    })
  }, [reservations, selectedDate, showCompleted])

  const handleCalendarClick = (day, month, year) => {
    const d = new Date(year, month - 1, day)
    setSelectedDate(d)
  }

  // Check if booking is confirmed (for complete button)
  const isBookingConfirmed = (reservation) => {
    if (!reservation) return false
    const status = (reservation.status || '').toLowerCase()
    return status === 'confirmed'
  }

  const handleCompleteBooking = async () => {
    if (!selectedReservation) return

    try {
      setProcessingComplete(true)
      const reservationRef = doc(db, 'Reservation', selectedReservation.id)

      // Update reservation status to completed
      await updateDoc(reservationRef, {
        status: 'completed',
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })

      // Save feedback to Wishlist collection
      const wishlistEntry = {
        guestId: guestId,
        reservationId: selectedReservation.id,
        listingId: selectedReservation.listingId,
        listingTitle: selectedReservation.listingTitle,
        hostId: selectedReservation.hostId,
        rating: feedback.rating || 0,
        serviceThoughts: feedback.serviceThoughts || '',
        improvements: feedback.improvements || '',
        checkIn: selectedReservation.checkIn,
        checkOut: selectedReservation.checkOut,
        totalAmount: selectedReservation?.pricing?.total || 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }

      await addDoc(collection(db, 'Wishlist'), wishlistEntry)

      alert('Booking completed successfully! Thank you for your feedback. It has been removed from your active reservations.')
      setShowCompleteDialog(false)
      setSelectedReservation(null)
      // Reset feedback form
      setFeedback({
        rating: 0,
        serviceThoughts: '',
        improvements: ''
      })
      setHoveredRating(0)
    } catch (error) {
      console.error('Error completing booking:', error)
      alert('Failed to complete booking. Please try again.')
    } finally {
      setProcessingComplete(false)
    }
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
      `Your refund request will be sent to the host for approval.`
    )

    if (!confirmRefund) return

    try {
      setProcessingRefund(true)
      const reservationRef = doc(db, 'Reservation', selectedReservation.id)

      // Update reservation status to refund_pending (waiting for host approval)
      await updateDoc(reservationRef, {
        status: 'refund_pending',
        refundRequestedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })

      // Create refund record with pending status
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
        status: 'refund_pending',
        requestedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      }

      const refundRef = await addDoc(collection(db, 'Refunds'), refundRecord)

      // Create notification for host
      if (selectedReservation.hostId) {
        const notification = {
          type: 'refund_requested',
          recipientId: selectedReservation.hostId,
          hostId: selectedReservation.hostId,
          guestId: guestId,
          reservationId: selectedReservation.id,
          listingId: selectedReservation.listingId,
          refundId: refundRef.id,
          title: 'Refund Requested',
          body: `Guest has requested a refund for reservation: ${selectedReservation.listingTitle}. Amount: ₱${selectedReservation?.pricing?.total || 0}. Please review and approve or decline.`,
          message: `Guest has requested a refund for reservation: ${selectedReservation.listingTitle}. Please review in your bookings.`,
          read: false,
          createdAt: serverTimestamp()
        }
        await addDoc(collection(db, 'Notifications'), notification)
      }

      // Create notification for guest
      const guestNotification = {
        type: 'refund_request_pending',
        recipientId: guestId,
        guestId: guestId,
        hostId: selectedReservation.hostId,
        reservationId: selectedReservation.id,
        listingId: selectedReservation.listingId,
        title: 'Refund Request Submitted',
        body: `Your refund request for ${selectedReservation.listingTitle} has been sent to the host for approval.`,
        message: `Refund request submitted. Waiting for host approval.`,
        read: false,
        createdAt: serverTimestamp()
      }
      await addDoc(collection(db, 'Notifications'), guestNotification)

      alert('Refund request submitted successfully! The host will review your request and you will be notified of their decision.')
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
    <div className="bookings-layout">
      <div>
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '20px',
          padding: '32px',
          marginBottom: '32px',
          boxShadow: '0 10px 40px rgba(102, 126, 234, 0.15)',
          color: 'white'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
            <div>
              <h2 style={{
                fontSize: '2rem',
                fontWeight: 700,
                margin: '0 0 8px 0',
                color: 'white',
                letterSpacing: '-0.5px'
              }}>
                Your Reservations
              </h2>
              <p style={{
                fontSize: '1rem',
                margin: 0,
                color: 'rgba(255, 255, 255, 0.9)',
                fontWeight: 400
              }}>
                Manage and review your stays
              </p>
            </div>
            <div style={{ 
              display: 'flex', 
              gap: '12px', 
              alignItems: 'center',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '12px',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  background: showCompleted 
                    ? 'rgba(255, 255, 255, 0.2)' 
                    : 'rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  backdropFilter: 'blur(10px)',
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => {
                  if (!showCompleted) {
                    e.target.style.background = 'rgba(255, 255, 255, 0.2)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!showCompleted) {
                    e.target.style.background = 'rgba(255, 255, 255, 0.1)'
                  }
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {showCompleted ? (
                    <path d="M9 11l3 3L22 4" strokeLinecap="round" strokeLinejoin="round"/>
                  ) : (
                    <path d="M9 18l6-6" strokeLinecap="round" strokeLinejoin="round"/>
                  )}
                </svg>
                {showCompleted ? 'Show Active' : 'Show Completed'}
              </button>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(255, 255, 255, 0.2)',
                padding: '8px 16px',
                borderRadius: '12px',
                backdropFilter: 'blur(10px)'
              }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#fbbf24'
                }}></div>
                <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Pending</span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(255, 255, 255, 0.2)',
                padding: '8px 16px',
                borderRadius: '12px',
                backdropFilter: 'blur(10px)'
              }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#10b981'
                }}></div>
                <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Confirmed</span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(255, 255, 255, 0.2)',
                padding: '8px 16px',
                borderRadius: '12px',
                backdropFilter: 'blur(10px)'
              }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#ef4444'
                }}></div>
                <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Declined</span>
              </div>
            </div>
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
              {showCompleted 
                ? (selectedDate ? `No completed reservations on ${selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}` : 'No completed reservations found')
                : (selectedDate ? `No reservations on ${selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}` : 'No reservations found')
              }
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
        />
        {selectedDate && (
          <div style={{ 
            marginTop: 12, 
            padding: '12px 16px',
            background: '#f3f4f6',
            borderRadius: '10px',
            color: '#374151',
            fontSize: '0.9rem',
            fontWeight: 500
          }}>
            Selected: {selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        )}
        <div style={{ 
          marginTop: 12, 
          padding: '10px 14px',
          background: '#f9fafb',
          borderRadius: '8px',
          fontSize: '0.85rem', 
          color: '#6b7280',
          border: '1px solid #e5e7eb'
        }}>
          💡 Dates with reservations are highlighted; click a date to filter.
        </div>
      </div>

      {selectedReservation && (
        <div 
          role="dialog" 
          aria-modal="true" 
          onClick={() => {
            setSelectedReservation(null)
            setHostInfo(null)
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 1000
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '600px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '90vh'
            }}
          >
            {/* Header */}
            <div style={{
              padding: '24px 24px 20px',
              borderBottom: '1px solid #f0f0f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h3 style={{
                margin: 0,
                fontSize: '20px',
                fontWeight: 700,
                color: '#1f2937',
                letterSpacing: '-0.3px'
              }}>
                {selectedReservation.listingTitle || 'Reservation Details'}
              </h3>
              <button 
                onClick={() => setSelectedReservation(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '8px',
                  transition: 'all 0.2s',
                  lineHeight: 1
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#f3f4f6'
                  e.target.style.color = '#374151'
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'none'
                  e.target.style.color = '#9ca3af'
                }}
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div style={{
              padding: '24px',
              overflowY: 'auto',
              flex: 1
            }}>
              {selectedReservation.listingThumbnail && (
                <img 
                  src={selectedReservation.listingThumbnail} 
                  alt={selectedReservation.listingTitle} 
                  style={{ 
                    width: '100%', 
                    height: '200px', 
                    objectFit: 'cover', 
                    borderRadius: '12px',
                    marginBottom: '20px'
                  }} 
                />
              )}
              
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}>
                {/* Status Badge */}
                <div>
                  <span className={`status-badge status-${(selectedReservation.status||'').toLowerCase()}`}>
                    {selectedReservation.status}
                  </span>
                </div>

                {/* Refund Pending Alert */}
                {selectedReservation.status?.toLowerCase() === 'refund_pending' && (
                  <div style={{
                    padding: '16px',
                    background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
                    borderRadius: '12px',
                    border: '1px solid #fed7aa',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px'
                  }}>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: '#f97316',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: '2px'
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 8v4M12 16h.01"/>
                      </svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#9a3412',
                        marginBottom: '4px'
                      }}>
                        Refund Request Pending
                      </div>
                      <div style={{
                        fontSize: '13px',
                        color: '#7c2d12',
                        lineHeight: 1.5
                      }}>
                        Your refund request is waiting for host approval. You will be notified once the host responds.
                      </div>
                    </div>
                  </div>
                )}

                {/* Details Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '16px',
                  padding: '20px',
                  background: '#f9fafb',
                  borderRadius: '12px'
                }}>
                  <div>
                    <div style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#6b7280',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '6px'
                    }}>
                      Check-in
                    </div>
                    <div style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      color: '#1f2937'
                    }}>
                      {new Date(selectedReservation.checkIn).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </div>
                  </div>
                  <div>
                    <div style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#6b7280',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '6px'
                    }}>
                      Check-out
                    </div>
                    <div style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      color: '#1f2937'
                    }}>
                      {new Date(selectedReservation.checkOut).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </div>
                  </div>
                  <div>
                    <div style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#6b7280',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '6px'
                    }}>
                      Nights
                    </div>
                    <div style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      color: '#1f2937'
                    }}>
                      {selectedReservation.nights}
                    </div>
                  </div>
                  <div>
                    <div style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#6b7280',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '6px'
                    }}>
                      Total Amount
                    </div>
                    <div style={{
                      fontSize: '18px',
                      fontWeight: 700,
                      color: '#059669'
                    }}>
                      ₱{selectedReservation?.pricing?.total?.toLocaleString() || 0}
                    </div>
                  </div>
                </div>

                {selectedReservation.guestMessage && (
                  <div style={{
                    padding: '16px',
                    background: '#f0f9ff',
                    borderRadius: '12px',
                    border: '1px solid #bae6fd'
                  }}>
                    <div style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#0369a1',
                      marginBottom: '8px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Your Message
                    </div>
                    <div style={{
                      fontSize: '14px',
                      color: '#0c4a6e',
                      lineHeight: 1.6
                    }}>
                      {selectedReservation.guestMessage}
                    </div>
                  </div>
                )}

                {/* Reservation ID and Created Date */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '16px',
                  padding: '16px',
                  background: '#f9fafb',
                  borderRadius: '12px',
                  border: '1px solid #e5e7eb'
                }}>
                  <div>
                    <div style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#6b7280',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '6px'
                    }}>
                      Reservation ID
                    </div>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#1f2937',
                      fontFamily: 'monospace'
                    }}>
                      {selectedReservation.id.substring(0, 8).toUpperCase()}
                    </div>
                  </div>
                  <div>
                    <div style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#6b7280',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '6px'
                    }}>
                      Created Date
                    </div>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#1f2937'
                    }}>
                      {selectedReservation.createdAt 
                        ? (selectedReservation.createdAt.toDate 
                          ? selectedReservation.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : new Date(selectedReservation.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }))
                        : 'N/A'}
                    </div>
                  </div>
                </div>

                {/* Host Information */}
                {hostInfo && (
                  <div style={{
                    padding: '20px',
                    background: '#f9fafb',
                    borderRadius: '12px',
                    border: '1px solid #e5e7eb'
                  }}>
                    <h3 style={{
                      margin: '0 0 16px',
                      fontSize: '16px',
                      fontWeight: 700,
                      color: '#1f2937',
                      borderBottom: '2px solid #e5e7eb',
                      paddingBottom: '12px'
                    }}>
                      Host Information
                    </h3>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '12px'
                    }}>
                      <div>
                        <div style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#6b7280',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          marginBottom: '4px'
                        }}>
                          Name
                        </div>
                        <div style={{
                          fontSize: '15px',
                          fontWeight: 600,
                          color: '#1f2937'
                        }}>
                          {hostInfo.firstName || ''} {hostInfo.lastName || ''}
                        </div>
                      </div>
                      <div>
                        <div style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#6b7280',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          marginBottom: '4px'
                        }}>
                          Email
                        </div>
                        <div style={{
                          fontSize: '14px',
                          color: '#1f2937',
                          wordBreak: 'break-word'
                        }}>
                          {hostInfo.emailAddress || 'N/A'}
                        </div>
                      </div>
                      {hostInfo.phoneNumber && (
                        <div>
                          <div style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#6b7280',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            marginBottom: '4px'
                          }}>
                            Phone
                          </div>
                          <div style={{
                            fontSize: '15px',
                            color: '#1f2937'
                          }}>
                            {hostInfo.phoneNumber}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Payment Information */}
                {selectedReservation.paymentSummary && (
                  <div style={{
                    padding: '20px',
                    background: '#f9fafb',
                    borderRadius: '12px',
                    border: '1px solid #e5e7eb'
                  }}>
                    <h3 style={{
                      margin: '0 0 16px',
                      fontSize: '16px',
                      fontWeight: 700,
                      color: '#1f2937',
                      borderBottom: '2px solid #e5e7eb',
                      paddingBottom: '12px'
                    }}>
                      Payment Information
                    </h3>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '12px'
                    }}>
                      <div>
                        <div style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#6b7280',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          marginBottom: '4px'
                        }}>
                          Payment Method
                        </div>
                        <div style={{
                          fontSize: '15px',
                          fontWeight: 600,
                          color: '#1f2937',
                          textTransform: 'capitalize'
                        }}>
                          {selectedReservation.paymentSummary.methodType || 'N/A'}
                        </div>
                      </div>
                      {selectedReservation.paymentSummary.last4 && (
                        <div>
                          <div style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#6b7280',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            marginBottom: '4px'
                          }}>
                            Card Last 4
                          </div>
                          <div style={{
                            fontSize: '15px',
                            color: '#1f2937',
                            fontFamily: 'monospace'
                          }}>
                            **** {selectedReservation.paymentSummary.last4}
                          </div>
                        </div>
                      )}
                      {selectedReservation.paymentSummary.transactionId && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <div style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#6b7280',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            marginBottom: '4px'
                          }}>
                            Transaction ID
                          </div>
                          <div style={{
                            fontSize: '13px',
                            color: '#1f2937',
                            fontFamily: 'monospace',
                            wordBreak: 'break-all'
                          }}>
                            {selectedReservation.paymentSummary.transactionId}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Pricing Breakdown */}
                {selectedReservation.pricing && (
                  <div style={{
                    padding: '20px',
                    background: '#f9fafb',
                    borderRadius: '12px',
                    border: '1px solid #e5e7eb'
                  }}>
                    <h3 style={{
                      margin: '0 0 16px',
                      fontSize: '16px',
                      fontWeight: 700,
                      color: '#1f2937',
                      borderBottom: '2px solid #e5e7eb',
                      paddingBottom: '12px'
                    }}>
                      Pricing Breakdown
                    </h3>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}>
                      {selectedReservation.pricing.nightly && (
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '8px 0',
                          borderBottom: '1px solid #e5e7eb'
                        }}>
                          <span style={{ fontSize: '14px', color: '#6b7280' }}>
                            Nightly Rate (×{selectedReservation.nights})
                          </span>
                          <span style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>
                            ₱{selectedReservation.pricing.nightly.toLocaleString()}
                          </span>
                        </div>
                      )}
                      {selectedReservation.pricing.baseTotal && (
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '8px 0',
                          borderBottom: '1px solid #e5e7eb'
                        }}>
                          <span style={{ fontSize: '14px', color: '#6b7280' }}>
                            Subtotal
                          </span>
                          <span style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>
                            ₱{selectedReservation.pricing.baseTotal.toLocaleString()}
                          </span>
                        </div>
                      )}
                      {selectedReservation.pricing.serviceFee && (
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '8px 0',
                          borderBottom: '1px solid #e5e7eb'
                        }}>
                          <span style={{ fontSize: '14px', color: '#6b7280' }}>
                            Service Fee
                          </span>
                          <span style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>
                            ₱{selectedReservation.pricing.serviceFee.toLocaleString()}
                          </span>
                        </div>
                      )}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '12px 0 0',
                        borderTop: '2px solid #1f2937',
                        marginTop: '4px'
                      }}>
                        <span style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937' }}>
                          Total
                        </span>
                        <span style={{ fontSize: '18px', fontWeight: 700, color: '#059669' }}>
                          ₱{selectedReservation.pricing.total?.toLocaleString() || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '20px 24px',
              borderTop: '1px solid #f0f0f0',
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end',
              background: '#fafafa'
            }}>
              {isBookingConfirmed(selectedReservation) && (
                <button 
                  onClick={() => setShowCompleteDialog(true)}
                  style={{
                    padding: '12px 24px',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-1px)'
                    e.target.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)'
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)'
                    e.target.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.3)'
                  }}
                >
                  Complete Booking
                </button>
              )}
              {(selectedReservation.status?.toLowerCase() === 'confirmed' || selectedReservation.status?.toLowerCase() === 'pending') && (
                <button 
                  onClick={handleRequestRefund}
                  disabled={processingRefund}
                  style={{
                    padding: '12px 24px',
                    borderRadius: '10px',
                    border: 'none',
                    background: processingRefund 
                      ? '#d1d5db' 
                      : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: processingRefund ? 'not-allowed' : 'pointer',
                    opacity: processingRefund ? 0.6 : 1,
                    transition: 'all 0.2s',
                    boxShadow: processingRefund ? 'none' : '0 2px 8px rgba(239, 68, 68, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    if (!processingRefund) {
                      e.target.style.transform = 'translateY(-1px)'
                      e.target.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.4)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!processingRefund) {
                      e.target.style.transform = 'translateY(0)'
                      e.target.style.boxShadow = '0 2px 8px rgba(239, 68, 68, 0.3)'
                    }
                  }}
                >
                  {processingRefund ? 'Processing...' : 'Request Refund'}
                </button>
              )}
              <button 
                onClick={() => setSelectedReservation(null)}
                style={{
                  padding: '12px 24px',
                  borderRadius: '10px',
                  border: '1px solid #e5e7eb',
                  background: 'white',
                  color: '#6b7280',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#f9fafb'
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'white'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Booking Confirmation Dialog */}
      {showCompleteDialog && selectedReservation && (
        <div 
          role="dialog" 
          aria-modal="true" 
          className="modal-overlay" 
          onClick={() => setShowCompleteDialog(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px',
            overflowY: 'auto'
          }}
        >
          <div 
            className="modal" 
            onClick={(e) => e.stopPropagation()} 
            style={{ 
              maxWidth: '600px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              margin: 'auto'
            }}
          >
            <div className="modal-header" style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
              <h3 className="modal-title">Complete Booking</h3>
              <button className="btn btn-ghost" onClick={() => setShowCompleteDialog(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ maxHeight: 'calc(90vh - 140px)', overflowY: 'auto' }}>
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                gap: '16px',
                padding: '20px 0'
              }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '32px'
                }}>
                  ✓
                </div>
                <div style={{ textAlign: 'center' }}>
                  <h4 style={{ 
                    fontSize: '1.25rem', 
                    fontWeight: 600, 
                    margin: '0 0 8px 0',
                    color: '#1f2937'
                  }}>
                    Confirm Completion
                  </h4>
                  <p style={{ 
                    fontSize: '0.95rem', 
                    color: '#6b7280',
                    margin: 0,
                    lineHeight: 1.5
                  }}>
                    Are you sure you want to complete this booking? This will mark it as completed and remove it from your active reservations.
                  </p>
                </div>
                <div style={{
                  width: '100%',
                  background: '#f9fafb',
                  borderRadius: '8px',
                  padding: '16px',
                  border: '1px solid #e5e7eb',
                  marginTop: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>Listing:</span>
                    <span style={{ color: '#1f2937', fontWeight: 600, fontSize: '0.9rem' }}>
                      {selectedReservation.listingTitle || 'N/A'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>Check-out:</span>
                    <span style={{ color: '#1f2937', fontWeight: 600, fontSize: '0.9rem' }}>
                      {new Date(selectedReservation.checkOut).toLocaleDateString()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>Total:</span>
                    <span style={{ color: '#10b981', fontWeight: 700, fontSize: '1rem' }}>
                      ₱{selectedReservation?.pricing?.total || 0}
                    </span>
                  </div>
                </div>

                {/* Feedback Form */}
                <div style={{
                  width: '100%',
                  marginTop: '24px',
                  padding: '20px',
                  background: '#f0f9ff',
                  borderRadius: '8px',
                  border: '1px solid #bae6fd'
                }}>
                  <h5 style={{
                    fontSize: '1rem',
                    fontWeight: 600,
                    margin: '0 0 16px 0',
                    color: '#1e40af'
                  }}>
                    Share Your Experience
                  </h5>
                  
                  {/* Star Rating */}
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '0.9rem',
                      fontWeight: 500,
                      color: '#374151',
                      marginBottom: '12px'
                    }}>
                      Rate your experience *
                    </label>
                    <div style={{
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'center'
                    }}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setFeedback({ ...feedback, rating: star })}
                          onMouseEnter={() => setHoveredRating(star)}
                          onMouseLeave={() => setHoveredRating(0)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'transform 0.2s'
                          }}
                        >
                          <svg
                            width="32"
                            height="32"
                            viewBox="0 0 24 24"
                            fill={star <= (hoveredRating || feedback.rating) ? '#fbbf24' : 'none'}
                            stroke={star <= (hoveredRating || feedback.rating) ? '#fbbf24' : '#d1d5db'}
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{
                              transition: 'all 0.2s',
                              transform: star <= (hoveredRating || feedback.rating) ? 'scale(1.1)' : 'scale(1)'
                            }}
                          >
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                        </button>
                      ))}
                      {feedback.rating > 0 && (
                        <span style={{
                          marginLeft: '8px',
                          fontSize: '0.9rem',
                          color: '#6b7280',
                          fontWeight: 500
                        }}>
                          {feedback.rating} {feedback.rating === 1 ? 'star' : 'stars'}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '0.9rem',
                      fontWeight: 500,
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      What did you think of the service? *
                    </label>
                    <textarea
                      value={feedback.serviceThoughts}
                      onChange={(e) => setFeedback({ ...feedback, serviceThoughts: e.target.value })}
                      placeholder="Tell us about your experience..."
                      style={{
                        width: '100%',
                        minHeight: '80px',
                        padding: '12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.9rem',
                        fontFamily: 'inherit',
                        resize: 'vertical',
                        transition: 'border-color 0.2s'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                      onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                      required
                    />
                  </div>

                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.9rem',
                      fontWeight: 500,
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      What would you like to see more of? *
                    </label>
                    <textarea
                      value={feedback.improvements}
                      onChange={(e) => setFeedback({ ...feedback, improvements: e.target.value })}
                      placeholder="Share your suggestions and what you'd like to see improved..."
                      style={{
                        width: '100%',
                        minHeight: '80px',
                        padding: '12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.9rem',
                        fontFamily: 'inherit',
                        resize: 'vertical',
                        transition: 'border-color 0.2s'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                      onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                      required
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-success" 
                onClick={handleCompleteBooking}
                disabled={processingComplete || !feedback.rating || !feedback.serviceThoughts.trim() || !feedback.improvements.trim()}
                style={{ 
                  background: processingComplete 
                    ? '#9ca3af' 
                    : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '10px 24px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: processingComplete ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  opacity: processingComplete ? 0.6 : 1
                }}
              >
                {processingComplete ? 'Processing...' : 'Yes, Complete Booking'}
              </button>
              <button 
                className="btn btn-ghost" 
                onClick={() => {
                  setShowCompleteDialog(false)
                  // Reset feedback when canceling
                  setFeedback({
                    rating: 0,
                    serviceThoughts: '',
                    improvements: ''
                  })
                  setHoveredRating(0)
                }}
                disabled={processingComplete}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default GuestBookings


