import React, { useState, useRef } from 'react'
import { db } from '../../config/firebase.js'
import { setDoc, doc } from 'firebase/firestore'
import { auth } from '../../config/firebase'
import { useNavigate } from 'react-router-dom'
import {
  createUserWithEmailAndPassword,
  sendEmailVerification
} from 'firebase/auth'
import secureMail from '/static/secureMail.webp'

const ConfirmationModal = ({ formData, onPrev }) => {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [user, setUser] = useState(null)
  const [emailSent, setEmailSent] = useState(false)
  const resendDialogRef = useRef(null)

  // ✅ Create account + send verification link
  const handleSendVerification = async () => {
    try {
      setIsSubmitting(true)

      // ✅ Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.emailAddress,
        formData.password
      )
      const createdUser = userCredential.user
      setUser(createdUser)

      // ✅ Save user info in Firestore
      await setDoc(doc(db, 'Users', createdUser.uid), {
        uid: createdUser.uid,
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
        await setDoc(doc(db, 'Host', createdUser.uid), {
          userId: createdUser.uid
        })
      }

      // ✅ Send email verification
      const actionCodeSettings = {
        url:
          formData.role === 'host'
            ? `http://localhost:5173/getStarted/${createdUser.uid}`
            : `http://localhost:5173/guest/${createdUser.uid}`,
        handleCodeInApp: true
      }

      await sendEmailVerification(createdUser, actionCodeSettings)

      setEmailSent(true)
      alert('Account created! Verification link sent to your email.')
    } catch (error) {
      console.error('Error creating account:', error)
      if (error.code === 'auth/email-already-in-use') {
        alert('This email is already registered. Try logging in instead.')
      } else {
        alert('Something went wrong. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // ✅ Resend verification link
  const handleResendCode = async () => {
    try {
      if (!user) {
        alert('Please create your account first before resending.')
        return
      }

      const actionCodeSettings = {
        url:
          formData.role === 'host'
            ? `http://localhost:5173/getStarted/${user.uid}`
            : `http://localhost:5173/guest/${user.uid}`,
        handleCodeInApp: true
      }

      await sendEmailVerification(user, actionCodeSettings)
      console.log('Resent verification email to:', user.email)
      resendDialogRef.current?.showModal()
    } catch (error) {
      console.error('Resend error:', error)
      alert('Failed to resend verification email.')
    }
  }

  const handleCloseDialog = () => resendDialogRef.current?.close()

  return (
    <>
      <div className="confrimation-registration">
       
        {!emailSent ?(
          
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
        </div>):
        (<>
        </>)
        } 

        <div className="confrimation-registration-content">
          <h1>Please verify {formData.emailAddress || 'your email'}</h1>
          <img className="verifyIcon" src={secureMail} alt="Secure Mail Icon" />
          <p>
            {emailSent
              ? 'We sent a verification link to your email. You can resend if needed.'
              : 'Click the button below to send a verification link to your email.'}
          </p>

          {/* ✅ Conditional rendering */}
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

      {/* ✅ Dialog modal */}
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
            <path
              d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1
              c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"
            />
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
