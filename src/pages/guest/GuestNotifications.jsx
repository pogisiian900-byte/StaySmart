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
    console.log('🔔 GuestNotifications: useEffect triggered, guestId:', guestId)
    
    if (!guestId) {
      console.log('⚠️ GuestNotifications: No guestId, returning early')
      return
    }
    
    const q = query(
      collection(db, 'Notifications'),
      where('recipientId', '==', guestId)
    )
    
    console.log('🔔 GuestNotifications: Setting up Firestore listener for guestId:', guestId)
    console.log('🔔 GuestNotifications: Query:', q)
    
    const unsub = onSnapshot(
      q, 
      (snap) => {
        console.log('🔔 GuestNotifications: Snapshot received!')
        console.log('🔔 GuestNotifications: Snapshot size:', snap.size)
        console.log('🔔 GuestNotifications: Snapshot empty:', snap.empty)
        
        try {
          const list = []
          snap.forEach((d) => {
            try {
              const data = d.data()
              console.log('🔔 GuestNotifications: Document ID:', d.id)
              console.log('🔔 GuestNotifications: Document data:', data)
              console.log('🔔 GuestNotifications: recipientId in doc:', data.recipientId)
              console.log('🔔 GuestNotifications: guestId from params:', guestId)
              console.log('🔔 GuestNotifications: recipientId matches?', data.recipientId === guestId)
              list.push({ id: d.id, ...data })
            } catch (err) {
              console.error('❌ GuestNotifications: Error processing notification document:', err)
            }
          })
          
          console.log('🔔 GuestNotifications: Total notifications found:', list.length)
          console.log('🔔 GuestNotifications: Notifications list:', list)
          
          list.sort((a, b) => {
            try {
              const toMs = (v) => (v?.toMillis ? v.toMillis() : (v?.seconds ? v.seconds * 1000 : (Date.parse(v) || 0)))
              return toMs(b.createdAt) - toMs(a.createdAt)
            } catch (err) {
              console.error('❌ GuestNotifications: Error sorting:', err)
              return 0
            }
          })
          
          console.log('🔔 GuestNotifications: Setting notifications state with', list.length, 'items')
          setNotifications(list)
          setLoading(false)
        } catch (error) {
          console.error('❌ GuestNotifications: Error processing notifications:', error)
          setLoading(false)
        }
      },
      (error) => {
        console.error('❌ GuestNotifications: Firestore snapshot error:', error)
        console.error('❌ GuestNotifications: Error code:', error.code)
        console.error('❌ GuestNotifications: Error message:', error.message)
        setLoading(false)
      }
    )
    
    return () => {
      console.log('🔔 GuestNotifications: Cleaning up listener')
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


