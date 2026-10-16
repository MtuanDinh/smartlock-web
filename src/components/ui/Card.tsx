import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({
  noPadding = false,
  className = '',
  children,
  ...rest
}) => {
  return (
    <div
      className={`rounded-2xl border border-border-subtle bg-bg-secondary shadow-sm transition-colors duration-200 ${
        noPadding ? '' : 'p-5 sm:p-6'
      } ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
};
