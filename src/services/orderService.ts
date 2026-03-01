import { api } from './api';
import type { Order, OrderStatus } from '@shared/types';

export const orderService = {
  getAll: () =>
    api.get<Order[]>('/api/orders'),

  getByStatus: (status: OrderStatus) =>
    api.get<Order[]>(`/api/orders?status=${status}`),

  getById: (id: string) =>
    api.get<Order>(`/api/orders/${id}`),

  create: (data: Partial<Order>) =>
    api.post<Order>('/api/orders', data),

  update: (id: string, data: Partial<Order>) =>
    api.patch<Order>(`/api/orders/${id}`, data),

  updateStatus: (id: string, status: OrderStatus) =>
    api.patch<Order>(`/api/orders/${id}/status`, { status }),

  delete: (id: string) =>
    api.delete<void>(`/api/orders/${id}`),
};
