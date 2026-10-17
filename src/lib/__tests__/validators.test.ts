import { describe, expect, it } from 'vitest';
import {
  FORBIDDEN_UART_KEYWORDS,
  stripVietnameseDiacritics,
  validatePin,
  validateUserName,
} from '../validators';

describe('validatePin', () => {
  it('allows empty string (optional PIN or PIN deletion)', () => {
    expect(validatePin('', ['1234']).valid).toBe(true);
  });

  it('accepts valid 4-6 digit PINs including leading zeros', () => {
    expect(validatePin('0123', []).valid).toBe(true);
    expect(validatePin('001234', []).valid).toBe(true);
  });

  it('blocks PIN shorter than 4 digits or longer than 6 digits as hard errors', () => {
    const shortRes = validatePin('123', []);
    expect(shortRes.valid).toBe(false);
    expect(shortRes.error).toContain('4 đến 6');

    const longRes = validatePin('1234567', []);
    expect(longRes.valid).toBe(false);
  });

  it('blocks non-numeric PINs', () => {
    expect(validatePin('12a4', []).valid).toBe(false);
    expect(validatePin('12 34', []).valid).toBe(false);
  });

  it('blocks master PIN "999999"', () => {
    const res = validatePin('999999', []);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('999999');
  });

  it('blocks duplicate PINs unless unchanged from oldPass', () => {
    expect(validatePin('0123', ['0123', '5678']).valid).toBe(false);
    expect(validatePin('0123', ['0123', '5678'], '0123').valid).toBe(true);
  });
});

describe('validateUserName', () => {
  it('returns trimmed and NFC-normalized name', () => {
    const res = validateUserName('  Nguyen   Van  An  ');
    expect(res.valid).toBe(true);
    expect(res.normalizedName).toBe('Nguyen Van An');
  });

  it('blocks quotes, backslashes, pipes, newlines, and tabs', () => {
    expect(validateUserName('An "Boss"').valid).toBe(false);
    expect(validateUserName('An\\Binh').valid).toBe(false);
    expect(validateUserName('An|Binh').valid).toBe(false);
    expect(validateUserName('An\nBinh').valid).toBe(false);
    expect(validateUserName('An\tBinh').valid).toBe(false);
  });

  it('blocks all 14 internal UART protocol keywords case-insensitively', () => {
    for (const kw of FORBIDDEN_UART_KEYWORDS) {
      const res = validateUserName(`User ${kw.toLowerCase()} test`);
      expect(res.valid).toBe(false);
      expect(res.error).toContain(kw);
    }
  });

  it('warns (non-blocking) when name has Vietnamese diacritics or > 16 chars', () => {
    const res = validateUserName('Nguyễn Văn Trường Giang');
    expect(res.valid).toBe(true);
    expect(res.hasDiacritics).toBe(true);
    expect(res.exceedsLcdLength).toBe(true);
    expect(res.lcdWarning).toBeDefined();
    expect(stripVietnameseDiacritics(res.normalizedName)).toBe(
      'Nguyen Van Truong Giang'
    );
  });
});
