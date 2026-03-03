import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';

import { ordersRoutes } from './routes/orders';
import { productsRoutes } from './routes/products';
import { categoriesRoutes } from './routes/categories';
import { settingsRoutes } from './routes/settings';
import { printRoutes } from './routes/print';
import { migrateRoutes } from './routes/migrate';
import { promotionsRoutes } from './routes/promotions';
import { usersRoutes } from './routes/users';
import { authRoutes } from './routes/auth';
import { inventoryRoutes } from './routes/inventory';
import { eventsRoutes } from './routes/events';
import { cuisineRoutes } from './routes/cuisine';
import { displayRoutes } from './routes/display';
import { initDatabase, closeDatabase, getDefaultDbPath } from './db/connection';

const fastify = Fastify({
  logger: {
    level: 'info',
  },
  bodyLimit: 100 * 1024 * 1024, // 100 MB — migration IndexedDB peut être volumineuse
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

export async function startServer(port = 3002, dbPath?: string): Promise<typeof fastify> {
  // Initialiser SQLite avant les routes
  initDatabase(dbPath ?? getDefaultDbPath());
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
  await fastify.register(migrateRoutes);
  await fastify.register(promotionsRoutes);
  await fastify.register(usersRoutes);
  await fastify.register(authRoutes);
  await fastify.register(inventoryRoutes);
  await fastify.register(eventsRoutes);
  await fastify.register(cuisineRoutes);
  await fastify.register(displayRoutes);

  fastify.get('/api/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  await fastify.listen({ port, host: '0.0.0.0' });
  console.log(`[FASTIFY] Server listening on 0.0.0.0:${port} (http://127.0.0.1:${port} / réseau local)`);
  console.log(`[FASTIFY]   Tablette cuisine : http://[IP-LAN]:${port}/cuisine`);
  console.log(`[FASTIFY]   Télé salle       : http://[IP-LAN]:${port}/display`);

  return fastify;
}

export async function stopServer(): Promise<void> {
  await fastify.close();
  closeDatabase();
  console.log('[FASTIFY] Server stopped');
}
