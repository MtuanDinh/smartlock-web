import React, { useEffect, useState } from 'react';
import { KeyRound, AlertCircle } from 'lucide-react';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { validatePin } from '../../lib/validators';
import type { User } from '../../types';

export interface PinModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUser: User | null;
  existingPasswords: string[];
  isSubmitting: boolean;
  isClientConnected: boolean;
  onSubmitPin: (user: User, newPin: string) => Promise<boolean>;
}

export const PinModal: React.FC<PinModalProps> = ({
  open,
  onOpenChange,
  targetUser,
  existingPasswords,
  isSubmitting,
  isClientConnected,
  onSubmitPin,
}) => {
  const [newPin, setNewPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  useEffect(() => {
    if (open && targetUser) {
      setNewPin(targetUser.pass || '');
      setPinError(null);
    }
  }, [open, targetUser]);

  if (!targetUser) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);

    const validation = validatePin(newPin, existingPasswords, targetUser.pass);
    if (!validation.valid) {
      setPinError(validation.error || 'Mã PIN không hợp lệ.');
      return;
    }

    const ok = await onSubmitPin(targetUser, newPin.trim());
    if (ok) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      maxWidthClass="max-w-sm"
      title={
        <>
          <KeyRound className="h-5 w-5 text-amber-500" />
          <span>Cập Nhật Mã PIN</span>
        </>
      }
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Hủy
          </Button>
          <Button
            type="submit"
            form="pin-modal-form"
            variant="success"
            isLoading={isSubmitting}
            disabled={!isClientConnected}
            disabledTooltip={
              !isClientConnected
                ? 'Điện thoại/trình duyệt đang mất kết nối Internet.'
                : undefined
            }
          >
            Xác Nhận Đổi
          </Button>
        </>
      }
    >
      <form id="pin-modal-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="text-center">
          <p className="text-sm text-text-secondary">
            Thành viên:{' '}
            <strong className="font-bold text-blue-500">
              {targetUser.name}
            </strong>
          </p>
        </div>

        <div>
          <label htmlFor="modal-new-pin" className="sr-only">
            Mã PIN mới
          </label>
          <input
            id="modal-new-pin"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            autoFocus
            value={newPin}
            onChange={(e) => {
              setNewPin(e.target.value.replace(/[^0-9]/g, ''));
              if (pinError) setPinError(null);
            }}
            placeholder="----"
            className="min-h-[52px] w-full rounded-xl border border-border-strong bg-bg-elevated px-4 py-2.5 text-center font-mono text-2xl font-extrabold tracking-[0.35em] text-text-primary placeholder:text-text-muted focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
          <p className="mt-2 text-center text-xs text-text-muted">
            Nhập 4–6 chữ số. Bỏ trống và bấm{' '}
            <strong className="text-text-secondary">Xác Nhận Đổi</strong> để xóa
            mã PIN.
          </p>
        </div>

        {pinError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/15 p-3 text-xs font-medium text-rose-600 dark:text-rose-300"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{pinError}</span>
          </div>
        )}
      </form>
    </Dialog>
  );
};
