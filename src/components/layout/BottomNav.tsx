import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Users, History } from 'lucide-react';

const navItems = [
  { to: '/', label: 'Tổng quan', icon: Home, end: true },
  { to: '/users', label: 'Thành viên', icon: Users, end: false },
  { to: '/logs', label: 'Nhật ký', icon: History, end: false },
];

export const BottomNav: React.FC = () => {
  return (
    <nav
      aria-label="Điều hướng di động"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border-subtle bg-bg-secondary/95 backdrop-blur-md lg:hidden pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto grid max-w-md grid-cols-3 px-2 py-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-xl py-1 text-xs font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-400 bg-blue-500/10'
                    : 'text-text-secondary hover:text-text-primary'
                }`
              }
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};
