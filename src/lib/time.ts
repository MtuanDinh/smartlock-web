import type { LogEntry } from '../types';

export interface DateGroupedLogs {
  dateKey: string; // DD/MM/YYYY
  items: Array<{ log: LogEntry; index: number }>;
}

/**
 * Định dạng ngày chuẩn hóa DD/MM/YYYY (luôn có số 0 đệm đầu cho ngày và tháng)
 * để đảm bảo kết quả tìm kiếm khớp 100% với chuỗi hiển thị trên UI ở mọi trình duyệt.
 */
export function formatDateVN(timestamp?: number | null): string {
  if (!timestamp || !Number.isFinite(timestamp) || timestamp <= 0) {
    return 'Không rõ ngày';
  }
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) {
    return 'Không rõ ngày';
  }
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Định dạng ngày rút gọn D/M/YYYY (không đệm 0) để hỗ trợ tìm kiếm linh hoạt.
 */
export function formatDateShortVN(timestamp?: number | null): string {
  if (!timestamp || !Number.isFinite(timestamp) || timestamp <= 0) {
    return '';
  }
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

/**
 * Định dạng giờ HH:mm:ss (24h).
 */
export function formatTimeVN(timestamp?: number | null): string {
  if (!timestamp || !Number.isFinite(timestamp) || timestamp <= 0) {
    return '--:--:--';
  }
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) {
    return '--:--:--';
  }
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Định dạng ngày giờ đầy đủ HH:mm:ss DD/MM/YYYY cho Tooltip.
 */
export function formatFullDateTimeVN(timestamp?: number | null): string {
  if (!timestamp || !Number.isFinite(timestamp) || timestamp <= 0) {
    return 'Không rõ thời gian';
  }
  return `${formatTimeVN(timestamp)} ${formatDateVN(timestamp)}`;
}

/**
 * Định dạng thời gian tương đối tiếng Việt ("Vừa xong", "2 phút trước", "3 giờ trước"...).
 */
export function formatRelativeTimeVN(
  timestamp?: number | null,
  nowMs: number = Date.now()
): string {
  if (!timestamp || !Number.isFinite(timestamp) || timestamp <= 0) {
    return '--:--';
  }
  const diffSeconds = Math.max(0, Math.floor((nowMs - timestamp) / 1000));
  if (diffSeconds < 10) return 'Vừa xong';
  if (diffSeconds < 60) return `${diffSeconds} giây trước`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} ngày trước`;
  return formatDateVN(timestamp);
}

/**
 * Kiểm tra xem một bản ghi log có khớp với từ khóa tìm kiếm (action, user, hoặc ngày) hay không.
 */
export function matchesLogSearch(log: LogEntry, rawKeyword: string): boolean {
  const keyword = rawKeyword.normalize('NFC').toLowerCase().trim();
  if (!keyword) return true;

  const actionStr = (log.action ?? '').normalize('NFC').toLowerCase();
  const userStr = (log.user ?? '').normalize('NFC').toLowerCase();
  const datePadded = formatDateVN(log.timestamp).toLowerCase();
  const dateShort = formatDateShortVN(log.timestamp).toLowerCase();

  return (
    actionStr.includes(keyword) ||
    userStr.includes(keyword) ||
    datePadded.includes(keyword) ||
    (dateShort !== '' && dateShort.includes(keyword))
  );
}

/**
 * Nhóm danh sách các bản ghi (trong 1 trang) theo ngày DD/MM/YYYY, giữ nguyên thứ tự và số thứ tự (STT).
 */
export function groupLogsByDate(
  logs: LogEntry[],
  startIndexOffset: number = 0
): DateGroupedLogs[] {
  const groups: DateGroupedLogs[] = [];

  logs.forEach((log, idx) => {
    const dateKey = formatDateVN(log.timestamp);
    const currentGroup = groups[groups.length - 1];
    const item = { log, index: startIndexOffset + idx + 1 };

    if (!currentGroup || currentGroup.dateKey !== dateKey) {
      groups.push({
        dateKey,
        items: [item],
      });
    } else {
      currentGroup.items.push(item);
    }
  });

  return groups;
}

/**
 * Kiểm tra xem timestamp có thuộc ngày hôm nay (theo giờ local) hay không.
 */
export function isSameDayLocal(
  timestamp?: number | null,
  referenceMs: number = Date.now()
): boolean {
  if (!timestamp || !Number.isFinite(timestamp) || timestamp <= 0) return false;
  return formatDateVN(timestamp) === formatDateVN(referenceMs);
}
