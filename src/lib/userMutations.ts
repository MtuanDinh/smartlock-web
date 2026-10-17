import { PATHS } from './paths';
import type { UserStatus } from '../types';

export type MultiPathUpdates = Record<string, unknown>;

/**
 * Tạo payload multi-path update khi thêm thành viên mới.
 * Giữ PIN dạng string để không mất số 0 ở đầu.
 */
export function buildAddUserUpdates(
  userId: string,
  normalizedName: string,
  pin: string
): MultiPathUpdates {
  const cleanPin = String(pin ?? '').trim();
  const updates: MultiPathUpdates = {
    [PATHS.USER_DETAIL(userId)]: {
      name: normalizedName,
      pass: cleanPin,
      card: '',
      status: 'active' as UserStatus,
    },
  };

  if (cleanPin !== '') {
    updates[PATHS.PASSWORD_ITEM(cleanPin)] = normalizedName;
  }

  return updates;
}

/**
 * Tạo payload multi-path update khi đổi tên thành viên.
 * Nếu thành viên đang active thì cập nhật đồng thời bản sao trong Passwords và RFID.
 */
export function buildEditNameUpdates(
  userId: string,
  normalizedNewName: string,
  pin: string,
  card: string,
  status: UserStatus
): MultiPathUpdates {
  const cleanPin = String(pin ?? '').trim();
  const cleanCard = String(card ?? '').trim();

  const updates: MultiPathUpdates = {
    [`${PATHS.USER_DETAIL(userId)}/name`]: normalizedNewName,
  };

  if (status === 'active') {
    if (cleanPin !== '') {
      updates[PATHS.PASSWORD_ITEM(cleanPin)] = normalizedNewName;
    }
    if (cleanCard !== '') {
      updates[PATHS.RFID_ITEM(cleanCard)] = normalizedNewName;
    }
  }

  return updates;
}

/**
 * Tạo payload multi-path update khi cấp mới / đổi / xóa mã PIN.
 * Nếu newPin === "" tức là xóa PIN.
 */
export function buildChangePinUpdates(
  userId: string,
  userName: string,
  oldPin: string,
  newPin: string,
  status: UserStatus
): MultiPathUpdates {
  const cleanOldPin = String(oldPin ?? '').trim();
  const cleanNewPin = String(newPin ?? '').trim();

  const updates: MultiPathUpdates = {
    [`${PATHS.USER_DETAIL(userId)}/pass`]: cleanNewPin,
  };

  if (cleanOldPin !== '' && cleanOldPin !== cleanNewPin) {
    updates[PATHS.PASSWORD_ITEM(cleanOldPin)] = null;
  }

  if (cleanNewPin !== '' && status === 'active') {
    updates[PATHS.PASSWORD_ITEM(cleanNewPin)] = userName;
  }

  return updates;
}

/**
 * Tạo payload multi-path update khi khóa (disabled) hoặc mở khóa (active) thành viên.
 * - Khóa: xóa bản sao trong Passwords và RFID.
 * - Mở: ghi lại bản sao vào Passwords và RFID.
 */
export function buildToggleStatusUpdates(
  userId: string,
  userName: string,
  pin: string,
  card: string,
  newStatus: UserStatus
): MultiPathUpdates {
  const cleanPin = String(pin ?? '').trim();
  const cleanCard = String(card ?? '').trim();

  const updates: MultiPathUpdates = {
    [`${PATHS.USER_DETAIL(userId)}/status`]: newStatus,
  };

  if (newStatus === 'disabled') {
    if (cleanPin !== '') {
      updates[PATHS.PASSWORD_ITEM(cleanPin)] = null;
    }
    if (cleanCard !== '') {
      updates[PATHS.RFID_ITEM(cleanCard)] = null;
    }
  } else {
    if (cleanPin !== '') {
      updates[PATHS.PASSWORD_ITEM(cleanPin)] = userName;
    }
    if (cleanCard !== '') {
      updates[PATHS.RFID_ITEM(cleanCard)] = userName;
    }
  }

  return updates;
}

/**
 * Tạo payload multi-path update khi xóa vĩnh viễn thành viên.
 * Nếu thành viên đang active thì xóa cả bản sao trong Passwords và RFID.
 */
export function buildDeleteUserUpdates(
  userId: string,
  pin: string,
  card: string,
  status: UserStatus
): MultiPathUpdates {
  const cleanPin = String(pin ?? '').trim();
  const cleanCard = String(card ?? '').trim();

  const updates: MultiPathUpdates = {
    [PATHS.USER_DETAIL(userId)]: null,
  };

  if (status === 'active') {
    if (cleanPin !== '') {
      updates[PATHS.PASSWORD_ITEM(cleanPin)] = null;
    }
    if (cleanCard !== '') {
      updates[PATHS.RFID_ITEM(cleanCard)] = null;
    }
  }

  return updates;
}
