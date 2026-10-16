import React from 'react';
import {
  WifiOff,
  RefreshCw,
  SlidersHorizontal,
  CreditCard,
  ShieldAlert,
} from 'lucide-react';
import { TopNav } from './TopNav';
import { BottomNav } from './BottomNav';
import { useSystemStatus } from '../../hooks/useSystemStatus';
import { Button } from '../ui/Button';

export const AppShell: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const {
    connectionState,
    isClientConnected,
    hasUnsyncedChanges,
    isRetryingSync,
    retryNeedSync,
    mockControls,
  } = useSystemStatus();

  return (
    <div className="relative min-h-screen flex flex-col bg-surface text-on-surface pb-24 lg:pb-0 overflow-x-clip">
      {/* Top Ambient Glow (Linear/Vercel style) */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-96 overflow-hidden opacity-40 dark:opacity-75"
        aria-hidden="true"
      >
        <div className="mx-auto h-full max-w-7xl bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(37,99,235,0.18),transparent)]" />
      </div>

      <TopNav />

      {/* Thanh công cụ giả lập phần cứng (Chỉ xuất hiện khi VITE_USE_MOCK=true) */}
      {mockControls && (
        <div className="border-b border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-xs">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-1.5 font-bold text-indigo-600 dark:text-indigo-300">
              <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
              <span>Chế độ Mock (Giả lập phần cứng):</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  mockControls.setDeviceOnline(connectionState !== 'online')
                }
                className="rounded-lg border border-indigo-500/40 bg-surface-container-lowest px-2.5 py-1 font-semibold text-on-surface hover:bg-surface-container-high"
              >
                {connectionState === 'online'
                  ? 'Giả lập Khóa Offline'
                  : 'Giả lập Khóa Online'}
              </button>
              <button
                type="button"
                onClick={() =>
                  mockControls.setClientConnected(!isClientConnected)
                }
                className="rounded-lg border border-indigo-500/40 bg-surface-container-lowest px-2.5 py-1 font-semibold text-on-surface hover:bg-surface-container-high"
              >
                {isClientConnected
                  ? 'Giả lập Mất mạng Trình duyệt'
                  : 'Khôi phục mạng Trình duyệt'}
              </button>
              <button
                type="button"
                onClick={() => mockControls.simulateCardScanSuccess()}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25"
              >
                <CreditCard className="h-3.5 w-3.5" />
                <span>Quẹt thẻ mới OK</span>
              </button>
              <button
                type="button"
                onClick={() => mockControls.simulateCardScanDuplicate()}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/15 px-2.5 py-1 font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-500/25"
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>Quẹt thẻ trùng</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cảnh báo khi điện thoại/trình duyệt mất kết nối Internet */}
      {!isClientConnected && (
        <div
          role="alert"
          className="border-b border-warning/40 bg-warning-container/20 px-4 py-2.5 text-xs sm:text-sm text-warning dark:text-amber-300"
        >
          <div className="mx-auto flex max-w-7xl items-center gap-2 font-medium px-4 sm:px-6 lg:px-8">
            <WifiOff className="h-4 w-4 shrink-0" />
            <span>
              Điện thoại hoặc trình duyệt của bạn đang mất kết nối Internet. Mọi
              thao tác ghi dữ liệu tạm khóa cho đến khi có mạng trở lại.
            </span>
          </div>
        </div>
      )}

      {/* Cảnh báo khi lưu dữ liệu thành công nhưng chưa đồng bộ Need_Sync xuống khóa */}
      {hasUnsyncedChanges && (
        <div
          role="alert"
          className="border-b border-rose-500/40 bg-rose-500/15 px-4 py-2.5 text-xs sm:text-sm text-rose-800 dark:text-rose-200"
        >
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 font-semibold">
              <RefreshCw className="h-4 w-4 shrink-0" />
              <span>
                Đã lưu nhưng chưa đồng bộ xuống ổ khóa (chưa bật được cờ
                Need_Sync).
              </span>
            </div>
            <Button
              size="sm"
              variant="danger"
              isLoading={isRetryingSync}
              disabled={!isClientConnected}
              disabledTooltip="Vui lòng kết nối mạng trước khi thử lại"
              onClick={retryNeedSync}
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Thử lại
            </Button>
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>

      <footer className="mt-auto border-t border-outline-variant/30 py-6 text-center text-xs text-outline">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p>© Smart Lock IoT · Dữ liệu đồng bộ qua Firebase Realtime Database</p>
        </div>
      </footer>

      <BottomNav />
    </div>
  );
};
