export interface Supplier {
  id: string;
  name: string;
  contact?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: 'food' | 'beverage' | 'supplies' | 'other';
  unit: string; // 'kg', 'L', 'piece', 'box', etc.
  currentStock: number;
  minStock?: number; // Alert when stock is below this
  unitPrice: number; // Purchase price per unit
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceLine {
  id: string;
  inventoryItemId?: string; // Link to inventory item if exists
  itemName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  supplierId: string;
  supplierName: string;
  date: Date;
  lines: InvoiceLine[];
  subtotal: number;
  tax?: number;
  discount?: number;
  total: number;
  notes?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}
