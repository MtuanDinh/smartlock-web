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
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-outline-variant/30 bg-surface-container-lowest/95 backdrop-blur-xl lg:hidden pb-[env(safe-area-inset-bottom)] shadow-lg shadow-black/10 dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
    >
      <div className="mx-auto grid max-w-md grid-cols-3 px-3 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-2xl py-1 text-xs font-semibold transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isActive
                    ? 'text-primary'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`flex h-8 w-14 items-center justify-center rounded-full transition-all duration-200 ${
                      isActive
                        ? 'bg-primary-container text-white shadow-sm shadow-blue-500/25'
                        : 'text-on-surface-variant'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span
                    className={`text-[11px] font-bold ${
                      isActive ? 'text-primary' : 'text-on-surface-variant'
                    }`}
                  >
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};
