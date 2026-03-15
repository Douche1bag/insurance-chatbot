import React, { useState, useEffect } from 'react';
import MainLayout from './layout/MainLayout';
import LoginPage from './Pages/LoginPage';
import DashboardPage from './Pages/DashboardPage';
import UploadPage from './Pages/UploadPage';
import ChatPage from './Pages/ChatPage';
import { LayoutDashboard, Upload, MessageSquare, BarChart3, Users, LogOut } from 'lucide-react';
import './Styles/App.css';

export default function App() {
  const [currentPage, setCurrentPage] = useState('chat');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogin = (userData) => {
    setUser(userData);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
    setIsLoggedIn(false);
    setCurrentPage('chat');
    setShowLogoutModal(false);
  };

  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const menuItems = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, active: currentPage === 'dashboard' },
    { key: 'upload', label: 'Upload', icon: Upload, active: currentPage === 'upload' },
    { key: 'chat', label: 'AI Chat', icon: MessageSquare, active: currentPage === 'chat' },
    { key: 'logout', label: 'Logout', icon: LogOut, active: false },
  ];

  const handleMenuClick = (key) => {
    if (key === 'logout') {
      setShowLogoutModal(true);
    } else {
      setCurrentPage(key);
    }
  };

  let page = null;
  switch (currentPage) {
    case 'dashboard':
      page = <DashboardPage user={user} />;
      break;
    case 'upload':
      page = <UploadPage user={user} onNavigate={handleMenuClick} />;
      break;
    case 'chat':
      page = <ChatPage user={user} />;
      break;
    default:
      page = <DashboardPage user={user} />;
  }

  return (
    <>
      <MainLayout menu={menuItems} onMenuClick={handleMenuClick}>
        {page}
      </MainLayout>

      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm mx-4 flex flex-col items-center gap-4">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-red-50">
              <LogOut size={25} className="text-red-500" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800">Log out?</h2>
            <p className="text-sm text-slate-500 text-center">
              Are you sure you want to log out?
            </p>
            <div className="flex gap-3 w-full mt-2">
              <button
                className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 font-medium text-sm"
                onClick={() => setShowLogoutModal(false)}
              >
                Cancel
              </button>
              <button
                className="flex-1 px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-700 font-medium text-sm"
                onClick={handleLogout}
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
  
