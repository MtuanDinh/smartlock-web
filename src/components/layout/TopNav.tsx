import React from 'react';
import { NavLink } from 'react-router-dom';
import { Cpu, Home, Users, History, LogOut } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '../../hooks/useAuth';

const navItems = [
  { to: '/', label: 'Tổng quan', icon: Home, end: true },
  { to: '/users', label: 'Thành viên', icon: Users, end: false },
  { to: '/logs', label: 'Nhật ký', icon: History, end: false },
];

export const TopNav: React.FC = () => {
  const { signOut } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-border-subtle bg-bg-secondary/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <NavLink
            to="/"
            className="flex items-center gap-2.5 text-base font-extrabold tracking-tight text-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-600/30">
              <Cpu className="h-5 w-5" />
            </span>
            <span>SMART LOCK</span>
          </NavLink>

          <nav
            aria-label="Điều hướng chính"
            className="hidden lg:flex items-center gap-1.5"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `inline-flex min-h-[40px] items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      isActive
                        ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                        : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary'
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5">
          <StatusBadge />
          <ThemeToggle />
          <button
            type="button"
            onClick={signOut}
            title="Đăng xuất"
            aria-label="Đăng xuất khỏi hệ thống"
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-border-strong bg-bg-elevated px-3 py-1.5 text-xs font-bold text-text-primary transition-colors duration-200 hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Thoát</span>
          </button>
        </div>
      </div>
    </header>
  );
};
