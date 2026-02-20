// src/layout/MainLayout.jsx
import React from 'react';
import { APP_NAME } from '../utils/constants';

export default function MainLayout({ children, menu, onMenuClick }) {
  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="w-56 bg-white border-r p-4 flex flex-col gap-2">
        <div className="font-bold text-lg mb-4">{APP_NAME}</div>
        {menu.map(item => (
          <button
            key={item.key}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 ${item.active ? 'bg-blue-50 text-blue-700' : 'text-slate-700'}`}
            onClick={() => onMenuClick(item.key)}
          >
            {item.icon && <item.icon size={18} />}
            {item.label}
          </button>
        ))}
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
