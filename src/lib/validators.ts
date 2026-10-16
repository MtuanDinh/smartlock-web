export interface PinValidationResult {
  valid: boolean;
  error?: string;
}

export interface UserNameValidationResult {
  valid: boolean;
  normalizedName: string;
  error?: string;
  lcdWarning?: string;
  hasDiacritics: boolean;
  exceedsLcdLength: boolean;
}

/**
 * 14 từ khóa giao thức UART nội bộ giữa Wemos D1 Mini và Arduino Uno.
 * Cấm xuất hiện trong tên thành viên (không phân biệt hoa thường) để tránh xung đột lệnh UART.
 */
export const FORBIDDEN_UART_KEYWORDS = [
  'LOCKDOWN',
  'SYS_READY',
  'SYS_NO_WIFI',
  'SYS_BOOTING',
  'WRONG_PASS',
  'WRONG_CARD',
  'OPEN_DOOR',
  'LEARN_MODE',
  'CARD_EXISTS',
  'ADD_SUCCESS',
  'CANCEL_LEARN',
  'RESTART_SYS',
  'RESET_WIFI',
  'PING_WEMOS',
] as const;

/**
 * Danh sách ký tự cho phép trong tên thành viên:
 * Chữ cái (kể cả tiếng Việt), chữ số, khoảng trắng thường (U+0020), dấu chấm (.), gạch ngang (-), gạch dưới (_).
 * Không dùng \s để chặn triệt để \n, \r, \t.
 */
const ALLOWED_NAME_CHARS_REGEX = /^[\p{L}\p{N} .\-_]+$/u;

const VIETNAMESE_DIACRITIC_REGEX =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

/**
 * Kiểm tra tính hợp lệ của mã PIN:
 * - Cho phép rỗng "" (không dùng PIN hoặc xóa PIN).
 * - Khi khác rỗng: chỉ chữ số (0-9), độ dài 4–6 chữ số (lỗi chặn), cấm "999999", không trùng PIN hiện có.
 */
export function validatePin(
  rawPin: string,
  existingPasswords: string[],
  oldPass: string = ''
): PinValidationResult {
  const pin = rawPin.trim();
  if (pin === '') {
    return { valid: true };
  }

  if (!/^[0-9]+$/.test(pin)) {
    return {
      valid: false,
      error: 'Mã PIN chỉ được chứa các chữ số từ 0–9.',
    };
  }

  if (pin.length < 4 || pin.length > 6) {
    return {
      valid: false,
      error: 'Mã PIN phải có từ 4 đến 6 chữ số.',
    };
  }

  if (pin === '999999') {
    return {
      valid: false,
      error: 'Mã 999999 được dành riêng cho hệ thống (Master), vui lòng chọn mã khác.',
    };
  }

  const normalizedExisting = existingPasswords.map((p) => String(p));
  if (pin !== String(oldPass) && normalizedExisting.includes(pin)) {
    return {
      valid: false,
      error: 'Mã PIN này đã có thành viên khác sử dụng.',
    };
  }

  return { valid: true };
}

/**
 * Chuẩn hóa và kiểm tra tên thành viên:
 * - Chuẩn hóa NFC, cắt khoảng trắng đầu/cuối và gom nhiều khoảng trắng thường liên tiếp.
 * - Chỉ cho phép chữ cái, chữ số, khoảng trắng thường (U+0020), ., -, _.
 * - Chặn 14 từ khóa giao thức UART nội bộ (không phân biệt hoa thường).
 * - Trả về cảnh báo mềm nếu dài > 16 ký tự hoặc có dấu tiếng Việt (cho màn hình LCD 16x2).
 */
export function validateUserName(rawName: string): UserNameValidationResult {
  const normalizedBase = (rawName ?? '').normalize('NFC').trim();
  // Kiểm tra trước trên chuỗi đã cắt 2 đầu để phát hiện ký tự xuống dòng/tab ở giữa
  if (normalizedBase.length === 0) {
    return {
      valid: false,
      normalizedName: '',
      error: 'Vui lòng nhập họ và tên thành viên.',
      hasDiacritics: false,
      exceedsLcdLength: false,
    };
  }

  if (!ALLOWED_NAME_CHARS_REGEX.test(normalizedBase)) {
    return {
      valid: false,
      normalizedName: normalizedBase.replace(/ +/g, ' '),
      error:
        'Tên chỉ được chứa chữ cái, chữ số, khoảng trắng thường và các dấu chấm (.), gạch ngang (-), gạch dưới (_).',
      hasDiacritics: false,
      exceedsLcdLength: false,
    };
  }

  const normalizedName = normalizedBase.replace(/ +/g, ' ');
  const upperName = normalizedName.toUpperCase();

  for (const keyword of FORBIDDEN_UART_KEYWORDS) {
    if (upperName.includes(keyword)) {
      return {
        valid: false,
        normalizedName,
        error: `Tên không được chứa từ khóa hệ thống "${keyword}".`,
        hasDiacritics: false,
        exceedsLcdLength: false,
      };
    }
  }

  const hasDiacritics = VIETNAMESE_DIACRITIC_REGEX.test(normalizedName);
  const exceedsLcdLength = normalizedName.length > 16;

  let lcdWarning: string | undefined;
  if (hasDiacritics && exceedsLcdLength) {
    lcdWarning =
      'Màn hình LCD 16x2 trên khóa không hiển thị được dấu tiếng Việt và sẽ cắt bớt ký tự sau vị trí 16.';
  } else if (hasDiacritics) {
    lcdWarning =
      'Màn hình LCD trên khóa hiển thị tốt nhất tên tiếng Việt không dấu.';
  } else if (exceedsLcdLength) {
    lcdWarning =
      'Màn hình LCD 16x2 trên khóa chỉ hiển thị tối đa 16 ký tự đầu tiên.';
  }

  return {
    valid: true,
    normalizedName,
    lcdWarning,
    hasDiacritics,
    exceedsLcdLength,
  };
}

/**
 * Chuyển chuỗi tiếng Việt có dấu sang không dấu để hỗ trợ hiển thị đẹp trên LCD 16x2.
 */
export function stripVietnameseDiacritics(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFC');
}
