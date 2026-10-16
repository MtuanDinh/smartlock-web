import React from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  ShieldAlert,
  CircleDot,
  Globe,
  Cpu,
  CheckCircle2,
} from 'lucide-react';
import { useRecentLogs } from '../../hooks/useLogs';
import { getLogMeta, type LogIconName } from '../../lib/logMeta';
import {
  formatFullDateTimeVN,
  formatRelativeTimeVN,
} from '../../lib/time';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { Tooltip } from '../../components/ui/Tooltip';

function renderLogIcon(iconName: LogIconName) {
  switch (iconName) {
    case 'ShieldAlert':
      return <ShieldAlert className="h-4 w-4" />;
    case 'CircleDot':
      return <CircleDot className="h-4 w-4" />;
    case 'Globe':
      return <Globe className="h-4 w-4" />;
    case 'Cpu':
      return <Cpu className="h-4 w-4" />;
    default:
      return <CheckCircle2 className="h-4 w-4" />;
  }
}

const iconCircleTone: Record<string, string> = {
  danger: 'bg-rose-500/15 text-rose-500 border-rose-500/30',
  muted: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  primary: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
  info: 'bg-cyan-500/15 text-cyan-500 border-cyan-500/30',
  success: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
};

type ActivityFilter = 'all' | 'door_open' | 'alert';

export const RecentActivity: React.FC = () => {
  const { recentLogs, isLoading } = useRecentLogs(8);
  const [filter, setFilter] = React.useState<ActivityFilter>('all');

  const filteredLogs = React.useMemo(() => {
    return recentLogs
      .filter((log) => {
        const meta = getLogMeta(log.action);
        if (filter === 'door_open') return meta.isDoorOpen;
        if (filter === 'alert') return meta.category === 'alert';
        return true;
      })
      .slice(0, 5);
  }, [recentLogs, filter]);

  return (
    <div className="flex flex-col rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm overflow-hidden">
      {/* Header with Title and Filter Chips */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/30 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-2 font-bold text-on-surface">
          <Activity className="h-5 w-5 text-primary" />
          <span className="text-base">Hoạt động mới nhất</span>
        </div>

        {/* 3 Quick Filter Chips */}
        <div className="flex items-center gap-1 rounded-full border border-outline-variant/30 bg-surface-container-low/80 p-0.5">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
              filter === 'all'
                ? 'bg-primary-container text-white shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Tất cả
          </button>
          <button
            type="button"
            onClick={() => setFilter('door_open')}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
              filter === 'door_open'
                ? 'bg-primary-container text-white shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Mở cửa
          </button>
          <button
            type="button"
            onClick={() => setFilter('alert')}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
              filter === 'alert'
                ? 'bg-primary-container text-white shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Cảnh báo
          </button>
        </div>
      </div>

      {/* Activity Timeline List */}
      <div className="flex-1 p-5 sm:p-6">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredLogs.length === 0 ? (
          <EmptyState
            icon={<Activity className="h-8 w-8 text-outline" />}
            title="Chưa có hoạt động phù hợp"
            description="Lịch sử đóng mở cửa và cảnh báo sẽ xuất hiện tại đây theo thời gian thực."
          />
        ) : (
          <ol className="relative border-l border-outline-variant/40 ml-4 space-y-5">
            {filteredLogs.map((log) => {
              const meta = getLogMeta(log.action);
              return (
                <li key={log.id} className="ml-6">
                  <span
                    className={`absolute -left-4 flex h-8 w-8 items-center justify-center rounded-full border shadow-sm ${
                      iconCircleTone[meta.colorVariant]
                    }`}
                  >
                    {renderLogIcon(meta.iconName)}
                  </span>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-bold text-on-surface">
                        {meta.cleanActionText}
                      </span>
                      {meta.isOfflineSync && (
                        <span className="inline-flex items-center rounded-full border border-warning/40 bg-warning-container/30 px-2 py-0.5 text-[10px] font-bold text-warning">
                          Offline
                        </span>
                      )}
                    </div>

                    <Tooltip content={formatFullDateTimeVN(log.timestamp)}>
                      <time className="cursor-help text-xs font-medium text-outline">
                        {formatRelativeTimeVN(log.timestamp)}
                      </time>
                    </Tooltip>
                  </div>

                  <p className="mt-0.5 text-xs text-on-surface-variant">
                    {meta.isSystemLog ? (
                      <>
                        <span className="text-outline">Chi tiết: </span>
                        <span className="font-medium text-on-surface">
                          {log.user || 'Không rõ'}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-outline">Thực hiện: </span>
                        <span className="font-semibold text-on-surface">
                          {log.user || 'Không rõ'}
                        </span>
                      </>
                    )}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* Footer Link to All Logs */}
      <div className="border-t border-outline-variant/30 bg-surface-container-low/40 px-5 py-3 sm:px-6">
        <Link
          to="/logs"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
        >
          <span>Xem tất cả nhật ký sự kiện</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
};
