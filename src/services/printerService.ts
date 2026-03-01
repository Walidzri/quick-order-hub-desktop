import { api } from './api';
import type { Order, Printer } from '@shared/types';

export const printerService = {
  printReceipt: (order: Order, printer: Printer) =>
    api.post<{ success: boolean }>('/api/print/receipt', { order, printer }),

  printKitchenTicket: (order: Order, printer: Printer) =>
    api.post<{ success: boolean }>('/api/print/kitchen', { order, printer }),

  openDrawer: (printer: Printer) =>
    api.post<{ success: boolean }>('/api/print/drawer', { printer }),

  testConnection: (host: string, port: number) =>
    api.get<{ connected: boolean }>(`/api/print/test?host=${host}&port=${port}`),
};
