import React from 'react';

export type BadgeVariant =
  | 'success'
  | 'danger'
  | 'warning'
  | 'info'
  | 'primary'
  | 'muted';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  icon?: React.ReactNode;
}

const badgeStyles: Record<BadgeVariant, string> = {
  success:
    'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  danger:
    'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
  warning:
    'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  info: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/30',
  primary:
    'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
  muted:
    'bg-bg-elevated text-text-secondary border-border-strong',
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'muted',
  icon,
  className = '',
  children,
  ...rest
}) => {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badgeStyles[variant]} ${className}`}
      {...rest}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
