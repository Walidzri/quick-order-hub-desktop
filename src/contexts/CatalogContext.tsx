import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  getDB,
  exportProductsTemplate as dbExportTemplate,
  importProductsTemplate as dbImportTemplate,
  resetDatabase as dbReset,
} from '@/lib/database';
import type { Category, Product, ProductVariant, Promotion } from '@/lib/database';

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
        const db = await getDB();
        const cats = await db.getAll('categories');
        setCategories(cats.sort((a, b) => a.sortOrder - b.sortOrder));
        const prods = await db.getAll('products');
        setProducts(prods.sort((a, b) => a.sortOrder - b.sortOrder));
        const vars = await db.getAll('productVariants');
        setVariants(vars);
        const promos = await db.getAll('promotions');
        setPromotions(promos);
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

  const saveProduct = useCallback(async (product: Product, productVariants: ProductVariant[] = []) => {
    const db = await getDB();
    await db.put('products', { ...product, available: product.available !== false });
    if (productVariants.length > 0) {
      const existing = await db.getAllFromIndex('productVariants', 'by-product', product.id);
      for (const v of existing) await db.delete('productVariants', v.id);
      for (const v of productVariants) await db.put('productVariants', v);
    }
    const prods = await db.getAll('products');
    setProducts(prods.sort((a, b) => a.sortOrder - b.sortOrder));
    const vars = await db.getAll('productVariants');
    setVariants(vars);
  }, []);

  const deleteProduct = useCallback(async (productId: string) => {
    try {
      const db = await getDB();
      const pvs = await db.getAllFromIndex('productVariants', 'by-product', productId);
      for (const v of pvs) await db.delete('productVariants', v.id);
      await db.delete('products', productId);
      const prods = await db.getAll('products');
      setProducts(prods.sort((a, b) => a.sortOrder - b.sortOrder));
      const vars = await db.getAll('productVariants');
      setVariants(vars);
    } catch (err) {
      console.error('Error deleting product:', err);
      throw err;
    }
  }, []);

  const loadProducts = useCallback(async () => {
    const db = await getDB();
    const prods = await db.getAll('products');
    setProducts(prods.sort((a, b) => a.sortOrder - b.sortOrder));
    const vars = await db.getAll('productVariants');
    setVariants(vars);
  }, []);

  const saveCategory = useCallback(async (category: Category) => {
    const db = await getDB();
    await db.put('categories', category);
    const cats = await db.getAll('categories');
    setCategories(cats.sort((a, b) => a.sortOrder - b.sortOrder));
  }, []);

  const deleteCategory = useCallback(async (categoryId: string) => {
    try {
      const db = await getDB();
      const allProds = await db.getAll('products');
      const inCat = allProds.filter(p => p.categoryId === categoryId);
      if (inCat.length > 0) {
        throw new Error(
          `Impossible de supprimer cette catégorie car elle contient ${inCat.length} produit(s). Veuillez d'abord supprimer ou déplacer les produits.`
        );
      }
      await db.delete('categories', categoryId);
      const cats = await db.getAll('categories');
      setCategories(cats.sort((a, b) => a.sortOrder - b.sortOrder));
    } catch (err) {
      console.error('Error deleting category:', err);
      throw err;
    }
  }, []);

  const loadCategories = useCallback(async () => {
    const db = await getDB();
    const cats = await db.getAll('categories');
    setCategories(cats.sort((a, b) => a.sortOrder - b.sortOrder));
  }, []);

  const loadPromotions = useCallback(async () => {
    const db = await getDB();
    setPromotions(await db.getAll('promotions'));
  }, []);

  const savePromotion = useCallback(async (promo: Promotion) => {
    const db = await getDB();
    await db.put('promotions', promo);
    await loadPromotions();
  }, [loadPromotions]);

  const deletePromotion = useCallback(async (id: string) => {
    const db = await getDB();
    await db.delete('promotions', id);
    await loadPromotions();
  }, [loadPromotions]);

  const exportTemplate = useCallback(async () => dbExportTemplate(), []);

  const importTemplate = useCallback(async (data: Parameters<typeof dbImportTemplate>[0]) => {
    await dbImportTemplate(data);
    await loadCategories();
    await loadProducts();
  }, [loadCategories, loadProducts]);

  const resetDb = useCallback(async () => {
    await dbReset();
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
