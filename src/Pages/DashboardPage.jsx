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
  const [allUsersStats, setAllUsersStats] = useState(null); // NEW: show all users stats

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const currentUser = getCurrentUser();

      console.log('👤 Current user:', currentUser);

      if (!currentUser || !currentUser.id) {
        setDebugInfo(`❌ ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่`);
        setPolicies([]);
        setLoading(false);
        return;
      }

      setDebugInfo(`User ID: ${currentUser.id}`);

      // ✅ FIX 1: Use relative URL instead of hardcoded localhost
      // This works for both local AND ngrok public URL
      const response = await fetch(`/api/documents/user/${currentUser.id}?limit=20`);
      const result = await response.json();

      console.log('📡 API Response:', result);

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch documents');
      }

      const documents = result.data || [];
      console.log('📄 Fetched documents:', documents.length);

      setDebugInfo(`User ID: ${currentUser.id} | Documents: ${documents.length}`);

      // ✅ FIX 2: Also fetch ALL users' documents for dashboard overview
      try {
        const allDocsResponse = await fetch(`/api/dashboard/all-documents`);
        const allDocsResult = await allDocsResponse.json();
        if (allDocsResult.success) {
          setAllUsersStats(allDocsResult.data);
        }
      } catch (err) {
        console.log('Could not fetch all documents stats:', err.message);
      }

      // Group documents by policy number
      const grouped = {};
      documents.forEach(doc => {
        const content = doc?.content || '';
        const policyNo = extractPolicyNumber(content) || 'ไม่ระบุเลขกรมธรรม์';
        if (!grouped[policyNo]) grouped[policyNo] = [];
        grouped[policyNo].push({
          id: doc?._id || Math.random().toString(),
          title: doc?.title || 'เอกสาร',
          contentLength: doc?.content?.length || 0,
          hasEmbedding: doc?.hasEmbedding || false,
          uploadedAt: doc?.metadata?.uploadedAt || doc?.metadata?.createdAt,
        });
      });

      // Convert to array sorted: named policies first, unnamed last
      const sorted = Object.entries(grouped).sort(([a], [b]) => {
        if (a === 'ไม่ระบุเลขกรมธรรม์') return 1;
        if (b === 'ไม่ระบุเลขกรมธรรม์') return -1;
        return a.localeCompare(b);
      });

      setPolicies(sorted);
    } catch (error) {
      console.error('❌ Dashboard error:', error);
      setDebugInfo(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-[60vh] bg-slate-50">
      <ChatHeader />
      <div className="w-full max-w-4xl mx-auto mt-6 px-4">
        <h2 className="text-xl font-bold mb-1">Dashboard</h2>

        {/* Debug Info */}
        {debugInfo && (
          <div className="text-xs text-slate-400 mb-4 bg-slate-100 rounded px-3 py-1">
            🔍 {debugInfo}
          </div>
        )}

        {/* ✅ NEW: All Users Stats Card */}
        {allUsersStats && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{allUsersStats.totalUsers}</div>
              <div className="text-sm text-slate-500">ผู้ใช้ทั้งหมด</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{allUsersStats.totalDocuments}</div>
              <div className="text-sm text-slate-500">เอกสารทั้งหมด</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{allUsersStats.totalSystemDocs}</div>
              <div className="text-sm text-slate-500">เอกสารระบบ</div>
            </div>
          </div>
        )}

        {/* My Documents — grouped by policy number */}
        <div className="mb-4">
          <h3 className="font-semibold text-slate-700 mb-3">
            📂 กรมธรรม์ของฉัน ({policies.reduce((sum, [, files]) => sum + files.length, 0)} ไฟล์ · {policies.length} กรมธรรม์)
          </h3>

          {loading ? (
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-slate-400 text-sm">⏳ กำลังโหลด...</div>
          ) : policies.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-slate-400 text-sm">
              ❌ ยังไม่มีเอกสาร — ไปที่หน้า Upload เพื่ออัปโหลดกรมธรรม์
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {policies.map(([policyNumber, files]) => (
                <div key={policyNumber} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  {/* Policy Number Header */}
                  <div className={`px-4 py-3 flex items-center justify-between
                    ${policyNumber === 'ไม่ระบุเลขกรมธรรม์'
                      ? 'bg-slate-100 border-b border-slate-200'
                      : 'bg-blue-50 border-b border-blue-100'}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-blue-600 font-bold text-base">📋</span>
                      <div>
                        <div className="text-xs text-slate-500">กรมธรรม์เลขที่</div>
                        <div className={`font-bold text-sm
                          ${policyNumber === 'ไม่ระบุเลขกรมธรรม์' ? 'text-slate-400 italic' : 'text-blue-700'}`}>
                          {policyNumber}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs bg-white text-slate-500 border border-slate-200 rounded-full px-2 py-0.5">
                      {files.length} ไฟล์
                    </span>
                  </div>

                  {/* Files under this policy */}
                  <ul className="divide-y divide-slate-100">
                    {files.map((file, idx) => (
                      <li key={file.id} className="px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-slate-300 text-xs w-5 text-right shrink-0">{idx + 1}.</span>
                          <div>
                            <div className="font-medium text-slate-700 text-sm">📄 {file.title}</div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              {file.contentLength.toLocaleString()} ตัวอักษร
                              {file.uploadedAt && ` · ${new Date(file.uploadedAt).toLocaleDateString('th-TH')}`}
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ✅ NEW: All Users Documents breakdown */}
        {allUsersStats?.userBreakdown && allUsersStats.userBreakdown.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-700 mb-3">
              👥 เอกสารของทุกคนในระบบ
            </h3>
            <ul className="divide-y divide-slate-100">
              {allUsersStats.userBreakdown.map((u, i) => (
                <li key={i} className="py-2 flex items-center justify-between text-sm">
                  <span className="text-slate-700">👤 {u.email || u.userId}</span>
                  <span className="text-blue-600 font-medium">{u.documentCount} เอกสาร</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}