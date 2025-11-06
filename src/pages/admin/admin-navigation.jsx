import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../../config/firebase'
import Logo from '../../../public/static/ss.png'
import Admin_MainContent from './admin-mainContent'

const Admin_Navigation = () => {
  const [selectedNav, setSelectedNav] = useState('dashboard')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const navigate = useNavigate()

  const handleNavClick = (nav) => {
    setSelectedNav(nav)
  }

  const handleLogout = async () => {
    try {
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
              handleLogout()
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
    </div>
  )
}

export default Admin_Navigation