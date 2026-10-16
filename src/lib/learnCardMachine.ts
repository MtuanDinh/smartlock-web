export type LearnCardPhase =
  | 'idle'
  | 'starting'
  | 'waiting_for_scan'
  | 'verifying'
  | 'succeeded'
  | 'failed_duplicate'
  | 'cancelled'
  | 'timeout'
  | 'offline_aborted'
  | 'error';

export interface LearnCardSnapshot {
  phase: LearnCardPhase;
  userId: string;
  userName: string;
  initialCard: string;
  newCard?: string;
  errorMessage?: string;
  needsCancelRecovery: boolean;
}

export interface LearnCardServiceAdapter {
  registerAddCardDisconnectCleanup: () => Promise<void>;
  cancelAddCardDisconnectCleanup: () => Promise<void>;
  setAddCardMode: (enabled: boolean) => Promise<void>;
  setLearnCardTarget: (userId: string, userName: string) => Promise<void>;
  subscribeAddCardMode: (cb: (enabled: boolean) => void) => () => void;
  getUserCard: (userId: string) => Promise<string>;
  removeOldRfidAndSync: (oldCard: string) => Promise<void>;
}

export interface LearnCardControllerOptions {
  service: LearnCardServiceAdapter;
  timeoutMs?: number;
  onStateChange?: (snapshot: LearnCardSnapshot) => void;
}

const DEFAULT_LEARN_TIMEOUT_MS = 60000;

/**
 * Pure State Machine / Controller điều phối quy trình học thẻ & thay thẻ từ:
 * 1. Bắt đầu: onDisconnect.set(false) -> set(Add_Card_Mode, false) -> update(Target_*) -> set(Add_Card_Mode, true).
 * 2. Chỉ gắn/arm listener kết quả SAU KHI await set(Add_Card_Mode, true) hoàn tất.
 * 3. Hỗ trợ Fast-Ack: sau khi đã arm (server đã xác nhận set(true)), nếu giá trị đầu tiên đọc được là false
 *    hoặc chuyển từ true -> false thì chuyển thẳng sang 'verifying'.
 * 4. Chỉ gọi onDisconnect.cancel() SAU KHI set(Add_Card_Mode, false) đã thành công.
 * 5. Nếu phiên bị hủy do ổ khóa offline ('offline_aborted'), bật cờ needsCancelRecovery = true;
 *    khi ổ khóa online trở lại (và UI không mở phiên học thẻ nào), gửi đúng 1 lần set(true) -> set(false)
 *    để ép firmware thoát khỏi biến isLearningMode đang kẹt.
 */
