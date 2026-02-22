// src/Pages/AdminPage.jsx
import React from 'react';
import Card from '../components/ui/Card';
import ChatHeader from '../components/ChatHeader';

const MOCK_STATS = [
  { label: 'TOTAL QUERIES', value: '12,402' },
  { label: 'TOKEN USAGE', value: '1.2M' },
  { label: 'REPORTED ERRORS', value: '2', highlight: true },
  { label: 'USER ACTIVE', value: '842', highlightBlue: true },
];

const MOCK_LOGS = [
  {
    time: '2 mins ago',
    user: 'User #429',
    query: '"ค่าห้อง FWD คือเท่าไหร่"',
    confidence: 0.99,
    status: 'Verified',
    statusColor: 'green',
  },
  {
    time: '15 mins ago',
    user: 'User #102',
    query: '"ถ้าเบี้ยซอมนี้คุ้มครองไหม"',
    confidence: 0.42,
    status: 'Manual Review',
    statusColor: 'yellow',
  },
  {
    time: '1 hr ago',
    user: 'User #882',
    query: '"ประกันชีวิต AIA หมดอายุวันไหน"',
    confidence: 0.97,
    status: 'Verified',
    statusColor: 'green',
  },
];

export default function AdminPage() {
  return (
    <div className="px-6 py-8 w-full max-w-6xl mx-auto relative">
        {/* Overlay to cover document icon if still present */}
        <div className="absolute left-6 top-8 w-6 h-6 md:w-6 md:h-6 z-20 bg-slate-50"></div>
      <ChatHeader />
      <h2 className="text-2xl font-extrabold mt-6 mb-6">Admin Hallucination Log</h2>
      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {MOCK_STATS.map((stat, idx) => (
          <div
            key={stat.label}
            className={`rounded-2xl bg-white shadow-sm p-6 flex flex-col items-center border ${stat.highlight ? 'border-red-200' : stat.highlightBlue ? 'border-blue-200' : 'border-slate-100'}`}
          >
            <span className="text-xs font-semibold text-slate-400 mb-2 tracking-wide">{stat.label}</span>
            <span className={`text-2xl font-extrabold ${stat.highlight ? 'text-red-500' : stat.highlightBlue ? 'text-blue-600' : 'text-slate-800'}`}>{stat.value}</span>
          </div>
        ))}
      </div>
      {/* Recent Logs */}
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-100">
        <div className="text-lg font-bold mb-4">Recent AI Verification Logs</div>
        <div className="divide-y divide-slate-100">
          {MOCK_LOGS.map((log, idx) => (
            <div key={idx} className="flex flex-col md:flex-row md:items-center justify-between py-4 gap-2">
              <div className="flex flex-col md:flex-row md:items-center gap-4 flex-1">
                <span className="text-slate-400 text-sm min-w-[80px]">{log.time}</span>
                <span className="font-semibold text-blue-700 min-w-[90px]">{log.user}</span>
                <span className="text-slate-700 text-base">{log.query}</span>
              </div>
              <div className="flex items-center gap-3 mt-2 md:mt-0">
                <span className="text-slate-500 text-sm">Confidence: <span className="font-bold text-slate-700">{log.confidence}</span></span>
                {log.status === 'Verified' ? (
                  <span className="bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full">Verified</span>
                ) : (
                  <span className="bg-yellow-100 text-yellow-700 text-xs font-semibold px-3 py-1 rounded-full">Manual Review</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
