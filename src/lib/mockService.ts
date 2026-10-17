import type { SmartLockService } from './service';
import type {
  AuthUser,
  BiometricEnrollCommand,
  BiometricEnrollTarget,
  LogEntry,
  MutationResult,
  User,
  UserStatus,
} from '../types';

/**
 * Triển khai MockService phục vụ chế độ VITE_USE_MOCK=true.
 * Chỉ được nạp qua dynamic import('./mockService'), không bao giờ nằm trong production bundle.
 */
export function createMockService(): SmartLockService {
  const now = Date.now();
  const min = 60 * 1000;
  const hour = 60 * min;
  const day = 24 * hour;

  let currentUser: AuthUser | null = {
    uid: 'mock-admin-uid',
    email: 'admin@example.com',
  };

  let isClientConnected = true;
  let isDeviceOnline = true;
  let lastBeat: number | null = now - 3000;
  let isLockdown = false;
  let isRemoteOpen = false;
  let addCardMode = false;
  let targetUserId = '';
  let targetUserName = '';
  let hasUnsyncedChanges = false;
  let biometricMode = true;
  let biometricEnrollState: BiometricEnrollCommand = {
    active: false,
    userId: '',
    userName: '',
    target: 'both',
    expectedPassphrase: '',
    step: 'idle',
    message: '',
    updatedAt: 0,
  };

  let users: User[] = [
    {
      id: 'user_1700000001',
      name: 'Nguyen Van An',
      pass: '012345',
      card: 'A1B2C3D4',
      status: 'active',
      hasVoice: true,
      hasFace: true,
      voicePassphrase: 'mở cửa cho nguyễn văn an',
      biometricUpdatedAt: now - 3 * hour,
    },
    {
      id: 'user_1700000002',
      name: 'Tran Thi Binh',
      pass: '2468',
      card: 'E5F60718',
      status: 'active',
      hasVoice: true,
      hasFace: false,
      voicePassphrase: 'mở khóa thông minh',
      biometricUpdatedAt: now - 5 * hour,
    },
    {
      id: 'user_1700000003',
      name: 'Le Hoang Nam',
      pass: '008899',
      card: '',
      status: 'active',
    },
    {
      id: 'user_1700000004',
      name: 'Pham Minh Khang',
      pass: '5678',
      card: '99AA22BB',
      status: 'disabled',
    },
  ];

  // Tạo 24 bản ghi nhật ký mẫu trải dài hôm nay, hôm qua và các ngày trước
  let logs: LogEntry[] = [
    {
      id: 'log_1',
      action: 'Mở bằng Thẻ từ',
      user: 'Nguyen Van An',
      timestamp: now - 4 * min,
    },
    {
      id: 'log_2',
      action: 'Mở cửa qua Web',
      user: 'Admin (Remote)',
      timestamp: now - 18 * min,
    },
    {
      id: 'log_3',
      action: 'Mở bằng nút bấm',
      user: 'Người trong nhà',
      timestamp: now - 42 * min,
    },
    {
      id: 'log_4',
      action: 'Cảnh báo: Sai Pass',
      user: 'Khách lạ',
      timestamp: now - 1.5 * hour,
    },
    {
      id: 'log_5',
      action: 'Mở bằng Mật khẩu (Offline)',
      user: 'Tran Thi Binh',
      timestamp: now - 2.2 * hour,
    },
    {
      id: 'log_6',
      action: 'HỆ THỐNG',
      user: 'Đã đồng bộ Log Offline',
      timestamp: now - 2.2 * hour + 1000,
    },
    {
      id: 'log_7',
      action: 'HỆ THỐNG',
      user: 'Đã làm mới Cache Offline',
      timestamp: now - 3 * hour,
    },
    {
      id: 'log_8',
      action: 'Thêm thẻ mới',
      user: 'Tran Thi Binh',
      timestamp: now - 4 * hour,
    },
    {
      id: 'log_9',
      action: 'Cảnh báo: Sai Thẻ (Offline)',
      user: 'Khách lạ',
      timestamp: now - 5 * hour,
    },
    // Hôm qua
    {
      id: 'log_10',
      action: 'Mở bằng Mật khẩu',
      user: 'Le Hoang Nam',
      timestamp: now - day - 1 * hour,
    },
    {
      id: 'log_11',
      action: 'Cảnh báo Đột nhập',
      user: 'Nhập mã khi Đang Khóa',
      timestamp: now - day - 2 * hour,
    },
    {
      id: 'log_12',
      action: 'HỆ THỐNG',
      user: 'TẮT chế độ Khóa khẩn cấp',
      timestamp: now - day - 1.9 * hour,
    },
    {
      id: 'log_13',
      action: 'HỆ THỐNG',
      user: 'BẬT chế độ Khóa khẩn cấp',
      timestamp: now - day - 2.5 * hour,
    },
    {
      id: 'log_14',
      action: 'Mở bằng nút bấm',
      user: 'Người trong nhà',
      timestamp: now - day - 4 * hour,
    },
    {
      id: 'log_15',
      action: 'Hệ thống khởi động',
      user: 'Wemos D1 Mini',
      timestamp: now - day - 6 * hour,
    },
    // 2 ngày trước
    {
      id: 'log_16',
      action: 'Mở bằng Thẻ từ',
      user: 'Nguyen Van An',
      timestamp: now - 2 * day - 1 * hour,
    },
    {
      id: 'log_17',
      action: 'Mở bằng Mật khẩu',
      user: 'Tran Thi Binh',
      timestamp: now - 2 * day - 3 * hour,
    },
    {
      id: 'log_18',
      action: 'Cảnh báo An ninh',
      user: 'Cố gắng thêm thẻ bị trùng của: Nguyen Van An',
      timestamp: now - 2 * day - 4 * hour,
    },
    {
      id: 'log_19',
      action: 'Mở cửa qua Web',
      user: 'Admin (Remote)',
      timestamp: now - 2 * day - 5 * hour,
    },
    {
      id: 'log_20',
      action: 'Mở bằng nút bấm (Offline)',
      user: 'Người trong nhà',
      timestamp: now - 2 * day - 7 * hour,
    },
  ];

  const authSubs = new Set<(u: AuthUser | null) => void>();
  const clientConnSubs = new Set<(c: boolean) => void>();
  const offsetSubs = new Set<(o: number) => void>();
  const beatSubs = new Set<(b: number | null) => void>();
  const unsyncedSubs = new Set<(u: boolean) => void>();
  const lockdownSubs = new Set<(l: boolean) => void>();
  const remoteOpenSubs = new Set<(r: boolean) => void>();
  const addCardSubs = new Set<(a: boolean) => void>();
  const biometricModeSubs = new Set<(m: boolean) => void>();
  const biometricEnrollSubs = new Set<(e: BiometricEnrollCommand) => void>();
  const usersSubs = new Set<(u: User[]) => void>();
  const recentLogsSubs = new Set<{ count: number; cb: (l: LogEntry[]) => void }>();
  const logsSubs = new Set<{ limit: number; cb: (l: LogEntry[]) => void }>();

  function notifyUsers() {
    const snapshot = [...users];
    usersSubs.forEach((cb) => cb(snapshot));
  }

  function notifyBiometricEnroll() {
    const snapshot = { ...biometricEnrollState };
    biometricEnrollSubs.forEach((cb) => cb(snapshot));
  }

  function notifyLogs() {
    const sorted = [...logs].sort((a, b) => b.timestamp - a.timestamp);
    recentLogsSubs.forEach(({ count, cb }) => cb(sorted.slice(0, count)));
    logsSubs.forEach(({ limit, cb }) => cb(sorted.slice(0, limit)));
  }

  function pushLog(action: string, user: string) {
    logs = [
      {
        id: `log_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        action,
        user,
        timestamp: Date.now(),
      },
      ...logs,
    ];
    notifyLogs();
  }

  // Nhịp tim giả lập mỗi 10s khi isDeviceOnline === true
  setInterval(() => {
    if (isDeviceOnline && isClientConnected) {
      lastBeat = Date.now();
      beatSubs.forEach((cb) => cb(lastBeat));
    }
  }, 10000);

  return {
    subscribeAuth(cb) {
      authSubs.add(cb);
      cb(currentUser);
      return () => authSubs.delete(cb);
    },

    async signIn(email, password) {
      if (!email.trim() || !password) {
        const err = new Error('Invalid credentials') as Error & { code?: string };
        err.code = 'auth/invalid-credential';
        throw err;
      }
      currentUser = { uid: 'mock-admin-uid', email: email.trim() };
      authSubs.forEach((cb) => cb(currentUser));
    },

    async signOut() {
      currentUser = null;
      authSubs.forEach((cb) => cb(null));
    },

    subscribeClientConnected(cb) {
      clientConnSubs.add(cb);
      cb(isClientConnected);
      return () => clientConnSubs.delete(cb);
    },

    subscribeServerTimeOffset(cb) {
      offsetSubs.add(cb);
      cb(0);
      return () => offsetSubs.delete(cb);
    },

    subscribeLastBeat(cb) {
      beatSubs.add(cb);
      cb(lastBeat);
      return () => beatSubs.delete(cb);
    },

    subscribeUnsyncedChanges(cb) {
      unsyncedSubs.add(cb);
      cb(hasUnsyncedChanges);
      return () => unsyncedSubs.delete(cb);
    },

    subscribeLockdown(cb) {
      lockdownSubs.add(cb);
      cb(isLockdown);
      return () => lockdownSubs.delete(cb);
    },

    subscribeRemoteOpen(cb) {
      remoteOpenSubs.add(cb);
      cb(isRemoteOpen);
      return () => remoteOpenSubs.delete(cb);
    },

    async setLockdown(enabled): Promise<MutationResult> {
      isLockdown = enabled;
      lockdownSubs.forEach((cb) => cb(isLockdown));
      pushLog(
        'HỆ THỐNG',
        enabled ? 'BẬT chế độ Khóa khẩn cấp' : 'TẮT chế độ Khóa khẩn cấp'
      );
      return { status: 'completed' };
    },

    async triggerRemoteOpen(): Promise<MutationResult> {
      isRemoteOpen = true;
      remoteOpenSubs.forEach((cb) => cb(true));
      if (isDeviceOnline && isClientConnected) {
        setTimeout(() => {
          isRemoteOpen = false;
          remoteOpenSubs.forEach((cb) => cb(false));
          pushLog('Mở cửa qua Web', 'Admin (Remote)');
        }, 250);
      }
      return { status: 'completed' };
    },

    async triggerRestart(): Promise<MutationResult> {
      if (isDeviceOnline && isClientConnected) {
        pushLog('HỆ THỐNG', 'Khởi động lại từ xa');
      }
      return { status: 'completed' };
    },

    async triggerNeedSync() {
      hasUnsyncedChanges = false;
      unsyncedSubs.forEach((cb) => cb(false));
      if (isDeviceOnline) {
        pushLog('HỆ THỐNG', 'Đã làm mới Cache Offline');
      }
    },

    // Biometric Control & Remote Phone Enrollment
    subscribeBiometricMode(cb) {
      biometricModeSubs.add(cb);
      cb(biometricMode);
      return () => biometricModeSubs.delete(cb);
    },

    async setBiometricMode(enabled) {
      biometricMode = enabled;
      biometricModeSubs.forEach((cb) => cb(biometricMode));
      return { status: 'completed' };
    },

    subscribeBiometricEnroll(cb) {
      biometricEnrollSubs.add(cb);
      cb({ ...biometricEnrollState });
      return () => biometricEnrollSubs.delete(cb);
    },

    async startBiometricEnrollOnPhone({
      userId,
      userName,
      target,
      expectedPassphrase,
    }) {
      biometricEnrollState = {
        active: true,
        userId,
        userName,
        target,
        expectedPassphrase: expectedPassphrase.trim().toLowerCase(),
        step: target === 'face' ? 'waiting_face' : 'waiting_voice',
        message:
          target === 'face'
            ? `Đang chờ ${userName} nhìn vào Camera sau (HD) của điện thoại...`
            : `Đang chờ ${userName} đọc câu mật khẩu vào mic điện thoại...`,
        updatedAt: Date.now(),
      };
      notifyBiometricEnroll();
    },

    async cancelBiometricEnrollOnPhone() {
      biometricEnrollState = {
        ...biometricEnrollState,
        active: false,
        step: 'cancelled',
        message: 'Đã hủy phiên thu mẫu sinh trắc học trên điện thoại.',
        updatedAt: Date.now(),
      };
      notifyBiometricEnroll();
    },

    async clearUserBiometrics(userId, target: BiometricEnrollTarget) {
      users = users.map((u) => {
        if (u.id !== userId) return u;
        return {
          ...u,
          hasVoice: target === 'voice' || target === 'both' ? false : u.hasVoice,
          voicePassphrase:
            target === 'voice' || target === 'both'
              ? undefined
              : u.voicePassphrase,
          hasFace: target === 'face' || target === 'both' ? false : u.hasFace,
        };
      });
      notifyUsers();
      return { status: 'completed' };
    },

    subscribeUsers(cb) {
      usersSubs.add(cb);
      cb([...users]);
      return () => usersSubs.delete(cb);
    },

    async addUser(name, pin): Promise<MutationResult> {
      const userId = `user_${Date.now()}`;
      const newUser: User = {
        id: userId,
        name,
        pass: String(pin ?? '').trim(),
        card: '',
        status: 'active',
      };
      users = [...users, newUser];
      notifyUsers();
      pushLog('HỆ THỐNG', 'Đã làm mới Cache Offline');
      return { status: 'completed', userId };
    },

    async editUserName(userId, newName): Promise<MutationResult> {
      users = users.map((u) =>
        u.id === userId ? { ...u, name: newName } : u
      );
      notifyUsers();
      pushLog('HỆ THỐNG', 'Đã làm mới Cache Offline');
      return { status: 'completed' };
    },

    async changeUserPin(userId, _userName, _oldPin, newPin): Promise<MutationResult> {
      users = users.map((u) =>
        u.id === userId ? { ...u, pass: String(newPin ?? '').trim() } : u
      );
      notifyUsers();
      pushLog('HỆ THỐNG', 'Đã làm mới Cache Offline');
      return { status: 'completed' };
    },

    async toggleUserStatus(
      userId,
      _userName,
      _pin,
      _card,
      newStatus: UserStatus
    ): Promise<MutationResult> {
      users = users.map((u) =>
        u.id === userId ? { ...u, status: newStatus } : u
      );
      notifyUsers();
      pushLog('HỆ THỐNG', 'Đã làm mới Cache Offline');
      return { status: 'completed' };
    },

    async deleteUser(userId): Promise<MutationResult> {
      users = users.filter((u) => u.id !== userId);
      notifyUsers();
      pushLog('HỆ THỐNG', 'Đã làm mới Cache Offline');
      return { status: 'completed' };
    },

    // Learn Card Adapter
    async registerAddCardDisconnectCleanup() {},
    async cancelAddCardDisconnectCleanup() {},

    async setAddCardMode(enabled) {
      addCardMode = enabled;
      addCardSubs.forEach((cb) => cb(addCardMode));
    },

    async setLearnCardTarget(userId, userName) {
      targetUserId = userId;
      targetUserName = userName;
    },

    subscribeAddCardMode(cb) {
      addCardSubs.add(cb);
      cb(addCardMode);
      return () => addCardSubs.delete(cb);
    },

    async getUserCard(userId) {
      const found = users.find((u) => u.id === userId);
      return found?.card ?? '';
    },

    async removeOldRfidAndSync(_oldCard) {
      pushLog('HỆ THỐNG', 'Đã làm mới Cache Offline');
    },

    // Logs
    subscribeRecentLogs(count, cb) {
      const entry = { count, cb };
      recentLogsSubs.add(entry);
      const sorted = [...logs].sort((a, b) => b.timestamp - a.timestamp);
      cb(sorted.slice(0, count));
      return () => recentLogsSubs.delete(entry);
    },

    subscribeLogs(limit, cb) {
      const entry = { limit, cb };
      logsSubs.add(entry);
      const sorted = [...logs].sort((a, b) => b.timestamp - a.timestamp);
      cb(sorted.slice(0, limit));
      return () => logsSubs.delete(entry);
    },

    mockControls: {
      get isDeviceOnline() {
        return isDeviceOnline;
      },
      get isClientConnected() {
        return isClientConnected;
      },
      setDeviceOnline(online: boolean) {
        isDeviceOnline = online;
        lastBeat = online ? Date.now() : Date.now() - 60000;
        beatSubs.forEach((cb) => cb(lastBeat));
      },
      setClientConnected(connected: boolean) {
        isClientConnected = connected;
        clientConnSubs.forEach((cb) => cb(isClientConnected));
      },
      simulateCardScanSuccess(customUid?: string) {
        if (!addCardMode || !targetUserId) return;
        const newUid =
          customUid ||
          Array.from({ length: 8 }, () =>
            Math.floor(Math.random() * 16)
              .toString(16)
              .toUpperCase()
          ).join('');
        users = users.map((u) =>
          u.id === targetUserId ? { ...u, card: newUid } : u
        );
        notifyUsers();
        pushLog('Thêm thẻ mới', targetUserName || 'Thành viên');
        addCardMode = false;
        addCardSubs.forEach((cb) => cb(false));
      },
      simulateCardScanDuplicate() {
        if (!addCardMode) return;
        pushLog(
          'Cảnh báo An ninh',
          'Cố gắng thêm thẻ bị trùng của: Nguyen Van An'
        );
        addCardMode = false;
        addCardSubs.forEach((cb) => cb(false));
      },
      simulateDoorOpenByKeypad(userName = 'Nguyen Van An') {
        pushLog('Mở bằng Mật khẩu', userName);
      },
      simulateIntrusionAlert() {
        pushLog('Cảnh báo: Sai Pass', 'Khách lạ');
      },
      simulatePhoneBiometricCapture() {
        if (!biometricEnrollState.active) return;
        const uid = biometricEnrollState.userId;
        const uname = biometricEnrollState.userName;
        const phrase =
          biometricEnrollState.expectedPassphrase ||
          `mở cửa cho ${uname.toLowerCase()}`;

        if (biometricEnrollState.step === 'waiting_voice') {
          users = users.map((u) =>
            u.id === uid
              ? {
                  ...u,
                  hasVoice: true,
                  voicePassphrase: phrase,
                  biometricUpdatedAt: Date.now(),
                }
              : u
          );
          notifyUsers();

          if (biometricEnrollState.target === 'both') {
            biometricEnrollState = {
              ...biometricEnrollState,
              step: 'waiting_face',
              expectedPassphrase: phrase,
              message: `Đã thu giọng nói ("${phrase}")! Đang chờ ${uname} nhìn vào Camera sau HD của điện thoại...`,
              updatedAt: Date.now(),
            };
          } else {
            biometricEnrollState = {
              ...biometricEnrollState,
              active: false,
              step: 'completed',
              expectedPassphrase: phrase,
              message: `Đã thu giọng nói & câu mật khẩu cho ${uname} thành công!`,
              updatedAt: Date.now(),
            };
          }
          notifyBiometricEnroll();
          return;
        }

        if (biometricEnrollState.step === 'waiting_face') {
          users = users.map((u) =>
            u.id === uid
              ? {
                  ...u,
                  hasFace: true,
                  biometricUpdatedAt: Date.now(),
                }
              : u
          );
          notifyUsers();
          biometricEnrollState = {
            ...biometricEnrollState,
            active: false,
            step: 'completed',
            message: `Đã lưu khuôn mặt HD (1920x1080) từ Camera sau cho ${uname} thành công!`,
            updatedAt: Date.now(),
          };
          notifyBiometricEnroll();
        }
      },
    },
  };
}

