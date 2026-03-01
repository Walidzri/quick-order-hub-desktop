import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { authService } from '@/services/authService';
import type { User, UserRole } from '@shared/types';

// Security constants
const AUTO_LOCK_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes of inactivity

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLocked: boolean;
  isSetupRequired: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
  loginWithPin: (userId: string, pin: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  lock: () => void;
  unlock: (password: string) => Promise<{ success: boolean; message?: string }>;
  unlockWithPin: (pin: string) => Promise<{ success: boolean; message?: string }>;
  hasPermission: (permission: string) => boolean;
  canAccessView: (view: string) => boolean;
  canAccessSettingsSection: (section: string) => boolean;
  users: User[];
  loadUsers: () => Promise<void>;
  saveUser: (user: Omit<User, 'createdAt' | 'lastLogin'> & { createdAt?: Date; lastLogin?: Date }) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  createInitialAdmin: (name: string, username: string, password: string, pin?: string) => Promise<{ success: boolean; message?: string }>;
  getRemainingLockoutTime: (userId: string) => Promise<number>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

// Permissions by role
const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: [
    'all',
    'settings.*', 'settings.general.*', 'settings.branding.*', 'settings.printers.*',
    'settings.numbering.*', 'settings.receipt.*', 'settings.promotions.*',
    'settings.theme.*', 'settings.products.*', 'settings.inventory.*',
    'settings.users.*', 'settings.data.*',
    'orders.*', 'orders.create', 'orders.view', 'orders.edit', 'orders.delete',
    'reports.*', 'reports.view', 'reports.export',
  ],
  caissier: [
    'settings.general.*', 'settings.theme.*',
    'orders.create', 'orders.view',
  ],
  chef: [
    'settings.general.*', 'settings.branding.*', 'settings.products.*',
    'settings.inventory.*', 'settings.numbering.*', 'settings.receipt.*',
    'settings.promotions.*', 'settings.theme.*', 'settings.users.*',
    'orders.create', 'orders.view', 'orders.kitchen',
    'reports.view',
  ],
};

const VIEW_PERMISSIONS: Record<string, string[]> = {
  order: ['orders.create'],
  orders: ['orders.view'],
  reports: ['reports.view'],
  settings: ['settings.*', 'settings.branding.*', 'settings.theme.*'],
};

