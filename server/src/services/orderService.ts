import type { Order, OrderStatus } from '@shared/types';

// Stub — sera remplacé par SQLite en Phase 2
export const orderService = {
  getAll: async (): Promise<Order[]> => {
    return [];
  },

  getByStatus: async (status: OrderStatus): Promise<Order[]> => {
    return [];
  },

  getById: async (id: string): Promise<Order | null> => {
    return null;
  },

  create: async (data: Partial<Order>): Promise<Order> => {
    throw new Error('orderService.create: non implémenté — Phase 2');
  },

  update: async (id: string, data: Partial<Order>): Promise<Order> => {
    throw new Error('orderService.update: non implémenté — Phase 2');
  },

  updateStatus: async (id: string, status: OrderStatus): Promise<Order> => {
    throw new Error('orderService.updateStatus: non implémenté — Phase 2');
  },

  delete: async (id: string): Promise<void> => {
    throw new Error('orderService.delete: non implémenté — Phase 2');
  },
};
