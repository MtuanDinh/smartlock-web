import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../app/providers/ThemeProvider';
import { Tooltip } from '../ui/Tooltip';

export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <Tooltip
      content={
        isDark ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'
      }
    >
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={
          isDark ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'
        }
        className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-border-strong bg-bg-elevated text-text-secondary transition-colors duration-200 hover:border-blue-500/40 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        {isDark ? (
          <Sun className="h-4 w-4 text-amber-400" />
        ) : (
          <Moon className="h-4 w-4 text-slate-700" />
        )}
      </button>
    </Tooltip>
  );
};
