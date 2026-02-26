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

  const handleLogin = (userData) => {
    setUser(userData);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
    setIsLoggedIn(false);
    setCurrentPage('chat');
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
      handleLogout();
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
      page = <UploadPage user={user} />;
      break;
    case 'chat':
      page = <ChatPage user={user} />;
      break;
    default:
      page = <DashboardPage user={user} />;
  }

  return (
    <MainLayout menu={menuItems} onMenuClick={handleMenuClick}>
      {page}
    </MainLayout>
  );
}
  
