import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { APP_NAME } from "../utils/constants";

export default function SignUpPage({ onSignUp }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    
    if (!email || !password || !confirmPassword) {
      setError("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }
    
    if (password !== confirmPassword) {
      setError("รหัสผ่านไม่ตรงกัน");
      return;
    }
    
    if (password.length < 4) {
      setError("รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร");
      return;
    }

    setLoading(true);

    try {
      const API_URL = import.meta.env.VITE_API_URL || '/api';
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name })
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          navigate("/");
        }, 2000);
      } else {
        setError(result.error || 'ลงทะเบียนไม่สำเร็จ');
      }
    } catch (error) {
      console.error('Registration error:', error);
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-8">
      <Card className="max-w-lg w-full p-12 text-center shadow-2xl rounded-3xl">
        <h1 className="text-3xl font-extrabold mb-3">สมัครสมาชิก {APP_NAME}</h1>
        <p className="mb-8 text-slate-600 text-xl">สร้างบัญชีใหม่เพื่อใช้งานระบบ</p>
        
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm">
            ✅ ลงทะเบียนสำเร็จ! กำลังพาคุณไปหน้าเข้าสู่ระบบ...
          </div>
        )}
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <input
            type="email"
            placeholder="Email"
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 text-lg"
            value={email}
            onChange={e => setEmail(e.target.value)}
            disabled={loading}
            autoComplete="email"
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 text-lg"
            value={password}
            onChange={e => setPassword(e.target.value)}
            disabled={loading}
            autoComplete="new-password"
          />
          <input
            type="password"
            placeholder="Confirm Password"
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 text-lg"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            disabled={loading}
            autoComplete="new-password"
          />
          <Button 
            type="submit" 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 text-lg"
            disabled={loading}
          >
            {loading ? 'กำลังลงทะเบียน...' : 'Sign Up'}
          </Button>
        </form>
        <div className="mt-4 text-sm text-slate-500">
          มีบัญชีอยู่แล้ว? <a href="/" className="underline text-blue-600 hover:text-blue-800 font-semibold">Login</a>
        </div>
      </Card>
    </div>
  );
}
