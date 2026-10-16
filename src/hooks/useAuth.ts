import { useCallback, useState } from 'react';
import { useFirebaseContext } from '../app/providers/FirebaseProvider';
import { useToast } from '../app/providers/ToastProvider';

export function translateFirebaseAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: string }).code)
      : '';

  switch (code) {
    case 'auth/invalid-email':
      return 'Địa chỉ email không hợp lệ.';
    case 'auth/user-disabled':
      return 'Tài khoản quản trị này đã bị vô hiệu hóa.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Sai tài khoản email hoặc mật khẩu bảo mật!';
    case 'auth/too-many-requests':
      return 'Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau ít phút.';
    case 'auth/network-request-failed':
      return 'Không thể kết nối máy chủ xác thực. Vui lòng kiểm tra kết nối mạng.';
    default:
      return 'Sai tài khoản hoặc mật khẩu, hoặc lỗi kết nối hệ thống!';
  }
}

export function useAuth() {
  const { service, authUser, authReady } = useFirebaseContext();
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const signIn = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      if (!service) return false;
      if (!email.trim() || !password) {
        setLoginError('Vui lòng nhập đầy đủ email và mật khẩu bảo mật.');
        return false;
      }

      setIsSubmitting(true);
      setLoginError(null);
      try {
        await service.signIn(email, password);
        showToast({
          title: 'Đăng nhập thành công',
          description: 'Chào mừng quay trở lại bảng điều khiển Smart Lock.',
          variant: 'success',
        });
        return true;
      } catch (err) {
        const message = translateFirebaseAuthError(err);
        setLoginError(message);
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [service, showToast]
  );

  const signOut = useCallback(async () => {
    if (!service) return;
    try {
      await service.signOut();
      showToast({
        title: 'Đã đăng xuất',
        description: 'Bạn đã thoát khỏi phiên làm việc an toàn.',
        variant: 'info',
      });
    } catch {
      showToast({
        title: 'Lỗi đăng xuất',
        description: 'Không thể đăng xuất vào lúc này, vui lòng thử lại.',
        variant: 'error',
      });
    }
  }, [service, showToast]);

  return {
    user: authUser,
    authReady,
    isSubmitting,
    loginError,
    clearLoginError: () => setLoginError(null),
    signIn,
    signOut,
  };
}
