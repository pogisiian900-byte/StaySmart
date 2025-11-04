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
    if (!guestId) return
    const q = query(
      collection(db, 'Notifications'),
      where('recipientId', '==', guestId)
    )
    const unsub = onSnapshot(q, (snap) => {
      const list = []
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }))
      list.sort((a, b) => {
        const toMs = (v) => (v?.toMillis ? v.toMillis() : (v?.seconds ? v.seconds * 1000 : (Date.parse(v) || 0)))
        return toMs(b.createdAt) - toMs(a.createdAt)
      })
      setNotifications(list)
      setLoading(false)
    })
    return () => unsub()
  }, [guestId])

  if (loading) return <div style={{ padding: 20 }}>Loading notifications...</div>

  return (
    <NotificationList
      title="Notifications"
      subtitle="Updates about your reservations and messages"
      items={notifications}
      onItemClick={(n) => {
        if (n.conversationId) navigate(`/guest/${guestId}/chat/${n.conversationId}`)
        else if (n.listingId) navigate(`/guest/${guestId}/listing/${n.listingId}`)
      }}
    />
  )
}

export default GuestNotifications


