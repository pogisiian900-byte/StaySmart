import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { collection, onSnapshot, orderBy, query, updateDoc, where, doc, serverTimestamp, getDoc, addDoc, getDocs } from 'firebase/firestore'
import { db } from '../../config/firebase'
// Removed PayPal payout import - using Firebase balance instead
import ContinuousCalendar from '../../components/ContinuousCalendar'
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
  // Removed hostPayPalInfo state - using Firebase balance instead
  const confirmDialogRef = React.useRef(null)
  const [showDeclineDialog, setShowDeclineDialog] = useState(false)
  const [reservationToDecline, setReservationToDecline] = useState(null)
  const declineDialogRef = React.useRef(null)
  const [showCompleted, setShowCompleted] = useState(false)

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


  // Register dialog polyfill
  useEffect(() => {
    if (confirmDialogRef.current && !confirmDialogRef.current.showModal) {
      dialogPolyfill.registerDialog(confirmDialogRef.current)
    }
    if (declineDialogRef.current && !declineDialogRef.current.showModal) {
      dialogPolyfill.registerDialog(declineDialogRef.current)
    }
  }, [])

  const showConfirmBookingDialog = async (reservation) => {
    setReservationToConfirm(reservation)
    setShowConfirmDialog(true)
    
    // Removed PayPal info fetching - using Firebase balance instead
    
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
  }

  const handleConfirmBooking = async () => {
    if (!reservationToConfirm) return
    const reservationId = reservationToConfirm.id
    handleCloseConfirmDialog()
    try {
      await handleDecision(reservationId, 'confirmed')
    } catch (error) {
      console.error('Error confirming booking:', error)
      alert(`Failed to confirm booking: ${error.message || 'Please try again.'}`)
    }
  }

  const showDeclineBookingDialog = async (reservation) => {
    setReservationToDecline(reservation)
    setShowDeclineDialog(true)
    setTimeout(() => {
      if (declineDialogRef.current) {
        try {
          if (typeof declineDialogRef.current.showModal === 'function') {
            declineDialogRef.current.showModal()
          } else {
            dialogPolyfill.registerDialog(declineDialogRef.current)
            declineDialogRef.current.showModal()
          }
        } catch (err) {
          console.error('Error showing decline dialog:', err)
          declineDialogRef.current.style.display = 'block'
        }
      }
    }, 50)
  }

  const handleCloseDeclineDialog = () => {
    setShowDeclineDialog(false)
    declineDialogRef.current?.close()
    setReservationToDecline(null)
  }

  const handleDeclineBooking = async () => {
    if (!reservationToDecline) return
    handleCloseDeclineDialog()
    await handleDecision(reservationToDecline.id, 'declined')
  }

  const handleRefundDecision = async (reservationId, approve) => {
    try {
      setUpdating(reservationId)
      
      const reservationRef = doc(db, 'Reservation', reservationId)
      const reservationSnap = await getDoc(reservationRef)
      
      if (!reservationSnap.exists()) {
        alert('Reservation not found')
        return
      }

      const reservationData = reservationSnap.data()
      
      // Find the refund record
      const refundsQuery = query(
        collection(db, 'Refunds'),
        where('reservationId', '==', reservationId),
        where('status', '==', 'refund_pending')
      )
      const refundsSnapshot = await getDocs(refundsQuery)
      
      if (refundsSnapshot.empty) {
        alert('Refund record not found')
        return
      }
      
      const refundDoc = refundsSnapshot.docs[0]
      const refundRef = doc(db, 'Refunds', refundDoc.id)
      
      if (approve) {
        // Approve refund - set status to refunded
        await updateDoc(reservationRef, {
          status: 'refunded',
          refundApprovedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        })
        
        await updateDoc(refundRef, {
          status: 'approved',
          approvedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        })
        
        // Notify guest
        await addDoc(collection(db, 'Notifications'), {
          type: 'refund_approved',
          recipientId: reservationData.guestId,
          guestId: reservationData.guestId,
          hostId: hostId,
          reservationId: reservationId,
          listingId: reservationData.listingId,
          title: 'Refund Approved',
          body: `Your refund request for ${reservationData.listingTitle} has been approved. Amount: ₱${reservationData?.pricing?.total || 0}`,
          message: `Your refund request has been approved. The refund will be processed shortly.`,
          read: false,
          createdAt: serverTimestamp()
        })
        
        alert('Refund approved successfully! The guest has been notified.')
      } else {
        // Cancel refund - restore original status
        const originalStatus = reservationData.status === 'refund_pending' 
          ? (reservationData.refundRequestedAt ? 'confirmed' : 'pending')
          : reservationData.status
        
        await updateDoc(reservationRef, {
          status: originalStatus,
          refundCancelledAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        })
        
        await updateDoc(refundRef, {
          status: 'cancelled',
          cancelledAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        })
        
        // Notify guest
        await addDoc(collection(db, 'Notifications'), {
          type: 'refund_declined',
          recipientId: reservationData.guestId,
          guestId: reservationData.guestId,
          hostId: hostId,
          reservationId: reservationId,
          listingId: reservationData.listingId,
          title: 'Refund Request Declined',
          body: `Your refund request for ${reservationData.listingTitle} has been declined by the host.`,
          message: `Your refund request has been declined. The reservation remains active.`,
          read: false,
          createdAt: serverTimestamp()
        })
        
        alert('Refund request declined. The guest has been notified and the reservation remains active.')
      }
      
      setSelectedReservation(null)
    } catch (error) {
      console.error('Error processing refund decision:', error)
      alert('Failed to process refund decision. Please try again.')
    } finally {
      setUpdating(null)
    }
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
      
      // If confirming, validate pricing data exists first
      if (status === 'confirmed' && !reservationData.pricing) {
        console.warn('Cannot confirm booking: pricing data is missing:', reservationData)
        alert('Cannot confirm booking: Pricing information is missing. Please contact support.')
        return
      }
      
      // Update reservation status
      await updateDoc(reservationRef, {
        status,
        updatedAt: serverTimestamp(),
      })

      // Create notification for guest when booking status changes
      if (reservationData.guestId) {
        const guestNotification = {
          type: status === 'confirmed' ? 'booking_confirmed' : status === 'declined' ? 'booking_declined' : 'booking_updated',
          recipientId: reservationData.guestId, // Guest receives the notification
          guestId: reservationData.guestId,
          hostId: hostId,
          listingId: reservationData.listingId,
          reservationId: id,
          title: status === 'confirmed' ? 'Booking Confirmed!' : status === 'declined' ? 'Booking Declined' : 'Booking Updated',
          body: status === 'confirmed' 
            ? `Your booking for ${reservationData.listingTitle || 'listing'} has been confirmed! Check-in: ${new Date(reservationData.checkIn).toLocaleDateString()}`
            : status === 'declined'
            ? `Unfortunately, your booking request for ${reservationData.listingTitle || 'listing'} has been declined.`
            : `Your booking for ${reservationData.listingTitle || 'listing'} has been updated.`,
          message: status === 'confirmed' 
            ? `Your booking for ${reservationData.listingTitle || 'listing'} has been confirmed!`
            : status === 'declined'
            ? `Your booking request for ${reservationData.listingTitle || 'listing'} has been declined.`
            : `Your booking status has been updated.`,
          read: false,
          createdAt: serverTimestamp(),
        }
        const guestNotificationRef = await addDoc(collection(db, 'Notifications'), guestNotification);
      }

      // If confirmed, credit the amount to host and service fee to admin
      if (status === 'confirmed' && reservationData.pricing) {
        
        // IMPORTANT: Only add subtotal to host account, NOT the total (grandTotal)
        // The total includes service fee which goes to ADMIN
        const hostEarnings = reservationData.pricing.subtotal || 0 // Host gets subtotal (excluding service fee)
        // Service fee is 10% of subtotal (fallback for old bookings)
        const serviceFee = reservationData.pricing.serviceFee || Math.round(hostEarnings * 0.1)
        // DO NOT use reservationData.pricing.total or grandTotal - that includes service fee
        
        console.log('Reservation pricing data:', reservationData.pricing)
        console.log('Host earnings (subtotal):', hostEarnings)
        console.log('Service fee (to admin):', serviceFee)
        
        if (hostEarnings > 0 && hostId) {
          // Get host document
          const hostRef = doc(db, 'Users', hostId)
          const hostSnap = await getDoc(hostRef)
          
          if (hostSnap.exists()) {
            const hostData = hostSnap.data()
            const currentEarnings = hostData.totalEarnings || 0
            const newTotalEarnings = currentEarnings + hostEarnings
            
            // Get current Firebase balance and increase it by HOST EARNINGS (subtotal only)
            const currentHostBalance = hostData.balance || hostData.walletBalance || hostData.paypalBalance || 0
            const newHostBalance = currentHostBalance + hostEarnings // Only add subtotal, not total
            
            console.log('Updating host balance:', {
              hostId,
              currentHostBalance,
              hostEarnings,
              newHostBalance,
              reservationId: id
            })
            
            const paymentMethod = reservationData.paymentSummary?.methodType || 'balance'
            
            // Update host's balance and total earnings
            try {
              const updateData = {
                balance: newHostBalance,
                totalEarnings: newTotalEarnings,
                updatedAt: serverTimestamp(),
              }
              
              await updateDoc(hostRef, updateData)
              console.log(`✅ Added ₱${hostEarnings} to host balance. New host balance: ₱${newHostBalance}`)
            } catch (updateError) {
              console.error('Error updating host data:', updateError)
              throw updateError // Re-throw to be caught by outer try-catch
            }

            // Add service fee to admin's Firebase balance
            if (serviceFee > 0) {
              try {
                // Find admin user(s) - use query for better performance
                const adminQuery = query(collection(db, 'Users'), where('role', '==', 'admin'))
                const adminSnapshot = await getDocs(adminQuery)
                
                if (!adminSnapshot.empty) {
                  // Get the first admin (or distribute to all admins - for now, just first one)
                  const adminDoc = adminSnapshot.docs[0]
                  const adminId = adminDoc.id
                  const adminData = adminDoc.data()
                  
                  const adminRef = doc(db, 'Users', adminId)
                  const currentAdminBalance = adminData.balance || adminData.walletBalance || adminData.paypalBalance || 0
                  const currentAdminEarnings = adminData.totalEarnings || 0
                  const newAdminBalance = currentAdminBalance + serviceFee
                  const newAdminEarnings = currentAdminEarnings + serviceFee
                  
                  // Update admin's balance and total earnings
                  const adminUpdateData = {
                    balance: newAdminBalance,
                    totalEarnings: newAdminEarnings,
                    updatedAt: serverTimestamp(),
                  }
                  
                  await updateDoc(adminRef, adminUpdateData)
                  
                  console.log(`✅ Added ₱${serviceFee} to admin balance. New admin balance: ₱${newAdminBalance}`)
                  
                  // Create admin transaction record
                  const adminTransaction = {
                    adminId,
                    reservationId: id,
                    hostId: hostId,
                    guestId: reservationData.guestId,
                    listingId: reservationData.listingId,
                    listingTitle: reservationData.listingTitle || '',
                    amount: serviceFee,
                    type: 'service_fee',
                    status: 'completed',
                    paymentMethod: paymentMethod,
                    transactionId: reservationData.paymentSummary?.transactionId || null,
                    balanceBefore: currentAdminBalance,
                    balanceAfter: newAdminBalance,
                    checkIn: reservationData.checkIn,
                    checkOut: reservationData.checkOut,
                    nights: reservationData.nights || 0,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                  }
                  
                  // Add to Transactions collection (for Firebase balance system)
                  await addDoc(collection(db, 'Transactions'), adminTransaction)
                  
                  // Also add to AdminTransactions for backward compatibility
                  await addDoc(collection(db, 'AdminTransactions'), adminTransaction)
                  
                  console.log('✅ Admin transaction recorded:', adminTransaction)
                } else {
                  console.warn('No admin user found to credit service fee')
                }
              } catch (adminError) {
                console.error('Error updating admin balance:', adminError)
                // Don't throw - we don't want to fail the host update if admin update fails
              }
            }

            // Get the amount guest was charged (total/grandTotal) for transaction record
            let guestChargedAmount = reservationData.pricing.total || 0
            if (!guestChargedAmount && reservationData.pricing.subtotal && reservationData.pricing.serviceFee) {
              guestChargedAmount = reservationData.pricing.subtotal + reservationData.pricing.serviceFee
              console.log('Calculated total from subtotal + serviceFee:', guestChargedAmount)
            }
            
            // Create transaction record with payment details
            const transaction = {
              hostId,
              reservationId: id,
              guestId: reservationData.guestId,
              listingId: reservationData.listingId,
              listingTitle: reservationData.listingTitle || '',
              amount: hostEarnings, // Host gets subtotal
              serviceFee: serviceFee, // Service fee amount
              guestChargedAmount: guestChargedAmount, // Total amount guest paid
              type: 'booking_earnings',
              status: 'completed',
              paymentMethod: paymentMethod,
              balanceBefore: currentHostBalance,
              balanceAfter: newHostBalance,
              checkIn: reservationData.checkIn,
              checkOut: reservationData.checkOut,
              nights: reservationData.nights || 0,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }

            // Add to Transactions collection (for Firebase balance system)
            await addDoc(collection(db, 'Transactions'), transaction)
            
            // Also add to HostTransactions for backward compatibility
            await addDoc(collection(db, 'HostTransactions'), transaction)
            
            console.log('✅ Host transaction recorded:', transaction)
            
            // Create notification for host
            const notification = {
              type: 'earnings_credited',
              recipientId: hostId,
              hostId,
              reservationId: id,
              title: 'Earnings Credited',
              body: `₱${hostEarnings.toLocaleString()} has been added to your account balance.`,
              message: `₱${hostEarnings.toLocaleString()} has been added to your account balance.`,
              read: false,
              createdAt: serverTimestamp(),
            }
            await addDoc(collection(db, 'Notifications'), notification)
            
            alert(`Reservation confirmed successfully!\n\n₱${hostEarnings.toLocaleString()} has been added to your account balance.\nService fee of ₱${serviceFee.toLocaleString()} has been credited to admin.`)
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
                Incoming Reservations
              </h2>
              <p style={{
                fontSize: '1rem',
                margin: 0,
                color: 'rgba(255, 255, 255, 0.9)',
                fontWeight: 400
              }}>
                Review and manage guest requests
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
              {showCompleted 
                ? (selectedDate ? 'There are no completed reservations scheduled for this date. Try selecting a different date from the calendar.' : 'You don\'t have any completed reservations yet.')
                : (selectedDate ? 'There are no reservations scheduled for this date. Try selecting a different date from the calendar.' : 'You don\'t have any reservations yet. When guests book your listings, they will appear here.')
              }
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
      </div>
      {selectedReservation && (
        <div 
          role="dialog" 
          aria-modal="true" 
          onClick={() => setSelectedReservation(null)}
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
              maxWidth: '520px',
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
                        Guest has requested a refund of <strong>₱{selectedReservation?.pricing?.total || 0}</strong>. Please review and make a decision.
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
                      Guest Message
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
              {selectedReservation.status?.toLowerCase() === 'refund_pending' ? (
                <>
                  <button 
                    disabled={updating===selectedReservation.id} 
                    onClick={() => {
                      if (window.confirm(`Are you sure you want to approve this refund request?\n\nAmount: ₱${selectedReservation?.pricing?.total || 0}\n\nThe guest will be refunded and the reservation will be cancelled.`)) {
                        handleRefundDecision(selectedReservation.id, true)
                      }
                    }}
                    style={{
                      padding: '12px 24px',
                      borderRadius: '10px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: 'white',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: updating===selectedReservation.id ? 'not-allowed' : 'pointer',
                      opacity: updating===selectedReservation.id ? 0.6 : 1,
                      transition: 'all 0.2s',
                      boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                    }}
                    onMouseEnter={(e) => {
                      if (updating!==selectedReservation.id) {
                        e.target.style.transform = 'translateY(-1px)'
                        e.target.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = 'translateY(0)'
                      e.target.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.3)'
                    }}
                  >
                    {updating===selectedReservation.id ? 'Processing...' : 'Approve Refund'}
                  </button>
                  <button 
                    disabled={updating===selectedReservation.id} 
                    onClick={() => {
                      if (window.confirm(`Are you sure you want to decline this refund request?\n\nThe reservation will remain active and the guest will be notified.`)) {
                        handleRefundDecision(selectedReservation.id, false)
                      }
                    }}
                    style={{
                      padding: '12px 24px',
                      borderRadius: '10px',
                      border: '1px solid #e5e7eb',
                      background: 'white',
                      color: '#dc2626',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: updating===selectedReservation.id ? 'not-allowed' : 'pointer',
                      opacity: updating===selectedReservation.id ? 0.6 : 1,
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (updating!==selectedReservation.id) {
                        e.target.style.background = '#fef2f2'
                        e.target.style.borderColor = '#dc2626'
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'white'
                      e.target.style.borderColor = '#e5e7eb'
                    }}
                  >
                    {updating===selectedReservation.id ? 'Processing...' : 'Decline Refund'}
                  </button>
                </>
              ) : (
                <>
                  <button 
                    className="btn btn-ghost" 
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
                  <button 
                    className="btn btn-primary" 
                    disabled={updating===selectedReservation.id || selectedReservation.status!=='pending'} 
                    onClick={() => showConfirmBookingDialog(selectedReservation)}
                    style={{
                      padding: '12px 24px',
                      borderRadius: '10px',
                      border: 'none',
                      background: updating===selectedReservation.id || selectedReservation.status!=='pending' 
                        ? '#d1d5db' 
                        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: updating===selectedReservation.id || selectedReservation.status!=='pending' ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Confirm
                  </button>
                  <button 
                    className="btn btn-danger" 
                    disabled={updating===selectedReservation.id || selectedReservation.status!=='pending'} 
                    onClick={() => showDeclineBookingDialog(selectedReservation)}
                    style={{
                      padding: '12px 24px',
                      borderRadius: '10px',
                      border: 'none',
                      background: updating===selectedReservation.id || selectedReservation.status!=='pending' 
                        ? '#d1d5db' 
                        : '#ef4444',
                      color: 'white',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: updating===selectedReservation.id || selectedReservation.status!=='pending' ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Decline
                  </button>
                </>
              )}
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ color: '#6b7280', fontWeight: 500 }}>Service Fee:</span>
                    <span style={{ color: '#ef4444', fontWeight: 600 }}>₱{((reservationToConfirm?.pricing?.serviceFee || 0).toLocaleString())}</span>
                  </div>
                  {reservationToConfirm.paymentSummary?.transactionId && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                      <span style={{ color: '#6b7280', fontWeight: 500 }}>Transaction ID:</span>
                      <span style={{ color: '#1f2937', fontWeight: 600, fontSize: '0.9rem', wordBreak: 'break-all' }}>{reservationToConfirm.paymentSummary.transactionId}</span>
                    </div>
                  )}
                </div>
                <p style={{ fontSize: '0.9rem', color: '#6b7280', textAlign: 'center', marginBottom: '20px' }}>
                  Earnings will be added to your account balance once confirmed. Service fee will be credited to admin.
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

      {/* Decline Confirmation Dialog */}
      <dialog ref={declineDialogRef} className="decline-booking-dialog-host" style={{ maxWidth: '500px', width: '90%', border: 'none', borderRadius: '16px', padding: 0, boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)' }}>
        <style>{`
          .decline-booking-dialog-host::backdrop {
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
            background: 'linear-gradient(135deg, #fee2e2 0%, #fef2f2 100%)',
            borderRadius: '16px 16px 0 0'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              background: '#ef4444',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              marginBottom: '16px'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#991b1b', margin: '0 0 8px 0', textAlign: 'center' }}>
              Decline Booking Request
            </h3>
            <button 
              onClick={handleCloseDeclineDialog} 
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
            {reservationToDecline && (
              <>
                <p style={{ fontSize: '1.1rem', color: '#4b5563', marginBottom: '20px', textAlign: 'center', lineHeight: '1.6' }}>
                  Are you sure you want to decline this booking request? The guest will be notified and their payment will be refunded.
                </p>
                <div style={{ 
                  background: '#fef2f2', 
                  borderRadius: '12px', 
                  padding: '20px', 
                  border: '1px solid #fecaca',
                  marginBottom: '20px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #fee2e2' }}>
                    <span style={{ color: '#6b7280', fontWeight: 500 }}>Listing:</span>
                    <span style={{ color: '#1f2937', fontWeight: 600 }}>{reservationToDecline.listingTitle || 'N/A'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #fee2e2' }}>
                    <span style={{ color: '#6b7280', fontWeight: 500 }}>Check-in:</span>
                    <span style={{ color: '#1f2937', fontWeight: 600 }}>{new Date(reservationToDecline.checkIn).toLocaleDateString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #fee2e2' }}>
                    <span style={{ color: '#6b7280', fontWeight: 500 }}>Check-out:</span>
                    <span style={{ color: '#1f2937', fontWeight: 600 }}>{new Date(reservationToDecline.checkOut).toLocaleDateString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #fee2e2' }}>
                    <span style={{ color: '#6b7280', fontWeight: 500 }}>Nights:</span>
                    <span style={{ color: '#1f2937', fontWeight: 600 }}>{reservationToDecline.nights || 0} night(s)</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                    <span style={{ color: '#6b7280', fontWeight: 500 }}>Total Amount:</span>
                    <span style={{ color: '#991b1b', fontWeight: 700, fontSize: '1.1rem' }}>₱{(reservationToDecline?.pricing?.total || 0).toLocaleString()}</span>
                  </div>
                </div>
                <div style={{
                  background: '#fef3c7',
                  border: '1px solid #fde68a',
                  borderRadius: '8px',
                  padding: '12px',
                  marginBottom: '20px'
                }}>
                  <p style={{ fontSize: '0.9rem', color: '#92400e', margin: 0, lineHeight: '1.5' }}>
                    <strong>⚠️ Warning:</strong> Declining this booking will notify the guest and they will receive a full refund. This action cannot be undone.
                  </p>
                </div>
              </>
            )}
          </div>
          <div style={{ padding: '20px 24px 24px', display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #f3f4f6' }}>
            <button 
              onClick={handleCloseDeclineDialog}
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
              onClick={handleDeclineBooking}
              disabled={updating === reservationToDecline?.id}
              style={{
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                padding: '12px 28px',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: updating === reservationToDecline?.id ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                opacity: updating === reservationToDecline?.id ? 0.6 : 1
              }}
            >
              {updating === reservationToDecline?.id ? 'Processing...' : 'Yes, Decline Booking'}
            </button>
          </div>
        </div>
      </dialog>
    </div>
      </>
  )
}

export default HostBookings


