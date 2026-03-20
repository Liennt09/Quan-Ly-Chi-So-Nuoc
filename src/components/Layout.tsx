import React from 'react';
import { LogOut, Droplets, LayoutDashboard, Database, History, Settings as SettingsIcon, User } from 'lucide-react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: any;
}

export default function Layout({ children, activeTab, setActiveTab, user }: LayoutProps) {
  const tabs = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'entry', name: 'Nhập liệu', icon: Database },
    { id: 'history', name: 'Lịch sử', icon: History },
    { id: 'settings', name: 'Cài đặt', icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-bottom border-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
            <Droplets size={24} />
          </div>
          <div>
            <h1 className="font-bold text-slate-900 leading-tight">Quản Lý Nước</h1>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Thông Minh</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium",
                activeTab === tab.id
                  ? "bg-blue-50 text-blue-600 shadow-sm"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <tab.icon size={20} />
              {tab.name}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-600">
              <User size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{user?.displayName || user?.email?.split('@')[0] || 'Người dùng'}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => signOut(auth)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 transition-all duration-200 font-medium"
          >
            <LogOut size={20} />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
