import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '../../config/firebase'
import { doc, getDoc } from 'firebase/firestore'
import getStartedICON from '/static/getStarted.gif'

const GetStarted = () => {
  const { hostId } = useParams()
  const navigate = useNavigate()
  const [isValidHost, setIsValidHost] = useState(false)
  const [checking, setChecking] = useState(true)

  const handleStarted = () => {
    if (hostId && isValidHost) {
      navigate('setupService')
    } else {
      navigate('/error')
    }
  }

  const handleLater = () => {
    if (hostId && isValidHost) {
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

    // Check if hostId exists in Host collection
    const checkHostId = async () => {
      try {
        const hostDocRef = doc(db, 'Host', hostId)
        const hostDoc = await getDoc(hostDocRef)
        
        if (hostDoc.exists()) {
          console.log('✅ Valid host ID:', hostId)
          setIsValidHost(true)
        } else {
          console.log('❌ Host ID not found:', hostId)
          setIsValidHost(false)
          navigate('/error')
        }
      } catch (error) {
        console.error('Error checking host ID:', error)
        setIsValidHost(false)
        navigate('/error')
      } finally {
        setChecking(false)
      }
    }

    checkHostId()
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
              <h1>Loading...</h1>
              <p>Please wait a moment.</p>
            </>
          ) : isValidHost ? (
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
              <div className="verification-icon">❌</div>
              <h1>Invalid Host ID</h1>
              <p className="subtitle-text">
                The host ID provided is not valid.
                <br />
                Please check your link and try again.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default GetStarted
