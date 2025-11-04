import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { auth } from '../../config/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import getStartedICON from '/static/getStarted.gif'

const GetStarted = () => {
  const { hostId } = useParams()
  const navigate = useNavigate()
  const [isVerified, setIsVerified] = useState(false)
  const [checking, setChecking] = useState(true)

  const handleStarted = () => {
    if (hostId && isVerified) {
      navigate('setupService')
    } else if (!isVerified) {
      alert('Please verify your email before proceeding.')
    } else {
      navigate('/error')
    }
  }

  const handleLater = () => {
    if (hostId) {
      navigate(`/host/${hostId}`)
    } else {
      alert('ACCOUNT NOT FOUND | OR ERROR')
    }
  }

  useEffect(() => {
    if (!hostId) {
      navigate('/error')
      return
    }

    // ✅ Listen for Firebase auth changes
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await user.reload() // refresh user info
        if (user.emailVerified) {
          console.log('✅ Email verified for host:', user.uid)
          setIsVerified(true)
        } else {
          console.log('❌ Email not verified yet.')
          setIsVerified(false)
        }
      } else {
        console.log('⚠️ No user signed in.')
      }
      setChecking(false)
    })

    return () => unsubscribe()
  }, [hostId, navigate])

  return (
    <div className="getStartedHost">
      <div className="getStartedCard">
        <div className="getStartedImage-container">
          <img src={getStartedICON} alt="Get Started" className="getStartedImage" />
        </div>

        <div className="getStartedCard-groupText">
          {checking ? (
            <>
              <div className="loading-spinner-container">
                <div className="loading-spinner"></div>
              </div>
              <h1>Checking your verification status...</h1>
              <p>Please wait a moment while we verify your account.</p>
            </>
          ) : isVerified ? (
            <>
              <div className="success-icon">✨</div>
              <h1>
                Turn Your Business Idea <br /> Into Reality
              </h1>
              <p className="subtitle-text">
                Start setting up your hosting services and welcome your first guests. 
                It only takes a few minutes to get started!
              </p>

              <div className="getStartedButtons">
                <button className="btn-start" onClick={handleStarted}>
                  <span>Start Now</span>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </button>
                <button className="btn-later" onClick={handleLater}>
                  <span>Maybe Later</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="verification-icon">🔒</div>
              <h1>Please verify your email</h1>
              <p className="subtitle-text">
                We've sent a verification link to your email address.
                <br />
                Click the link to verify your account, then return here to continue.
              </p>
              <button
                className="btn-start"
                onClick={() => window.location.reload()}
              >
                <span>I've Verified My Email</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default GetStarted
