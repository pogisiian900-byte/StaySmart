import React from "react";
import { useParams } from "react-router-dom";
import ChatWindow from "./ChatWindow";
import "./ChatWindow.css";

export default function ChatPage() {
  const { conversationId } = useParams();
  return (
    <div className="chat-page-wrapper">
      <ChatWindow conversationId={conversationId} />
    </div>
  );
}
