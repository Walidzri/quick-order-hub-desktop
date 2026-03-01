import type { Product, Category, ProductVariant, ModifierGroup, ModifierOption } from '@shared/types';

// Stub — sera remplacé par SQLite en Phase 2
export const productService = {
  getAllProducts: async (): Promise<Product[]> => {
    return [];
  },

  getProductById: async (id: string): Promise<Product | null> => {
    return null;
  },

  createProduct: async (data: Partial<Product>): Promise<Product> => {
    throw new Error('productService.createProduct: non implémenté — Phase 2');
  },

  updateProduct: async (id: string, data: Partial<Product>): Promise<Product> => {
    throw new Error('productService.updateProduct: non implémenté — Phase 2');
  },

  deleteProduct: async (id: string): Promise<void> => {
    throw new Error('productService.deleteProduct: non implémenté — Phase 2');
  },

  getAllCategories: async (): Promise<Category[]> => {
    return [];
  },

  getCategoryById: async (id: string): Promise<Category | null> => {
    return null;
  },

  createCategory: async (data: Partial<Category>): Promise<Category> => {
    throw new Error('productService.createCategory: non implémenté — Phase 2');
  },

  updateCategory: async (id: string, data: Partial<Category>): Promise<Category> => {
    throw new Error('productService.updateCategory: non implémenté — Phase 2');
  },

  deleteCategory: async (id: string): Promise<void> => {
    throw new Error('productService.deleteCategory: non implémenté — Phase 2');
  },

  getVariantsByProduct: async (productId: string): Promise<ProductVariant[]> => {
    return [];
  },

  getModifierGroups: async (): Promise<ModifierGroup[]> => {
    return [];
  },

  getModifierOptions: async (groupId?: string): Promise<ModifierOption[]> => {
    return [];
  },
};
