import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Receipt, TrendingUp, Upload,
  LogOut, Menu, X, Settings
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { cn } from '../lib/utils';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/groups',    icon: Users,           label: 'Groups' },
  { to: '/expenses',  icon: Receipt,         label: 'Expenses' },
  { to: '/balances',  icon: TrendingUp,      label: 'Balances' },
  { to: '/import',    icon: Upload,          label: 'Import CSV' },
];

// Thin left-bar colors per group (cycles)
const GROUP_COLORS = ['#16A34A', '#2563EB', '#9333EA', '#EA580C', '#0891B2'];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { user, logout } = useAuthStore();
  const { getGroupsForUser } = useAppStore();
  const groups = user ? getGroupsForUser(user.id) : [];
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F5F5F4' }}>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ────────────────────────────────────────── */}
      <aside
        style={{ background: '#0F1117', width: '220px', flexShrink: 0 }}
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-30 flex flex-col transition-transform duration-200',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-2 px-5 py-5"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          {/* ₹ icon instead of grid */}
          <span
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontWeight: 700,
              fontSize: '1.1rem',
              color: '#16A34A',
              lineHeight: 1,
            }}
          >
            ₹
          </span>
          <span
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontWeight: 700,
              fontSize: '0.95rem',
              color: '#FFFFFF',
              letterSpacing: '0.02em',
            }}
          >
            SplitWise
          </span>
          <button
            className="ml-auto lg:hidden"
            style={{ color: '#6B7280' }}
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-4" style={{ paddingLeft: 0, paddingRight: 0 }}>
          {navItems.map(({ to, icon: Icon, label }) => {
            const isActive = location.pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setSidebarOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.625rem',
                  padding: '0.5rem 1.25rem',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  color: isActive ? '#FFFFFF' : '#9A9A9A',
                  textDecoration: 'none',
                  borderLeft: isActive ? '2px solid #4ADE80' : '2px solid transparent',
                  transition: 'color 0.12s, border-color 0.12s',
                  background: 'transparent',
                }}
              >
                <Icon
                  style={{ width: '15px', height: '15px', flexShrink: 0, color: isActive ? '#4ADE80' : '#6B7280' }}
                />
                {label}
              </Link>
            );
          })}

          {/* Groups submenu */}
          {groups.length > 0 && (
            <div className="mt-5">
              <p
                style={{
                  padding: '0 1.25rem',
                  fontSize: '0.625rem',
                  fontWeight: 600,
                  color: '#4B5563',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  marginBottom: '0.375rem',
                }}
              >
                My Groups
              </p>
              {groups.map((g, idx) => {
                const isActive = location.pathname === `/groups/${g.id}`;
                const barColor = GROUP_COLORS[idx % GROUP_COLORS.length];
                return (
                  <Link
                    key={g.id}
                    to={`/groups/${g.id}`}
                    onClick={() => setSidebarOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.4rem 1.25rem',
                      fontSize: '0.8rem',
                      fontWeight: 400,
                      color: isActive ? '#FFFFFF' : '#9A9A9A',
                      textDecoration: 'none',
                      borderLeft: `2px solid ${isActive ? barColor : 'transparent'}`,
                      transition: 'color 0.12s',
                      overflow: 'hidden',
                    }}
                  >
                    {/* thin colored bar strip */}
                    <span
                      style={{
                        width: '3px',
                        height: '14px',
                        borderRadius: '2px',
                        background: barColor,
                        flexShrink: 0,
                        opacity: isActive ? 1 : 0.35,
                      }}
                    />
                    <span
                      style={{
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {g.name}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </nav>

        {/* User section — initials only, no dropdown arrow */}
        <div
          className="relative"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '0.875rem 1.25rem' }}
        >
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.625rem',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              width: '100%',
              padding: 0,
            }}
          >
            {/* Monogram square */}
            <div
              style={{
                width: '28px',
                height: '28px',
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '0.65rem',
                fontWeight: 600,
                color: '#FFFFFF',
                flexShrink: 0,
              }}
            >
              {initials}
            </div>
            <div style={{ textAlign: 'left', minWidth: 0 }}>
              <p style={{ fontSize: '0.8rem', fontWeight: 500, color: '#E5E7EB', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.name}
              </p>
              <p style={{ fontSize: '0.65rem', color: '#6B7280', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.email}
              </p>
            </div>
          </button>

          {profileOpen && (
            <div
              style={{
                position: 'absolute',
                bottom: '100%',
                left: '0.75rem',
                right: '0.75rem',
                marginBottom: '0.25rem',
                background: '#1C1F26',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '0.5rem',
                padding: '0.25rem 0',
                zIndex: 10,
              }}
            >
              <Link
                to="/settings"
                onClick={() => { setProfileOpen(false); setSidebarOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.5rem 0.875rem', fontSize: '0.8rem',
                  color: '#D1D5DB', textDecoration: 'none',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Settings className="w-3.5 h-3.5" /> Settings
              </Link>
              <button
                onClick={handleLogout}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.5rem 0.875rem', fontSize: '0.8rem',
                  color: '#F87171', background: 'none', border: 'none',
                  cursor: 'pointer', width: '100%',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <LogOut className="w-3.5 h-3.5" /> Sign out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Mobile top bar */}
        <header
          className="lg:hidden flex items-center gap-3 px-4 py-3"
          style={{ background: '#0F1117', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <button onClick={() => setSidebarOpen(true)} style={{ color: '#9A9A9A' }}>
            <Menu className="w-5 h-5" />
          </button>
          <span
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontWeight: 700,
              fontSize: '0.9rem',
              color: '#FFFFFF',
            }}
          >
            ₹ SplitWise
          </span>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
