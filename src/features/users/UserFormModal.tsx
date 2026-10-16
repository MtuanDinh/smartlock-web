import React, { useEffect, useState } from 'react';
import { UserPlus, UserPen, Sparkles, AlertCircle, Info } from 'lucide-react';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import {
  stripVietnameseDiacritics,
  validatePin,
  validateUserName,
} from '../../lib/validators';
import type { User } from '../../types';

export interface UserFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'add' | 'editName';
  targetUser?: User | null;
  existingPasswords: string[];
  isSubmitting: boolean;
  isClientConnected: boolean;
  onSubmitAdd: (normalizedName: string, pin: string) => Promise<boolean>;
  onSubmitEditName: (user: User, normalizedNewName: string) => Promise<boolean>;
}

export const UserFormModal: React.FC<UserFormModalProps> = ({
  open,
  onOpenChange,
  mode,
  targetUser,
  existingPasswords,
  isSubmitting,
  isClientConnected,
  onSubmitAdd,
  onSubmitEditName,
}) => {
  const [rawName, setRawName] = useState('');
  const [rawPin, setRawPin] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setRawName(mode === 'editName' && targetUser ? targetUser.name : '');
      setRawPin('');
      setFormError(null);
    }
  }, [open, mode, targetUser]);

  const nameCheck = validateUserName(rawName);

  const handleStripDiacritics = () => {
    setRawName((prev) => stripVietnameseDiacritics(prev));
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!nameCheck.valid) {
      setFormError(nameCheck.error || 'Tên thành viên không hợp lệ.');
      return;
    }

    if (mode === 'add') {
      const pinCheck = validatePin(rawPin, existingPasswords);
      if (!pinCheck.valid) {
        setFormError(pinCheck.error || 'Mã PIN không hợp lệ.');
        return;
      }
      const ok = await onSubmitAdd(nameCheck.normalizedName, rawPin.trim());
      if (ok) {
        onOpenChange(false);
      }
    } else if (mode === 'editName' && targetUser) {
      const ok = await onSubmitEditName(targetUser, nameCheck.normalizedName);
      if (ok) {
        onOpenChange(false);
      }
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        mode === 'add' ? (
          <>
            <UserPlus className="h-5 w-5 text-blue-500" />
            <span>Thêm Thành Viên Mới</span>
          </>
        ) : (
          <>
            <UserPen className="h-5 w-5 text-blue-500" />
            <span>Đổi Tên Thành Viên</span>
          </>
        )
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
            form="user-form-modal"
            variant="primary"
            isLoading={isSubmitting}
            disabled={!isClientConnected}
            disabledTooltip={
              !isClientConnected
                ? 'Điện thoại/trình duyệt đang mất kết nối Internet.'
                : undefined
            }
          >
            Lưu Thông Tin
          </Button>
        </>
      }
    >
      <form id="user-form-modal" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label
              htmlFor="modal-user-name"
              className="text-xs font-bold uppercase tracking-wider text-text-secondary"
            >
              Họ và Tên <span className="text-rose-500">*</span>
            </label>
            <span
              className={`text-xs font-mono ${
                nameCheck.normalizedName.length > 16
                  ? 'text-amber-500 font-bold'
                  : 'text-text-muted'
              }`}
            >
              {nameCheck.normalizedName.length}/16 ký tự LCD
            </span>
          </div>

          <input
            id="modal-user-name"
            type="text"
            autoFocus
            value={rawName}
            onChange={(e) => {
              setRawName(e.target.value);
              if (formError) setFormError(null);
            }}
            placeholder="VD: Nguyen Van An"
            className="min-h-[44px] w-full rounded-xl border border-border-strong bg-bg-elevated px-3.5 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />

          {nameCheck.lcdWarning && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300">
              <div className="flex items-start gap-1.5 flex-1">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{nameCheck.lcdWarning}</span>
              </div>
              {nameCheck.hasDiacritics && (
                <button
                  type="button"
                  onClick={handleStripDiacritics}
                  className="inline-flex items-center gap-1 rounded-lg bg-amber-500/20 px-2.5 py-1 font-bold text-amber-800 dark:text-amber-200 hover:bg-amber-500/30"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Chuyển không dấu</span>
                </button>
              )}
            </div>
          )}
        </div>

        {mode === 'add' && (
          <div>
            <label
              htmlFor="modal-user-pin"
              className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-text-secondary"
            >
              Mã PIN mở cửa (Tùy chọn, 4–6 chữ số)
            </label>
            <input
              id="modal-user-pin"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={rawPin}
              onChange={(e) => {
                setRawPin(e.target.value.replace(/[^0-9]/g, ''));
                if (formError) setFormError(null);
              }}
              placeholder="Nhập 4–6 chữ số (bỏ trống nếu chỉ dùng thẻ)"
              className="min-h-[44px] w-full rounded-xl border border-border-strong bg-bg-elevated px-3.5 py-2 font-mono text-sm tracking-widest text-text-primary placeholder:font-sans placeholder:tracking-normal placeholder:text-text-muted focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
            <p className="mt-1 text-xs text-text-muted">
              Hỗ trợ giữ nguyên chữ số 0 ở đầu (VD: 012345).
            </p>
          </div>
        )}

        {formError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/15 p-3 text-xs font-medium text-rose-600 dark:text-rose-300"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}
      </form>
    </Dialog>
  );
};
