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
    console.log('🔔 HostNotifications: useEffect triggered, hostId:', hostId)
    console.log('🔔 HostNotifications: hostId type:', typeof hostId)
    console.log('🔔 HostNotifications: hostId value:', JSON.stringify(hostId))
    
    if (!hostId) {
      console.log('⚠️ HostNotifications: No hostId, returning early')
      return
    }
    
    // Query ALL notifications and filter client-side to support both old and new formats
    // Old format: has hostId but no recipientId
    // New format: has recipientId
    const allNotificationsQuery = query(collection(db, 'Notifications'))
    console.log('🔔 HostNotifications: Setting up Firestore listener for hostId:', hostId)
    console.log('🔔 HostNotifications: Querying ALL notifications (will filter client-side)')
    
    const unsub = onSnapshot(
      allNotificationsQuery, 
      (snap) => {
        console.log('🔔 HostNotifications: Snapshot received!')
        console.log('🔔 HostNotifications: Total notifications in DB:', snap.size)
        
        try {
          const list = []
          snap.forEach((d) => {
            try {
              const data = d.data()
              const hasRecipientId = data.recipientId === hostId
              const hasOldFormatHostId = data.hostId === hostId && !data.recipientId
              
              // Include if: new format (recipientId matches) OR old format (hostId matches but no recipientId)
              if (hasRecipientId || hasOldFormatHostId) {
                console.log('✅ HostNotifications: Including notification:', {
                  id: d.id,
                  recipientId: data.recipientId,
                  hostId: data.hostId,
                  title: data.title,
                  format: hasRecipientId ? 'new' : 'old'
                })
                
                // If old format, add recipientId for consistency
                if (hasOldFormatHostId && !data.recipientId) {
                  data.recipientId = data.hostId
                  console.log('🔄 HostNotifications: Adding recipientId to old format notification')
                }
                
                list.push({ id: d.id, ...data })
              }
            } catch (err) {
              console.error('❌ HostNotifications: Error processing notification document:', err)
            }
          })
          
          console.log('🔔 HostNotifications: Total notifications found after filtering:', list.length)
          console.log('🔔 HostNotifications: Notifications list:', list)
          
          list.sort((a, b) => {
            try {
              const toMs = (v) => (v?.toMillis ? v.toMillis() : (v?.seconds ? v.seconds * 1000 : (Date.parse(v) || 0)))
              return toMs(b.createdAt) - toMs(a.createdAt)
            } catch (err) {
              console.error('❌ HostNotifications: Error sorting:', err)
              return 0
            }
          })
          
          console.log('🔔 HostNotifications: Setting notifications state with', list.length, 'items')
          setNotifications(list)
          setLoading(false)
        } catch (error) {
          console.error('❌ HostNotifications: Error processing notifications:', error)
          setLoading(false)
        }
      },
      (error) => {
        console.error('❌ HostNotifications: Firestore snapshot error:', error)
        console.error('❌ HostNotifications: Error code:', error.code)
        console.error('❌ HostNotifications: Error message:', error.message)
        setLoading(false)
      }
    )
    
    return () => {
      console.log('🔔 HostNotifications: Cleaning up listener')
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


