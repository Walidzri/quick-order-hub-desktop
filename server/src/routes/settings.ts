import { FastifyInstance } from 'fastify';
import { settingsService } from '../services/settingsService';

export async function settingsRoutes(fastify: FastifyInstance) {
  fastify.get('/api/settings', async (request, reply) => {
    return settingsService.get();
  });

  fastify.patch('/api/settings', async (request, reply) => {
    return settingsService.update(request.body as any);
  });

  fastify.get('/api/printers', async (request, reply) => {
    return settingsService.getPrinters();
  });

  fastify.put('/api/printers/:id', async (request, reply) => {
    return settingsService.upsertPrinter(request.body as any);
  });

  fastify.delete('/api/printers/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await settingsService.deletePrinter(id);
    return reply.status(204).send();
  });
}
