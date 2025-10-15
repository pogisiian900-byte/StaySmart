import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "../config/firebase";
import { doc, getDoc } from "firebase/firestore";

const PublicRoute = ({ children }) => {
  const [user, loading] = useAuthState(auth);
  const [role, setRole] = useState(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    const fetchRole = async () => {
      if (!user) {
        setFetching(false);
        return;
      }
      try {
        const docRef = doc(db, "Users", user.uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setRole(snap.data().role);
        }
      } catch (error) {
        console.error("Error fetching role:", error);
      } finally {
        setFetching(false);
      }
    };

    fetchRole();
  }, [user]);

  if (loading || fetching) return <p>Loading...</p>;

  if (user) {
    if (role === "host") return <Navigate to={`/host/${user.uid}`} replace />;
    if (role === "guest") return <Navigate to={`/guest/${user.uid}`} replace />;
    if (role === "admin") return <Navigate to="/admin" replace />;
  }

  // If not logged in, allow access to public routes
  return children;
};

export default PublicRoute;
