/**
 * schema.ts — Applique le schéma SQLite sur la connexion ouverte.
 * Lit le SQL depuis le fichier de migration 001_initial.sql.
 * Idempotent (CREATE TABLE IF NOT EXISTS) — safe à appeler à chaque démarrage.
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function applySchema(db: Database.Database): void {
  const sqlPath = join(__dirname, 'migrations', '001_initial.sql');
  const sql = readFileSync(sqlPath, 'utf-8');
  db.exec(sql);
}
