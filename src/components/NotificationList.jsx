import React from 'react'

const getStatusClass = (status) => `status-badge status-${(status||'').toLowerCase()}`

const NotificationList = ({ title, subtitle, items = [], onItemClick }) => {
  return (
    <div className="notifications-layout">
      <div className="bookings-header">
        <div>
          <h2 className="bookings-title">{title}</h2>
          {subtitle && <p className="bookings-subtext">{subtitle}</p>}
        </div>
      </div>
      {items.length === 0 && (
        <div style={{ padding: 12, color: '#666' }}>No notifications.</div>
      )}
      <div className="notification-list">
        {items.map((n) => (
          <div key={n.id} className="notification-card" onClick={() => onItemClick && onItemClick(n)} style={{ cursor: onItemClick ? 'pointer' : 'default' }}>
            <div className="notification-icon">🔔</div>
            <div className="notification-content">
              <div style={{ display:'flex', justifyContent:'space-between', gap:8, alignItems:'baseline' }}>
                <h4 className="notification-title">{n.title || 'Notification'}</h4>
                {n.status && <span className={getStatusClass(n.status)}>{n.status}</span>}
              </div>
              {n.message && <p className="notification-message">{n.message}</p>}
              <div className="notification-meta">
                {n.listingTitle && <span>{n.listingTitle}</span>}
                {n.createdAt && <span>{new Date(n.createdAt?.toMillis ? n.createdAt.toMillis() : n.createdAt).toLocaleString()}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default NotificationList


