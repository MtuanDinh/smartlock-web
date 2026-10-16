import React from 'react';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { useSystemStatus } from '../../hooks/useSystemStatus';
import { Tooltip } from '../ui/Tooltip';

export const StatusBadge: React.FC = () => {
  const { connectionState, isClientConnected } = useSystemStatus();

  if (connectionState === 'loading') {
    return (
      <span
        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-border-strong bg-bg-elevated px-3 py-1 text-xs font-semibold text-text-secondary"
        aria-label="Đang kiểm tra kết nối"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
        <span className="hidden sm:inline">Đang kiểm tra...</span>
      </span>
    );
  }

  if (!isClientConnected) {
    return (
      <Tooltip content="Điện thoại hoặc trình duyệt của bạn đang mất kết nối Internet.">
        <span className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden sm:inline">Mất mạng</span>
        </span>
      </Tooltip>
    );
  }

  if (connectionState === 'online') {
    return (
      <Tooltip content="Ổ khóa đang trực tuyến và phản hồi nhịp tim định kỳ.">
        <span className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:hidden" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <Wifi className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden sm:inline">Online</span>
        </span>
      </Tooltip>
    );
  }

  return (
    <Tooltip content="Ổ khóa không gửi nhịp tim trong 35 giây qua. Các nút điều khiển từ xa tạm khóa.">
      <span className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-rose-500/40 bg-rose-500/15 px-3 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
        <WifiOff className="h-3.5 w-3.5 shrink-0" />
        <span className="hidden sm:inline">Offline</span>
      </span>
    </Tooltip>
  );
};
