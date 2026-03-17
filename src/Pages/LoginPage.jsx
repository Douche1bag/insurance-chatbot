// src/Pages/LoginPage.jsx
import React, { useState } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { APP_NAME } from '../utils/constants';

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('กรุณากรอกอีเมลและรหัสผ่าน');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const result = await response.json();

      if (result.success) {
        // Store user info in localStorage
        localStorage.setItem('user', JSON.stringify(result.user));
        onLogin(result.user);
      } else {
        setError(result.error || 'เข้าสู่ระบบไม่สำเร็จ');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  // ...existing code...

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="max-w-md w-full p-8 text-center shadow-2xl rounded-3xl">
        {/* Logo/Icon */}
        <div className="flex justify-center mb-6">
          <div className="bg-blue-100 rounded-full p-5">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="24" height="24" rx="12" fill="#2563eb"/>
              <path d="M12 7C10.3431 7 9 8.34315 9 10V12C9 13.6569 10.3431 15 12 15C13.6569 15 15 13.6569 15 12V10C15 8.34315 13.6569 7 12 7Z" fill="white"/>
              <path d="M7 12C7 15.3137 9.68629 18 13 18C16.3137 18 19 15.3137 19 12" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
        </div>
        <h1 className="text-3xl font-extrabold mb-2">{APP_NAME}</h1>
        <p className="mb-6 text-slate-600 text-lg">Intelligence that simplifies your insurance lifecycle.</p>
        <div className="flex items-center my-4">
          <div className="flex-grow border-t border-slate-200"></div>
          <div className="mx-2 text-slate-400 text-xs">เข้าสู่ระบบ</div>
          <div className="flex-grow border-t border-slate-200"></div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            className="w-full mb-3 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 text-base"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            autoComplete="email"
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full mb-5 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 text-base"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            autoComplete="current-password"
          />
          <Button 
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 mb-2 text-base"
            disabled={loading}
          >
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'Login'}
          </Button>
        </form>
        <div className="mb-2 text-sm text-slate-500">
          ยังไม่มีบัญชี? <a href="/signup" className="underline text-blue-600 hover:text-blue-800 font-semibold">Sign up</a>
        </div>
        <div className="mt-3 text-sm text-slate-500">
          By continuing, you agree to our <a href="/terms" className="underline text-blue-600">Terms of Service</a> and <a href="/pdpa" className="underline text-blue-600">PDPA Data Privacy Policy</a>.
        </div>
      </Card>
    </div>
  );
}

 