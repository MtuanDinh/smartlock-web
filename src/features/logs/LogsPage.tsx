import React from 'react';
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
import { getLogMeta, type LogIconName } from '../../lib/logMeta';
import { formatTimeVN } from '../../lib/time';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
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
  danger: 'text-rose-600 dark:text-rose-400',
  muted: 'text-text-secondary',
  primary: 'text-blue-600 dark:text-blue-400',
  info: 'text-cyan-600 dark:text-cyan-400',
  success: 'text-emerald-600 dark:text-emerald-400',
};

export const LogsPage: React.FC = () => {
  const {
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
  } = useLogs();

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
      <Card noPadding className="overflow-hidden">
        {/* Header & Thanh tìm kiếm */}
        <div className="border-b border-border-subtle p-5 sm:px-6 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-500 border border-cyan-500/30">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-extrabold text-text-primary">
                  Dữ liệu truy cập
                </h1>
                <p className="text-xs text-text-secondary">
                  Đang nạp tối đa {limit} sự kiện gần nhất
                </p>
              </div>
            </div>

            {/* Ô tìm kiếm (có debounce 250ms) */}
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm sự kiện, tên, ngày (DD/MM/YYYY)..."
                aria-label="Tìm kiếm nhật ký hoạt động"
                className="min-h-[42px] w-full rounded-xl border border-border-strong bg-bg-elevated pl-10 pr-9 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  aria-label="Xóa từ khóa tìm kiếm"
                  className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-lg text-text-muted hover:bg-bg-secondary hover:text-text-primary"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Hàng Chip lọc nhanh */}
          <div
            role="tablist"
            aria-label="Lọc theo loại sự kiện"
            className="flex flex-wrap items-center gap-2"
          >
            {FILTER_CHIPS.map((chip) => {
              const isSelected = activeChip === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setActiveChip(chip.id)}
                  className={`min-h-[36px] rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'border border-border-strong bg-bg-elevated text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Nội dung danh sách nhật ký */}
        {isLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <Skeleton key={idx} className="h-14 w-full" />
            ))}
          </div>
        ) : paginatedGroups.length === 0 ? (
          <EmptyState
            icon={<Database className="h-8 w-8" />}
            title="Không tìm thấy bản ghi nào"
            description="Thử thay đổi từ khóa tìm kiếm hoặc chọn bộ lọc sự kiện khác."
          />
        ) : (
          <div>
            {/* Mobile View (< 768px): Grouped Cards */}
            <div className="md:hidden">
              {paginatedGroups.map((group) => (
                <div key={group.dateKey}>
                  <div className="sticky top-16 z-20 flex items-center gap-2 border-y border-border-subtle bg-bg-elevated/95 px-4 py-2 text-xs font-bold text-text-primary backdrop-blur-sm">
                    <Calendar className="h-3.5 w-3.5 text-blue-500" />
                    <span>Ngày: {group.dateKey}</span>
                  </div>
                  <div className="divide-y divide-border-subtle">
                    {group.items.map(({ log, index }) => {
                      const meta = getLogMeta(log.action);
                      return (
                        <div key={log.id} className="p-4 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-mono text-text-muted">
                              #{index} &bull; {formatTimeVN(log.timestamp)}
                            </span>
                            {meta.isOfflineSync && (
                              <Badge variant="warning">Offline</Badge>
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

                          <div className="text-xs text-text-secondary">
                            {meta.isSystemLog ? (
                              <>
                                <span className="font-semibold text-text-muted">
                                  Chi tiết:{' '}
                                </span>
                                <span className="font-semibold text-text-primary">
                                  {log.user || 'Không rõ'}
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="text-text-muted">
                                  Thành viên:{' '}
                                </span>
                                <span className="font-bold text-text-primary">
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

            {/* Desktop View (>= 768px): Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border-subtle bg-bg-primary/50 text-xs font-bold uppercase tracking-wider text-text-secondary">
                    <th className="py-3.5 pl-6 pr-3 w-20">STT</th>
                    <th className="px-4 py-3.5 w-36">Giờ</th>
                    <th className="px-4 py-3.5">Sự kiện</th>
                    <th className="py-3.5 pl-4 pr-6">Thành viên / Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {paginatedGroups.map((group) => (
                    <React.Fragment key={group.dateKey}>
                      <tr className="bg-bg-elevated/90">
                        <td
                          colSpan={4}
                          className="sticky top-16 z-10 border-y border-border-subtle bg-bg-elevated/95 py-2.5 pl-6 pr-4 text-xs font-bold text-text-primary backdrop-blur-sm"
                        >
                          <span className="inline-flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5 text-blue-500" />
                            <span>Ngày: {group.dateKey}</span>
                          </span>
                        </td>
                      </tr>
                      {group.items.map(({ log, index }) => {
                        const meta = getLogMeta(log.action);
                        return (
                          <tr
                            key={log.id}
                            className="transition-colors hover:bg-bg-elevated/40"
                          >
                            <td className="py-3.5 pl-6 pr-3 font-mono text-xs font-bold text-text-muted">
                              {index}
                            </td>
                            <td className="px-4 py-3.5 font-mono text-xs text-text-primary whitespace-nowrap">
                              {formatTimeVN(log.timestamp)}
                            </td>
                            <td className="px-4 py-3.5">
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
                                  <Badge variant="warning">Offline</Badge>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 pl-4 pr-6">
                              {meta.isSystemLog ? (
                                <span className="inline-flex items-center gap-1.5 text-xs">
                                  <Badge variant="info">Chi tiết</Badge>
                                  <span className="font-medium text-text-primary">
                                    {log.user || 'Không rõ'}
                                  </span>
                                </span>
                              ) : (
                                <span className="font-bold text-text-primary">
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

        {/* Footer: Phân trang & Tải thêm */}
        <div className="flex flex-col items-center justify-between gap-4 border-t border-border-subtle bg-bg-primary/40 px-5 py-4 sm:flex-row sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-text-secondary">
              Hiển thị {startIndex} – {endIndex} / Tổng {totalLogs} sự kiện
            </span>
            {hasMoreToLoad && (
              <Button
                variant="secondary"
                size="sm"
                onClick={loadMore}
                leftIcon={<DownloadCloud className="h-3.5 w-3.5" />}
              >
                Tải thêm lịch sử (+500)
              </Button>
            )}
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
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border-strong bg-bg-elevated text-text-primary disabled:opacity-40 disabled:pointer-events-none hover:bg-border-subtle"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {getPageNumbers().map((item) => {
                if (typeof item === 'string') {
                  return (
                    <span
                      key={item}
                      className="px-2 text-xs font-bold text-text-muted"
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
                    className={`inline-flex h-9 min-w-[36px] items-center justify-center rounded-lg px-2.5 text-xs font-bold transition-colors ${
                      active
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'border border-border-strong bg-bg-elevated text-text-secondary hover:text-text-primary'
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
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border-strong bg-bg-elevated text-text-primary disabled:opacity-40 disabled:pointer-events-none hover:bg-border-subtle"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </nav>
          )}
        </div>
      </Card>
    </div>
  );
};
