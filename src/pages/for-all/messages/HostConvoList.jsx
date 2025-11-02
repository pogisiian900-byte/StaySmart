import React, { useEffect, useState } from "react";
import { db, auth } from "../../../config/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function HostConvoList() {
  const [conversations, setConversations] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // 🔍 Get all conversations where host is part of "members"
    const q = query(
      collection(db, "Conversations"),
      where("members", "array-contains", user.uid)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const convos = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Sort by most recent update
      convos.sort(
        (a, b) =>
          (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0)
      );

      setConversations(convos);
    });

    return () => unsub();
  }, []);

  const openConversation = (conversationId) => {
    const hostId = auth.currentUser.uid;
    navigate(`/host/${hostId}/chat/${conversationId}`);
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Host Messages</h2>
      {conversations.length === 0 ? (
        <p>No conversations yet</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {conversations.map((c) => {
            const otherUser = c.members.find((m) => m !== auth.currentUser.uid);
            return (
              <li
                key={c.id}
                onClick={() => openConversation(c.id)}
                style={{
                  padding: "10px",
                  borderBottom: "1px solid #ddd",
                  cursor: "pointer",
                }}
              >
                <strong>Chat with: {otherUser}</strong>
                <p style={{ color: "#555" }}>
                  {c.lastMessage || "No messages yet"}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
