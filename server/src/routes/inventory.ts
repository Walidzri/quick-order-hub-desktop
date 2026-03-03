import { FastifyInstance } from 'fastify';
import { inventoryService } from '../services/inventoryService';
import type { Supplier, InventoryItem, Invoice } from '@shared/types';

export async function inventoryRoutes(fastify: FastifyInstance) {

  // ── Suppliers ──────────────────────────────────────────────────────────

  fastify.get('/api/inventory/suppliers', async () => {
    return inventoryService.getAllSuppliers();
  });

  fastify.put('/api/inventory/suppliers/:id', async (request) => {
    const { id } = request.params as { id: string };
    return inventoryService.saveSupplier({ ...(request.body as Supplier), id });
  });

  fastify.delete('/api/inventory/suppliers/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    inventoryService.deleteSupplier(id);
    return reply.status(204).send();
  });

  // ── Inventory Items ─────────────────────────────────────────────────────

  fastify.get('/api/inventory/items', async () => {
    return inventoryService.getAllItems();
  });

  fastify.put('/api/inventory/items/:id', async (request) => {
    const { id } = request.params as { id: string };
    return inventoryService.saveItem({ ...(request.body as InventoryItem), id });
  });

  fastify.delete('/api/inventory/items/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    inventoryService.deleteItem(id);
    return reply.status(204).send();
  });

  // ── Invoices ────────────────────────────────────────────────────────────

  fastify.get('/api/inventory/invoices', async () => {
    return inventoryService.getAllInvoices();
  });

  fastify.put('/api/inventory/invoices/:id', async (request) => {
    const { id } = request.params as { id: string };
    return inventoryService.saveInvoice({ ...(request.body as Invoice), id });
  });

  fastify.delete('/api/inventory/invoices/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    inventoryService.deleteInvoice(id);
    return reply.status(204).send();
  });
}
