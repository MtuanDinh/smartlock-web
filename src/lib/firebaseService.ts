import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
} from 'firebase/auth';
import {
  ref as fbRef,
  set as fbSet,
  update as fbUpdate,
  get as fbGet,
  remove as fbRemove,
  onValue as fbOnValue,
  onDisconnect as fbOnDisconnect,
  query as fbQuery,
  orderByChild as fbOrderByChild,
  limitToLast as fbLimitToLast,
  type Database,
  type DatabaseReference,
  type DataSnapshot,
  type Query,
} from 'firebase/database';
import { getFirebaseInstances } from './firebase';
import { PATHS } from './paths';
import {
  buildAddUserUpdates,
  buildChangePinUpdates,
  buildDeleteUserUpdates,
  buildEditNameUpdates,
  buildToggleStatusUpdates,
} from './userMutations';
import type { SmartLockService } from './service';
import type {
  LogEntry,
  MutationResult,
  User,
} from '../types';

export const UI_WRITE_TIMEOUT_MS = 8000;

export interface FirebaseDbDeps {
  db: Database;
  ref: (db: Database, path?: string) => DatabaseReference;
  set: (ref: DatabaseReference, value: unknown) => Promise<void>;
  update: (ref: DatabaseReference, values: Record<string, unknown>) => Promise<void>;
  get: (query: Query) => Promise<DataSnapshot>;
  remove: (ref: DatabaseReference) => Promise<void>;
  onValue: (
    query: Query,
    callback: (snapshot: DataSnapshot) => void
  ) => () => void;
  onDisconnect: (ref: DatabaseReference) => {
    set: (value: unknown) => Promise<void>;
    cancel: () => Promise<void>;
  };
  query: (query: Query, ...constraints: unknown[]) => Query;
  orderByChild: (path: string) => unknown;
  limitToLast: (limit: number) => unknown;
  now?: () => number;
  writeTimeoutMs?: number;
}

/**
 * Đua một promise ghi dữ liệu với UI timeout.
 * Lưu ý quan trọng: Write timeout KHÔNG hủy bỏ promise gốc của Firebase SDK.
 */
export async function raceWithUiTimeout(
  writePromise: Promise<unknown>,
  timeoutMs: number
): Promise<'settled' | 'timed_out'> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<'timed_out'>((resolve) => {
    timer = setTimeout(() => resolve('timed_out'), timeoutMs);
  });

  try {
    const outcome = await Promise.race([
      writePromise.then(() => 'settled' as const),
      timeoutPromise,
    ]);
    return outcome;
  } finally {
    if (timer !== null) {
      clearTimeout(timer);
    }
  }
}

