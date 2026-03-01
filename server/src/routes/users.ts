import { FastifyInstance } from 'fastify';
import { authService } from '../services/authService';

export async function usersRoutes(fastify: FastifyInstance) {
  // Setup status (aucun chef = setup requis)
  fastify.get('/api/users/setup-status', async () => {
    return { setupRequired: authService.isSetupRequired() };
  });

  fastify.get('/api/users', async () => {
    return authService.getAllUsers();
  });

  fastify.get('/api/users/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = authService.getUserById(id);
    if (!user) return reply.status(404).send({ error: 'Utilisateur introuvable' });
    return user;
  });

  fastify.get('/api/users/:id/lockout', async (request) => {
    const { id } = request.params as { id: string };
    return { remainingSeconds: authService.getRemainingLockoutSeconds(id) };
  });

  fastify.post('/api/users', async (request, reply) => {
    const data = request.body as any;
    const user = authService.createUser(data);
    return reply.status(201).send(user);
  });

  fastify.put('/api/users/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = authService.saveUser({ ...(request.body as any), id });
    return user;
  });

  fastify.delete('/api/users/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    authService.deleteUser(id);
    return reply.status(204).send();
  });
}
