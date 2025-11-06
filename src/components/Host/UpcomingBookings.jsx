import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../../config/firebase'

const UpcomingBookings = ({ hostId }) => {
  const navigate = useNavigate()
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!hostId) return
    const q = query(
      collection(db, 'Reservation'),
      where('hostId', '==', hostId)
    )
    const unsub = onSnapshot(q, (snap) => {
      const list = []
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }))
      const toMs = (v) => (v?.toMillis ? v.toMillis() : (v?.seconds ? v.seconds * 1000 : (Date.parse(v) || 0)))
      list.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt))
      setReservations(list)
      setLoading(false)
    })
    return () => unsub()
  }, [hostId])

  // Filter bookings for upcoming dates (future check-in dates)
  const upcomingBookings = useMemo(() => {
    if (!reservations.length) return []
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    return reservations.filter((r) => {
      if (!r.checkIn) return false
      
      const checkInDate = new Date(r.checkIn)
      checkInDate.setHours(0, 0, 0, 0)
      
      return checkInDate.getTime() > today.getTime()
    }).sort((a, b) => {
      // Sort by check-in date ascending (earliest first)
      const dateA = new Date(a.checkIn)
      const dateB = new Date(b.checkIn)
      return dateA.getTime() - dateB.getTime()
    })
  }, [reservations])

  if (loading) {
    return (
      <div className="UpcomingBookings">
        <h1>Upcoming Bookings</h1>
        <div className="booking-list">
          <div style={{ padding: 20, textAlign: 'center' }}>Loading bookings...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="UpcomingBookings">
      <h1>Upcoming Bookings</h1>
      <div className="booking-list">
        {upcomingBookings.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#666' }}>No upcoming bookings</div>
        ) : (
          upcomingBookings.map((booking, index) => {
            const checkInDate = new Date(booking.checkIn)
            const handleClick = () => {
              // Navigate to bookings page with check-in date as URL param
              // Use local date components to avoid timezone issues
              const year = checkInDate.getFullYear()
              const month = String(checkInDate.getMonth() + 1).padStart(2, '0')
              const day = String(checkInDate.getDate()).padStart(2, '0')
              const dateStr = `${year}-${month}-${day}`
              navigate(`/host/${hostId}/bookings?date=${dateStr}`)
            }
            return (
              <div 
                className="booking-row" 
                key={booking.id}
                onClick={handleClick}
                style={{ cursor: 'pointer' }}
              >
                <div className="booking-row-group">
                  <h3>{index + 1}. </h3>
                  <img 
                    className="booking-row__thumb" 
                    src={booking.listingThumbnail || "/static/google.png"} 
                    alt={booking.listingTitle || "room thumbnail"} 
                  />
                </div>
                <div className="booking-row__info">
                  <p className="text-3xl font-bold text-blue-600 text-center">{booking.listingTitle || 'Booking'}</p>
                  <p className="booking-row__meta">{booking.nights || 0} nights | Check-in: {checkInDate.toLocaleDateString()}</p>
                </div>
                <p className="booking-row__date">{checkInDate.toLocaleDateString()}</p>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default UpcomingBookings