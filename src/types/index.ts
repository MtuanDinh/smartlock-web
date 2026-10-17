export type UserStatus = 'active' | 'disabled';

export interface UserRecord {
  name: string;
  pass: string;
  card: string;
  status: UserStatus;
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
}
