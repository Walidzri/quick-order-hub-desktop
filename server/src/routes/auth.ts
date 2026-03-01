import { FastifyInstance } from 'fastify';
import { authService } from '../services/authService';
import { productService } from '../services/productService';
import { orderService } from '../services/orderService';
import { promotionService } from '../services/promotionService';
import { settingsService } from '../services/settingsService';
import { getDatabase } from '../db/connection';

export async function authRoutes(fastify: FastifyInstance) {
  // Connexion avec mot de passe (admin uniquement)
  fastify.post('/api/auth/login', async (request, reply) => {
    const { username, password } = request.body as { username: string; password: string };
    const result = authService.loginWithPassword(username, password);
    if (!result.success) return reply.status(401).send({ error: (result as any).message });
    return result;
  });

  // Connexion avec PIN
  fastify.post('/api/auth/login-pin', async (request, reply) => {
    const { userId, pin } = request.body as { userId: string; pin: string };
    const result = authService.loginWithPin(userId, pin);
    if (!result.success) return reply.status(401).send({ error: (result as any).message });
    return result;
  });

  // Déconnexion
  fastify.post('/api/auth/logout', async (request, reply) => {
    const { sessionId } = (request.body ?? {}) as { sessionId?: string };
    if (sessionId) authService.closeSession(sessionId);
    return { success: true };
  });

  // Déverrouillage par mot de passe
  fastify.post('/api/auth/unlock', async (request, reply) => {
    const { userId, password } = request.body as { userId: string; password: string };
    const result = authService.verifyPassword(userId, password);
    if (!result.success) return reply.status(401).send({ error: (result as any).message });
    return result;
  });

  // Déverrouillage par PIN
  fastify.post('/api/auth/unlock-pin', async (request, reply) => {
    const { userId, pin } = request.body as { userId: string; pin: string };
    const result = authService.verifyPin(userId, pin);
    if (!result.success) return reply.status(401).send({ error: (result as any).message });
    return result;
  });

  // Création de l'admin initial (premier lancement)
  fastify.post('/api/auth/setup', async (request, reply) => {
    const { name, username, password, pin } = request.body as {
      name: string; username: string; password: string; pin?: string;
    };
    const result = authService.createInitialAdmin(name, username, password, pin);
    if (!result.success) return reply.status(400).send({ error: (result as any).message });
    return reply.status(201).send(result);
  });

  // Export catalogue produits
  fastify.get('/api/products/export-template', async () => {
    return {
      categories:     productService.getAllCategories(),
      products:       productService.getAllProducts(),
      productVariants: [], // Les variantes sont récupérées par produit
      modifierGroups: productService.getModifierGroups(),
      modifierOptions: productService.getModifierOptions(),
    };
  });

  // Import catalogue produits (remplace tout le catalogue)
  fastify.post('/api/products/import-template', async (request, reply) => {
    const data = request.body as {
      categories?: any[];
      products?: any[];
      productVariants?: any[];
      modifierGroups?: any[];
      modifierOptions?: any[];
    };

    const db = getDatabase();
    const run = db.transaction(() => {
      if (data.categories) {
        db.prepare('DELETE FROM categories').run();
        for (const cat of data.categories) productService.createCategory(cat);
      }
      if (data.products) {
        db.prepare('DELETE FROM products').run();
        for (const prod of data.products) productService.createProduct(prod);
      }
    });
    run();
    return { success: true };
  });

  // Reset base de données (catalogue + commandes)
  fastify.post('/api/admin/reset-database', async (request, reply) => {
    const db = getDatabase();
    db.transaction(() => {
      db.prepare('DELETE FROM modifier_options').run();
      db.prepare('DELETE FROM modifier_groups').run();
      db.prepare('DELETE FROM product_variants').run();
      db.prepare('DELETE FROM products').run();
      db.prepare('DELETE FROM categories').run();
      db.prepare('DELETE FROM promotions').run();
      db.prepare('DELETE FROM orders').run();
      db.prepare('DELETE FROM print_jobs').run();
    })();
    return { success: true };
  });
}
