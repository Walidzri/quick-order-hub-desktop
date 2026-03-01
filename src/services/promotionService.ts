import { api } from './api';
import type { Promotion } from '@shared/types';

export const promotionService = {
  getAll: () =>
    api.get<Promotion[]>('/api/promotions'),

  getById: (id: string) =>
    api.get<Promotion>(`/api/promotions/${id}`),

  create: (data: Partial<Promotion>) =>
    api.post<Promotion>('/api/promotions', data),

  update: (id: string, data: Partial<Promotion>) =>
    api.put<Promotion>(`/api/promotions/${id}`, data),

  delete: (id: string) =>
    api.delete<void>(`/api/promotions/${id}`),
};
