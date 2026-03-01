import { FastifyInstance } from 'fastify';
import { promotionService } from '../services/promotionService';

export async function promotionsRoutes(fastify: FastifyInstance) {
  fastify.get('/api/promotions', async () => {
    return promotionService.getAll();
  });

  fastify.get('/api/promotions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const promo = promotionService.getById(id);
    if (!promo) return reply.status(404).send({ error: 'Promotion introuvable' });
    return promo;
  });

  fastify.post('/api/promotions', async (request, reply) => {
    const promo = promotionService.create(request.body as any);
    return reply.status(201).send(promo);
  });

  fastify.put('/api/promotions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const promo = promotionService.update(id, request.body as any);
    return promo;
  });

  fastify.patch('/api/promotions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const promo = promotionService.update(id, request.body as any);
    return promo;
  });

  fastify.delete('/api/promotions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    promotionService.delete(id);
    return reply.status(204).send();
  });
}
