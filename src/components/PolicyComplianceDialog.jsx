import React, { useState, useEffect, useRef } from 'react'
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../config/firebase'
import 'dialog-polyfill/dist/dialog-polyfill.css'
import dialogPolyfill from 'dialog-polyfill'

const PolicyComplianceDialog = ({ userId, userEmail, onPolicyAccepted }) => {
  const [showDialog, setShowDialog] = useState(false)
  const [policyAccepted, setPolicyAccepted] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [loading, setLoading] = useState(true)
  const dialogRef = useRef(null)

  useEffect(() => {
    const checkPolicyStatus = async () => {
      if (!userId) {
        setLoading(false)
        return
      }

      try {
        const userRef = doc(db, 'Users', userId)
        const userSnap = await getDoc(userRef)
        
        if (userSnap.exists()) {
          const userData = userSnap.data()
          // Check if policy has been accepted
          if (userData.policyAccepted && userData.policyAcceptedAt) {
            setPolicyAccepted(true)
            setShowDialog(false)
          } else {
            setShowDialog(true)
          }
        } else {
          setShowDialog(true)
        }
      } catch (error) {
        console.error('Error checking policy status:', error)
        setShowDialog(true)
      } finally {
        setLoading(false)
      }
    }

    checkPolicyStatus()
  }, [userId])

  useEffect(() => {
    if (dialogRef.current && !dialogRef.current.showModal) {
      dialogPolyfill.registerDialog(dialogRef.current)
    }
  }, [])

  useEffect(() => {
    if (showDialog && dialogRef.current) {
      setTimeout(() => {
        try {
          if (typeof dialogRef.current.showModal === 'function') {
            dialogRef.current.showModal()
          } else {
            dialogPolyfill.registerDialog(dialogRef.current)
            dialogRef.current.showModal()
          }
        } catch (err) {
          console.error('Error showing dialog:', err)
          dialogRef.current.style.display = 'block'
        }
      }, 100)
    }
  }, [showDialog])

  const handleAccept = async () => {
    if (!termsAccepted) {
      alert('Please accept the Terms and Conditions to continue.')
      return
    }

    try {
      const userRef = doc(db, 'Users', userId)
      await updateDoc(userRef, {
        policyAccepted: true,
        policyAcceptedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })

      setPolicyAccepted(true)
      setShowDialog(false)
      if (dialogRef.current) {
        dialogRef.current.close()
      }
      // Call the callback if provided
      if (onPolicyAccepted) {
        onPolicyAccepted()
      }
    } catch (error) {
      console.error('Error accepting policy:', error)
      alert('Failed to save policy acceptance. Please try again.')
    }
  }

  if (loading || policyAccepted) {
    return null
  }

  return (
    <>
      <style>{`
        .policy-dialog::backdrop {
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
        }
        .policy-dialog {
          max-width: 600px;
          width: 90%;
          border: none;
          border-radius: 20px;
          padding: 0;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        .policy-dialog[open] {
          animation: slideIn 0.3s ease-out;
        }
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      <dialog ref={dialogRef} className="policy-dialog" style={{ display: showDialog ? 'block' : 'none' }}>
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: '32px',
          borderRadius: '20px 20px 0 0',
          color: 'white',
          position: 'relative'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px',
            backdropFilter: 'blur(10px)'
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="M9 12l2 2 4-4"/>
            </svg>
          </div>
          <h2 style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            margin: '0 0 8px 0',
            color: 'white'
          }}>
            Terms and Conditions
          </h2>
          <p style={{
            fontSize: '1rem',
            margin: 0,
            color: 'rgba(255, 255, 255, 0.9)'
          }}>
            Please read and accept our terms to continue
          </p>
        </div>

        <div style={{ padding: '32px', maxHeight: '60vh', overflowY: 'auto' }}>
          <div style={{
            background: '#f9fafb',
            borderRadius: '12px',
            padding: '24px',
            border: '1px solid #e5e7eb',
            marginBottom: '24px'
          }}>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              color: '#1f2937',
              margin: '0 0 16px 0'
            }}>
              StaySmart Terms and Conditions
            </h3>
            <div style={{
              fontSize: '0.9rem',
              color: '#4b5563',
              lineHeight: '1.8'
            }}>
              <p style={{ margin: '0 0 16px 0' }}>
                <strong>1. Acceptance of Terms</strong><br />
                By accessing and using StaySmart, you accept and agree to be bound by the terms and provision of this agreement.
              </p>
              
              <p style={{ margin: '0 0 16px 0' }}>
                <strong>2. User Responsibilities</strong><br />
                You are responsible for maintaining the confidentiality of your account and password. You agree to accept responsibility for all activities that occur under your account.
              </p>
              
              <p style={{ margin: '0 0 16px 0' }}>
                <strong>3. Booking and Payment</strong><br />
                All bookings are subject to availability and confirmation. Payment must be made in full at the time of booking unless otherwise specified. Cancellation policies apply as stated in individual listings.
              </p>
              
              <p style={{ margin: '0 0 16px 0' }}>
                <strong>4. Privacy and Data Protection</strong><br />
                We are committed to protecting your privacy. Your personal information will be used in accordance with our Privacy Policy. We implement appropriate security measures to protect your data.
              </p>
              
              <p style={{ margin: '0 0 16px 0' }}>
                <strong>5. Prohibited Activities</strong><br />
                You agree not to use the platform for any unlawful purpose or in any way that could damage, disable, or impair the service. Harassment, fraud, or misrepresentation is strictly prohibited.
              </p>
              
              <p style={{ margin: '0 0 16px 0' }}>
                <strong>6. Limitation of Liability</strong><br />
                StaySmart acts as an intermediary between hosts and guests. We are not responsible for the quality, safety, or legality of listings, or the accuracy of information provided by users.
              </p>
              
              <p style={{ margin: '0 0 16px 0' }}>
                <strong>7. Modifications to Terms</strong><br />
                We reserve the right to modify these terms at any time. Continued use of the platform after changes constitutes acceptance of the new terms.
              </p>
              
              <p style={{ margin: 0 }}>
                <strong>8. Contact Information</strong><br />
                For questions about these Terms and Conditions, please contact us through our support channels.
              </p>
            </div>
          </div>

          <label style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            padding: '16px',
            background: termsAccepted ? '#f0f9ff' : '#f9fafb',
            border: `2px solid ${termsAccepted ? '#3b82f6' : '#e5e7eb'}`,
            borderRadius: '12px',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}>
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={() => setTermsAccepted(!termsAccepted)}
              style={{
                width: '20px',
                height: '20px',
                marginTop: '2px',
                cursor: 'pointer',
                accentColor: '#3b82f6'
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{
                fontWeight: 600,
                color: '#1f2937',
                marginBottom: '4px',
                fontSize: '1rem'
              }}>
                I accept the Terms and Conditions
              </div>
              <div style={{
                fontSize: '0.875rem',
                color: '#6b7280',
                lineHeight: '1.5'
              }}>
                I have read and agree to abide by StaySmart's Terms and Conditions, Privacy Policy, and Community Guidelines.
              </div>
            </div>
          </label>
        </div>

        <div style={{
          padding: '24px 32px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
          background: '#fafafa',
          borderRadius: '0 0 20px 20px'
        }}>
          <button
            onClick={handleAccept}
            disabled={!termsAccepted}
            style={{
              padding: '12px 32px',
              fontSize: '1rem',
              fontWeight: 600,
              borderRadius: '10px',
              border: 'none',
              background: termsAccepted 
                ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' 
                : '#d1d5db',
              color: 'white',
              cursor: termsAccepted ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s ease',
              boxShadow: termsAccepted ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none'
            }}
            onMouseEnter={(e) => {
              if (termsAccepted) {
                e.target.style.transform = 'translateY(-2px)'
                e.target.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.4)'
              }
            }}
            onMouseLeave={(e) => {
              if (termsAccepted) {
                e.target.style.transform = 'translateY(0)'
                e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)'
              }
            }}
          >
            Accept & Continue
          </button>
        </div>
      </dialog>
    </>
  )
}

export default PolicyComplianceDialog

