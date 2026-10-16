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
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
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

export const RecentActivity: React.FC = () => {
  const { recentLogs, isLoading } = useRecentLogs(5);

  return (
    <Card noPadding className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
        <div className="flex items-center gap-2 font-bold text-text-primary">
          <Activity className="h-5 w-5 text-cyan-500" />
          <span>Hoạt động mới nhất</span>
        </div>
        <Link
          to="/logs"
          className="inline-flex min-h-[36px] items-center gap-1 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-600 dark:text-cyan-400 transition-colors hover:bg-cyan-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <span>Xem hết</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="flex-1 p-5">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : recentLogs.length === 0 ? (
          <EmptyState
            icon={<Activity className="h-8 w-8" />}
            title="Chưa có hoạt động nào"
            description="Lịch sử đóng mở cửa và cảnh báo sẽ xuất hiện tại đây theo thời gian thực."
          />
        ) : (
          <ol className="relative border-l border-border-strong ml-4 space-y-5">
            {recentLogs.map((log) => {
              const meta = getLogMeta(log.action);
              return (
                <li key={log.id} className="ml-6">
                  <span
                    className={`absolute -left-4 flex h-8 w-8 items-center justify-center rounded-full border ${
                      iconCircleTone[meta.colorVariant]
                    }`}
                  >
                    {renderLogIcon(meta.iconName)}
                  </span>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-bold text-text-primary">
                        {meta.cleanActionText}
                      </span>
                      {meta.isOfflineSync && (
                        <Badge variant="warning">Offline</Badge>
                      )}
                    </div>

                    <Tooltip content={formatFullDateTimeVN(log.timestamp)}>
                      <time className="cursor-help text-xs font-medium text-text-muted">
                        {formatRelativeTimeVN(log.timestamp)}
                      </time>
                    </Tooltip>
                  </div>

                  <p className="mt-0.5 text-xs text-text-secondary">
                    {meta.isSystemLog ? (
                      <>
                        <span className="font-semibold text-text-muted">
                          Chi tiết:{' '}
                        </span>
                        <span className="font-medium text-text-primary">
                          {log.user || 'Không rõ'}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-text-muted">Thực hiện: </span>
                        <span className="font-semibold text-text-primary">
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
    </Card>
  );
};
