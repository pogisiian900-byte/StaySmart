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
    if (!hostId) return
    const q = query(
      collection(db, 'Notifications'),
      where('recipientId', '==', hostId)
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
  }, [hostId])

  if (loading) return <div style={{ padding: 20 }}>Loading notifications...</div>

  return (
    <NotificationList
      title="Notifications"
      subtitle="Updates about booking requests and guest messages"
      items={notifications}
      onItemClick={(n) => {
        if (n.conversationId) navigate(`/host/${hostId}/chat/${n.conversationId}`)
        else if (n.listingId) navigate(`/host/${hostId}/${n.listingId}`)
        else if (n.navigateTo === 'bookings') navigate(`/host/${hostId}/bookings`)
      }}
    />
  )
}

export default HostNotifications


