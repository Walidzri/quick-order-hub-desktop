/**
 * connection.ts — Singleton SQLite (better-sqlite3).
 *
 * Usage :
 *   import { initDatabase, getDatabase } from './db/connection';
 *
 *   // Au démarrage du serveur :
 *   initDatabase('/path/to/pos.db');
 *
 *   // Dans un service :
 *   const db = getDatabase();
 *   const rows = db.prepare('SELECT * FROM orders').all();
 */

import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { applySchema } from './schema';

let db: Database.Database | null = null;

/**
 * Initialise la connexion SQLite et applique le schéma.
 * À appeler une seule fois au démarrage (depuis startServer).
 */
export function initDatabase(dbPath: string): Database.Database {
  if (db) return db;

  // Créer le répertoire parent si nécessaire
  const dir = dirname(dbPath);
  if (dir && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);

  // Pragmas recommandés pour les apps desktop
  db.pragma('journal_mode = WAL');   // Meilleures performances en lecture concurrente
  db.pragma('foreign_keys = ON');    // Contraintes FK activées
  db.pragma('synchronous = NORMAL'); // Bon équilibre perf / sécurité

  // Appliquer le schéma (idempotent)
  applySchema(db);

  console.log(`[DB] SQLite ouvert : ${dbPath}`);
  return db;
}

/**
 * Retourne l'instance SQLite existante.
 * Lève une erreur si initDatabase() n'a pas encore été appelé.
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('[DB] Base de données non initialisée — appeler initDatabase() d\'abord');
  }
  return db;
}

/**
 * Ferme proprement la connexion (appelé à l'arrêt du serveur).
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    console.log('[DB] SQLite fermé');
  }
}

/**
 * Chemin SQLite par défaut selon l'environnement.
 * - Production : passé explicitement depuis electron/main.ts (userData)
 * - Développement : ./data/pos.db dans le répertoire de travail
 */
export function getDefaultDbPath(): string {
  return join(process.cwd(), 'data', 'pos.db');
}
