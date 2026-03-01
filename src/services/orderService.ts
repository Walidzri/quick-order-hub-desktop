import { api } from './api';
import type { Order, OrderStatus, PaymentMethod } from '@shared/types';

export const orderService = {
  getAll: () =>
    api.get<Order[]>('/api/orders'),

  getByStatus: (status: OrderStatus) =>
    api.get<Order[]>(`/api/orders?status=${status}`),

  getByDateRange: (startDate: Date, endDate: Date) =>
    api.get<Order[]>(`/api/orders?start=${startDate.toISOString()}&end=${endDate.toISOString()}`),

  getPaginated: (page: number, pageSize: number) =>
    api.get<{ orders: Order[]; total: number; totalPages: number }>(
      `/api/orders?page=${page}&pageSize=${pageSize}`
    ),

  getById: (id: string) =>
    api.get<Order>(`/api/orders/${id}`),

  create: (data: Partial<Order>) =>
    api.post<Order>('/api/orders', data),

  update: (id: string, data: Partial<Order>) =>
    api.patch<Order>(`/api/orders/${id}`, data),

  updateStatus: (id: string, status: OrderStatus) =>
    api.patch<Order>(`/api/orders/${id}/status`, { status }),

  sendToKitchen: (id: string) =>
    api.post<Order>(`/api/orders/${id}/send-to-kitchen`, {}),

  markAsPaid: (id: string, paymentMethod: PaymentMethod) =>
    api.post<Order>(`/api/orders/${id}/mark-paid`, { paymentMethod }),

  delete: (id: string) =>
    api.delete<void>(`/api/orders/${id}`),

  deleteMultiple: (ids: string[]) =>
    api.post<{ deleted: number }>('/api/orders/delete-multiple', { ids }),

  deleteAll: () =>
    api.delete<{ deleted: number }>('/api/orders'),
};
