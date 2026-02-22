// src/Pages/ChatPage.jsx
import React, { useState, useRef, useEffect } from 'react';
import { APIService } from '../services/apiService';
import '../Styles/App.css';

export default function ChatPage() {
  const chatBoxRef = useRef(null);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState(() => {
    // โหลดข้อความจาก localStorage ถ้ามี
    try {
      const saved = localStorage.getItem('chat_messages');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);

  // Scroll to bottom when messages or loading changes
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Save messages to localStorage ทุกครั้งที่ messages เปลี่ยน
  useEffect(() => {
    try {
      localStorage.setItem('chat_messages', JSON.stringify(messages));
    } catch {}
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    
    const userMessage = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    setLoading(true);

    try {
      // Simple API call for now (RAG will be re-implemented later)
      const messagesForAPI = [
        { role: 'system', content: 'คุณเป็นผู้ช่วยด้านประกันภัยไทยที่มีความเชี่ยวชาญ กรุณาตอบคำถามเป็นภาษาไทย' },
        { role: 'user', content: userMessage }
      ];

      const response = await APIService.sendMessage(messagesForAPI);
      
      if (response.success) {
        setMessages(prev => [...prev, { role: 'assistant', content: response.message }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'ขออภัยครับ เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้ง' }]);
      }
    } catch (error) {
      console.error('Error in chat:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'ขออภัยครับ เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้ง' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">AI Chat</h1>
      <div className="flex-1 flex flex-col">
        <div
          className="bg-white rounded-lg border p-4 mb-4 overflow-y-auto"
          style={{height: '60vh'}}
          ref={chatBoxRef}
        >
          {messages.length === 0 ? (
            <div className="text-gray-500 text-center">
              Start a conversation...
            </div>
          ) : (
              messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`mb-4 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <span className="mr-2 flex items-start text-2xl">🤖</span>
                  )}
                  <div
                  // ปรับปรุงการแสดงผลข้อความให้รองรับข้อความยาวและมีการตัดคำที่เหมาะสม max-w-"xl" ถ้าอยากให้กว้างขึ้นสามารถปรับเป็น max-w-2xl หรือ max-w-3xl ได้ตามต้องการ
                    className={`p-3 rounded-lg max-w-xl min-w-/4 break-words ${
                      msg.role === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-800'
                    }`}
                    style={{ wordBreak: 'break-word', whiteSpace: 'pre-line', overflowWrap: 'break-word' }}
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
    </div>
  );
}