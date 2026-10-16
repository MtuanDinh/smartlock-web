import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { loadSmartLockService, type SmartLockService } from '../../lib/service';
import { ONLINE_THRESHOLD_MS } from '../../lib/paths';
import type { AuthUser, ConnectionState } from '../../types';

interface FirebaseContextValue {
  service: SmartLockService | null;
  serviceReady: boolean;
  authUser: AuthUser | null;
  authReady: boolean;
  connectionState: ConnectionState;
  isClientConnected: boolean;
  lastBeat: number | null;
  serverTimeOffset: number;
  hasUnsyncedChanges: boolean;
  retryNeedSync: () => Promise<void>;
}

const INITIAL_LOADING_GRACE_MS = 5000;
const STATUS_CHECK_INTERVAL_MS = 3000;

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [service, setService] = useState<SmartLockService | null>(null);
  const [serviceReady, setServiceReady] = useState(false);

  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [connectionState, setConnectionState] =
    useState<ConnectionState>('loading');
  const [isClientConnected, setIsClientConnected] = useState<boolean>(true);
  const [lastBeat, setLastBeat] = useState<number | null>(null);
  const [serverTimeOffset, setServerTimeOffset] = useState<number>(0);
  const [hasUnsyncedChanges, setHasUnsyncedChanges] = useState<boolean>(false);

  // Refs dùng cho tính toán định kỳ mà không gây đăng ký lại listener
  const lastBeatRef = useRef<number | null>(null);
  const offsetRef = useRef<number>(0);
  const rawClientConnectedRef = useRef<boolean>(false);
  const hasSeenClientTrueRef = useRef<boolean>(false);
  const graceExpiredRef = useRef<boolean>(false);
  const hasReceivedBeatRef = useRef<boolean>(false);

  const evaluateStatus = useCallback(() => {
    const effectiveClientConnected =
      rawClientConnectedRef.current ||
      (!hasSeenClientTrueRef.current && !graceExpiredRef.current);

    setIsClientConnected(effectiveClientConnected);

    if (!effectiveClientConnected) {
      setConnectionState('offline');
      return;
    }

    const beat = lastBeatRef.current;
    if (beat === null) {
      if (graceExpiredRef.current) {
        setConnectionState('offline');
      } else {
        setConnectionState('loading');
      }
      return;
    }

    const diff = Date.now() + offsetRef.current - beat;
    if (diff < ONLINE_THRESHOLD_MS) {
      setConnectionState('online');
    } else {
      setConnectionState('offline');
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    loadSmartLockService().then((loadedService) => {
      if (!mounted) return;
      setService(loadedService);
      setServiceReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Lắng nghe Auth
  useEffect(() => {
    if (!service) return;
    const unsubAuth = service.subscribeAuth((user) => {
      setAuthUser(user);
      setAuthReady(true);
    });
    const unsubUnsynced = service.subscribeUnsyncedChanges((unsynced) => {
      setHasUnsyncedChanges(unsynced);
    });
    return () => {
      unsubAuth();
      unsubUnsynced();
    };
  }, [service]);

  // Lắng nghe trạng thái hệ thống khi đã đăng nhập
  useEffect(() => {
    if (!service || !authUser) {
      setConnectionState('loading');
      setIsClientConnected(true);
      return;
    }

    graceExpiredRef.current = false;
    hasSeenClientTrueRef.current = false;
    hasReceivedBeatRef.current = false;

    const graceTimer = setTimeout(() => {
      graceExpiredRef.current = true;
      evaluateStatus();
    }, INITIAL_LOADING_GRACE_MS);

    const unsubClient = service.subscribeClientConnected((connected) => {
      rawClientConnectedRef.current = connected;
      if (connected) {
        hasSeenClientTrueRef.current = true;
      }
      evaluateStatus();
    });

    const unsubOffset = service.subscribeServerTimeOffset((offset) => {
      offsetRef.current = offset;
      setServerTimeOffset(offset);
      evaluateStatus();
    });

    const unsubBeat = service.subscribeLastBeat((beat) => {
      lastBeatRef.current = beat;
      setLastBeat(beat);
      if (beat !== null) {
        hasReceivedBeatRef.current = true;
      }
      evaluateStatus();
    });

    const intervalId = setInterval(evaluateStatus, STATUS_CHECK_INTERVAL_MS);

    return () => {
      clearTimeout(graceTimer);
      clearInterval(intervalId);
      unsubClient();
      unsubOffset();
      unsubBeat();
    };
  }, [service, authUser, evaluateStatus]);

  const retryNeedSync = useCallback(async () => {
    if (!service) return;
    await service.triggerNeedSync();
  }, [service]);

  return (
    <FirebaseContext.Provider
      value={{
        service,
        serviceReady,
        authUser,
        authReady: serviceReady && authReady,
        connectionState,
        isClientConnected,
        lastBeat,
        serverTimeOffset,
        hasUnsyncedChanges,
        retryNeedSync,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
};

export function useFirebaseContext(): FirebaseContextValue {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error('useFirebaseContext must be used within a FirebaseProvider');
  }
  return ctx;
}
