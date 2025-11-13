import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import Profile from '../../components/Profile'
import HostBookings from './HostBookings'
import Coupon from '../../components/Coupon'
import Reports from '../../components/Reports'

const HostAccountSettings = () => {
  const { hostId } = useParams()
  const [activeTab, setActiveTab] = useState('profile')

  const tabs = [
    { id: 'profile', label: 'Profile' },
    { id: 'reservations', label: 'Reservations' },
    { id: 'coupons', label: 'Coupons' },
    { id: 'reports', label: 'Payment & Transaction Reports' }
  ]

  return (
    <div style={{
      maxWidth: '1400px',
      margin: '0 auto',
      padding: '20px 16px',
      fontFamily: '"Inter", sans-serif'
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '16px',
        padding: '24px 20px',
        marginBottom: '24px',
        boxShadow: '0 10px 40px rgba(102, 126, 234, 0.15)',
        color: 'white'
      }}>
        <h1 style={{
          fontSize: 'clamp(1.5rem, 4vw, 2rem)',
          fontWeight: 700,
          margin: '0 0 8px 0',
          color: 'white',
          letterSpacing: '-0.5px'
        }}>
          Account Settings
        </h1>
        <p style={{
          fontSize: 'clamp(0.875rem, 2.5vw, 1rem)',
          margin: 0,
          color: 'rgba(255, 255, 255, 0.9)',
          fontWeight: 400
        }}>
          Manage your profile, reservations, and view available coupons
        </p>
      </div>

      {/* Tab Navigation */}
      <style>{`
        .account-tabs-container::-webkit-scrollbar {
          display: none;
        }
        .account-tabs-container {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        @media (max-width: 640px) {
          .account-tabs-container {
            gap: 4px;
          }
          .account-tab-button {
            padding: 10px 12px !important;
            font-size: 0.875rem !important;
          }
        }
      `}</style>
      <div 
        className="account-tabs-container"
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '24px',
          borderBottom: '2px solid #e5e7eb',
          paddingBottom: '0',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className="account-tab-button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 16px',
              fontSize: 'clamp(0.875rem, 2.5vw, 1rem)',
              fontWeight: 600,
              border: 'none',
              background: 'transparent',
              color: activeTab === tab.id ? '#667eea' : '#6b7280',
              cursor: 'pointer',
              position: 'relative',
              transition: 'all 0.2s ease',
              borderBottom: activeTab === tab.id ? '3px solid #667eea' : '3px solid transparent',
              marginBottom: '-2px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              minWidth: 'fit-content'
            }}
            onMouseEnter={(e) => {
              if (activeTab !== tab.id) {
                e.target.style.color = '#374151'
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab.id) {
                e.target.style.color = '#6b7280'
              }
            }}
          >
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '0',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
        minHeight: '400px',
        overflow: 'hidden',
        width: '100%'
      }}>
        {activeTab === 'profile' && (
          <div style={{ padding: 'clamp(12px, 3vw, 20px)' }}>
            <Profile />
          </div>
        )}
        {activeTab === 'reservations' && (
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <HostBookings />
          </div>
        )}
        {activeTab === 'coupons' && (
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <Coupon />
          </div>
        )}
        {activeTab === 'reports' && (
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <Reports hostId={hostId} />
          </div>
        )}
      </div>
    </div>
  )
}

export default HostAccountSettings

