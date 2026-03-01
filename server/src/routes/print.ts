import { FastifyInstance } from 'fastify';
import { printService } from '../services/printService';

export async function printRoutes(fastify: FastifyInstance) {
  fastify.post('/api/print/receipt', async (request, reply) => {
    const { order, printer } = request.body as any;
    await printService.printReceipt(order, printer);
    return { success: true };
  });

  fastify.post('/api/print/kitchen', async (request, reply) => {
    const { order, printer } = request.body as any;
    await printService.printKitchenTicket(order, printer);
    return { success: true };
  });

  fastify.post('/api/print/drawer', async (request, reply) => {
    const { printer } = request.body as any;
    await printService.openDrawer(printer);
    return { success: true };
  });

  fastify.get('/api/print/test', async (request, reply) => {
    const { host, port } = request.query as { host: string; port: string };
    const ok = await printService.testConnection(host, parseInt(port, 10));
    return { connected: ok };
  });
}
