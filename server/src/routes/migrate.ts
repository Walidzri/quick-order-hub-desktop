import { FastifyInstance } from 'fastify';
import { migrationService } from '../services/migrationService';

export async function migrateRoutes(fastify: FastifyInstance) {
  /** Vérifie si la migration est nécessaire (SQLite vide ?). */
  fastify.get('/api/migrate/status', async () => {
    return migrationService.status();
  });

  /** Exécute la migration : reçoit le dump IndexedDB complet, l'insère dans SQLite. */
  fastify.post('/api/migrate', async (request, reply) => {
    const result = migrationService.migrate(request.body as any);
    if (!result.success) {
      return reply.status(500).send(result);
    }
    return reply.status(200).send(result);
  });
}
