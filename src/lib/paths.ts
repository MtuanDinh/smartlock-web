/**
 * Nơi duy nhất định nghĩa toàn bộ đường dẫn Firebase Realtime Database.
 * Giữ nguyên 100% hợp đồng dữ liệu với firmware (newwemos.ino & unoslave.ino).
 */
export const PATHS = {
  INFO_OFFSET: '.info/serverTimeOffset',
  INFO_CONNECTED: '.info/connected',
  SYSTEM_LAST_BEAT: 'SmartLock/System/Last_Beat',
  CONTROL: {
    ROOT: 'SmartLock/Control',
    LOCKDOWN: 'SmartLock/Control/Lockdown',
    REMOTE_OPEN: 'SmartLock/Control/Remote_Open',
    RESTART: 'SmartLock/Control/Restart',
    NEED_SYNC: 'SmartLock/Control/Need_Sync',
    ADD_CARD_MODE: 'SmartLock/Control/Add_Card_Mode',
    TARGET_USER: 'SmartLock/Control/Target_User',
    TARGET_NAME: 'SmartLock/Control/Target_Name',
    BIOMETRIC_MODE: 'SmartLock/Control/Biometric_Mode',
    BIOMETRIC_ENROLL: 'SmartLock/Control/Biometric_Enroll',
  },
  LOGS: 'SmartLock/Logs',
  USERS: 'SmartLock/Users',
  USER_DETAIL: (userId: string) => `SmartLock/Users/${userId}`,
  USER_CARD: (userId: string) => `SmartLock/Users/${userId}/card`,
  PASSWORDS: 'SmartLock/Passwords',
  PASSWORD_ITEM: (pin: string) => `SmartLock/Passwords/${pin}`,
  RFID: 'SmartLock/RFID',
  RFID_ITEM: (uid: string) => `SmartLock/RFID/${uid}`,
  BIOMETRICS: 'SmartLock/Biometrics',
  BIOMETRIC_ITEM: (userId: string) => `SmartLock/Biometrics/${userId}`,
  SYSTEM_BIOMETRICS: 'SmartLock/System/Biometrics',
  SYSTEM_BIOMETRICS_KIOSK_URL: 'SmartLock/System/Biometrics/kioskUrl',
} as const;

export const ONLINE_THRESHOLD_MS =
  Number(import.meta.env?.VITE_ONLINE_THRESHOLD_MS) > 0
    ? Number(import.meta.env.VITE_ONLINE_THRESHOLD_MS)
    : 35000;
