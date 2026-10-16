import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  ...rest
}) => {
  return (
    <div
      className={`animate-pulse rounded-xl bg-bg-elevated/80 ${className}`}
      {...rest}
    />
  );
};
