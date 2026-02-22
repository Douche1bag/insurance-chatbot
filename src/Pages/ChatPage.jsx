// src/Pages/ChatPage.jsx
import React, { useState } from 'react';
import '../Styles/App.css';

export default function ChatPage({ user }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastContext, setLastContext] = useState(null);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    
    const userMessage = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    setLoading(true);

    try {
      // Call backend RAG endpoint
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: userMessage,
          userId: user?.id 
        })
      });

      const result = await response.json();
      
      if (result.success) {
        // Store context info for debugging
        setLastContext(result.metadata);
        
        // Add response with metadata
        const responseText = result.response;
        const contextInfo = result.metadata?.userContextCount > 0 
          ? `\n\n📚 ใช้ข้อมูลจากเอกสารของคุณ: ${result.metadata.userContextCount} เอกสาร`
          : result.metadata?.systemContextCount > 0
          ? `\n\n📚 ใช้ข้อมูลจากระบบ: ${result.metadata.systemContextCount} เอกสาร`
          : '';
        
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: responseText + contextInfo,
          metadata: result.metadata 
        }]);
      } else {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: result.error || 'ขออภัยครับ เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้ง' 
        }]);
      }
    } catch (error) {
      console.error('Error in chat:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'ขออภัยครับ เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้ง' 
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">AI Chat {user ? `- ${user.name}` : ''}</h1>
        {lastContext && (
          <div className="text-sm text-gray-500">
            📊 {lastContext.userContextCount > 0 
              ? `${lastContext.userContextCount} เอกสารของคุณ` 
              : `${lastContext.systemContextCount} เอกสารระบบ`}
          </div>
        )}
      </div>
      
      <div className="flex-1 bg-white rounded-lg border p-4 mb-4 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="text-gray-500 text-center">
            <p className="mb-2">ถามคำถามเกี่ยวกับประกันภัย...</p>
            {user && <p className="text-sm">💡 ระบบจะค้นหาจากเอกสารที่คุณอัปโหลดก่อน</p>}
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex w-full mb-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
<<<<<<< HEAD
                className={`p-3 rounded-2xl shadow-sm max-w-[70%] break-words whitespace-pre-line flex items-start gap-2 ${
=======
                className={`inline-block p-3 rounded-lg max-w-xl whitespace-pre-line ${
>>>>>>> origin/main
                  msg.role === 'user'
                    ? 'bg-blue-500 text-white rounded-br-md'
                    : 'bg-gray-100 text-gray-800 rounded-bl-md'
                }`}
                style={{ wordBreak: 'break-word' }}
              >
                {msg.role === 'assistant' && (
                  <span className="text-xl" aria-label="AI">🤖</span>
                )}
                <span>{msg.content}</span>
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="text-center text-gray-500">
            🔍 กำลังค้นหาข้อมูลและประมวลผล...
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
