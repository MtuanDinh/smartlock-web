export type UserStatus = 'active' | 'disabled';

export type BiometricEnrollTarget = 'voice' | 'face' | 'both';

export type BiometricEnrollStep =
  | 'idle'
  | 'waiting_voice'
  | 'waiting_face'
  | 'completed'
  | 'cancelled'
  | 'error';

export interface BiometricEnrollCommand {
  active: boolean;
  userId: string;
  userName: string;
  target: BiometricEnrollTarget;
  expectedPassphrase: string;
  step: BiometricEnrollStep;
  message: string;
  updatedAt: number;
}

export interface UserRecord {
  name: string;
  pass: string;
  card: string;
  status: UserStatus;
  hasVoice?: boolean;
  hasFace?: boolean;
  voicePassphrase?: string;
  biometricUpdatedAt?: number;
}

export interface User extends UserRecord {
  id: string;
}

export interface LogRecord {
  action: string;
  user: string;
  timestamp: number;
}

export interface LogEntry extends LogRecord {
  id: string;
}

export interface ControlState {
  Lockdown: boolean;
  Remote_Open: boolean;
  Restart: boolean;
  Need_Sync: boolean;
  Add_Card_Mode: boolean;
  Target_User: string;
  Target_Name: string;
  Biometric_Mode?: boolean;
  Biometric_Enroll?: BiometricEnrollCommand;
}

export type ConnectionState = 'loading' | 'online' | 'offline';

export type LogCategory = 'alert' | 'button' | 'web' | 'system' | 'access';

export type LogFilterChip = 'all' | 'door_open' | 'alert' | 'button' | 'web' | 'system';

export interface AuthUser {
  uid: string;
  email: string | null;
}

export type WriteResultStatus = 'completed' | 'queued_offline' | 'unsynced';

export interface MutationResult {
  status: WriteResultStatus;
  userId?: string;
}

export interface BiometricSystemStatus {
  online: boolean;
  kioskUrl: string;
  lanKioskUrl?: string;
  lanHttpKioskUrl?: string;
  lanIp?: string;
  updatedAt?: number;
}

