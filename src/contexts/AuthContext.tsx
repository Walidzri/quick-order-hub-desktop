import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { User, UserRole, UserSession, getDB } from '@/lib/database';

// Polyfill for crypto.randomUUID (works on HTTP as well)
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
  canAccessView: (view: string) => boolean;
  canAccessSettingsSection: (section: string) => boolean;
  users: User[];
  loadUsers: () => Promise<void>;
  saveUser: (user: Omit<User, 'createdAt' | 'lastLogin'> & { createdAt?: Date; lastLogin?: Date }) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Permissions by role
const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: [
    'all', // Admin has all permissions
    'settings.*',
    'settings.general.*',
    'settings.branding.*',
    'settings.printers.*',
    'settings.numbering.*',
    'settings.receipt.*',
    'settings.promotions.*',
    'settings.theme.*',
    'settings.products.*',
    'settings.inventory.*',
    'settings.users.*',
    'settings.general.updateSupplements',
    'settings.general.resetDatabase',
    'orders.*',
    'orders.create',
    'orders.view',
    'orders.edit',
    'orders.delete',
    'reports.*',
    'reports.view',
    'reports.export',
  ],
  caissier: [
    'settings.general.view',
    'settings.general.language',
    'settings.general.currency',
    'settings.general.kioskMode',
    'settings.theme.*',
    'orders.create',
    'orders.view',
  ],
  chef: [
    'orders.view',
    'orders.kitchen',
    'reports.view',
  ],
};

const VIEW_PERMISSIONS: Record<string, string[]> = {
  order: ['orders.create'],
  orders: ['orders.view'],
  reports: ['reports.view'],
  settings: ['settings.*', 'settings.general.view'],
};

