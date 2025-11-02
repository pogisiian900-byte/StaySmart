import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../layout/AuthContext";
import { db } from "../config/firebase";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";

function ProtectedRoute({ children, allowedRole }) {
  const { user, loading } = useAuth();
  const [role, setRole] = useState(null);
  const [fetching, setFetching] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user) {
        setFetching(false);
        return;
      }
      try {
        const docRef = doc(db, "Users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setRole(docSnap.data().role || null);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setFetching(false);
      }
    };
    fetchUserRole();
  }, [user]);

  if (loading || fetching) return <p>Loading...</p>;

  if (!user) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  // ✅ FIX HERE: support both string or array
  const isAllowed = Array.isArray(allowedRole)
    ? allowedRole.includes(role)
    : role === allowedRole;

  if (allowedRole && !isAllowed) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default ProtectedRoute;
