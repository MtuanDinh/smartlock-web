import { useCallback, useEffect, useRef, useState } from 'react';
import { useFirebaseContext } from '../app/providers/FirebaseProvider';
import { useToast } from '../app/providers/ToastProvider';
import { executeRemoteOpenWithAck } from '../lib/remoteOpenAck';

export function useLockControl() {
  const { service, authUser, connectionState, isClientConnected } =
    useFirebaseContext();
  const { showToast } = useToast();

  const [isLockdown, setIsLockdown] = useState(false);
  const [isSendingOpen, setIsSendingOpen] = useState(false);
  const [remoteOpenAck, setRemoteOpenAck] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [isTogglingLockdown, setIsTogglingLockdown] = useState(false);

  const ackCleanupRef = useRef<(() => void) | null>(null);
  const ackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!service || !authUser) return;
    const unsub = service.subscribeLockdown((lockdown) => {
      setIsLockdown(lockdown);
    });
    return () => {
      unsub();
    };
  }, [service, authUser]);

  useEffect(() => {
    return () => {
      ackCleanupRef.current?.();
      if (ackTimerRef.current) clearTimeout(ackTimerRef.current);
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    };
  }, []);

  const openDoorRemotely = useCallback(async () => {
    if (!service || !isClientConnected || connectionState !== 'online') return;
    if (isSendingOpen) return;

    ackCleanupRef.current?.();
    setIsSendingOpen(true);

    try {
      const { cleanup } = await executeRemoteOpenWithAck({
        triggerRemoteOpen: () => service.triggerRemoteOpen(),
        subscribeRemoteOpen: (cb) => service.subscribeRemoteOpen(cb),
        ackTimeoutMs: 5000,
        onAckConfirmed: () => {
          setIsSendingOpen(false);
          setRemoteOpenAck(true);
          showToast({
            title: 'Thiết bị đã nhận lệnh mở',
            description: 'Ổ khóa đã xác nhận lệnh mở cửa từ xa.',
            variant: 'success',
          });
          if (ackTimerRef.current) clearTimeout(ackTimerRef.current);
          ackTimerRef.current = setTimeout(() => {
            setRemoteOpenAck(false);
          }, 3000);
        },
        onAckUnconfirmed: () => {
          setIsSendingOpen(false);
          showToast({
            title: 'Chưa xác nhận được thiết bị đã nhận lệnh',
            description:
              'Lệnh mở đã được gửi nhưng chưa nhận phản hồi từ khóa. Lệnh vẫn có thể được xử lý khi mạng ổn định.',
            variant: 'warning',
          });
        },
      });
      ackCleanupRef.current = cleanup;
    } catch {
      setIsSendingOpen(false);
      showToast({
        title: 'Không thể gửi lệnh mở khóa',
        description: 'Đã xảy ra lỗi khi ghi dữ liệu lên hệ thống.',
        variant: 'error',
      });
    }
  }, [service, isClientConnected, connectionState, isSendingOpen, showToast]);

  const setLockdownState = useCallback(
    async (nextLockdown: boolean) => {
      if (!service || !isClientConnected || connectionState !== 'online') return;
      setIsTogglingLockdown(true);
      try {
        const res = await service.setLockdown(nextLockdown);
        if (res.status === 'queued_offline') {
          showToast({
            title: 'Đang chờ kết nối, thay đổi sẽ tự áp dụng',
            description: 'Lệnh khóa khẩn cấp đã được xếp hàng đợi.',
            variant: 'info',
          });
        } else {
          showToast({
            title: nextLockdown
              ? 'Đã bật chế độ Khóa Chặt'
              : 'Đã tắt chế độ Khóa Chặt',
            description: nextLockdown
              ? 'Bàn phím cứng và đầu đọc thẻ từ đã bị vô hiệu hóa.'
              : 'Hệ thống an ninh đã trở lại hoạt động bình thường.',
            variant: nextLockdown ? 'warning' : 'success',
          });
        }
      } catch {
        showToast({
          title: 'Lỗi cập nhật trạng thái Khóa Chặt',
          description: 'Vui lòng kiểm tra kết nối và thử lại.',
          variant: 'error',
        });
      } finally {
        setIsTogglingLockdown(false);
      }
    },
    [service, isClientConnected, connectionState, showToast]
  );

  const restartSystem = useCallback(async () => {
    if (!service || !isClientConnected || connectionState !== 'online') return;
    setIsRestarting(true);
    try {
      const res = await service.triggerRestart();
      if (res.status === 'queued_offline') {
        showToast({
          title: 'Chưa xác nhận được thiết bị đã nhận lệnh',
          description:
            'Lệnh khởi động lại đã được gửi và đang chờ thiết bị phản hồi.',
          variant: 'warning',
        });
      } else {
        showToast({
          title: 'Đã gửi lệnh khởi động lại',
          description: 'Mạch cứng sẽ khởi động lại và gián đoạn khoảng 10 giây.',
          variant: 'info',
        });
      }
    } catch {
      showToast({
        title: 'Không thể gửi lệnh khởi động lại',
        description: 'Vui lòng thử lại sau.',
        variant: 'error',
      });
    } finally {
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      restartTimerRef.current = setTimeout(() => {
        setIsRestarting(false);
      }, 3000);
    }
  }, [service, isClientConnected, connectionState, showToast]);

  return {
    isLockdown,
    isSendingOpen,
    remoteOpenAck,
    isRestarting,
    isTogglingLockdown,
    openDoorRemotely,
    setLockdownState,
    restartSystem,
  };
}
