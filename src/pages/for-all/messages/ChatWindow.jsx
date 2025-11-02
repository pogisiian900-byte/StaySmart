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
} from "firebase/firestore";
import { useNavigate, useParams } from "react-router-dom";
import "./ChatWindow.css";

export default function ChatWindow({ conversationId }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [otherUser, setOtherUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
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
                  <div className={`message-bubble ${isMe ? "message-mine" : "message-theirs"}`}>
                    <p className="message-text">{m.text}</p>
                    {showTime && (
                      <span className="message-time">
                        {formatTime(m.createdAt)}
                      </span>
                    )}
                  </div>
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
    </div>
  );
}