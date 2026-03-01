import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { orderService } from '@/services/orderService';
import type { Order, OrderStatus, PaymentMethod } from '@shared/types';
import { useCart } from './CartContext';

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
    let all: Order[];
    if (startDate || endDate) {
      all = await orderService.getByDateRange(
        startDate ?? new Date(0),
        endDate   ?? new Date()
      );
    } else {
      all = await orderService.getAll();
    }
    setOrders(all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  }, []);

  const sendToKitchen = useCallback(async (orderId: string) => {
    await orderService.sendToKitchen(orderId);
  }, []);

  const markAsPaid = useCallback(async (orderId: string, paymentMethod: PaymentMethod): Promise<Order> => {
    const order = await orderService.markAsPaid(orderId, paymentMethod);
    removeEmptyDraftAfterPayment();
    await loadOrders();
    return order;
  }, [loadOrders, removeEmptyDraftAfterPayment]);

  const cancelOrder = useCallback(async (orderId: string) => {
    await orderService.updateStatus(orderId, 'cancelled');
    await loadOrders();
  }, [loadOrders]);

  const updateOrderStatus = useCallback(async (orderId: string, status: OrderStatus) => {
    await orderService.updateStatus(orderId, status);
    await loadOrders();
  }, [loadOrders]);

  const deleteOrder = useCallback(async (orderId: string) => {
    await orderService.delete(orderId);
    await loadOrders();
  }, [loadOrders]);

  const deleteOrders = useCallback(async (orderIds: string[]) => {
    await orderService.deleteMultiple(orderIds);
    await loadOrders();
  }, [loadOrders]);

  const deleteAllOrders = useCallback(async () => {
    await orderService.deleteAll();
    await loadOrders();
  }, [loadOrders]);

  const loadOrdersByDateRange = useCallback(async (startDate: Date, endDate: Date): Promise<Order[]> => {
    return orderService.getByDateRange(startDate, endDate);
  }, []);

  const loadOrdersPaginated = useCallback(async (page: number, pageSize: number): Promise<{ orders: Order[]; total: number; totalPages: number }> => {
    return orderService.getPaginated(page, pageSize);
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
