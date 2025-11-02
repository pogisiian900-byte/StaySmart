import { useState, useEffect, useRef } from "react";
import "../guest/guest.css";
import Logo from "/static/logo.png";
import Services from "/static/services.png"; 
import HomeIcon from "/static/home.png"; 
import Work from "/static/work.png"
import { useNavigate } from "react-router-dom";
import { auth, db } from "../../config/firebase";
import { signOut } from "firebase/auth";
import { collectionGroup, getDocs } from "firebase/firestore";

// Component imports
import HomePages from "../../components/Home.jsx";
import ServicesPages from "../../components/Services.jsx";
import ExperiencePages from "../../components/Experience.jsx";
import Experience from "../../components/Experience.jsx";

import { createOrGetConversation } from "../for-all/messages/createOrGetConversation.jsx";


function Guest_Logged_Navigation({ userData }) {
  const [open, setOpen] = useState(false);
  const [selectedNav, setSelectedNav] = useState("home");
  const [loading, setLoading] = useState(true);
  const [allListing, setAllListing] = useState({
    room: [],
    service: [],
    experience: [],
  });
  
    const openMessages = () => {
    const guestId = auth.currentUser.uid;
    navigate(`/guest/${guestId}/messages`);
  };

  const navigate = useNavigate();
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  // ✅ Logout Handler
  const handleLogout = async () => {
    try {
      await signOut(auth);
      console.log("Guest logged out");
      navigate("/", { replace: true });
    } catch (err) {
      console.error("Logout failed:", err.message);
    }
  };

  // ✅ Fetch All Listings
  useEffect(() => {
    const fetchAllListings = async () => {
      try {
        const querySnapshot = await getDocs(collectionGroup(db, "Listings"));
        const listings = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // ✅ Support multiple or partial serviceType values
          const rooms = listings.filter(
            (item) => item.serviceType?.toLowerCase().includes("room")
          );
          const services = listings.filter(
            (item) => item.serviceType?.toLowerCase().includes("service")
          );
          const experiences = listings.filter(
            (item) => item.serviceType?.toLowerCase().includes("experience")
          );

          setAllListing({
            room: rooms,
            service: services,
            experience: experiences,
          });

      } catch (error) {
        console.error("Error fetching listings:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllListings();
  }, []);

  // ✅ Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        !buttonRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ✅ Render pages dynamically
  const renderPage = () => {
    switch (selectedNav) {
      case "home":
        return <HomePages roomData={allListing.room} loading={loading} />;
      case "service":
        return <ServicesPages serviceData={allListing.service} loading={loading} />;
      case "experience":
        return <ExperiencePages experienceData={allListing.experience} loading={loading} />;
      default:
        return <HomePages roomData={allListing.room} loading={loading} />;
    }
  };

  return (
    <>
      <nav className="guest-nav">
        {/* Logo */}
        <div className="navLogo">
          <img src={Logo} alt="Logo" width={"150px"} />
        </div>

        {/* Navigation Items */}
        <div
          className={selectedNav === "home" ? "navItem navActive" : "navItem"}
          onClick={() => setSelectedNav("home")}
        >
          <a href="#">
           <img src={HomeIcon} alt="" width={"50px"}/>
            <span>Home</span>
          </a>
        </div>

        <div
          className={selectedNav === "service" ? "navItem navActive" : "navItem"}
          onClick={() => setSelectedNav("service")}
        >
          <a href="#">
           <img src={Services} alt="" width={"50px"}/>
            <span>Services</span>
          </a>
        </div>

        <div
          className={selectedNav === "experience" ? "navItem navActive" : "navItem"}
          onClick={() => setSelectedNav("experience")}
        >
          <a href="#">
           <img src={Work} alt="" width={"50px"}/>
            <span>Experiences</span>
          </a>
        </div>

        {/* Hamburger Button */}
        <div className="host-hamburgDiv">
          <button
            ref={buttonRef}
            onClick={() => setOpen(!open)}
            style={{ background: "none", border: "none", cursor: "pointer" }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" height="40px" viewBox="0 -960 960 960" width="40px" fill="#000000ff">
              <path d="M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z" />
            </svg>
          </button>
        </div>

        {/* Dropdown Menu */}
        {open && (
          <div className="hamburgSelection-host" ref={menuRef}>
            <div className="profileDiv">
              <svg xmlns="http://www.w3.org/2000/svg" width="35" height="35" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                <path fillRule="evenodd" d="M8 9a5 5 0 0 0-5 5v1h10v-1a5 5 0 0 0-5-5Z" />
              </svg>
              <button onClick={() => navigate("profile")}>
                {userData?.firstName || "My Profile"}
              </button>
            </div>

            <button>📅 Bookings</button>
            <button>❤️ Favorites</button>
            <button onClick={()=> openMessages()}>💬 Messages</button>
            <button>⚙️ Account Settings</button>
            <button>🔔 Notifications</button>
            <button>📞 Help</button>
            <button onClick={handleLogout}>🚪 Logout</button>
          </div>
        )}
      </nav>

      {/* Page Content */}
      <div className="guest-main-page">{renderPage()}</div>
    </>
  );
}

export default Guest_Logged_Navigation;
