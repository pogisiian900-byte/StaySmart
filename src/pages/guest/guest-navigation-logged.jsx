import "../guest/guest.css";
import Logo from "/static/logo.png";
import Services from "/static/services.png";
import HomeIcon from "/static/home.png";
import Work from "/static/work.png";
import profile from "/static/me.png";
import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../../config/firebase";
import { collectionGroup, getDocs } from "firebase/firestore";
import HomePages from "../../components/Home.jsx";
import ServicesPages from "../../components/Services.jsx";
import ExperiencePages from "../../components/Experience.jsx";

function Guest_Logged_Navigation({ userData }) {
  const [selectedNav, setSelectedNav] = useState("home");
  const [open, setOpen] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const [allListing, setAllListing] = useState({
  room: [],
  service: [],
  experience: [],
});


 useEffect(() => {
  const fetchAllListings = async () => {
    try {
      const querySnapshot = await getDocs(collectionGroup(db, "Listings"));
      const listings = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // 🔹 Group by serviceType
      const rooms = listings.filter((item) => item.serviceType === "room");
      const services = listings.filter((item) => item.serviceType === "service");
      const experiences = listings.filter((item) => item.serviceType === "experience");

      // ✅ Store them separately
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


  // ✅ Logout handler
 const handleLogout = async () => {
  console.log("Logout clicked"); // <--- Add this
  try {
    await signOut(auth);
    console.log("Guest logged out");
    navigate("/");
  } catch (err) {
    console.error("Logout failed:", err.message);
  }
};


  const renderPages = () => {
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
        {/* Left Section - Logo */}
        <div className="navLogo">
          <img src={Logo} alt="Logo" width={"150px"} />
        </div>

        {/* Center - Navigation Tabs */}
        <div className="nav1">
          <div
            className={selectedNav === "home" ? "navItem navActive" : "navItem"}
            onClick={() => setSelectedNav("home")}
          >
            <img src={HomeIcon} alt="home" width={"50px"} />
            <a>Home</a>
          </div>

          <div
            className={selectedNav === "service" ? "navItem navActive" : "navItem"}
            onClick={() => setSelectedNav("service")}
          >
            <img src={Services} alt="services" width={"50px"} />
            <a>Services</a>
          </div>

          <div
            className={selectedNav === "experience" ? "navItem navActive" : "navItem"}
            onClick={() => setSelectedNav("experience")}
          >
            <img src={Work} alt="experience" width={"50px"} />
            <a>Experiences</a>
          </div>
        </div>

        {/* Right - Profile & Menu */}
        <div className="host-hamburgDiv">
          <div className="profileDiv" 
            onClick={()=> navigate("profile")}
          >
            <p>{userData?.firstName || "Profile"}</p>
            <img src={profile} alt="profile" width={"50px"} />
          </div>

          {/* Hamburger menu toggle */}
          <button
            className="hamburgButton-guest"
            onClick={() => setOpen(!open)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="40px"
              viewBox="0 -960 960 960"
              width="40px"
              fill="#000000ff"
            >
              <path d="M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z" />
            </svg>
          </button>

          {/* Dropdown menu */}
          {open && (
            <div
                className="hamburgSelection"
>

              <button title="Your bookings">Bookings 📅</button>
              <button title="Saved places">Favorites ❤️</button>
              <button title="Chat with hosts">Messages 💬</button>
              <button title="Manage account">Account Settings ⚙️</button>
              <button title="Notifications">Notifications 🔔</button>
              <button title="Contact support">Help 📞</button>
              <button title="Log out" onClick={handleLogout}>
                Logout 🚪
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Page content area */}
      <div className="searchBar">
          <button>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-search-icon lucide-search"><path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/></svg>
          </button>
      </div>
      <div className="guest-page">{renderPages()}</div>
    </>
  );
}

export default Guest_Logged_Navigation;
