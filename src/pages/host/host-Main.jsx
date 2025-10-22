import { useParams } from "react-router-dom";
import Footer from "../../components/Footer";
import "../host/host.css";
import Host_Navigation from "./host-navigation";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "../../config/firebase";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";

function HostMain() {
  const { hostId } = useParams();
  const [user] = useAuthState(auth);

  const [role, setRole] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      if (user) {
        const docRef = doc(db, "Users", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setRole(docSnap.data().role);
          setUserData(docSnap.data());
        }
      }
      setLoading(false);
    };

    fetchUser();
  }, [user]);

  if (loading) return <p>Loading...</p>;


  if (role !== "host") {
    return <p>Access denied</p>; // or redirect
  }

  if (user && hostId !== user.uid) {
    return <p>Unauthorized: Wrong account</p>;
  }



  return (
    <div className="host-main">
      <Host_Navigation hostId={hostId} userData = {userData} />
     
    </div>
  );
}

export default HostMain;
