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
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md transition-opacity duration-200" />
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
          className={`card-glass fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 text-on-surface shadow-2xl focus:outline-none transition-all duration-200 ${maxWidthClass}`}
        >
          <div className="flex items-start justify-between gap-4 border-b border-outline-variant/30 pb-4">
            <div>
              <RadixDialog.Title className="text-lg font-bold text-on-surface flex items-center gap-2">
                {title}
              </RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className="mt-1 text-xs text-on-surface-variant">
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
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-outline hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <X className="h-5 w-5" />
                </button>
              </RadixDialog.Close>
            )}
          </div>

          <div className="py-5">{children}</div>

          {footer && (
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 border-t border-outline-variant/30 pt-4">
              {footer}
            </div>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
};
