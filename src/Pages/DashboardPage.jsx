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
    const userData = localStorage.getItem('currentUser');
    return userData ? JSON.parse(userData) : null;
  } catch {
    return null;
  }
};

const extractCompany = (content = '') => {
  const companies = ['AIA', 'FWD', 'แอกซ่า', 'เอไอเอ', 'อลิอันซ์', 'มิวนิค'];
  return companies.find(c => content.includes(c)) || 'Unknown';
};

const extractCoverage = (content = '') => {
  const match = content.match(/(\d{1,3}(?:,\d{3})*)\s*บาท/);
  if (match) return parseInt(match[1].replace(/,/g, '')) || 0;
  return 0;
};

const extractPremium = (content = '') => {
  const match = content.match(/เบี้ยประกัน\s*(\d{1,3}(?:,\d{3})*)/);
  if (match) return parseInt(match[1].replace(/,/g, '')) || 0;
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

      const { default: mongoService } = await import('../services/mongoService');

      const documents =
        (await mongoService?.getAllDocumentsForDashboard?.(
          currentUser?.id,
          20
        )) || [];

      const transformed = documents.map((doc, index) => ({
        id: doc?._id || String(index),
        title:
          doc?.content?.substring(0, 100) + '...' ||
          doc?.title ||
          'Untitled',
        provider: extractCompany(doc?.content || ''),
        type: doc?.metadata?.type || 'ประกันชีวิต',
        coverage: extractCoverage(doc?.content || ''),
        premium: extractPremium(doc?.content || ''),
        status: 'Active'
      }));

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
                  <div className="text-sm text-gray-500">
                    ฿{(p.coverage || 0).toLocaleString()}
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