import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createLearnCardController,
  type LearnCardServiceAdapter,
} from '../learnCardMachine';
import { createFirebaseService } from '../firebaseService';
import type { Database, DatabaseReference, DataSnapshot } from 'firebase/database';

describe('learnCardMachine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createMockAdapter(initialModeValue = false) {
    const callOrder: string[] = [];
    let currentMode = initialModeValue;
    let currentCard = 'OLD_CARD';
    const modeListeners = new Set<(val: boolean) => void>();

    const service: LearnCardServiceAdapter = {
      registerAddCardDisconnectCleanup: vi.fn(async () => {
        callOrder.push('onDisconnect.set(false)');
      }),
      cancelAddCardDisconnectCleanup: vi.fn(async () => {
        callOrder.push('onDisconnect.cancel()');
      }),
      setAddCardMode: vi.fn(async (enabled: boolean) => {
        callOrder.push(`setAddCardMode(${enabled})`);
        currentMode = enabled;
        modeListeners.forEach((cb) => cb(currentMode));
      }),
      setLearnCardTarget: vi.fn(async (userId: string, userName: string) => {
        callOrder.push(`setTarget(${userId},${userName})`);
      }),
      subscribeAddCardMode: vi.fn((cb: (enabled: boolean) => void) => {
        callOrder.push('subscribeAddCardMode');
        modeListeners.add(cb);
        cb(currentMode);
        return () => {
          modeListeners.delete(cb);
        };
      }),
      getUserCard: vi.fn(async () => {
        callOrder.push('getUserCard');
        return currentCard;
      }),
      removeOldRfidAndSync: vi.fn(async (oldCard: string) => {
        callOrder.push(`removeOldRfidAndSync(${oldCard})`);
      }),
    };

    return {
      service,
      callOrder,
      setCardOnCloud(card: string) {
        currentCard = card;
      },
      emitModeFromFirmware(enabled: boolean) {
        currentMode = enabled;
        modeListeners.forEach((cb) => cb(currentMode));
      },
    };
  }

  it('executes strict start sequence and does NOT close early when Add_Card_Mode was stuck at true', async () => {
    // Kịch bản: Add_Card_Mode đang bị kẹt true từ trước
    const { service, callOrder, setCardOnCloud, emitModeFromFirmware } =
      createMockAdapter(true);

    const controller = createLearnCardController({ service });
    await controller.startSession('user_1', 'Nguyen Van A', 'OLD_CARD');

    // Sau khi startSession hoàn tất, phải đang ở 'waiting_for_scan', KHÔNG bị đóng sớm!
    expect(controller.getState().phase).toBe('waiting_for_scan');
    expect(callOrder).toEqual([
      'onDisconnect.set(false)',
      'setAddCardMode(false)',
      'setTarget(user_1,Nguyen Van A)',
      'setAddCardMode(true)',
      'subscribeAddCardMode',
    ]);

    // Bây giờ firmware quét thẻ mới xong và đặt Add_Card_Mode = false
    setCardOnCloud('NEW_CARD_UID');
    emitModeFromFirmware(false);
    await vi.runAllTimersAsync();

    expect(controller.getState().phase).toBe('succeeded');
    expect(controller.getState().newCard).toBe('NEW_CARD_UID');
    expect(callOrder).toContain('removeOldRfidAndSync(OLD_CARD)');
  });

  it('supports Fast-Ack when first observed value after set(true) is already false', async () => {
    const { service, setCardOnCloud } = createMockAdapter(false);
    setCardOnCloud('FAST_CARD_99');

    // Giả lập firmware phản hồi cực nhanh: ngay khi subscribeAddCardMode gắn vào thì giá trị đã về false
    service.subscribeAddCardMode = vi.fn((cb) => {
      cb(false);
      return () => {};
    });

    const controller = createLearnCardController({ service });
    await controller.startSession('user_1', 'Nguyen Van A', '');
    await vi.runAllTimersAsync();

    expect(controller.getState().phase).toBe('succeeded');
    expect(controller.getState().newCard).toBe('FAST_CARD_99');
  });

  it('only calls onDisconnect.cancel() AFTER setAddCardMode(false) succeeds on cancel/timeout', async () => {
    const { service, callOrder } = createMockAdapter(false);
    const controller = createLearnCardController({ service, timeoutMs: 60000 });
    await controller.startSession('user_1', 'Nguyen Van A', '');

    callOrder.length = 0;
    await controller.cancelSession();

    expect(callOrder).toEqual([
      'setAddCardMode(false)',
      'onDisconnect.cancel()',
    ]);

    // Nếu setAddCardMode(false) bị lỗi mạng thì KHÔNG được gọi onDisconnect.cancel()
    await controller.startSession('user_1', 'Nguyen Van A', '');
    callOrder.length = 0;
    service.setAddCardMode = vi.fn(async () => {
      callOrder.push('setAddCardMode(false):failed');
      throw new Error('Network error');
    });

    await controller.cancelSession();
    expect(callOrder).toEqual(['setAddCardMode(false):failed']);
  });

  it('marks needsCancelRecovery when aborted due to lock offline and sends true -> false pulse when online again', async () => {
    const { service, callOrder } = createMockAdapter(false);
    const controller = createLearnCardController({ service });

    await controller.startSession('user_1', 'Nguyen Van A', '');
    expect(controller.getState().phase).toBe('waiting_for_scan');

    // Ổ khóa rớt mạng Wi-Fi
    callOrder.length = 0;
    await controller.handleConnectionStateChange('offline');
    expect(controller.getState().phase).toBe('offline_aborted');
    expect(controller.getState().needsCancelRecovery).toBe(true);

    // Ổ khóa có mạng trở lại -> gửi đúng 1 lần setAddCardMode(true) -> setAddCardMode(false)
    callOrder.length = 0;
    await controller.handleConnectionStateChange('online');
    expect(controller.getState().needsCancelRecovery).toBe(false);
    expect(callOrder).toEqual([
      'setAddCardMode(true)',
      'setAddCardMode(false)',
    ]);

    // Gọi lại online lần nữa sẽ không gửi thêm xung thừa
    callOrder.length = 0;
    await controller.handleConnectionStateChange('online');
    expect(callOrder).toEqual([]);
  });
});

