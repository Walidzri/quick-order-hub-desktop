/**
 * migration-idb-to-sqlite.ts
 *
 * Utilitaire frontend (Renderer) — lit toutes les stores IndexedDB
 * et les envoie à POST /api/migrate pour les insérer dans SQLite.
 *
 * Usage :
 *   import { runMigration, checkMigrationStatus } from '@/lib/migration-idb-to-sqlite';
 */

import { getDB } from '@/lib/database';

const API_BASE = 'http://127.0.0.1:3002';

export interface MigrationStatus {
  needed: boolean;
  counts: Record<string, number>;
}

export interface MigrationResult {
  success: boolean;
  counts:  Record<string, number>;
  error?:  string;
}

/** Vérifie si la migration est nécessaire (SQLite côté serveur est-il vide ?). */
export async function checkMigrationStatus(): Promise<MigrationStatus> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${API_BASE}/api/migrate/status`, { signal: controller.signal });
    if (!res.ok) throw new Error(`Erreur serveur : ${res.status}`);
    return res.json();
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Timeout : Fastify ne répond pas sur 127.0.0.1:3002');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Lit toutes les stores IndexedDB et les envoie au serveur Fastify.
 * Retourne le résultat de la migration (counts par table).
 */
export async function runMigration(
  onProgress?: (step: string) => void,
): Promise<MigrationResult> {
  const db = await getDB();

  onProgress?.('Lecture des catégories…');
  const categories = await db.getAll('categories');

  onProgress?.('Lecture des produits…');
  const products = await db.getAll('products');

  onProgress?.('Lecture des variantes…');
  const productVariants = await db.getAll('productVariants');

  onProgress?.('Lecture des groupes de modificateurs…');
  const modifierGroups = await db.getAll('modifierGroups');

  onProgress?.('Lecture des options de modificateurs…');
  const modifierOptions = await db.getAll('modifierOptions');

  onProgress?.('Lecture des commandes…');
  const orders = await db.getAll('orders');

  onProgress?.('Lecture des imprimantes…');
  const printers = await db.getAll('printers');

  onProgress?.('Lecture des promotions…');
  const promotions = await db.getAll('promotions');

  onProgress?.('Lecture des paramètres…');
  const settingsAll = await db.getAll('settings');

  onProgress?.('Lecture des compteurs…');
  const numberingCounters = await db.getAll('numberingCounters');

  onProgress?.('Lecture des utilisateurs…');
  const users = await db.getAll('users');

  onProgress?.('Lecture des sessions…');
  const userSessions = await db.getAll('userSessions');

  onProgress?.('Lecture des fournisseurs…');
  const suppliers = await db.getAll('suppliers');

  onProgress?.('Lecture des articles d\'inventaire…');
  const inventoryItems = await db.getAll('inventoryItems');

  onProgress?.('Lecture des factures…');
  const invoices = await db.getAll('invoices');

  onProgress?.('Envoi vers SQLite…');

  const payload = {
    categories,
    products,
    productVariants,
    modifierGroups,
    modifierOptions,
    orders,
    printers,
    promotions,
    settings: settingsAll,
    numberingCounters,
    users,
    userSessions,
    suppliers,
    inventoryItems,
    invoices,
  };

  const res = await fetch(`${API_BASE}/api/migrate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const result: MigrationResult = await res.json();

  if (!res.ok || !result.success) {
    throw new Error(result.error ?? `Erreur serveur : ${res.status}`);
  }

  onProgress?.('Migration terminée !');
  return result;
}
