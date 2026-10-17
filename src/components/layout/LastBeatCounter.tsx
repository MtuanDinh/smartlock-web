import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { formatFullDateTimeVN } from '../../lib/time';
import { Tooltip } from '../ui/Tooltip';

export interface LastBeatCounterProps {
  lastBeat: number | null;
  serverTimeOffset: number;
}

/**
 * Component độc lập cập nhật "Cập nhật lần cuối: X giây trước" mỗi giây
 * để không gây re-render cho DashboardPage hoặc LockStatusHero.
 */
export const LastBeatCounter: React.FC<LastBeatCounterProps> = React.memo(
  ({ lastBeat, serverTimeOffset }) => {
    const [nowMs, setNowMs] = useState(() => Date.now());

    useEffect(() => {
      if (!lastBeat) return;
      setNowMs(Date.now());
      const id = setInterval(() => {
        setNowMs(Date.now());
      }, 1000);
      return () => clearInterval(id);
    }, [lastBeat]);

    if (!lastBeat) {
      return (
        <div className="inline-flex items-center gap-1.5 text-xs text-text-muted">
          <Clock className="h-3.5 w-3.5" />
          <span>Chưa nhận được tín hiệu nhịp tim từ khóa</span>
        </div>
      );
    }

    const diffSeconds = Math.max(
      0,
      Math.floor((nowMs + serverTimeOffset - lastBeat) / 1000)
    );

    let timeLabel = `${diffSeconds} giây trước`;
    if (diffSeconds >= 3600) {
      const hours = Math.floor(diffSeconds / 3600);
      timeLabel = `${hours} giờ trước`;
    } else if (diffSeconds >= 60) {
      const minutes = Math.floor(diffSeconds / 60);
      const remSec = diffSeconds % 60;
      timeLabel = `${minutes} phút ${remSec} giây trước`;
    }

    return (
      <Tooltip content={`Nhịp tim gần nhất: ${formatFullDateTimeVN(lastBeat)}`}>
        <div className="inline-flex cursor-help items-center gap-1.5 rounded-full bg-bg-elevated/70 px-3 py-1 text-xs font-medium text-text-secondary border border-border-subtle">
          <Clock className="h-3.5 w-3.5 text-blue-500 shrink-0" />
          <span>Cập nhật lần cuối: {timeLabel}</span>
        </div>
      </Tooltip>
    );
  }
);

LastBeatCounter.displayName = 'LastBeatCounter';