describe('firebaseService DI & write timeout semantics', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends rising-edge set(false) -> set(true) for Remote_Open and Restart, and attaches triggerNeedSync to slow updates', async () => {
    const ops: string[] = [];
    let resolveSlowUpdate!: () => void;

    const fakeDb = {} as Database;
    const service = createFirebaseService({
      db: fakeDb,
      writeTimeoutMs: 500,
      ref: (_db, path = '') => ({ path } as unknown as DatabaseReference),
      set: async (r, val) => {
        const p = (r as unknown as { path: string }).path;
        ops.push(`set:${p}=${String(val)}`);
      },
      update: async (_r, values) => {
        ops.push(`update:${Object.keys(values).join(',')}`);
        await new Promise<void>((res) => {
          resolveSlowUpdate = res;
        });
      },
      get: async () => ({ val: () => '' } as unknown as DataSnapshot),
      remove: async () => {},
      onValue: () => () => {},
      onDisconnect: () => ({
        set: async () => {},
        cancel: async () => {},
      }),
    });

    // 1. Kiểm tra cạnh lên cho Remote_Open và Restart
    await service.triggerRemoteOpen();
    expect(ops).toEqual([
      'set:SmartLock/Control/Remote_Open=false',
      'set:SmartLock/Control/Remote_Open=true',
    ]);

    ops.length = 0;
    await service.triggerRestart();
    expect(ops).toEqual([
      'set:SmartLock/Control/Restart=false',
      'set:SmartLock/Control/Restart=true',
    ]);

    // 2. Kiểm tra write timeout không hủy lệnh và vẫn chạy triggerNeedSync khi update hoàn tất muộn
    ops.length = 0;
    const mutationPromise = service.addUser('Nguyen Van A', '0123');
    await vi.advanceTimersByTimeAsync(600);
    const result = await mutationPromise;
    expect(result.status).toBe('queued_offline');

    // Khi mạng thông trở lại và update() gốc hoàn tất, triggerNeedSync (false -> true) tự chạy!
    resolveSlowUpdate();
    await vi.runAllTimersAsync();
    expect(ops).toContain('set:SmartLock/Control/Need_Sync=false');
    expect(ops).toContain('set:SmartLock/Control/Need_Sync=true');
  });
});

describe('executeRemoteOpenWithAck (Fast-Ack & Timeout)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('confirms immediately (Fast-Ack) if first observed Remote_Open value after set(true) is already false', async () => {
    const { executeRemoteOpenWithAck } = await import('../remoteOpenAck');
    const onAckConfirmed = vi.fn();
    const onAckUnconfirmed = vi.fn();

    await executeRemoteOpenWithAck({
      triggerRemoteOpen: vi.fn(async () => ({ status: 'completed' as const })),
      subscribeRemoteOpen: vi.fn((cb) => {
        // Giá trị đầu tiên đọc được đã là false (firmware xử lý cực nhanh)
        cb(false);
        return () => {};
      }),
      ackTimeoutMs: 5000,
      onAckConfirmed,
      onAckUnconfirmed,
    });

    expect(onAckConfirmed).toHaveBeenCalledTimes(1);
    expect(onAckUnconfirmed).not.toHaveBeenCalled();
  });

  it('calls onAckUnconfirmed after 5s timeout if Remote_Open stays true', async () => {
    const { executeRemoteOpenWithAck } = await import('../remoteOpenAck');
    const onAckConfirmed = vi.fn();
    const onAckUnconfirmed = vi.fn();

    await executeRemoteOpenWithAck({
      triggerRemoteOpen: vi.fn(async () => ({ status: 'completed' as const })),
      subscribeRemoteOpen: vi.fn((cb) => {
        cb(true);
        return () => {};
      }),
      ackTimeoutMs: 5000,
      onAckConfirmed,
      onAckUnconfirmed,
    });

    await vi.advanceTimersByTimeAsync(5000);
    expect(onAckUnconfirmed).toHaveBeenCalledTimes(1);
    expect(onAckConfirmed).not.toHaveBeenCalled();
  });
});

