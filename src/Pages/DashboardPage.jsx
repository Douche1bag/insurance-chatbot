// src/Pages/DashboardPage.jsx
import React from 'react';
import searchIcon from '../search.png';
import Card from '../components/ui/Card';
import { MOCK_POLICIES } from '../utils/mock/policies';
import { APP_NAME } from '../utils/constants';
import ChatHeader from '../components/ChatHeader';

// Helper for status badge
const statusBadge = status => {
  let color = 'bg-gray-200 text-gray-700';
  if (status === 'Active') color = 'bg-green-100 text-green-700';
  if (status === 'Pending') color = 'bg-yellow-100 text-yellow-700';
  if (status === 'Expired') color = 'bg-red-100 text-red-700';
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{status}</span>;
};

// Mock donut chart (static SVG)
function CoverageDonut() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120">
      <circle cx="60" cy="60" r="54" fill="#f1f5f9" />
      <path d="M60 6 a54 54 0 0 1 46.8 81.6" stroke="#2563eb" strokeWidth="12" fill="none" />
      <path d="M106.8 87.6 a54 54 0 0 1-93.6 0" stroke="#10b981" strokeWidth="12" fill="none" />
      <path d="M13.2 87.6 a54 54 0 0 1 46.8-81.6" stroke="#f59e42" strokeWidth="12" fill="none" />
      <text x="60" y="68" textAnchor="middle" fontSize="28" fontWeight="bold" fill="#222">100%</text>
      <text x="60" y="88" textAnchor="middle" fontSize="12" fill="#64748b">Total Coverage</text>
    </svg>
  );
}

export default function DashboardPage() {
  const totalCoverage = MOCK_POLICIES.reduce((sum, p) => sum + p.coverage, 0);
  const totalPremium = MOCK_POLICIES.reduce((sum, p) => sum + p.premium, 0);
  const lastYearCoverage = 3100000; // mock for growth
  const coverageGrowth = totalCoverage && lastYearCoverage ? Math.round(((totalCoverage - lastYearCoverage) / lastYearCoverage) * 100) : 0;
  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen relative">
        {/* Overlay to cover document icon if still present */}
        <div className="absolute left-0 top-0 w-12 h-12 md:w-16 md:h-16 z-20" style={{backgroundColor: 'inherit'}}></div>
      <ChatHeader />
      {/* Search Box */}
      <div className="flex justify-between items-center mb-6">
        <form className="w-full max-w-xl mx-auto">
          <div className="relative">
            <input
              type="text"
              placeholder="ค้นหาข้อมูลในกรมธรรม์ทั้งหมด..."
              className="w-full pl-12 pr-4 py-2 rounded-full border border-slate-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200 text-slate-700 placeholder:text-slate-400"
            />
            <img src={searchIcon} alt="search" className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 opacity-60" />
          </div>
        </form>
        {/* ปุ่มเพิ่มกรมธรรม์ */}
        <button className="ml-4 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-semibold shadow flex items-center gap-2"> {/* สร้างสี่เหลี่ยนวางทับ icon เอกสาร*/}
          <span className="text-lg">+</span> เพิ่มกรมธรรม์
        </button>
      </div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mt-0 mb-6 gap-2">
        <div>
          <h2 className="text-2xl font-bold mb-1">ภาพรวมความคุ้มครอง</h2>
          <div className="text-slate-500 text-sm">ยินดีต้อนรับกลับมา, ข้อมูลสรุป ณ วันที่ {new Date().toLocaleDateString('th-TH')}</div>
        </div>
      </div>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-6 flex flex-col justify-between border-blue-200 border-2">
          <div className="text-slate-500 text-sm mb-1">ความคุ้มครองรวม</div>
          <div className="text-2xl font-bold text-blue-700 mb-1">฿{totalCoverage.toLocaleString()}</div>
          <div className="flex items-center gap-2 text-green-600 text-xs">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2" fill="none"/></svg>
            +{coverageGrowth}% จากปีที่แล้ว
          </div>
        </Card>
        <Card className="p-6 flex flex-col justify-between">
          <div className="text-slate-500 text-sm mb-1">เบี้ยประกันรายปี</div>
          <div className="text-2xl font-bold text-blue-700 mb-1">฿{totalPremium.toLocaleString()}</div>
          <div className="text-xs text-slate-400">จ่ายแล้ว ฿32,000</div>
        </Card>
        <Card className="p-6 flex flex-col justify-between">
          <div className="text-slate-500 text-sm mb-1">สถานะ AI วิเคราะห์</div>
          <div className="text-lg font-semibold text-orange-600 mb-1">"มีช่องว่าง"</div>
          <div className="text-xs text-orange-500">แนะนำเพิ่มประกันโรคร้ายแรง</div>
        </Card>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Latest Policies List */}
        <Card className="p-8 flex-1">
          <div className="flex items-center gap-2 mb-6">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path d="M4 4h16v16H4z" fill="#2563eb"/><path d="M8 8h8v8H8z" fill="#fff"/></svg>
            <span className="font-bold text-lg">รายการกรมธรรม์ล่าสุด</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {MOCK_POLICIES.map((p, idx) => (
              <li key={p.id} className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <span className="bg-blue-100 rounded-full p-3">
                    <svg width="28" height="28" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#2563eb"/><path d="M12 7C10.3431 7 9 8.34315 9 10V12C9 13.6569 10.3431 15 12 15C13.6569 15 15 13.6569 15 12V10C15 8.34315 13.6569 7 12 7Z" fill="#fff"/></svg>
                  </span>
                  <div>
                    <div className="font-bold text-slate-800 text-lg">{p.provider} <span className="text-base text-slate-400 ml-1">{p.type}</span></div>
                    <div className="text-base text-slate-400">฿{p.coverage.toLocaleString()}</div>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  {statusBadge(p.status)}
                </div>
              </li>
            ))}
          </ul>
        </Card>
        {/* Donut Chart */}
        <Card className="p-8 flex flex-col items-center justify-center">
          <div className="flex items-center gap-2 mb-6">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path d="M12 2a10 10 0 100 20 10 10 0 000-20z" fill="#2563eb"/></svg>
            <span className="font-bold text-lg">สัดส่วนความคุ้มครอง</span>
          </div>
          <CoverageDonut />
          <div className="flex gap-6 mt-6 text-base">
            <span className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-blue-600 inline-block"></span>ชีวิต</span>
            <span className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-green-500 inline-block"></span>สุขภาพ</span>
            <span className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-orange-400 inline-block"></span>โรคร้าย</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
