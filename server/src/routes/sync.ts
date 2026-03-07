import { FastifyInstance } from 'fastify';
import { getDatabase } from '../db/connection';
import { syncService } from '../services/syncService';

export async function syncRoutes(fastify: FastifyInstance) {

  // GET /api/sync/status — état de la synchronisation cloud
  fastify.get('/api/sync/status', async (_request, reply) => {
    const db = getDatabase();

    const orderStats = db.prepare(`
      SELECT
        SUM(CASE WHEN sync_status = 'pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN sync_status = 'synced'  THEN 1 ELSE 0 END) AS synced,
        SUM(CASE WHEN sync_status = 'error'   THEN 1 ELSE 0 END) AS error,
        MAX(synced_at) AS lastSyncedAt
      FROM orders
    `).get() as { pending: number; synced: number; error: number; lastSyncedAt: string | null };

    const productStats = db.prepare(`
      SELECT
        SUM(CASE WHEN sync_status = 'pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN sync_status = 'synced'  THEN 1 ELSE 0 END) AS synced,
        SUM(CASE WHEN sync_status = 'error'   THEN 1 ELSE 0 END) AS error,
        MAX(synced_at) AS lastSyncedAt
      FROM products
    `).get() as { pending: number; synced: number; error: number; lastSyncedAt: string | null };

    return reply.send({
      orders: {
        pending:      orderStats.pending   ?? 0,
        synced:       orderStats.synced    ?? 0,
        error:        orderStats.error     ?? 0,
        lastSyncedAt: orderStats.lastSyncedAt ?? null,
      },
      products: {
        pending:      productStats.pending   ?? 0,
        synced:       productStats.synced    ?? 0,
        error:        productStats.error     ?? 0,
        lastSyncedAt: productStats.lastSyncedAt ?? null,
      },
      timestamp: new Date().toISOString(),
    });
  });

  // POST /api/sync/now — déclenche une synchronisation immédiate
  fastify.post('/api/sync/now', async (_request, reply) => {
    const result = await syncService.syncNow();
    return reply.send(result);
  });
}
