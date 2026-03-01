import { api } from './api';
import type { Product, Category, ProductVariant, ModifierGroup, ModifierOption } from '@shared/types';

export const productService = {
  // Products
  getAll: () =>
    api.get<Product[]>('/api/products'),

  getById: (id: string) =>
    api.get<Product>(`/api/products/${id}`),

  create: (data: Partial<Product>) =>
    api.post<Product>('/api/products', data),

  update: (id: string, data: Partial<Product>) =>
    api.patch<Product>(`/api/products/${id}`, data),

  delete: (id: string) =>
    api.delete<void>(`/api/products/${id}`),

  getVariants: (productId: string) =>
    api.get<ProductVariant[]>(`/api/products/${productId}/variants`),

  replaceVariants: (productId: string, variants: ProductVariant[]) =>
    api.put<ProductVariant[]>(`/api/products/${productId}/variants`, variants),

  // Categories
  getAllCategories: () =>
    api.get<Category[]>('/api/categories'),

  getCategoryById: (id: string) =>
    api.get<Category>(`/api/categories/${id}`),

  createCategory: (data: Partial<Category>) =>
    api.post<Category>('/api/categories', data),

  updateCategory: (id: string, data: Partial<Category>) =>
    api.patch<Category>(`/api/categories/${id}`, data),

  deleteCategory: (id: string) =>
    api.delete<void>(`/api/categories/${id}`),

  // Modifiers
  getModifierGroups: () =>
    api.get<ModifierGroup[]>('/api/modifier-groups'),

  getModifierOptions: (groupId?: string) =>
    api.get<ModifierOption[]>(
      groupId ? `/api/modifier-options?groupId=${groupId}` : '/api/modifier-options'
    ),
};
