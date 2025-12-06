import React from 'react';
import { MESSAGES } from '../utils/constants';

export default function LoadingIndicator() {
  return (
    <div className="loading-indicator-wrapper" role="status" aria-live="polite">
      <div className="loading-bubble">
        <div className="loading-content">
          <span className="loading-spinner">⏳</span> {/* Replaced Loader2 */}
          <span>{MESSAGES.LOADING}</span>
        </div>
      </div>
    </div>
  );
}