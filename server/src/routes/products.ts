import { FastifyInstance } from 'fastify';
import { productService } from '../services/productService';

export async function productsRoutes(fastify: FastifyInstance) {
  fastify.get('/api/products', async (request, reply) => {
    return productService.getAllProducts();
  });

  fastify.get('/api/products/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const product = await productService.getProductById(id);
    if (!product) return reply.status(404).send({ error: 'Produit introuvable' });
    return product;
  });

  fastify.post('/api/products', async (request, reply) => {
    const product = await productService.createProduct(request.body as any);
    return reply.status(201).send(product);
  });

  fastify.patch('/api/products/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    return productService.updateProduct(id, request.body as any);
  });

  fastify.delete('/api/products/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await productService.deleteProduct(id);
    return reply.status(204).send();
  });

  fastify.get('/api/products/:id/variants', async (request, reply) => {
    const { id } = request.params as { id: string };
    return productService.getVariantsByProduct(id);
  });

  // Remplace toutes les variantes d'un produit
  fastify.put('/api/products/:id/variants', async (request, reply) => {
    const { id } = request.params as { id: string };
    const variants = request.body as any[];
    return productService.replaceVariants(id, variants ?? []);
  });

  fastify.get('/api/modifier-groups', async (request, reply) => {
    return productService.getModifierGroups();
  });

  fastify.get('/api/modifier-options', async (request, reply) => {
    const { groupId } = request.query as { groupId?: string };
    return productService.getModifierOptions(groupId);
  });
}
