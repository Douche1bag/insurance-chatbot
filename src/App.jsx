import React, { useState, useRef, useEffect } from 'react';
import ChatHeader from './components/ChatHeader';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import LoadingIndicator from './components/LoadingIndicator';
import { APIService } from './services/apiService';
import { WELCOME_MESSAGE, ERROR_MESSAGE } from './utils/constants';
import './Styles/App.css';

export default function App() {
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', content: input };
    const conversationMessages = [...messages, userMessage].filter(
      m => m.content !== WELCOME_MESSAGE.content
    );

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const result = await APIService.sendMessage(conversationMessages);

    if (result?.success) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: result.message
      }]);
    } else {
      setMessages(prev => [...prev, ERROR_MESSAGE]);
    }

    setIsLoading(false);
  };

  return (
    <div className="app-root">
      <div className="chat-shell">
        <ChatHeader />

        <main className="chat-window">
          <div className="messages-stack">
            {messages.map((message, index) => (
              <ChatMessage key={index} message={message} />
            ))}

            {isLoading && <LoadingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        </main>

        <footer className="chat-input-area">
          <ChatInput
            value={input}
            onChange={setInput}
            onSend={handleSend}
            disabled={isLoading}
          />
        </footer>
      </div>
    </div>
  );
}
  
