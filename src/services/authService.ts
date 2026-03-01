import { api } from './api';
import type { User, UserSession } from '@shared/types';

export interface AuthLoginResult {
  success: boolean;
  user: User;
  session: UserSession;
}

export const authService = {
  // ── Users ──────────────────────────────────────────────────────────────

  getUsers: () =>
    api.get<User[]>('/api/users'),

  saveUser: (user: Partial<User> & { id: string }) =>
    api.put<User>(`/api/users/${user.id}`, user),

  createUser: (data: Partial<User>) =>
    api.post<User>('/api/users', data),

  deleteUser: (id: string) =>
    api.delete<void>(`/api/users/${id}`),

  getSetupStatus: () =>
    api.get<{ setupRequired: boolean }>('/api/users/setup-status'),

  getLockoutTime: (userId: string) =>
    api.get<{ remainingSeconds: number }>(`/api/users/${userId}/lockout`),

  // ── Auth ───────────────────────────────────────────────────────────────

  login: (username: string, password: string) =>
    api.post<AuthLoginResult>('/api/auth/login', { username, password }),

  loginWithPin: (userId: string, pin: string) =>
    api.post<AuthLoginResult>('/api/auth/login-pin', { userId, pin }),

  logout: (sessionId?: string) =>
    api.post<{ success: boolean }>('/api/auth/logout', { sessionId }),

  unlock: (userId: string, password: string) =>
    api.post<{ success: true }>('/api/auth/unlock', { userId, password }),

  unlockWithPin: (userId: string, pin: string) =>
    api.post<{ success: true }>('/api/auth/unlock-pin', { userId, pin }),

  setup: (name: string, username: string, password: string, pin?: string) =>
    api.post<AuthLoginResult>('/api/auth/setup', { name, username, password, pin }),
};