const SETTINGS_SECTION_PERMISSIONS: Record<string, string[]> = {
  general: ['settings.general.*', 'settings.general.view'],
  inventory: ['settings.inventory.*', 'settings.inventory.view'], // Allow view access for caissiers
  branding: ['settings.branding.*'],
  printers: ['settings.printers.*'],
  numbering: ['settings.numbering.*'],
  receipt: ['settings.receipt.*'],
  promotions: ['settings.promotions.*'],
  theme: ['settings.theme.*'],
  products: ['settings.products.*'],
  users: ['settings.users.*'], // Only admin can access users section
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [users, setUsers] = useState<User[]>([]);

  // Load session from localStorage on mount
  useEffect(() => {
    const loadSavedSession = async () => {
      const savedUser = localStorage.getItem('pos_user');
      if (savedUser) {
        try {
          const userData = JSON.parse(savedUser);
          setUser(userData);
          setIsAuthenticated(true);
          
          // Restore active session if exists
          const sessionId = localStorage.getItem('pos_session_id');
          if (sessionId) {
            const db = await getDB();
            try {
              const session = await db.get('userSessions', sessionId);
              if (session && session.isActive && session.userId === userData.id) {
                // Session is still active, continue tracking
                return;
              }
            } catch (error) {
              // Session doesn't exist, create a new one
              const newSession: UserSession = {
                id: generateUUID(),
                userId: userData.id,
                loginAt: new Date(),
                isActive: true,
              };
              await db.put('userSessions', newSession);
              localStorage.setItem('pos_session_id', newSession.id);
            }
          } else {
            // No session ID, create a new one
            const db = await getDB();
            const newSession: UserSession = {
              id: generateUUID(),
              userId: userData.id,
              loginAt: new Date(),
              isActive: true,
            };
            await db.put('userSessions', newSession);
            localStorage.setItem('pos_session_id', newSession.id);
          }
        } catch (error) {
          console.error('Failed to load user session:', error);
          localStorage.removeItem('pos_user');
          localStorage.removeItem('pos_session_id');
        }
      }
    };
    
    loadSavedSession();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const db = await getDB();
      // Find user by username using index
      const user = await db.getFromIndex('users', 'by-username', username);

      if (!user) {
        return { success: false, message: 'Nom d\'utilisateur ou mot de passe incorrect' };
      }

      // Simple password check (en production, utiliser un hash)
      if (user.password !== password) {
        return { success: false, message: 'Nom d\'utilisateur ou mot de passe incorrect' };
      }

      // Update last login
      user.lastLogin = new Date();
      await db.put('users', user);

      // Create a new user session
      const session: UserSession = {
        id: generateUUID(),
        userId: user.id,
        loginAt: new Date(),
        isActive: true,
      };
      await db.put('userSessions', session);
      localStorage.setItem('pos_session_id', session.id);

      // Save session
      setUser(user);
      setIsAuthenticated(true);
      localStorage.setItem('pos_user', JSON.stringify(user));

      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'Erreur lors de la connexion' };
    }
  }, []);

  const logout = useCallback(async () => {
    // End the current session
    const sessionId = localStorage.getItem('pos_session_id');
    if (sessionId) {
      try {
        const db = await getDB();
        const session = await db.get('userSessions', sessionId);
        if (session && session.isActive) {
          session.logoutAt = new Date();
          session.isActive = false;
          await db.put('userSessions', session);
        }
      } catch (error) {
        console.error('Failed to end session:', error);
      }
      localStorage.removeItem('pos_session_id');
    }
    
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('pos_user');
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const db = await getDB();
      const allUsers = await db.getAll('users');
      setUsers(allUsers);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  }, []);

  const saveUser = useCallback(async (userData: Omit<User, 'createdAt' | 'lastLogin'> & { createdAt?: Date; lastLogin?: Date; password?: string }) => {
    try {
      const db = await getDB();
      
      // If editing and password is empty, keep the existing password
      if (userData.id) {
        const existing = await db.get('users', userData.id);
        if (existing && !userData.password) {
          userData.password = existing.password;
        }
      }
      
      const userToSave: User = {
        id: userData.id,
        username: userData.username,
        password: userData.password || '',
        role: userData.role,
        name: userData.name,
        createdAt: userData.createdAt || new Date(),
        lastLogin: userData.lastLogin,
      };
      await db.put('users', userToSave);
      await loadUsers();
    } catch (error) {
      console.error('Failed to save user:', error);
      throw error;
    }
  }, [loadUsers]);

  const deleteUser = useCallback(async (userId: string) => {
    try {
      const db = await getDB();
      await db.delete('users', userId);
      await loadUsers();
    } catch (error) {
      console.error('Failed to delete user:', error);
      throw error;
    }
  }, [loadUsers]);

  // Load users on mount
  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const hasPermission = useCallback((permission: string): boolean => {
    if (!user) return false;
    
    const userPermissions = ROLE_PERMISSIONS[user.role] || [];
    
    // Check for exact match
    if (userPermissions.includes(permission)) return true;
    
    // Check for wildcard permissions
    if (userPermissions.includes('all')) return true;
    
    // Check for wildcard sections (e.g., 'settings.*' matches 'settings.general.view')
    const permissionParts = permission.split('.');
    for (let i = permissionParts.length; i > 0; i--) {
      const wildcard = permissionParts.slice(0, i).join('.') + '.*';
      if (userPermissions.includes(wildcard)) return true;
    }
    
    return false;
  }, [user]);

  const canAccessView = useCallback((view: string): boolean => {
    if (!user) return false;
    
    const requiredPermissions = VIEW_PERMISSIONS[view] || [];
    if (requiredPermissions.length === 0) return true; // No restrictions
    
    return requiredPermissions.some(perm => hasPermission(perm));
  }, [user, hasPermission]);

  const canAccessSettingsSection = useCallback((section: string): boolean => {
    if (!user) return false;
    
    const requiredPermissions = SETTINGS_SECTION_PERMISSIONS[section] || [];
    if (requiredPermissions.length === 0) return true;
    
    return requiredPermissions.some(perm => hasPermission(perm));
  }, [user, hasPermission]);

  const value: AuthContextType = {
    user,
    isAuthenticated,
    login,
    logout,
    hasPermission,
    canAccessView,
    canAccessSettingsSection,
    users,
    loadUsers,
    saveUser,
    deleteUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
