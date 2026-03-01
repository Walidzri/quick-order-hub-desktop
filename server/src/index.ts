import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';

import { ordersRoutes } from './routes/orders';
import { productsRoutes } from './routes/products';
import { categoriesRoutes } from './routes/categories';
import { settingsRoutes } from './routes/settings';
import { printRoutes } from './routes/print';

const fastify = Fastify({
  logger: {
    level: 'info',
  },
});

// Convertit les erreurs "non implémenté" (stubs Phase 2/3) en 501 au lieu de 500
fastify.setErrorHandler((error, request, reply) => {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('non implémenté')) {
    return reply.status(501).send({ error: message });
  }
  fastify.log.error(error);
  reply.status(500).send({ error: 'Internal Server Error' });
});

export async function startServer(port = 3001): Promise<typeof fastify> {
  await fastify.register(cors, { origin: true });
  await fastify.register(websocket);

  // Parser JSON permissif : accepte un body vide (utile pour DELETE avec Content-Type: application/json)
  fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    if (!body || (body as string).trim() === '') {
      done(null, null);
      return;
    }
    try {
      done(null, JSON.parse(body as string));
    } catch {
      done(new Error('Invalid JSON body'));
    }
  });

  await fastify.register(ordersRoutes);
  await fastify.register(productsRoutes);
  await fastify.register(categoriesRoutes);
  await fastify.register(settingsRoutes);
  await fastify.register(printRoutes);

  fastify.get('/api/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  await fastify.listen({ port, host: '0.0.0.0' });
  console.log(`[FASTIFY] Server listening on http://127.0.0.1:${port}`);

  return fastify;
}

export async function stopServer(): Promise<void> {
  await fastify.close();
  console.log('[FASTIFY] Server stopped');
}
