/**
 * migrationService.ts — Migration one-shot IndexedDB → SQLite.
 *
 * Reçoit un dump JSON complet de toutes les stores IndexedDB
 * et les insère dans SQLite en une seule transaction atomique.
 * Idempotent : INSERT OR REPLACE — safe à rejouer.
 */

import { getDatabase } from '../db/connection';
import type {
  Category, Product, ProductVariant, ModifierGroup, ModifierOption,
  Order, Printer, Promotion, Settings, NumberingCounter,
  User, UserSession, Supplier, InventoryItem, Invoice,
} from '@shared/types';

export interface MigrationPayload {
  categories?:       Category[];
  products?:         Product[];
  productVariants?:  ProductVariant[];
  modifierGroups?:   ModifierGroup[];
  modifierOptions?:  ModifierOption[];
  orders?:           Order[];
  printers?:         Printer[];
  promotions?:       Promotion[];
  settings?:         Settings[];
  numberingCounters?: NumberingCounter[];
  users?:            User[];
  userSessions?:     UserSession[];
  suppliers?:        Supplier[];
  inventoryItems?:   InventoryItem[];
  invoices?:         Invoice[];
}

export interface MigrationResult {
  success: boolean;
  counts:  Record<string, number>;
  error?:  string;
}

// Helpers de sérialisation

function toStr(val: unknown): string | null {
  if (val == null) return null;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'string') return val;
  return String(val);
}

function toBool(val: unknown): number {
  return val ? 1 : 0;
}

function toJson(val: unknown): string | null {
  if (val == null) return null;
  return JSON.stringify(val);
}

