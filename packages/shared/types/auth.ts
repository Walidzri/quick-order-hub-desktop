export type UserRole = 'admin' | 'caissier' | 'chef';

export interface User {
  id: string;
  username: string;
  password: string;
  pin?: string; // 4-6 digit PIN for quick login
  role: UserRole;
  name: string;
  avatar?: string; // Emoji or initials for quick selection
  createdAt: Date;
  lastLogin?: Date;
  failedAttempts?: number; // Track failed login attempts
  lockedUntil?: Date; // Account lockout time
}

export interface UserSession {
  id: string;
  userId: string;
  loginAt: Date;
  logoutAt?: Date;
  isActive: boolean;
}
