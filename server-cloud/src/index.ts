import Fastify from 'fastify';
import cors from '@fastify/cors';
import { healthRoutes } from './routes/health';
import { syncRoutes } from './routes/sync';
import { closePool, getPool } from './db/connection';

const PORT = parseInt(process.env.PORT || '4000');
const API_KEY = process.env.API_KEY;

async function main() {
  const fastify = Fastify({ logger: true });

  // ── CORS ──────────────────────────────────────────────────────
  await fastify.register(cors, { origin: true });

  // ── Auth API Key (optionnel — activé si API_KEY env est défini) ─
  if (API_KEY) {
    fastify.addHook('onRequest', async (request, reply) => {
      if (request.url === '/health') return;
      if (request.headers['x-api-key'] !== API_KEY) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }
    });
  }

  // ── Routes ────────────────────────────────────────────────────
  await fastify.register(healthRoutes);
  await fastify.register(syncRoutes);

  // ── Arrêt propre ─────────────────────────────────────────────
  const shutdown = async () => {
    console.log('[Server] Arrêt...');
    await fastify.close();
    await closePool();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // ── Démarrage ─────────────────────────────────────────────────
  try {
    await getPool().query('SELECT 1');
    console.log('[PG] Connexion PostgreSQL OK');

    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`[Server] Fastify cloud démarré sur le port ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
