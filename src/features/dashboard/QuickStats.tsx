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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 animate-stagger-1">
      {/* Thẻ 1: Lượt mở hôm nay */}
      <div className="card-glass card-glass-interactive kpi-glass-emerald rounded-2xl p-5 relative overflow-hidden group flex items-center justify-between gap-4">
        {/* Top Luminous Refraction Hairline */}
        <div
          className="pointer-events-none absolute inset-x-6 top-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/75 to-transparent opacity-80 group-hover:opacity-100 transition-opacity"
          aria-hidden="true"
        />
        {/* Subtle Glass Watermark Icon */}
        <DoorOpen
          className="pointer-events-none absolute -right-3 -bottom-3 h-24 w-24 text-emerald-500/[0.06] dark:text-emerald-400/[0.07] -rotate-12 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-500"
          aria-hidden="true"
        />

        <div className="flex items-center gap-4 min-w-0 relative z-10">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 via-emerald-500/10 to-teal-500/5 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-md shadow-emerald-500/10 ring-1 ring-white/50 dark:ring-white/10 group-hover:scale-105 transition-transform duration-300">
            <DoorOpen className="h-6 w-6 drop-shadow-xs" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant/80">
              Lượt mở hôm nay
            </p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <p className="text-3xl font-extrabold tracking-tight font-mono text-on-surface">
                {doorOpensOnline}
              </p>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-1.5 py-0.5">
                24H
              </span>
            </div>
            {doorOpensOffline > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning-container/40 px-2 py-0.5 text-[10px] font-bold text-warning mt-1">
                +{doorOpensOffline} từ offline
              </span>
            ) : (
              <p className="text-[11px] font-medium text-outline mt-0.5">
                Thời gian thực
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Thẻ 2: Cảnh báo hôm nay */}
      <div className="card-glass card-glass-interactive kpi-glass-rose rounded-2xl p-5 relative overflow-hidden group flex items-center justify-between gap-4">
        {/* Top Luminous Refraction Hairline */}
        <div
          className="pointer-events-none absolute inset-x-6 top-0 h-[2px] bg-gradient-to-r from-transparent via-rose-500/75 to-transparent opacity-80 group-hover:opacity-100 transition-opacity"
          aria-hidden="true"
        />
        {/* Subtle Glass Watermark Icon */}
        <ShieldAlert
          className="pointer-events-none absolute -right-3 -bottom-3 h-24 w-24 text-rose-500/[0.06] dark:text-rose-400/[0.07] -rotate-12 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-500"
          aria-hidden="true"
        />

        <div className="flex items-center gap-4 min-w-0 relative z-10">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500/20 via-rose-500/10 to-red-500/5 text-rose-600 dark:text-rose-400 border border-rose-500/30 shadow-md shadow-rose-500/10 ring-1 ring-white/50 dark:ring-white/10 group-hover:scale-105 transition-transform duration-300">
            <ShieldAlert className="h-6 w-6 drop-shadow-xs" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant/80">
              Cảnh báo an ninh
            </p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <p className="text-3xl font-extrabold tracking-tight font-mono text-on-surface">
                {alertsOnline}
              </p>
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-md px-1.5 py-0.5">
                BẢO VỆ
              </span>
            </div>
            {alertsOffline > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning-container/40 px-2 py-0.5 text-[10px] font-bold text-warning mt-1">
                +{alertsOffline} từ offline
              </span>
            ) : (
              <p className="text-[11px] font-medium text-outline mt-0.5">
                An ninh trong ngày
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Thẻ 3: Trạng thái kết nối */}
      <div className="card-glass card-glass-interactive kpi-glass-blue rounded-2xl p-5 relative overflow-hidden group flex items-center justify-between gap-4">
        {/* Top Luminous Refraction Hairline */}
        <div
          className="pointer-events-none absolute inset-x-6 top-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500/75 to-transparent opacity-80 group-hover:opacity-100 transition-opacity"
          aria-hidden="true"
        />
        {/* Subtle Glass Watermark Icon */}
        {connectionState === 'online' && isClientConnected ? (
          <Wifi
            className="pointer-events-none absolute -right-3 -bottom-3 h-24 w-24 text-blue-500/[0.06] dark:text-blue-400/[0.07] -rotate-12 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-500"
            aria-hidden="true"
          />
        ) : (
          <WifiOff
            className="pointer-events-none absolute -right-3 -bottom-3 h-24 w-24 text-slate-500/[0.06] dark:text-slate-400/[0.07] -rotate-12 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-500"
            aria-hidden="true"
          />
        )}

        <div className="flex items-center gap-4 min-w-0 relative z-10">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border shadow-md ring-1 ring-white/50 dark:ring-white/10 group-hover:scale-105 transition-transform duration-300 ${
              connectionState === 'online' && isClientConnected
                ? 'bg-gradient-to-br from-blue-500/20 via-blue-500/10 to-indigo-500/5 text-primary border-primary/30 shadow-blue-500/10'
                : 'bg-gradient-to-br from-slate-500/20 via-slate-500/10 to-slate-500/5 text-on-surface-variant border-outline-variant/50 shadow-slate-500/10'
            }`}
          >
            {connectionState === 'online' && isClientConnected ? (
              <Wifi className="h-6 w-6 drop-shadow-xs" />
            ) : (
              <WifiOff className="h-6 w-6 drop-shadow-xs" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant/80">
              Trạng thái kết nối
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    connectionState === 'online' && isClientConnected
                      ? 'bg-emerald-400'
                      : !isClientConnected
                        ? 'bg-amber-400'
                        : 'bg-rose-400'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                    connectionState === 'online' && isClientConnected
                      ? 'bg-emerald-500'
                      : !isClientConnected
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                  }`}
                />
              </span>
              <p className={`text-base font-extrabold tracking-tight truncate ${connectionColor}`}>
                {connectionTitle}
              </p>
            </div>
            <p className="text-[11px] text-outline truncate mt-0.5">
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
    </div>
  );
};
