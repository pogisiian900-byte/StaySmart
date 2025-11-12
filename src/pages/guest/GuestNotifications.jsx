import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../../config/firebase'
import NotificationList from '../../components/NotificationList'

const GuestNotifications = () => {
  const { guestId } = useParams()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!guestId) {
      return
    }
    
    const q = query(
      collection(db, 'Notifications'),
      where('recipientId', '==', guestId)
    )
    
    const unsub = onSnapshot(
      q, 
      (snap) => {
        try {
          const list = []
          snap.forEach((d) => {
            try {
              const data = d.data()
              list.push({ id: d.id, ...data })
            } catch (err) {
              // Error processing notification document
            }
          })
          
          list.sort((a, b) => {
            try {
              const toMs = (v) => (v?.toMillis ? v.toMillis() : (v?.seconds ? v.seconds * 1000 : (Date.parse(v) || 0)))
              return toMs(b.createdAt) - toMs(a.createdAt)
            } catch (err) {
              return 0
            }
          })
          
          setNotifications(list)
          setLoading(false)
        } catch (error) {
          setLoading(false)
        }
      },
      (error) => {
        setLoading(false)
      }
    )
    
    return () => {
      if (unsub) unsub()
    }
  }, [guestId])

  if (loading) return <div style={{ padding: 20 }}>Loading notifications...</div>

  return (
    <NotificationList
      title="Notifications"
      subtitle="Updates about your reservations and messages"
      items={notifications}
      showFilters={true}
      onItemClick={(n) => {
        if (n.conversationId) {
          navigate(`/guest/${guestId}/chat/${n.conversationId}`)
        } else if (n.reservationId) {
          // Navigate to bookings page when clicking on booking-related notifications
          navigate(`/guest/${guestId}/bookings`)
        } else if (n.listingId) {
          navigate(`/guest/${guestId}/listing/${n.listingId}`)
        }
      }}
    />
  )
}

export default GuestNotifications


