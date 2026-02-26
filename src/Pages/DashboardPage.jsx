// src/Pages/DashboardPage.jsx
import React, { useState, useEffect } from 'react';
import Card from '../components/ui/Card';
import ChatHeader from '../components/ChatHeader';

/* =========================
   HELPERS
========================= */

const getCurrentUser = () => {
  try {
    const userData = localStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
  } catch {
    return null;
  }
};

const extractPolicyNumber = (content = '') => {
  const patterns = [
    /เลขที่กรมธรรม์\s*[:：]?\s*([A-Z0-9\-]+)/i,
    /กรมธรรม์เลขที่\s*[:：]?\s*([A-Z0-9\-]+)/i,
    /Policy\s*No\.?\s*[:：]?\s*([A-Z0-9\-]+)/i,
    /เลขกรมธรรม์\s*[:：]?\s*([A-Z0-9\-]+)/i
  ];
  
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
};

/* =========================
   COMPONENT
========================= */

export default function DashboardPage() {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState('');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const currentUser = getCurrentUser();
      
      console.log('👤 Current user:', currentUser);
      console.log('🔑 User ID:', currentUser?.id);

      if (!currentUser || !currentUser.id) {
        console.error('❌ No user logged in or missing user ID');
        setDebugInfo(`❌ ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่`);
        setPolicies([]);
        setLoading(false);
        return;
      }

      setDebugInfo(`User ID: ${currentUser.id}`);

      // Fetch user documents from backend API
      console.log('🔍 Fetching documents from API...');
      const response = await fetch(`http://localhost:3001/api/documents/user/${currentUser.id}?limit=20`);
      const result = await response.json();

      console.log('📡 API Response:', result);

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch documents');
      }

      const documents = result.data || [];
      console.log('📄 Fetched documents:', documents.length);
      console.log('📄 Raw documents:', documents);

      setDebugInfo(`User ID: ${currentUser.id} | Documents: ${documents.length}`);

      // Extract policy numbers only
      const policyNumbers = documents
        .map(doc => {
          const content = doc?.content || '';
          const policyNo = extractPolicyNumber(content);
          return policyNo ? {
            id: doc?._id || Math.random().toString(),
            policyNumber: policyNo,
            title: doc?.title || 'เอกสารประกันภัย'
          } : null;
        })
        .filter(Boolean);

      // Remove duplicates
      const uniquePolicies = Array.from(
        new Map(policyNumbers.map(p => [p.policyNumber, p])).values()
      );

      console.log('📋 Policy numbers found:', uniquePolicies);
      setPolicies(uniquePolicies);
    } catch (error) {
      console.error('Dashboard load error:', error);
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        กำลังโหลดข้อมูล...
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      <ChatHeader />

      {/* Debug Info */}
      {debugInfo && (
        <div className="max-w-4xl mx-auto mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
          🔍 Debug: {debugInfo}
        </div>
      )}

      {/* Policy Numbers Card */}
      <Card className="p-6 max-w-4xl mx-auto mt-8">
        <div className="font-bold text-xl mb-6 text-blue-700">
          เลขกรมธรรม์ของฉัน
        </div>

        {policies.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            ยังไม่มีข้อมูลกรมธรรม์
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {policies.map(p => (
              <div 
                key={p.id} 
                className="p-4 bg-blue-50 rounded-lg border border-blue-200"
              >
                <div className="text-sm text-gray-600 mb-1">
                  {p.title}
                </div>
                <div className="text-2xl font-bold text-blue-700">
                  {p.policyNumber}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}