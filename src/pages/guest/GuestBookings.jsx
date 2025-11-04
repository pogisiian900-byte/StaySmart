import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { db } from '../../config/firebase'
import ContinuousCalendar from '../../components/ContinuousCalendar'
import Guest_Logged_Navigation from './guest-navigation-logged'

const GuestBookings = () => {
  const { guestId } = useParams()
  const navigate = useNavigate()
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedReservation, setSelectedReservation] = useState(null)

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
      const start = new Date(r.checkIn)
      const end = new Date(r.checkOut)
      const label = (r.status || '').toString().toLowerCase()
      const statusLabel = label.charAt(0).toUpperCase() + label.slice(1) || 'Booked'
      const score = priority[statusLabel] || 0
      const dayMs = 86400000
      for (let t = start.getTime(); t <= end.getTime(); t += dayMs) {
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
    const key = selectedDate.toDateString()
    return reservations.filter((r) => {
      const start = new Date(r.checkIn)
      const end = new Date(r.checkOut)
      return new Date(key) >= start && new Date(key) <= end
    })
  }, [reservations, selectedDate])

  const handleCalendarClick = (day, month, year) => {
    const d = new Date(year, month - 1, day)
    setSelectedDate(d)
  }

  if (loading) {
    return <div style={{ padding: 20 }}>Loading your bookings...</div>
  }

  return (
    <>
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
          <div style={{ padding: 12, color: '#666' }}>No reservations{selectedDate ? ' on selected date' : ''}.</div>
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
        <h3 style={{ margin: '0 0 12px 0' }}>Calendar</h3>
        <ContinuousCalendar onClick={handleCalendarClick} bookedDates={bookedDates} />
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
                </div>
              </div>
            </div>
            <div className="modal-footer">
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


