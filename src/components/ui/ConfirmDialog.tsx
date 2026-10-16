import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Dialog } from './Dialog';
import { Button, type ButtonVariant } from './Button';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: ButtonVariant;
  isLoading?: boolean;
  onConfirm: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy bỏ',
  confirmVariant = 'danger',
  isLoading = false,
  onConfirm,
}) => {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        <span className="flex items-center gap-2 text-rose-500">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{title}</span>
        </span>
      }
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            variant={confirmVariant}
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-text-secondary">
        {description}
      </div>
    </Dialog>
  );
};
