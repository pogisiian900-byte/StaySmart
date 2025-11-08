import React, { useState, useMemo } from 'react'
import '../pages/booking-responsive.css'

const getStatusClass = (status) => `status-badge status-${(status||'').toLowerCase()}`

// Get icon and color based on notification type
const getNotificationStyle = (notification) => {
  const type = notification.type?.toLowerCase() || ''
  const hasConversationId = !!notification.conversationId
  const hasReservationId = !!notification.reservationId

  // Message notifications
  if (hasConversationId || type.includes('message')) {
    return {
      icon: '💬',
      iconBg: '#dbeafe',
      iconColor: '#1e40af',
      borderColor: '#bfdbfe'
    }
  }

  // Booking confirmed
  if (type.includes('confirmed') || type.includes('booking_confirmed')) {
    return {
      icon: '✅',
      iconBg: '#d1fae5',
      iconColor: '#065f46',
      borderColor: '#a7f3d0'
    }
  }

  // Booking declined
  if (type.includes('declined') || type.includes('booking_declined')) {
    return {
      icon: '❌',
      iconBg: '#fee2e2',
      iconColor: '#991b1b',
      borderColor: '#fecaca'
    }
  }

  // Refund
  if (type.includes('refund')) {
    return {
      icon: '💰',
      iconBg: '#fef3c7',
      iconColor: '#92400e',
      borderColor: '#fde68a'
    }
  }

  // Earnings
  if (type.includes('earnings')) {
    return {
      icon: '💵',
      iconBg: '#dcfce7',
      iconColor: '#166534',
      borderColor: '#bbf7d0'
    }
  }

  // Booking requests
  if (hasReservationId || type.includes('reservation') || type.includes('booking')) {
    return {
      icon: '📅',
      iconBg: '#e0e7ff',
      iconColor: '#3730a3',
      borderColor: '#c7d2fe'
    }
  }

  // Default
  return {
    icon: '🔔',
    iconBg: '#f3f4f6',
    iconColor: '#374151',
    borderColor: '#e5e7eb'
  }
}

