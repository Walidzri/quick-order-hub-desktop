import { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { wsService } from '../services/wsService';

export async function eventsRoutes(fastify: FastifyInstance) {
  fastify.get('/ws/events', { websocket: true }, (socket: WebSocket) => {
    wsService.addClient(socket);

    socket.send(JSON.stringify({
      type: 'connected',
      payload: { message: 'Connecté à /ws/events', clients: wsService.clientCount },
      timestamp: new Date().toISOString(),
    }));
  });

  // Endpoint REST pour connaître le nombre de clients connectés (debug)
  fastify.get('/api/ws/status', async () => {
    return { clients: wsService.clientCount };
  });
}
