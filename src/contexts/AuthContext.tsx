import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { User, UserRole, UserSession, getDB } from '@/lib/database';
import { generateUUID, hashPassword, verifyPassword, isPasswordHashed } from '@/lib/utils';

// Security constants
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const AUTO_LOCK_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes of inactivity

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLocked: boolean; // Screen is locked due to inactivity
  isSetupRequired: boolean; // No users exist, need initial setup
  login: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
  loginWithPin: (userId: string, pin: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  lock: () => void; // Lock the screen (user stays logged in but needs to re-auth)
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
  getRemainingLockoutTime: (userId: string) => Promise<number>; // Returns remaining lockout time in seconds
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
    'settings.data.*', // Backup, restore, reset database
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
    'settings.general.*', // Full access to general (language, currency, kiosk)
    'settings.theme.*',
    'orders.create',
    'orders.view',
  ],
  chef: [
    // Chef has access to most settings except data (backup, reset) and printers
    'settings.general.*', // Full access to general (language, currency, kiosk)
    'settings.branding.*',
    'settings.products.*',
    'settings.inventory.*',
    'settings.numbering.*',
    'settings.receipt.*',
    'settings.promotions.*',
    'settings.theme.*',
    'settings.users.*',
    'orders.create', // Le chef peut créer des commandes
    'orders.view',
    'orders.kitchen',
    'reports.view',
  ],
};

const VIEW_PERMISSIONS: Record<string, string[]> = {
  order: ['orders.create'],
  orders: ['orders.view'],
  reports: ['reports.view'],
  settings: ['settings.*', 'settings.branding.*', 'settings.theme.*'], // Chef via branding, caissier via theme
};

