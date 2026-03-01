import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { productService } from '@/services/productService';
import { promotionService } from '@/services/promotionService';
import { api } from '@/services/api';
import type { Category, Product, ProductVariant, Promotion } from '@shared/types';

interface CatalogContextType {
  categories: Category[];
  products: Product[];
  variants: ProductVariant[];
  promotions: Promotion[];
  getProductsByCategory: (categoryId: string) => Product[];
  getVariantsByProduct: (productId: string) => ProductVariant[];
  saveProduct: (product: Product, variants?: ProductVariant[]) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;
  loadProducts: () => Promise<void>;
  saveCategory: (category: Category) => Promise<void>;
  deleteCategory: (categoryId: string) => Promise<void>;
  loadCategories: () => Promise<void>;
  loadPromotions: () => Promise<void>;
  savePromotion: (promo: Promotion) => Promise<void>;
  deletePromotion: (id: string) => Promise<void>;
  exportProductsTemplate: () => Promise<{
    categories: any[];
    products: any[];
    productVariants: any[];
    modifierGroups: any[];
    modifierOptions: any[];
  }>;
  importProductsTemplate: (data: {
    categories?: any[];
    products?: any[];
    productVariants?: any[];
    modifierGroups?: any[];
    modifierOptions?: any[];
  }) => Promise<void>;
  resetDatabase: () => Promise<void>;
}

const CatalogContext = createContext<CatalogContextType | null>(null);

export function useCatalog() {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog must be used within a CatalogProvider');
  return ctx;
}

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);

  useEffect(() => {
    async function init() {
      try {
        const [cats, prods, promos] = await Promise.all([
          productService.getAllCategories(),
          productService.getAll(),
          promotionService.getAll(),
        ]);
        setCategories(cats.sort((a, b) => a.sortOrder - b.sortOrder));
        setProducts(prods.sort((a, b) => a.sortOrder - b.sortOrder));
        setPromotions(promos);

        // Charger les variantes pour tous les produits
        const allVariants: ProductVariant[] = [];
        await Promise.all(prods.map(async p => {
          const vars = await productService.getVariants(p.id);
          allVariants.push(...vars);
        }));
        setVariants(allVariants);
      } catch (err) {
        console.error('[CatalogContext] init error:', err);
      }
    }
    init();
  }, []);

  const getProductsByCategory = useCallback((categoryId: string) =>
    products.filter(p => p.categoryId === categoryId && p.available !== false),
  [products]);

  const getVariantsByProduct = useCallback((productId: string) =>
    variants.filter(v => v.productId === productId),
  [variants]);

  const loadProducts = useCallback(async () => {
    const prods = await productService.getAll();
    setProducts(prods.sort((a, b) => a.sortOrder - b.sortOrder));
    const allVariants: ProductVariant[] = [];
    await Promise.all(prods.map(async p => {
      const vars = await productService.getVariants(p.id);
      allVariants.push(...vars);
    }));
    setVariants(allVariants);
  }, []);

  const saveProduct = useCallback(async (product: Product, productVariants: ProductVariant[] = []) => {
    const existing = products.find(p => p.id === product.id);
    if (existing) {
      await productService.update(product.id, product);
    } else {
      await productService.create(product);
    }
    if (productVariants.length > 0) {
      await productService.replaceVariants(product.id, productVariants);
    }
    await loadProducts();
  }, [products, loadProducts]);

  const deleteProduct = useCallback(async (productId: string) => {
    try {
      await productService.delete(productId);
      await loadProducts();
    } catch (err) {
      console.error('Error deleting product:', err);
      throw err;
    }
  }, [loadProducts]);

  const loadCategories = useCallback(async () => {
    const cats = await productService.getAllCategories();
    setCategories(cats.sort((a, b) => a.sortOrder - b.sortOrder));
  }, []);

  const saveCategory = useCallback(async (category: Category) => {
    const existing = categories.find(c => c.id === category.id);
    if (existing) {
      await productService.updateCategory(category.id, category);
    } else {
      await productService.createCategory(category);
    }
    await loadCategories();
  }, [categories, loadCategories]);

  const deleteCategory = useCallback(async (categoryId: string) => {
    try {
      await productService.deleteCategory(categoryId);
      await loadCategories();
    } catch (err) {
      console.error('Error deleting category:', err);
      throw err;
    }
  }, [loadCategories]);

  const loadPromotions = useCallback(async () => {
    setPromotions(await promotionService.getAll());
  }, []);

  const savePromotion = useCallback(async (promo: Promotion) => {
    const existing = promotions.find(p => p.id === promo.id);
    if (existing) {
      await promotionService.update(promo.id, promo);
    } else {
      await promotionService.create(promo);
    }
    await loadPromotions();
  }, [promotions, loadPromotions]);

  const deletePromotion = useCallback(async (id: string) => {
    await promotionService.delete(id);
    await loadPromotions();
  }, [loadPromotions]);

  const exportTemplate = useCallback(async () => {
    return api.get<{
      categories: any[]; products: any[]; productVariants: any[];
      modifierGroups: any[]; modifierOptions: any[];
    }>('/api/products/export-template');
  }, []);

  const importTemplate = useCallback(async (data: {
    categories?: any[]; products?: any[]; productVariants?: any[];
    modifierGroups?: any[]; modifierOptions?: any[];
  }) => {
    await api.post('/api/products/import-template', data);
    await loadCategories();
    await loadProducts();
  }, [loadCategories, loadProducts]);

  const resetDb = useCallback(async () => {
    await api.post('/api/admin/reset-database', {});
    window.location.reload();
  }, []);

  return (
    <CatalogContext.Provider value={{
      categories, products, variants, promotions,
      getProductsByCategory, getVariantsByProduct,
      saveProduct, deleteProduct, loadProducts,
      saveCategory, deleteCategory, loadCategories,
      loadPromotions, savePromotion, deletePromotion,
      exportProductsTemplate: exportTemplate,
      importProductsTemplate: importTemplate,
      resetDatabase: resetDb,
    }}>
      {children}
    </CatalogContext.Provider>
  );
}
