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

export async function startServer(port = 3001): Promise<typeof fastify> {
  await fastify.register(cors, { origin: true });
  await fastify.register(websocket);

  await fastify.register(ordersRoutes);
  await fastify.register(productsRoutes);
  await fastify.register(categoriesRoutes);
  await fastify.register(settingsRoutes);
  await fastify.register(printRoutes);

  fastify.get('/api/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  await fastify.listen({ port, host: '127.0.0.1' });
  console.log(`[FASTIFY] Server listening on http://127.0.0.1:${port}`);

  return fastify;
}

export async function stopServer(): Promise<void> {
  await fastify.close();
  console.log('[FASTIFY] Server stopped');
}
