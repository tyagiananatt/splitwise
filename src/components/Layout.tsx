import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Receipt, TrendingUp, Upload,
  LogOut, Menu, X, ChevronDown, Settings
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { cn } from '../lib/utils';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/groups', icon: Users, label: 'Groups' },
  { to: '/expenses', icon: Receipt, label: 'Expenses' },
  { to: '/balances', icon: TrendingUp, label: 'Balances' },
  { to: '/import', icon: Upload, label: 'Import CSV' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { groups } = useAppStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-100 flex flex-col transition-transform duration-200',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100">
          <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center">
            <Receipt className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-gray-900 text-lg">SplitWise</span>
          <button
            className="ml-auto lg:hidden text-gray-400 hover:text-gray-600"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => {
            const isActive = location.pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <Icon className={cn('w-5 h-5', isActive ? 'text-indigo-600' : 'text-gray-400')} />
                {label}
              </Link>
            );
          })}

          {/* Groups submenu */}
          {groups.length > 0 && (
            <div className="pt-4">
              <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                My Groups
              </p>
              {groups.map((g) => (
                <Link
                  key={g.id}
                  to={`/groups/${g.id}`}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors truncate',
                    location.pathname === `/groups/${g.id}`
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-gray-600 hover:bg-gray-50'
                  )}
                >
                  <div className="w-2 h-2 rounded-full bg-indigo-400 flex-shrink-0" />
                  <span className="truncate">{g.name}</span>
                </Link>
              ))}
            </div>
          )}
        </nav>

        {/* User profile */}
        <div className="p-3 border-t border-gray-100">
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {initials}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
            </button>

            {profileOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-xl border border-gray-100 shadow-lg py-1 z-10">
                <Link
                  to="/settings"
                  onClick={() => { setProfileOpen(false); setSidebarOpen(false); }}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Settings className="w-4 h-4" /> Settings
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut className="w-4 h-4" /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar (mobile) */}
        <header className="lg:hidden flex items-center gap-4 px-4 py-3 bg-white border-b border-gray-100">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-500 hover:text-gray-700"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-bold text-gray-900">SplitWise</span>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
