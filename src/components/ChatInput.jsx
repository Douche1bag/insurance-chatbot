import React from 'react';
import { MESSAGES } from '../utils/constants';

export default function ChatInput({ value, onChange, onSend, disabled }) {
  const handleKeyDown = e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="chat-input-container">
      <div className="chat-input-wrapper">
        <div className="input-box">
          <textarea
            className="input-textarea"
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={MESSAGES.PLACEHOLDER}
            rows={3}
            disabled={disabled}
          />
          <button
            onClick={onSend}
            disabled={!value.trim() || disabled}
            className="send-button"
            aria-label="Send message"
          >
            ➤
          </button>
        </div>
        <p className="input-hint">{MESSAGES.HINT}</p>
      </div>
    </div>
  );
}