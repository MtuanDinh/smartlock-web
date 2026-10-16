import React from 'react';
import { DoorOpen, ShieldAlert, Wifi, WifiOff } from 'lucide-react';
import { Card } from '../../components/ui/Card';
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
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
      {/* Thẻ 1: Lượt mở hôm nay */}
      <Card className="flex items-center gap-4 p-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
          <DoorOpen className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-text-secondary">
            Lượt mở hôm nay
          </p>
          <p className="text-2xl font-extrabold text-text-primary">
            {doorOpensOnline}
          </p>
          {doorOpensOffline > 0 ? (
            <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
              +{doorOpensOffline} từ log offline
            </p>
          ) : (
            <p className="text-[11px] text-text-muted">Thời gian thực</p>
          )}
        </div>
      </Card>

      {/* Thẻ 2: Cảnh báo hôm nay */}
      <Card className="flex items-center gap-4 p-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-500 border border-rose-500/30">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-text-secondary">
            Cảnh báo hôm nay
          </p>
          <p className="text-2xl font-extrabold text-text-primary">
            {alertsOnline}
          </p>
          {alertsOffline > 0 ? (
            <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
              +{alertsOffline} từ log offline
            </p>
          ) : (
            <p className="text-[11px] text-text-muted">An ninh trong ngày</p>
          )}
        </div>
      </Card>

      {/* Thẻ 3: Trạng thái kết nối */}
      <Card className="flex items-center gap-4 p-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${
            connectionState === 'online' && isClientConnected
              ? 'bg-blue-500/15 text-blue-500 border-blue-500/30'
              : 'bg-slate-500/15 text-slate-400 border-slate-500/30'
          }`}
        >
          {connectionState === 'online' && isClientConnected ? (
            <Wifi className="h-6 w-6" />
          ) : (
            <WifiOff className="h-6 w-6" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-text-secondary">
            Trạng thái kết nối
          </p>
          <p className={`text-base font-extrabold truncate ${connectionColor}`}>
            {connectionTitle}
          </p>
          <p className="text-[11px] text-text-muted truncate">
            Chế độ:{' '}
            <span
              className={
                isLockdown
                  ? 'font-bold text-rose-500'
                  : 'font-semibold text-text-secondary'
              }
            >
              {isLockdown ? 'Đang khóa chặt' : 'Bình thường'}
            </span>
          </p>
        </div>
      </Card>
    </div>
  );
};
