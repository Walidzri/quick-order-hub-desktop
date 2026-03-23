import { FastifyInstance } from 'fastify';
import { settingsService } from '../services/settingsService';
import { syncService } from '../services/syncService';
import { productService } from '../services/productService';
import { orderService } from '../services/orderService';
import { promotionService } from '../services/promotionService';
import { authService } from '../services/authService';
import { inventoryService } from '../services/inventoryService';
import { migrationService, MigrationPayload } from '../services/migrationService';
import { getDatabase } from '../db/connection';

export async function settingsRoutes(fastify: FastifyInstance) {
  fastify.get('/api/settings', async (request, reply) => {
    return settingsService.get();
  });

  fastify.patch('/api/settings', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const updated = settingsService.update(body as any);

    // Démarrer/arrêter la sync cloud en live si le toggle change
    if ('cloudSyncEnabled' in body) {
      if (body.cloudSyncEnabled && !syncService.isRunning()) {
        const cloudUrl = process.env.CLOUD_API_URL || 'http://172.18.0.6:4000';
        const cloudKey = process.env.CLOUD_API_KEY || '';
        syncService.start({ vpsUrl: cloudUrl, apiKey: cloudKey, syncInterval: 30_000, retryMaxDelay: 300_000 });
      } else if (!body.cloudSyncEnabled && syncService.isRunning()) {
        syncService.stop();
      }
    }

    return updated;
  });

  fastify.get('/api/printers', async (request, reply) => {
    return settingsService.getPrinters();
  });

  fastify.put('/api/printers/:id', async (request, reply) => {
    return settingsService.upsertPrinter(request.body as any);
  });

  fastify.delete('/api/printers/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await settingsService.deletePrinter(id);
    return reply.status(204).send();
  });

  // ── Backup Export ───────────────────────────────────────────────────────
  // Exporte toutes les données SQLite dans le format MigrationPayload (JSON)

  fastify.get('/api/backup/export', async () => {
    const db = getDatabase();

    const productVariants = (
      db.prepare('SELECT * FROM product_variants').all() as Record<string, unknown>[]
    ).map(r => ({ id: r['id'], productId: r['productId'], size: r['size'], price: r['price'] }));

    const numberingCounters = (
      db.prepare('SELECT * FROM numbering_counters').all() as Record<string, unknown>[]
    ).map(r => ({ id: r['id'] as string, date: r['date'] as string, counter: r['counter'] as number }));

    return {
      version:    '2.0.0',
      exportDate: new Date().toISOString(),
      data: {
        categories:        productService.getAllCategories(),
        products:          productService.getAllProducts(),
        productVariants,
        modifierGroups:    productService.getModifierGroups(),
        modifierOptions:   productService.getModifierOptions(),
        orders:            orderService.getAll(),
        printers:          settingsService.getPrinters(),
        promotions:        promotionService.getAll(),
        settings:          [settingsService.get()],
        numberingCounters,
        users:             authService.getAllUsers(),
        userSessions:      authService.getAllSessions(),
        suppliers:         inventoryService.getAllSuppliers(),
        inventoryItems:    inventoryService.getAllItems(),
        invoices:          inventoryService.getAllInvoices(),
      },
    };
  });

  // ── Backup Restore ──────────────────────────────────────────────────────
  // Accepte le format { version, exportDate, data: MigrationPayload }
  // Efface toutes les tables puis réimporte.

  fastify.post('/api/backup/restore', async (request, reply) => {
    const body = request.body as { data?: MigrationPayload } | MigrationPayload;
    // Supporte les deux formats : { data: payload } et le payload direct
    const payload: MigrationPayload = 'data' in body && body.data ? body.data : body as MigrationPayload;

    const db = getDatabase();

    // Vider toutes les tables dans l'ordre (enfants avant parents)
    db.transaction(() => {
      db.prepare('DELETE FROM print_jobs').run();
      db.prepare('DELETE FROM user_sessions').run();
      db.prepare('DELETE FROM invoices').run();
      db.prepare('DELETE FROM modifier_options').run();
      db.prepare('DELETE FROM product_variants').run();
      db.prepare('DELETE FROM orders').run();
      db.prepare('DELETE FROM modifier_groups').run();
      db.prepare('DELETE FROM products').run();
      db.prepare('DELETE FROM categories').run();
      db.prepare('DELETE FROM printers').run();
      db.prepare('DELETE FROM promotions').run();
      db.prepare('DELETE FROM users').run();
      db.prepare('DELETE FROM suppliers').run();
      db.prepare('DELETE FROM inventory_items').run();
      db.prepare('DELETE FROM settings').run();
      db.prepare('DELETE FROM numbering_counters').run();
    })();

    // Réimporter
    const result = migrationService.migrate(payload);
    if (!result.success) {
      return reply.status(500).send({ error: result.error });
    }
    return { success: true, counts: result.counts };
  });
}
