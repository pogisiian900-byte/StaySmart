import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { auth, db } from "../../config/firebase";
import Footer from "../../components/Footer";
import Loading from "../../components/Loading";

const GuestMainLogged = () => {
  const { guestId } = useParams();
  const [userData, setUserData] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState([]);
  const [user] = useAuthState(auth);
  const navigate = useNavigate();
  
  // 🔹 Fetch user role and data
  useEffect(() => {
    const fetchUserData = async () => {
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
    fetchUserData();
  }, [user]);

  // 🔹 Fetch listings from Firestore (your "Listings" collection)
  useEffect(() => {
    const fetchListings = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "Listings"));
        const data = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setListings(data);
      } catch (err) {
        console.error("Error fetching listings:", err);
      }
    };

    fetchListings();
  }, []);

  if (loading) return <Loading fullScreen message="Loading your dashboard..." />;
  if (role && role !== "guest") return <Loading fullScreen message="Access denied." />;

  // 🔹 Navigate to selected listing page
  const handleSelectListing = (listingId) => {
    navigate(`/guest/${guestId}/listing/${listingId}`);
  };

  return (
    <div className="guest-main-logged">
      <Footer/>
    </div>
  );
};

export default GuestMainLogged;
