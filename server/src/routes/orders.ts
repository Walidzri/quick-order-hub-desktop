import { FastifyInstance } from 'fastify';
import { orderService } from '../services/orderService';
import { wsService } from '../services/wsService';

export async function ordersRoutes(fastify: FastifyInstance) {
  // GET /api/orders — supporte ?status=, ?start=, ?end=, ?page=, ?pageSize=
  fastify.get('/api/orders', async (request, reply) => {
    const { status, start, end, page, pageSize } = request.query as {
      status?: string; start?: string; end?: string;
      page?: string; pageSize?: string;
    };

    let orders = status
      ? orderService.getByStatus(status as any)
      : orderService.getAll();

    if (start || end) {
      orders = orders.filter(o => {
        const d = new Date(o.createdAt);
        if (start && d < new Date(start)) return false;
        if (end   && d > new Date(end))   return false;
        return true;
      });
    }

    if (page && pageSize) {
      const total     = orders.length;
      const ps        = parseInt(pageSize, 10);
      const offset    = (parseInt(page, 10) - 1) * ps;
      return {
        orders:     orders.slice(offset, offset + ps),
        total,
        totalPages: Math.ceil(total / ps),
      };
    }

    return orders;
  });

  fastify.get('/api/orders/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const order = orderService.getById(id);
    if (!order) return reply.status(404).send({ error: 'Commande introuvable' });
    return order;
  });

  fastify.post('/api/orders', async (request, reply) => {
    const order = orderService.create(request.body as any);
    wsService.broadcast('order:created', order);
    return reply.status(201).send(order);
  });

  fastify.patch('/api/orders/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const order = orderService.update(id, request.body as any);
    wsService.broadcast('order:updated', order);
    return order;
  });

  fastify.patch('/api/orders/:id/status', async (request, reply) => {
    const { id }     = request.params as { id: string };
    const { status } = request.body as { status: any };
    const order = orderService.updateStatus(id, status);
    wsService.broadcast('order:status', { id: order.id, status: order.status, order });
    return order;
  });

  // Envoyer en cuisine (status → sentToKitchen)
  fastify.post('/api/orders/:id/send-to-kitchen', async (request, reply) => {
    const { id } = request.params as { id: string };
    const order = orderService.updateStatus(id, 'sentToKitchen');
    wsService.broadcast('order:status', { id: order.id, status: order.status, order });
    return order;
  });

  // Marquer comme payé
  fastify.post('/api/orders/:id/mark-paid', async (request, reply) => {
    const { id }            = request.params as { id: string };
    const { paymentMethod } = request.body as { paymentMethod: any };
    const order = orderService.update(id, { paymentMethod });
    const paid  = orderService.updateStatus(order.id, 'paid');
    wsService.broadcast('order:status', { id: paid.id, status: paid.status, order: paid });
    return paid;
  });

  fastify.delete('/api/orders/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    orderService.delete(id);
    return reply.status(204).send();
  });

  // Supprimer plusieurs commandes
  fastify.post('/api/orders/delete-multiple', async (request, reply) => {
    const { ids } = request.body as { ids: string[] };
    for (const id of ids) orderService.delete(id);
    return { deleted: ids.length };
  });

  // Supprimer toutes les commandes
  fastify.delete('/api/orders', async (request, reply) => {
    const all = orderService.getAll();
    for (const o of all) orderService.delete(o.id);
    return { deleted: all.length };
  });

  // Purge des commandes cuisine bloquées (jours précédents)
  fastify.post('/api/orders/purge-kitchen', async (_request, reply) => {
    const purged = orderService.purgeStaleKitchenOrders();
    wsService.broadcast('kitchen:purged', { purged, timestamp: new Date().toISOString() });
    return { purged };
  });
}
