import React, { useMemo } from 'react';
import {
  Database,
  Search,
  X,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  CircleDot,
  Globe,
  Cpu,
  CheckCircle2,
  DownloadCloud,
} from 'lucide-react';
import { useLogs } from '../../hooks/useLogs';
import { getLogMeta, matchesLogFilterChip, type LogIconName } from '../../lib/logMeta';
import { formatTimeVN } from '../../lib/time';
import { QuickStats } from '../dashboard/QuickStats';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import type { LogFilterChip } from '../../types';

const FILTER_CHIPS: Array<{ id: LogFilterChip; label: string }> = [
  { id: 'all', label: 'Tất cả' },
  { id: 'door_open', label: 'Mở cửa' },
  { id: 'alert', label: 'Cảnh báo' },
  { id: 'button', label: 'Nút bấm' },
  { id: 'web', label: 'Qua Web' },
  { id: 'system', label: 'Hệ thống' },
];

function renderLogIcon(iconName: LogIconName) {
  switch (iconName) {
    case 'ShieldAlert':
      return <ShieldAlert className="h-4 w-4 shrink-0" />;
    case 'CircleDot':
      return <CircleDot className="h-4 w-4 shrink-0" />;
    case 'Globe':
      return <Globe className="h-4 w-4 shrink-0" />;
    case 'Cpu':
      return <Cpu className="h-4 w-4 shrink-0" />;
    default:
      return <CheckCircle2 className="h-4 w-4 shrink-0" />;
  }
}

const textColorByVariant: Record<string, string> = {
  danger: 'text-error dark:text-rose-400',
  muted: 'text-on-surface-variant',
  primary: 'text-primary',
  info: 'text-tertiary dark:text-purple-400',
  success: 'text-secondary dark:text-emerald-400',
};

