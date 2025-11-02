import { useState, useEffect, useRef } from "react";
import "../host/host.css";
import Logo from "/static/logo.png";
import { useNavigate } from "react-router-dom";
import { auth } from "../../config/firebase";
import { signOut } from "firebase/auth";
import HostDashboard from "../../components/Host/Dashboard";
import Listings from "../../components/Host/Listings";
import Bookings from "../../components/Host/Bookings";
import Earnings from "../../components/Host/Earnings";

function Host_Navigation({ hostId, userData }) {
  const [open, setOpen] = useState(false);
  const [renderedPage, setRenderedPage] = useState("dashboard");
  const [selectedNav, setSelectedNav] = useState("dashboard");
  const navigate = useNavigate();
  const menuRef = useRef(null); // ⬅️ for detecting outside clicks
  const buttonRef = useRef(null); // ⬅️ prevent immediate closing when clicking button

  const handleLogout = async () => {
    try {
      await signOut(auth);
      console.log("Host logged out");
      navigate("/host", { replace: true });
    } catch (err) {
      console.error("Logout failed:", err.message);
    }
  };

  // ✅ Close hamburger when clicking outside
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
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const renderingPages = () => {
    switch (renderedPage) {
      case "dashboard":
        return <HostDashboard />;
      case "listings":
        return <Listings hostId={hostId} />;
      case "reservations":
        return <Bookings />;
      case "earnings":
        return <Earnings />;
      default:
        return <p>Page not Found</p>;
    }
  };

  return (
    <>
      <nav className="host-nav">
        <div className="navLogo">
          <img src={Logo} alt="" width={"150px"} />
        </div>

        {/* Main Navigation */}
        <div
          className={selectedNav === "dashboard" ? "navItem navActive" : "navItem"}
          onClick={() => {
            setRenderedPage("dashboard");
            setSelectedNav("dashboard");
          }}
        >
          <a href="#">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" viewBox="0 0 16 16">
              <path d="M8.707 1.5a1 1 0 0 0-1.414 0L.646 8.146a.5.5 0 0 0 .708.708L2 8.207V13.5A1.5 1.5 0 0 0 3.5 15h9a1.5 1.5 0 0 0 1.5-1.5V8.207l.646.647a.5.5 0 0 0 .708-.708L13 5.793V2.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1.293zM13 7.207V13.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V7.207l5-5z" />
            </svg>
            <span>Dashboard</span>
          </a>
        </div>

        <div
          className={selectedNav === "listings" ? "navItem navActive" : "navItem"}
          onClick={() => {
            setRenderedPage("listings");
            setSelectedNav("listings");
          }}
        >
          <a href="#">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/>
              <path d="M12 22V12"/><polyline points="3.29 7 12 12 20.71 7"/><path d="m7.5 4.27 9 5.15"/>
            </svg>
            <span>Listings</span>
          </a>
        </div>

        <div
          className={selectedNav === "reservations" ? "navItem navActive" : "navItem"}
          onClick={() => {
            setRenderedPage("reservations");
            setSelectedNav("reservations");
          }}
        >
          <a href="#">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 2v4"/><path d="M16 2v4"/><path d="M21 17V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11Z"/><path d="M3 10h18"/><path d="M15 22v-4a2 2 0 0 1 2-2h4"/>
            </svg>
            <span>Reservations</span>
          </a>
        </div>

        <div
          className={selectedNav === "earnings" ? "navItem navActive" : "navItem"}
          onClick={() => {
            setRenderedPage("earnings");
            setSelectedNav("earnings");
          }}
        >
          <a href="#">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17"/>
              <path d="m7 21 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9"/>
              <path d="m2 16 6 6"/><circle cx="16" cy="9" r="2.9"/><circle cx="6" cy="5" r="3"/>
            </svg>
            <span>Earnings</span>
          </a>
        </div>

        {/* Hamburger button */}
        <div className="host-hamburgDiv">
          <button
            ref={buttonRef}
            onClick={() => setOpen(!open)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
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
                {userData.firstName || "My Profile"}
              </button>
            </div>



          <button onClick={() => navigate(`/host/${hostId}/messages`)}>💬 Messages</button>
            <button>⚙️ Account Settings</button>
            <button onClick={handleLogout}>🚪 Logout</button>
          </div>
        )}
      </nav>

      <div className="host-main-page">{renderingPages()}</div>
    </>
  );
}

export default Host_Navigation;
