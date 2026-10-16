import React from 'react';
import { DoorOpen, ShieldAlert, Wifi, WifiOff } from 'lucide-react';
import { useSystemStatus } from '../../hooks/useSystemStatus';
import { useLockControl } from '../../hooks/useLockControl';

export interface QuickStatsProps {
  doorOpensOnline: number;
  doorOpensOffline: number;
  alertsOnline: number;
  alertsOffline: number;
}

export const QuickStats: React.FC<QuickStatsProps> = ({
  doorOpensOnline,
  doorOpensOffline,
  alertsOnline,
  alertsOffline,
}) => {
  const { connectionState, isClientConnected } = useSystemStatus();
  const { isLockdown } = useLockControl();

  let connectionTitle = 'Trực tuyến';
  let connectionColor = 'text-emerald-500';
  if (connectionState === 'loading') {
    connectionTitle = 'Đang kiểm tra...';
    connectionColor = 'text-text-secondary';
  } else if (!isClientConnected) {
    connectionTitle = 'Mất mạng thiết bị';
    connectionColor = 'text-amber-500';
  } else if (connectionState === 'offline') {
    connectionTitle = 'Ổ khóa ngoại tuyến';
    connectionColor = 'text-rose-500';
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {/* Thẻ 1: Lượt mở hôm nay */}
      <div className="flex items-center gap-4 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-sm transition-shadow hover:shadow-md">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary-container/30 text-secondary dark:text-emerald-400 border border-secondary/20 shadow-sm">
          <DoorOpen className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-outline">
            Lượt mở hôm nay
          </p>
          <p className="text-2xl font-extrabold tracking-tight text-on-surface">
            {doorOpensOnline}
          </p>
          {doorOpensOffline > 0 ? (
            <p className="text-[11px] font-medium text-warning">
              +{doorOpensOffline} từ log offline
            </p>
          ) : (
            <p className="text-[11px] text-outline">Thời gian thực</p>
          )}
        </div>
      </div>

      {/* Thẻ 2: Cảnh báo hôm nay */}
      <div className="flex items-center gap-4 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-sm transition-shadow hover:shadow-md">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-error-container/40 text-error dark:text-rose-400 border border-error/20 shadow-sm">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-outline">
            Cảnh báo hôm nay
          </p>
          <p className="text-2xl font-extrabold tracking-tight text-on-surface">
            {alertsOnline}
          </p>
          {alertsOffline > 0 ? (
            <p className="text-[11px] font-medium text-warning">
              +{alertsOffline} từ log offline
            </p>
          ) : (
            <p className="text-[11px] text-outline">An ninh trong ngày</p>
          )}
        </div>
      </div>

      {/* Thẻ 3: Trạng thái kết nối */}
      <div className="flex items-center gap-4 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-sm transition-shadow hover:shadow-md">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border shadow-sm ${
            connectionState === 'online' && isClientConnected
              ? 'bg-primary-fixed/40 text-primary border-primary/20'
              : 'bg-surface-container-high text-outline border-outline-variant/40'
          }`}
        >
          {connectionState === 'online' && isClientConnected ? (
            <Wifi className="h-6 w-6" />
          ) : (
            <WifiOff className="h-6 w-6" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-outline">
            Trạng thái kết nối
          </p>
          <p className={`text-base font-extrabold tracking-tight truncate ${connectionColor}`}>
            {connectionTitle}
          </p>
          <p className="text-[11px] text-outline truncate">
            Chế độ:{' '}
            <span
              className={
                isLockdown
                  ? 'font-bold text-error'
                  : 'font-semibold text-on-surface-variant'
              }
            >
              {isLockdown ? 'Đang khóa chặt' : 'Bình thường'}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};
