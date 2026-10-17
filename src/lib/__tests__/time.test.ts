import { describe, expect, it } from 'vitest';
import {
  formatDateVN,
  groupLogsByDate,
  matchesLogSearch,
} from '../time';
import type { LogEntry } from '../../types';

describe('time utilities', () => {
  it('formatDateVN always produces zero-padded DD/MM/YYYY', () => {
    const ts = new Date(2026, 4, 6, 9, 5, 3).getTime(); // 06/05/2026
    expect(formatDateVN(ts)).toBe('06/05/2026');
  });

  it('matchesLogSearch matches both padded DD/MM/YYYY and short D/M/YYYY', () => {
    const ts = new Date(2026, 4, 6, 9, 5, 3).getTime();
    const log: LogEntry = {
      id: '1',
      action: 'Mở bằng Thẻ từ',
      user: 'Nguyen Van An',
      timestamp: ts,
    };
    expect(matchesLogSearch(log, '06/05/2026')).toBe(true);
    expect(matchesLogSearch(log, '6/5/2026')).toBe(true);
    expect(matchesLogSearch(log, 'nguyen van')).toBe(true);
    expect(matchesLogSearch(log, 'thẻ từ')).toBe(true);
  });

  it('groupLogsByDate groups consecutive items by date and preserves 1-based index offset', () => {
    const day1 = new Date(2026, 9, 16, 10, 0, 0).getTime();
    const day2 = new Date(2026, 9, 15, 10, 0, 0).getTime();
    const logs: LogEntry[] = [
      { id: '1', action: 'A', user: 'U1', timestamp: day1 },
      { id: '2', action: 'B', user: 'U2', timestamp: day1 - 1000 },
      { id: '3', action: 'C', user: 'U3', timestamp: day2 },
    ];

    const groups = groupLogsByDate(logs, 15);
    expect(groups).toHaveLength(2);
    expect(groups[0]!.dateKey).toBe('16/10/2026');
    expect(groups[0]!.items.map((i) => i.index)).toEqual([16, 17]);
    expect(groups[1]!.dateKey).toBe('15/10/2026');
    expect(groups[1]!.items.map((i) => i.index)).toEqual([18]);
  });
});