export function createLearnCardController(options: LearnCardControllerOptions) {
  const { service, timeoutMs = DEFAULT_LEARN_TIMEOUT_MS, onStateChange } = options;

  let state: LearnCardSnapshot = {
    phase: 'idle',
    userId: '',
    userName: '',
    initialCard: '',
    needsCancelRecovery: false,
  };

  let sessionToken = 0;
  let armed = false;
  let unsubscribeMode: (() => void) | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let isRecovering = false;

  function emit(next: Partial<LearnCardSnapshot>) {
    state = { ...state, ...next };
    onStateChange?.(state);
  }

  function clearWatchers() {
    armed = false;
    if (unsubscribeMode) {
      unsubscribeMode();
      unsubscribeMode = null;
    }
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  }

  /**
   * Thử ghi Add_Card_Mode = false một lần để dọn dẹp, và CHỈ gọi onDisconnect.cancel()
   * sau khi setAddCardMode(false) đã thành công.
   */
  async function cleanupRemoteModeAndDisconnect(): Promise<void> {
    try {
      await service.setAddCardMode(false);
    } catch {
      // Nếu set(false) lỗi (ví dụ rớt mạng), KHÔNG gọi cancelAddCardDisconnectCleanup
      // để Firebase Server vẫn giữ lệnh onDisconnect tự hạ cờ.
      return;
    }

    try {
      await service.cancelAddCardDisconnectCleanup();
    } catch {
      // Bỏ qua lỗi phụ khi hủy onDisconnect
    }
  }

  async function handleScanFinished(token: number) {
    if (token !== sessionToken || !armed || state.phase !== 'waiting_for_scan') {
      return;
    }
    clearWatchers();
    emit({ phase: 'verifying' });

    // Đã thấy Add_Card_Mode về false từ phía firmware -> có thể hủy onDisconnect an toàn
    try {
      await service.cancelAddCardDisconnectCleanup();
    } catch {
      // Bỏ qua
    }

    try {
      const currentCardOnCloud = (await service.getUserCard(state.userId)).trim();
      if (token !== sessionToken) return;

      if (currentCardOnCloud !== '' && currentCardOnCloud !== state.initialCard) {
        if (state.initialCard !== '') {
          await service.removeOldRfidAndSync(state.initialCard);
        }
        if (token !== sessionToken) return;
        emit({
          phase: 'succeeded',
          newCard: currentCardOnCloud,
        });
      } else {
        emit({
          phase: 'failed_duplicate',
          errorMessage:
            'Không thể thêm thẻ: Thẻ từ này đã được cấp cho thành viên khác hoặc giao dịch bị từ chối.',
        });
      }
    } catch (err) {
      if (token !== sessionToken) return;
      emit({
        phase: 'error',
        errorMessage:
          err instanceof Error
            ? err.message
            : 'Không thể kiểm tra dữ liệu thẻ mới sau khi quét.',
      });
    }
  }

  async function startSession(
    userId: string,
    userName: string,
    initialCard: string
  ): Promise<void> {
    sessionToken += 1;
    const currentToken = sessionToken;
    clearWatchers();

    emit({
      phase: 'starting',
      userId,
      userName,
      initialCard: String(initialCard ?? '').trim(),
      newCard: undefined,
      errorMessage: undefined,
      needsCancelRecovery: false,
    });

    try {
      await service.registerAddCardDisconnectCleanup();
      if (currentToken !== sessionToken) return;

      await service.setAddCardMode(false);
      if (currentToken !== sessionToken) return;

      await service.setLearnCardTarget(userId, userName);
      if (currentToken !== sessionToken) return;

      await service.setAddCardMode(true);
      if (currentToken !== sessionToken) return;

      // CHỈ sau khi await set(Add_Card_Mode, true) đã được server xác nhận hoàn tất:
      armed = true;
      emit({ phase: 'waiting_for_scan' });

      timeoutId = setTimeout(() => {
        void abortSession('timeout');
      }, timeoutMs);

      unsubscribeMode = service.subscribeAddCardMode((enabled) => {
        if (currentToken !== sessionToken || !armed) return;
        // Hỗ trợ Fast-Ack: vì listener chỉ được gắn sau khi set(true) đã thành công,
        // nếu giá trị đầu tiên quan sát được là false (hoặc chuyển từ true -> false) thì coi là đã xong.
        if (enabled === false) {
          void handleScanFinished(currentToken);
        }
      });
    } catch (err) {
      if (currentToken !== sessionToken) return;
      clearWatchers();
      await cleanupRemoteModeAndDisconnect();
      emit({
        phase: 'error',
        errorMessage:
          err instanceof Error
            ? err.message
            : 'Không thể khởi tạo chế độ học thẻ từ.',
      });
    }
  }

  async function abortSession(
    reason: 'cancelled' | 'timeout' | 'offline_aborted'
  ): Promise<void> {
    if (
      state.phase !== 'starting' &&
      state.phase !== 'waiting_for_scan'
    ) {
      return;
    }

    sessionToken += 1;
    clearWatchers();

    const markRecovery = reason === 'offline_aborted';
    emit({
      phase: reason,
      needsCancelRecovery: markRecovery ? true : state.needsCancelRecovery,
    });

    await cleanupRemoteModeAndDisconnect();
  }

  /**
   * Được gọi khi trạng thái kết nối của ổ khóa thay đổi.
   * - Nếu đang học thẻ mà ổ khóa chuyển sang 'offline' -> tự động hủy và đặt needsCancelRecovery = true.
   * - Nếu ổ khóa chuyển sang 'online', needsCancelRecovery === true và không có phiên học thẻ nào đang mở
   *   -> gửi đúng 1 lần set(Add_Card_Mode, true) rồi set(Add_Card_Mode, false) để mạch thoát khỏi isLearningMode.
   */
  async function handleConnectionStateChange(
    connectionState: 'loading' | 'online' | 'offline'
  ): Promise<void> {
    if (connectionState === 'offline') {
      if (state.phase === 'starting' || state.phase === 'waiting_for_scan') {
        await abortSession('offline_aborted');
      }
      return;
    }

    if (
      connectionState === 'online' &&
      state.needsCancelRecovery &&
      !isRecovering &&
      state.phase !== 'starting' &&
      state.phase !== 'waiting_for_scan' &&
      state.phase !== 'verifying'
    ) {
      isRecovering = true;
      emit({ needsCancelRecovery: false });
      try {
        await service.setAddCardMode(true);
        await service.setAddCardMode(false);
      } catch {
        // Nếu gửi xung phục hồi lỗi, bật lại cờ để thử ở lần kết nối tiếp theo
        emit({ needsCancelRecovery: true });
      } finally {
        isRecovering = false;
      }
    }
  }

  function resetToIdle() {
    if (
      state.phase === 'starting' ||
      state.phase === 'waiting_for_scan'
    ) {
      void abortSession('cancelled');
    } else {
      clearWatchers();
      emit({
        phase: 'idle',
        newCard: undefined,
        errorMessage: undefined,
      });
    }
  }

  function getState(): LearnCardSnapshot {
    return state;
  }

  return {
    getState,
    startSession,
    cancelSession: () => abortSession('cancelled'),
    abortForTimeout: () => abortSession('timeout'),
    abortForOffline: () => abortSession('offline_aborted'),
    handleConnectionStateChange,
    resetToIdle,
  };
}
