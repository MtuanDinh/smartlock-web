import React, { useState } from 'react';
import {
  Lock,
  Unlock,
  ShieldAlert,
  ShieldCheck,
  WifiOff,
  RotateCcw,
  Send,
  Loader2,
  Smartphone,
  ExternalLink,
} from 'lucide-react';
import { useSystemStatus } from '../../hooks/useSystemStatus';
import { useLockControl } from '../../hooks/useLockControl';
import { LastBeatCounter } from '../../components/layout/LastBeatCounter';
import { Button } from '../../components/ui/Button';
import { Switch } from '../../components/ui/Switch';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

export const LockStatusHero: React.FC = () => {
  const {
    connectionState,
    isClientConnected,
    lastBeat,
    serverTimeOffset,
  } = useSystemStatus();

  const {
    isLockdown,
    isBiometricMode,
    isSendingOpen,
    remoteOpenAck,
    isRestarting,
    isTogglingLockdown,
    isTogglingBiometric,
    openDoorRemotely,
    setLockdownState,
    setBiometricModeState,
    restartSystem,
  } = useLockControl();

  const [confirmLockdownOpen, setConfirmLockdownOpen] = useState(false);
  const [confirmRestartOpen, setConfirmRestartOpen] = useState(false);
  const [confirmOpenDuringLockdown, setConfirmOpenDuringLockdown] =
    useState(false);

  const canControl = isClientConnected && connectionState === 'online';

  const disabledReason = !isClientConnected
    ? 'Điện thoại/trình duyệt đang mất kết nối Internet.'
    : connectionState !== 'online'
      ? 'Ổ khóa đang mất kết nối. Các nút điều khiển từ xa tạm khóa.'
      : undefined;

  // Thứ tự ưu tiên trạng thái lớn:
  // 1. ĐANG KẾT NỐI...
  // 2. ĐIỆN THOẠI/TRÌNH DUYỆT MẤT MẠNG
  // 3. Ổ KHÓA MẤT KẾT NỐI
  // 4. THIẾT BỊ ĐÃ NHẬN LỆNH MỞ (3s) -> ưu tiên hơn ĐANG KHÓA CHẶT
  // 5. ĐANG KHÓA CHẶT
  // 6. CỬA ĐANG ĐÓNG
  let heroConfig: {
    circleClass: string;
    sonarClass: string;
    title: string;
    titleClass: string;
    subtext: string;
    icon: React.ReactNode;
    coreClass: string;
    coreSub?: string;
    pingClass: string;
    bgGlowClass: string;
    topHairlineClass: string;
    hasPulse: boolean;
  };

  if (connectionState === 'loading') {
    heroConfig = {
      circleClass:
        'border-primary/35 bg-primary/10 text-primary shadow-xl shadow-blue-500/15',
      sonarClass: 'border-primary/35 bg-primary/5',
      title: 'ĐANG KẾT NỐI HỆ THỐNG...',
      titleClass: 'text-on-surface-variant',
      subtext: 'Đang đồng bộ trạng thái trực tuyến từ ổ khóa thông minh.',
      icon: <Loader2 className="h-8 w-8 sm:h-9 sm:w-9 animate-spin text-white drop-shadow-sm" />,
      coreClass:
        'bg-gradient-to-tr from-blue-700 via-primary to-sky-400 text-white shadow-lg shadow-blue-500/30 ring-1 ring-white/30',
      coreSub: 'Đang tải',
      pingClass: 'bg-primary/25',
      bgGlowClass: 'bg-blue-500/15',
      topHairlineClass: 'via-blue-500/75',
      hasPulse: true,
    };
  } else if (!isClientConnected) {
    heroConfig = {
      circleClass:
        'border-amber-500/40 bg-amber-500/12 text-warning shadow-xl shadow-amber-500/15',
      sonarClass: 'border-amber-500/40 bg-amber-500/5',
      title: 'ĐIỆN THOẠI/TRÌNH DUYỆT MẤT MẠNG',
      titleClass: 'text-warning dark:text-amber-400',
      subtext:
        'Thiết bị của bạn đang mất kết nối Internet. Các nút điều khiển tạm khóa.',
      icon: <WifiOff className="h-8 w-8 sm:h-9 sm:w-9 text-white drop-shadow-sm" />,
      coreClass:
        'bg-gradient-to-tr from-amber-600 via-amber-500 to-orange-400 text-white shadow-lg shadow-amber-500/35 ring-1 ring-white/30',
      coreSub: 'Mất mạng',
      pingClass: 'bg-amber-500/25',
      bgGlowClass: 'bg-amber-500/20',
      topHairlineClass: 'via-amber-500/75',
      hasPulse: true,
    };
  } else if (connectionState === 'offline') {
    heroConfig = {
      circleClass:
        'border-slate-400/50 dark:border-slate-500/45 bg-slate-500/10 dark:bg-slate-400/10 text-outline shadow-xl shadow-slate-500/15',
      sonarClass: 'border-slate-400/45 dark:border-slate-500/40 bg-slate-400/5',
      title: 'Ổ KHÓA MẤT KẾT NỐI',
      titleClass: 'text-on-surface-variant dark:text-slate-300',
      subtext: 'Ổ khóa không gửi nhịp tim trong 35 giây qua. Các nút điều khiển tạm khóa.',
      icon: <WifiOff className="h-8 w-8 sm:h-9 sm:w-9 text-white drop-shadow-sm" />,
      coreClass:
        'bg-gradient-to-tr from-slate-700 via-slate-600 to-slate-400 dark:from-slate-800 dark:via-slate-700 dark:to-slate-500 text-white shadow-lg shadow-slate-600/30 ring-1 ring-white/25',
      coreSub: 'Ngoại tuyến',
      pingClass: 'bg-slate-400/25 dark:bg-slate-500/25',
      bgGlowClass: 'bg-slate-500/15',
      topHairlineClass: 'via-slate-400/75',
      hasPulse: true,
    };
  } else if (remoteOpenAck) {
    heroConfig = {
      circleClass:
        'border-emerald-500/45 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shadow-xl shadow-emerald-500/25',
      sonarClass: 'border-emerald-500/45 bg-emerald-500/10',
      title: 'THIẾT BỊ ĐÃ NHẬN LỆNH MỞ',
      titleClass: 'text-emerald-600 dark:text-emerald-400',
      subtext: 'Ổ khóa đã nhận lệnh mở và kích hoạt relay trong 3 giây.',
      icon: <Unlock className="h-8 w-8 sm:h-9 sm:w-9 text-white drop-shadow-sm" />,
      coreClass:
        'bg-gradient-to-tr from-emerald-600 via-teal-500 to-emerald-400 text-white shadow-lg shadow-emerald-500/40 ring-1 ring-white/30',
      coreSub: 'Đã mở khóa',
      pingClass: 'bg-emerald-500/30',
      bgGlowClass: 'bg-emerald-500/25',
      topHairlineClass: 'via-emerald-500/80',
      hasPulse: true,
    };
  } else if (isLockdown) {
    heroConfig = {
      circleClass:
        'border-rose-500/45 bg-rose-500/15 text-error shadow-xl shadow-rose-500/25',
      sonarClass: 'border-rose-500/45 bg-rose-500/10',
      title: 'ĐANG KHÓA CHẶT',
      titleClass: 'text-error dark:text-rose-400',
      subtext:
        'Chế độ an ninh cao nhất: Đã vô hiệu hóa bàn phím số và đầu đọc thẻ RFID.',
      icon: <ShieldAlert className="h-8 w-8 sm:h-9 sm:w-9 text-white drop-shadow-sm" />,
      coreClass:
        'bg-gradient-to-tr from-rose-600 via-red-600 to-pink-500 text-white shadow-lg shadow-rose-500/40 ring-1 ring-white/30',
      coreSub: 'Khóa chặt',
      pingClass: 'bg-rose-500/30',
      bgGlowClass: 'bg-rose-500/25',
      topHairlineClass: 'via-rose-500/80',
      hasPulse: true,
    };
  } else {
    heroConfig = {
      circleClass:
        'border-primary/35 bg-primary/12 text-primary shadow-xl shadow-blue-500/20',
      sonarClass: 'border-primary/40 bg-primary/5',
      title: 'CỬA ĐANG ĐÓNG',
      titleClass: 'text-on-surface',
      subtext: 'Hệ thống an ninh đang hoạt động bình thường. Mở khóa sẽ nhả chốt 3 giây.',
      icon: <Lock className="h-8 w-8 sm:h-9 sm:w-9 text-white drop-shadow-sm" />,
      coreClass:
        'bg-gradient-to-tr from-blue-600 via-primary to-sky-400 text-white shadow-lg shadow-blue-500/35 ring-1 ring-white/30',
      coreSub: 'Đã chốt',
      pingClass: 'bg-primary/25',
      bgGlowClass: 'bg-blue-500/20',
      topHairlineClass: 'via-blue-500/80',
      hasPulse: true,
    };
  }

  const handleOpenDoorClick = () => {
    if (!canControl) return;
    if (isLockdown) {
      setConfirmOpenDuringLockdown(true);
      return;
    }
    void openDoorRemotely();
  };

  const handleLockdownClick = () => {
    if (!canControl) return;
    if (!isLockdown) {
      setConfirmLockdownOpen(true);
    } else {
      void setLockdownState(false);
    }
  };

  return (
    <>
      <div className="card-glass relative overflow-hidden flex h-full flex-col justify-between rounded-2xl p-6 sm:p-8 text-center shadow-sm">
        {/* Top Specular Refraction Hairline */}
        <div
          className={`pointer-events-none absolute inset-x-10 top-0 h-[2px] bg-gradient-to-r from-transparent ${heroConfig.topHairlineClass} to-transparent opacity-85 transition-colors duration-500`}
          aria-hidden="true"
        />

        {/* Ambient Top Glow for Hero */}
        <div
          className={`pointer-events-none absolute inset-x-0 -top-16 h-52 rounded-full ${heroConfig.bgGlowClass} blur-3xl transition-colors duration-500`}
          aria-hidden="true"
        />

        <div className="flex flex-col items-center relative z-10">
          <div className="mb-4">
            <LastBeatCounter
              lastBeat={lastBeat}
              serverTimeOffset={serverTimeOffset}
            />
          </div>

          {/* Synchronized Multi-Ring Lock Visual Controller ("Thu ra mở vào") */}
          <div className="my-6 relative flex items-center justify-center">
            {/* 1. Luminous breathing aura halo */}
            {heroConfig.hasPulse && (
              <div
                className={`absolute h-44 w-44 sm:h-48 sm:w-48 rounded-full ${heroConfig.pingClass} animate-lock-aura pointer-events-none blur-xl`}
                aria-hidden="true"
              />
            )}

            {/* 2. Dual Staggered Sonar Wave Rings (Lan tỏa & thu mở nhịp nhàng) */}
            {heroConfig.hasPulse && (
              <>
                <div
                  className={`absolute h-44 w-44 sm:h-48 sm:w-48 rounded-full border-2 ${heroConfig.sonarClass} animate-lock-sonar pointer-events-none`}
                  aria-hidden="true"
                />
                <div
                  className={`absolute h-44 w-44 sm:h-48 sm:w-48 rounded-full border ${heroConfig.sonarClass} animate-lock-sonar-delayed pointer-events-none`}
                  aria-hidden="true"
                />
              </>
            )}

            {/* 3. Outer Breathing Ring */}
            <div
              className={`relative z-10 flex h-44 w-44 sm:h-48 sm:w-48 items-center justify-center rounded-full border-2 backdrop-blur-xs transition-colors duration-500 ${heroConfig.circleClass} ${
                heroConfig.hasPulse ? 'animate-lock-breathe' : ''
              }`}
            >
              {/* 4. Middle Frosted Glass Ring */}
              <div
                className={`flex h-32 w-32 sm:h-36 sm:w-36 items-center justify-center rounded-full bg-white/85 dark:bg-slate-900/85 border border-white/90 dark:border-white/10 shadow-lg backdrop-blur-md transition-all ${
                  heroConfig.hasPulse ? 'animate-lock-breathe-middle' : ''
                }`}
              >
                {/* 5. Inner 3D Core Sphere */}
                <div
                  className={`flex h-24 w-24 sm:h-28 sm:w-28 flex-col items-center justify-center rounded-full px-2 shadow-[inset_0_2px_4px_rgba(255,255,255,0.35)] transition-transform duration-500 hover:scale-105 ${heroConfig.coreClass} ${
                    heroConfig.hasPulse ? 'animate-lock-breathe-core' : ''
                  }`}
                >
                  {heroConfig.icon}
                  {heroConfig.coreSub && (
                    <span className="mt-1 text-[9px] sm:text-[10px] font-extrabold uppercase tracking-normal leading-none text-white/95 whitespace-nowrap drop-shadow-xs">
                      {heroConfig.coreSub}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <h2
            className={`mt-2 text-2xl font-extrabold tracking-tight transition-colors duration-200 ${heroConfig.titleClass}`}
          >
            {heroConfig.title}
          </h2>
          <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-on-surface-variant">
            {heroConfig.subtext}
          </p>
        </div>

        {/* Hành động chính: Mở khóa từ xa */}
        <div className="mt-7 space-y-4 relative z-10">
          <div>
            <Button
              variant="primary"
              size="xl"
              fullWidth
              disabled={!canControl || remoteOpenAck}
              isLoading={isSendingOpen}
              disabledTooltip={disabledReason}
              onClick={handleOpenDoorClick}
              className="h-14 rounded-xl text-base font-bold shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:shadow-xl active:scale-[0.98] transition-all duration-150"
              leftIcon={
                remoteOpenAck ? (
                  <Send className="h-5 w-5" />
                ) : (
                  <Unlock className="h-5 w-5" />
                )
              }
            >
              {isSendingOpen
                ? 'ĐANG GỬI LỆNH...'
                : remoteOpenAck
                  ? 'ĐÃ GỬI LỆNH MỞ'
                  : 'MỞ KHÓA TỪ XA'}
            </Button>
          </div>

          {/* Nhóm hành động hệ thống / khẩn cấp */}
          <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low/50 p-3 sm:p-4 shadow-sm backdrop-blur-sm">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-outline">
              Điều khiển hệ thống &amp; khẩn cấp
            </p>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <Button
                variant="secondary"
                size="md"
                fullWidth
                disabled={!canControl || isRestarting}
                disabledTooltip={disabledReason}
                onClick={() => setConfirmRestartOpen(true)}
                className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest font-semibold text-on-surface hover:bg-surface-container-high text-xs"
                leftIcon={
                  <RotateCcw
                    className={`h-4 w-4 ${isRestarting ? 'animate-spin' : ''}`}
                  />
                }
              >
                {isRestarting ? 'Đang chờ...' : 'Khởi Động'}
              </Button>

              <Button
                variant={isLockdown ? 'secondary' : 'danger'}
                size="md"
                fullWidth
                disabled={!canControl}
                isLoading={isTogglingLockdown}
                disabledTooltip={disabledReason}
                onClick={handleLockdownClick}
                className={`rounded-xl font-bold text-xs ${
                  isLockdown
                    ? 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : 'bg-error text-white shadow-sm'
                }`}
                leftIcon={
                  isLockdown ? (
                    <ShieldCheck className="h-4 w-4" />
                  ) : (
                    <ShieldAlert className="h-4 w-4" />
                  )
                }
              >
                {isLockdown ? 'Mở Trở Lại' : 'KHÓA CHẶT'}
              </Button>
            </div>

            {/* Chế độ Xác thực Sinh trắc học Kép (Giọng nói SpeechBrain + Khuôn mặt Cam sau HD) */}
            <div className="mt-3 pt-3 border-t border-outline-variant/25 flex items-center justify-between gap-2 text-left">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <Smartphone className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-xs font-bold text-on-surface truncate">
                    Sinh trắc học (Giọng nói + Mặt HD)
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-outline">
                    {isBiometricMode
                      ? 'Trạm ĐT (/kiosk) đang bật tự động'
                      : 'Đang tạm tắt xác thực từ ĐT'}
                  </span>
                  <a
                    href={
                      window.location.hostname === 'localhost' ||
                      window.location.hostname === '127.0.0.1'
                        ? `http://${window.location.hostname}:8000/kiosk`
                        : `https://${window.location.hostname}:8443/kiosk`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-0.5 text-[10px] font-bold text-primary hover:underline"
                  >
                    <span>Mở /kiosk</span>
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
              </div>
              <Switch
                checked={isBiometricMode}
                onCheckedChange={(checked) => void setBiometricModeState(checked)}
                disabled={!isClientConnected || isTogglingBiometric}
                ariaLabel="Bật hoặc tắt mở khóa bằng Giọng nói và Khuôn mặt"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Dialog xác nhận bật Khóa Chặt */}
      <ConfirmDialog
        open={confirmLockdownOpen}
        onOpenChange={setConfirmLockdownOpen}
        title="Bật chế độ Khóa Khẩn Cấp?"
        description="CẢNH BÁO: Chế độ Khóa Khẩn Cấp sẽ vô hiệu hóa hoàn toàn bàn phím số và đầu đọc thẻ từ trên ổ khóa. Bạn có chắc chắn muốn kích hoạt?"
        confirmText="Bật Khóa Chặt"
        confirmVariant="danger"
        isLoading={isTogglingLockdown}
        onConfirm={() => {
          setConfirmLockdownOpen(false);
          void setLockdownState(true);
        }}
      />

      {/* Dialog xác nhận Khởi động lại */}
      <ConfirmDialog
        open={confirmRestartOpen}
        onOpenChange={setConfirmRestartOpen}
        title="Khởi động lại mạch cứng?"
        description="Khởi động lại mạch cứng (Wemos D1 Mini & Arduino Uno) sẽ gây gián đoạn hoạt động khoảng 10 giây. Bạn có chắc chắn muốn tiếp tục?"
        confirmText="Khởi động lại"
        confirmVariant="primary"
        onConfirm={() => {
          setConfirmRestartOpen(false);
          void restartSystem();
        }}
      />

      {/* Dialog xác nhận Mở khóa từ xa khi đang Khóa Chặt */}
      <ConfirmDialog
        open={confirmOpenDuringLockdown}
        onOpenChange={setConfirmOpenDuringLockdown}
        title="Mở cửa khi đang Khóa Chặt?"
        description="Hệ thống hiện đang ở chế độ KHÓA CHẶT khẩn cấp. Bạn vẫn muốn gửi lệnh mở khóa từ xa cho khách vào?"
        confirmText="Vẫn mở cửa"
        confirmVariant="success"
        onConfirm={() => {
          setConfirmOpenDuringLockdown(false);
          void openDoorRemotely();
        }}
      />
    </>
  );
};
