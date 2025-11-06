import { useState, useEffect, useRef } from "react";
import "../guest/guest.css";
import Logo from "/static/logo.png";
import Services from "/static/services.png"; 
import HomeIcon from "/static/home.png"; 
import Work from "/static/work.png"
import { useNavigate } from "react-router-dom";
import { auth, db } from "../../config/firebase";
import { signOut } from "firebase/auth";
import { collectionGroup, getDocs, collection, query, where, onSnapshot, writeBatch, doc } from "firebase/firestore";

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
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
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
  const notificationRef = useRef(null);
  const notificationButtonRef = useRef(null);

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
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target) &&
        !notificationButtonRef.current.contains(event.target)
      ) {
        setNotificationOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ✅ Subscribe to notifications for guest
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const q = query(collection(db, 'Notifications'), where('recipientId', '==', uid));
    const unsub = onSnapshot(q, (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const toMs = (v) => (v?.toMillis ? v.toMillis() : (v?.seconds ? v.seconds * 1000 : (Date.parse(v) || 0)));
        return toMs(b.createdAt) - toMs(a.createdAt);
      });
      setNotifications(list);
      setUnreadCount(list.filter(n => !n.read).length);
    });
    return () => unsub();
  }, []);

  // ✅ Mark all as read when opened
  const handleNotificationClick = async () => {
    const nextOpen = !notificationOpen;
    setNotificationOpen(nextOpen);
    if (nextOpen) {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const unread = notifications.filter(n => !n.read);
      if (unread.length === 0) return;
      try {
        const batch = writeBatch(db);
        unread.forEach((n) => batch.update(doc(db, 'Notifications', n.id), { read: true }));
        await batch.commit();
      } catch (e) {
        console.error('Failed to mark notifications read', e);
      }
    }
  };

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

        {/* Search, Notification & Hamburger Buttons */}
        <div className="host-hamburgDiv">
          {/* Search Button */}
          <button
            onClick={() => {
              const guestId = auth.currentUser?.uid;
              if (guestId) navigate(`/guest/${guestId}/search`);
            }}
            className="search-button"
            aria-label="Search"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
          </button>

          {/* Notification Button */}
          <button
            ref={notificationButtonRef}
            onClick={handleNotificationClick}
            className="notification-button"
            aria-label="Notifications"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadCount > 0 && (
              <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </button>

          {/* Hamburger Button */}
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

        {/* Notification Dropdown */}
        {notificationOpen && (
          <div className="notification-dropdown" ref={notificationRef}>
            <div className="notification-header">
              <h3>Notifications</h3>
              {unreadCount > 0 && (
                <button className="mark-all-read">Mark all as read</button>
              )}
            </div>
            <div className="notification-list">
              {notifications.length === 0 && (
                <div className="notification-item">
                  <div className="notification-icon">🔔 </div>
                  <div className="notification-content">
                    <p className="notification-title">No notifications</p>
                    <p className="notification-time">—</p>
                  </div>
                </div>
              )}
              {notifications.map((n) => (
                <div key={n.id} className={`notification-item ${!n.read ? 'unread' : ''}`} onClick={() => {
                  if (n.conversationId) {
                    const guestId = auth.currentUser?.uid;
                    if (guestId) navigate(`/guest/${guestId}/chat/${n.conversationId}`)
                  }
                }}>
                  <div className="notification-icon">🔔</div>
                  <div className="notification-content">
                    <p className="notification-title">{n.title || 'Notification'}</p>
                    <p className="notification-time">{n.createdAt ? new Date(n.createdAt?.toMillis ? n.createdAt.toMillis() : n.createdAt).toLocaleString() : ''}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="notification-footer">
              <button className="view-all-notifications" onClick={() => {
                const guestId = auth.currentUser?.uid;
                if (guestId) navigate(`/guest/${guestId}/notifications`)
              }}>View All Notifications</button>
            </div>
          </div>
        )}

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

            <button onClick={() => navigate("bookings")}>Bookings</button>
            <button onClick={() => { navigate("favourites"); setOpen(false); }}>Favorites</button>
            <button onClick={()=> openMessages()}>Messages</button>
            <button>Account Settings</button>
            <button onClick={() => { handleNotificationClick(); setOpen(false); }}>Notifications {unreadCount > 0 && `(${unreadCount})`}</button>
            <button onClick={handleLogout}>Logout</button>
          </div>
        )}
      </nav>

      {/* Page Content */}
      <div className="guest-main-page">{renderPage()}</div>
    </>
  );
}

export default Guest_Logged_Navigation;
