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
        <img src={getStartedICON} alt="Get Started" className="getStartedImage" />

        <div className="getStartedCard-groupText">
          {checking ? (
            <>
              <h1>Checking your verification status...</h1>
              <p>Please wait a moment.</p>
            </>
          ) : isVerified ? (
            <>
              <h1>
                Turn Your Business Idea <br /> Into Reality 🚀
              </h1>
              <p>
                Start setting up your hosting services and welcome your first guests.
              </p>

              <div className="getStartedButtons">
                <button className="btn-start" onClick={handleStarted}>
                  Start Now
                </button>
                <button className="btn-later" onClick={handleLater}>
                  Maybe Later
                </button>
              </div>
            </>
          ) : (
            <>
              <h1>Please verify your email 🔒</h1>
              <p>
                Check your inbox for the verification link we sent.
                <br />
                Once verified, reload this page to continue.
              </p>
              <button
                className="btn-start"
                onClick={() => window.location.reload()}
              >
                I’ve Verified My Email
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default GetStarted
