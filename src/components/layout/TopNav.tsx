import React from 'react';
import { NavLink } from 'react-router-dom';
import { ShieldCheck, Home, Users, History, LogOut } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '../../hooks/useAuth';

const navItems = [
  { to: '/', label: 'Tổng quan', icon: Home, end: true },
  { to: '/users', label: 'Thành viên', icon: Users, end: false },
  { to: '/logs', label: 'Nhật ký', icon: History, end: false },
];

export const TopNav: React.FC = () => {
  const { user, signOut } = useAuth();

  const getAdminInitial = () => {
    if (user?.email) {
      return user.email.slice(0, 2).toUpperCase();
    }
    return 'AD';
  };

  return (
    <header className="sticky top-0 z-40 border-b border-outline-variant/30 bg-surface-container-lowest/95 backdrop-blur-xl shadow-xs dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo & Brand Title */}
        <div className="flex items-center gap-3">
          <NavLink
            to="/"
            className="flex items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-container text-white shadow-md shadow-blue-500/25">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div className="flex flex-col">
              <span className="text-base font-extrabold tracking-tight text-on-surface">
                SMART LOCK
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-outline">
                IoT Access Guard
              </span>
            </div>
          </NavLink>
        </div>

        {/* Center Pill Navigation (Desktop Only) */}
        <nav
          aria-label="Điều hướng chính"
          className="hidden lg:flex items-center gap-1 rounded-full border border-outline-variant/30 bg-surface-container-low/80 p-1 backdrop-blur-md shadow-xs"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `inline-flex min-h-[36px] items-center gap-2 rounded-full px-5 py-1.5 text-xs font-bold transition-all duration-150 active:scale-95 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    isActive
                      ? 'bg-primary-container text-white shadow-sm shadow-blue-500/30'
                      : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                  }`
                }
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Right Section: Status, Theme, Logout, Avatar */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          <StatusBadge />
          <ThemeToggle />
          <button
            type="button"
            onClick={signOut}
            title="Đăng xuất"
            aria-label="Đăng xuất khỏi hệ thống"
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-1.5 text-xs font-bold text-on-surface transition-colors duration-200 hover:border-error/40 hover:bg-error-container/20 hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Thoát</span>
          </button>
          <div
            title={user?.email || 'Quản trị viên'}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary-fixed text-xs font-bold text-primary dark:bg-primary-fixed/30"
          >
            {getAdminInitial()}
          </div>
        </div>
      </div>
    </header>
  );
};
