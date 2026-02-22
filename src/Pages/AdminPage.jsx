// src/Pages/AdminPage.jsx
import React, { useEffect, useState } from 'react';
import Card from '../components/ui/Card';
import ChatHeader from '../components/ChatHeader';
import backendService from '../services/backendService';

// ลบ mock data ใช้ state แทน

export default function AdminPage() {
  // state สำหรับข้อมูลจริง
  const [stats, setStats] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        // ดึง stat
        const statData = await backendService.fetchDashboardStats();
        // ดึง log
        const logData = await backendService.fetchAdminAnalytics();
        setStats(statData || []);
        setLogs(logData?.logs || []);
      } catch (err) {
        setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="px-6 py-8 w-full max-w-6xl mx-auto relative">
      <div className="absolute left-6 top-8 w-6 h-6 md:w-6 md:h-6 z-20 bg-slate-50"></div>
      <ChatHeader />
      <h2 className="text-2xl font-extrabold mt-6 mb-6">Admin Hallucination Log</h2>
      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {loading ? (
          <div className="col-span-4 text-center text-slate-400">Loading stats...</div>
        ) : error ? (
          <div className="col-span-4 text-center text-red-500">{error}</div>
        ) : stats.length === 0 ? (
          <div className="col-span-4 text-center text-slate-400">No stats found</div>
        ) : (
          stats.map((stat, idx) => (
            <div
              key={stat.label || idx}
              className={`rounded-2xl bg-white shadow-sm p-6 flex flex-col items-center border ${stat.highlight ? 'border-red-200' : stat.highlightBlue ? 'border-blue-200' : 'border-slate-100'}`}
            >
              <span className="text-xs font-semibold text-slate-400 mb-2 tracking-wide">{stat.label}</span>
              <span className={`text-2xl font-extrabold ${stat.highlight ? 'text-red-500' : stat.highlightBlue ? 'text-blue-600' : 'text-slate-800'}`}>{stat.value}</span>
            </div>
          ))
        )}
      </div>
      {/* Recent Logs */}
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-100">
        <div className="text-lg font-bold mb-4">Recent AI Verification Logs</div>
        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="text-center text-slate-400">Loading logs...</div>
          ) : error ? (
            <div className="text-center text-red-500">{error}</div>
          ) : logs.length === 0 ? (
            <div className="text-center text-slate-400">No logs found</div>
          ) : (
            logs.map((log, idx) => (
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
            ))
          )}
        </div>
      </div>
    </div>
  );
}
