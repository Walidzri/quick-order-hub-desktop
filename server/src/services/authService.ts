import { randomUUID, createHash } from 'crypto';
import type { User, UserSession, UserRole } from '@shared/types';
import { getDatabase } from '../db/connection';

// ─── SHA-256 (identique à crypto.subtle dans le renderer) ───────────────────

function hashSHA256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function isHashed(s: string): boolean {
  return /^[a-f0-9]{64}$/i.test(s);
}

// ─── helpers ────────────────────────────────────────────────────────────────

function toDate(val: unknown): Date {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  return new Date(val as string);
}

function rowToUser(row: Record<string, unknown>): User {
  return {
    id:             row['id']       as string,
    username:       row['username'] as string,
    password:       (row['password'] as string | null) ?? '',
    pin:            (row['pin']     as string | null) ?? undefined,
    role:           row['role']     as UserRole,
    name:           row['name']     as string,
    avatar:         (row['avatar']  as string | null) ?? undefined,
    createdAt:      toDate(row['createdAt']),
    lastLogin:      row['lastLogin']   ? toDate(row['lastLogin'])   : undefined,
    failedAttempts: (row['failedAttempts'] as number | null) ?? 0,
    lockedUntil:    row['lockedUntil'] ? toDate(row['lockedUntil']) : undefined,
  };
}

function rowToSession(row: Record<string, unknown>): UserSession {
  return {
    id:       row['id']      as string,
    userId:   row['userId']  as string,
    loginAt:  toDate(row['loginAt']),
    logoutAt: row['logoutAt'] ? toDate(row['logoutAt']) : undefined,
    isActive: row['isActive'] === 1 || row['isActive'] === true,
  };
}

// ─── service ────────────────────────────────────────────────────────────────

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000;