export const LogsPage: React.FC = () => {
  const {
    allLogs,
    isLoading,
    limit,
    hasMoreToLoad,
    loadMore,
    searchTerm,
    setSearchTerm,
    activeChip,
    setActiveChip,
    currentPage,
    setCurrentPage,
    totalPages,
    totalLogs,
    startIndex,
    endIndex,
    paginatedGroups,
    todayStats,
  } = useLogs();

  // Đếm số lượng thực tế cho từng chip lọc
  const chipCounts = useMemo(() => {
    const counts: Record<LogFilterChip, number> = {
      all: allLogs.length,
      door_open: 0,
      alert: 0,
      button: 0,
      web: 0,
      system: 0,
    };
    for (const log of allLogs) {
      const meta = getLogMeta(log.action);
      if (matchesLogFilterChip(meta, 'door_open')) counts.door_open++;
      if (matchesLogFilterChip(meta, 'alert')) counts.alert++;
      if (matchesLogFilterChip(meta, 'button')) counts.button++;
      if (matchesLogFilterChip(meta, 'web')) counts.web++;
      if (matchesLogFilterChip(meta, 'system')) counts.system++;
    }
    return counts;
  }, [allLogs]);

  // Danh sách số trang rút gọn
  const getPageNumbers = () => {
    const pages: Array<number | 'ellipsis-start' | 'ellipsis-end'> = [];
    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= currentPage - 1 && i <= currentPage + 1)
      ) {
        pages.push(i);
      } else if (i === currentPage - 2) {
        pages.push('ellipsis-start');
      } else if (i === currentPage + 2) {
        pages.push('ellipsis-end');
      }
    }
    return pages;
  };

  return (
    <div className="space-y-6">
      {/* 1. 3 Thẻ KPI trên cùng (Đồng bộ chuẩn với Dashboard) */}
      <QuickStats
        doorOpensOnline={todayStats.doorOpensOnline}
        doorOpensOffline={todayStats.doorOpensOffline}
        alertsOnline={todayStats.alertsOnline}
        alertsOffline={todayStats.alertsOffline}
      />

      {/* 2. Khung Quản lý Nhật ký Sự kiện */}
      <div className="card-glass rounded-2xl overflow-hidden shadow-sm animate-stagger-2">
        {/* Header & Thanh công cụ */}
        <div className="border-b border-outline-variant/30 bg-surface-container-low/20 p-5 sm:px-6 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-container text-white shadow-sm shadow-blue-500/25">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-extrabold tracking-tight text-on-surface">
                  Nhật ký Truy cập &amp; Lịch sử Sự kiện
                </h1>
                <p className="text-xs text-on-surface-variant">
                  Đang nạp tối đa {limit} sự kiện gần nhất từ Firebase Realtime Database
                </p>
              </div>
            </div>

            {/* Thanh tìm kiếm & Nút Tải thêm */}
            <div className="flex items-center gap-2.5">
              <div className="relative flex-1 sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-outline" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Tìm sự kiện, tên, ngày..."
                  aria-label="Tìm kiếm nhật ký"
                  className="min-h-[38px] w-full rounded-xl border border-outline-variant/40 bg-surface-container-low pl-8 pr-8 py-1.5 text-xs text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
                {searchTerm ? (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    aria-label="Xóa từ khóa tìm kiếm"
                    className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-lg text-outline hover:text-on-surface"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-outline-variant/40 bg-surface-container-high/60 px-1.5 py-0.5 text-[10px] font-mono text-outline font-semibold">
                    /
                  </span>
                )}
              </div>

              {hasMoreToLoad && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={loadMore}
                  className="rounded-xl text-xs py-1.5"
                  leftIcon={<DownloadCloud className="h-3.5 w-3.5" />}
                >
                  +500
                </Button>
              )}
            </div>
          </div>

          {/* Dải 6 Chip Lọc Nhanh (Kèm số đếm thực tế) */}
          <div
            role="tablist"
            aria-label="Lọc theo loại sự kiện"
            className="flex flex-wrap items-center gap-1.5"
          >
            {FILTER_CHIPS.map((chip) => {
              const isSelected = activeChip === chip.id;
              const count = chipCounts[chip.id];
              return (
                <button
                  key={chip.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setActiveChip(chip.id)}
                  className={`rounded-full px-3.5 py-1 text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-primary-container text-white shadow-sm shadow-blue-500/20'
                      : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  {chip.label} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Danh sách bản ghi */}
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <Skeleton key={idx} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : paginatedGroups.length === 0 ? (
          <div className="py-12">
            <EmptyState
              icon={<Database className="h-10 w-10 text-outline" />}
              title="Không tìm thấy bản ghi nào"
              description="Thử thay đổi từ khóa tìm kiếm hoặc chọn bộ lọc sự kiện khác."
              action={
                searchTerm || activeChip !== 'all' ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSearchTerm('');
                      setActiveChip('all');
                    }}
                  >
                    Xóa bộ lọc
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div key={`${activeChip}-${currentPage}`} className="animate-tab-switch">
            {/* Mobile View (< 768px): Grouped Cards */}
            <div className="md:hidden">
              {paginatedGroups.map((group) => (
                <div key={group.dateKey}>
                  <div className="flex items-center gap-2 border-y border-outline-variant/30 bg-surface-container-low/60 px-4 py-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant/40 bg-surface-container-high/80 px-2.5 py-0.5 text-[11px] font-bold text-on-surface shadow-xs">
                      <Calendar className="h-3 w-3 text-primary" />
                      <span>Ngày: {group.dateKey}</span>
                    </span>
                  </div>
                  <div className="divide-y divide-outline-variant/20">
                    {group.items.map(({ log, index }) => {
                      const meta = getLogMeta(log.action);
                      return (
                        <div key={log.id} className="p-4 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-mono text-outline">
                              #{index} &bull; {formatTimeVN(log.timestamp)}
                            </span>
                            {meta.isOfflineSync && (
                              <span className="inline-flex items-center rounded-full border border-warning/40 bg-warning-container/30 px-2 py-0.5 text-[10px] font-bold text-warning">
                                Offline
                              </span>
                            )}
                          </div>

                          <div
                            className={`flex items-center gap-2 text-sm font-bold ${
                              textColorByVariant[meta.colorVariant]
                            }`}
                          >
                            {renderLogIcon(meta.iconName)}
                            <span>{meta.cleanActionText}</span>
                          </div>

                          <div className="text-xs text-on-surface-variant">
                            {meta.isSystemLog ? (
                              <>
                                <span className="text-outline">Chi tiết: </span>
                                <span className="font-semibold text-on-surface">
                                  {log.user || 'Không rõ'}
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="text-outline">Thực hiện: </span>
                                <span className="font-bold text-on-surface">
                                  {log.user || 'Không rõ'}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop View (>= 768px): Data Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-outline-variant/30 bg-surface-container-low/60 text-xs font-bold uppercase tracking-wider text-outline">
                    <th className="py-3.5 pl-6 pr-3 w-20">STT</th>
                    <th className="px-4 py-3.5 w-36">Giờ</th>
                    <th className="px-4 py-3.5">Loại Sự Kiện</th>
                    <th className="py-3.5 pl-4 pr-6">Thành Viên / Nguồn Thực Hiện</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {paginatedGroups.map((group) => (
                    <React.Fragment key={group.dateKey}>
                      <tr className="bg-surface-container-low/40">
                        <td
                          colSpan={4}
                          className="border-y border-outline-variant/30 py-2.5 pl-6 pr-4"
                        >
                          <span className="inline-flex items-center gap-2 rounded-full border border-outline-variant/40 bg-surface-container-high/80 px-3 py-1 text-xs font-bold text-on-surface shadow-xs">
                            <Calendar className="h-3.5 w-3.5 text-primary" />
                            <span>Ngày: {group.dateKey}</span>
                          </span>
                        </td>
                      </tr>
                      {group.items.map(({ log, index }) => {
                        const meta = getLogMeta(log.action);
                        return (
                          <tr
                            key={log.id}
                            className="transition-colors hover:bg-primary/[0.04]"
                          >
                            <td className="py-3.5 pl-6 pr-3 font-mono text-xs font-bold text-outline align-middle">
                              {index}
                            </td>
                            <td className="px-4 py-3.5 font-mono text-xs text-on-surface whitespace-nowrap align-middle">
                              {formatTimeVN(log.timestamp)}
                            </td>
                            <td className="px-4 py-3.5 align-middle">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`inline-flex items-center gap-2 font-semibold ${
                                    textColorByVariant[meta.colorVariant]
                                  }`}
                                >
                                  {renderLogIcon(meta.iconName)}
                                  <span>{meta.cleanActionText}</span>
                                </span>
                                {meta.isOfflineSync && (
                                  <span className="inline-flex items-center rounded-full border border-warning/40 bg-warning-container/30 px-2 py-0.5 text-[10px] font-bold text-warning">
                                    Offline
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 pl-4 pr-6 align-middle">
                              {meta.isSystemLog ? (
                                <span className="inline-flex items-center gap-1.5 text-xs">
                                  <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-semibold text-outline">
                                    Chi tiết
                                  </span>
                                  <span className="font-medium text-on-surface">
                                    {log.user || 'Không rõ'}
                                  </span>
                                </span>
                              ) : (
                                <span className="font-bold text-on-surface">
                                  {log.user || 'Không rõ'}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer: Phân trang & Thống kê số lượng */}
        <div className="flex flex-col items-center justify-between gap-4 border-t border-outline-variant/30 bg-surface-container-low/40 px-5 py-4 sm:flex-row sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-on-surface-variant">
              Hiển thị {startIndex} – {endIndex} trên tổng {totalLogs} sự kiện
            </span>
          </div>

          {totalPages > 1 && (
            <nav
              aria-label="Phân trang nhật ký"
              className="flex items-center gap-1"
            >
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
                aria-label="Trang trước"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-outline-variant/40 bg-surface-container-lowest text-on-surface disabled:opacity-40 disabled:pointer-events-none hover:bg-surface-container-high transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {getPageNumbers().map((item) => {
                if (typeof item === 'string') {
                  return (
                    <span
                      key={item}
                      className="px-2 text-xs font-bold text-outline"
                    >
                      …
                    </span>
                  );
                }
                const active = item === currentPage;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCurrentPage(item)}
                    aria-current={active ? 'page' : undefined}
                    className={`inline-flex h-8 min-w-[32px] items-center justify-center rounded-lg px-2 text-xs font-bold transition-all ${
                      active
                        ? 'bg-primary-container text-white shadow-sm shadow-blue-500/20'
                        : 'border border-outline-variant/40 bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    {item}
                  </button>
                );
              })}

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
                aria-label="Trang tiếp theo"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-outline-variant/40 bg-surface-container-lowest text-on-surface disabled:opacity-40 disabled:pointer-events-none hover:bg-surface-container-high transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </nav>
          )}
        </div>
      </div>
    </div>
  );
};
