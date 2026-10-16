import React, {
  createContext,
  useCallback,
  useContext,
  useState,
} from 'react';
import { ToastContainer, type ToastItem, type ToastVariant } from '../../components/ui/Toast';

export interface ShowToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
}

interface ToastContextValue {
  showToast: (options: ShowToastOptions) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({
      title,
      description,
      variant = 'info',
      durationMs = 4000,
    }: ShowToastOptions) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const item: ToastItem = { id, title, description, variant };
      setToasts((prev) => [...prev.slice(-3), item]);

      if (durationMs > 0) {
        setTimeout(() => {
          dismissToast(id);
        }, durationMs);
      }
    },
    [dismissToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
