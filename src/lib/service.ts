import type {
  AuthUser,
  LogEntry,
  MutationResult,
  User,
  UserStatus,
} from '../types';
import type { LearnCardServiceAdapter } from './learnCardMachine';

export interface MockControls {
  isDeviceOnline: boolean;
  isClientConnected: boolean;
  setDeviceOnline: (online: boolean) => void;
  setClientConnected: (connected: boolean) => void;
  simulateCardScanSuccess: (newCardUid?: string) => void;
  simulateCardScanDuplicate: () => void;
  simulateDoorOpenByKeypad: (userName?: string) => void;
  simulateIntrusionAlert: () => void;
}

export interface SmartLockService extends LearnCardServiceAdapter {
  // Auth
  subscribeAuth: (cb: (user: AuthUser | null) => void) => () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;

  // System & Connection Status
  subscribeClientConnected: (cb: (connected: boolean) => void) => () => void;
  subscribeServerTimeOffset: (cb: (offsetMs: number) => void) => () => void;
  subscribeLastBeat: (cb: (lastBeatMs: number | null) => void) => () => void;
  subscribeUnsyncedChanges: (cb: (hasUnsynced: boolean) => void) => () => void;

  // Lock Control
  subscribeLockdown: (cb: (isLockdown: boolean) => void) => () => void;
  subscribeRemoteOpen: (cb: (isRemoteOpen: boolean) => void) => () => void;
  setLockdown: (enabled: boolean) => Promise<MutationResult>;
  triggerRemoteOpen: () => Promise<MutationResult>;
  triggerRestart: () => Promise<MutationResult>;
  triggerNeedSync: () => Promise<void>;

  // Users CRUD (Multi-path atomic updates + .then(triggerNeedSync))
  subscribeUsers: (cb: (users: User[]) => void) => () => void;
  addUser: (name: string, pin: string) => Promise<MutationResult>;
  editUserName: (
    userId: string,
    newName: string,
    pin: string,
    card: string,
    status: UserStatus
  ) => Promise<MutationResult>;
  changeUserPin: (
    userId: string,
    userName: string,
    oldPin: string,
    newPin: string,
    status: UserStatus
  ) => Promise<MutationResult>;
  toggleUserStatus: (
    userId: string,
    userName: string,
    pin: string,
    card: string,
    newStatus: UserStatus
  ) => Promise<MutationResult>;
  deleteUser: (
    userId: string,
    pin: string,
    card: string,
    status: UserStatus
  ) => Promise<MutationResult>;

  // Logs
  subscribeRecentLogs: (
    count: number,
    cb: (logs: LogEntry[]) => void
  ) => () => void;
  subscribeLogs: (
    limit: number,
    cb: (logs: LogEntry[]) => void
  ) => () => void;

  // Optional mock controls (only populated when VITE_USE_MOCK=true)
  mockControls?: MockControls;
}

/**
 * Nạp service theo biến môi trường.
 * Khi VITE_USE_MOCK !== 'true', nhánh import('./mockService') bị loại bỏ hoàn toàn khi build production.
 */
export async function loadSmartLockService(): Promise<SmartLockService> {
  if (import.meta.env.VITE_USE_MOCK === 'true') {
    const { createMockService } = await import('./mockService');
    return createMockService();
  }
  const { createFirebaseService } = await import('./firebaseService');
  return createFirebaseService();
}
