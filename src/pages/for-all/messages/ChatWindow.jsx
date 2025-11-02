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
} from "firebase/firestore";

export default function ChatWindow({ conversationId }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const bottomRef = useRef();

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
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });

    return () => unsubscribe();
  }, [conversationId]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;

    const user = auth.currentUser;
    if (!user) return alert("You must be logged in to send messages.");

    await addDoc(collection(db, "Conversations", conversationId, "messages"), {
      senderId: user.uid,
      text: text.trim(),
      createdAt: serverTimestamp(),
    });

    // Update last message on parent conversation
    await updateDoc(doc(db, "Conversations", conversationId), {
      lastMessage: text.trim(),
      updatedAt: serverTimestamp(),
    });

    setText("");
  };

  return (
    <div className="chat-window">
      <div className="messages" style={{ height: "400px", overflowY: "auto" }}>
        {messages.map((m) => (
          <div
            key={m.id}
            className={`message ${m.senderId === auth.currentUser?.uid ? "me" : "them"}`}
            style={{
              textAlign: m.senderId === auth.currentUser?.uid ? "right" : "left",
              margin: "10px",
            }}
          >
            <div
              className="bubble"
              style={{
                display: "inline-block",
                padding: "8px 12px",
                borderRadius: "15px",
                background:
                  m.senderId === auth.currentUser?.uid ? "#0078fe" : "#e5e5ea",
                color: m.senderId === auth.currentUser?.uid ? "#fff" : "#000",
              }}
            >
              {m.text}
            </div>
          </div>
        ))}
        <div ref={bottomRef}></div>
      </div>

      <form onSubmit={sendMessage} style={{ display: "flex", marginTop: "10px" }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          style={{ flex: 1, padding: "10px" }}
        />
        <button type="submit" style={{ marginLeft: "5px" }}>
          Send
        </button>
      </form>
    </div>
  );
}
