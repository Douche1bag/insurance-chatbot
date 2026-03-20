// src/Pages/ChatPage.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import '../Styles/App.css';

export default function ChatPage({ user }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastContext, setLastContext] = useState(null);
  const [error, setError] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  
  // Conversation management
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [showConversationList, setShowConversationList] = useState(false);
  const [editingConvId, setEditingConvId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  
  // Auto-scroll ref
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  // Auto-scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Helper to get conversation ID (handle both _id and id)
  const getConvId = (conv) => conv?._id || conv?.id;

  const createNewConversation = useCallback(async () => {
    try {
      console.log('Creating new conversation for user:', user?.id);
      
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          title: `สนทนาใหม่ ${new Date().toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}`
        })
      });

      const result = await response.json();
      console.log('Create conversation result:', result);
      
      if (result.success && result.conversation) {
        setConversations(prev => [result.conversation, ...prev]);
        setCurrentConversationId(result.conversation._id || result.conversation.id);
        setMessages([]);
        console.log('Conversation created successfully:', result.conversation._id || result.conversation.id);
      } else {
        console.error('Failed to create conversation:', result);
        alert('ไม่สามารถสร้างการสนทนาใหม่ได้: ' + (result.error || 'ข้อผิดพลาดไม่ทราบสาเหตุ'));
      }
    } catch (error) {
      console.error('Failed to create conversation:', error);
      alert('เกิดข้อผิดพลาด: ' + error.message);
    }
  }, [user?.id]);

  const loadConversations = useCallback(async () => {
    try {
      setIsInitializing(true);
      setError(null);
      console.log('Loading conversations for user:', user.id);
      const response = await fetch(`/api/conversations/${user.id}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Conversations loaded:', result);
      
      if (result.success && result.conversations) {
        setConversations(result.conversations);
        
        // Auto-select first conversation or create new one
        if (result.conversations.length > 0) {
          const firstId = result.conversations[0]._id || result.conversations[0].id;
          console.log('Setting first conversation:', firstId);
          setCurrentConversationId(firstId);
        } else {
          console.log('No conversations found, creating new one');
          await createNewConversation();
        }
      } else {
        console.log('No conversations, creating first one');
        await createNewConversation();
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
      setError('ไม่สามารถโหลดการสนทนาได้: ' + error.message);
      // Try to create first conversation as fallback
      try {
        await createNewConversation();
      } catch (createError) {
        console.error('Failed to create initial conversation:', createError);
        setError('ไม่สามารถสร้างการสนทนาได้ กรุณารีเฟรชหน้าเว็บ');
      }
    } finally {
      setIsInitializing(false);
    }
  }, [user?.id, createNewConversation]);

  const loadConversationMessages = useCallback(async (conversationId) => {
    try {
      console.log('Loading messages for conversation:', conversationId);
      const response = await fetch(`/api/conversations/${conversationId}/messages`);
      const result = await response.json();
      console.log('Messages loaded:', result);
      
      if (result.success && result.messages) {
        // Convert database format to UI format
        const messagesArray = Array.isArray(result.messages) ? result.messages : [];
        console.log('Messages array:', messagesArray);
        const formattedMessages = messagesArray.flatMap(msg => [
          { role: 'user', content: msg.message },
          { role: 'assistant', content: msg.response }
        ]);
        console.log('Formatted messages:', formattedMessages);
        setMessages(formattedMessages);
      } else {
        console.log('No messages found, setting empty array');
        setMessages([]);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
      setMessages([]);
    }
  }, []);

  // Load conversations on mount
  useEffect(() => {
    if (user?.id) {
      loadConversations();
    } else {
      setIsInitializing(false);
    }
  }, [user?.id, loadConversations]);

  // Load current conversation messages
  useEffect(() => {
    if (currentConversationId) {
      loadConversationMessages(currentConversationId);
    }
  }, [currentConversationId, loadConversationMessages]);

  const deleteConversation = async (conversationId) => {
    if (!confirm('ต้องการลบบทสนทนานี้หรือไม่?')) return;

    try {
      console.log('Deleting conversation:', conversationId);
      
      const response = await fetch(`/api/conversations/${conversationId}?userId=${user.id}`, {
        method: 'DELETE'
      });

      const result = await response.json();
      console.log('Delete result:', result);
      
      if (result.success) {
        // Update conversations list immediately
        const remainingConversations = conversations.filter(c => getConvId(c) !== conversationId);
        setConversations(remainingConversations);
        
        // Switch to another conversation or create new one
        if (currentConversationId === conversationId) {
          if (remainingConversations.length > 0) {
            setCurrentConversationId(getConvId(remainingConversations[0]));
          } else {
            await createNewConversation();
          }
        }
        console.log('Conversation deleted successfully');
      } else {
        console.error('Failed to delete:', result);
        alert('ไม่สามารถลบการสนทนาได้: ' + (result.error || 'ข้อผิดพลาดไม่ทราบสาเหตุ'));
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      alert('เกิดข้อผิดพลาด: ' + error.message);
    }
  };

  const renameConversation = async (conversationId, newTitle) => {
    try {
      console.log('Renaming conversation:', conversationId, 'to:', newTitle);
      const response = await fetch(`/api/conversations/${conversationId}/title`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, title: newTitle })
      });

      const result = await response.json();
      console.log('Rename result:', result);
      
      if (result.success) {
        setConversations(prev => prev.map(c => 
          (c._id || c.id) === conversationId ? { ...c, title: newTitle } : c
        ));
        setEditingConvId(null);
        setEditingTitle('');
      } else {
        console.error('Rename failed:', result);
        alert('ไม่สามารถเปลี่ยนชื่อได้: ' + (result.error || 'ข้อผิดพลาด'));
      }
    } catch (error) {
      console.error('Failed to rename conversation:', error);
      alert('เกิดข้อผิดพลาด: ' + error.message);
    }
  };

  const loadChatHistory = async () => {
    try {
      const response = await fetch(`/api/chat/history/${user.id}?limit=50`);
      const result = await response.json();
      
      if (result.success && result.history) {
        // Convert MongoDB history to message format
        const formattedMessages = result.history.flatMap(record => [
          { role: 'user', content: record.userMessage || record.message },
          { role: 'assistant', content: record.botResponse || record.response }
        ]);
        setMessages(formattedMessages);
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  };

  const SUGGESTIONS = [
    'ต้องชำระเบี้ยกรมธรรม์กี่บาท',
    'ระยะเวลาคุ้มครองกี่ปี',
    'ถ้าเสียชีวิตได้เงินสูงสุดกี่บาท',
    'เงื่อนไขกรมธรรม์และผลประโยชน์',
    'ถ้ากรมธรรม์ครบสัญญาจะได้เงินคืนทั้งหมดกี่บาท',
  ];

  const handleSend = async (overrideMessage) => {
    const userMessage = (overrideMessage ?? input).trim();
    if (!userMessage || loading) return;
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
          userId: user?.id,
          conversationId: currentConversationId
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

  // Check if user is logged in (must be after all hooks)
  if (!user || !user.id) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-gray-600 mb-4">กรุณาเข้าสู่ระบบก่อนใช้งาน</p>
          <button
            onClick={() => window.location.href = '/login'}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            เข้าสู่ระบบ
          </button>
        </div>
      </div>
    );
  }

  // Show loading screen during initialization
  if (isInitializing) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">กำลังโหลดการสนทนา...</p>
        </div>
      </div>
    );
  }

  // Show error screen if initialization failed
  if (error && !currentConversationId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center max-w-md p-6 bg-red-50 rounded-lg">
          <p className="text-red-600 mb-4">❌ {error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            รีเฟรชหน้าเว็บ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen max-w-7xl mx-auto gap-4 p-4">
      {/* Sidebar - Conversation List */}
      <div className={`${showConversationList ? 'w-64' : 'w-12'} transition-all duration-300 bg-white rounded-lg border flex flex-col`}>
        <button
          onClick={() => setShowConversationList(!showConversationList)}
          className="p-3 hover:bg-gray-100 border-b"
        >
          {showConversationList ? '◀' : '☰'}
        </button>

        {showConversationList && (
          <>
            <button
              onClick={createNewConversation}
              className="m-2 p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
            >
              ➕ สนทนาใหม่
            </button>

            <div className="flex-1 overflow-y-auto">
              {conversations.map(conv => {
                const convId = conv._id || conv.id;
                return (
                <div
                  key={convId}
                  className={`p-3 border-b cursor-pointer hover:bg-gray-50 ${
                    currentConversationId === convId ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => setCurrentConversationId(convId)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      {editingConvId === convId ? (
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              renameConversation(convId, editingTitle);
                            }
                          }}
                          onBlur={() => {
                            if (editingTitle.trim()) {
                              renameConversation(convId, editingTitle);
                            } else {
                              setEditingConvId(null);
                            }
                          }}
                          className="text-sm font-medium w-full px-1 py-0.5 border rounded"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <div className="text-sm font-medium truncate">{conv.title}</div>
                      )}
                      <div className="text-xs text-gray-500">
                        {new Date(conv.createdAt).toLocaleDateString('th-TH')}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingConvId(convId);
                          setEditingTitle(conv.title);
                        }}
                        className="text-blue-500 hover:text-blue-700 text-xs"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteConversation(convId);
                        }}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              );
              })}
            </div>
          </>
        )}
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white rounded-lg border">
        <div className="flex justify-between items-center p-4 border-b">
          <h1 className="text-xl font-bold">
             {conversations.find(c => c._id === currentConversationId)?.title || 'AI Chat'}
          </h1>
          {lastContext && (
            <div className="text-sm text-gray-500">
               {lastContext.userContextCount > 0 
                ? `${lastContext.userContextCount} เอกสารของคุณ` 
                : `${lastContext.systemContextCount} เอกสารระบบ`}
            </div>
          )}
        </div>
        
        <div ref={chatContainerRef} className="flex-1 p-4 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="text-gray-500 text-center mt-8">
              <p className="mb-2">ถามคำถามเกี่ยวกับประกันภัย...</p>
              {user && <p className="text-sm">💡 ระบบจะค้นหาจากเอกสารที่คุณอัปโหลดก่อน</p>}
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => (
                <div key={idx} className={`mb-4 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                  <div
                    className={`inline-block p-3 rounded-lg max-w-xl whitespace-pre-line ${
                      msg.role === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-800'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="text-center text-gray-500 mb-4 animate-pulse">
                  🔍 กำลังค้นหาข้อมูลและประมวลผล...
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        <div className="p-4 border-t">
          {/* Suggestion chips */}
          <div className="flex flex-wrap gap-2 mb-3">
            {SUGGESTIONS.map((text) => (
              <button
                key={text}
                onClick={() => handleSend(text)}
                disabled={loading}
                className="px-3 py-1.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 text-sm hover:bg-blue-100 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {text}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="พิมพ์คำถามของคุณ..."
              className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300"
            >
              {loading ? '⏳' : '📤'} ส่ง
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
