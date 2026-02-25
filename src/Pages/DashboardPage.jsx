// src/Pages/DashboardPage.jsx
import React, { useState, useEffect } from 'react';
import searchIcon from '../search.png';
import Card from '../components/ui/Card';
import ChatHeader from '../components/ChatHeader';

/* =========================
   CALCULATION FUNCTIONS
========================= */

export const calculateTotalCoverage = (policies = []) =>
  policies.reduce((sum, p) => sum + (p.coverage || 0), 0);

export const calculateTotalPremium = (policies = []) =>
  policies.reduce((sum, p) => sum + (p.premium || 0), 0);

export const calculateCoverageGrowth = (current, lastYear) => {
  if (!current || !lastYear) return 0;
  return Math.round(((current - lastYear) / lastYear) * 100);
};

/* =========================
   HELPERS
========================= */

const getCurrentUser = () => {
  try {
    // Match the key used in LoginPage: 'user' not 'currentUser'
    const userData = localStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
  } catch {
    return null;
  }
};

const extractPolicyNumber = (content = '') => {
  // Try multiple patterns for policy number
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

const extractCompany = (content = '') => {
  const companies = [
    'AIA', 'FWD', 'แอกซ่า', 'เอไอเอ', 'อลิอันซ์', 'มิวนิค',
    'กรุงเทพประกันชีวิต', 'เมืองไทยประกันชีวิต', 'ไทยประกันชีวิต'
  ];
  return companies.find(c => content.includes(c)) || 'ไม่ระบุ';
};

const extractCoverage = (content = '') => {
  // Try to find coverage amount in various formats
  const patterns = [
    /ทุนประกัน\s*[:：]?\s*(\d{1,3}(?:,\d{3})*)\s*บาท/,
    /จำนวนเงินเอาประกัน\s*[:：]?\s*(\d{1,3}(?:,\d{3})*)\s*บาท/,
    /ความคุ้มครอง\s*[:：]?\s*(\d{1,3}(?:,\d{3})*)\s*บาท/,
    /(\d{1,3}(?:,\d{3})*)\s*บาท/  // Fallback: any number with บาท
  ];
  
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      const amount = parseInt(match[1].replace(/,/g, ''));
      if (amount > 10000) return amount; // Only consider amounts > 10,000 as coverage
    }
  }
  return 0;
};

const extractPremium = (content = '') => {
  // Try to find premium amount in various formats
  const patterns = [
    /เบี้ยประกันรายปี\s*[:：]?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*บาท/,
    /เบี้ยประกันรวม\s*[:：]?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*บาท/,
    /เบี้ยประกัน\s*[:：]?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*บาท/,
    /Premium\s*[:：]?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*บาท/
  ];
  
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      return parseFloat(match[1].replace(/,/g, '')) || 0;
    }
  }
  return 0;
};

const statusBadge = status => {
  const styles = {
    Active: 'bg-green-100 text-green-700',
    Pending: 'bg-yellow-100 text-yellow-700',
    Expired: 'bg-red-100 text-red-700'
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-200 text-gray-700'}`}>
      {status}
    </span>
  );
};

/* =========================
   COMPONENT
========================= */

export default function DashboardPage() {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [lastYearCoverage] = useState(3100000);

  /* FIX: define missing variables */
  const totalCoverage = calculateTotalCoverage(policies);
  const totalPremium = calculateTotalPremium(policies);
  const coverageGrowth = calculateCoverageGrowth(
    totalCoverage,
    lastYearCoverage
  );

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const currentUser = getCurrentUser();
      
      console.log('👤 Current user:', currentUser);
      console.log('🔑 User ID:', currentUser?.id);

      const { default: mongoService } = await import('../services/mongoService');

      const documents =
        (await mongoService?.getAllDocumentsForDashboard?.(
          currentUser?.id,
          20
        )) || [];

      console.log('📄 Fetched documents:', documents.length);
      console.log('📄 Raw documents:', documents);

      // Transform documents and extract info
      const extracted = documents.map((doc, index) => {
        const content = doc?.content || '';
        const policyNo = extractPolicyNumber(content);
        
        return {
          id: doc?._id || String(index),
          policyNumber: policyNo || `AUTO-${index + 1}`,
          title: doc?.title || 'Untitled',
          provider: extractCompany(content),
          type: doc?.metadata?.type || 'ประกันชีวิต',
          coverage: extractCoverage(content),
          premium: extractPremium(content),
          status: 'Active',
          content: content.substring(0, 200) + '...',
          uploadedAt: doc?.metadata?.createdAt || new Date()
        };
      });

      // Group by policy number to combine multiple pages
      const policyMap = new Map();
      extracted.forEach(item => {
        const key = item.policyNumber;
        if (policyMap.has(key)) {
          const existing = policyMap.get(key);
          // Merge: take max coverage and sum premiums
          existing.coverage = Math.max(existing.coverage, item.coverage);
          existing.premium += item.premium;
        } else {
          policyMap.set(key, { ...item });
        }
      });

      const transformed = Array.from(policyMap.values());
      console.log('📊 Processed policies:', transformed);

      setPolicies(transformed);
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

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-xl mx-auto">
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="ค้นหากรมธรรม์..."
            className="w-full pl-12 pr-4 py-2 rounded-full border border-slate-200"
          />
          <img
            src={searchIcon}
            alt="search"
            className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 opacity-60"
          />
        </div>
      </div>

      {/* Summary */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <Card className="p-6 border-2 border-blue-200">
          <div className="text-sm text-slate-500">ความคุ้มครองรวม</div>
          <div className="text-2xl font-bold text-blue-700">
            ฿{(totalCoverage || 0).toLocaleString()}
          </div>
          <div className="text-green-600 text-xs">
            +{coverageGrowth}% จากปีที่แล้ว
          </div>
        </Card>

        <Card className="p-6">
          <div className="text-sm text-slate-500">เบี้ยประกันรายปี</div>
          <div className="text-2xl font-bold text-blue-700">
            ฿{(totalPremium || 0).toLocaleString()}
          </div>
        </Card>

        <Card className="p-6">
          <div className="text-sm text-slate-500">จำนวนกรมธรรม์</div>
          <div className="text-2xl font-bold text-blue-700">
            {policies.length}
          </div>
        </Card>
      </div>

      {/* Policy List */}
      <Card className="p-6">
        <div className="font-bold text-lg mb-4">
          รายการกรมธรรม์ล่าสุด
        </div>

        {policies.length === 0 ? (
          <div className="text-gray-500 text-center py-6">
            ยังไม่มีข้อมูลกรมธรรม์
          </div>
        ) : (
          <ul className="divide-y">
            {policies.slice(0, 5).map(p => (
              <li key={p.id} className="py-4 flex justify-between">
                <div>
                  <div className="font-bold">
                    {p.provider} {p.type}
                  </div>
                  <div className="text-xs text-gray-400">
                    เลขที่: {p.policyNumber}
                  </div>
                  <div className="text-sm text-gray-600">
                    ทุนประกัน: ฿{(p.coverage || 0).toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600">
                    เบี้ย: ฿{(p.premium || 0).toLocaleString()}/ปี
                  </div>
                </div>
                {statusBadge(p.status)}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}