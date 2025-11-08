import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../../config/firebase'
import Logo from '../../../public/static/ss.png'
import Admin_MainContent from './admin-mainContent'
import 'dialog-polyfill/dist/dialog-polyfill.css'
import dialogPolyfill from 'dialog-polyfill'

const Admin_Navigation = () => {
  const [selectedNav, setSelectedNav] = useState('dashboard')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)
  const logoutDialogRef = useRef(null)
  const navigate = useNavigate()

  // Register dialog polyfill
  useEffect(() => {
    if (logoutDialogRef.current && !logoutDialogRef.current.showModal) {
      dialogPolyfill.registerDialog(logoutDialogRef.current)
    }
  }, [])

  const handleNavClick = (nav) => {
    setSelectedNav(nav)
  }

  const showLogoutConfirmation = () => {
    setShowLogoutDialog(true)
    if (logoutDialogRef.current) {
      try {
        if (typeof logoutDialogRef.current.showModal === 'function') {
          logoutDialogRef.current.showModal()
        } else {
          dialogPolyfill.registerDialog(logoutDialogRef.current)
          logoutDialogRef.current.showModal()
        }
      } catch (err) {
        console.error('Error showing logout dialog:', err)
        logoutDialogRef.current.style.display = 'block'
      }
    }
  }

  const handleCloseLogoutDialog = () => {
    setShowLogoutDialog(false)
    logoutDialogRef.current?.close()
  }

  const handleLogout = async () => {
    try {
      handleCloseLogoutDialog()
      await signOut(auth)
      console.log('Admin logged out')
      navigate('/login', { replace: true })
    } catch (err) {
      console.error('Logout failed:', err.message)
      alert('Failed to logout. Please try again.')
    }
  }

  const renderContent = () => {
    switch(selectedNav) {
      case 'dashboard':
        return <Admin_MainContent />
      case 'subscription':
        return <div>Subscription Management</div>
      case 'review':
        return <div>Review Management</div>
      case 'booking':
        return <div>Booking Management</div>
      case 'payout':
        return <div>Payout Control</div>
      case 'user':
        return <div>User Management</div>
      default:
        return <Admin_MainContent />
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="admin-mobile-overlay" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}
      
      {/* Mobile Menu Button */}
      <button 
        className="admin-mobile-menu-button"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        aria-label="Toggle menu"
      >
        <span className={isMobileMenuOpen ? 'open' : ''}></span>
        <span className={isMobileMenuOpen ? 'open' : ''}></span>
        <span className={isMobileMenuOpen ? 'open' : ''}></span>
      </button>

      <div className={`admin-navBar ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
        <button 
          className="admin-mobile-close-button"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-label="Close menu"
        >
          ✕
        </button>
        <div className="admin-nav-button-group">
          <img src={Logo} alt="Stay Smart" className="admin-logo" />
          <button 
            className={`admin-dashboard-button ${selectedNav === 'dashboard' ? 'admin-nav-selected' : ''}`}
            onClick={() => {
              handleNavClick('dashboard')
              setIsMobileMenuOpen(false)
            }}
          >
            <span className="icon">🏠</span>
            <span className="label">Dashboard</span>
          </button>
          <button 
            className={`admin-nav-button ${selectedNav === 'subscription' ? 'admin-nav-selected' : ''}`}
            onClick={() => {
              handleNavClick('subscription')
              setIsMobileMenuOpen(false)
            }}
          >
            <span className="icon">💳</span>
            <span className="label">Subscription Management</span>
          </button>
          <button 
            className={`admin-nav-button ${selectedNav === 'review' ? 'admin-nav-selected' : ''}`}
            onClick={() => {
              handleNavClick('review')
              setIsMobileMenuOpen(false)
            }}
          >
            <span className="icon">⭐</span>
            <span className="label">Review Management</span>
          </button>
          <button 
            className={`admin-nav-button ${selectedNav === 'booking' ? 'admin-nav-selected' : ''}`}
            onClick={() => {
              handleNavClick('booking')
              setIsMobileMenuOpen(false)
            }}
          >
            <span className="icon">📅</span>
            <span className="label">Booking Management</span>
          </button>
          <button 
            className={`admin-nav-button ${selectedNav === 'payout' ? 'admin-nav-selected' : ''}`}
            onClick={() => {
              handleNavClick('payout')
              setIsMobileMenuOpen(false)
            }}
          >
            <span className="icon">💰</span>
            <span className="label">Payout Control</span>
          </button>
          <button 
            className={`admin-nav-button ${selectedNav === 'user' ? 'admin-nav-selected' : ''}`}
            onClick={() => {
              handleNavClick('user')
              setIsMobileMenuOpen(false)
            }}
          >
            <span className="icon">👤</span>
            <span className="label">User Management</span>
          </button>
        </div>
        
        <div className="admin-logout-section">
          <button 
            className="admin-logout-button"
            onClick={() => {
              showLogoutConfirmation()
              setIsMobileMenuOpen(false)
            }}
          >
            <span className="icon">🚪</span>
            <span className="label">Logout</span>
          </button>
        </div>
      </div>
      <div className="admin-main-content-wrapper">
        {renderContent()}
      </div>

      {/* Logout Confirmation Dialog */}
      {showLogoutDialog && (
        <dialog ref={logoutDialogRef} className="logout-confirmation-dialog" style={{ maxWidth: '500px', width: '90%', border: 'none', borderRadius: '16px', padding: 0, boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)' }}>
          <style>
            {`.logout-confirmation-dialog::backdrop {
              background: rgba(0, 0, 0, 0.5);
              backdrop-filter: blur(4px);
            }`}
          </style>
          <div style={{ padding: '30px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>🚪</div>
            <h2 style={{ margin: '0 0 15px 0', fontSize: '24px', fontWeight: '600', color: '#1f2937' }}>
              Confirm Logout
            </h2>
            <p style={{ margin: '0 0 30px 0', fontSize: '16px', color: '#6b7280', lineHeight: '1.5' }}>
              Are you sure you want to logout? You will need to login again to access your account.
            </p>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
              <button
                onClick={handleCloseLogoutDialog}
                style={{
                  padding: '12px 24px',
                  fontSize: '16px',
                  fontWeight: '600',
                  borderRadius: '8px',
                  border: '2px solid #e5e7eb',
                  background: 'white',
                  color: '#374151',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.target.style.background = '#f9fafb'
                  e.target.style.borderColor = '#d1d5db'
                }}
                onMouseOut={(e) => {
                  e.target.style.background = 'white'
                  e.target.style.borderColor = '#e5e7eb'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                style={{
                  padding: '12px 24px',
                  fontSize: '16px',
                  fontWeight: '600',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#31326F',
                  color: 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.target.style.background = '#252550'
                }}
                onMouseOut={(e) => {
                  e.target.style.background = '#31326F'
                }}
              >
                Logout
              </button>
            </div>
          </div>
        </dialog>
      )}
    </div>
  )
}

export default Admin_Navigation