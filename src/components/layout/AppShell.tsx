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
    <div className="min-h-screen flex flex-col bg-bg-primary text-text-primary pb-20 lg:pb-8">
      <TopNav />

      {/* Thanh công cụ giả lập phần cứng (Chỉ xuất hiện khi VITE_USE_MOCK=true) */}
      {mockControls && (
        <div className="border-b border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-xs">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2">
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
                className="rounded-lg border border-indigo-500/40 bg-bg-secondary px-2.5 py-1 font-semibold text-text-primary hover:bg-bg-elevated"
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
                className="rounded-lg border border-indigo-500/40 bg-bg-secondary px-2.5 py-1 font-semibold text-text-primary hover:bg-bg-elevated"
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
          className="border-b border-amber-500/40 bg-amber-500/15 px-4 py-2.5 text-xs sm:text-sm text-amber-800 dark:text-amber-300"
        >
          <div className="mx-auto flex max-w-5xl items-center gap-2 font-medium">
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
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2">
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

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
        {children}
      </main>

      <BottomNav />
    </div>
  );
};
