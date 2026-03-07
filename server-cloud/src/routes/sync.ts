import { FastifyInstance } from 'fastify';
import { getPool } from '../db/connection';

/** Normalise un champ JSON stocké en TEXT dans SQLite → objet JS pour JSONB PG */
function parseJson(field: unknown): unknown {
  if (typeof field === 'string') {
    try { return JSON.parse(field); } catch { return field; }
  }
  return field ?? null;
}

export async function syncRoutes(fastify: FastifyInstance) {

  // ──────────────────────────────────────────────────────────────
  // GET /api/sync/status — statistiques de la DB cloud
  // ──────────────────────────────────────────────────────────────
  fastify.get('/api/sync/status', async (_request, reply) => {
    const pool = getPool();
    try {
      const [orders, products] = await Promise.all([
        pool.query(`
          SELECT COUNT(*) AS total, MAX(synced_at) AS last_synced_at
          FROM orders
        `),
        pool.query(`
          SELECT COUNT(*) AS total, MAX(synced_at) AS last_synced_at
          FROM products
        `),
      ]);
      return reply.send({
        orders: {
          total: parseInt(orders.rows[0].total),
          lastSyncedAt: orders.rows[0].last_synced_at,
        },
        products: {
          total: parseInt(products.rows[0].total),
          lastSyncedAt: products.rows[0].last_synced_at,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // ──────────────────────────────────────────────────────────────
  // POST /api/sync/orders — upsert batch de commandes
  // Body: { orders: Order[] }
  // ──────────────────────────────────────────────────────────────
  fastify.post('/api/sync/orders', async (request, reply) => {
    const { orders } = request.body as { orders: any[] };
    if (!Array.isArray(orders) || orders.length === 0) {
      return reply.status(400).send({ error: 'orders doit être un tableau non vide' });
    }

    const pool = getPool();
    const client = await pool.connect();
    let synced = 0;
    const errors: string[] = [];

    try {
      await client.query('BEGIN');

      for (const o of orders) {
        try {
          await client.query('SAVEPOINT sp');
          await client.query(
            `INSERT INTO orders (
              id, "orderNumber", status, type, lines,
              subtotal, discount, total, "paymentMethod",
              "promoCode", "promoName", "createdBy",
              "createdAt", "updatedAt", "paidAt", "sentToKitchenAt",
              "deliveryAddress", "deliveryPhone", "deliveryCustomerName",
              sync_status, synced_at
            ) VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
              $13,$14,$15,$16,$17,$18,$19,$20,$21
            )
            ON CONFLICT (id) DO UPDATE SET
              "orderNumber"          = EXCLUDED."orderNumber",
              status                 = EXCLUDED.status,
              type                   = EXCLUDED.type,
              lines                  = EXCLUDED.lines,
              subtotal               = EXCLUDED.subtotal,
              discount               = EXCLUDED.discount,
              total                  = EXCLUDED.total,
              "paymentMethod"        = EXCLUDED."paymentMethod",
              "promoCode"            = EXCLUDED."promoCode",
              "promoName"            = EXCLUDED."promoName",
              "createdBy"            = EXCLUDED."createdBy",
              "updatedAt"            = EXCLUDED."updatedAt",
              "paidAt"               = EXCLUDED."paidAt",
              "sentToKitchenAt"      = EXCLUDED."sentToKitchenAt",
              "deliveryAddress"      = EXCLUDED."deliveryAddress",
              "deliveryPhone"        = EXCLUDED."deliveryPhone",
              "deliveryCustomerName" = EXCLUDED."deliveryCustomerName",
              sync_status            = EXCLUDED.sync_status,
              synced_at              = EXCLUDED.synced_at`,
            [
              o.id,
              o.orderNumber   ?? null,
              o.status        ?? 'pending',
              o.type          ?? 'dine-in',
              parseJson(o.lines) ?? [],
              o.subtotal      ?? 0,
              o.discount      ?? 0,
              o.total         ?? 0,
              o.paymentMethod ?? null,
              o.promoCode     ?? null,
              o.promoName     ?? null,
              o.createdBy     ?? null,
              o.createdAt,
              o.updatedAt,
              o.paidAt               ?? null,
              o.sentToKitchenAt      ?? null,
              o.deliveryAddress      ?? null,
              o.deliveryPhone        ?? null,
              o.deliveryCustomerName ?? null,
              'synced',
              new Date().toISOString(),
            ]
          );
          await client.query('RELEASE SAVEPOINT sp');
          synced++;
        } catch (err: any) {
          await client.query('ROLLBACK TO SAVEPOINT sp');
          errors.push(`order ${o.id} : ${err.message}`);
        }
      }

      await client.query('COMMIT');
    } catch (err: any) {
      await client.query('ROLLBACK');
      return reply.status(500).send({ error: err.message });
    } finally {
      client.release();
    }

    return reply.send({ synced, errors: errors.length, details: errors });
  });

  // ──────────────────────────────────────────────────────────────
  // POST /api/sync/products — upsert batch de produits
  // Body: { products: Product[] }
  // ──────────────────────────────────────────────────────────────
  fastify.post('/api/sync/products', async (request, reply) => {
    const { products } = request.body as { products: any[] };
    if (!Array.isArray(products) || products.length === 0) {
      return reply.status(400).send({ error: 'products doit être un tableau non vide' });
    }

    const pool = getPool();
    const client = await pool.connect();
    let synced = 0;
    const errors: string[] = [];

    try {
      await client.query('BEGIN');

      for (const p of products) {
        try {
          await client.query('SAVEPOINT sp');
          await client.query(
            `INSERT INTO products (
              id, "categoryId", name, "basePrice", "sortOrder", available,
              description, image, "modifierGroupIds", "supplementIds",
              sync_status, synced_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
            ON CONFLICT (id) DO UPDATE SET
              "categoryId"       = EXCLUDED."categoryId",
              name               = EXCLUDED.name,
              "basePrice"        = EXCLUDED."basePrice",
              "sortOrder"        = EXCLUDED."sortOrder",
              available          = EXCLUDED.available,
              description        = EXCLUDED.description,
              image              = EXCLUDED.image,
              "modifierGroupIds" = EXCLUDED."modifierGroupIds",
              "supplementIds"    = EXCLUDED."supplementIds",
              sync_status        = EXCLUDED.sync_status,
              synced_at          = EXCLUDED.synced_at`,
            [
              p.id,
              p.categoryId         ?? null,
              p.name,
              p.basePrice          ?? 0,
              p.sortOrder          ?? 0,
              Boolean(p.available),
              p.description        ?? null,
              p.image              ?? null,
              parseJson(p.modifierGroupIds) ?? [],
              parseJson(p.supplementIds)    ?? [],
              'synced',
              new Date().toISOString(),
            ]
          );
          await client.query('RELEASE SAVEPOINT sp');
          synced++;
        } catch (err: any) {
          await client.query('ROLLBACK TO SAVEPOINT sp');
          errors.push(`product ${p.id} : ${err.message}`);
        }
      }

      await client.query('COMMIT');
    } catch (err: any) {
      await client.query('ROLLBACK');
      return reply.status(500).send({ error: err.message });
    } finally {
      client.release();
    }

    return reply.send({ synced, errors: errors.length, details: errors });
  });
}