const SETTINGS_SECTION_PERMISSIONS: Record<string, string[]> = {
  general: ['settings.general.*'],
  inventory: ['settings.inventory.*'],
  branding: ['settings.branding.*'],
  printers: ['settings.printers.*'],
  numbering: ['settings.numbering.*'],
  receipt: ['settings.receipt.*'],
  promotions: ['settings.promotions.*'],
  theme: ['settings.theme.*'],
  products: ['settings.products.*'],
  users: ['settings.users.*'],
  data: ['settings.data.*'],
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isSetupRequired, setIsSetupRequired] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  // Timer d'inactivité
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (isAuthenticated && !isLocked) {
      inactivityTimerRef.current = setTimeout(() => setIsLocked(true), AUTO_LOCK_TIMEOUT_MS);
    }
  }, [isAuthenticated, isLocked]);

  useEffect(() => {
    if (!isAuthenticated || isLocked) return;
    const handleActivity = () => resetInactivityTimer();
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('mousedown', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    window.addEventListener('scroll', handleActivity);
    resetInactivityTimer();
    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [isAuthenticated, isLocked, resetInactivityTimer]);

  // Vérification du setup au démarrage
  useEffect(() => {
    async function init() {
      try {
        const { setupRequired } = await authService.getSetupStatus();
        setIsSetupRequired(setupRequired);
        if (!setupRequired) {
          localStorage.removeItem('pos_user');
          localStorage.removeItem('pos_session_id');
        }
        const allUsers = await authService.getUsers();
        setUsers(allUsers);
      } catch (err) {
        console.error('[AuthContext] init error:', err);
      }
    }
    init();
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const allUsers = await authService.getUsers();
      setUsers(allUsers);
    } catch (err) {
      console.error('[AuthContext] loadUsers error:', err);
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const result = await authService.login(username, password);
      sessionIdRef.current = result.session.id;
      localStorage.setItem('pos_session_id', result.session.id);
      setUser(result.user);
      setIsAuthenticated(true);
      setIsLocked(false);
      localStorage.setItem('pos_user', JSON.stringify(result.user));
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message ?? 'Erreur lors de la connexion' };
    }
  }, []);

  const loginWithPin = useCallback(async (userId: string, pin: string) => {
    try {
      const result = await authService.loginWithPin(userId, pin);
      sessionIdRef.current = result.session.id;
      localStorage.setItem('pos_session_id', result.session.id);
      setUser(result.user);
      setIsAuthenticated(true);
      setIsLocked(false);
      localStorage.setItem('pos_user', JSON.stringify(result.user));
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message ?? 'Erreur lors de la connexion' };
    }
  }, []);

  const logout = useCallback(async () => {
    const sessionId = sessionIdRef.current ?? localStorage.getItem('pos_session_id') ?? undefined;
    try {
      await authService.logout(sessionId);
    } catch {}
    sessionIdRef.current = null;
    localStorage.removeItem('pos_session_id');
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    setUser(null);
    setIsAuthenticated(false);
    setIsLocked(false);
    localStorage.removeItem('pos_user');
  }, []);

  const lock = useCallback(() => {
    if (isAuthenticated) setIsLocked(true);
  }, [isAuthenticated]);

  const unlock = useCallback(async (password: string) => {
    if (!user) return { success: false, message: 'Aucun utilisateur connecté' };
    try {
      await authService.unlock(user.id, password);
      setIsLocked(false);
      resetInactivityTimer();
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message ?? 'Erreur lors du déverrouillage' };
    }
  }, [user, resetInactivityTimer]);

  const unlockWithPin = useCallback(async (pin: string) => {
    if (!user) return { success: false, message: 'Aucun utilisateur connecté' };
    try {
      await authService.unlockWithPin(user.id, pin);
      setIsLocked(false);
      resetInactivityTimer();
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message ?? 'Erreur lors du déverrouillage' };
    }
  }, [user, resetInactivityTimer]);

  const createInitialAdmin = useCallback(async (name: string, username: string, password: string, pin?: string) => {
    try {
      const result = await authService.setup(name, username, password, pin);
      sessionIdRef.current = result.session.id;
      localStorage.setItem('pos_session_id', result.session.id);
      setUser(result.user);
      setIsAuthenticated(true);
      setIsSetupRequired(false);
      localStorage.setItem('pos_user', JSON.stringify(result.user));
      await loadUsers();
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message ?? 'Erreur lors de la création du compte' };
    }
  }, [loadUsers]);

  const saveUser = useCallback(async (userData: Omit<User, 'createdAt' | 'lastLogin'> & { createdAt?: Date; lastLogin?: Date; password?: string; pin?: string }) => {
    try {
      if (userData.id) {
        await authService.saveUser({ ...userData, id: userData.id });
      } else {
        await authService.createUser(userData);
      }
      await loadUsers();
      const { setupRequired } = await authService.getSetupStatus();
      setIsSetupRequired(setupRequired);
    } catch (err) {
      console.error('[AuthContext] saveUser error:', err);
      throw err;
    }
  }, [loadUsers]);

  const deleteUser = useCallback(async (userId: string) => {
    try {
      await authService.deleteUser(userId);
      await loadUsers();
    } catch (err) {
      console.error('[AuthContext] deleteUser error:', err);
      throw err;
    }
  }, [loadUsers]);

  const getRemainingLockoutTime = useCallback(async (userId: string): Promise<number> => {
    try {
      const { remainingSeconds } = await authService.getLockoutTime(userId);
      return remainingSeconds;
    } catch {
      return 0;
    }
  }, []);

  const hasPermission = useCallback((permission: string): boolean => {
    if (!user) return false;
    const userPermissions = ROLE_PERMISSIONS[user.role] || [];
    if (userPermissions.includes(permission)) return true;
    if (userPermissions.includes('all')) return true;
    const parts = permission.split('.');
    for (let i = parts.length; i > 0; i--) {
      const wildcard = parts.slice(0, i).join('.') + '.*';
      if (userPermissions.includes(wildcard)) return true;
    }
    return false;
  }, [user]);

  const canAccessView = useCallback((view: string): boolean => {
    if (!user) return false;
    const required = VIEW_PERMISSIONS[view] || [];
    if (required.length === 0) return true;
    return required.some(perm => hasPermission(perm));
  }, [user, hasPermission]);

  const canAccessSettingsSection = useCallback((section: string): boolean => {
    if (!user) return false;
    const required = SETTINGS_SECTION_PERMISSIONS[section] || [];
    if (required.length === 0) return true;
    return required.some(perm => hasPermission(perm));
  }, [user, hasPermission]);

  const value: AuthContextType = {
    user, isAuthenticated, isLocked, isSetupRequired,
    login, loginWithPin, logout, lock, unlock, unlockWithPin,
    hasPermission, canAccessView, canAccessSettingsSection,
    users, loadUsers, saveUser, deleteUser,
    createInitialAdmin, getRemainingLockoutTime,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
