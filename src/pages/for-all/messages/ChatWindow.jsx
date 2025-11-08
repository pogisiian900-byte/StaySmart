import React, { useState, useEffect, useRef } from "react";
import { db, auth } from "../../../config/firebase";
import {
  collection,
  query,
  orderBy,
  addDoc,
  onSnapshot,
  serverTimestamp,
  doc,
  updateDoc,
  getDoc,
  where,
  getDocs,
} from "firebase/firestore";
import { useNavigate, useParams } from "react-router-dom";
import "./ChatWindow.css";

export default function ChatWindow({ conversationId }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [otherUser, setOtherUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [hostListings, setHostListings] = useState([]);
  const [showPromoDialog, setShowPromoDialog] = useState(false);
  const [selectedPromoListing, setSelectedPromoListing] = useState(null);
  const bottomRef = useRef();
  const messagesEndRef = useRef();
  const navigate = useNavigate();
  const { guestId, hostId } = useParams();

  // Fetch current user data
  useEffect(() => {
    const fetchCurrentUser = async () => {
      const user = auth.currentUser;
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "Users", user.uid));
          if (userDoc.exists()) {
            setCurrentUser(userDoc.data());
          }
        } catch (error) {
          console.error("Error fetching current user:", error);
        }
      }
    };
    fetchCurrentUser();
  }, []);

  // Fetch conversation data to get other user info
  useEffect(() => {
    if (!conversationId) return;

    const fetchConversation = async () => {
      try {
        const convDoc = await getDoc(doc(db, "Conversations", conversationId));
        if (convDoc.exists()) {
          const convData = convDoc.data();
          const otherUserId = convData.members?.find(
            (m) => m !== auth.currentUser?.uid
          );
          
          if (otherUserId) {
            const otherUserDoc = await getDoc(doc(db, "Users", otherUserId));
            if (otherUserDoc.exists()) {
              setOtherUser(otherUserDoc.data());
            }
          }
        }
      } catch (error) {
        console.error("Error fetching conversation:", error);
      }
    };

    fetchConversation();
  }, [conversationId]);

  // Fetch host listings if current user is a host
  useEffect(() => {
    const fetchHostListings = async () => {
      const user = auth.currentUser;
      if (!user || currentUser?.role !== 'host') return;

      try {
        const listingsQuery = query(
          collection(db, "Listings"),
          where("hostId", "==", user.uid)
        );
        const listingsSnapshot = await getDocs(listingsQuery);
        const listings = listingsSnapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .filter((listing) => listing.discount > 0 && listing.promoCode); // Only listings with promo codes
        
        setHostListings(listings);
      } catch (error) {
        console.error("Error fetching host listings:", error);
      }
    };

    if (currentUser) {
      fetchHostListings();
    }
  }, [currentUser]);

  // Listen to messages
  useEffect(() => {
    if (!conversationId) return;

    const q = query(
      collection(db, "Conversations", conversationId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [conversationId]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;

    const user = auth.currentUser;
    if (!user) return alert("You must be logged in to send messages.");

    try {
      await addDoc(
        collection(db, "Conversations", conversationId, "messages"),
        {
          senderId: user.uid,
          text: text.trim(),
          type: "text",
          createdAt: serverTimestamp(),
        }
      );

      // Update last message on parent conversation
      await updateDoc(doc(db, "Conversations", conversationId), {
        lastMessage: text.trim(),
        updatedAt: serverTimestamp(),
      });

      setText("");
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message. Please try again.");
    }
  };

  const sendPromoCode = async (listing) => {
    if (!listing.promoCode || !listing.discount) {
      alert("This listing doesn't have a promo code.");
      return;
    }

    const user = auth.currentUser;
    if (!user) return alert("You must be logged in to send messages.");

    try {
      const promoMessage = {
        senderId: user.uid,
        type: "promoCode",
        listingId: listing.id,
        listingTitle: listing.title,
        listingPhoto: listing.photos?.[0] || null,
        promoCode: listing.promoCode,
        discount: listing.discount,
        text: `🎉 Special Offer! Use promo code "${listing.promoCode}" for ${listing.discount}% off on "${listing.title}"!`,
        createdAt: serverTimestamp(),
      };

      await addDoc(
        collection(db, "Conversations", conversationId, "messages"),
        promoMessage
      );

      // Update last message on parent conversation
      await updateDoc(doc(db, "Conversations", conversationId), {
        lastMessage: `Promo code: ${listing.promoCode}`,
        updatedAt: serverTimestamp(),
      });

      setShowPromoDialog(false);
      setSelectedPromoListing(null);
    } catch (error) {
      console.error("Error sending promo code:", error);
      alert("Failed to send promo code. Please try again.");
    }
  };

  const handleUsePromoCode = (message) => {
    if (!guestId || !message.listingId) return;
    
    // Navigate to listing with promo code pre-applied
    navigate(`/guest/${guestId}/view-listing/${message.listingId}`, {
      state: {
        promoCode: message.promoCode,
        fromMessage: true,
      },
    });
  };

  const formatTime = (timestamp) => {
    if (!timestamp?.toDate) return "";
    const date = timestamp.toDate();
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
    }
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const otherUserName =
    otherUser?.firstName && otherUser?.lastName
      ? `${otherUser.firstName} ${otherUser.lastName}`
      : otherUser?.emailAddress || "User";

  const handleBack = () => {
    if (guestId) {
      navigate(`/guest/${guestId}/messages`);
    } else if (hostId) {
      navigate(`/host/${hostId}/messages`);
    } else {
      // Fallback: navigate to home or previous page
      navigate(-1);
    }
  };

  return (
    <div className="chat-window-container">
      {/* Chat Header */}
      <div className="chat-header">
        <div className="chat-header-left">
          <button className="chat-back-btn" onClick={handleBack} title="Go back">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="chat-header-user">
            <div className="chat-avatar">
              {otherUserName.charAt(0).toUpperCase()}
            </div>
            <div className="chat-header-info">
              <h3>{otherUserName}</h3>
              <span className="chat-status">
                {otherUser?.role ? otherUser.role.charAt(0).toUpperCase() + otherUser.role.slice(1) : "User"}
              </span>
            </div>
          </div>
        </div>
        <div className="chat-header-actions">
          <button className="chat-action-btn" title="More options">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="5" r="1" />
              <circle cx="12" cy="12" r="1" />
              <circle cx="12" cy="19" r="1" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="chat-messages" ref={bottomRef}>
        {messages.length === 0 ? (
          <div className="chat-empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((m, index) => {
            const isMe = m.senderId === auth.currentUser?.uid;
            const showAvatar = index === 0 || messages[index - 1].senderId !== m.senderId;
            const showTime = index === messages.length - 1 || 
              messages[index + 1].senderId !== m.senderId;

            // Check if message is a promo code
            const isPromoCode = m.type === "promoCode";

            return (
              <div
                key={m.id}
                className={`message-wrapper ${isMe ? "message-sent" : "message-received"}`}
              >
                {!isMe && showAvatar && (
                  <div className="message-avatar">
                    {otherUserName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="message-content-group">
                  {isPromoCode ? (
                    <div className={`promo-code-message ${isMe ? "promo-mine" : "promo-theirs"}`}>
                      {m.listingPhoto && (
                        <img 
                          src={m.listingPhoto} 
                          alt={m.listingTitle} 
                          className="promo-listing-image"
                        />
                      )}
                      <div className="promo-code-content">
                        <div className="promo-code-badge">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                          </svg>
                          <span>{m.discount}% OFF</span>
                        </div>
                        <h4 className="promo-listing-title">{m.listingTitle}</h4>
                        <p className="promo-code-text">Promo Code: <strong>{m.promoCode}</strong></p>
                        {!isMe && guestId && (
                          <button 
                            className="promo-use-btn"
                            onClick={() => handleUsePromoCode(m)}
                          >
                            Use This Promo Code
                          </button>
                        )}
                      </div>
                      {showTime && (
                        <span className="message-time promo-time">
                          {formatTime(m.createdAt)}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className={`message-bubble ${isMe ? "message-mine" : "message-theirs"}`}>
                      <p className="message-text">{m.text}</p>
                      {showTime && (
                        <span className="message-time">
                          {formatTime(m.createdAt)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef}></div>
      </div>

      {/* Message Input */}
      <form className="chat-input-form" onSubmit={sendMessage}>
        <div className="chat-input-container">
          {currentUser?.role === 'host' && hostListings.length > 0 && (
            <button 
              type="button" 
              className="chat-promo-btn" 
              title="Share Promo Code"
              onClick={() => setShowPromoDialog(true)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </button>
          )}
          <button type="button" className="chat-attachment-btn" title="Attach file">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message..."
            className="chat-input"
            autoFocus
          />
          <button
            type="submit"
            className="chat-send-btn"
            disabled={!text.trim()}
            title="Send message"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </form>

      {/* Promo Code Dialog */}
      {showPromoDialog && (
        <div className="promo-dialog-overlay" onClick={() => setShowPromoDialog(false)}>
          <div className="promo-dialog-content" onClick={(e) => e.stopPropagation()}>
            <div className="promo-dialog-header">
              <h3>Share Promo Code</h3>
              <button 
                className="promo-dialog-close"
                onClick={() => setShowPromoDialog(false)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="promo-dialog-body">
              {hostListings.length === 0 ? (
                <p className="no-promo-message">You don't have any listings with promo codes yet. Add a promo code to your listing first.</p>
              ) : (
                <div className="promo-listings-list">
                  {hostListings.map((listing) => (
                    <div 
                      key={listing.id}
                      className={`promo-listing-item ${selectedPromoListing?.id === listing.id ? 'selected' : ''}`}
                      onClick={() => setSelectedPromoListing(listing)}
                    >
                      {listing.photos?.[0] && (
                        <img 
                          src={listing.photos[0]} 
                          alt={listing.title}
                          className="promo-listing-thumb"
                        />
                      )}
                      <div className="promo-listing-info">
                        <h4>{listing.title}</h4>
                        <div className="promo-listing-details">
                          <span className="promo-code-preview">Code: <strong>{listing.promoCode}</strong></span>
                          <span className="promo-discount-preview">{listing.discount}% OFF</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {hostListings.length > 0 && (
              <div className="promo-dialog-footer">
                <button
                  className="promo-send-btn"
                  onClick={() => selectedPromoListing && sendPromoCode(selectedPromoListing)}
                  disabled={!selectedPromoListing}
                >
                  Send Promo Code
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}