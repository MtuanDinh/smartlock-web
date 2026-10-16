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
      <div className="card-glass card-glass-interactive rounded-2xl p-5 relative overflow-hidden group flex items-center gap-4">
        <div className="pointer-events-none absolute -right-6 -bottom-6 h-28 w-28 rounded-full bg-emerald-500/10 blur-xl group-hover:bg-emerald-500/20 transition-all duration-300" aria-hidden="true" />
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary-container/30 text-secondary dark:text-emerald-400 border border-secondary/20 shadow-sm relative z-10">
          <DoorOpen className="h-6 w-6" />
        </div>
        <div className="min-w-0 relative z-10">
          <p className="text-[11px] font-bold uppercase tracking-wider text-outline">
            Lượt mở hôm nay
          </p>
          <p className="text-3xl font-extrabold tracking-tight font-mono text-on-surface">
            {doorOpensOnline}
          </p>
          {doorOpensOffline > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning-container/30 px-2 py-0.5 text-[10px] font-bold text-warning mt-0.5">
              +{doorOpensOffline} từ offline
            </span>
          ) : (
            <p className="text-[11px] font-medium text-outline">Thời gian thực</p>
          )}
        </div>
      </div>

      {/* Thẻ 2: Cảnh báo hôm nay */}
      <div className="card-glass card-glass-interactive rounded-2xl p-5 relative overflow-hidden group flex items-center gap-4">
        <div className="pointer-events-none absolute -right-6 -bottom-6 h-28 w-28 rounded-full bg-rose-500/10 blur-xl group-hover:bg-rose-500/20 transition-all duration-300" aria-hidden="true" />
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-error-container/40 text-error dark:text-rose-400 border border-error/20 shadow-sm relative z-10">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <div className="min-w-0 relative z-10">
          <p className="text-[11px] font-bold uppercase tracking-wider text-outline">
            Cảnh báo an ninh
          </p>
          <p className="text-3xl font-extrabold tracking-tight font-mono text-on-surface">
            {alertsOnline}
          </p>
          {alertsOffline > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning-container/30 px-2 py-0.5 text-[10px] font-bold text-warning mt-0.5">
              +{alertsOffline} từ offline
            </span>
          ) : (
            <p className="text-[11px] font-medium text-outline">An ninh trong ngày</p>
          )}
        </div>
      </div>

      {/* Thẻ 3: Trạng thái kết nối */}
      <div className="card-glass card-glass-interactive rounded-2xl p-5 relative overflow-hidden group flex items-center gap-4">
        <div className="pointer-events-none absolute -right-6 -bottom-6 h-28 w-28 rounded-full bg-blue-500/10 blur-xl group-hover:bg-blue-500/20 transition-all duration-300" aria-hidden="true" />
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border shadow-sm relative z-10 ${
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
        <div className="min-w-0 relative z-10">
          <p className="text-[11px] font-bold uppercase tracking-wider text-outline">
            Trạng thái kết nối
          </p>
          <div className="flex items-center gap-2">
            {connectionState === 'online' && isClientConnected && (
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            )}
            <p className={`text-base font-extrabold tracking-tight truncate ${connectionColor}`}>
              {connectionTitle}
            </p>
          </div>
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
