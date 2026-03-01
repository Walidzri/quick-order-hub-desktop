import { randomUUID } from 'crypto';
import type { Product, Category, ProductVariant, ModifierGroup, ModifierOption } from '@shared/types';
import { getDatabase } from '../db/connection';

// ─── helpers ────────────────────────────────────────────────────────────────

function parseJson<T>(val: unknown, fallback: T): T {
  if (val == null) return fallback;
  try { return JSON.parse(val as string) as T; } catch { return fallback; }
}

function rowToCategory(row: Record<string, unknown>): Category {
  return {
    id:            row['id']        as string,
    name:          row['name']      as string,
    sortOrder:     row['sortOrder'] as number,
    icon:          (row['icon']  as string | null) ?? undefined,
    image:         (row['image'] as string | null) ?? undefined,
    supplementIds: parseJson<string[]>(row['supplementIds'], []),
  };
}

function rowToProduct(row: Record<string, unknown>): Product {
  return {
    id:               row['id']          as string,
    categoryId:       row['categoryId']  as string,
    name:             row['name']        as string,
    basePrice:        row['basePrice']   as number,
    sortOrder:        row['sortOrder']   as number,
    available:        row['available'] === 1 || row['available'] === true,
    description:      (row['description'] as string | null) ?? undefined,
    image:            (row['image']       as string | null) ?? undefined,
    modifierGroupIds: parseJson<string[]>(row['modifierGroupIds'], []),
    supplementIds:    parseJson<string[]>(row['supplementIds'],    []),
  };
}

function rowToVariant(row: Record<string, unknown>): ProductVariant {
  return {
    id:        row['id']        as string,
    productId: row['productId'] as string,
    size:      row['size']      as string,
    price:     row['price']     as number,
  };
}

function rowToModifierGroup(row: Record<string, unknown>): ModifierGroup {
  return {
    id:          row['id']          as string,
    name:        row['name']        as string,
    required:    row['required'] === 1 || row['required'] === true,
    multiSelect: row['multiSelect'] === 1 || row['multiSelect'] === true,
  };
}

function rowToModifierOption(row: Record<string, unknown>): ModifierOption {
  return {
    id:              row['id']              as string,
    groupId:         row['groupId']         as string,
    name:            row['name']            as string,
    priceAdjustment: row['priceAdjustment'] as number,
    sizeBasedPrices: parseJson<Record<string, number> | undefined>(row['sizeBasedPrices'], undefined),
  };
}

// ─── service ────────────────────────────────────────────────────────────────

export const productService = {

  // ── Categories ──────────────────────────────────────────────────────────

  getAllCategories(): Category[] {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM categories ORDER BY sortOrder').all() as Record<string, unknown>[];
    return rows.map(rowToCategory);
  },

  getCategoryById(id: string): Category | null {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? rowToCategory(row) : null;
  },

  createCategory(data: Partial<Category>): Category {
    const db = getDatabase();
    const id = data.id ?? randomUUID();
    db.prepare(`
      INSERT INTO categories (id, name, sortOrder, icon, image, supplementIds)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.name ?? '',
      data.sortOrder ?? 0,
      data.icon ?? null,
      data.image ?? null,
      JSON.stringify(data.supplementIds ?? []),
    );
    return productService.getCategoryById(id)!;
  },

  updateCategory(id: string, data: Partial<Category>): Category {
    const db = getDatabase();
    const current = productService.getCategoryById(id);
    if (!current) throw new Error(`Catégorie introuvable : ${id}`);
    const merged = { ...current, ...data, id };
    db.prepare(`
      UPDATE categories SET name=?, sortOrder=?, icon=?, image=?, supplementIds=? WHERE id=?
    `).run(
      merged.name,
      merged.sortOrder,
      merged.icon ?? null,
      merged.image ?? null,
      JSON.stringify(merged.supplementIds ?? []),
      id,
    );
    return productService.getCategoryById(id)!;
  },

  deleteCategory(id: string): void {
    const db = getDatabase();
    db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  },

  // ── Products ─────────────────────────────────────────────────────────────

  getAllProducts(): Product[] {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM products ORDER BY sortOrder').all() as Record<string, unknown>[];
    return rows.map(rowToProduct);
  },

  getProductById(id: string): Product | null {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? rowToProduct(row) : null;
  },

  createProduct(data: Partial<Product>): Product {
    const db = getDatabase();
    const id = data.id ?? randomUUID();
    db.prepare(`
      INSERT INTO products
        (id, categoryId, name, basePrice, sortOrder, available, description, image, modifierGroupIds, supplementIds)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.categoryId ?? null,
      data.name ?? '',
      data.basePrice ?? 0,
      data.sortOrder ?? 0,
      data.available !== false ? 1 : 0,
      data.description ?? null,
      data.image ?? null,
      JSON.stringify(data.modifierGroupIds ?? []),
      JSON.stringify(data.supplementIds ?? []),
    );
    return productService.getProductById(id)!;
  },

  updateProduct(id: string, data: Partial<Product>): Product {
    const db = getDatabase();
    const current = productService.getProductById(id);
    if (!current) throw new Error(`Produit introuvable : ${id}`);
    const merged = { ...current, ...data, id };
    db.prepare(`
      UPDATE products SET
        categoryId=?, name=?, basePrice=?, sortOrder=?, available=?,
        description=?, image=?, modifierGroupIds=?, supplementIds=?
      WHERE id=?
    `).run(
      merged.categoryId,
      merged.name,
      merged.basePrice ?? 0,
      merged.sortOrder,
      merged.available !== false ? 1 : 0,
      merged.description ?? null,
      merged.image ?? null,
      JSON.stringify(merged.modifierGroupIds ?? []),
      JSON.stringify(merged.supplementIds ?? []),
      id,
    );
    return productService.getProductById(id)!;
  },

  deleteProduct(id: string): void {
    const db = getDatabase();
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
  },

  // ── Variants ─────────────────────────────────────────────────────────────

  getVariantsByProduct(productId: string): ProductVariant[] {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM product_variants WHERE productId = ?').all(productId) as Record<string, unknown>[];
    return rows.map(rowToVariant);
  },

  // ── Modifier groups & options ─────────────────────────────────────────────

  getModifierGroups(): ModifierGroup[] {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM modifier_groups').all() as Record<string, unknown>[];
    return rows.map(rowToModifierGroup);
  },

  getModifierOptions(groupId?: string): ModifierOption[] {
    const db = getDatabase();
    const rows = groupId
      ? db.prepare('SELECT * FROM modifier_options WHERE groupId = ?').all(groupId) as Record<string, unknown>[]
      : db.prepare('SELECT * FROM modifier_options').all() as Record<string, unknown>[];
    return rows.map(rowToModifierOption);
  },
};
