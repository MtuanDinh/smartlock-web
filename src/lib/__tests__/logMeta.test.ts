import { describe, expect, it } from 'vitest';
import { getLogMeta, matchesLogFilterChip } from '../logMeta';

describe('getLogMeta', () => {
  it('matches case-insensitively including firmware lowercase "Mở bằng nút bấm"', () => {
    const meta = getLogMeta('Mở bằng nút bấm');
    expect(meta.category).toBe('button');
    expect(meta.colorVariant).toBe('muted');
    expect(meta.iconName).toBe('CircleDot');
    expect(meta.isDoorOpen).toBe(true);
    expect(meta.isOfflineSync).toBe(false);
    expect(meta.isSystemLog).toBe(false);
  });

  it('normalizes NFD decomposed strings with normalize("NFC") before matching', () => {
    // "Mở bằng nút bấm" in decomposed NFD form
    const nfdAction = 'Mơ\u0309 bă\u0300ng nu\u0301t bâ\u0301m';
    const meta = getLogMeta(nfdAction);
    expect(meta.category).toBe('button');
    expect(meta.isDoorOpen).toBe(true);
    expect(meta.cleanActionText).toBe('Mở bằng nút bấm');
  });

  it('marks actions starting with "Mở" (including "(Offline)" and "Mở bằng Sinh trắc học") as isDoorOpen = true', () => {
    expect(getLogMeta('Mở bằng Mật khẩu').isDoorOpen).toBe(true);
    expect(getLogMeta('Mở bằng Thẻ từ (Offline)').isDoorOpen).toBe(true);
    expect(getLogMeta('Mở cửa qua Web').isDoorOpen).toBe(true);
    expect(getLogMeta('Mở bằng nút bấm (Offline)').isDoorOpen).toBe(true);
    const bioMeta = getLogMeta('Mở bằng Sinh trắc học');
    expect(bioMeta.isDoorOpen).toBe(true);
    expect(bioMeta.category).toBe('access');
    expect(bioMeta.colorVariant).toBe('success');
  });

  it('does NOT count "Thêm thẻ mới" as a door open event', () => {
    const meta = getLogMeta('Thêm thẻ mới');
    expect(meta.isDoorOpen).toBe(false);
    expect(meta.category).toBe('access');
    expect(meta.colorVariant).toBe('success');
    expect(matchesLogFilterChip(meta, 'door_open')).toBe(false);
  });

  it('identifies offline synced logs and strips "(Offline)" from cleanActionText', () => {
    const meta = getLogMeta('Cảnh báo: Sai Pass (Offline)');
    expect(meta.category).toBe('alert');
    expect(meta.colorVariant).toBe('danger');
    expect(meta.isOfflineSync).toBe(true);
    expect(meta.isDoorOpen).toBe(false);
    expect(meta.cleanActionText).toBe('Cảnh báo: Sai Pass');
  });

  it('identifies system logs ("HỆ THỐNG" and "Hệ thống khởi động")', () => {
    const sys1 = getLogMeta('HỆ THỐNG');
    expect(sys1.category).toBe('system');
    expect(sys1.isSystemLog).toBe(true);
    expect(sys1.colorVariant).toBe('info');

    const sys2 = getLogMeta('Hệ thống khởi động');
    expect(sys2.category).toBe('system');
    expect(sys2.isSystemLog).toBe(true);
  });

  it('matches filter chips accurately', () => {
    const webOpen = getLogMeta('Mở cửa qua Web');
    expect(matchesLogFilterChip(webOpen, 'all')).toBe(true);
    expect(matchesLogFilterChip(webOpen, 'door_open')).toBe(true);
    expect(matchesLogFilterChip(webOpen, 'web')).toBe(true);
    expect(matchesLogFilterChip(webOpen, 'alert')).toBe(false);
  });
});