const NotificationList = ({ title, subtitle, items = [], onItemClick, showFilters = true }) => {
  const [filter, setFilter] = useState('all') // 'all', 'booking', 'message'

  // Calculate counts for filter buttons
  const bookingCount = useMemo(() => {
    return items.filter(n => 
      n.reservationId || 
      n.type?.includes('booking') || 
      n.type?.includes('reservation') ||
      n.type?.includes('refund') ||
      n.type?.includes('earnings')
    ).length
  }, [items])

  const messageCount = useMemo(() => {
    return items.filter(n => n.conversationId).length
  }, [items])

  // Filter notifications based on selected filter
  const filteredItems = useMemo(() => {
    if (filter === 'all') return items
    
    if (filter === 'booking') {
      // Booking-related notifications: have reservationId or booking-related types
      return items.filter(n => 
        n.reservationId || 
        n.type?.includes('booking') || 
        n.type?.includes('reservation') ||
        n.type?.includes('refund') ||
        n.type?.includes('earnings')
      )
    }
    
    if (filter === 'message') {
      // Message notifications: have conversationId
      return items.filter(n => n.conversationId)
    }
    
    return items
  }, [items, filter])

  // Format time ago
  const getTimeAgo = (timestamp) => {
    if (!timestamp) return ''
    const date = timestamp?.toMillis ? timestamp.toMillis() : (timestamp?.seconds ? timestamp.seconds * 1000 : (Date.parse(timestamp) || Date.now()))
    const now = Date.now()
    const diff = now - date
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div style={{ 
      maxWidth: '1200px', 
      margin: '0 auto', 
      padding: '20px',
      background: '#f9fafb',
      minHeight: '100vh'
    }}
    className="notifications-layout"
    >
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        marginBottom: '24px'
      }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ 
            fontSize: '28px', 
            fontWeight: '700', 
            color: '#111827',
            margin: '0 0 8px 0'
          }}
          className="bookings-title"
          >
            {title}
          </h1>
          {subtitle && (
            <p style={{ 
              fontSize: '14px', 
              color: '#6b7280',
              margin: 0
            }}
            className="bookings-subtext"
            >
              {subtitle}
            </p>
          )}
        </div>
        
        {showFilters && (
          <div style={{ 
            display: 'flex', 
            gap: '12px', 
            flexWrap: 'wrap',
            borderBottom: '1px solid #e5e7eb',
            paddingBottom: '16px'
          }}>
            <button
              onClick={() => setFilter('all')}
              style={{
                padding: '10px 20px',
                borderRadius: '10px',
                border: 'none',
                background: filter === 'all' ? '#3b82f6' : '#f3f4f6',
                color: filter === 'all' ? 'white' : '#4b5563',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: filter === 'all' ? '600' : '500',
                transition: 'all 0.2s',
                boxShadow: filter === 'all' ? '0 2px 4px rgba(59, 130, 246, 0.3)' : 'none'
              }}
              onMouseEnter={(e) => {
                if (filter !== 'all') {
                  e.target.style.background = '#e5e7eb'
                }
              }}
              onMouseLeave={(e) => {
                if (filter !== 'all') {
                  e.target.style.background = '#f3f4f6'
                }
              }}
            >
              All <span style={{ marginLeft: '6px', opacity: 0.8 }}>({items.length})</span>
            </button>
            <button
              onClick={() => setFilter('booking')}
              style={{
                padding: '10px 20px',
                borderRadius: '10px',
                border: 'none',
                background: filter === 'booking' ? '#3b82f6' : '#f3f4f6',
                color: filter === 'booking' ? 'white' : '#4b5563',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: filter === 'booking' ? '600' : '500',
                transition: 'all 0.2s',
                boxShadow: filter === 'booking' ? '0 2px 4px rgba(59, 130, 246, 0.3)' : 'none'
              }}
              onMouseEnter={(e) => {
                if (filter !== 'booking') {
                  e.target.style.background = '#e5e7eb'
                }
              }}
              onMouseLeave={(e) => {
                if (filter !== 'booking') {
                  e.target.style.background = '#f3f4f6'
                }
              }}
            >
              Booking <span style={{ marginLeft: '6px', opacity: 0.8 }}>({bookingCount})</span>
            </button>
            <button
              onClick={() => setFilter('message')}
              style={{
                padding: '10px 20px',
                borderRadius: '10px',
                border: 'none',
                background: filter === 'message' ? '#3b82f6' : '#f3f4f6',
                color: filter === 'message' ? 'white' : '#4b5563',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: filter === 'message' ? '600' : '500',
                transition: 'all 0.2s',
                boxShadow: filter === 'message' ? '0 2px 4px rgba(59, 130, 246, 0.3)' : 'none'
              }}
              onMouseEnter={(e) => {
                if (filter !== 'message') {
                  e.target.style.background = '#e5e7eb'
                }
              }}
              onMouseLeave={(e) => {
                if (filter !== 'message') {
                  e.target.style.background = '#f3f4f6'
                }
              }}
            >
              Messages <span style={{ marginLeft: '6px', opacity: 0.8 }}>({messageCount})</span>
            </button>
          </div>
        )}
      </div>
      
      {filteredItems.length === 0 ? (
        <div style={{ 
          background: 'white',
          borderRadius: '16px',
          padding: '48px 24px',
          textAlign: 'center',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔔</div>
          <p style={{ 
            fontSize: '16px', 
            color: '#6b7280',
            margin: 0,
            fontWeight: '500'
          }}>
            {filter === 'all' ? 'No notifications yet.' : `No ${filter} notifications.`}
          </p>
          <p style={{ 
            fontSize: '14px', 
            color: '#9ca3af',
            margin: '8px 0 0 0'
          }}>
            {filter === 'all' ? 'You\'ll see notifications here when you receive updates.' : 'Try selecting a different filter.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredItems.map((n) => {
            const style = getNotificationStyle(n)
            const isUnread = !n.read
            const timeAgo = getTimeAgo(n.createdAt)
            
            return (
              <div
                key={n.id}
                onClick={() => onItemClick && onItemClick(n)}
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '18px 20px',
                  display: 'flex',
                  gap: '16px',
                  alignItems: 'flex-start',
                  cursor: onItemClick ? 'pointer' : 'default',
                  border: `2px solid ${isUnread ? style.borderColor : '#e5e7eb'}`,
                  boxShadow: isUnread 
                    ? `0 2px 8px rgba(0, 0, 0, 0.08), 0 0 0 1px ${style.borderColor}40`
                    : '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                className="notification-card-modern"
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = `0 4px 12px rgba(0, 0, 0, 0.12), 0 0 0 1px ${style.borderColor}60`
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = isUnread 
                    ? `0 2px 8px rgba(0, 0, 0, 0.08), 0 0 0 1px ${style.borderColor}40`
                    : '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
                }}
              >
                {isUnread && (
                  <div style={{
                    position: 'absolute',
                    top: '18px',
                    right: '20px',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#3b82f6',
                    boxShadow: '0 0 0 2px white'
                  }} />
                )}
                
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: style.iconBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  flexShrink: 0,
                  border: `1px solid ${style.borderColor}`
                }}
                className="notification-icon-modern"
                >
                  {style.icon}
                </div>
                
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'flex-start',
                    gap: '12px',
                    marginBottom: '8px'
                  }}>
                    <h3 style={{ 
                      margin: 0, 
                      fontSize: '16px',
                      fontWeight: isUnread ? '700' : '600',
                      color: '#111827',
                      lineHeight: '1.4'
                    }}
                    className="notification-title-modern"
                    >
                      {n.title || 'Notification'}
                    </h3>
                    {n.status && (
                      <span className={getStatusClass(n.status)} style={{
                        flexShrink: 0,
                        fontSize: '12px',
                        padding: '4px 8px',
                        borderRadius: '6px'
                      }}>
                        {n.status}
                      </span>
                    )}
                  </div>
                  
                  {n.message && (
                    <p style={{ 
                      margin: '0 0 12px 0',
                      fontSize: '14px',
                      color: '#4b5563',
                      lineHeight: '1.5'
                    }}>
                      {n.message}
                    </p>
                  )}
                  
                  <div style={{ 
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    fontSize: '13px',
                    color: '#6b7280'
                  }}>
                    {n.listingTitle && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 8px',
                        background: '#f3f4f6',
                        borderRadius: '6px',
                        fontSize: '12px'
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                          <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                        {n.listingTitle}
                      </span>
                    )}
                    {timeAgo && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"></circle>
                          <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        {timeAgo}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default NotificationList


