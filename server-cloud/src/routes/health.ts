import { FastifyInstance } from 'fastify';
import { getPool } from '../db/connection';

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async (_request, reply) => {
    try {
      await getPool().query('SELECT 1');
      return reply.send({
        status: 'ok',
        db: 'connected',
        timestamp: new Date().toISOString(),
      });
    } catch {
      return reply.status(503).send({
        status: 'error',
        db: 'disconnected',
        timestamp: new Date().toISOString(),
      });
    }
  });
}
