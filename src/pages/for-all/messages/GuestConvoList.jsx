import React, { useEffect, useState } from "react";
import { db, auth } from "../../../config/firebase";
import { collection, query, where, onSnapshot, doc, getDoc } from "firebase/firestore";
import { useNavigate, useParams } from "react-router-dom";
import "./ConvoList.css";

export default function GuestConvoList() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { guestId } = useParams();

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    // Get all conversations where guest is part of "members"
    const q = query(
      collection(db, "Conversations"),
      where("members", "array-contains", user.uid)
    );

    const unsub = onSnapshot(
      q,
      async (snapshot) => {
        const convos = await Promise.all(
          snapshot.docs.map(async (docSnapshot) => {
            const data = docSnapshot.data();
            const otherUserId = data.members?.find((m) => m !== user.uid);

            // Fetch other user's data
            let otherUserData = null;
            if (otherUserId) {
              try {
                const userDoc = await getDoc(doc(db, "Users", otherUserId));
                if (userDoc.exists()) {
                  otherUserData = userDoc.data();
                }
              } catch (error) {
                console.error("Error fetching user data:", error);
              }
            }

            return {
              id: docSnapshot.id,
              ...data,
              otherUserId,
              otherUserData,
            };
          })
        );

        // Sort by most recent
        convos.sort(
          (a, b) =>
            (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0)
        );

        setConversations(convos);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching conversations:", error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const openConversation = (conversationId) => {
    const guestId = auth.currentUser.uid;
    navigate(`/guest/${guestId}/chat/${conversationId}`);
  };

  const formatTime = (timestamp) => {
    if (!timestamp?.toDate) return "";
    const date = timestamp.toDate();
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (diff < 86400000) {
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
    }
    if (diff < 604800000) {
      return date.toLocaleDateString("en-US", { weekday: "short" });
    }
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const getUserName = (userData) => {
    if (!userData) return "Unknown User";
    if (userData.firstName && userData.lastName) {
      return `${userData.firstName} ${userData.lastName}`;
    }
    return userData.emailAddress || "User";
  };

  if (loading) {
    return (
      <div className="convo-list-container">
        <div className="convo-list-loading">
          <div className="loading-spinner"></div>
          <p>Loading conversations...</p>
        </div>
      </div>
    );
  }

  const handleBack = () => {
    if (guestId) {
      navigate(`/guest/${guestId}`);
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="convo-list-container">
      <div className="convo-list-header">
        <button className="convo-back-btn" onClick={handleBack} title="Go back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="convo-header-content">
          <h1>Messages</h1>
          <p>Your conversations</p>
        </div>
      </div>

      {conversations.length === 0 ? (
        <div className="convo-list-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <h3>No conversations yet</h3>
          <p>Start chatting with hosts to book your stay!</p>
        </div>
      ) : (
        <div className="convo-list">
          {conversations.map((c) => {
            const userName = getUserName(c.otherUserData);
            const userInitial = userName.charAt(0).toUpperCase();

            return (
              <div
                key={c.id}
                className="convo-item"
                onClick={() => openConversation(c.id)}
              >
                <div className="convo-avatar">
                  {userInitial}
                </div>
                <div className="convo-content">
                  <div className="convo-header">
                    <h3>{userName}</h3>
                    {c.updatedAt && (
                      <span className="convo-time">
                        {formatTime(c.updatedAt)}
                      </span>
                    )}
                  </div>
                  <div className="convo-preview">
                    <p className="convo-last-message">
                      {c.lastMessage || "No messages yet"}
                    </p>
                    {c.otherUserData?.role && (
                      <span className="convo-badge">
                        {c.otherUserData.role}
                      </span>
                    )}
                  </div>
                </div>
                <div className="convo-arrow">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}