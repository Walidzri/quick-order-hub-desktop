import { getDatabase } from '../db/connection';

export interface SyncConfig {
  vpsUrl: string;
  apiKey: string;
  retryMaxDelay: number;
  syncInterval: number;
}

export interface SyncResult {
  synced: number;
  failed: number;
  pending: number;
  timestamp: Date;
}

function parseJsonField(val: unknown): unknown {
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return val; }
  }
  return val ?? null;
}

class SyncService {
  private config: SyncConfig | null = null;
  private intervalId: NodeJS.Timeout | null = null;

  /** Configure et démarre la boucle de synchronisation. */
  start(config: SyncConfig): void {
    this.config = config;
    if (this.intervalId) clearInterval(this.intervalId);

    // Boucle périodique
    this.intervalId = setInterval(() => {
      this.syncNow().catch(err =>
        console.warn('[SyncService] Erreur cycle :', err.message)
      );
    }, config.syncInterval);

    console.log(`[SyncService] Démarré — VPS: ${config.vpsUrl}, intervalle: ${config.syncInterval / 1000}s`);

    // Sync immédiate au démarrage (fire-and-forget)
    this.syncNow().catch(() => {});
  }

  /** Arrête la boucle. */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.config = null;
    console.log('[SyncService] Arrêté');
  }

  /** Indique si la boucle de sync est active. */
  isRunning(): boolean {
    return this.intervalId !== null;
  }

  private get headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.config?.apiKey) h['x-api-key'] = this.config.apiKey;
    return h;
  }

  // ─── Categories ──────────────────────────────────────────────────────────

  async syncCategories(): Promise<{ synced: number; failed: number }> {
    if (!this.config) return { synced: 0, failed: 0 };

    const db = getDatabase();
    const rows = db.prepare(`SELECT * FROM categories`).all() as Record<string, unknown>[];

    if (rows.length === 0) return { synced: 0, failed: 0 };

    const categories = rows.map(r => ({
      ...r,
      supplementIds: parseJsonField(r['supplementIds']),
    }));

    try {
      const res = await fetch(`${this.config.vpsUrl}/api/sync/categories`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ categories }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json() as { synced: number; errors: number; details?: string[] };

      if (result.errors > 0)
        console.warn(`[SyncService] Categories VPS errors :`, result.details);

      console.log(`[SyncService] Categories : ${result.synced} syncées`);
      return { synced: result.synced, failed: result.errors };
    } catch (err: any) {
      console.warn(`[SyncService] Sync categories échoué : ${err.message}`);
      return { synced: 0, failed: rows.length };
    }
  }

  // ─── Orders ──────────────────────────────────────────────────────────────

  async syncOrders(): Promise<{ synced: number; failed: number }> {
    if (!this.config) return { synced: 0, failed: 0 };

    const db = getDatabase();
    const rows = db.prepare(
      `SELECT * FROM orders WHERE sync_status IN ('pending', 'error') LIMIT 100`
    ).all() as Record<string, unknown>[];

    if (rows.length === 0) return { synced: 0, failed: 0 };

    const orders = rows.map(r => ({ ...r, lines: parseJsonField(r['lines']) }));
    const ids = rows.map(r => r['id'] as string);
    const placeholders = ids.map(() => '?').join(',');

    try {
      const res = await fetch(`${this.config.vpsUrl}/api/sync/orders`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ orders }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json() as { synced: number; errors: number; details?: string[] };

      if (result.errors > 0)
        console.warn(`[SyncService] Orders VPS errors :`, result.details);

      // Ne marquer synced que les orders effectivement acceptées
      if (result.synced > 0) {
        const now = new Date().toISOString();
        db.prepare(
          `UPDATE orders SET sync_status='synced', synced_at=? WHERE id IN (${placeholders})`
        ).run(now, ...ids);
        console.log(`[SyncService] Orders : ${result.synced} syncées`);
      }

      // Marquer error les orders rejetées
      if (result.errors > 0 && result.synced === 0) {
        db.prepare(
          `UPDATE orders SET sync_status='error' WHERE id IN (${placeholders})`
        ).run(...ids);
      }

      return { synced: result.synced, failed: result.errors };
    } catch (err: any) {
      db.prepare(
        `UPDATE orders SET sync_status='error' WHERE id IN (${placeholders})`
      ).run(...ids);
      console.warn(`[SyncService] Sync orders échoué : ${err.message}`);
      return { synced: 0, failed: ids.length };
    }
  }

  // ─── Products ─────────────────────────────────────────────────────────────

  async syncProducts(): Promise<{ synced: number; failed: number }> {
    if (!this.config) return { synced: 0, failed: 0 };

    const db = getDatabase();
    const rows = db.prepare(
      `SELECT * FROM products WHERE sync_status IN ('pending', 'error') LIMIT 100`
    ).all() as Record<string, unknown>[];

    if (rows.length === 0) return { synced: 0, failed: 0 };

    const products = rows.map(r => ({
      ...r,
      modifierGroupIds: parseJsonField(r['modifierGroupIds']),
      supplementIds:    parseJsonField(r['supplementIds']),
    }));
    const ids = rows.map(r => r['id'] as string);
    const placeholders = ids.map(() => '?').join(',');

    try {
      const res = await fetch(`${this.config.vpsUrl}/api/sync/products`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ products }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json() as { synced: number; errors: number; details?: string[] };

      if (result.errors > 0)
        console.warn(`[SyncService] Products VPS errors :`, result.details);

      if (result.synced > 0) {
        const now = new Date().toISOString();
        db.prepare(
          `UPDATE products SET sync_status='synced', synced_at=? WHERE id IN (${placeholders})`
        ).run(now, ...ids);
        console.log(`[SyncService] Products : ${result.synced} syncés`);
      }

      if (result.errors > 0 && result.synced === 0) {
        db.prepare(
          `UPDATE products SET sync_status='error' WHERE id IN (${placeholders})`
        ).run(...ids);
      }

      return { synced: result.synced, failed: result.errors };
    } catch (err: any) {
      db.prepare(
        `UPDATE products SET sync_status='error' WHERE id IN (${placeholders})`
      ).run(...ids);
      console.warn(`[SyncService] Sync products échoué : ${err.message}`);
      return { synced: 0, failed: ids.length };
    }
  }

  // ─── syncNow ──────────────────────────────────────────────────────────────

  async syncNow(): Promise<SyncResult> {
    if (!this.config) return { synced: 0, failed: 0, pending: 0, timestamp: new Date() };

    // Les catégories doivent arriver avant les produits (FK constraint)
    await this.syncCategories().catch(() => {});

    const [ordersRes, productsRes] = await Promise.allSettled([
      this.syncOrders(),
      this.syncProducts(),
    ]);

    const db = getDatabase();
    const { count: pendingOrders } = db.prepare(
      `SELECT COUNT(*) as count FROM orders WHERE sync_status = 'pending'`
    ).get() as { count: number };

    return {
      synced:
        (ordersRes.status   === 'fulfilled' ? ordersRes.value.synced   : 0) +
        (productsRes.status === 'fulfilled' ? productsRes.value.synced : 0),
      failed:
        (ordersRes.status   === 'fulfilled' ? ordersRes.value.failed   : 0) +
        (productsRes.status === 'fulfilled' ? productsRes.value.failed : 0),
      pending: pendingOrders,
      timestamp: new Date(),
    };
  }
}

export const syncService = new SyncService();
