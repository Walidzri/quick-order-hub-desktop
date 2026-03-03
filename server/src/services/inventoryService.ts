import type { Supplier, InventoryItem, Invoice, InvoiceLine } from '@shared/types';
import { getDatabase } from '../db/connection';

// ─── helpers ────────────────────────────────────────────────────────────────

function toDate(val: unknown): Date {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  return new Date(val as string);
}

function rowToSupplier(row: Record<string, unknown>): Supplier {
  return {
    id:        row['id']      as string,
    name:      row['name']    as string,
    contact:   (row['contact']  as string | null) ?? undefined,
    phone:     (row['phone']    as string | null) ?? undefined,
    email:     (row['email']    as string | null) ?? undefined,
    address:   (row['address']  as string | null) ?? undefined,
    notes:     (row['notes']    as string | null) ?? undefined,
    createdAt: toDate(row['createdAt']),
    updatedAt: toDate(row['updatedAt']),
  };
}

function rowToItem(row: Record<string, unknown>): InventoryItem {
  return {
    id:           row['id']           as string,
    name:         row['name']         as string,
    category:     row['category']     as InventoryItem['category'],
    unit:         row['unit']         as string,
    currentStock: row['currentStock'] as number,
    minStock:     (row['minStock'] as number | null) ?? undefined,
    unitPrice:    row['unitPrice']    as number,
    createdAt:    toDate(row['createdAt']),
    updatedAt:    toDate(row['updatedAt']),
  };
}

function rowToInvoice(row: Record<string, unknown>): Invoice {
  return {
    id:           row['id']           as string,
    invoiceNumber: row['invoiceNumber'] as string,
    supplierId:   row['supplierId']   as string,
    supplierName: row['supplierName'] as string,
    date:         toDate(row['date']),
    lines:        JSON.parse((row['lines'] as string) || '[]') as InvoiceLine[],
    subtotal:     row['subtotal']     as number,
    tax:          (row['tax']      as number | null) ?? undefined,
    discount:     (row['discount'] as number | null) ?? undefined,
    total:        row['total']        as number,
    notes:        (row['notes']     as string | null) ?? undefined,
    createdBy:    (row['createdBy'] as string | null) ?? undefined,
    createdAt:    toDate(row['createdAt']),
    updatedAt:    toDate(row['updatedAt']),
  };
}

// ─── service ────────────────────────────────────────────────────────────────

