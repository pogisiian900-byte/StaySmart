import React, { useState, useRef } from 'react'
import { db } from '../../config/firebase.js'
import { setDoc, doc } from 'firebase/firestore'
import { auth, app } from '../../config/firebase' // 🟩 Make sure `app` is exported from your firebase.js
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth' // 🟩 Import getAuth + signOut
import { useNavigate } from 'react-router-dom'
import emailjs from 'emailjs-com'
import secureMail from '/static/secureMail.webp'

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

      // 🟩 Define templateParams BEFORE using it
      const templateParams = {
        to_name: `${formData.firstName} ${formData.lastName}`,
        to_email: formData.emailAddress,
        verify_link:
          formData.role === 'host'
            ? `https://staysmartlisting.netlify.app/getStarted`
            : `https://staysmartlisting.netlify.app/guest`
      }

      await emailjs.send(
        'service_endhho9',
        'template_q3raiys',
        templateParams,
        'xFGnrqT_ZhFhJ5Y0n'
      )

      setEmailSent(true)
      alert('Verification email sent successfully!')

      // 🟩 Create a temporary auth instance (isolated)
      const tempAuth = getAuth(app)

      // 🟩 Create user WITHOUT affecting main auth session
      const userCredential = await createUserWithEmailAndPassword(
        tempAuth,
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
        zipCode: formData.zipCode
      })

      // ✅ Create Host record if applicable
      if (formData.role === 'host') {
        await setDoc(doc(db, 'Host', user.uid), { userId: user.uid })
      }

      // 🟩 Send EmailJS verification with actual user UID link
      const verifyTemplateParams = {
        to_name: `${formData.firstName} ${formData.lastName}`,
        to_email: formData.emailAddress,
        verify_link:
          formData.role === 'host'
            ? `https://staysmartlisting.netlify.app/getStarted/${user.uid}`
            : `https://staysmartlisting.netlify.app/guest/${user.uid}`
      }

      await emailjs.send(
        'service_endhho9',
        'template_q3raiys',
        verifyTemplateParams,
        'xFGnrqT_ZhFhJ5Y0n'
      )

      // 🟩 Sign out immediately so Firebase doesn’t auto-log in
      await signOut(tempAuth)

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
            : `https://staysmartlisting.netlify.app/guest/${createdUser.uid}`
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
      <div className="confrimation-registration">
        {!emailSent && (
          <div className="back-group-verify">
            <button onClick={onPrev} className="confrimation-registration-Goback">
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

        <div className="confrimation-registration-content">
          <h1>Please verify {formData.emailAddress || 'your email'}</h1>
          <img className="verifyIcon" src={secureMail} alt="Secure Mail Icon" />
          <p>
            {emailSent
              ? 'We sent a verification link to your email. You can resend if needed.'
              : 'Click the button below to send a verification link to your email.'}
          </p>

          {!emailSent ? (
            <button
              type="button"
              onClick={handleSendVerification}
              disabled={isSubmitting}
              className="resendButton-verify"
            >
              {isSubmitting ? 'Sending...' : 'Send Verification Email'}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleResendCode}
                className="resendButton-verify"
              >
                Resend Email
              </button>

              <button
                onClick={() => navigate('/')}
                className="confrimation-registration-createButton"
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>

      {/* ✅ Dialog modal for confirmation */}
      <dialog ref={resendDialogRef} className="resend-dialog">
        <div className="resend-dialog-content">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="50"
            height="50"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m9 12 2 2 4-4" />
          </svg>
          <h3>Verification Email Sent</h3>
          <p>
            A new verification link has been sent to <b>{formData.emailAddress}</b>
          </p>
          <button onClick={handleCloseDialog} className="resend-dialog-ok">
            OK
          </button>
        </div>
      </dialog>
    </>
  )
}

export default ConfirmationModal