export const authService = {

  // ── User CRUD ──────────────────────────────────────────────────────────

  getAllUsers(): User[] {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM users ORDER BY name').all() as Record<string, unknown>[];
    return rows.map(rowToUser);
  },

  getUserById(id: string): User | null {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? rowToUser(row) : null;
  },

  getUserByUsername(username: string): User | null {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username.toLowerCase().trim()) as Record<string, unknown> | undefined;
    return row ? rowToUser(row) : null;
  },

  saveUser(data: Partial<User> & { id: string }): User {
    const db = getDatabase();
    const existing = authService.getUserById(data.id);

    const isNonAdmin = data.role !== 'admin';
    let finalPassword = isNonAdmin ? '' : (data.password ?? existing?.password ?? '');
    let finalPin = data.pin ?? existing?.pin;

    if (existing) {
      // Editing — hash new values if not already hashed
      if (!isNonAdmin && data.password && !isHashed(data.password)) {
        finalPassword = hashSHA256(data.password);
      }
      if (data.pin && !isHashed(data.pin)) {
        finalPin = hashSHA256(data.pin);
      }
    } else {
      // New user
      if (!isNonAdmin && finalPassword && !isHashed(finalPassword)) {
        finalPassword = hashSHA256(finalPassword);
      }
      if (finalPin && !isHashed(finalPin)) {
        finalPin = hashSHA256(finalPin);
      }
    }

    const defaultAvatars: Record<UserRole, string> = {
      admin: '👨‍💼',
      caissier: '🧑‍💻',
      chef: '👨‍🍳',
    };

    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, username, password, pin, role, name, avatar, active, createdAt, lastLogin, failedAttempts, lockedUntil)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 0, NULL)
      ON CONFLICT(id) DO UPDATE SET
        username       = excluded.username,
        password       = excluded.password,
        pin            = excluded.pin,
        role           = excluded.role,
        name           = excluded.name,
        avatar         = excluded.avatar
    `).run(
      data.id,
      (data.username ?? existing?.username ?? '').toLowerCase().trim(),
      finalPassword,
      finalPin ?? null,
      data.role ?? existing?.role ?? 'caissier',
      data.name ?? existing?.name ?? '',
      data.avatar ?? existing?.avatar ?? defaultAvatars[data.role as UserRole] ?? '🧑',
      data.createdAt ? new Date(data.createdAt).toISOString() : (existing?.createdAt ? new Date(existing.createdAt).toISOString() : now),
      data.lastLogin ? new Date(data.lastLogin).toISOString() : (existing?.lastLogin ? new Date(existing.lastLogin).toISOString() : null),
    );
    return authService.getUserById(data.id)!;
  },

  createUser(data: Omit<Partial<User>, 'id'>): User {
    return authService.saveUser({ ...data, id: randomUUID() });
  },

  deleteUser(id: string): void {
    const db = getDatabase();
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  },

  isSetupRequired(): boolean {
    const db = getDatabase();
    const row = db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'chef'").get() as { cnt: number };
    return row.cnt === 0;
  },

  // ── Auth ───────────────────────────────────────────────────────────────

  getAllSessions(): UserSession[] {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM user_sessions ORDER BY loginAt DESC').all() as Record<string, unknown>[];
    return rows.map(rowToSession);
  },

  createSession(userId: string): UserSession {
    const db = getDatabase();
    const id = randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO user_sessions (id, userId, loginAt, isActive) VALUES (?, ?, ?, 1)
    `).run(id, userId, now);
    return rowToSession(db.prepare('SELECT * FROM user_sessions WHERE id = ?').get(id) as Record<string, unknown>);
  },

  closeSession(sessionId: string): void {
    const db = getDatabase();
    db.prepare(`
      UPDATE user_sessions SET isActive = 0, logoutAt = ? WHERE id = ?
    `).run(new Date().toISOString(), sessionId);
  },

  /** Vérifie username + password, retourne l'utilisateur si OK. */
  loginWithPassword(username: string, password: string): { success: true; user: User; session: UserSession } | { success: false; message: string } {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username.toLowerCase().trim()) as Record<string, unknown> | undefined;
    if (!row) return { success: false, message: "Nom d'utilisateur ou mot de passe incorrect" };

    let user = rowToUser(row);

    if (user.role !== 'admin') {
      return { success: false, message: 'Cet utilisateur utilise uniquement le code PIN pour se connecter' };
    }

    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      const mins = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 60000);
      return { success: false, message: `Compte verrouillé. Réessayez dans ${mins} minute(s)` };
    }

    const storedHash = user.password;
    const inputHash  = isHashed(password) ? password : hashSHA256(password);
    const valid = storedHash === inputHash || (!isHashed(storedHash) && storedHash === password);

    if (!valid) {
      const attempts = (user.failedAttempts ?? 0) + 1;
      const lockedUntil = attempts >= MAX_LOGIN_ATTEMPTS ? new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString() : null;
      db.prepare('UPDATE users SET failedAttempts = ?, lockedUntil = ? WHERE id = ?').run(attempts, lockedUntil, user.id);
      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        return { success: false, message: 'Trop de tentatives échouées. Compte verrouillé pour 5 minutes' };
      }
      return { success: false, message: `Mot de passe incorrect. ${MAX_LOGIN_ATTEMPTS - attempts} tentative(s) restante(s)` };
    }

    // Reset, update lastLogin
    db.prepare('UPDATE users SET failedAttempts = 0, lockedUntil = NULL, lastLogin = ? WHERE id = ?')
      .run(new Date().toISOString(), user.id);
    user = authService.getUserById(user.id)!;
    const session = authService.createSession(user.id);
    return { success: true, user, session };
  },

  /** Vérifie userId + PIN. */
  loginWithPin(userId: string, pin: string): { success: true; user: User; session: UserSession } | { success: false; message: string } {
    const db = getDatabase();
    let user = authService.getUserById(userId);
    if (!user) return { success: false, message: 'Utilisateur non trouvé' };
    if (!user.pin) return { success: false, message: 'Code PIN non configuré pour cet utilisateur' };

    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      const mins = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 60000);
      return { success: false, message: `Compte verrouillé. Réessayez dans ${mins} minute(s)` };
    }

    const storedHash = user.pin;
    const inputHash  = isHashed(pin) ? pin : hashSHA256(pin);
    const valid = storedHash === inputHash || (!isHashed(storedHash) && storedHash === pin);

    if (!valid) {
      const attempts = (user.failedAttempts ?? 0) + 1;
      const lockedUntil = attempts >= MAX_LOGIN_ATTEMPTS ? new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString() : null;
      db.prepare('UPDATE users SET failedAttempts = ?, lockedUntil = ? WHERE id = ?').run(attempts, lockedUntil, user.id);
      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        return { success: false, message: 'Trop de tentatives échouées. Compte verrouillé pour 5 minutes' };
      }
      return { success: false, message: 'Code PIN incorrect' };
    }

    db.prepare('UPDATE users SET failedAttempts = 0, lockedUntil = NULL, lastLogin = ? WHERE id = ?')
      .run(new Date().toISOString(), user.id);
    user = authService.getUserById(user.id)!;
    const session = authService.createSession(user.id);
    return { success: true, user, session };
  },

  /** Vérifie le mot de passe de l'utilisateur actuel (déverrouillage). */
  verifyPassword(userId: string, password: string): { success: true } | { success: false; message: string } {
    const db = getDatabase();
    const user = authService.getUserById(userId);
    if (!user) return { success: false, message: 'Utilisateur non trouvé' };

    if (user.role !== 'admin') return { success: false, message: 'Utilisez votre code PIN pour déverrouiller' };

    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      const mins = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 60000);
      return { success: false, message: `Compte verrouillé. Réessayez dans ${mins} minute(s)` };
    }

    const storedHash = user.password;
    const inputHash  = isHashed(password) ? password : hashSHA256(password);
    const valid = storedHash === inputHash || (!isHashed(storedHash) && storedHash === password);

    if (!valid) {
      const attempts = (user.failedAttempts ?? 0) + 1;
      const lockedUntil = attempts >= MAX_LOGIN_ATTEMPTS ? new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString() : null;
      db.prepare('UPDATE users SET failedAttempts = ?, lockedUntil = ? WHERE id = ?').run(attempts, lockedUntil, userId);
      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        return { success: false, message: 'Trop de tentatives échouées. Compte verrouillé pour 5 minutes' };
      }
      return { success: false, message: 'Mot de passe incorrect' };
    }

    db.prepare('UPDATE users SET failedAttempts = 0, lockedUntil = NULL WHERE id = ?').run(userId);
    return { success: true };
  },

  /** Vérifie le PIN de l'utilisateur actuel (déverrouillage). */
  verifyPin(userId: string, pin: string): { success: true } | { success: false; message: string } {
    const db = getDatabase();
    const user = authService.getUserById(userId);
    if (!user) return { success: false, message: 'Utilisateur non trouvé' };
    if (!user.pin) return { success: false, message: 'Code PIN non configuré' };

    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      const mins = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 60000);
      return { success: false, message: `Compte verrouillé. Réessayez dans ${mins} minute(s)` };
    }

    const storedHash = user.pin;
    const inputHash  = isHashed(pin) ? pin : hashSHA256(pin);
    const valid = storedHash === inputHash || (!isHashed(storedHash) && storedHash === pin);

    if (!valid) {
      const attempts = (user.failedAttempts ?? 0) + 1;
      const lockedUntil = attempts >= MAX_LOGIN_ATTEMPTS ? new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString() : null;
      db.prepare('UPDATE users SET failedAttempts = ?, lockedUntil = ? WHERE id = ?').run(attempts, lockedUntil, userId);
      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        return { success: false, message: 'Trop de tentatives échouées. Compte verrouillé pour 5 minutes' };
      }
      return { success: false, message: 'Code PIN incorrect' };
    }

    db.prepare('UPDATE users SET failedAttempts = 0, lockedUntil = NULL WHERE id = ?').run(userId);
    return { success: true };
  },

  getRemainingLockoutSeconds(userId: string): number {
    const user = authService.getUserById(userId);
    if (!user?.lockedUntil) return 0;
    return Math.max(0, Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 1000));
  },

  /** Création de l'admin initial (premier lancement). */
  createInitialAdmin(name: string, username: string, password: string, pin?: string): { success: true; user: User; session: UserSession } | { success: false; message: string } {
    const existing = authService.getAllUsers();
    if (existing.length > 0) return { success: false, message: 'Des utilisateurs existent déjà' };

    const id = randomUUID();
    const hashedPassword = hashSHA256(password);
    const hashedPin = pin ? hashSHA256(pin) : undefined;

    const user = authService.saveUser({
      id,
      username,
      password: hashedPassword,
      pin: hashedPin,
      role: 'admin',
      name,
      avatar: '👨‍💼',
    });

    const session = authService.createSession(user.id);
    return { success: true, user, session };
  },
};
