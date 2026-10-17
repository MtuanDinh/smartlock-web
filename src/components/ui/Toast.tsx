import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  X,
} from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

const variantConfig: Record<
  ToastVariant,
  { border: string; icon: React.ReactNode }
> = {
  success: {
    border: 'border-emerald-500/40 bg-bg-secondary',
    icon: <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />,
  },
  error: {
    border: 'border-rose-500/50 bg-bg-secondary',
    icon: <XCircle className="h-5 w-5 text-rose-500 shrink-0" />,
  },
  warning: {
    border: 'border-amber-500/50 bg-bg-secondary',
    icon: <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />,
  },
  info: {
    border: 'border-blue-500/40 bg-bg-secondary',
    icon: <Info className="h-5 w-5 text-blue-500 shrink-0" />,
  },
};

export const ToastContainer: React.FC<{
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed top-4 right-4 left-4 sm:left-auto sm:w-96 z-[60] flex flex-col gap-2.5 pointer-events-none"
    >
      {toasts.map((t) => {
        const cfg = variantConfig[t.variant];
        return (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-xl transition-all duration-200 ${cfg.border}`}
          >
            <div className="mt-0.5">{cfg.icon}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-text-primary">{t.title}</p>
              {t.description && (
                <p className="mt-0.5 text-xs text-text-secondary leading-relaxed">
                  {t.description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              aria-label="Đóng thông báo"
              className="rounded-lg p-1 text-text-muted hover:bg-bg-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
