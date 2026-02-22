// src/Pages/ComparisonPage.jsx
import React from 'react';
import Card from '../components/ui/Card';
import ChatHeader from '../components/ChatHeader';

// Mock data for comparison (customized for demo)
const policies = [
  { name: 'AIA Premium', color: 'text-blue-700', data: { life: 2000000, ipd: null, room: null, critical: null } },
  { name: 'FWD Care', color: 'text-green-700', data: { life: null, ipd: 500000, room: 4000, critical: null } },
];
const coverageRows = [
  { label: 'ค่ายอดการเสียชีวิต', key: 'life', gap: { value: 0, label: '฿0' } },
  { label: 'ค่ารักษาพยาบาล (IPD)', key: 'ipd', gap: { value: 0, label: 'เหมาะสม' } },
  { label: 'ค่าห้องต่อวัน', key: 'room', gap: { value: 1000, label: '฿1,000 (Shortage)', warning: true } },
  { label: 'โรคร้ายแรง (Critical)', key: 'critical', gap: { value: null, label: 'แนะนำให้ซื้อเพิ่ม', warning: true } },
];

export default function ComparisonPage() {
  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen relative">
      {/* Overlay to cover document icon if still present */}
      <div className="absolute left-0 top-0 w-12 h-12 md:w-16 md:h-16 z-20" style={{backgroundColor: 'inherit'}}></div>
        {/* Overlay to cover document icon if still present */}
        <div className="absolute left-0 top-0 w-12 h-12 md:w-16 md:h-16 z-20" style={{backgroundColor: 'inherit'}}></div>
      <ChatHeader />
      <h2 className="text-2xl font-bold mt-4 mb-4">เปรียบเทียบกรมธรรม์</h2>
      {/* Gap Alert */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-yellow-600 bg-yellow-50 rounded-full px-3 py-1 text-sm font-medium flex items-center gap-1">
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#fde68a"/><path d="M12 8v4" stroke="#f59e42" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="16" r="1" fill="#f59e42"/></svg>
          พบ Gap ความคุ้มครอง
        </span>
      </div>
      {/* Comparison Table */}
      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-base min-w-[700px]">
          <thead>
            <tr className="bg-slate-50">
              <th className="py-4 px-6 text-left font-bold text-slate-600 text-lg w-1/3">หัวข้อความคุ้มครอง</th>
              {policies.map((p, i) => (
                <th key={i} className={`py-4 px-6 text-center font-bold text-lg ${p.color}`}>{p.name}</th>
              ))}
              <th className="py-4 px-6 text-center font-bold text-lg text-yellow-700">Target Gap</th>
            </tr>
          </thead>
          <tbody>
            {coverageRows.map((row, i) => (
              <tr key={row.key} className="border-t last:rounded-b-xl last:overflow-hidden">
                <td className="py-4 px-6 font-semibold text-slate-700 text-base">{row.label}</td>
                {policies.map((p, j) => (
                  <td key={j} className="py-4 px-6 text-center text-base">
                    {p.data[row.key] !== null && p.data[row.key] !== undefined ?
                      <span className="font-bold text-slate-800 text-lg">฿{p.data[row.key].toLocaleString()}</span> :
                      <span className="text-slate-300 text-lg">-</span>
                    }
                  </td>
                ))}
                <td className={`py-4 px-6 text-center text-base ${row.gap.warning ? 'bg-yellow-50 text-yellow-700 font-bold' : 'text-slate-500'}`}>{row.gap.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {/* Recommendation & Add Policy */}
      <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl bg-white shadow-sm p-6 min-h-[120px] mt-6">
        <button className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold px-6 py-3 rounded-lg border border-blue-200 flex items-center gap-2 transition">
          <span className="text-xl">+</span> เพิ่มกรมธรรม์อื่นเพื่อเปรียบเทียบ
        </button>
      </div>
    </div>
  );
}
