import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFirebaseContext } from '../app/providers/FirebaseProvider';
import { useToast } from '../app/providers/ToastProvider';
import {
  createLearnCardController,
  type LearnCardSnapshot,
} from '../lib/learnCardMachine';
import type {
  BiometricEnrollCommand,
  BiometricEnrollTarget,
  MutationResult,
  User,
  UserStatus,
} from '../types';

export function useUsers() {
  const { service, authUser, connectionState, isClientConnected } =
    useFirebaseContext();
  const { showToast } = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [isSubmittingModal, setIsSubmittingModal] = useState(false);

  const [learnCardState, setLearnCardState] = useState<LearnCardSnapshot>({
    phase: 'idle',
    userId: '',
    userName: '',
    initialCard: '',
    needsCancelRecovery: false,
  });

  const [biometricEnrollState, setBiometricEnrollState] =
    useState<BiometricEnrollCommand>({
      active: false,
      userId: '',
      userName: '',
      target: 'both',
      expectedPassphrase: '',
      step: 'idle',
      message: '',
      updatedAt: 0,
    });

  const prevBioActiveRef = useRef(false);

  const controllerRef = useRef<ReturnType<
    typeof createLearnCardController
  > | null>(null);

  // Khởi tạo controller học thẻ
  useEffect(() => {
    if (!service) return;
    const ctrl = createLearnCardController({
      service,
      timeoutMs: 60000,
      onStateChange: (snapshot) => {
        setLearnCardState(snapshot);

        if (snapshot.phase === 'succeeded') {
          showToast({
            title: 'Gán thẻ từ thành công!',
            description: `Đã cấp thẻ mới (${snapshot.newCard}) cho ${snapshot.userName}.`,
            variant: 'success',
          });
        } else if (snapshot.phase === 'failed_duplicate') {
          showToast({
            title: 'Thẻ từ bị từ chối',
            description:
              snapshot.errorMessage ||
              'Thẻ từ này đã được cấp cho thành viên khác.',
            variant: 'error',
          });
        } else if (snapshot.phase === 'timeout') {
          showToast({
            title: 'Đã hết thời gian chờ quét thẻ (60 giây)',
            description: 'Phiên học thẻ đã tự động đóng.',
            variant: 'warning',
          });
        } else if (snapshot.phase === 'offline_aborted') {
          showToast({
            title: 'Ổ khóa mất kết nối',
            description:
              'Đã hủy phiên học thẻ. Hệ thống sẽ tự động làm sạch trạng thái khi khóa online trở lại.',
            variant: 'warning',
          });
        } else if (snapshot.phase === 'error') {
          showToast({
            title: 'Lỗi chế độ học thẻ',
            description:
              snapshot.errorMessage || 'Không thể giao tiếp với ổ khóa.',
            variant: 'error',
          });
        }
      },
    });

    controllerRef.current = ctrl;
    return () => {
      ctrl.resetToIdle();
      controllerRef.current = null;
    };
  }, [service, showToast]);

  // Đồng bộ trạng thái kết nối của khóa vào learnCardController (hủy khi offline & gửi xung phục hồi khi online lại)
  useEffect(() => {
    if (!controllerRef.current) return;
    void controllerRef.current.handleConnectionStateChange(connectionState);
  }, [connectionState]);

  // Lắng nghe danh sách thành viên
  useEffect(() => {
    if (!service || !authUser) {
      setUsers([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const unsub = service.subscribeUsers((list) => {
      setUsers(list);
      setIsLoading(false);
    });
    return () => {
      unsub();
    };
  }, [service, authUser]);

  // Lắng nghe trạng thái phiên thu mẫu Sinh trắc học trên Điện thoại Kiosk
  useEffect(() => {
    if (!service || !authUser) return;
    const unsub = service.subscribeBiometricEnroll((state) => {
      setBiometricEnrollState(state);
      if (prevBioActiveRef.current && !state.active && state.step === 'completed') {
        showToast({
          title: 'Đã thu Sinh trắc học từ Điện thoại!',
          description:
            state.message ||
            `Đã cập nhật dữ liệu Giọng nói / Khuôn mặt cho ${state.userName}.`,
          variant: 'success',
        });
      }
      prevBioActiveRef.current = state.active;
    });
    return () => {
      unsub();
    };
  }, [service, authUser, showToast]);

  const existingPasswords = useMemo(() => {
    return users
      .map((u) => String(u.pass ?? '').trim())
      .filter((p) => p !== '');
  }, [users]);

  const handleMutationFeedback = useCallback(
    (res: MutationResult, successTitle: string, successDesc: string) => {
      if (res.status === 'queued_offline') {
        showToast({
          title: 'Đang chờ kết nối, thay đổi sẽ tự áp dụng',
          description:
            'Thao tác đã được lưu vào hàng đợi và sẽ tự đồng bộ khi có mạng.',
          variant: 'info',
        });
      } else if (res.status === 'unsynced') {
        showToast({
          title: 'Đã lưu nhưng chưa đồng bộ xuống ổ khóa',
          description:
            'Dữ liệu thành viên đã lưu nhưng chưa bật được cờ Need_Sync. Hãy bấm "Thử lại" trên thanh cảnh báo.',
          variant: 'warning',
        });
      } else {
        showToast({
          title: successTitle,
          description: successDesc,
          variant: 'success',
        });
      }
    },
    [showToast]
  );

  const addUser = useCallback(
    async (normalizedName: string, pin: string): Promise<string | false> => {
      if (!service || !isClientConnected) return false;
      setIsSubmittingModal(true);
      try {
        const res = await service.addUser(normalizedName, pin);
        handleMutationFeedback(
          res,
          'Đã thêm thành viên mới',
          `Thành viên "${normalizedName}" đã được thêm vào hệ thống.`
        );
        return res.userId || `user_${Date.now()}`;
      } catch {
        showToast({
          title: 'Không thể thêm thành viên',
          description: 'Đã xảy ra lỗi khi lưu dữ liệu lên Firebase.',
          variant: 'error',
        });
        return false;
      } finally {
        setIsSubmittingModal(false);
      }
    },
    [service, isClientConnected, handleMutationFeedback, showToast]
  );

  const editUserName = useCallback(
    async (
      user: User,
      normalizedNewName: string
    ): Promise<boolean> => {
      if (!service || !isClientConnected) return false;
      if (user.status === 'disabled') {
        showToast({
          title: 'Thành viên đang bị khóa',
          description: 'Vui lòng mở khóa thành viên trước khi đổi tên.',
          variant: 'warning',
        });
        return false;
      }
      if (normalizedNewName === user.name) {
        return true;
      }

      setIsSubmittingModal(true);
      try {
        const res = await service.editUserName(
          user.id,
          normalizedNewName,
          user.pass,
          user.card,
          user.status
        );
        handleMutationFeedback(
          res,
          'Đã cập nhật tên thành viên',
          `Đổi tên thành "${normalizedNewName}" thành công.`
        );
        return true;
      } catch {
        showToast({
          title: 'Không thể đổi tên thành viên',
          description: 'Vui lòng kiểm tra kết nối và thử lại.',
          variant: 'error',
        });
        return false;
      } finally {
        setIsSubmittingModal(false);
      }
    },
    [service, isClientConnected, handleMutationFeedback, showToast]
  );

  const changeUserPin = useCallback(
    async (user: User, newPin: string): Promise<boolean> => {
      if (!service || !isClientConnected) return false;
      if (user.status === 'disabled') {
        showToast({
          title: 'Thành viên đang bị khóa',
          description: 'Vui lòng mở khóa thành viên trước khi cập nhật mã PIN.',
          variant: 'warning',
        });
        return false;
      }
      const cleanNew = newPin.trim();
      if (cleanNew === user.pass) {
        return true;
      }

      setIsSubmittingModal(true);
      try {
        const res = await service.changeUserPin(
          user.id,
          user.name,
          user.pass,
          cleanNew,
          user.status
        );
        handleMutationFeedback(
          res,
          cleanNew === '' ? 'Đã xóa mã PIN' : 'Đã cập nhật mã PIN',
          cleanNew === ''
            ? `Đã gỡ mã PIN của "${user.name}".`
            : `Đã lưu mã PIN mới cho "${user.name}".`
        );
        return true;
      } catch {
        showToast({
          title: 'Không thể cập nhật mã PIN',
          description: 'Đã xảy ra lỗi khi lưu mã PIN mới.',
          variant: 'error',
        });
        return false;
      } finally {
        setIsSubmittingModal(false);
      }
    },
    [service, isClientConnected, handleMutationFeedback, showToast]
  );

  const toggleUserStatus = useCallback(
    async (user: User) => {
      if (!service || !isClientConnected) return;
      const nextStatus: UserStatus =
        user.status === 'active' ? 'disabled' : 'active';
      setPendingUserId(user.id);
      try {
        const res = await service.toggleUserStatus(
          user.id,
          user.name,
          user.pass,
          user.card,
          nextStatus
        );
        handleMutationFeedback(
          res,
          nextStatus === 'active'
            ? 'Đã mở quyền truy cập'
            : 'Đã tạm khóa thành viên',
          nextStatus === 'active'
            ? `Khôi phục mã PIN và thẻ từ cho "${user.name}".`
            : `Đã thu hồi tạm thời mã PIN và thẻ từ của "${user.name}".`
        );
      } catch {
        showToast({
          title: 'Không thể thay đổi trạng thái',
          description: 'Vui lòng kiểm tra kết nối mạng và thử lại.',
          variant: 'error',
        });
      } finally {
        setPendingUserId(null);
      }
    },
    [service, isClientConnected, handleMutationFeedback, showToast]
  );

  const deleteUser = useCallback(
    async (user: User): Promise<boolean> => {
      if (!service || !isClientConnected) return false;
      setPendingUserId(user.id);
      try {
        const res = await service.deleteUser(
          user.id,
          user.pass,
          user.card,
          user.status
        );
        handleMutationFeedback(
          res,
          'Đã xóa thành viên',
          `Đã xóa vĩnh viễn "${user.name}" cùng toàn bộ quyền truy cập và dữ liệu sinh trắc học.`
        );
        return true;
      } catch {
        showToast({
          title: 'Không thể xóa thành viên',
          description: 'Đã xảy ra lỗi khi xóa thành viên.',
          variant: 'error',
        });
        return false;
      } finally {
        setPendingUserId(null);
      }
    },
    [service, isClientConnected, handleMutationFeedback, showToast]
  );

  const startLearnCard = useCallback(
    async (user: User) => {
      if (user.status === 'disabled') {
        showToast({
          title: 'Thành viên đang bị khóa',
          description: 'Vui lòng mở khóa thành viên trước khi cấp hoặc đổi thẻ.',
          variant: 'warning',
        });
        return;
      }
      if (!isClientConnected || connectionState !== 'online') {
        showToast({
          title: 'Ổ khóa đang mất kết nối!',
          description: 'Bạn không thể thêm hoặc đổi thẻ từ vào lúc này.',
          variant: 'warning',
        });
        return;
      }
      if (!controllerRef.current) return;
      await controllerRef.current.startSession(user.id, user.name, user.card);
    },
    [isClientConnected, connectionState, showToast]
  );

  const cancelLearnCard = useCallback(async () => {
    if (!controllerRef.current) return;
    await controllerRef.current.cancelSession();
    showToast({
      title: 'Đã hủy chế độ học thẻ',
      description: 'Ổ khóa đã thoát khỏi chế độ quét thẻ mới.',
      variant: 'info',
    });
  }, [showToast]);

  const closeLearnCardModal = useCallback(() => {
    if (!controllerRef.current) return;
    controllerRef.current.resetToIdle();
  }, []);

  const startBiometricEnroll = useCallback(
    async (
      user: { id: string; name: string; status?: UserStatus },
      target: BiometricEnrollTarget,
      expectedPassphrase?: string
    ) => {
      if (!service || !isClientConnected) return;
      if (user.status === 'disabled') {
        showToast({
          title: 'Thành viên đang bị khóa',
          description:
            'Vui lòng mở khóa thành viên trước khi đăng ký Giọng nói / Khuôn mặt.',
          variant: 'warning',
        });
        return;
      }
      try {
        await service.startBiometricEnrollOnPhone({
          userId: user.id,
          userName: user.name,
          target,
          expectedPassphrase: (expectedPassphrase ?? '').trim(),
        });
      } catch {
        showToast({
          title: 'Không thể gửi lệnh thu mẫu xuống điện thoại',
          description: 'Vui lòng kiểm tra kết nối mạng và thử lại.',
          variant: 'error',
        });
      }
    },
    [service, isClientConnected, showToast]
  );

  const cancelBiometricEnroll = useCallback(async () => {
    if (!service) return;
    try {
      await service.cancelBiometricEnrollOnPhone();
      showToast({
        title: 'Đã hủy thu mẫu trên điện thoại',
        description: 'Điện thoại Kiosk đã quay về chế độ trực mở khóa.',
        variant: 'info',
      });
    } catch {
      // ignore
    }
  }, [service, showToast]);

  const clearBiometrics = useCallback(
    async (user: User, target: BiometricEnrollTarget) => {
      if (!service || !isClientConnected) return;
      setPendingUserId(user.id);
      try {
        await service.clearUserBiometrics(user.id, target);
        showToast({
          title: 'Đã xóa dữ liệu Sinh trắc học',
          description: `Đã gỡ dữ liệu ${
            target === 'both'
              ? 'Giọng nói & Khuôn mặt'
              : target === 'voice'
                ? 'Giọng nói'
                : 'Khuôn mặt'
          } của "${user.name}".`,
          variant: 'info',
        });
      } catch {
        showToast({
          title: 'Không thể xóa dữ liệu Sinh trắc học',
          description: 'Vui lòng thử lại sau.',
          variant: 'error',
        });
      } finally {
        setPendingUserId(null);
      }
    },
    [service, isClientConnected, showToast]
  );

  return {
    users,
    isLoading,
    existingPasswords,
    pendingUserId,
    isSubmittingModal,
    learnCardState,
    biometricEnrollState,
    addUser,
    editUserName,
    changeUserPin,
    toggleUserStatus,
    deleteUser,
    startLearnCard,
    cancelLearnCard,
    closeLearnCardModal,
    startBiometricEnroll,
    cancelBiometricEnroll,
    clearBiometrics,
  };
}

