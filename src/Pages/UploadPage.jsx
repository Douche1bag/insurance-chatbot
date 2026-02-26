// src/Pages/UploadPage.jsx

import React, { useState, useRef } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import ChatHeader from '../components/ChatHeader';

export default function UploadPage({ user }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
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
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const startUpload = async () => {
    if (!file) {
      alert('กรุณาเลือกไฟล์');
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', user?.id || 'guest');

      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev;
          return prev + 10;
        });
      }, 300);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      clearInterval(progressInterval);
      setProgress(100);

      const result = await response.json();

      if (result.success) {
        const { data } = result;
        const verificationMsg = data.verification?.success 
          ? `✅ ยืนยันการจัดเก็บใน Vector Database\n📊 Collection: ${data.collection}\n🔢 Embedding Dimensions: ${data.verification.embeddingDimensions}\n📝 Content Length: ${data.verification.contentLength} ตัวอักษร`
          : '⚠️ ไม่สามารถยืนยันการจัดเก็บได้';
        
        alert(`✅ อัปโหลดสำเร็จ!\n\n` +
              `📄 ไฟล์: ${data.fileName}\n` +
              `👤 User: ${data.userId}\n` +
              `📝 ข้อความที่สกัด: ${data.textLength} ตัวอักษร\n` +
              `🔢 เวกเตอร์: ${data.embeddingDimensions} มิติ\n` +
              `💾 Collection: ${data.collection}\n\n` +
              `${verificationMsg}`);
        setFile(null);
        setProgress(0);
      } else {
        throw new Error(result.error || 'Upload failed');
      }

    } catch (error) {
      console.error('Upload error:', error);
      alert('❌ เกิดข้อผิดพลาด: ' + error.message);
      setProgress(0);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center min-h-[60vh] bg-slate-50 relative">
      <ChatHeader />
      <div className="w-full flex flex-col items-center mt-4 relative">
          {/* Overlay to cover document icon above heading */}
          <div className="absolute left-1/2 -translate-x-1/2 -top-9 w-6 h-6 md:w-6 md:h-6 z-30 bg-slate-50"></div>
        <h2 className="text-xl font-bold mb-1">นำเข้ากรมธรรม์ใหม่</h2>
        <div className="text-slate-500 mb-6 text-base">รองรับไฟล์ PDF, JPG, PNG ระบบจะใช้ OCR ประมวลผลเป็น Vector Data โดยอัตโนมัติ</div>
        <form
          className="w-full flex flex-col items-center"
          onDragEnter={handleDrag}
          onSubmit={e => e.preventDefault()}
        >
          <div
            className={`relative border-2 border-dashed rounded-2xl flex flex-col items-center justify-center w-[90vw] max-w-2xl h-72 bg-white transition-all duration-200 ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleChange}
              disabled={uploading}
            />
            <div className="flex flex-col items-center">
              <div className="font-semibold text-slate-700 mb-1">ลากไฟล์มาวางที่นี่ หรือ <span className="text-blue-600 cursor-pointer underline" onClick={() => inputRef.current.click()}>คลิกเพื่อเลือก</span></div>
              <div className="text-sm text-slate-400 mb-2">ไฟล์ PDF ขนาดไม่เกิน 20MB</div>
              {file && <div className="text-xs text-slate-600 mt-1">{file.name}</div>}
            </div>
            {uploading && <div className="absolute left-0 right-0 bottom-0 px-6 pb-6"><div className="w-full bg-slate-100 rounded-full h-2"><div className="bg-blue-600 h-2 rounded-full" style={{ width: `${progress}%` }} /></div></div>}
          </div>
          <Button
            type="button"
            onClick={startUpload}
            disabled={uploading || !file}
            className="w-48 mt-6"
          >
            {uploading ? 'กำลังอัปโหลด...' : 'Scan Document'}
          </Button>
        </form>
        {/* Data Privacy & OCR Info */}
        <div className="flex flex-col md:flex-row gap-4 mt-8 w-full max-w-2xl">
          <div className="flex-1 flex items-center bg-white rounded-xl shadow-sm p-4 gap-2 border border-slate-100">
            <span className="bg-green-100 rounded-full p-1"><svg width="20" height="20" fill="none" viewBox="0 0 20 20"><circle cx="10" cy="10" r="10" fill="#22c55e"/><path d="M6 10.5l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg></span>
            <span className="text-sm font-medium text-slate-700">Data Privacy Guaranteed</span>
          </div>
          <div className="flex-1 flex items-center bg-white rounded-xl shadow-sm p-4 gap-2 border border-slate-100">
            <span className="bg-blue-100 rounded-full p-1"><svg width="20" height="20" fill="none" viewBox="0 0 20 20"><circle cx="10" cy="10" r="10" fill="#2563eb"/><path d="M7 10h6M10 7v6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg></span>
            <span className="text-sm font-medium text-slate-700">Automatic OCR Vectorization</span>
          </div>
        </div>
      </div>
    </div>
  );
}
