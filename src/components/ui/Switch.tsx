import React, { useId } from 'react';
import * as RadixSwitch from '@radix-ui/react-switch';
import { Tooltip } from './Tooltip';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  disabledTooltip?: string;
  ariaLabel: string;
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onCheckedChange,
  disabled = false,
  disabledTooltip,
  ariaLabel,
}) => {
  const tooltipId = useId();

  const switchEl = (
    <RadixSwitch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      aria-describedby={disabled && disabledTooltip ? tooltipId : undefined}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary ${
        checked ? 'bg-emerald-600' : 'bg-slate-500/50'
      } ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
    >
      <RadixSwitch.Thumb
        className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </RadixSwitch.Root>
  );

  if (disabled && disabledTooltip) {
    return (
      <Tooltip id={tooltipId} content={disabledTooltip}>
        <span
          tabIndex={0}
          role="group"
          aria-disabled="true"
          aria-describedby={tooltipId}
          className="inline-flex cursor-not-allowed rounded-full"
        >
          {switchEl}
        </span>
      </Tooltip>
    );
  }

  return switchEl;
};
