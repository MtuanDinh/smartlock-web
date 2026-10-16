import React, { useId } from 'react';
import { Loader2 } from 'lucide-react';
import { Tooltip } from './Tooltip';

export type ButtonVariant =
  | 'primary'
  | 'success'
  | 'danger'
  | 'danger-outline'
  | 'secondary'
  | 'ghost';

export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  fullWidth?: boolean;
  disabledTooltip?: string;
  leftIcon?: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-blue-600 text-white hover:bg-blue-500 active:bg-blue-700 shadow-sm shadow-blue-950/30 border border-blue-500/30',
  success:
    'bg-emerald-600 text-white hover:bg-emerald-500 active:bg-emerald-700 shadow-md shadow-emerald-950/30 border border-emerald-500/30',
  danger:
    'bg-rose-600 text-white hover:bg-rose-500 active:bg-rose-700 shadow-sm shadow-rose-950/30 border border-rose-500/30',
  'danger-outline':
    'bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border border-rose-500/50',
  secondary:
    'bg-bg-elevated text-text-primary hover:bg-border-subtle border border-border-strong shadow-sm',
  ghost:
    'bg-transparent text-text-secondary hover:bg-bg-elevated hover:text-text-primary border border-transparent',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'min-h-[38px] px-3 py-1.5 text-xs rounded-lg gap-1.5',
  md: 'min-h-[44px] px-4 py-2 text-sm rounded-xl gap-2',
  lg: 'min-h-[48px] px-5 py-2.5 text-base rounded-2xl gap-2.5',
  xl: 'min-h-[56px] px-6 py-3.5 text-lg rounded-2xl gap-3',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      fullWidth = false,
      disabled,
      disabledTooltip,
      leftIcon,
      className = '',
      children,
      ...rest
    },
    ref
  ) => {
    const tooltipId = useId();
    const isDisabled = Boolean(disabled || isLoading);

    const buttonEl = (
      <button
        ref={ref}
        type={rest.type ?? 'button'}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        aria-describedby={isDisabled && disabledTooltip ? tooltipId : undefined}
        className={`inline-flex items-center justify-center font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary ${
          variantClasses[variant]
        } ${sizeClasses[size]} ${fullWidth ? 'w-full' : ''} ${
          isDisabled
            ? 'opacity-50 cursor-not-allowed pointer-events-none'
            : 'hover:-translate-y-0.5 active:translate-y-0'
        } ${className}`}
        {...rest}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        <span>{children}</span>
      </button>
    );

    if (isDisabled && disabledTooltip) {
      return (
        <Tooltip id={tooltipId} content={disabledTooltip}>
          <span
            tabIndex={0}
            role="group"
            aria-disabled="true"
            aria-describedby={tooltipId}
            className={`inline-flex cursor-not-allowed rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              fullWidth ? 'w-full' : ''
            }`}
          >
            {buttonEl}
          </span>
        </Tooltip>
      );
    }

    return buttonEl;
  }
);

Button.displayName = 'Button';