export const inventoryService = {

  // ── Suppliers ──────────────────────────────────────────────────────────

  getAllSuppliers(): Supplier[] {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM suppliers ORDER BY name').all() as Record<string, unknown>[];
    return rows.map(rowToSupplier);
  },

  saveSupplier(data: Supplier): Supplier {
    const db = getDatabase();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO suppliers (id, name, contact, phone, email, address, notes, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name      = excluded.name,
        contact   = excluded.contact,
        phone     = excluded.phone,
        email     = excluded.email,
        address   = excluded.address,
        notes     = excluded.notes,
        updatedAt = excluded.updatedAt
    `).run(
      data.id,
      data.name,
      data.contact  ?? null,
      data.phone    ?? null,
      data.email    ?? null,
      data.address  ?? null,
      data.notes    ?? null,
      data.createdAt ? new Date(data.createdAt).toISOString() : now,
      now,
    );
    return rowToSupplier(
      db.prepare('SELECT * FROM suppliers WHERE id = ?').get(data.id) as Record<string, unknown>,
    );
  },

  deleteSupplier(id: string): void {
    getDatabase().prepare('DELETE FROM suppliers WHERE id = ?').run(id);
  },

  // ── Inventory Items ─────────────────────────────────────────────────────

  getAllItems(): InventoryItem[] {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM inventory_items ORDER BY name').all() as Record<string, unknown>[];
    return rows.map(rowToItem);
  },

  saveItem(data: InventoryItem): InventoryItem {
    const db = getDatabase();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO inventory_items
        (id, name, category, unit, currentStock, minStock, unitPrice, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name         = excluded.name,
        category     = excluded.category,
        unit         = excluded.unit,
        currentStock = excluded.currentStock,
        minStock     = excluded.minStock,
        unitPrice    = excluded.unitPrice,
        updatedAt    = excluded.updatedAt
    `).run(
      data.id,
      data.name,
      data.category,
      data.unit,
      data.currentStock,
      data.minStock ?? null,
      data.unitPrice,
      data.createdAt ? new Date(data.createdAt).toISOString() : now,
      now,
    );
    return rowToItem(
      db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(data.id) as Record<string, unknown>,
    );
  },

  deleteItem(id: string): void {
    getDatabase().prepare('DELETE FROM inventory_items WHERE id = ?').run(id);
  },

  // ── Invoices ────────────────────────────────────────────────────────────

  getAllInvoices(): Invoice[] {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM invoices ORDER BY date DESC').all() as Record<string, unknown>[];
    return rows.map(rowToInvoice);
  },

  saveInvoice(data: Invoice): Invoice {
    const db = getDatabase();
    const now = new Date().toISOString();

    db.transaction(() => {
      // Si mise à jour : annuler les changements de stock précédents
      const existing = db.prepare('SELECT lines FROM invoices WHERE id = ?')
        .get(data.id) as { lines: string } | undefined;
      if (existing) {
        const oldLines: InvoiceLine[] = JSON.parse(existing.lines || '[]');
        for (const line of oldLines) {
          if (line.inventoryItemId) {
            db.prepare(
              'UPDATE inventory_items SET currentStock = currentStock - ?, updatedAt = ? WHERE id = ?',
            ).run(line.quantity, now, line.inventoryItemId);
          }
        }
      }

      // Upsert facture
      db.prepare(`
        INSERT INTO invoices
          (id, invoiceNumber, supplierId, supplierName, date, lines,
           subtotal, tax, discount, total, notes, createdBy, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          invoiceNumber = excluded.invoiceNumber,
          supplierId    = excluded.supplierId,
          supplierName  = excluded.supplierName,
          date          = excluded.date,
          lines         = excluded.lines,
          subtotal      = excluded.subtotal,
          tax           = excluded.tax,
          discount      = excluded.discount,
          total         = excluded.total,
          notes         = excluded.notes,
          createdBy     = excluded.createdBy,
          updatedAt     = excluded.updatedAt
      `).run(
        data.id,
        data.invoiceNumber,
        data.supplierId,
        data.supplierName,
        new Date(data.date).toISOString(),
        JSON.stringify(data.lines ?? []),
        data.subtotal,
        data.tax      ?? null,
        data.discount ?? null,
        data.total,
        data.notes    ?? null,
        data.createdBy ?? null,
        data.createdAt ? new Date(data.createdAt).toISOString() : now,
        now,
      );

      // Appliquer les nouveaux changements de stock
      for (const line of (data.lines ?? [])) {
        if (line.inventoryItemId) {
          db.prepare(
            'UPDATE inventory_items SET currentStock = currentStock + ?, updatedAt = ? WHERE id = ?',
          ).run(line.quantity, now, line.inventoryItemId);
        }
      }
    })();

    return rowToInvoice(
      db.prepare('SELECT * FROM invoices WHERE id = ?').get(data.id) as Record<string, unknown>,
    );
  },

  deleteInvoice(id: string): void {
    const db = getDatabase();
    const now = new Date().toISOString();

    const existing = db.prepare('SELECT lines FROM invoices WHERE id = ?')
      .get(id) as { lines: string } | undefined;
    if (!existing) return;

    db.transaction(() => {
      const lines: InvoiceLine[] = JSON.parse(existing.lines || '[]');
      for (const line of lines) {
        if (line.inventoryItemId) {
          db.prepare(
            'UPDATE inventory_items SET currentStock = currentStock - ?, updatedAt = ? WHERE id = ?',
          ).run(line.quantity, now, line.inventoryItemId);
        }
      }
      db.prepare('DELETE FROM invoices WHERE id = ?').run(id);
    })();
  },
};
