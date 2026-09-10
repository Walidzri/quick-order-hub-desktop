import { FastifyInstance } from 'fastify';
import { webOrderService } from '../services/webOrderService';
import { orderService } from '../services/orderService';
import { wsService } from '../services/wsService';
import { getDatabase } from '../db/connection';

export async function webOrdersRoutes(fastify: FastifyInstance) {
  // GET /api/web-orders/status — état du service de polling
  fastify.get('/api/web-orders/status', async () => {
    return webOrderService.getStatus();
  });

  // POST /api/web-orders/test — tester la connexion Supabase
  fastify.post('/api/web-orders/test', async (request) => {
    const { supabaseUrl, supabaseAnonKey } = request.body as { supabaseUrl: string; supabaseAnonKey: string };
    return webOrderService.testConnection(supabaseUrl, supabaseAnonKey);
  });

  // POST /api/web-orders/pull — forcer un pull immédiat
  fastify.post('/api/web-orders/pull', async () => {
    return webOrderService.pullOrders();
  });

  // GET /api/web-orders — lister les commandes importées depuis le web
  fastify.get('/api/web-orders', async (request) => {
    const { status } = request.query as { status?: string };
    const db = getDatabase();

    let query = `SELECT * FROM orders WHERE source = 'web'`;
    const params: string[] = [];

    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }

    query += ` ORDER BY createdAt DESC`;

    const rows = db.prepare(query).all(...params) as Record<string, unknown>[];
    // Normalize snake_case columns to camelCase for consistency with frontend
    return rows.map(row => ({
      ...row,
      lines: JSON.parse(row['lines'] as string || '[]'),
      kitchenReadyAt: row['kitchen_ready_at'] || null,
      webOrderId: row['web_order_id'] || null,
      webStatus: row['web_status'] || null,
      webCustomerPhone: row['web_customer_phone'] || null,
    }));
  });

  // PATCH /api/web-orders/:id/accept — accepter une commande web (pending → sentToKitchen)
  fastify.patch('/api/web-orders/:id/accept', async (request, reply) => {
    const { id } = request.params as { id: string };
    const order = orderService.getById(id);
    if (!order) return reply.status(404).send({ error: 'Commande introuvable' });
    if (order.source !== 'web') return reply.status(400).send({ error: 'Pas une commande web' });

    // Move to sentToKitchen + update web_status locally before broadcast
    const now = new Date().toISOString();
    const db = getDatabase();
    db.prepare(`UPDATE orders SET status = 'sentToKitchen', web_status = 'preparing', sentToKitchenAt = ?, updatedAt = ? WHERE id = ?`)
      .run(now, now, id);

    const updated = orderService.getById(id)!;

    // Broadcast so kitchen "En cours" tab picks it up
    wsService.broadcast('order:created', updated);

    // Sync acceptance to Supabase
    if (order.web_order_id) {
      webOrderService.updateWebOrderStatus(order.web_order_id, 'sentToKitchen').catch(() => {});
    }

    return { ok: true, order: updated };
  });

  // PATCH /api/web-orders/:id/set-delivering — marquer en livraison
  fastify.patch('/api/web-orders/:id/set-delivering', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = getDatabase();
    const order = orderService.getById(id);
    if (!order) return reply.status(404).send({ error: 'Commande introuvable' });

    db.prepare(`UPDATE orders SET web_status = 'delivering', updatedAt = ? WHERE id = ?`)
      .run(new Date().toISOString(), id);

    // Sync to Supabase
    if (order.web_order_id) {
      await webOrderService.updateWebOrderStatus(order.web_order_id, 'delivering' as any);
    }

    wsService.broadcast('order:updated', orderService.getById(id));
    return { ok: true };
  });

  // PATCH /api/web-orders/:id/reject — refuser une commande web
  fastify.patch('/api/web-orders/:id/reject', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { reason } = request.body as { reason?: string };
    const order = orderService.getById(id);
    if (!order) return reply.status(404).send({ error: 'Commande introuvable' });
    if (order.source !== 'web') return reply.status(400).send({ error: 'Pas une commande web' });

    const updated = orderService.updateStatus(id, 'cancelled');
    wsService.broadcast('web-order:rejected', { id, order: updated });

    if (order.web_order_id) {
      await webOrderService.updateWebOrderStatus(order.web_order_id, 'cancelled', reason);
    }

    return { ok: true, order: updated };
  });
}
