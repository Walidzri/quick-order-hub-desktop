import { FastifyInstance } from 'fastify';
import { productService } from '../services/productService';

export async function categoriesRoutes(fastify: FastifyInstance) {
  fastify.get('/api/categories', async (request, reply) => {
    return productService.getAllCategories();
  });

  fastify.get('/api/categories/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const category = await productService.getCategoryById(id);
    if (!category) return reply.status(404).send({ error: 'Catégorie introuvable' });
    return category;
  });

  fastify.post('/api/categories', async (request, reply) => {
    const category = await productService.createCategory(request.body as any);
    return reply.status(201).send(category);
  });

  fastify.patch('/api/categories/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    return productService.updateCategory(id, request.body as any);
  });

  fastify.delete('/api/categories/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const prods = productService.getAllProducts().filter(p => p.categoryId === id);
    if (prods.length > 0) {
      return reply.status(409).send({
        error: `Impossible de supprimer cette catégorie car elle contient ${prods.length} produit(s). Veuillez d'abord supprimer ou déplacer les produits.`,
      });
    }
    productService.deleteCategory(id);
    return reply.status(204).send();
  });
}
