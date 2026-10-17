import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFirebaseContext } from '../app/providers/FirebaseProvider';
import { useDebounce } from './useDebounce';
import { getLogMeta, matchesLogFilterChip } from '../lib/logMeta';
import {
  groupLogsByDate,
  isSameDayLocal,
  matchesLogSearch,
} from '../lib/time';
import type { LogEntry, LogFilterChip } from '../types';

export const DEFAULT_LOGS_BATCH_SIZE = 500;
export const LOGS_PER_PAGE = 15;

export function useRecentLogs(count: number = 5) {
  const { service, authUser } = useFirebaseContext();
  const [recentLogs, setRecentLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!service || !authUser) {
      setRecentLogs([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const unsub = service.subscribeRecentLogs(count, (list) => {
      setRecentLogs(list);
      setIsLoading(false);
    });
    return () => {
      unsub();
    };
  }, [service, authUser, count]);

  return { recentLogs, isLoading };
}

export function useLogs(initialLimit: number = DEFAULT_LOGS_BATCH_SIZE) {
  const { service, authUser } = useFirebaseContext();
  const [allLogs, setAllLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [limit, setLimit] = useState<number>(initialLimit);

  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 250);
  const [activeChip, setActiveChip] = useState<LogFilterChip>('all');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!service || !authUser) {
      setAllLogs([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const unsub = service.subscribeLogs(limit, (list) => {
      setAllLogs(list);
      setIsLoading(false);
    });
    return () => {
      unsub();
    };
  }, [service, authUser, limit]);

  // Reset về trang 1 khi đổi từ khóa tìm kiếm hoặc chip lọc
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, activeChip]);

  const filteredLogs = useMemo(() => {
    return allLogs.filter((log) => {
      const meta = getLogMeta(log.action);
      if (!matchesLogFilterChip(meta, activeChip)) {
        return false;
      }
      return matchesLogSearch(log, debouncedSearch);
    });
  }, [allLogs, activeChip, debouncedSearch]);

  const totalLogs = filteredLogs.length;
  const totalPages = Math.max(1, Math.ceil(totalLogs / LOGS_PER_PAGE));

  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * LOGS_PER_PAGE;
  const endIndex = Math.min(startIndex + LOGS_PER_PAGE, totalLogs);

  const paginatedGroups = useMemo(() => {
    const slice = filteredLogs.slice(startIndex, endIndex);
    return groupLogsByDate(slice, startIndex);
  }, [filteredLogs, startIndex, endIndex]);

  // Thống kê hôm nay (tách riêng số đếm thực tế và số đếm từ log offline đồng bộ muộn)
  const todayStats = useMemo(() => {
    const now = Date.now();
    let doorOpensOnline = 0;
    let doorOpensOffline = 0;
    let alertsOnline = 0;
    let alertsOffline = 0;

    for (const log of allLogs) {
      if (!isSameDayLocal(log.timestamp, now)) continue;
      const meta = getLogMeta(log.action);

      if (meta.isDoorOpen) {
        if (meta.isOfflineSync) {
          doorOpensOffline += 1;
        } else {
          doorOpensOnline += 1;
        }
      }

      if (meta.category === 'alert') {
        if (meta.isOfflineSync) {
          alertsOffline += 1;
        } else {
          alertsOnline += 1;
        }
      }
    }

    return {
      doorOpensOnline,
      doorOpensOffline,
      alertsOnline,
      alertsOffline,
    };
  }, [allLogs]);

  const loadMore = useCallback(() => {
    setLimit((prev) => prev + DEFAULT_LOGS_BATCH_SIZE);
  }, []);

  const hasMoreToLoad = allLogs.length >= limit;

  return {
    allLogs,
    filteredLogs,
    isLoading,
    limit,
    hasMoreToLoad,
    loadMore,
    searchTerm,
    setSearchTerm,
    activeChip,
    setActiveChip,
    currentPage: safeCurrentPage,
    setCurrentPage,
    totalPages,
    totalLogs,
    startIndex: totalLogs === 0 ? 0 : startIndex + 1,
    endIndex,
    paginatedGroups,
    todayStats,
  };
}
