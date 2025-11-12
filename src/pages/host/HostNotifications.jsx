import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../../config/firebase'
import NotificationList from '../../components/NotificationList'

const HostNotifications = () => {
  const { hostId } = useParams()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!hostId) {
      return
    }
    
    // Query ALL notifications and filter client-side to support both old and new formats
    // Old format: has hostId but no recipientId
    // New format: has recipientId
    const allNotificationsQuery = query(collection(db, 'Notifications'))
    
    const unsub = onSnapshot(
      allNotificationsQuery, 
      (snap) => {
        try {
          const list = []
          snap.forEach((d) => {
            try {
              const data = d.data()
              const hasRecipientId = data.recipientId === hostId
              const hasOldFormatHostId = data.hostId === hostId && !data.recipientId
              
              // Include if: new format (recipientId matches) OR old format (hostId matches but no recipientId)
              if (hasRecipientId || hasOldFormatHostId) {
                // If old format, add recipientId for consistency
                if (hasOldFormatHostId && !data.recipientId) {
                  data.recipientId = data.hostId
                }
                
                list.push({ id: d.id, ...data })
              }
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
  }, [hostId])

  if (loading) return <div style={{ padding: 20 }}>Loading notifications...</div>

  return (
    <NotificationList
      title="Notifications"
      subtitle="Updates about booking requests and guest messages"
      items={notifications}
      showFilters={true}
      onItemClick={(n) => {
        if (n.conversationId) {
          navigate(`/host/${hostId}/chat/${n.conversationId}`)
        } else if (n.reservationId || n.navigateTo === 'bookings') {
          // Navigate to bookings page when clicking on booking-related notifications
          navigate(`/host/${hostId}/bookings`)
        } else if (n.listingId) {
          navigate(`/host/${hostId}/${n.listingId}`)
        }
      }}
    />
  )
}

export default HostNotifications


