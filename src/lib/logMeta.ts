import type { LogCategory, LogFilterChip } from '../types';

export type LogColorVariant = 'danger' | 'muted' | 'primary' | 'info' | 'success';
export type LogIconName = 'ShieldAlert' | 'CircleDot' | 'Globe' | 'Cpu' | 'CheckCircle2';

export interface LogMeta {
  category: LogCategory;
  colorVariant: LogColorVariant;
  iconName: LogIconName;
  isDoorOpen: boolean;
  isOfflineSync: boolean;
  isSystemLog: boolean;
  cleanActionText: string;
}

const OFFLINE_SUFFIX_REGEX = /\s*\(offline\)\s*$/i;

/**
 * Phân tích chuỗi action của bản ghi nhật ký (sau khi normalize('NFC'), không phân biệt hoa thường).
 * - isDoorOpen = true khi action bắt đầu bằng "mở" (kể cả có hậu tố "(Offline)").
 *   "Thêm thẻ mới" không được tính là mở cửa.
 */
export function getLogMeta(rawAction?: string | null): LogMeta {
  const normalized = (rawAction ?? '').normalize('NFC').trim();
  const displayFallback = normalized || 'Không rõ sự kiện';

  const isOfflineSync = OFFLINE_SUFFIX_REGEX.test(normalized);
  const cleanActionText = isOfflineSync
    ? normalized.replace(OFFLINE_SUFFIX_REGEX, '').trim() || 'Không rõ sự kiện'
    : displayFallback;

  const lower = normalized.toLowerCase();
  const cleanLower = cleanActionText.toLowerCase();

  // Định nghĩa "mở cửa" = bắt đầu bằng "mở" (không phân biệt hoa thường)
  const isDoorOpen = cleanLower.startsWith('mở');

  // Kiểm tra log hệ thống (action === "HỆ THỐNG" hoặc chứa "khởi động")
  const isSystemLog = lower.includes('hệ thống') || lower.includes('khởi động');

  if (lower.includes('cảnh báo')) {
    return {
      category: 'alert',
      colorVariant: 'danger',
      iconName: 'ShieldAlert',
      isDoorOpen,
      isOfflineSync,
      isSystemLog: false,
      cleanActionText,
    };
  }

  if (lower.includes('nút bấm')) {
    return {
      category: 'button',
      colorVariant: 'muted',
      iconName: 'CircleDot',
      isDoorOpen,
      isOfflineSync,
      isSystemLog: false,
      cleanActionText,
    };
  }

  if (lower.includes('web')) {
    return {
      category: 'web',
      colorVariant: 'primary',
      iconName: 'Globe',
      isDoorOpen,
      isOfflineSync,
      isSystemLog: false,
      cleanActionText,
    };
  }

  if (isSystemLog) {
    return {
      category: 'system',
      colorVariant: 'info',
      iconName: 'Cpu',
      isDoorOpen,
      isOfflineSync,
      isSystemLog: true,
      cleanActionText,
    };
  }

  return {
    category: 'access',
    colorVariant: 'success',
    iconName: 'CheckCircle2',
    isDoorOpen,
    isOfflineSync,
    isSystemLog: false,
    cleanActionText,
  };
}

export function matchesLogFilterChip(meta: LogMeta, chip: LogFilterChip): boolean {
  switch (chip) {
    case 'all':
      return true;
    case 'door_open':
      return meta.isDoorOpen;
    case 'alert':
      return meta.category === 'alert';
    case 'button':
      return meta.category === 'button';
    case 'web':
      return meta.category === 'web';
    case 'system':
      return meta.category === 'system';
    default:
      return true;
  }
}
