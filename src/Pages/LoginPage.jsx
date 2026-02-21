// src/Pages/LoginPage.jsx
import React from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { APP_NAME } from '../utils/constants';

export default function LoginPage({ onLogin }) {
  // Google OAuth handler
  const handleGoogleLogin = () => {
    window.open("https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=YOUR_REDIRECT_URI&response_type=token&scope=email profile", "_self");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-8">
      <Card className="max-w-lg w-full p-12 text-center shadow-2xl rounded-3xl">
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
        <h1 className="text-3xl font-extrabold mb-3">{APP_NAME}</h1>
        <p className="mb-8 text-slate-600 text-xl">Intelligence that simplifies your insurance lifecycle.</p>
        <Button onClick={handleGoogleLogin} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 mb-6 flex items-center justify-center gap-3 text-lg">
          <svg width="28" height="28" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g clipPath="url(#clip0_17_40)">
              <path d="M47.617 24.552c0-1.638-.147-3.203-.422-4.704H24.48v9.02h13.01c-.56 3.02-2.25 5.58-4.8 7.3v6.06h7.75c4.54-4.18 7.177-10.34 7.177-17.676z" fill="#4285F4"/>
              <path d="M24.48 48c6.48 0 11.93-2.15 15.91-5.85l-7.75-6.06c-2.15 1.44-4.9 2.3-8.16 2.3-6.27 0-11.58-4.23-13.48-9.93H2.5v6.24C6.47 43.77 14.7 48 24.48 48z" fill="#34A853"/>
              <path d="M11 28.46c-.5-1.44-.8-2.97-.8-4.46s.29-3.02.8-4.46v-6.24H2.5A23.98 23.98 0 000 24c0 3.97.97 7.73 2.5 10.7l8.5-6.24z" fill="#FBBC05"/>
              <path d="M24.48 9.52c3.53 0 6.66 1.22 9.14 3.62l6.84-6.84C36.41 2.15 30.96 0 24.48 0 14.7 0 6.47 4.23 2.5 11.3l8.5 6.24c1.9-5.7 7.21-9.93 13.48-9.93z" fill="#EA4335"/>
            </g>
            <defs>
              <clipPath id="clip0_17_40">
                <path fill="#fff" d="M0 0h48v48H0z"/>
              </clipPath>
            </defs>
          </svg>
          Sign in with Google
        </Button>
        <div className="flex items-center my-6">
          <div className="flex-grow border-t border-slate-200"></div>
          <div className="flex-grow border-t border-slate-200"></div>
        </div>
        <input
          type="text"
          placeholder="Username or Email"
          className="w-full mb-4 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 text-lg"
        />
        <input
          type="password"
          placeholder="Password"
          className="w-full mb-8 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 text-lg"
        />
        <Button onClick={onLogin} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 mb-3 text-lg">Login</Button>
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
