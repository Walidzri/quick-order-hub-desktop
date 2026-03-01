import { FastifyInstance } from 'fastify';
import { orderService } from '../services/orderService';

export async function ordersRoutes(fastify: FastifyInstance) {
  fastify.get('/api/orders', async (request, reply) => {
    const orders = await orderService.getAll();
    return orders;
  });

  fastify.get('/api/orders/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const order = await orderService.getById(id);
    if (!order) return reply.status(404).send({ error: 'Commande introuvable' });
    return order;
  });

  fastify.post('/api/orders', async (request, reply) => {
    const order = await orderService.create(request.body as any);
    return reply.status(201).send(order);
  });

  fastify.patch('/api/orders/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const order = await orderService.update(id, request.body as any);
    return order;
  });

  fastify.patch('/api/orders/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: any };
    const order = await orderService.updateStatus(id, status);
    return order;
  });

  fastify.delete('/api/orders/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await orderService.delete(id);
    return reply.status(204).send();
  });
}
