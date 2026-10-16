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
import { Card } from '../../components/ui/Card';
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
  };

  if (connectionState === 'loading') {
    heroConfig = {
      circleClass:
        'bg-slate-500/15 border-slate-500/30 text-slate-400',
      title: 'ĐANG KẾT NỐI HỆ THỐNG...',
      titleClass: 'text-text-secondary',
      subtext: 'Đang đồng bộ trạng thái trực tuyến từ ổ khóa thông minh.',
      icon: <Loader2 className="h-14 w-14 animate-spin" />,
    };
  } else if (!isClientConnected) {
    heroConfig = {
      circleClass:
        'bg-amber-500/15 border-amber-500/40 text-amber-500 shadow-lg shadow-amber-950/20',
      title: 'ĐIỆN THOẠI/TRÌNH DUYỆT MẤT MẠNG',
      titleClass: 'text-amber-500',
      subtext:
        'Thiết bị của bạn đang mất kết nối Internet. Các nút điều khiển tạm khóa.',
      icon: <WifiOff className="h-14 w-14" />,
    };
  } else if (connectionState === 'offline') {
    heroConfig = {
      circleClass:
        'bg-slate-500/15 border-slate-500/40 text-slate-400 shadow-inner',
      title: 'Ổ KHÓA MẤT KẾT NỐI',
      titleClass: 'text-slate-400 dark:text-slate-300',
      subtext: 'Ổ khóa ngoại tuyến. Các nút điều khiển tạm khóa.',
      icon: <WifiOff className="h-14 w-14" />,
    };
  } else if (remoteOpenAck) {
    heroConfig = {
      circleClass:
        'bg-emerald-500/20 border-emerald-500/50 text-emerald-500 shadow-xl shadow-emerald-950/30 scale-105',
      title: 'THIẾT BỊ ĐÃ NHẬN LỆNH MỞ',
      titleClass: 'text-emerald-500',
      subtext: 'Ổ khóa đã nhận và thực thi lệnh mở cửa từ xa.',
      icon: <Unlock className="h-14 w-14" />,
    };
  } else if (isLockdown) {
    heroConfig = {
      circleClass:
        'bg-rose-500/20 border-rose-500/50 text-rose-500 shadow-xl shadow-rose-950/30',
      title: 'ĐANG KHÓA CHẶT',
      titleClass: 'text-rose-500',
      subtext:
        'Hệ thống an ninh cảnh giác cao. Vô hiệu hóa bàn phím cứng và thẻ từ.',
      icon: <ShieldAlert className="h-14 w-14" />,
    };
  } else {
    heroConfig = {
      circleClass:
        'bg-blue-500/15 border-blue-500/40 text-blue-500 shadow-lg shadow-blue-950/20',
      title: 'CỬA ĐANG ĐÓNG',
      titleClass: 'text-text-primary',
      subtext: 'Hệ thống an ninh đang hoạt động bình thường.',
      icon: <Lock className="h-14 w-14" />,
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
      <Card className="flex h-full flex-col justify-between p-6 sm:p-8 text-center">
        <div className="flex flex-col items-center">
          <div className="mb-4">
            <LastBeatCounter
              lastBeat={lastBeat}
              serverTimeOffset={serverTimeOffset}
            />
          </div>

          <div
            className={`my-4 flex h-32 w-32 items-center justify-center rounded-full border-2 transition-all duration-300 ${heroConfig.circleClass}`}
          >
            {heroConfig.icon}
          </div>

          <h2
            className={`mt-2 text-2xl font-extrabold tracking-tight transition-colors duration-200 ${heroConfig.titleClass}`}
          >
            {heroConfig.title}
          </h2>
          <p className="mt-1.5 max-w-sm text-sm text-text-secondary">
            {heroConfig.subtext}
          </p>
        </div>

        {/* Hành động chính: Mở khóa từ xa */}
        <div className="mt-7 space-y-5">
          <div>
            <Button
              variant="success"
              size="xl"
              fullWidth
              disabled={!canControl || remoteOpenAck}
              isLoading={isSendingOpen}
              disabledTooltip={disabledReason}
              onClick={handleOpenDoorClick}
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

          {/* Nhóm hành động hệ thống / nguy hiểm (tách riêng) */}
          <div className="rounded-2xl border border-border-subtle bg-bg-primary/60 p-3.5">
            <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-text-muted">
              Điều khiển hệ thống &amp; khẩn cấp
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <Button
                variant="secondary"
                size="md"
                fullWidth
                disabled={!canControl || isRestarting}
                disabledTooltip={disabledReason}
                onClick={() => setConfirmRestartOpen(true)}
                leftIcon={
                  <RotateCcw
                    className={`h-4 w-4 ${isRestarting ? 'animate-spin' : ''}`}
                  />
                }
              >
                {isRestarting ? 'Đang chờ...' : 'Khởi Động'}
              </Button>

              <Button
                variant={isLockdown ? 'danger-outline' : 'danger'}
                size="md"
                fullWidth
                disabled={!canControl}
                isLoading={isTogglingLockdown}
                disabledTooltip={disabledReason}
                onClick={handleLockdownClick}
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
      </Card>

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
