import React, { useEffect, useState } from 'react';
import { CreditCard, Radio, ShieldAlert } from 'lucide-react';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { useSystemStatus } from '../../hooks/useSystemStatus';
import type { LearnCardSnapshot } from '../../lib/learnCardMachine';

export interface LearnCardModalProps {
  state: LearnCardSnapshot;
  onCancel: () => void;
}

export const LearnCardModal: React.FC<LearnCardModalProps> = ({
  state,
  onCancel,
}) => {
  const { mockControls } = useSystemStatus();
  const isOpen =
    state.phase === 'starting' ||
    state.phase === 'waiting_for_scan' ||
    state.phase === 'verifying';

  const [secondsLeft, setSecondsLeft] = useState(60);

  useEffect(() => {
    if (state.phase !== 'waiting_for_scan') {
      setSecondsLeft(60);
      return;
    }
    const id = setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [state.phase]);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && isOpen) {
          onCancel();
        }
      }}
      preventOutsideClose={true}
      hideCloseButton={true}
      maxWidthClass="max-w-md"
      title={
        <span className="mx-auto flex items-center gap-2 text-blue-500">
          <CreditCard className="h-5 w-5" />
          <span>CHẾ ĐỘ HỌC THẺ TỪ</span>
        </span>
      }
      footer={
        <div className="flex w-full justify-center">
          <Button
            variant="danger-outline"
            onClick={onCancel}
            disabled={state.phase === 'verifying'}
          >
            Hủy Giao Dịch
          </Button>
        </div>
      }
    >
      <div className="flex flex-col items-center text-center py-2">
        <p className="text-sm text-text-secondary">
          Đang chờ quét thẻ cho thành viên:{' '}
          <strong className="text-base font-extrabold text-amber-500">
            {state.userName}
          </strong>
        </p>

        {/* Hiệu ứng Radar quét thẻ */}
        <div className="relative my-7 flex h-28 w-28 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-blue-500/20 motion-reduce:hidden" />
          <span className="absolute inset-2 animate-pulse rounded-full border-2 border-blue-500/40" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-blue-600/20 text-blue-500 border border-blue-500/50 shadow-lg">
            <Radio className="h-10 w-10 animate-pulse" />
          </div>
        </div>

        <h4 className="text-base font-bold text-cyan-500">
          {state.phase === 'starting'
            ? 'Đang kích hoạt đầu đọc RFID trên khóa...'
            : state.phase === 'verifying'
              ? 'Đang xác minh dữ liệu thẻ từ...'
              : 'Chạm thẻ từ vào mặt khóa...'}
        </h4>

        <p className="mt-1.5 text-xs text-text-muted">
          Tự động đóng khi quét thành công &bull; Còn lại{' '}
          <span className="font-mono font-bold text-text-secondary">
            {secondsLeft}s
          </span>
        </p>

        {/* Nút hỗ trợ kiểm thử nhanh khi chạy ở chế độ Mock */}
        {mockControls && state.phase === 'waiting_for_scan' && (
          <div className="mt-5 w-full rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-indigo-400">
              Mô phỏng thao tác quẹt thẻ trên khóa (Mock)
            </p>
            <div className="flex justify-center gap-2">
              <Button
                size="sm"
                variant="success"
                onClick={() => mockControls.simulateCardScanSuccess()}
                leftIcon={<CreditCard className="h-3.5 w-3.5" />}
              >
                Quẹt thẻ mới OK
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => mockControls.simulateCardScanDuplicate()}
                leftIcon={<ShieldAlert className="h-3.5 w-3.5" />}
              >
                Quẹt thẻ trùng
              </Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
};
