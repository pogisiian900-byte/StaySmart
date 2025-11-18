import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../../config/firebase'
import Logo from '../../../public/static/ss.png'
import Admin_MainContent from './admin-mainContent'
import AdminBookings from './AdminBookings'
import AdminPayouts from './AdminPayouts'
import AdminUsers from './AdminUsers'
import AdminProfile from './AdminProfile'
import AdminReports from './AdminReports'
import AdminSettings from './AdminSettings'
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
      case 'booking':
        return <AdminBookings />
      case 'payout':
        return <AdminPayouts />
      case 'user':
        return <AdminUsers />
      case 'profile':
        return <AdminProfile />
      case 'reports':
        return <AdminReports />
      case 'settings':
        return <AdminSettings />
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
            <span className="icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
            </span>
            <span className="label">Dashboard</span>
          </button>
          <button 
            className={`admin-nav-button ${selectedNav === 'booking' ? 'admin-nav-selected' : ''}`}
            onClick={() => {
              handleNavClick('booking')
              setIsMobileMenuOpen(false)
            }}
          >
            <span className="icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
            </span>
            <span className="label">Booking Management</span>
          </button>
          <button 
            className={`admin-nav-button ${selectedNav === 'payout' ? 'admin-nav-selected' : ''}`}
            onClick={() => {
              handleNavClick('payout')
              setIsMobileMenuOpen(false)
            }}
          >
            <span className="icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23"></line>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
            </span>
            <span className="label">Payout Control</span>
          </button>
          <button 
            className={`admin-nav-button ${selectedNav === 'user' ? 'admin-nav-selected' : ''}`}
            onClick={() => {
              handleNavClick('user')
              setIsMobileMenuOpen(false)
            }}
          >
            <span className="icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </span>
            <span className="label">User Management</span>
          </button>
          <button 
            className={`admin-nav-button ${selectedNav === 'reports' ? 'admin-nav-selected' : ''}`}
            onClick={() => {
              handleNavClick('reports')
              setIsMobileMenuOpen(false)
            }}
          >
            <span className="icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
              </svg>
            </span>
            <span className="label">Reports</span>
          </button>
          <button 
            className={`admin-nav-button ${selectedNav === 'profile' ? 'admin-nav-selected' : ''}`}
            onClick={() => {
              handleNavClick('profile')
              setIsMobileMenuOpen(false)
            }}
          >
            <span className="icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </span>
            <span className="label">Profile</span>
          </button>
          <button 
            className={`admin-nav-button ${selectedNav === 'settings' ? 'admin-nav-selected' : ''}`}
            onClick={() => {
              handleNavClick('settings')
              setIsMobileMenuOpen(false)
            }}
          >
            <span className="icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"></path>
              </svg>
            </span>
            <span className="label">Settings</span>
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
            <span className="icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </span>
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
            <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </div>
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