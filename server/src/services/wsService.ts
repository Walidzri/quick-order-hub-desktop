import type { WebSocket } from 'ws';

const clients = new Set<WebSocket>();

export const wsService = {
  addClient(socket: WebSocket): void {
    clients.add(socket);
    socket.once('close', () => clients.delete(socket));
  },

  broadcast(type: string, payload: unknown): void {
    const message = JSON.stringify({ type, payload, timestamp: new Date().toISOString() });
    for (const client of clients) {
      if (client.readyState === 1 /* OPEN */) {
        client.send(message);
      }
    }
  },

  get clientCount(): number {
    return clients.size;
  },
};
