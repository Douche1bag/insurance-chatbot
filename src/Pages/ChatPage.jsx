// src/Pages/ChatPage.jsx
import React, { useState, useRef, useEffect } from 'react';
import ChatHeader from '../components/ChatHeader';
import ChatMessage from '../components/ChatMessage';
import ChatInput from '../components/ChatInput';
import LoadingIndicator from '../components/LoadingIndicator';
import { MOCK_MESSAGES } from '../utils/mock/messages';
import '../Styles/App.css';

export default function ChatPage() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState(MOCK_MESSAGES);
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef(null);

  // Mock chat history
  const chatHistory = [
    {
      id: 1,
      title: 'สอบถามกรมธรรม์สุขภาพ',
      lastMessage: 'ขอบคุณสำหรับข้อมูลค่ะ (mock)',
      time: '2 days ago',
    },
    {
      id: 2,
      title: 'เปรียบเทียบประกันชีวิต',
      lastMessage: 'ขอบคุณสำหรับข้อมูลค่ะ (mock)',
      time: '4 days ago',
    },
    {
      id: 3,
      title: 'สอบถามเบี้ยประกัน',
      lastMessage: 'ขอบคุณสำหรับข้อมูลค่ะ (mock)',
      time: '1 week ago',
    },
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = () => {
    if (!input.trim() || loading) return;
    setMessages(prev => [...prev, { role: 'user', content: input }]);
    setInput('');
    setLoading(true);
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'assistant', content: 'ขอบคุณสำหรับข้อมูลค่ะ (mock)' }]);
      setLoading(false);
    }, 1200);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 relative">
      {/* Overlay to cover document icon if still present */}
      <div className="absolute left-10 top-6 w-6 h-6 md:w-6 md:h-6 z-20 bg-white"></div>
        {/* Overlay to cover document icon if still present */}
        <div className="absolute left-10 top-6 w-6 h-6 md:w-6 md:h-6 z-20" style={{backgroundColor: 'white'}}></div>
      <div className="flex flex-1 h-full max-w-6xl mx-auto w-full mt-6 mb-4">
        {/* Main Chat Area */}
        <div className="flex flex-col flex-1 shadow-sm bg-white rounded-xl border border-slate-100">
          <ChatHeader />
          <main className="flex-1 overflow-y-auto px-8 py-8">
            <div className="flex flex-col gap-6 text-lg">
              {messages.map((msg, idx) => (
                <ChatMessage key={idx} message={msg} />
              ))}
              {loading && <LoadingIndicator />}
              <div ref={messagesEndRef} />
            </div>
          </main>
          <footer className="px-6 py-6 border-t bg-slate-50">
            <form
              className="flex items-end gap-2"
              onSubmit={e => { e.preventDefault(); handleSend(); }}
            >
              <textarea
                className="flex-1 resize-none rounded-full border border-slate-200 px-5 py-3 text-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white placeholder:text-slate-400 min-h-[44px] max-h-32"
                style={{ minHeight: 44, maxHeight: 120 }}
                placeholder="สอบถามข้อมูลกรมธรรม์ของคุณ..."
                value={input}
                onChange={e => setInput(e.target.value)}
                disabled={loading}
                rows={1}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-full shadow transition disabled:opacity-60"
                disabled={loading || !input.trim()}
              >
                ส่ง
              </button>
            </form>
          </footer>
        </div>
        {/* Chat History Sidebar */}
        <div className={`relative w-0 md:w-80 transition-all duration-300 ${showHistory ? 'w-72' : 'w-12'}`}>
          <button
            className={`absolute top-6 right-2 z-10 bg-white border border-slate-200 rounded-full shadow p-2 hover:bg-blue-50 transition ${showHistory ? '' : ''}`}
            onClick={() => setShowHistory(v => !v)}
            title="ประวัติการสนทนา"
          >
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
              <rect x="4" y="6" width="16" height="2" rx="1" fill="#2563eb"/>
              <rect x="4" y="11" width="16" height="2" rx="1" fill="#2563eb"/>
              <rect x="4" y="16" width="16" height="2" rx="1" fill="#2563eb"/>
            </svg>
          </button>
          <div className={`h-full bg-white border-l border-slate-100 shadow-sm rounded-r-xl overflow-y-auto transition-all duration-300 ${showHistory ? 'opacity-100 w-72 px-6 py-8' : 'opacity-0 w-0 px-0 py-0 pointer-events-none'}`} style={{ minHeight: '100%' }}>
            <div className="text-lg font-bold mb-6">ประวัติการสนทนา</div>
            <div className="flex flex-col gap-4">
              {chatHistory.map(hist => (
                <div key={hist.id} className="bg-slate-50 rounded-xl p-4 shadow-sm hover:bg-blue-50 cursor-pointer">
                  <div className="font-semibold text-blue-700 mb-1">{hist.title}</div>
                  <div className="text-slate-500 text-sm mb-1 truncate">{hist.lastMessage}</div>
                  <div className="text-xs text-slate-400">{hist.time}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
