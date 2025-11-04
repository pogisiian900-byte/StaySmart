import React, { useState, useRef } from 'react'
import { db } from '../../config/firebase.js'
import { setDoc, doc } from 'firebase/firestore'
import { auth } from '../../config/firebase'
import { useNavigate } from 'react-router-dom'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import emailjs from 'emailjs-com'
import secureMail from '/static/secureMail.webp'
import '../for-all/HostRegis.css'
const ConfirmationModal = ({ formData, onPrev }) => {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [createdUser, setCreatedUser] = useState(null)
  const resendDialogRef = useRef(null)

  // ✅ Create user + send EmailJS confirmation
  const handleSendVerification = async () => {
    try {
      setIsSubmitting(true)

      // ✅ Create user in Firebase Auth first (needed for verification link)
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.emailAddress,
        formData.password
      )
      const user = userCredential.user
      setCreatedUser(user)

      
      // ✅ Save user info in Firestore
      await setDoc(doc(db, 'Users', user.uid), {
        uid: user.uid,
        firstName: formData.firstName,
        lastName: formData.lastName,
        middleName: formData.middleName,
        phoneNumber: formData.phoneNumber,
        emailAddress: formData.emailAddress,
        role: formData.role,
        barangay: formData.barangay,
        birthday: formData.birthday,
        city: formData.city,
        province: formData.province,
        street: formData.street,
        zipCode: formData.zipCode,
        profilePicture: formData.profilePicture || null,
        favourites: []
      })

      // ✅ Create Host record if applicable
      if (formData.role === 'host') {
        await setDoc(doc(db, 'Host', user.uid), { userId: user.uid })
      }

      // ✅ Send custom EmailJS verification (after user is created so we have user.uid)
      const templateParams = {
        to_name: `${formData.firstName} ${formData.lastName}`,
        to_email: formData.emailAddress,
        verify_link:
          formData.role === 'host'
            ? `https://staysmartlisting.netlify.app/getStarted/${user.uid}`
            : `https://staysmartlisting.netlify.app/guest/${user.uid}`
      }

      await emailjs.send(
        'service_endhho9', // ✅ your EmailJS Service ID
        'template_q3raiys', // ✅ your EmailJS Template ID
        templateParams,
        'xFGnrqT_ZhFhJ5Y0n' // ✅ your EmailJS Public Key
      )

      setEmailSent(true)
      alert('Verification email sent successfully!')
      
    } catch (error) {
      console.error('Error sending email:', error)
      if (error.code === 'auth/email-already-in-use') {
        alert('This email is already registered. Please try logging in instead.')
      } else {
        alert('Something went wrong. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
      
    }
  }

  // ✅ Resend verification email
  const handleResendCode = async () => {
    try {
      if (!createdUser) {
        alert('Please send the first verification email before resending.')
        return
      }

      const templateParams = {
        to_name: `${formData.firstName} ${formData.lastName}`,
        to_email: formData.emailAddress,
        verify_link:
          formData.role === 'host'
            ? `https://staysmartlisting.netlify.app/getStarted/${createdUser.uid}`
            : `https://staysmartlisting.netlify.app//guest/${createdUser.uid}`
      }

      await emailjs.send(
        'service_endhho9',
        'template_q3raiys',
        templateParams,
        'xFGnrqT_ZhFhJ5Y0n'
      )

      resendDialogRef.current?.showModal()
    } catch (error) {
      console.error('Error resending verification email:', error)
      alert('Failed to resend verification email. Please try again.')
    }
  }

  const handleCloseDialog = () => resendDialogRef.current?.close()

  return (
    <>
      <div className="confirmation-registration">
        {!emailSent && (
          <div className="back-group-verify">
            <button 
              onClick={onPrev} 
              className="confirmation-back-btn"
              aria-label="Go back"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m12 19-7-7 7-7" />
                <path d="M19 12H5" />
              </svg>
            </button>
          </div>
        )}

        <div className="confirmation-content">
          <div className="confirmation-icon-wrapper">
            <div className={`confirmation-icon-container ${emailSent ? 'email-sent' : ''}`}>
              {emailSent ? (
                <div className="checkmark-wrapper">
                  <svg
                    className="checkmark"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
              ) : (
                <img className="verify-icon" src={secureMail} alt="Secure Mail Icon" />
              )}
            </div>
          </div>

          <div className="confirmation-text">
            <h1 className="confirmation-title">
              {emailSent 
                ? `Check your email!` 
                : `Verify your email address`}
            </h1>
            <p className="confirmation-subtitle">
              {emailSent ? (
                <>
                  We've sent a verification link to{' '}
                  <span className="email-highlight">{formData.emailAddress}</span>
                  <br />
                  Click the link in the email to complete your registration.
                </>
              ) : (
                <>
                  Please verify <span className="email-highlight">{formData.emailAddress || 'your email'}</span> to continue.
                  <br />
                  We'll send you a verification link shortly.
                </>
              )}
            </p>
          </div>

          <div className="confirmation-actions">
            {!emailSent ? (
              <button
                type="button"
                onClick={handleSendVerification}
                disabled={isSubmitting}
                className="confirmation-primary-btn"
              >
                {isSubmitting ? (
                  <>
                    <svg className="spinner" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" strokeDasharray="32" strokeDashoffset="32">
                        <animate attributeName="stroke-dasharray" dur="2s" values="0 32;16 16;0 32;0 32" repeatCount="indefinite"/>
                        <animate attributeName="stroke-dashoffset" dur="2s" values="0;-16;-32;-32" repeatCount="indefinite"/>
                      </circle>
                    </svg>
                    Sending verification email...
                  </>
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                    Send Verification Email
                  </>
                )}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleResendCode}
                  className="confirmation-secondary-btn"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                  Resend Email
                </button>

                <button
                  onClick={() => navigate('/')}
                  className="confirmation-primary-btn confirmation-done-btn"
                >
                  Continue to Home
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </>
            )}
          </div>

          {emailSent && (
            <div className="confirmation-help-text">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
              <span>Didn't receive the email? Check your spam folder or try resending.</span>
            </div>
          )}
        </div>
      </div>

      {/* ✅ Dialog modal for confirmation */}
      <dialog ref={resendDialogRef} className="resend-dialog">
        <div className="resend-dialog-content">
          <div className="dialog-icon-success">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h3>Email Sent Successfully!</h3>
          <p>
            A new verification link has been sent to{' '}
            <strong>{formData.emailAddress}</strong>
          </p>
          <button onClick={handleCloseDialog} className="resend-dialog-ok">
            Got it
          </button>
        </div>
      </dialog>
    </>
  )
}

export default ConfirmationModal
