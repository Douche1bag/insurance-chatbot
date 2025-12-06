import React from 'react';
import '../Styles/ChatMessage.css';

export default function ChatMessage({ message }) {
  const isUser = message?.role === 'user';

  return (
    <div className={`message-row ${isUser ? 'user' : 'assistant'}`}>
      <div className={`message-bubble ${isUser ? 'user' : 'assistant'}`}>
        <div className="message-content">{message?.content}</div>
      </div>
    </div>
  );
}
