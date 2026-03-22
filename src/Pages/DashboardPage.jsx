// src/Pages/DashboardPage.jsx
import { useState, useEffect } from 'react';
import ChatHeader from '../components/ChatHeader';
import { Pencil, Trash2, X, Check, ChevronDown, ChevronUp } from 'lucide-react';

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

/* =========================
   COMPONENT
========================= */

export default function DashboardPage() {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allUsersStats, setAllUsersStats] = useState(null);

  // Edit mode
  const [editMode, setEditMode] = useState(false);
  const [selected, setSelected] = useState(new Set()); // Set of doc IDs

  // Bulk rename modal
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [bulkPolicyName, setBulkPolicyName] = useState('');
  const [renaming, setRenaming] = useState(false);

  // Bulk delete confirm
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Collapsed policy groups
  const [collapsed, setCollapsed] = useState({});

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const currentUser = getCurrentUser();
      if (!currentUser?.id) {
        setPolicies([]);
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/documents/user/${currentUser.id}?limit=100`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to fetch documents');

      const documents = result.data || [];

      // Fetch all-users stats
      try {
        const allDocsResponse = await fetch(`/api/dashboard/all-documents`);
        const allDocsResult = await allDocsResponse.json();
        if (allDocsResult.success) setAllUsersStats(allDocsResult.data);
      } catch {}

      // Group by policyName
      const grouped = {};
      documents.forEach(doc => {
        const policyNo = doc?.metadata?.policyName || 'ไม่ระบุกรมธรรม์';
        if (!grouped[policyNo]) grouped[policyNo] = [];
        grouped[policyNo].push({
          id: doc?._id || Math.random().toString(),
          title: doc?.title || 'เอกสาร',
          contentLength: doc?.content?.length || 0,
          uploadedAt: doc?.metadata?.uploadedAt || doc?.metadata?.createdAt,
          policyName: policyNo,
        });
      });

      const sorted = Object.entries(grouped).sort(([a], [b]) => {
        if (a === 'ไม่ระบุกรมธรรม์') return 1;
        if (b === 'ไม่ระบุกรมธรรม์') return -1;
        return a.localeCompare(b);
      });

      setPolicies(sorted);
    } catch (error) {
      console.error('Dashboard error:', error);
    } finally {
      setLoading(false);
    }
  };

  /* ---------- Selection helpers ---------- */

  const allDocIds = policies.flatMap(([, files]) => files.map(f => f.id));

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === allDocIds.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allDocIds));
    }
  };

  const toggleSelectGroup = (files) => {
    const ids = files.map(f => f.id);
    const allSelected = ids.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      ids.forEach(id => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const exitEditMode = () => {
    setEditMode(false);
    setSelected(new Set());
  };

  /* ---------- Bulk delete ---------- */

  const handleBulkDelete = async () => {
    const currentUser = getCurrentUser();
    if (!currentUser?.id) return;

    try {
      setDeleting(true);
      const response = await fetch('/api/user/documents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, documentIds: [...selected] }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      setShowDeleteConfirm(false);
      exitEditMode();
      await loadDashboardData();
    } catch (error) {
      alert(`เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  /* ---------- Bulk rename ---------- */

  const handleBulkRename = async () => {
    const currentUser = getCurrentUser();
    if (!currentUser?.id) return;
    const newName = bulkPolicyName.trim() || 'ไม่ระบุกรมธรรม์';

    try {
      setRenaming(true);
      const response = await fetch('/api/user/documents/bulk-policy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, documentIds: [...selected], policyName: newName }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      setShowRenameModal(false);
      setBulkPolicyName('');
      exitEditMode();
      await loadDashboardData();
    } catch (error) {
      alert(`เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
      setRenaming(false);
    }
  };

  const totalFiles = policies.reduce((sum, [, files]) => sum + files.length, 0);

  return (
    <div className="flex flex-col min-h-[60vh] bg-slate-50">
      <ChatHeader />

      <div className="w-full max-w-4xl mx-auto mt-6 px-4 pb-10">
        <h2 className="text-xl font-bold mb-4">Dashboard</h2>

        {/* Stats */}
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

        {/* Section header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-700">
            📂 กรมธรรม์ของฉัน ({totalFiles} ไฟล์ · {policies.length} กรมธรรม์)
          </h3>
          {!loading && totalFiles > 0 && (
            editMode ? (
              <button
                onClick={exitEditMode}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 text-sm font-medium transition-colors"
              >
                <X size={14} />
                ยกเลิก
              </button>
            ) : (
              <button
                onClick={() => setEditMode(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium transition-colors shadow-sm"
              >
                <Pencil size={14} />
                แก้ไข
              </button>
            )
          )}
        </div>

        {/* Edit mode action bar */}
        {editMode && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-3 flex flex-wrap items-center gap-3">
            {/* Select all */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={selected.size === allDocIds.length && allDocIds.length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4 accent-blue-600 cursor-pointer"
              />
              <span className="text-sm text-slate-700 font-medium">
                {selected.size === allDocIds.length && allDocIds.length > 0
                  ? 'ยกเลิกทั้งหมด'
                  : `เลือกทั้งหมด (${allDocIds.length})`}
              </span>
            </label>

            <span className="text-slate-300 hidden sm:inline">|</span>

            <span className="text-sm text-blue-600 font-medium">
              เลือกแล้ว {selected.size} ไฟล์
            </span>

            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => { setBulkPolicyName(''); setShowRenameModal(true); }}
                disabled={selected.size === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-blue-300 text-blue-600 hover:bg-blue-100 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Pencil size={13} />
                เปลี่ยนชื่อกรมธรรม์
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={selected.size === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 size={13} />
                ลบที่เลือก
              </button>
            </div>
          </div>
        )}

        {/* Document list */}
        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-slate-400 text-sm">
            ⏳ กำลังโหลด...
          </div>
        ) : policies.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-slate-400 text-sm">
            ยังไม่มีเอกสาร — ไปที่หน้า Upload เพื่ออัปโหลดกรมธรรม์
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {policies.map(([policyNumber, files]) => {
              const groupAllSelected = files.every(f => selected.has(f.id));
              const groupSomeSelected = files.some(f => selected.has(f.id));
              const isCollapsed = collapsed[policyNumber];

              return (
                <div key={policyNumber} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  {/* Policy header */}
                  <div className={`px-4 py-3 flex items-center gap-3
                    ${policyNumber === 'ไม่ระบุกรมธรรม์'
                      ? 'bg-slate-100 border-b border-slate-200'
                      : 'bg-blue-50 border-b border-blue-100'}`}>

                    {/* Group checkbox in edit mode */}
                    {editMode && (
                      <input
                        type="checkbox"
                        checked={groupAllSelected}
                        ref={el => { if (el) el.indeterminate = groupSomeSelected && !groupAllSelected; }}
                        onChange={() => toggleSelectGroup(files)}
                        className="w-4 h-4 accent-blue-600 cursor-pointer shrink-0"
                      />
                    )}

                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-blue-600 font-bold text-base shrink-0">📋</span>
                      <div className="min-w-0">
                        <div className="text-xs text-slate-500">กรมธรรม์เลขที่</div>
                        <div className={`font-bold text-sm truncate
                          ${policyNumber === 'ไม่ระบุกรมธรรม์' ? 'text-slate-400 italic' : 'text-blue-700'}`}>
                          {policyNumber}
                        </div>
                      </div>
                    </div>

                    <span className="text-xs bg-white text-slate-500 border border-slate-200 rounded-full px-2 py-0.5 shrink-0">
                      {files.length} ไฟล์
                    </span>

                    {/* Collapse toggle */}
                    <button
                      onClick={() => setCollapsed(prev => ({ ...prev, [policyNumber]: !prev[policyNumber] }))}
                      className="text-slate-400 hover:text-slate-600 transition-colors shrink-0"
                    >
                      {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                    </button>
                  </div>

                  {/* Files */}
                  {!isCollapsed && (
                    <ul className="divide-y divide-slate-100">
                      {files.map((file, idx) => (
                        <li
                          key={file.id}
                          className={`px-4 py-3 transition-colors
                            ${editMode && selected.has(file.id) ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                        >
                          <div className="flex items-center gap-3">
                            {/* Row checkbox */}
                            {editMode && (
                              <input
                                type="checkbox"
                                checked={selected.has(file.id)}
                                onChange={() => toggleSelect(file.id)}
                                className="w-4 h-4 accent-blue-600 cursor-pointer shrink-0"
                              />
                            )}

                            {!editMode && (
                              <span className="text-slate-300 text-xs w-5 text-right shrink-0">{idx + 1}.</span>
                            )}

                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-slate-700 text-sm truncate">📄 {file.title}</div>
                              <div className="text-xs text-slate-400 mt-0.5">
                                {file.contentLength.toLocaleString()} ตัวอักษร
                                {file.uploadedAt && ` · ${new Date(file.uploadedAt).toLocaleDateString('th-TH')}`}
                              </div>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* All users breakdown */}
        {allUsersStats?.userBreakdown?.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 mt-4">
            <h3 className="font-semibold text-slate-700 mb-3">👥 เอกสารของทุกคนในระบบ</h3>
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

      {/* ===== Bulk Rename Modal ===== */}
      {showRenameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800 text-base">เปลี่ยนชื่อกรมธรรม์</h3>
              <button onClick={() => setShowRenameModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-slate-500">
              เปลี่ยนชื่อกรมธรรม์สำหรับ <span className="font-medium text-slate-700">{selected.size} ไฟล์</span> ที่เลือก
            </p>

            <input
              type="text"
              value={bulkPolicyName}
              onChange={e => setBulkPolicyName(e.target.value)}
              placeholder="ระบุเลขหรือชื่อกรมธรรม์..."
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && !renaming && handleBulkRename()}
            />

            <div className="flex gap-3">
              <button
                onClick={() => setShowRenameModal(false)}
                disabled={renaming}
                className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 text-sm font-medium"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleBulkRename}
                disabled={renaming || !bulkPolicyName.trim()}
                className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {renaming ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <><Check size={14} /> บันทึก</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Bulk Delete Confirm Modal ===== */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm flex flex-col items-center gap-4">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-red-50">
              <Trash2 size={24} className="text-red-500" />
            </div>
            <h3 className="font-semibold text-slate-800 text-base">ลบเอกสาร {selected.size} ไฟล์?</h3>
            <p className="text-sm text-slate-500 text-center">
              การลบจะไม่สามารถกู้คืนได้ คุณต้องการดำเนินการต่อหรือไม่?
            </p>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 text-sm font-medium"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {deleting ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <><Trash2 size={14} /> ลบ</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}