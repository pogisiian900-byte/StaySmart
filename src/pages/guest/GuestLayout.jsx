import React, { useEffect, useState } from 'react'
import { Outlet, useParams } from 'react-router-dom'
import { useAuthState } from 'react-firebase-hooks/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../../config/firebase'
import Guest_Logged_Navigation from './guest-navigation-logged'
import Loading from '../../components/Loading'
import PolicyComplianceDialog from '../../components/PolicyComplianceDialog'

const GuestLayout = () => {
  const { guestId } = useParams()
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [policyAccepted, setPolicyAccepted] = useState(false)
  const [checkingPolicy, setCheckingPolicy] = useState(true)
  const [user] = useAuthState(auth)

  // Fetch user data for navigation and check policy status
  useEffect(() => {
    const fetchUserData = async () => {
      if (user) {
        try {
          // Reload user to get latest email verification status
          await user.reload()
          
          const docRef = doc(db, "Users", user.uid)
          const docSnap = await getDoc(docRef)
          if (docSnap.exists()) {
            const data = docSnap.data()
            setUserData(data)
            
            // Check if email is verified and policy is accepted
            if (user.emailVerified) {
              if (data.policyAccepted && data.policyAcceptedAt) {
                setPolicyAccepted(true)
              }
            }
          }
        } catch (error) {
          console.error("Error fetching user data:", error)
        }
      }
      setLoading(false)
      setCheckingPolicy(false)
    }
    fetchUserData()
  }, [user])

  // Show loading while checking policy
  if (loading || checkingPolicy) {
    return <Loading fullScreen message="Loading..." />
  }

  // Block access if email is verified but policy not accepted
  if (user && user.emailVerified && !policyAccepted) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f9fafb'
      }}>
        <PolicyComplianceDialog 
          userId={user.uid} 
          userEmail={user.email}
          onPolicyAccepted={() => setPolicyAccepted(true)}
        />
      </div>
    )
  }

  return (
    <div className="guest-next-page">
      <Guest_Logged_Navigation userData={userData} />
      <Outlet />
    </div>
  )
}

export default GuestLayout