import React, { useEffect, useState } from "react";
import Guest_Logged_Navigation from "./guest-navigation-logged";
import { useNavigate, useParams } from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { auth, db } from "../../config/firebase";
import Footer from "../../components/Footer";

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

  if (loading) return <p>Loading...</p>;
  if (role && role !== "guest") return <p>Access denied.</p>;

  // 🔹 Navigate to selected listing page
  const handleSelectListing = (listingId) => {
    navigate(`/guest/${guestId}/listing/${listingId}`);
  };

  return (
    <div className="guest-main-logged">
      <Guest_Logged_Navigation userData={userData} />
      
      <Footer/>
    </div>
  );
};

export default GuestMainLogged;
