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
} from 'lucide-react';
import { useSystemStatus } from '../../hooks/useSystemStatus';
import { useLockControl } from '../../hooks/useLockControl';
import { LastBeatCounter } from '../../components/layout/LastBeatCounter';
import { Button } from '../../components/ui/Button';
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
    isSendingOpen,
    remoteOpenAck,
    isRestarting,
    isTogglingLockdown,
    openDoorRemotely,
    setLockdownState,
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
    title: string;
    titleClass: string;
    subtext: string;
    icon: React.ReactNode;
    coreClass: string;
    coreSub?: string;
    pingClass?: string;
    hasPulse: boolean;
  };

  if (connectionState === 'loading') {
    heroConfig = {
      circleClass:
        'border-outline-variant/30 bg-surface-container text-outline',
      title: 'ĐANG KẾT NỐI HỆ THỐNG...',
      titleClass: 'text-on-surface-variant',
      subtext: 'Đang đồng bộ trạng thái trực tuyến từ ổ khóa thông minh.',
      icon: <Loader2 className="h-10 w-10 sm:h-12 sm:w-12 animate-spin text-primary" />,
      coreClass: 'bg-surface-container-high text-outline',
      coreSub: 'Đang tải',
      hasPulse: false,
    };
  } else if (!isClientConnected) {
    heroConfig = {
      circleClass:
        'border-warning/30 bg-warning-container/20 text-warning shadow-lg shadow-amber-500/10',
      title: 'ĐIỆN THOẠI/TRÌNH DUYỆT MẤT MẠNG',
      titleClass: 'text-warning dark:text-amber-400',
      subtext:
        'Thiết bị của bạn đang mất kết nối Internet. Các nút điều khiển tạm khóa.',
      icon: <WifiOff className="h-10 w-10 sm:h-12 sm:w-12 text-white" />,
      coreClass: 'bg-warning text-white shadow-lg shadow-amber-500/30',
      coreSub: 'Mất mạng',
      hasPulse: false,
    };
  } else if (connectionState === 'offline') {
    heroConfig = {
      circleClass:
        'border-outline-variant/40 bg-surface-container-high text-outline shadow-inner',
      title: 'Ổ KHÓA MẤT KẾT NỐI',
      titleClass: 'text-outline',
      subtext: 'Ổ khóa không gửi nhịp tim trong 35 giây qua. Các nút điều khiển tạm khóa.',
      icon: <WifiOff className="h-10 w-10 sm:h-12 sm:w-12 text-outline" />,
      coreClass: 'bg-surface-container-high text-outline',
      coreSub: 'Ngoại tuyến',
      hasPulse: false,
    };
  } else if (remoteOpenAck) {
    heroConfig = {
      circleClass:
        'border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shadow-xl shadow-emerald-500/20 scale-105',
      title: 'THIẾT BỊ ĐÃ NHẬN LỆNH MỞ',
      titleClass: 'text-emerald-600 dark:text-emerald-400',
      subtext: 'Ổ khóa đã nhận lệnh mở và kích hoạt relay trong 3 giây.',
      icon: <Unlock className="h-10 w-10 sm:h-12 sm:w-12 text-white" />,
      coreClass: 'bg-gradient-to-tr from-secondary to-secondary-container text-white shadow-lg shadow-emerald-500/30',
      coreSub: 'Đã mở khóa',
      pingClass: 'bg-emerald-500/30',
      hasPulse: true,
    };
  } else if (isLockdown) {
    heroConfig = {
      circleClass:
        'border-error/40 bg-error-container/30 text-error shadow-xl shadow-red-500/20',
      title: 'ĐANG KHÓA CHẶT',
      titleClass: 'text-error dark:text-rose-400',
      subtext:
        'Chế độ an ninh cao nhất: Đã vô hiệu hóa bàn phím số và đầu đọc thẻ RFID.',
      icon: <ShieldAlert className="h-10 w-10 sm:h-12 sm:w-12 text-white" />,
      coreClass: 'bg-gradient-to-tr from-error to-rose-600 text-white shadow-lg shadow-red-500/30',
      coreSub: 'Khóa chặt',
      pingClass: 'bg-error/30',
      hasPulse: true,
    };
  } else {
    heroConfig = {
      circleClass:
        'border-primary/25 bg-primary/10 text-primary shadow-lg shadow-blue-500/15',
      title: 'CỬA ĐANG ĐÓNG',
      titleClass: 'text-on-surface',
      subtext: 'Hệ thống an ninh đang hoạt động bình thường. Mở khóa sẽ nhả chốt 3 giây.',
      icon: <Lock className="h-10 w-10 sm:h-12 sm:w-12 text-white" />,
      coreClass: 'bg-gradient-to-tr from-primary to-primary-container text-white shadow-lg shadow-blue-500/25',
      coreSub: 'Đã chốt',
      pingClass: 'bg-primary/20',
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
      <div className="flex h-full flex-col justify-between rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 sm:p-8 text-center shadow-sm">
        <div className="flex flex-col items-center">
          <div className="mb-4">
            <LastBeatCounter
              lastBeat={lastBeat}
              serverTimeOffset={serverTimeOffset}
            />
          </div>

          {/* Triple Ring Lock Visual Controller with Pulse/Ping & Aura */}
          <div className="my-5 relative flex items-center justify-center">
            {/* 1. Luminous breathing aura halo (thu ra mở vào rõ nét) */}
            {heroConfig.hasPulse && (
              <div
                className={`absolute h-40 w-40 sm:h-44 sm:w-44 rounded-full ${heroConfig.pingClass} animate-lock-aura pointer-events-none blur-md`}
                aria-hidden="true"
              />
            )}

            {/* 2. Animated outer wave ripple (lan tỏa như radar / ping wave) */}
            {heroConfig.hasPulse && (
              <div
                className={`absolute h-40 w-40 sm:h-44 sm:w-44 rounded-full ${heroConfig.pingClass} animate-ping opacity-40 pointer-events-none motion-reduce:hidden`}
                aria-hidden="true"
              />
            )}

            {/* 3. Main Triple Ring with breathing animation */}
            <div
              className={`relative z-10 flex h-40 w-40 sm:h-44 sm:w-44 items-center justify-center rounded-full border-2 transition-colors duration-300 ${heroConfig.circleClass} ${
                heroConfig.hasPulse ? 'animate-lock-breathe' : ''
              }`}
            >
              <div className="flex h-28 w-28 sm:h-32 sm:w-32 items-center justify-center rounded-full bg-surface-container-lowest shadow-md transition-all">
                <div
                  className={`flex h-20 w-20 sm:h-24 sm:w-24 flex-col items-center justify-center rounded-full transition-transform duration-500 hover:scale-105 ${heroConfig.coreClass}`}
                >
                  {heroConfig.icon}
                  {heroConfig.coreSub && (
                    <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider mt-0.5 opacity-90">
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
        <div className="mt-7 space-y-4">
          <div>
            <Button
              variant="primary"
              size="xl"
              fullWidth
              disabled={!canControl || remoteOpenAck}
              isLoading={isSendingOpen}
              disabledTooltip={disabledReason}
              onClick={handleOpenDoorClick}
              className="h-14 rounded-xl text-base font-bold shadow-lg shadow-blue-500/25 transition-all"
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
          <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low/60 p-3 sm:p-4">
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
