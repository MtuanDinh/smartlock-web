import React from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  preventOutsideClose?: boolean;
  hideCloseButton?: boolean;
  maxWidthClass?: string;
}

export const Dialog: React.FC<DialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  preventOutsideClose = false,
  hideCloseButton = false,
  maxWidthClass = 'max-w-md',
}) => {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm transition-opacity duration-200" />
        <RadixDialog.Content
          onInteractOutside={(e) => {
            if (preventOutsideClose) {
              e.preventDefault();
            }
          }}
          onPointerDownOutside={(e) => {
            if (preventOutsideClose) {
              e.preventDefault();
            }
          }}
          className={`fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border-strong bg-bg-secondary p-6 text-text-primary shadow-2xl focus:outline-none ${maxWidthClass}`}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border-subtle pb-4">
            <div>
              <RadixDialog.Title className="text-lg font-bold text-text-primary flex items-center gap-2">
                {title}
              </RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className="mt-1 text-sm text-text-secondary">
                  {description}
                </RadixDialog.Description>
              ) : (
                <RadixDialog.Description className="sr-only">
                  Hộp thoại thao tác Smart Lock
                </RadixDialog.Description>
              )}
            </div>
            {!hideCloseButton && (
              <RadixDialog.Close asChild>
                <button
                  type="button"
                  aria-label="Đóng hộp thoại"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <X className="h-5 w-5" />
                </button>
              </RadixDialog.Close>
            )}
          </div>

          <div className="py-5">{children}</div>

          {footer && (
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 border-t border-border-subtle pt-4">
              {footer}
            </div>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
};
