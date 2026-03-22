// src/Pages/UploadPage.jsx

import React, { useState, useRef } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import ChatHeader from '../components/ChatHeader';
import { MessageSquare, CheckCircle2 } from 'lucide-react';

export default function UploadPage({ user, onNavigate }) {
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploadResults, setUploadResults] = useState([]);
  const [showNextModal, setShowNextModal] = useState(false);
  const inputRef = useRef();

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files) {
      const newFiles = Array.from(e.dataTransfer.files).filter(f =>
        /\.(pdf|jpg|jpeg|png)$/i.test(f.name)
      );
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleChange = (e) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files)]);
    }
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setUploadResults(prev => prev.filter((_, i) => i !== index));
  };

  const uploadSingleFile = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', user?.id || 'guest');
    const response = await fetch('/api/upload', { method: 'POST', body: formData });
    return response.json();
  };

  const startUpload = async () => {
    if (files.length === 0) { alert('กรุณาเลือกไฟล์อย่างน้อย 1 ไฟล์'); return; }
    setUploading(true);
    setUploadResults(files.map(f => ({ name: f.name, status: 'pending', message: '', ocrMethod: null })));

    let successCountLocal = 0;
    for (let i = 0; i < files.length; i++) {
      setUploadResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'uploading' } : r));
      try {
        const result = await uploadSingleFile(files[i]);
        if (result.success) {
          successCountLocal++;
          setUploadResults(prev => prev.map((r, idx) => idx === i ? {
            ...r,
            status: 'success',
            ocrMethod: result.data.ocrMethod || 'unknown',
            message: `${result.data.textLength} ตัวอักษร`
          } : r));
        } else {
          setUploadResults(prev => prev.map((r, idx) => idx === i ? {
            ...r, status: 'error', message: result.error || 'Upload failed'
          } : r));
        }
      } catch (err) {
        setUploadResults(prev => prev.map((r, idx) => idx === i ? {
          ...r, status: 'error', message: err.message
        } : r));
      }
    }

    setUploading(false);
    if (successCountLocal > 0) setShowNextModal(true);
  };

  const clearAll = () => { setFiles([]); setUploadResults([]); };

  const successCount = uploadResults.filter(r => r.status === 'success').length;
  const errorCount   = uploadResults.filter(r => r.status === 'error').length;

  // OCR method badge
  const OcrBadge = ({ method }) => {
    if (!method) return null;
    if (method === 'typhoon-ocr') return (
      <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded px-1.5 py-0.5 shrink-0">
        Typhoon OCR
      </span>
    );
    if (method === 'tesseract') return (
      <span className="text-xs bg-orange-50 text-orange-600 border border-orange-200 rounded px-1.5 py-0.5 shrink-0">
        ⚠️ Tesseract (คุณภาพต่ำ)
      </span>
    );
    return (
      <span className="text-xs bg-slate-100 text-slate-500 rounded px-1.5 py-0.5 shrink-0">
        {method}
      </span>
    );
  };

  return (
    <>
    <div className="flex flex-col items-center min-h-[60vh] bg-slate-50 relative">
      <ChatHeader />
      <div className="w-full flex flex-col items-center mt-4 relative">
        <h2 className="text-xl font-bold mb-1">นำเข้ากรมธรรม์ใหม่</h2>
        <div className="text-slate-500 mb-6 text-base">
          รองรับไฟล์ PDF, JPG, PNG — อัปโหลดได้หลายไฟล์พร้อมกัน
        </div>

        <form className="w-full flex flex-col items-center" onDragEnter={handleDrag} onSubmit={e => e.preventDefault()}>
          {/* Drop Zone */}
          <div
            className={`relative border-2 border-dashed rounded-2xl flex flex-col items-center justify-center w-[90vw] max-w-2xl h-48 bg-white transition-all duration-200 cursor-pointer
              ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => inputRef.current.click()}
          >
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png"
              multiple
              onChange={handleChange}
              disabled={uploading}
            />
            <div className="flex flex-col items-center pointer-events-none">
              <svg className="w-10 h-10 text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <div className="font-semibold text-slate-700 mb-1">
                ลากไฟล์มาวางที่นี่ หรือ <span className="text-blue-600 underline">คลิกเพื่อเลือก</span>
              </div>
              <div className="text-sm text-slate-400">PDF, JPG, PNG — เลือกได้หลายไฟล์</div>
            </div>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="w-[90vw] max-w-2xl mt-4 bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200">
                <span className="text-sm font-semibold text-slate-700">
                  ไฟล์ที่เลือก ({files.length} ไฟล์)
                </span>
                {!uploading && (
                  <button onClick={clearAll} className="text-xs text-red-500 hover:text-red-700">
                    ล้างทั้งหมด
                  </button>
                )}
              </div>
              <ul className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                {files.map((file, index) => {
                  const result = uploadResults[index];
                  const statusIcon = !result ? '📄'
                    : result.status === 'uploading' ? '⏳'
                    : result.status === 'success'   ? '✅'
                    : result.status === 'error'     ? '❌'
                    : '📄';
                  const statusColor = !result ? 'text-slate-500'
                    : result.status === 'success' ? 'text-green-600'
                    : result.status === 'error'   ? 'text-red-500'
                    : 'text-blue-500';

                  return (
                    <li key={index} className="flex items-center justify-between px-4 py-2.5 text-sm gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span>{statusIcon}</span>
                        <span className="truncate text-slate-700">{file.name}</span>
                        <span className="text-xs text-slate-400 shrink-0">
                          ({(file.size / 1024).toFixed(0)} KB)
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-1">
                        {/* OCR method badge — shown after success */}
                        {result?.status === 'success' && (
                          <OcrBadge method={result.ocrMethod} />
                        )}
                        {result?.message && (
                          <span className={`text-xs ${statusColor}`}>{result.message}</span>
                        )}
                        {/* Re-upload hint for Tesseract files */}
                        {result?.ocrMethod === 'tesseract' && (
                          <span className="text-xs text-orange-500 hidden sm:inline">— อัปโหลดใหม่เมื่อ Typhoon พร้อม</span>
                        )}
                        {!uploading && (
                          <button onClick={() => removeFile(index)} className="text-slate-400 hover:text-red-500 ml-1">
                            ✕
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Summary */}
          {uploadResults.length > 0 && !uploading && (
            <div className="w-[90vw] max-w-2xl mt-3 flex flex-wrap gap-2 text-sm">
              {successCount > 0 && (
                <span className="bg-green-50 text-green-700 border border-green-200 rounded-lg px-3 py-1">
                  ✅ สำเร็จ {successCount} ไฟล์
                </span>
              )}
              {errorCount > 0 && (
                <span className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-1">
                  ❌ ผิดพลาด {errorCount} ไฟล์
                </span>
              )}
              {uploadResults.some(r => r.ocrMethod === 'tesseract') && (
                <span className="bg-orange-50 text-orange-700 border border-orange-200 rounded-lg px-3 py-1">
                  ⚠️ บางไฟล์ใช้ Tesseract — คุณภาพต่ำ กรุณาอัปโหลดใหม่เมื่อ Typhoon พร้อม
                </span>
              )}
            </div>
          )}

          <Button
            type="button"
            onClick={startUpload}
            disabled={uploading || files.length === 0}
            className="w-48 mt-6"
          >
            {uploading ? 'กำลังอัปโหลด...' : `Scan ${files.length > 1 ? `${files.length} ไฟล์` : 'Document'}`}
          </Button>
        </form>

        {/* Info Cards */}
        <div className="flex flex-col md:flex-row gap-4 mt-8 w-full max-w-2xl">
          <div className="flex-1 flex items-center bg-white rounded-xl shadow-sm p-4 gap-2 border border-slate-100">
            <span className="bg-green-100 rounded-full p-1">
              <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
                <circle cx="10" cy="10" r="10" fill="#22c55e"/>
                <path d="M6 10.5l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </span>
            <span className="text-sm font-medium text-slate-700">Data Privacy Guaranteed</span>
          </div>
          <div className="flex-1 flex items-center bg-white rounded-xl shadow-sm p-4 gap-2 border border-slate-100">
            <span className="bg-blue-100 rounded-full p-1">
              <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
                <circle cx="10" cy="10" r="10" fill="#2563eb"/>
                <path d="M7 10h6M10 7v6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </span>
            <span className="text-sm font-medium text-slate-700">Automatic OCR Vectorization</span>
          </div>
        </div>
      </div>
    </div>

    {showNextModal && (
      <div className="fixed inset-0 left-56 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm mx-4 flex flex-col items-center gap-4">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-green-50">
            <CheckCircle2 size={32} className="text-green-500" />
          </div>
          <h2 className="text-lg font-semibold text-slate-800">อัปโหลดเสร็จสมบูรณ์!</h2>
          <p className="text-sm text-slate-500 text-center">
            คุณต้องการไปที่ AI Chat เพื่อเริ่มถามคำถามเกี่ยวกับนโยบายประกันภัยของคุณเลยมั้ย?
          </p>
          <div className="flex gap-3 w-full mt-2">
            <button
              className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 font-medium text-sm"
              onClick={() => setShowNextModal(false)}
            >
              ไม่ต้องการ
            </button>
            <button
              className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium text-sm flex items-center justify-center gap-2"
              onClick={() => { setShowNextModal(false); onNavigate('chat'); }}
            >
              <MessageSquare size={15} />
              ไปที่ AI Chat
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}