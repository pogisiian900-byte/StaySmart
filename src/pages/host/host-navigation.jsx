import { useState, useEffect, useRef } from "react";
import "../host/host.css";
import Logo from "/static/logo.png";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../../config/firebase";
import { signOut } from "firebase/auth";
import { collection, onSnapshot, query, where, writeBatch, doc } from "firebase/firestore";
import HostDashboard from "../../components/Host/Dashboard";
import Listings from "../../components/Host/Listings";
import Bookings from "../../pages/host/HostBookings";
import Earnings from "../../components/Host/Earnings";
import Points from "../../components/Host/Points";
import 'dialog-polyfill/dist/dialog-polyfill.css';
import dialogPolyfill from 'dialog-polyfill';

function Host_Navigation({ hostId, userData }) {
  const [open, setOpen] = useState(false);
  const [renderedPage, setRenderedPage] = useState("dashboard");
  const [selectedNav, setSelectedNav] = useState("dashboard");
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const logoutDialogRef = useRef(null);
  const navigate = useNavigate();
  const menuRef = useRef(null); // ⬅️ for detecting outside clicks
  const buttonRef = useRef(null); // ⬅️ prevent immediate closing when clicking button
  const notificationRef = useRef(null);
  const notificationButtonRef = useRef(null);

  // Register dialog polyfill
  useEffect(() => {
    if (logoutDialogRef.current && !logoutDialogRef.current.showModal) {
      dialogPolyfill.registerDialog(logoutDialogRef.current);
    }
  }, []);

  const showLogoutConfirmation = () => {
    setShowLogoutDialog(true);
    if (logoutDialogRef.current) {
      try {
        if (typeof logoutDialogRef.current.showModal === 'function') {
          logoutDialogRef.current.showModal();
        } else {
          dialogPolyfill.registerDialog(logoutDialogRef.current);
          logoutDialogRef.current.showModal();
        }
      } catch (err) {
        console.error('Error showing logout dialog:', err);
        logoutDialogRef.current.style.display = 'block';
      }
    }
  };

  const handleCloseLogoutDialog = () => {
    setShowLogoutDialog(false);
    logoutDialogRef.current?.close();
  };

  const handleLogout = async () => {
    try {
      handleCloseLogoutDialog();
      await signOut(auth);
      console.log("Host logged out");
      navigate("/host", { replace: true });
    } catch (err) {
      console.error("Logout failed:", err.message);
      alert('Failed to logout. Please try again.');
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
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target) &&
        !notificationButtonRef.current.contains(event.target)
      ) {
        setNotificationOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // ✅ Subscribe to notifications for host
  useEffect(() => {
    if (!hostId) {
      return;
    }
    
    // Query ALL notifications and filter client-side to support both old and new formats
    // Old format: has hostId but no recipientId
    // New format: has recipientId
    const allNotificationsQuery = query(collection(db, 'Notifications'));
    
    const unsub = onSnapshot(
      allNotificationsQuery, 
      (snap) => {
        try {
          const list = [];
          snap.forEach((d) => {
            try {
              const data = d.data();
              const hasRecipientId = data.recipientId === hostId;
              const hasOldFormatHostId = data.hostId === hostId && !data.recipientId;
              
              // Include if: new format (recipientId matches) OR old format (hostId matches but no recipientId)
              if (hasRecipientId || hasOldFormatHostId) {
                // If old format, add recipientId for consistency
                if (hasOldFormatHostId && !data.recipientId) {
                  data.recipientId = data.hostId;
                }
                
                list.push({ id: d.id, ...data });
              }
            } catch (err) {
              // Error processing notification document
            }
          });
          
          list.sort((a, b) => {
            try {
              const toMs = (v) => (v?.toMillis ? v.toMillis() : (v?.seconds ? v.seconds * 1000 : (Date.parse(v) || 0)));
              return toMs(b.createdAt) - toMs(a.createdAt);
            } catch (err) {
              return 0;
            }
          });
          
          const unread = list.filter(n => !n.read);
          
          setNotifications(list);
          setUnreadCount(unread.length);
        } catch (error) {
          // Error processing notifications
        }
      },
      (error) => {
        // Firestore snapshot error
      }
    );
    
    return () => {
      if (unsub) unsub();
    };
  }, [hostId]);

  // ✅ Mark all as read when dropdown opens
  const handleNotificationClick = async () => {
    try {
      const nextOpen = !notificationOpen;
      setNotificationOpen(nextOpen);
      if (nextOpen) {
        const unread = notifications.filter(n => !n.read);
        if (unread.length === 0) return;
        try {
          const batch = writeBatch(db);
          unread.forEach((n) => {
            try {
              batch.update(doc(db, 'Notifications', n.id), { read: true });
            } catch (err) {
              // Error adding notification to batch
            }
          });
          await batch.commit();
        } catch (e) {
          // Failed to mark notifications read
        }
      }
    } catch (error) {
      // Error in handleNotificationClick
    }
  };

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
      case "points":
        return <Points hostId={hostId} />;
      default:
        return <p>Page not Found</p>;
    }
  };

  return (
    <>
      <nav className="host-nav">
        <div className="navLogo">
          <img src={Logo} alt="StaySmart logo" className="navLogoImage" />
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

        {/* Notification & Hamburger button */}
        <div className="host-hamburgDiv">
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

          {/* Hamburger button */}
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
                  <div className="notification-icon">🔔</div>
                  <div className="notification-content">
                    <p className="notification-title">No notifications</p>
                    <p className="notification-time">—</p>
                  </div>
                </div>
              )}
              {notifications.map((n) => (
                <div key={n.id} className={`notification-item ${!n.read ? 'unread' : ''}`} onClick={() => {
                    if (n.conversationId) {
                    navigate(`/host/${hostId}/chat/${n.conversationId}`)
                  } else if (n.reservationId || n.navigateTo === 'bookings') {
                    // Navigate to bookings page when clicking on booking-related notifications
                    navigate(`/host/${hostId}/bookings`)
                  } else if (n.listingId) {
                    navigate(`/host/${hostId}/${n.listingId}`)
                  }
                }}>
                  <div className="notification-icon">🔔</div>
                  <div className="notification-content">
                    <p className="notification-title">{n.title || 'Notification'}</p>
                    {n.message && <p className="notification-message" style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>{n.message}</p>}
                    <p className="notification-time">{n.createdAt ? new Date(n.createdAt?.toMillis ? n.createdAt.toMillis() : n.createdAt).toLocaleString() : ''}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="notification-footer">
              <button className="view-all-notifications" onClick={() => {
                if (hostId) navigate(`/host/${hostId}/notifications`)
              }}>View All Notifications</button>
            </div>
          </div>
        )}

        {/* Dropdown Menu */}
        {open && (
          <div className="hamburgSelection-host" ref={menuRef}>
            <div className="profileDiv">
              {userData?.profilePicture ? (
                <img 
                  src={userData.profilePicture} 
                  alt="Profile" 
                  style={{
                    width: "35px",
                    height: "35px",
                    borderRadius: "50%",
                    objectFit: "cover"
                  }}
                />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="35" height="35" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                  <path fillRule="evenodd" d="M8 9a5 5 0 0 0-5 5v1h10v-1a5 5 0 0 0-5-5Z" />
                </svg>
              )}
              <button onClick={() => navigate("profile")}>
                {userData.firstName || "My Profile"}
              </button>
            </div>



          <button onClick={() => navigate(`/host/${hostId}/messages`)}>💬 Messages</button>
            <button onClick={() => { handleNotificationClick(); setOpen(false); }}>🔔 Notifications {unreadCount > 0 && `(${unreadCount})`}</button>
            <button
              onClick={() => {
                setRenderedPage("points");
                setSelectedNav("points");
                setOpen(false);
              }}
            >
              ⭐ Points & Perks
            </button>
            <button>⚙️ Account Settings</button>
            <button onClick={showLogoutConfirmation}>🚪 Logout</button>
          </div>
        )}
      </nav>

      <div className="host-main-page">{renderingPages()}</div>
      {/* Logout Confirmation Dialog */}
      {showLogoutDialog && (
        <dialog ref={logoutDialogRef} className="logout-confirmation-dialog" style={{ maxWidth: '500px', width: '90%', border: 'none', borderRadius: '16px', padding: 0, boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)' }}>
          <style>
            {`.logout-confirmation-dialog::backdrop {
              background: rgba(0, 0, 0, 0.5);
              backdrop-filter: blur(4px);
            }`}
          </style>
          <div style={{ padding: '30px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>🚪</div>
            <h2 style={{ margin: '0 0 15px 0', fontSize: '24px', fontWeight: '600', color: '#1f2937' }}>
              Confirm Logout
            </h2>
            <p style={{ margin: '0 0 30px 0', fontSize: '16px', color: '#6b7280', lineHeight: '1.5' }}>
              Are you sure you want to logout? You will need to login again to access your account.
            </p>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
              <button
                onClick={handleCloseLogoutDialog}
                style={{
                  padding: '12px 24px',
                  fontSize: '16px',
                  fontWeight: '600',
                  borderRadius: '8px',
                  border: '2px solid #e5e7eb',
                  background: 'white',
                  color: '#374151',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.target.style.background = '#f9fafb';
                  e.target.style.borderColor = '#d1d5db';
                }}
                onMouseOut={(e) => {
                  e.target.style.background = 'white';
                  e.target.style.borderColor = '#e5e7eb';
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                style={{
                  padding: '12px 24px',
                  fontSize: '16px',
                  fontWeight: '600',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#31326F',
                  color: 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.target.style.background = '#252550';
                }}
                onMouseOut={(e) => {
                  e.target.style.background = '#31326F';
                }}
              >
                Logout
              </button>
            </div>
          </div>
        </dialog>
      )}
    </>
  );
}

export default Host_Navigation;
