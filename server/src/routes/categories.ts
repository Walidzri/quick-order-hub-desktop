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
    await productService.deleteCategory(id);
    return reply.status(204).send();
  });
}