export function createFirebaseService(
  customDeps?: Partial<FirebaseDbDeps>
): SmartLockService {
  const getDefaultDb = () => getFirebaseInstances().db;
  const deps: FirebaseDbDeps = {
    get db() {
      return customDeps?.db ?? getDefaultDb();
    },
    ref: customDeps?.ref ?? fbRef,
    set: customDeps?.set ?? fbSet,
    update:
      customDeps?.update ??
      ((r, v) => fbUpdate(r, v as Record<string, unknown>)),
    get: customDeps?.get ?? fbGet,
    remove: customDeps?.remove ?? fbRemove,
    onValue: customDeps?.onValue ?? ((q, cb) => fbOnValue(q, cb)),
    onDisconnect: customDeps?.onDisconnect ?? ((r) => fbOnDisconnect(r)),
    query:
      customDeps?.query ??
      ((q, ...c) =>
        fbQuery(q, ...(c as Parameters<typeof fbQuery> extends [Query, ...infer R] ? R : never))),
    orderByChild: customDeps?.orderByChild ?? fbOrderByChild,
    limitToLast: customDeps?.limitToLast ?? fbLimitToLast,
    now: customDeps?.now ?? (() => Date.now()),
    writeTimeoutMs: customDeps?.writeTimeoutMs ?? UI_WRITE_TIMEOUT_MS,
  };

  let hasUnsyncedChanges = false;
  const unsyncedListeners = new Set<(val: boolean) => void>();

  function setUnsyncedState(next: boolean) {
    hasUnsyncedChanges = next;
    unsyncedListeners.forEach((cb) => cb(hasUnsyncedChanges));
  }

  /**
   * Kích hoạt đồng bộ cache trên ESP8266 bằng chuỗi cạnh lên:
   * set(Need_Sync, false) -> set(Need_Sync, true) (không dùng timer).
   */
  async function triggerNeedSync(): Promise<void> {
    const syncRef = deps.ref(deps.db, PATHS.CONTROL.NEED_SYNC);
    await deps.set(syncRef, false);
    await deps.set(syncRef, true);
    setUnsyncedState(false);
  }

  /**
   * Thực thi multi-path update cho thao tác thành viên:
   * - Gắn .then(() => triggerNeedSync()) trực tiếp vào updatePromise gốc để kể cả khi
   *   updatePromise vượt quá thời gian chờ UI (queued offline), ngay khi mạng thông và
   *   updatePromise hoàn tất thì triggerNeedSync vẫn được gọi.
   * - Nếu update() thành công nhưng triggerNeedSync() lỗi, bật hasUnsyncedChanges = true
   *   và trả về status: 'unsynced' để UI hiện thanh thử lại.
   */
  async function executeUserMutation(
    updates: Record<string, unknown>
  ): Promise<MutationResult> {
    const rootRef = deps.ref(deps.db);
    const updatePromise = deps.update(rootRef, updates);

    // Gắn chuỗi đồng bộ vào chính updatePromise gốc
    const syncChainPromise = updatePromise.then(async () => {
      try {
        await triggerNeedSync();
        return 'completed' as const;
      } catch {
        setUnsyncedState(true);
        return 'unsynced' as const;
      }
    });

    const updateRace = await raceWithUiTimeout(
      updatePromise,
      deps.writeTimeoutMs ?? UI_WRITE_TIMEOUT_MS
    );

    if (updateRace === 'timed_out') {
      // Không coi là thất bại; giữ chuỗi syncChainPromise chạy ngầm
      void syncChainPromise.catch(() => {
        // Nếu updatePromise về sau bị lỗi server từ chối
      });
      return { status: 'queued_offline' };
    }

    // updatePromise đã thành công trong thời gian cho phép, chờ tiếp kết quả triggerNeedSync
    const syncRace = await raceWithUiTimeout(
      syncChainPromise,
      deps.writeTimeoutMs ?? UI_WRITE_TIMEOUT_MS
    );

    if (syncRace === 'timed_out') {
      setUnsyncedState(true);
      return { status: 'unsynced' };
    }

    const finalStatus = await syncChainPromise;
    return { status: finalStatus };
  }

  /**
   * Thực thi lệnh điều khiển bằng cạnh lên (false -> true) cho Remote_Open và Restart.
   */
  async function executeRisingEdgeControl(
    controlPath: string
  ): Promise<MutationResult> {
    const targetRef = deps.ref(deps.db, controlPath);
    const risingEdgePromise = (async () => {
      await deps.set(targetRef, false);
      await deps.set(targetRef, true);
    })();

    const race = await raceWithUiTimeout(
      risingEdgePromise,
      deps.writeTimeoutMs ?? UI_WRITE_TIMEOUT_MS
    );
    if (race === 'timed_out') {
      void risingEdgePromise.catch(() => {});
      return { status: 'queued_offline' };
    }
    await risingEdgePromise;
    return { status: 'completed' };
  }

  return {
    subscribeAuth(cb) {
      const { auth } = getFirebaseInstances();
      return onAuthStateChanged(auth, (user) => {
        if (user) {
          cb({ uid: user.uid, email: user.email });
        } else {
          cb(null);
        }
      });
    },

    async signIn(email, password) {
      const { auth } = getFirebaseInstances();
      await signInWithEmailAndPassword(auth, email.trim(), password);
    },

    async signOut() {
      const { auth } = getFirebaseInstances();
      await fbSignOut(auth);
    },

    subscribeClientConnected(cb) {
      const connectedRef = deps.ref(deps.db, PATHS.INFO_CONNECTED);
      return deps.onValue(connectedRef, (snap) => {
        cb(Boolean(snap.val()));
      });
    },

    subscribeServerTimeOffset(cb) {
      const offsetRef = deps.ref(deps.db, PATHS.INFO_OFFSET);
      return deps.onValue(offsetRef, (snap) => {
        cb(Number(snap.val()) || 0);
      });
    },

    subscribeLastBeat(cb) {
      const beatRef = deps.ref(deps.db, PATHS.SYSTEM_LAST_BEAT);
      return deps.onValue(beatRef, (snap) => {
        const val = snap.val();
        cb(typeof val === 'number' && val > 0 ? val : null);
      });
    },

    subscribeUnsyncedChanges(cb) {
      unsyncedListeners.add(cb);
      cb(hasUnsyncedChanges);
      return () => {
        unsyncedListeners.delete(cb);
      };
    },

    subscribeLockdown(cb) {
      const lockdownRef = deps.ref(deps.db, PATHS.CONTROL.LOCKDOWN);
      return deps.onValue(lockdownRef, (snap) => {
        cb(Boolean(snap.val()));
      });
    },

    subscribeRemoteOpen(cb) {
      const remoteOpenRef = deps.ref(deps.db, PATHS.CONTROL.REMOTE_OPEN);
      return deps.onValue(remoteOpenRef, (snap) => {
        cb(Boolean(snap.val()));
      });
    },

    async setLockdown(enabled) {
      const lockdownRef = deps.ref(deps.db, PATHS.CONTROL.LOCKDOWN);
      const p = deps.set(lockdownRef, enabled);
      const race = await raceWithUiTimeout(
        p,
        deps.writeTimeoutMs ?? UI_WRITE_TIMEOUT_MS
      );
      if (race === 'timed_out') {
        void p.catch(() => {});
        return { status: 'queued_offline' };
      }
      await p;
      return { status: 'completed' };
    },

    async triggerRemoteOpen() {
      return executeRisingEdgeControl(PATHS.CONTROL.REMOTE_OPEN);
    },

    async triggerRestart() {
      return executeRisingEdgeControl(PATHS.CONTROL.RESTART);
    },

    triggerNeedSync,

    subscribeUsers(cb) {
      const usersRef = deps.ref(deps.db, PATHS.USERS);
      return deps.onValue(usersRef, (snap) => {
        const list: User[] = [];
        snap.forEach((child) => {
          const val = child.val();
          if (val && typeof val === 'object' && child.key) {
            list.push({
              id: child.key,
              name: String(val.name ?? ''),
              pass: val.pass !== undefined && val.pass !== null ? String(val.pass) : '',
              card: val.card !== undefined && val.card !== null ? String(val.card) : '',
              status: val.status === 'disabled' ? 'disabled' : 'active',
            });
          }
        });
        cb(list);
      });
    },

    async addUser(name, pin) {
      const userId = `user_${deps.now ? deps.now() : Date.now()}`;
      const updates = buildAddUserUpdates(userId, name, pin);
      return executeUserMutation(updates);
    },

    async editUserName(userId, newName, pin, card, status) {
      const updates = buildEditNameUpdates(userId, newName, pin, card, status);
      return executeUserMutation(updates);
    },

    async changeUserPin(userId, userName, oldPin, newPin, status) {
      const updates = buildChangePinUpdates(
        userId,
        userName,
        oldPin,
        newPin,
        status
      );
      return executeUserMutation(updates);
    },

    async toggleUserStatus(userId, userName, pin, card, newStatus) {
      const updates = buildToggleStatusUpdates(
        userId,
        userName,
        pin,
        card,
        newStatus
      );
      return executeUserMutation(updates);
    },

    async deleteUser(userId, pin, card, status) {
      const updates = buildDeleteUserUpdates(userId, pin, card, status);
      return executeUserMutation(updates);
    },

    // Learn Card Adapter Methods
    async registerAddCardDisconnectCleanup() {
      const modeRef = deps.ref(deps.db, PATHS.CONTROL.ADD_CARD_MODE);
      await deps.onDisconnect(modeRef).set(false);
    },

    async cancelAddCardDisconnectCleanup() {
      const modeRef = deps.ref(deps.db, PATHS.CONTROL.ADD_CARD_MODE);
      await deps.onDisconnect(modeRef).cancel();
    },

    async setAddCardMode(enabled) {
      const modeRef = deps.ref(deps.db, PATHS.CONTROL.ADD_CARD_MODE);
      await deps.set(modeRef, enabled);
    },

    async setLearnCardTarget(userId, userName) {
      const rootRef = deps.ref(deps.db);
      await deps.update(rootRef, {
        [PATHS.CONTROL.TARGET_USER]: userId,
        [PATHS.CONTROL.TARGET_NAME]: userName,
      });
    },

    subscribeAddCardMode(cb) {
      const modeRef = deps.ref(deps.db, PATHS.CONTROL.ADD_CARD_MODE);
      return deps.onValue(modeRef, (snap) => {
        cb(Boolean(snap.val()));
      });
    },

    async getUserCard(userId) {
      const cardRef = deps.ref(deps.db, PATHS.USER_CARD(userId));
      const snap = await deps.get(cardRef);
      const val = snap.val();
      return val !== undefined && val !== null ? String(val) : '';
    },

    async removeOldRfidAndSync(oldCard) {
      const cleanOld = String(oldCard ?? '').trim();
      if (!cleanOld) return;
      const rfidRef = deps.ref(deps.db, PATHS.RFID_ITEM(cleanOld));
      const removePromise = deps.remove(rfidRef);
      await removePromise.then(async () => {
        try {
          await triggerNeedSync();
        } catch {
          setUnsyncedState(true);
        }
      });
    },

    // Logs
    subscribeRecentLogs(count, cb) {
      const logsRef = deps.ref(deps.db, PATHS.LOGS);
      const recentQuery = deps.query(
        logsRef,
        deps.orderByChild('timestamp'),
        deps.limitToLast(count)
      );
      return deps.onValue(recentQuery, (snap) => {
        const list: LogEntry[] = [];
        snap.forEach((child) => {
          const val = child.val();
          if (val && typeof val === 'object' && child.key) {
            list.push({
              id: child.key,
              action: String(val.action ?? ''),
              user: String(val.user ?? ''),
              timestamp: Number(val.timestamp) || 0,
            });
          }
        });
        list.sort((a, b) => b.timestamp - a.timestamp);
        cb(list);
      });
    },

    subscribeLogs(limit, cb) {
      const logsRef = deps.ref(deps.db, PATHS.LOGS);
      const logsQuery = deps.query(
        logsRef,
        deps.orderByChild('timestamp'),
        deps.limitToLast(limit)
      );
      return deps.onValue(logsQuery, (snap) => {
        const list: LogEntry[] = [];
        snap.forEach((child) => {
          const val = child.val();
          if (val && typeof val === 'object' && child.key) {
            list.push({
              id: child.key,
              action: String(val.action ?? ''),
              user: String(val.user ?? ''),
              timestamp: Number(val.timestamp) || 0,
            });
          }
        });
        list.sort((a, b) => b.timestamp - a.timestamp);
        cb(list);
      });
    },
  };
}
