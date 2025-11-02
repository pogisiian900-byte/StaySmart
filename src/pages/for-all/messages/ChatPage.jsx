import React from "react";
import { useParams } from "react-router-dom";
import ChatWindow from "../../for-all/messages/ChatWindow";

export default function ChatPage() {
  const { conversationId } = useParams();
  return (
    <div className="chat-page">
      <ChatWindow conversationId={conversationId} />
    </div>
  );
}
