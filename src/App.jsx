import React, { useState } from 'react';
import MainLayout from './layout/MainLayout';
import LoginPage from './Pages/LoginPage';
import DashboardPage from './Pages/DashboardPage';
import UploadPage from './Pages/UploadPage';
import ChatPage from './Pages/ChatPage';
import ComparisonPage from './Pages/ComparisonPage';
import AdminPage from './Pages/AdminPage';
import { LayoutDashboard, Upload, MessageSquare, BarChart3, Users, LogOut } from 'lucide-react';
import './Styles/App.css';

export default function App() {
  const [currentPage, setCurrentPage] = useState('chat');
  const [isLoggedIn, setIsLoggedIn] = useState(true);

  if (!isLoggedIn) {
    return <LoginPage onLogin={() => setIsLoggedIn(true)} />;
  }

  const menuItems = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, active: currentPage === 'dashboard' },
    { key: 'upload', label: 'Upload', icon: Upload, active: currentPage === 'upload' },
    { key: 'chat', label: 'AI Chat', icon: MessageSquare, active: currentPage === 'chat' },
    { key: 'compare', label: 'Compare', icon: BarChart3, active: currentPage === 'compare' },
    { key: 'admin', label: 'Admin', icon: Users, active: currentPage === 'admin' },
    { key: 'logout', label: 'Logout', icon: LogOut, active: false },
  ];

  const handleMenuClick = (key) => {
    if (key === 'logout') {
      setIsLoggedIn(false);
      setCurrentPage('dashboard');
    } else {
      setCurrentPage(key);
    }
  };

  let page = null;
  switch (currentPage) {
    case 'dashboard':
      page = <DashboardPage />;
      break;
    case 'upload':
      page = <UploadPage />;
      break;
    case 'chat':
      page = <ChatPage />;
      break;
    case 'compare':
      page = <ComparisonPage />;
      break;
    case 'admin':
      page = <AdminPage />;
      break;
    default:
      page = <DashboardPage />;
  }

  return (
    <MainLayout menu={menuItems} onMenuClick={handleMenuClick}>
      {page}
    </MainLayout>
  );
}
  
