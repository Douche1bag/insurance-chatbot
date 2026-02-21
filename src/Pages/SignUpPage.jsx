import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { APP_NAME } from "../utils/constants";

export default function SignUpPage({ onSignUp }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email || !password || !confirmPassword) {
      setError("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }
    if (password !== confirmPassword) {
      setError("รหัสผ่านไม่ตรงกัน");
      return;
    }
    setError("");
    if (onSignUp) onSignUp(email, password);
    // Redirect to login page after successful sign up
    navigate("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-8">
      <Card className="max-w-lg w-full p-12 text-center shadow-2xl rounded-3xl">
        <h1 className="text-3xl font-extrabold mb-3">สมัครสมาชิก {APP_NAME}</h1>
        <p className="mb-8 text-slate-600 text-xl">สร้างบัญชีใหม่เพื่อใช้งานระบบ</p>
        <form onSubmit={handleSubmit} className="space-y-5">
          <input
            type="email"
            placeholder="Email"
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 text-lg"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 text-lg"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <input
            type="password"
            placeholder="Confirm Password"
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 text-lg"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
          {error && <div className="text-red-500 text-sm mb-2">{error}</div>}
          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 text-lg">Sign Up</Button>
        </form>
        <div className="mt-4 text-sm text-slate-500">
          มีบัญชีอยู่แล้ว? <a href="/" className="underline text-blue-600 hover:text-blue-800 font-semibold">Login</a>
        </div>
      </Card>
    </div>
  );
}
