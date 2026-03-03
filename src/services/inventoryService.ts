import { api } from './api';
import type { Supplier, InventoryItem, Invoice } from '@shared/types';

export const inventoryService = {
  // ── Suppliers ────────────────────────────────────────────────────────────
  getAllSuppliers: () =>
    api.get<Supplier[]>('/api/inventory/suppliers'),

  saveSupplier: (supplier: Supplier) =>
    api.put<Supplier>(`/api/inventory/suppliers/${supplier.id}`, supplier),

  deleteSupplier: (id: string) =>
    api.delete<void>(`/api/inventory/suppliers/${id}`),

  // ── Inventory Items ───────────────────────────────────────────────────────
  getAllItems: () =>
    api.get<InventoryItem[]>('/api/inventory/items'),

  saveItem: (item: InventoryItem) =>
    api.put<InventoryItem>(`/api/inventory/items/${item.id}`, item),

  deleteItem: (id: string) =>
    api.delete<void>(`/api/inventory/items/${id}`),

  // ── Invoices ──────────────────────────────────────────────────────────────
  getAllInvoices: () =>
    api.get<Invoice[]>('/api/inventory/invoices'),

  saveInvoice: (invoice: Invoice) =>
    api.put<Invoice>(`/api/inventory/invoices/${invoice.id}`, invoice),

  deleteInvoice: (id: string) =>
    api.delete<void>(`/api/inventory/invoices/${id}`),
};
