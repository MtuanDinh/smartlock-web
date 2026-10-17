import { useState, useCallback } from 'react';
import { useFirebaseContext } from '../app/providers/FirebaseProvider';
import { useToast } from '../app/providers/ToastProvider';

export function useSystemStatus() {
  const {
    connectionState,
    isClientConnected,
    lastBeat,
    serverTimeOffset,
    hasUnsyncedChanges,
    retryNeedSync,
    service,
  } = useFirebaseContext();
  const { showToast } = useToast();
  const [isRetryingSync, setIsRetryingSync] = useState(false);

  const handleRetrySync = useCallback(async () => {
    if (!isClientConnected) {
      showToast({
        title: 'Đang mất kết nối Internet',
        description: 'Vui lòng kiểm tra mạng trên thiết bị trước khi thử lại.',
        variant: 'warning',
      });
      return;
    }
    setIsRetryingSync(true);
    try {
      await retryNeedSync();
      showToast({
        title: 'Đã gửi yêu cầu đồng bộ',
        description: 'Đã kích hoạt lại cờ đồng bộ dữ liệu xuống ổ khóa.',
        variant: 'success',
      });
    } catch {
      showToast({
        title: 'Chưa thể đồng bộ',
        description: 'Không thể gửi cờ Need_Sync, vui lòng thử lại.',
        variant: 'error',
      });
    } finally {
      setIsRetryingSync(false);
    }
  }, [isClientConnected, retryNeedSync, showToast]);

  return {
    connectionState,
    isOnline: connectionState === 'online',
    isOffline: connectionState === 'offline',
    isLoadingStatus: connectionState === 'loading',
    isClientConnected,
    lastBeat,
    serverTimeOffset,
    hasUnsyncedChanges,
    isRetryingSync,
    retryNeedSync: handleRetrySync,
    mockControls: service?.mockControls,
  };
}