const SETTINGS_SECTION_PERMISSIONS: Record<string, string[]> = {
  general: ['settings.general.*'], // Only admin
  inventory: ['settings.inventory.*'],
  branding: ['settings.branding.*'],
  printers: ['settings.printers.*'], // Only admin
  numbering: ['settings.numbering.*'],
  receipt: ['settings.receipt.*'],
  promotions: ['settings.promotions.*'],
  theme: ['settings.theme.*'],
  products: ['settings.products.*'],
  users: ['settings.users.*'],
  data: ['settings.data.*'], // Only admin - backup, restore, reset
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isSetupRequired, setIsSetupRequired] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Reset inactivity timer on user activity
  const resetInactivityTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    
    if (isAuthenticated && !isLocked) {
      inactivityTimerRef.current = setTimeout(() => {
        setIsLocked(true);
      }, AUTO_LOCK_TIMEOUT_MS);
    }
  }, [isAuthenticated, isLocked]);

  // Listen for user activity
  useEffect(() => {
    if (!isAuthenticated || isLocked) return;
    
    const handleActivity = () => resetInactivityTimer();
    
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('mousedown', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    window.addEventListener('scroll', handleActivity);
    
    // Start the timer
    resetInactivityTimer();
    
    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [isAuthenticated, isLocked, resetInactivityTimer]);

  // Check if setup is required (no chef exists - admin is created by default)
  const checkSetupRequired = useCallback(async () => {
    try {
      const db = await getDB();
      const allUsers = await db.getAll('users');
      // Setup is required if no chef exists
      const hasChef = allUsers.some(u => u.role === 'chef');
      setIsSetupRequired(!hasChef);
      return !hasChef;
    } catch (error) {
      console.error('Failed to check setup status:', error);
      return false;
    }
  }, []);

  // Load session from localStorage on mount
  useEffect(() => {
    const loadSavedSession = async () => {
      // First check if setup is required
      const needsSetup = await checkSetupRequired();
      if (needsSetup) {
        return;
      }

      const savedUser = localStorage.getItem('pos_user');
      if (savedUser) {
        try {
          const userData = JSON.parse(savedUser);
          
          // Verify user still exists in database
          const db = await getDB();
          const dbUser = await db.get('users', userData.id);
          if (!dbUser) {
            localStorage.removeItem('pos_user');
            localStorage.removeItem('pos_session_id');
            return;
          }
          
          setUser(dbUser);
          setIsAuthenticated(true);
          
          // Restore active session if exists
          const sessionId = localStorage.getItem('pos_session_id');
          if (sessionId) {
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
            const newSession: UserSession = {
              id: generateUUID(),
              userId: dbUser.id,
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
  }, [checkSetupRequired]);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const db = await getDB();
      // Find user by username using index
      const foundUser = await db.getFromIndex('users', 'by-username', username);

      if (!foundUser) {
        return { success: false, message: 'Nom d\'utilisateur ou mot de passe incorrect' };
      }

      // Les non-admin ne peuvent pas se connecter avec mot de passe (ils n'en ont pas)
      if (foundUser.role !== 'admin') {
        return { success: false, message: 'Cet utilisateur utilise uniquement le code PIN pour se connecter' };
      }

      // Check if account is locked
      if (foundUser.lockedUntil && new Date(foundUser.lockedUntil) > new Date()) {
        const remainingMs = new Date(foundUser.lockedUntil).getTime() - Date.now();
        const remainingMins = Math.ceil(remainingMs / 60000);
        return { success: false, message: `Compte verrouillé. Réessayez dans ${remainingMins} minute(s)` };
      }

      // Password verification - support both hashed and legacy plain text passwords
      let passwordValid = false;
      if (isPasswordHashed(foundUser.password)) {
        passwordValid = await verifyPassword(password, foundUser.password);
      } else {
        // Legacy plain text password - migrate to hash
        if (foundUser.password === password) {
          passwordValid = true;
          // Migrate to hashed password
          foundUser.password = await hashPassword(password);
        }
      }

      if (!passwordValid) {
        // Increment failed attempts
        foundUser.failedAttempts = (foundUser.failedAttempts || 0) + 1;
        
        if (foundUser.failedAttempts >= MAX_LOGIN_ATTEMPTS) {
          foundUser.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
          await db.put('users', foundUser);
          return { success: false, message: `Trop de tentatives échouées. Compte verrouillé pour 5 minutes` };
        }
        
        await db.put('users', foundUser);
        const remaining = MAX_LOGIN_ATTEMPTS - foundUser.failedAttempts;
        return { success: false, message: `Mot de passe incorrect. ${remaining} tentative(s) restante(s)` };
      }

      // Reset failed attempts and update last login
      foundUser.failedAttempts = 0;
      foundUser.lockedUntil = undefined;
      foundUser.lastLogin = new Date();
      await db.put('users', foundUser);

      // Create a new user session
      const session: UserSession = {
        id: generateUUID(),
        userId: foundUser.id,
        loginAt: new Date(),
        isActive: true,
      };
      await db.put('userSessions', session);
      localStorage.setItem('pos_session_id', session.id);

      // Save session
      setUser(foundUser);
      setIsAuthenticated(true);
      setIsLocked(false);
      localStorage.setItem('pos_user', JSON.stringify(foundUser));

      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'Erreur lors de la connexion' };
    }
  }, []);

  const loginWithPin = useCallback(async (userId: string, pin: string) => {
    try {
      const db = await getDB();
      const foundUser = await db.get('users', userId);

      if (!foundUser) {
        return { success: false, message: 'Utilisateur non trouvé' };
      }

      if (!foundUser.pin) {
        return { success: false, message: 'Code PIN non configuré pour cet utilisateur' };
      }

      // Check if account is locked
      if (foundUser.lockedUntil && new Date(foundUser.lockedUntil) > new Date()) {
        const remainingMs = new Date(foundUser.lockedUntil).getTime() - Date.now();
        const remainingMins = Math.ceil(remainingMs / 60000);
        return { success: false, message: `Compte verrouillé. Réessayez dans ${remainingMins} minute(s)` };
      }

      // PIN verification - support both hashed and plain
      let pinValid = false;
      if (isPasswordHashed(foundUser.pin)) {
        pinValid = await verifyPassword(pin, foundUser.pin);
      } else {
        if (foundUser.pin === pin) {
          pinValid = true;
          // Migrate to hashed PIN
          foundUser.pin = await hashPassword(pin);
        }
      }

      if (!pinValid) {
        // Increment failed attempts
        foundUser.failedAttempts = (foundUser.failedAttempts || 0) + 1;
        
        if (foundUser.failedAttempts >= MAX_LOGIN_ATTEMPTS) {
          foundUser.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
          await db.put('users', foundUser);
          return { success: false, message: `Trop de tentatives échouées. Compte verrouillé pour 5 minutes` };
        }
        
        await db.put('users', foundUser);
        return { success: false, message: 'Code PIN incorrect' };
      }

      // Reset failed attempts and update last login
      foundUser.failedAttempts = 0;
      foundUser.lockedUntil = undefined;
      foundUser.lastLogin = new Date();
      await db.put('users', foundUser);

      // Create a new user session
      const session: UserSession = {
        id: generateUUID(),
        userId: foundUser.id,
        loginAt: new Date(),
        isActive: true,
      };
      await db.put('userSessions', session);
      localStorage.setItem('pos_session_id', session.id);

      // Save session
      setUser(foundUser);
      setIsAuthenticated(true);
      setIsLocked(false);
      localStorage.setItem('pos_user', JSON.stringify(foundUser));

      return { success: true };
    } catch (error) {
      console.error('PIN login error:', error);
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
    
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    
    setUser(null);
    setIsAuthenticated(false);
    setIsLocked(false);
    localStorage.removeItem('pos_user');
  }, []);

  const lock = useCallback(() => {
    if (isAuthenticated) {
      setIsLocked(true);
    }
  }, [isAuthenticated]);

  const unlock = useCallback(async (password: string) => {
    if (!user) {
      return { success: false, message: 'Aucun utilisateur connecté' };
    }

    // Les non-admin ne peuvent pas déverrouiller avec mot de passe
    if (user.role !== 'admin') {
      return { success: false, message: 'Utilisez votre code PIN pour déverrouiller' };
    }

    try {
      const db = await getDB();
      const currentUser = await db.get('users', user.id);
      
      if (!currentUser) {
        return { success: false, message: 'Utilisateur non trouvé' };
      }

      // Check if account is locked
      if (currentUser.lockedUntil && new Date(currentUser.lockedUntil) > new Date()) {
        const remainingMs = new Date(currentUser.lockedUntil).getTime() - Date.now();
        const remainingMins = Math.ceil(remainingMs / 60000);
        return { success: false, message: `Compte verrouillé. Réessayez dans ${remainingMins} minute(s)` };
      }

      // Password verification
      let passwordValid = false;
      if (isPasswordHashed(currentUser.password)) {
        passwordValid = await verifyPassword(password, currentUser.password);
      } else {
        passwordValid = currentUser.password === password;
      }

      if (!passwordValid) {
        // Increment failed attempts
        currentUser.failedAttempts = (currentUser.failedAttempts || 0) + 1;
        
        if (currentUser.failedAttempts >= MAX_LOGIN_ATTEMPTS) {
          currentUser.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
          await db.put('users', currentUser);
          return { success: false, message: `Trop de tentatives échouées. Compte verrouillé pour 5 minutes` };
        }
        
        await db.put('users', currentUser);
        return { success: false, message: 'Mot de passe incorrect' };
      }

      // Reset failed attempts
      currentUser.failedAttempts = 0;
      currentUser.lockedUntil = undefined;
      await db.put('users', currentUser);

      setIsLocked(false);
      resetInactivityTimer();
      return { success: true };
    } catch (error) {
      console.error('Unlock error:', error);
      return { success: false, message: 'Erreur lors du déverrouillage' };
    }
  }, [user, resetInactivityTimer]);

  const unlockWithPin = useCallback(async (pin: string) => {
    if (!user) {
      return { success: false, message: 'Aucun utilisateur connecté' };
    }

    try {
      const db = await getDB();
      const currentUser = await db.get('users', user.id);
      
      if (!currentUser) {
        return { success: false, message: 'Utilisateur non trouvé' };
      }

      if (!currentUser.pin) {
        return { success: false, message: 'Code PIN non configuré' };
      }

      // Check if account is locked
      if (currentUser.lockedUntil && new Date(currentUser.lockedUntil) > new Date()) {
        const remainingMs = new Date(currentUser.lockedUntil).getTime() - Date.now();
        const remainingMins = Math.ceil(remainingMs / 60000);
        return { success: false, message: `Compte verrouillé. Réessayez dans ${remainingMins} minute(s)` };
      }

      // PIN verification
      let pinValid = false;
      if (isPasswordHashed(currentUser.pin)) {
        pinValid = await verifyPassword(pin, currentUser.pin);
      } else {
        pinValid = currentUser.pin === pin;
      }

      if (!pinValid) {
        // Increment failed attempts
        currentUser.failedAttempts = (currentUser.failedAttempts || 0) + 1;
        
        if (currentUser.failedAttempts >= MAX_LOGIN_ATTEMPTS) {
          currentUser.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
          await db.put('users', currentUser);
          return { success: false, message: `Trop de tentatives échouées. Compte verrouillé pour 5 minutes` };
        }
        
        await db.put('users', currentUser);
        return { success: false, message: 'Code PIN incorrect' };
      }

      // Reset failed attempts
      currentUser.failedAttempts = 0;
      currentUser.lockedUntil = undefined;
      await db.put('users', currentUser);

      setIsLocked(false);
      resetInactivityTimer();
      return { success: true };
    } catch (error) {
      console.error('Unlock with PIN error:', error);
      return { success: false, message: 'Erreur lors du déverrouillage' };
    }
  }, [user, resetInactivityTimer]);

  const createInitialAdmin = useCallback(async (name: string, username: string, password: string, pin?: string) => {
    try {
      const db = await getDB();
      
      // Check if any users exist
      const existingUsers = await db.getAll('users');
      if (existingUsers.length > 0) {
        return { success: false, message: 'Des utilisateurs existent déjà' };
      }

      // Hash password and PIN
      const hashedPassword = await hashPassword(password);
      const hashedPin = pin ? await hashPassword(pin) : undefined;

      // Create admin user
      const adminUser: User = {
        id: generateUUID(),
        username: username.toLowerCase().trim(),
        password: hashedPassword,
        pin: hashedPin,
        role: 'admin',
        name: name.trim(),
        avatar: '👨‍💼',
        createdAt: new Date(),
      };

      await db.put('users', adminUser);
      
      // Auto-login the new admin
      const session: UserSession = {
        id: generateUUID(),
        userId: adminUser.id,
        loginAt: new Date(),
        isActive: true,
      };
      await db.put('userSessions', session);
      localStorage.setItem('pos_session_id', session.id);

      setUser(adminUser);
      setIsAuthenticated(true);
      setIsSetupRequired(false);
      localStorage.setItem('pos_user', JSON.stringify(adminUser));
      
      await loadUsers();

      return { success: true };
    } catch (error: any) {
      console.error('Create initial admin error:', error);
      if (error.name === 'ConstraintError') {
        return { success: false, message: 'Ce nom d\'utilisateur existe déjà' };
      }
      return { success: false, message: 'Erreur lors de la création du compte' };
    }
  }, []);

  const getRemainingLockoutTime = useCallback(async (userId: string): Promise<number> => {
    try {
      const db = await getDB();
      const foundUser = await db.get('users', userId);
      
      if (!foundUser || !foundUser.lockedUntil) {
        return 0;
      }

      const remaining = new Date(foundUser.lockedUntil).getTime() - Date.now();
      return Math.max(0, Math.ceil(remaining / 1000));
    } catch (error) {
      console.error('Get lockout time error:', error);
      return 0;
    }
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

  const saveUser = useCallback(async (userData: Omit<User, 'createdAt' | 'lastLogin'> & { createdAt?: Date; lastLogin?: Date; password?: string; pin?: string }) => {
    try {
      const db = await getDB();
      
      // Pour les non-admin (caissier, chef), pas de mot de passe - ils utilisent uniquement le PIN
      const isNonAdmin = userData.role !== 'admin';
      
      let finalPassword = isNonAdmin ? '' : (userData.password || '');
      let finalPin = userData.pin;
      
      // If editing, get existing data
      if (userData.id) {
        const existing = await db.get('users', userData.id);
        if (existing) {
          // Pour l'admin, garder le mot de passe existant si non fourni
          if (!isNonAdmin) {
            if (!userData.password) {
              finalPassword = existing.password;
            } else {
              // Hash new password if not already hashed
              if (!isPasswordHashed(userData.password)) {
                finalPassword = await hashPassword(userData.password);
              }
            }
          }
          // Keep existing PIN if not provided
          if (!userData.pin && existing.pin) {
            finalPin = existing.pin;
          } else if (userData.pin && !isPasswordHashed(userData.pin)) {
            finalPin = await hashPassword(userData.pin);
          }
        }
      } else {
        // New user - hash password (admin only) and PIN
        if (!isNonAdmin && finalPassword && !isPasswordHashed(finalPassword)) {
          finalPassword = await hashPassword(finalPassword);
        }
        if (finalPin && !isPasswordHashed(finalPin)) {
          finalPin = await hashPassword(finalPin);
        }
      }

      // Default avatars based on role
      const defaultAvatars: Record<UserRole, string> = {
        admin: '👨‍💼',
        caissier: '🧑‍💻',
        chef: '👨‍🍳',
      };
      
      const userToSave: User = {
        id: userData.id,
        username: userData.username,
        password: finalPassword, // Vide pour non-admin
        pin: finalPin,
        role: userData.role,
        name: userData.name,
        avatar: userData.avatar || defaultAvatars[userData.role],
        createdAt: userData.createdAt || new Date(),
        lastLogin: userData.lastLogin,
        failedAttempts: 0,
      };
      await db.put('users', userToSave);
      await loadUsers();
      
      // Update setup required status
      await checkSetupRequired();
    } catch (error) {
      console.error('Failed to save user:', error);
      throw error;
    }
  }, [loadUsers, checkSetupRequired]);

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
    isLocked,
    isSetupRequired,
    login,
    loginWithPin,
    logout,
    lock,
    unlock,
    unlockWithPin,
    hasPermission,
    canAccessView,
    canAccessSettingsSection,
    users,
    loadUsers,
    saveUser,
    deleteUser,
    createInitialAdmin,
    getRemainingLockoutTime,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