export const migrationService = {

  /** Vérifie si la migration est nécessaire (SQLite vide). */
  status(): { needed: boolean; counts: Record<string, number> } {
    const db = getDatabase();
    const orders   = (db.prepare('SELECT COUNT(*) as c FROM orders').get()   as { c: number }).c;
    const products = (db.prepare('SELECT COUNT(*) as c FROM products').get() as { c: number }).c;
    const settings = (db.prepare('SELECT COUNT(*) as c FROM settings').get() as { c: number }).c;
    return {
      needed: orders === 0 && products === 0 && settings === 0,
      counts: { orders, products, settings },
    };
  },

  /** Insère tout le payload IndexedDB dans SQLite. */
  migrate(payload: MigrationPayload): MigrationResult {
    const db = getDatabase();
    const counts: Record<string, number> = {};

    try {
      const run = db.transaction(() => {

        // --- categories ---
        if (payload.categories?.length) {
          const s = db.prepare(`
            INSERT OR REPLACE INTO categories (id, name, sortOrder, icon, image, supplementIds)
            VALUES (?, ?, ?, ?, ?, ?)
          `);
          for (const c of payload.categories) {
            s.run(c.id, c.name, c.sortOrder ?? 0, c.icon ?? null, c.image ?? null, toJson(c.supplementIds));
          }
          counts.categories = payload.categories.length;
        }

        // --- products ---
        if (payload.products?.length) {
          const s = db.prepare(`
            INSERT OR REPLACE INTO products
              (id, categoryId, name, basePrice, sortOrder, available, description, image, modifierGroupIds, supplementIds)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const p of payload.products) {
            s.run(
              p.id, p.categoryId, p.name, p.basePrice ?? 0, p.sortOrder ?? 0,
              toBool(p.available !== false), p.description ?? null, p.image ?? null,
              toJson(p.modifierGroupIds), toJson(p.supplementIds),
            );
          }
          counts.products = payload.products.length;
        }

        // --- product_variants ---
        if (payload.productVariants?.length) {
          const s = db.prepare(`
            INSERT OR REPLACE INTO product_variants (id, productId, size, price)
            VALUES (?, ?, ?, ?)
          `);
          for (const v of payload.productVariants) {
            s.run(v.id, v.productId, v.size, v.price);
          }
          counts.productVariants = payload.productVariants.length;
        }

        // --- modifier_groups ---
        if (payload.modifierGroups?.length) {
          const s = db.prepare(`
            INSERT OR REPLACE INTO modifier_groups (id, name, required, multiSelect)
            VALUES (?, ?, ?, ?)
          `);
          for (const g of payload.modifierGroups) {
            s.run(g.id, g.name, toBool(g.required), toBool(g.multiSelect));
          }
          counts.modifierGroups = payload.modifierGroups.length;
        }

        // --- modifier_options ---
        if (payload.modifierOptions?.length) {
          const s = db.prepare(`
            INSERT OR REPLACE INTO modifier_options (id, groupId, name, priceAdjustment, sizeBasedPrices)
            VALUES (?, ?, ?, ?, ?)
          `);
          for (const o of payload.modifierOptions) {
            s.run(o.id, o.groupId, o.name, o.priceAdjustment ?? 0, toJson(o.sizeBasedPrices));
          }
          counts.modifierOptions = payload.modifierOptions.length;
        }

        // --- orders ---
        if (payload.orders?.length) {
          const s = db.prepare(`
            INSERT OR REPLACE INTO orders
              (id, orderNumber, status, type, lines, subtotal, discount, total, paymentMethod,
               promoCode, promoName, createdBy, createdAt, updatedAt, paidAt, sentToKitchenAt,
               deliveryAddress, deliveryPhone, deliveryCustomerName)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const o of payload.orders) {
            s.run(
              o.id, o.orderNumber, o.status, o.type,
              JSON.stringify(o.lines ?? []),
              o.subtotal, o.discount, o.total, o.paymentMethod ?? null,
              o.promoCode ?? null, o.promoName ?? null, o.createdBy ?? null,
              toStr(o.createdAt), toStr(o.updatedAt),
              toStr(o.paidAt), toStr(o.sentToKitchenAt),
              o.deliveryAddress ?? null, o.deliveryPhone ?? null, o.deliveryCustomerName ?? null,
            );
          }
          counts.orders = payload.orders.length;
        }

        // --- printers ---
        if (payload.printers?.length) {
          const s = db.prepare(`
            INSERT OR REPLACE INTO printers
              (id, name, host, port, role, connectionType, enabled, paperWidth, mode,
               usbVendorId, usbProductId, bluetoothAddress)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const p of payload.printers) {
            // Le type partagé Printer utilise tcpHost/tcpPort ; on tombe back sur host/port si présents (ancien format)
            const anyP = p as unknown as Record<string, unknown>;
            const host = (p.tcpHost ?? anyP['host'] ?? null) as string | null;
            const port = (p.tcpPort ?? anyP['port'] ?? 9100) as number;
            s.run(
              p.id, p.name ?? null, host, port,
              p.role, p.connectionType ?? 'network', toBool(p.enabled !== false),
              (anyP['paperWidth'] as number | undefined) ?? 80, p.mode ?? null,
              (anyP['usbVendorId'] as string | undefined) ?? null,
              (anyP['usbProductId'] as string | undefined) ?? null,
              (anyP['bluetoothAddress'] as string | undefined) ?? null,
            );
          }
          counts.printers = payload.printers.length;
        }

        // --- promotions ---
        if (payload.promotions?.length) {
          const s = db.prepare(`
            INSERT OR REPLACE INTO promotions
              (id, code, name, type, value, active, startDate, endDate, minOrderTotal, freeItemId)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const p of payload.promotions) {
            s.run(
              p.id, p.code, p.name ?? null, p.type, p.value,
              toBool(p.active), toStr(p.startDate), toStr(p.endDate),
              p.minOrderTotal ?? null, p.freeItemId ?? null,
            );
          }
          counts.promotions = payload.promotions.length;
        }

        // --- settings (objet unique sérialisé en JSON) ---
        if (payload.settings?.length) {
          const s = db.prepare(`INSERT OR REPLACE INTO settings (id, data) VALUES (?, ?)`);
          for (const st of payload.settings) {
            s.run(st.id, JSON.stringify(st));
          }
          counts.settings = payload.settings.length;
        }

        // --- numbering_counters ---
        if (payload.numberingCounters?.length) {
          const s = db.prepare(`INSERT OR REPLACE INTO numbering_counters (id, date, counter) VALUES (?, ?, ?)`);
          for (const c of payload.numberingCounters) {
            s.run(c.id, c.date, c.counter ?? 0);
          }
          counts.numberingCounters = payload.numberingCounters.length;
        }

        // --- users ---
        if (payload.users?.length) {
          const s = db.prepare(`
            INSERT OR REPLACE INTO users
              (id, username, password, pin, role, name, avatar, active,
               createdAt, lastLogin, failedAttempts, lockedUntil)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const u of payload.users) {
            s.run(
              u.id, u.username, u.password ?? null, u.pin ?? null,
              u.role, u.name ?? u.username, u.avatar ?? null, 1,
              toStr(u.createdAt), toStr(u.lastLogin),
              u.failedAttempts ?? 0, toStr(u.lockedUntil),
            );
          }
          counts.users = payload.users.length;
        }

        // --- user_sessions ---
        if (payload.userSessions?.length) {
          const s = db.prepare(`
            INSERT OR REPLACE INTO user_sessions (id, userId, loginAt, logoutAt, isActive)
            VALUES (?, ?, ?, ?, ?)
          `);
          for (const sess of payload.userSessions) {
            s.run(sess.id, sess.userId, toStr(sess.loginAt), toStr(sess.logoutAt), toBool(sess.isActive));
          }
          counts.userSessions = payload.userSessions.length;
        }

        // --- suppliers ---
        if (payload.suppliers?.length) {
          const s = db.prepare(`
            INSERT OR REPLACE INTO suppliers (id, name, contact, phone, email, address, notes, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const sup of payload.suppliers) {
            s.run(
              sup.id, sup.name, sup.contact ?? null, sup.phone ?? null, sup.email ?? null,
              sup.address ?? null, sup.notes ?? null, toStr(sup.createdAt), toStr(sup.updatedAt),
            );
          }
          counts.suppliers = payload.suppliers.length;
        }

        // --- inventory_items ---
        if (payload.inventoryItems?.length) {
          const s = db.prepare(`
            INSERT OR REPLACE INTO inventory_items
              (id, name, category, unit, currentStock, minStock, unitPrice, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const item of payload.inventoryItems) {
            s.run(
              item.id, item.name, item.category, item.unit,
              item.currentStock ?? 0, item.minStock ?? null, item.unitPrice ?? 0,
              toStr(item.createdAt), toStr(item.updatedAt),
            );
          }
          counts.inventoryItems = payload.inventoryItems.length;
        }

        // --- invoices ---
        if (payload.invoices?.length) {
          const s = db.prepare(`
            INSERT OR REPLACE INTO invoices
              (id, invoiceNumber, supplierId, supplierName, date, lines,
               subtotal, tax, discount, total, notes, createdBy, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const inv of payload.invoices) {
            s.run(
              inv.id, inv.invoiceNumber, inv.supplierId, inv.supplierName ?? null,
              toStr(inv.date), JSON.stringify(inv.lines ?? []),
              inv.subtotal ?? 0, inv.tax ?? null, inv.discount ?? null, inv.total,
              inv.notes ?? null, inv.createdBy ?? null, toStr(inv.createdAt), toStr(inv.updatedAt),
            );
          }
          counts.invoices = payload.invoices.length;
        }

      }); // end transaction

      run();
      console.log('[Migration] Terminée :', counts);
      return { success: true, counts };

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[Migration] Erreur :', msg);
      return { success: false, counts, error: msg };
    }
  },
};
