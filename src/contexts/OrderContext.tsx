import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { getDB } from '@/lib/database';
import type { Order, OrderStatus, PaymentMethod, PrintJob } from '@/lib/database';
import { useCart } from './CartContext';

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

interface OrderContextType {
  orders: Order[];
  sendToKitchen: (orderId: string) => Promise<void>;
  markAsPaid: (orderId: string, paymentMethod: PaymentMethod) => Promise<Order>;
  cancelOrder: (orderId: string) => Promise<void>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  deleteOrder: (orderId: string) => Promise<void>;
  deleteOrders: (orderIds: string[]) => Promise<void>;
  deleteAllOrders: () => Promise<void>;
  loadOrders: (startDate?: Date, endDate?: Date) => Promise<void>;
  loadOrdersByDateRange: (startDate: Date, endDate: Date) => Promise<Order[]>;
  loadOrdersPaginated: (page: number, pageSize: number) => Promise<{ orders: Order[]; total: number; totalPages: number }>;
}

const OrderContext = createContext<OrderContextType | null>(null);

export function useOrder() {
  const ctx = useContext(OrderContext);
  if (!ctx) throw new Error('useOrder must be used within an OrderProvider');
  return ctx;
}

export function OrderProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const { removeEmptyDraftAfterPayment } = useCart();

  const loadOrders = useCallback(async (startDate?: Date, endDate?: Date) => {
    const db = await getDB();
    let all = await db.getAll('orders');
    if (startDate || endDate) {
      all = all.filter(o => {
        const d = new Date(o.createdAt);
        if (startDate && d < startDate) return false;
        if (endDate && d > endDate) return false;
        return true;
      });
    }
    setOrders(all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  }, []);

  const sendToKitchen = useCallback(async (orderId: string) => {
    const db = await getDB();
    const order = await db.get('orders', orderId);
    if (!order) return;
    const now = new Date();
    order.status = 'sentToKitchen';
    order.sentToKitchenAt = now;
    order.updatedAt = now;
    await db.put('orders', order);
    const printJob: PrintJob = {
      id: generateUUID(),
      orderId: order.id,
      printerRole: 'kitchen',
      status: 'pending',
      createdAt: now,
    };
    await db.put('printJobs', printJob);
  }, []);

  const markAsPaid = useCallback(async (orderId: string, paymentMethod: PaymentMethod): Promise<Order> => {
    const db = await getDB();
    const order = await db.get('orders', orderId);
    if (!order) throw new Error('Order not found');
    const now = new Date();
    order.status = 'paid';
    order.paymentMethod = paymentMethod;
    order.paidAt = now;
    order.updatedAt = now;
    await db.put('orders', order);
    const printJob: PrintJob = {
      id: generateUUID(),
      orderId: order.id,
      printerRole: 'cashier',
      status: 'pending',
      createdAt: now,
    };
    await db.put('printJobs', printJob);
    removeEmptyDraftAfterPayment();
    await loadOrders();
    return order;
  }, [loadOrders, removeEmptyDraftAfterPayment]);

  const cancelOrder = useCallback(async (orderId: string) => {
    const db = await getDB();
    const order = await db.get('orders', orderId);
    if (!order) return;
    order.status = 'cancelled';
    order.updatedAt = new Date();
    await db.put('orders', order);
    await loadOrders();
  }, [loadOrders]);

  const updateOrderStatus = useCallback(async (orderId: string, status: OrderStatus) => {
    const db = await getDB();
    const order = await db.get('orders', orderId);
    if (!order) return;
    order.status = status;
    order.updatedAt = new Date();
    await db.put('orders', order);
    await loadOrders();
  }, [loadOrders]);

  const deleteOrder = useCallback(async (orderId: string) => {
    const db = await getDB();
    await db.delete('orders', orderId);
    await loadOrders();
  }, [loadOrders]);

  const deleteOrders = useCallback(async (orderIds: string[]) => {
    const db = await getDB();
    for (const id of orderIds) await db.delete('orders', id);
    await loadOrders();
  }, [loadOrders]);

  const deleteAllOrders = useCallback(async () => {
    const db = await getDB();
    const all = await db.getAll('orders');
    for (const o of all) await db.delete('orders', o.id);
    await loadOrders();
  }, [loadOrders]);

  const loadOrdersByDateRange = useCallback(async (startDate: Date, endDate: Date): Promise<Order[]> => {
    const db = await getDB();
    if ('getOrdersByDateRange' in db) {
      return await (db as any).getOrdersByDateRange(startDate, endDate);
    }
    const all = await db.getAll('orders') as Order[];
    return all.filter(o => {
      const d = new Date(o.createdAt);
      return d >= startDate && d <= endDate;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, []);

  const loadOrdersPaginated = useCallback(async (page: number, pageSize: number): Promise<{ orders: Order[]; total: number; totalPages: number }> => {
    const db = await getDB();
    const offset = (page - 1) * pageSize;
    if ('getOrdersPaginated' in db) {
      const result = await (db as any).getOrdersPaginated(pageSize, offset);
      return { orders: result.orders, total: result.total, totalPages: Math.ceil(result.total / pageSize) };
    }
    const all = await db.getAll('orders') as Order[];
    const sorted = all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return {
      orders: sorted.slice(offset, offset + pageSize),
      total: all.length,
      totalPages: Math.ceil(all.length / pageSize),
    };
  }, []);

  return (
    <OrderContext.Provider value={{
      orders, sendToKitchen, markAsPaid, cancelOrder,
      updateOrderStatus, deleteOrder, deleteOrders, deleteAllOrders,
      loadOrders, loadOrdersByDateRange, loadOrdersPaginated,
    }}>
      {children}
    </OrderContext.Provider>
  );
}
