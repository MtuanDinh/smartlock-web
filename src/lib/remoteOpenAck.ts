import type { MutationResult } from '../types';

export interface RemoteOpenAckOptions {
  triggerRemoteOpen: () => Promise<MutationResult>;
  subscribeRemoteOpen: (cb: (isRemoteOpen: boolean) => void) => () => void;
  ackTimeoutMs?: number;
  onAckConfirmed: () => void;
  onAckUnconfirmed: () => void;
}

/**
 * Điều phối gửi lệnh Remote_Open (cạnh lên false -> true) và xác nhận phản hồi từ thiết bị:
 * - Sau khi await triggerRemoteOpen() (set(false) -> set(true)) đã được server xác nhận hoàn tất,
 *   mới gắn/arm listener theo dõi node Remote_Open.
 * - Hỗ trợ Fast-Ack: nếu giá trị đầu tiên quan sát được đã là false (do mạch phản hồi cực nhanh)
 *   hoặc chuyển từ true về false, coi là đã xác nhận (onAckConfirmed).
 * - Nếu quá ackTimeoutMs (mặc định 5000ms) mà chưa thấy về false, gọi onAckUnconfirmed
 *   ("Chưa xác nhận được thiết bị đã nhận lệnh", không coi là lỗi).
 */
export async function executeRemoteOpenWithAck(
  options: RemoteOpenAckOptions
): Promise<{ cleanup: () => void }> {
  const {
    triggerRemoteOpen,
    subscribeRemoteOpen,
    ackTimeoutMs = 5000,
    onAckConfirmed,
    onAckUnconfirmed,
  } = options;

  let finished = false;
  let unsub: (() => void) | null = null;
  let timerId: ReturnType<typeof setTimeout> | null = null;

  function cleanup() {
    finished = true;
    if (unsub) {
      unsub();
      unsub = null;
    }
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  }

  const res = await triggerRemoteOpen();
  if (res.status === 'queued_offline') {
    onAckUnconfirmed();
    return { cleanup };
  }

  timerId = setTimeout(() => {
    if (finished) return;
    cleanup();
    onAckUnconfirmed();
  }, ackTimeoutMs);

  // Chỉ gắn listener SAU KHI await triggerRemoteOpen() (set(false) -> set(true)) đã hoàn tất
  unsub = subscribeRemoteOpen((isRemoteOpen) => {
    if (finished) return;
    if (isRemoteOpen === false) {
      cleanup();
      onAckConfirmed();
    }
  });

  return { cleanup };
}
