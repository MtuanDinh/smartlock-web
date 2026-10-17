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
    expectedPassphrase?: string
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
  const [secondsLeft, setSecondsLeft] = useState(120);

  const isEnrollingThisUser =
    enrollState.active && Boolean(user && enrollState.userId === user.id);

  // Đếm ngược 120s khi đang chờ thu mẫu trên điện thoại
  useEffect(() => {
    if (!isEnrollingThisUser) {
      setSecondsLeft(120);
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
        /* GIAO DIỆN ĐỢI ĐIỆN THOẠI THU GIỌNG NÓI (AUTO TRANSCRIPT) / CHỤP CAM SAU HD */
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
              <span>1. Thu Tiếng &amp; Transcript</span>
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

          <div className="space-y-1.5">
            <h4 className="text-base font-extrabold text-primary">
              {enrollState.step === 'waiting_voice'
                ? 'Hãy nói một câu mật khẩu bất kỳ vào Mic điện thoại...'
                : 'Có 10s căn chỉnh: Đặt mặt vào Khung Mô Hình trên Camera sau (HD)...'}
            </h4>
            {enrollState.expectedPassphrase &&
              enrollState.step === 'waiting_face' && (
                <p className="text-xs font-mono font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-1 inline-block">
                  Transcript đã lưu: &ldquo;{enrollState.expectedPassphrase}&rdquo;
                </p>
              )}
            <p className="text-xs text-on-surface-variant max-w-sm">
              {enrollState.message ||
                'Điện thoại sẽ tự động thu tiếng, xử lý Transcript câu nói của người dùng và gửi lưu lên Server mà không cần nhập trước.'}
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
                  ? `Transcript đã lưu: "${user.voicePassphrase}"`
                  : 'Tự động trích xuất vector 192-D & Transcript câu nói'}
              </p>
              <div className="flex items-center gap-1.5 pt-1">
                <Button
                  size="sm"
                  variant="secondary"
                  fullWidth
                  disabled={!isClientConnected}
                  onClick={() => void onStartEnroll(user, 'voice', '')}
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
                  onClick={() => void onStartEnroll(user, 'face', '')}
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

          {/* Thông tin cơ chế Tự động nhận diện Transcript (Không cần nhập câu lệnh trước) */}
          <div className="rounded-xl border border-outline-variant/40 bg-surface-container-low/40 p-3.5 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Cơ chế Tự động Nhận diện Câu nói (Auto Transcript)
              </span>
              {user.hasVoice && user.voicePassphrase && (
                <span className="text-[11px] font-mono font-bold text-primary bg-primary/10 border border-primary/25 rounded-md px-2 py-0.5">
                  &ldquo;{user.voicePassphrase}&rdquo;
                </span>
              )}
            </div>
            <p className="text-[11px] text-outline leading-relaxed">
              Bạn <strong>không cần nhập câu lệnh trước</strong>. Khi thu âm trên điện thoại, người dùng chỉ cần nói một câu mật khẩu bất kỳ (tối thiểu 2 từ) &mdash; hệ thống sẽ tự động xử lý <strong>Transcript</strong> câu vừa nói và lưu kèm đặc trưng giọng nói 192 chiều lên Server.
            </p>
          </div>

          {/* Nút thu trọn bộ Giọng nói + Khuôn mặt liên tiếp trên điện thoại */}
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={!isClientConnected}
            onClick={() => void onStartEnroll(user, 'both', '')}
            className="rounded-xl font-bold shadow-md shadow-blue-500/20"
            leftIcon={<Sparkles className="h-4 w-4" />}
          >
            Thu Cả Giọng Nói (Auto Transcript) &amp; Khuôn Mặt Trên Điện Thoại
          </Button>
        </div>
      )}
    </Dialog>
  );
};
