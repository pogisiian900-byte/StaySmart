import React, { useEffect, useState, useRef } from 'react'
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot, collection, getDocs, updateDoc, writeBatch } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { useAuth } from '../../layout/AuthContext'
import Loading from '../../components/Loading'
import { generatePolicyPDF } from '../../utils/pdfGenerators/policyPDF'
import 'dialog-polyfill/dist/dialog-polyfill.css'
import dialogPolyfill from 'dialog-polyfill'

const AdminSettings = () => {
  const { user: authUser } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [serviceFeePercent, setServiceFeePercent] = useState(10) // Default 10%
  const [originalServiceFee, setOriginalServiceFee] = useState(10)
  const [policyText, setPolicyText] = useState('')
  const [originalPolicyText, setOriginalPolicyText] = useState('')
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showPolicyConfirmDialog, setShowPolicyConfirmDialog] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const confirmDialogRef = useRef(null)
  const policyConfirmDialogRef = useRef(null)

  // System settings document ID
  const SYSTEM_SETTINGS_ID = 'system_settings'

  // Default policy text
  const getDefaultPolicyText = () => {
    return `1. Acceptance of Terms
By accessing and using StaySmart, you accept and agree to be bound by the terms and provision of this agreement.

2. User Responsibilities
You are responsible for maintaining the confidentiality of your account and password. You agree to accept responsibility for all activities that occur under your account.

3. Booking and Payment
All bookings are subject to availability and confirmation. Payment must be made in full at the time of booking unless otherwise specified. Cancellation policies apply as stated in individual listings.

4. Privacy and Data Protection
We are committed to protecting your privacy. Your personal information will be used in accordance with our Privacy Policy. We implement appropriate security measures to protect your data.

5. Prohibited Activities
You agree not to use the platform for any unlawful purpose or in any way that could damage, disable, or impair the service. Harassment, fraud, or misrepresentation is strictly prohibited.

6. Limitation of Liability
StaySmart acts as an intermediary between hosts and guests. We are not responsible for the quality, safety, or legality of listings, or the accuracy of information provided by users.

7. Modifications to Terms
We reserve the right to modify these terms at any time. Continued use of the platform after changes constitutes acceptance of the new terms.

8. Contact Information
For questions about these Terms and Conditions, please contact us through our support channels.`
  }

  // Register dialog polyfill
  useEffect(() => {
    if (confirmDialogRef.current && !confirmDialogRef.current.showModal) {
      dialogPolyfill.registerDialog(confirmDialogRef.current)
    }
    if (policyConfirmDialogRef.current && !policyConfirmDialogRef.current.showModal) {
      dialogPolyfill.registerDialog(policyConfirmDialogRef.current)
    }
  }, [showConfirmDialog, showPolicyConfirmDialog])

  // Fetch system settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true)
        const settingsRef = doc(db, 'SystemSettings', SYSTEM_SETTINGS_ID)
        const settingsSnap = await getDoc(settingsRef)

        if (settingsSnap.exists()) {
          const data = settingsSnap.data()
          const feePercent = data.serviceFeePercent || 10
          const policy = data.policyText || getDefaultPolicyText()
          setServiceFeePercent(feePercent)
          setOriginalServiceFee(feePercent)
          setPolicyText(policy)
          setOriginalPolicyText(policy)
        } else {
          // Create default settings if they don't exist
          const defaultPolicy = getDefaultPolicyText()
          await setDoc(settingsRef, {
            serviceFeePercent: 10,
            policyText: defaultPolicy,
            policyLastUpdated: serverTimestamp(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          })
          setServiceFeePercent(10)
          setOriginalServiceFee(10)
          setPolicyText(defaultPolicy)
          setOriginalPolicyText(defaultPolicy)
        }
      } catch (error) {
        console.error('Error fetching settings:', error)
        setError('Failed to load settings. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [])

  // Show confirmation dialog
  const handleShowConfirmDialog = () => {
    const feeValue = parseFloat(serviceFeePercent)
    
    if (isNaN(feeValue) || feeValue < 0 || feeValue > 100) {
      setError('Service fee must be between 0 and 100 percent.')
      return
    }

    if (feeValue === originalServiceFee) {
      setError('No changes to save.')
      return
    }

    setShowConfirmDialog(true)
    if (confirmDialogRef.current) {
      try {
        if (typeof confirmDialogRef.current.showModal === 'function') {
          confirmDialogRef.current.showModal()
        } else {
          dialogPolyfill.registerDialog(confirmDialogRef.current)
          confirmDialogRef.current.showModal()
        }
      } catch (err) {
        console.error('Error showing confirm dialog:', err)
        confirmDialogRef.current.style.display = 'block'
      }
    }
  }

  // Close confirmation dialog
  const handleCloseConfirmDialog = () => {
    setShowConfirmDialog(false)
    confirmDialogRef.current?.close()
  }

  // Save settings
  const handleSaveSettings = async () => {
    handleCloseConfirmDialog()
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const feeValue = parseFloat(serviceFeePercent)
      
      if (isNaN(feeValue) || feeValue < 0 || feeValue > 100) {
        setError('Service fee must be between 0 and 100 percent.')
        setSaving(false)
        return
      }

      const settingsRef = doc(db, 'SystemSettings', SYSTEM_SETTINGS_ID)
      
      await setDoc(settingsRef, {
        serviceFeePercent: feeValue,
        updatedAt: serverTimestamp(),
        updatedBy: authUser?.uid || 'admin'
      }, { merge: true })

      setOriginalServiceFee(feeValue)
      setSuccess(`Service fee updated to ${feeValue}% successfully!`)
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setSuccess(null)
      }, 5000)
    } catch (error) {
      console.error('Error saving settings:', error)
      setError('Failed to save settings. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // Show policy confirmation dialog
  const handleShowPolicyConfirmDialog = () => {
    const trimmedPolicy = policyText.trim()
    
    if (!trimmedPolicy) {
      setError('Policy text cannot be empty.')
      return
    }

    if (trimmedPolicy === originalPolicyText.trim()) {
      setError('No changes to save.')
      return
    }

    setShowPolicyConfirmDialog(true)
    if (policyConfirmDialogRef.current) {
      try {
        if (typeof policyConfirmDialogRef.current.showModal === 'function') {
          policyConfirmDialogRef.current.showModal()
        } else {
          dialogPolyfill.registerDialog(policyConfirmDialogRef.current)
          policyConfirmDialogRef.current.showModal()
        }
      } catch (err) {
        console.error('Error showing policy confirm dialog:', err)
        policyConfirmDialogRef.current.style.display = 'block'
      }
    }
  }

  // Close policy confirmation dialog
  const handleClosePolicyConfirmDialog = () => {
    setShowPolicyConfirmDialog(false)
    policyConfirmDialogRef.current?.close()
  }

  // Save policy and reset all users' acceptance
  const handleSavePolicy = async () => {
    handleClosePolicyConfirmDialog()
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const trimmedPolicy = policyText.trim()
      
      if (!trimmedPolicy) {
        setError('Policy text cannot be empty.')
        setSaving(false)
        return
      }

      const settingsRef = doc(db, 'SystemSettings', SYSTEM_SETTINGS_ID)
      
      // Update policy in SystemSettings
      await setDoc(settingsRef, {
        policyText: trimmedPolicy,
        policyLastUpdated: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: authUser?.uid || 'admin'
      }, { merge: true })

      // Reset all users' policy acceptance
      setSuccess('Updating policy and resetting user acceptances...')
      
      try {
        const usersSnapshot = await getDocs(collection(db, 'Users'))
        const users = usersSnapshot.docs
        const BATCH_SIZE = 500 // Firestore batch limit
        let updatedCount = 0

        // Process users in batches of 500
        for (let i = 0; i < users.length; i += BATCH_SIZE) {
          const batch = writeBatch(db)
          const batchUsers = users.slice(i, i + BATCH_SIZE)
          
          batchUsers.forEach((userDoc) => {
            const userRef = doc(db, 'Users', userDoc.id)
            batch.update(userRef, {
              policyAccepted: false,
              policyAcceptedAt: null,
              updatedAt: serverTimestamp()
            })
          })

          await batch.commit()
          updatedCount += batchUsers.length
        }

        setOriginalPolicyText(trimmedPolicy)
        setSuccess(`Policy updated successfully! All ${updatedCount} users will need to re-accept the updated terms.`)
      } catch (resetError) {
        console.error('Error resetting user policy acceptance:', resetError)
        // Policy was saved but resetting users failed
        setOriginalPolicyText(trimmedPolicy)
        setSuccess('Policy updated successfully, but some users may not have been reset. Please check and update manually if needed.')
      }
      
      // Clear success message after 8 seconds (longer for policy updates)
      setTimeout(() => {
        setSuccess(null)
      }, 8000)
    } catch (error) {
      console.error('Error saving policy:', error)
      setError('Failed to save policy. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <Loading fullScreen message="Loading settings..." />
  }

  const hasChanges = parseFloat(serviceFeePercent) !== originalServiceFee
  const hasPolicyChanges = policyText.trim() !== originalPolicyText.trim()
  const calculatedExample = (10000 * parseFloat(serviceFeePercent || 0)) / 100

  return (
    <div style={{
      padding: 'clamp(16px, 3vw, 32px)',
      fontFamily: '"Inter", sans-serif',
      maxWidth: '1200px',
      margin: '0 auto',
      background: '#f9fafb',
      minHeight: '100vh'
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '20px',
        padding: 'clamp(20px, 4vw, 32px)',
        marginBottom: '32px',
        boxShadow: '0 20px 60px rgba(102, 126, 234, 0.25)',
        color: 'white',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          top: '-50%',
          right: '-10%',
          width: '300px',
          height: '300px',
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '50%',
          filter: 'blur(60px)'
        }}></div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{
            fontSize: 'clamp(1.75rem, 5vw, 2.5rem)',
            fontWeight: 800,
            margin: '0 0 12px 0',
            color: 'white',
            letterSpacing: '-0.5px'
          }}>
            ⚙️ System Settings
          </h1>
          <p style={{
            fontSize: 'clamp(0.9rem, 2.5vw, 1.1rem)',
            margin: 0,
            color: 'rgba(255, 255, 255, 0.95)',
            fontWeight: 400
          }}>
            Manage system-wide configuration and preferences
          </p>
        </div>
      </div>

      {error && (
        <div style={{
          background: '#fee2e2',
          border: '2px solid #ef4444',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '24px',
          color: '#dc2626',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <span style={{ fontSize: '20px' }}>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div style={{
          background: '#d1fae5',
          border: '2px solid #10b981',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '24px',
          color: '#065f46',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <span style={{ fontSize: '20px' }}>✅</span>
          <span>{success}</span>
        </div>
      )}

      {/* Service Fee Settings */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '32px',
        marginBottom: '28px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
        border: '1px solid #e5e7eb'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '24px'
        }}>
          <div style={{
            width: '4px',
            height: '24px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '2px'
          }}></div>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#111827',
            margin: 0,
            letterSpacing: '-0.3px'
          }}>
            💰 Service Fee Configuration
          </h2>
        </div>

        <p style={{
          fontSize: '0.95rem',
          color: '#6b7280',
          marginBottom: '32px',
          lineHeight: '1.6'
        }}>
          Configure the service fee percentage that will be applied to all bookings. 
          This fee is charged to guests on top of the booking subtotal and is received by the platform.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '24px',
          marginBottom: '32px'
        }}>
          {/* Current Setting */}
          <div style={{
            background: 'linear-gradient(135deg, #f8f9ff 0%, #ffffff 100%)',
            borderRadius: '16px',
            padding: '24px',
            border: '2px solid #e0e7ff'
          }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#6b7280',
              marginBottom: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Current Service Fee
            </label>
            <div style={{
              fontSize: '2.5rem',
              fontWeight: 800,
              color: '#667eea',
              lineHeight: '1.2',
              marginBottom: '8px'
            }}>
              {originalServiceFee}%
            </div>
            <p style={{
              fontSize: '0.875rem',
              color: '#6b7280',
              margin: 0
            }}>
              Applied to all new bookings
            </p>
          </div>

          {/* Example Calculation */}
          <div style={{
            background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)',
            borderRadius: '16px',
            padding: '24px',
            border: '2px solid #d1fae5'
          }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#6b7280',
              marginBottom: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Example Calculation
            </label>
            <div style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: '#10b981',
              lineHeight: '1.2',
              marginBottom: '8px'
            }}>
              ₱10,000 booking
            </div>
            <div style={{
              fontSize: '0.875rem',
              color: '#6b7280',
              margin: 0
            }}>
              Service fee: ₱{calculatedExample.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
            </div>
          </div>
        </div>

        {/* Service Fee Input */}
        <div style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          borderRadius: '16px',
          padding: '28px',
          border: '2px solid #e5e7eb',
          marginBottom: '24px'
        }}>
          <label style={{
            display: 'block',
            fontSize: '1rem',
            fontWeight: 600,
            color: '#374151',
            marginBottom: '16px'
          }}>
            Service Fee Percentage
          </label>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '16px'
          }}>
            <div style={{
              position: 'relative',
              flex: '1',
              maxWidth: '300px'
            }}>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={serviceFeePercent}
                onChange={(e) => {
                  setServiceFeePercent(e.target.value)
                  setError(null)
                  setSuccess(null)
                }}
                style={{
                  width: '100%',
                  padding: '16px 48px 16px 16px',
                  borderRadius: '12px',
                  border: '2px solid #e5e7eb',
                  fontSize: '1.5rem',
                  fontWeight: 600,
                  outline: 'none',
                  transition: 'all 0.2s',
                  background: '#ffffff',
                  color: '#1f2937'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#667eea'
                  e.target.style.boxShadow = '0 0 0 4px rgba(102, 126, 234, 0.1)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb'
                  e.target.style.boxShadow = 'none'
                }}
              />
              <span style={{
                position: 'absolute',
                right: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '1.25rem',
                fontWeight: 600,
                color: '#6b7280'
              }}>%</span>
            </div>

            <div style={{
              flex: '1',
              padding: '16px',
              background: 'rgba(102, 126, 234, 0.05)',
              borderRadius: '12px',
              border: '1px solid rgba(102, 126, 234, 0.1)'
            }}>
              <div style={{
                fontSize: '0.875rem',
                color: '#6b7280',
                marginBottom: '4px'
              }}>
                New Calculation (₱10,000 booking)
              </div>
              <div style={{
                fontSize: '1.125rem',
                fontWeight: 700,
                color: '#667eea'
              }}>
                ₱{calculatedExample.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })} service fee
              </div>
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.875rem',
            color: '#6b7280'
          }}>
            <span>💡</span>
            <span>
              Enter a value between 0 and 100. The service fee is calculated as a percentage of the booking subtotal (after discounts).
            </span>
          </div>
        </div>

        {/* Warning Notice */}
        {hasChanges && (
          <div style={{
            background: '#fef3c7',
            border: '2px solid #f59e0b',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '24px',
            color: '#92400e',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <span style={{ fontSize: '20px', flexShrink: 0 }}>⚠️</span>
            <div>
              <div style={{
                fontWeight: 600,
                marginBottom: '4px'
              }}>
                Important Notice
              </div>
              <div style={{
                fontSize: '0.875rem',
                lineHeight: '1.5'
              }}>
                Changing the service fee will only affect <strong>new bookings</strong> created after the change. 
                Existing bookings will retain their original service fee. Make sure to inform your team about this change.
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px'
        }}>
          <button
            type="button"
            onClick={() => {
              setServiceFeePercent(originalServiceFee)
              setError(null)
              setSuccess(null)
            }}
            disabled={!hasChanges || saving}
            style={{
              padding: '14px 28px',
              border: '2px solid #e5e7eb',
              borderRadius: '12px',
              background: 'white',
              color: '#374151',
              fontWeight: 600,
              fontSize: '1rem',
              cursor: (!hasChanges || saving) ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              opacity: (!hasChanges || saving) ? 0.5 : 1
            }}
            onMouseEnter={(e) => {
              if (hasChanges && !saving) {
                e.target.style.background = '#f9fafb'
                e.target.style.borderColor = '#d1d5db'
              }
            }}
            onMouseLeave={(e) => {
              if (hasChanges && !saving) {
                e.target.style.background = 'white'
                e.target.style.borderColor = '#e5e7eb'
              }
            }}
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleShowConfirmDialog}
            disabled={!hasChanges || saving}
            style={{
              padding: '14px 28px',
              border: 'none',
              borderRadius: '12px',
              background: (!hasChanges || saving)
                ? '#9ca3af'
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              fontWeight: 600,
              fontSize: '1rem',
              cursor: (!hasChanges || saving) ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: (!hasChanges || saving) ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              if (hasChanges && !saving) {
                e.target.style.transform = 'translateY(-2px)'
                e.target.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)'
              }
            }}
            onMouseLeave={(e) => {
              if (hasChanges && !saving) {
                e.target.style.transform = 'translateY(0)'
                e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)'
              }
            }}
          >
            {saving ? (
              <>
                <span style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid white',
                  borderTop: '2px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  display: 'inline-block'
                }} />
                Saving...
              </>
            ) : (
              <>
                <span>💾</span>
                Save Changes
              </>
            )}
          </button>
        </div>

        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>

      {/* Policy & Compliance Settings */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '32px',
        marginBottom: '28px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
        border: '1px solid #e5e7eb'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '4px',
              height: '24px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '2px'
            }}></div>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: '#111827',
              margin: 0,
              letterSpacing: '-0.3px'
            }}>
              📋 Policy & Compliance Terms
            </h2>
          </div>
          <button
            type="button"
            onClick={async () => {
              try {
                const currentPolicyText = policyText || getDefaultPolicyText()
                const pdfDoc = await generatePolicyPDF(currentPolicyText)
                pdfDoc.save('StaySmart-Terms-and-Conditions.pdf')
              } catch (error) {
                console.error('Error generating policy PDF:', error)
                alert('Failed to generate PDF. Please try again.')
              }
            }}
            style={{
              padding: '12px 24px',
              border: 'none',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #31326F 0%, #4a4d8c 100%)',
              color: 'white',
              fontWeight: 600,
              fontSize: '0.95rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 12px rgba(49, 50, 111, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-2px)'
              e.target.style.boxShadow = '0 6px 16px rgba(49, 50, 111, 0.4)'
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)'
              e.target.style.boxShadow = '0 4px 12px rgba(49, 50, 111, 0.3)'
            }}
          >
            <span>🖨️</span>
            Print Policy
          </button>
        </div>

        <p style={{
          fontSize: '0.95rem',
          color: '#6b7280',
          marginBottom: '32px',
          lineHeight: '1.6'
        }}>
          Manage the Terms and Conditions that all users must accept. When you update the policy text, all users will be required to re-accept the updated terms before continuing to use the platform.
        </p>

        {/* Policy Text Editor */}
        <div style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          borderRadius: '16px',
          padding: '28px',
          border: '2px solid #e5e7eb',
          marginBottom: '24px'
        }}>
          <label style={{
            display: 'block',
            fontSize: '1rem',
            fontWeight: 600,
            color: '#374151',
            marginBottom: '16px'
          }}>
            Terms and Conditions Text
          </label>
          
          <textarea
            value={policyText}
            onChange={(e) => {
              setPolicyText(e.target.value)
              setError(null)
              setSuccess(null)
            }}
            rows={20}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: '12px',
              border: '2px solid #e5e7eb',
              fontSize: '0.95rem',
              fontFamily: '"Inter", monospace',
              lineHeight: '1.6',
              outline: 'none',
              transition: 'all 0.2s',
              background: '#ffffff',
              color: '#1f2937',
              resize: 'vertical',
              minHeight: '400px'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#667eea'
              e.target.style.boxShadow = '0 0 0 4px rgba(102, 126, 234, 0.1)'
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#e5e7eb'
              e.target.style.boxShadow = 'none'
            }}
            placeholder="Enter Terms and Conditions text here..."
          />

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '12px',
            fontSize: '0.875rem',
            color: '#6b7280'
          }}>
            <span>💡</span>
            <span>
              This text will be displayed to all users when they first log in or after policy updates. Use clear sections with numbered items for better readability.
            </span>
          </div>
        </div>

        {/* Warning Notice */}
        {hasPolicyChanges && (
          <div style={{
            background: '#fef3c7',
            border: '2px solid #f59e0b',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '24px',
            color: '#92400e',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <span style={{ fontSize: '20px', flexShrink: 0 }}>⚠️</span>
            <div>
              <div style={{
                fontWeight: 600,
                marginBottom: '4px'
              }}>
                Important: Policy Update Impact
              </div>
              <div style={{
                fontSize: '0.875rem',
                lineHeight: '1.5'
              }}>
                When you save these changes, <strong>all users' policy acceptance will be reset to false</strong>. 
                They will be required to read and accept the updated terms before they can continue using the platform. 
                This ensures compliance with the latest policy changes.
              </div>
            </div>
          </div>
        )}

        {/* Save Policy Button */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px'
        }}>
          <button
            type="button"
            onClick={() => {
              setPolicyText(originalPolicyText)
              setError(null)
              setSuccess(null)
            }}
            disabled={!hasPolicyChanges || saving}
            style={{
              padding: '14px 28px',
              border: '2px solid #e5e7eb',
              borderRadius: '12px',
              background: 'white',
              color: '#374151',
              fontWeight: 600,
              fontSize: '1rem',
              cursor: (!hasPolicyChanges || saving) ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              opacity: (!hasPolicyChanges || saving) ? 0.5 : 1
            }}
            onMouseEnter={(e) => {
              if (hasPolicyChanges && !saving) {
                e.target.style.background = '#f9fafb'
                e.target.style.borderColor = '#d1d5db'
              }
            }}
            onMouseLeave={(e) => {
              if (hasPolicyChanges && !saving) {
                e.target.style.background = 'white'
                e.target.style.borderColor = '#e5e7eb'
              }
            }}
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleShowPolicyConfirmDialog}
            disabled={!hasPolicyChanges || saving}
            style={{
              padding: '14px 28px',
              border: 'none',
              borderRadius: '12px',
              background: (!hasPolicyChanges || saving)
                ? '#9ca3af'
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              fontWeight: 600,
              fontSize: '1rem',
              cursor: (!hasPolicyChanges || saving) ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: (!hasPolicyChanges || saving) ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              if (hasPolicyChanges && !saving) {
                e.target.style.transform = 'translateY(-2px)'
                e.target.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)'
              }
            }}
            onMouseLeave={(e) => {
              if (hasPolicyChanges && !saving) {
                e.target.style.transform = 'translateY(0)'
                e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)'
              }
            }}
          >
            {saving ? (
              <>
                <span style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid white',
                  borderTop: '2px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  display: 'inline-block'
                }} />
                Updating...
              </>
            ) : (
              <>
                <span>💾</span>
                Update Policy & Reset All Users
              </>
            )}
          </button>
        </div>
      </div>

      {/* Info Section */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
        border: '1px solid #e5e7eb'
      }}>
        <h3 style={{
          fontSize: '1.125rem',
          fontWeight: 600,
          color: '#111827',
          marginBottom: '16px'
        }}>
          ℹ️ How Service Fees Work
        </h3>
        <ul style={{
          margin: 0,
          paddingLeft: '20px',
          color: '#6b7280',
          lineHeight: '1.8',
          fontSize: '0.95rem'
        }}>
          <li>The service fee is calculated as a percentage of the booking subtotal (after any discounts are applied).</li>
          <li>The fee is added to the subtotal to determine the total amount charged to the guest.</li>
          <li>Hosts receive the subtotal amount, while the platform receives the service fee.</li>
          <li>Changes to the service fee only apply to new bookings created after the update.</li>
          <li>Existing bookings maintain their original service fee amounts.</li>
        </ul>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <dialog
          ref={confirmDialogRef}
          style={{
            maxWidth: '500px',
            width: '90%',
            border: 'none',
            borderRadius: '16px',
            padding: 0,
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)'
          }}
        >
          <style>
            {`
              dialog::backdrop {
                background: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(4px);
              }
            `}
          </style>
          <div style={{ padding: '30px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>💰</div>
            <h2 style={{
              margin: '0 0 15px 0',
              fontSize: '24px',
              fontWeight: 600,
              color: '#1f2937'
            }}>
              Confirm Service Fee Change
            </h2>
            <div style={{
              background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05), rgba(102, 126, 234, 0.02))',
              borderRadius: '12px',
              padding: '20px',
              margin: '20px 0',
              border: '2px solid rgba(102, 126, 234, 0.1)'
            }}>
              <div style={{ marginBottom: '16px' }}>
                <p style={{ margin: '0 0 8px', fontSize: '14px', color: '#6b7280', fontWeight: 500 }}>
                  Current Service Fee
                </p>
                <p style={{ margin: 0, fontSize: '28px', fontWeight: 700, color: '#6b7280' }}>
                  {originalServiceFee}%
                </p>
              </div>
              <div style={{
                width: '100%',
                height: '1px',
                background: 'rgba(102, 126, 234, 0.2)',
                margin: '16px 0'
              }} />
              <div>
                <p style={{ margin: '0 0 8px', fontSize: '14px', color: '#6b7280', fontWeight: 500 }}>
                  New Service Fee
                </p>
                <p style={{ margin: 0, fontSize: '32px', fontWeight: 700, color: '#667eea' }}>
                  {serviceFeePercent}%
                </p>
              </div>
            </div>
            <p style={{
              margin: '0 0 30px 0',
              fontSize: '16px',
              color: '#6b7280',
              lineHeight: '1.5'
            }}>
              This change will apply to all new bookings created after the update. Are you sure you want to proceed?
            </p>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
              <button
                onClick={handleCloseConfirmDialog}
                style={{
                  padding: '12px 24px',
                  fontSize: '16px',
                  fontWeight: 600,
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
                onClick={handleSaveSettings}
                style={{
                  padding: '12px 24px',
                  fontSize: '16px',
                  fontWeight: 600,
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
                }}
                onMouseOver={(e) => {
                  e.target.style.background = 'linear-gradient(135deg, #5568d3 0%, #6b3fa0 100%)'
                  e.target.style.transform = 'translateY(-1px)'
                  e.target.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)'
                }}
                onMouseOut={(e) => {
                  e.target.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                  e.target.style.transform = 'translateY(0)'
                  e.target.style.boxShadow = '0 4px 12px rgba(102, 123, 234, 0.3)'
                }}
              >
                Confirm Change
              </button>
            </div>
          </div>
        </dialog>
      )}

      {/* Policy Update Confirmation Dialog */}
      {showPolicyConfirmDialog && (
        <dialog
          ref={policyConfirmDialogRef}
          style={{
            maxWidth: '600px',
            width: '90%',
            border: 'none',
            borderRadius: '16px',
            padding: 0,
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)'
          }}
        >
          <style>
            {`
              dialog::backdrop {
                background: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(4px);
              }
            `}
          </style>
          <div style={{ padding: '30px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>📋</div>
            <h2 style={{
              margin: '0 0 15px 0',
              fontSize: '24px',
              fontWeight: 600,
              color: '#1f2937'
            }}>
              Confirm Policy Update
            </h2>
            <div style={{
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.05), rgba(239, 68, 68, 0.02))',
              borderRadius: '12px',
              padding: '20px',
              margin: '20px 0',
              border: '2px solid rgba(239, 68, 68, 0.1)'
            }}>
              <div style={{
                fontSize: '14px',
                color: '#dc2626',
                fontWeight: 600,
                marginBottom: '12px'
              }}>
                ⚠️ This action will affect all users
              </div>
              <div style={{
                fontSize: '14px',
                color: '#6b7280',
                lineHeight: '1.6',
                textAlign: 'left'
              }}>
                <p style={{ margin: '0 0 12px 0' }}>
                  When you update the policy:
                </p>
                <ul style={{
                  margin: '0 0 12px 0',
                  paddingLeft: '20px',
                  textAlign: 'left'
                }}>
                  <li>All users' policy acceptance will be reset to <strong>false</strong></li>
                  <li>All users will be required to re-accept the updated terms</li>
                  <li>The policy text will be updated in the system</li>
                  <li>Users will see the policy dialog on their next login</li>
                </ul>
                <p style={{ margin: 0 }}>
                  This ensures compliance with the latest policy changes. Are you sure you want to proceed?
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
              <button
                onClick={handleClosePolicyConfirmDialog}
                style={{
                  padding: '12px 24px',
                  fontSize: '16px',
                  fontWeight: 600,
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
                onClick={handleSavePolicy}
                style={{
                  padding: '12px 24px',
                  fontSize: '16px',
                  fontWeight: 600,
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
                }}
                onMouseOver={(e) => {
                  e.target.style.background = 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'
                  e.target.style.transform = 'translateY(-1px)'
                  e.target.style.boxShadow = '0 6px 16px rgba(239, 68, 68, 0.4)'
                }}
                onMouseOut={(e) => {
                  e.target.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                  e.target.style.transform = 'translateY(0)'
                  e.target.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)'
                }}
              >
                Update Policy & Reset All Users
              </button>
            </div>
          </div>
        </dialog>
      )}
    </div>
  )
}

export default AdminSettings

