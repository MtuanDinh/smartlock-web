import React, { useEffect, useState } from 'react';
import {
  Mic,
  Camera,
  Smartphone,
  Sparkles,
  CheckCircle2,
  Trash2,
  Radio,
  ExternalLink,
} from 'lucide-react';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { useSystemStatus } from '../../hooks/useSystemStatus';
import type {
  BiometricEnrollCommand,
  BiometricEnrollTarget,
  User,
} from '../../types';

export interface BiometricEnrollModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  enrollState: BiometricEnrollCommand;
  isClientConnected: boolean;
  onStartEnroll: (
    user: User,
    target: BiometricEnrollTarget,
    expectedPassphrase: string
  ) => Promise<void>;
  onCancelEnroll: () => Promise<void>;
  onClearBiometrics: (user: User, target: BiometricEnrollTarget) => Promise<void>;
}

export const BiometricEnrollModal: React.FC<BiometricEnrollModalProps> = ({
  open,
  onOpenChange,
  user,
  enrollState,
  isClientConnected,
  onStartEnroll,
  onCancelEnroll,
  onClearBiometrics,
}) => {
  const { mockControls } = useSystemStatus();
  const [passphrase, setPassphrase] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(60);

  const isEnrollingThisUser =
    enrollState.active && Boolean(user && enrollState.userId === user.id);

  useEffect(() => {
    if (open && user) {
      setPassphrase(
        user.voicePassphrase || `mở cửa cho ${user.name.toLowerCase()}`
      );
    }
  }, [open, user]);

  // Tự động đóng modal khi điện thoại thu mẫu hoàn tất
  useEffect(() => {
    if (
      open &&
      user &&
      !enrollState.active &&
      enrollState.step === 'completed' &&
      enrollState.userId === user.id
    ) {
      const timer = setTimeout(() => {
        onOpenChange(false);
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [open, user, enrollState, onOpenChange]);

  // Đếm ngược 60s khi đang chờ thu mẫu trên điện thoại
  useEffect(() => {
    if (!isEnrollingThisUser) {
      setSecondsLeft(60);
      return;
    }
    const id = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          void onCancelEnroll();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isEnrollingThisUser, onCancelEnroll]);

  if (!user) return null;

  const isLocal =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';
  const kioskUrl = isLocal
    ? `http://${window.location.hostname}:8000/kiosk`
    : `https://${window.location.hostname}:8443/kiosk`;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && isEnrollingThisUser) {
          void onCancelEnroll();
        }
        onOpenChange(nextOpen);
      }}
      maxWidthClass="max-w-lg"
      title={
        <span className="flex items-center gap-2 text-primary">
          <Smartphone className="h-5 w-5" />
          <span>Sinh Trắc Học Qua Điện Thoại ({user.name})</span>
        </span>
      }
      footer={
        isEnrollingThisUser ? (
          <div className="flex w-full justify-center">
            <Button variant="danger-outline" onClick={() => void onCancelEnroll()}>
              Hủy Thu Mẫu Trên Điện Thoại
            </Button>
          </div>
        ) : (
          <div className="flex w-full items-center justify-between gap-2">
            <a
              href={kioskUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              <span>Mở trang /kiosk (Điện thoại)</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Đóng
            </Button>
          </div>
        )
      }
    >
      {isEnrollingThisUser ? (
        /* GIAO DIỆN ĐANG ĐỢI ĐIỆN THOẠI THU GIỌNG NÓI / CHỤP CAM SAU HD */
        <div className="flex flex-col items-center text-center py-3 space-y-4">
          <p className="text-xs text-on-surface-variant">
            Đã phát lệnh thu mẫu xuống <strong>Trạm Điện Thoại (/kiosk)</strong> cho:{' '}
            <strong className="font-extrabold text-amber-500">{user.name}</strong>
          </p>

          {/* Chỉ báo 2 bước trên điện thoại */}
          <div className="grid grid-cols-2 gap-2 w-full max-w-sm text-xs font-bold">
            <div
              className={`rounded-xl py-2 px-3 border flex items-center justify-center gap-1.5 ${
                enrollState.step === 'waiting_voice'
                  ? 'border-blue-500/50 bg-blue-500/15 text-blue-500'
                  : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500'
              }`}
            >
              <Mic className="h-3.5 w-3.5" />
              <span>1. Thu Giọng Nói</span>
            </div>
            <div
              className={`rounded-xl py-2 px-3 border flex items-center justify-center gap-1.5 ${
                enrollState.step === 'waiting_face'
                  ? 'border-sky-500/60 bg-sky-500/15 text-sky-500'
                  : 'border-outline-variant/40 bg-surface-container-low text-outline'
              }`}
            >
              <Camera className="h-3.5 w-3.5" />
              <span>2. Cam Sau (HD)</span>
            </div>
          </div>

          {/* Radar Animation */}
          <div className="relative my-3 flex h-28 w-28 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-blue-500/20 motion-reduce:hidden" />
            <span className="absolute inset-2 animate-pulse rounded-full border-2 border-blue-500/40" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-blue-600/20 text-blue-500 border border-blue-500/50 shadow-lg">
              {enrollState.step === 'waiting_face' ? (
                <Camera className="h-10 w-10 animate-pulse" />
              ) : (
                <Mic className="h-10 w-10 animate-pulse" />
              )}
            </div>
          </div>

          <div className="space-y-1">
            <h4 className="text-base font-extrabold text-primary">
              {enrollState.step === 'waiting_voice'
                ? 'Hãy đọc câu mật khẩu vào Mic điện thoại...'
                : 'Hãy nhìn vào Camera sau (HD) của điện thoại...'}
            </h4>
            {enrollState.expectedPassphrase &&
              enrollState.step === 'waiting_voice' && (
                <p className="text-xs font-mono font-bold text-amber-500 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-1 inline-block">
                  &ldquo;{enrollState.expectedPassphrase}&rdquo;
                </p>
              )}
            <p className="text-xs text-on-surface-variant max-w-sm">
              {enrollState.message ||
                'Điện thoại đang tự động thu âm (VAD) và chụp khuôn mặt bằng Camera sau độ phân giải cao.'}
            </p>
          </div>

          <p className="text-xs text-outline">
            Tự động lưu &amp; đóng khi hoàn tất &bull; Còn lại{' '}
            <span className="font-mono font-bold text-on-surface">
              {secondsLeft}s
            </span>
          </p>

          {/* Nút mô phỏng dành cho chế độ Mock */}
          {mockControls?.simulatePhoneBiometricCapture && (
            <div className="mt-3 w-full rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-indigo-400">
                Mô phỏng thao tác thu mẫu trên Điện thoại (Mock)
              </p>
              <Button
                size="sm"
                variant="success"
                onClick={() => mockControls.simulatePhoneBiometricCapture?.()}
                leftIcon={<Radio className="h-3.5 w-3.5" />}
              >
                {enrollState.step === 'waiting_voice'
                  ? 'Giả lập: Đã nói vào Mic điện thoại OK'
                  : 'Giả lập: Đã chụp khuôn mặt Cam sau HD OK'}
              </Button>
            </div>
          )}
        </div>
      ) : (
        /* GIAO DIỆN QUẢN LÝ & KÍCH HOẠT THU MẪU QUA ĐIỆN THOẠI */
        <div className="space-y-4">
          {/* Trạng thái hiện tại của Giọng nói & Khuôn mặt */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Thẻ trạng thái Giọng nói */}
            <div className="rounded-xl border border-outline-variant/40 bg-surface-container-low/60 p-3.5 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-on-surface">
                  <Mic className="h-4 w-4 text-blue-500" />
                  <span>Giọng nói (SpeechBrain)</span>
                </span>
                {user.hasVoice ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    <CheckCircle2 className="h-3 w-3" />
                    Đã có mẫu
                  </span>
                ) : (
                  <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-bold text-outline">
                    Chưa đăng ký
                  </span>
                )}
              </div>
              <p className="text-[11px] text-on-surface-variant truncate">
                {user.hasVoice && user.voicePassphrase
                  ? `Câu lệnh: "${user.voicePassphrase}"`
                  : 'Vector 192 chiều + Câu nói mật khẩu'}
              </p>
              <div className="flex items-center gap-1.5 pt-1">
                <Button
                  size="sm"
                  variant="secondary"
                  fullWidth
                  disabled={!isClientConnected}
                  onClick={() =>
                    void onStartEnroll(user, 'voice', passphrase)
                  }
                  className="text-xs"
                  leftIcon={<Mic className="h-3.5 w-3.5" />}
                >
                  {user.hasVoice ? 'Thu lại giọng' : '+ Thu giọng nói'}
                </Button>
                {user.hasVoice && (
                  <button
                    type="button"
                    title="Xóa mẫu giọng nói"
                    disabled={!isClientConnected}
                    onClick={() => void onClearBiometrics(user, 'voice')}
                    className="p-2 rounded-lg text-outline hover:text-error hover:bg-error-container/20 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Thẻ trạng thái Khuôn mặt */}
            <div className="rounded-xl border border-outline-variant/40 bg-surface-container-low/60 p-3.5 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-on-surface">
                  <Camera className="h-4 w-4 text-sky-500" />
                  <span>Khuôn mặt (FaceNet)</span>
                </span>
                {user.hasFace ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    <CheckCircle2 className="h-3 w-3" />
                    Đã có mẫu
                  </span>
                ) : (
                  <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-bold text-outline">
                    Chưa đăng ký
                  </span>
                )}
              </div>
              <p className="text-[11px] text-on-surface-variant">
                Vector 512 chiều chụp từ Camera sau HD
              </p>
              <div className="flex items-center gap-1.5 pt-1">
                <Button
                  size="sm"
                  variant="secondary"
                  fullWidth
                  disabled={!isClientConnected}
                  onClick={() =>
                    void onStartEnroll(user, 'face', passphrase)
                  }
                  className="text-xs"
                  leftIcon={<Camera className="h-3.5 w-3.5" />}
                >
                  {user.hasFace ? 'Chụp lại mặt' : '+ Chụp khuôn mặt'}
                </Button>
                {user.hasFace && (
                  <button
                    type="button"
                    title="Xóa mẫu khuôn mặt"
                    disabled={!isClientConnected}
                    onClick={() => void onClearBiometrics(user, 'face')}
                    className="p-2 rounded-lg text-outline hover:text-error hover:bg-error-container/20 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Thiết lập câu nói mật khẩu cho Bước 1 */}
          <div className="rounded-xl border border-outline-variant/40 bg-surface-container-low/40 p-3.5 space-y-2">
            <label
              htmlFor="bio-passphrase-input"
              className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant"
            >
              Câu nói mật khẩu (Dùng để đối chiếu ở Bước 1)
            </label>
            <input
              id="bio-passphrase-input"
              type="text"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder={`VD: mở cửa cho ${user.name.toLowerCase()}`}
              className="min-h-[40px] w-full rounded-xl border border-outline-variant/50 bg-surface-container-lowest px-3.5 py-2 text-xs text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <p className="text-[11px] text-outline leading-relaxed">
              Khi mở khóa, hệ thống yêu cầu <strong>đúng giọng của {user.name}</strong> VÀ <strong>đọc đúng câu mật khẩu này</strong> thì mới bật Camera sau xác thực khuôn mặt.
            </p>
          </div>

          {/* Nút thu trọn bộ Giọng nói + Khuôn mặt liên tiếp trên điện thoại */}
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={!isClientConnected}
            onClick={() => void onStartEnroll(user, 'both', passphrase)}
            className="rounded-xl font-bold shadow-md shadow-blue-500/20"
            leftIcon={<Sparkles className="h-4 w-4" />}
          >
            Thu Cả Giọng Nói &amp; Khuôn Mặt (Cam Sau HD) Trên Điện Thoại
          </Button>
        </div>
      )}
    </Dialog>
  );
};
