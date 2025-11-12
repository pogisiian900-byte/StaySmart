import { useParams, Outlet } from "react-router-dom";
import "../host/host.css";
import Host_Navigation from "./host-navigation";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "../../config/firebase";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import Loading from "../../components/Loading";
import PolicyComplianceDialog from "../../components/PolicyComplianceDialog";

function HostMain() {
  const { hostId } = useParams();
  const [user] = useAuthState(auth);

  const [role, setRole] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [checkingPolicy, setCheckingPolicy] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      if (user) {
        try {
          // Reload user to get latest email verification status
          await user.reload();
          
          const docRef = doc(db, "Users", user.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            setRole(data.role);
            setUserData(data);
            
            // Check if email is verified and policy is accepted
            if (user.emailVerified) {
              if (data.policyAccepted && data.policyAcceptedAt) {
                setPolicyAccepted(true);
              }
            }
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      }
      setLoading(false);
      setCheckingPolicy(false);
    };

    fetchUser();
  }, [user]);

  if (loading || checkingPolicy) return <Loading fullScreen message="Loading your dashboard..." />;

  if (role !== "host") {
    return <Loading fullScreen message="Access denied" />;
  }

  if (user && hostId !== user.uid) {
    return <Loading fullScreen message="Unauthorized: Wrong account" />;
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
    );
  }

  return (
    <div className="host-main">
      <Host_Navigation hostId={hostId} userData={userData} />
      <Outlet />
    </div>
  );
}

export default HostMain;
