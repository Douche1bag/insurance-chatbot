// src/Pages/ChatPage.jsx
import React, { useState } from 'react';
import { APIService } from '../services/apiService';
import { ERROR_MESSAGE } from '../utils/constants';
import '../Styles/App.css';

export default function ChatPage() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    
    const userMessage = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    setLoading(true);

    try {
      const messagesForAPI = [
        { role: 'system', content: 'You are a helpful Thai insurance assistant.' },
        { role: 'user', content: userMessage }
      ];

      const response = await APIService.sendMessage(messagesForAPI);
      
      if (response.success) {
        setMessages(prev => [...prev, { role: 'assistant', content: response.message }]);
      } else {
        setMessages(prev => [...prev, ERROR_MESSAGE]);
      }
    } catch (error) {
      console.error('Error in chat:', error);
      setMessages(prev => [...prev, ERROR_MESSAGE]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">AI Chat</h1>
      
      <div className="flex-1 bg-white rounded-lg border p-4 mb-4 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="text-gray-500 text-center">
            Start a conversation...
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`mb-4 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
              <div
                className={`inline-block p-3 rounded-lg max-w-xs ${
                  msg.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-800'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="text-center text-gray-500">
            Loading...
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type your message..."
          className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300"
        >
          Send
        </button>
      </div>
    </div>
  );
}