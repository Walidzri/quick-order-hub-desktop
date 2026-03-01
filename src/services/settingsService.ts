import { api } from './api';
import type { Settings, Printer } from '@shared/types';

export const settingsService = {
  get: () =>
    api.get<Settings>('/api/settings'),

  update: (data: Partial<Settings>) =>
    api.patch<Settings>('/api/settings', data),

  // Printers
  getPrinters: () =>
    api.get<Printer[]>('/api/printers'),

  upsertPrinter: (printer: Printer) =>
    api.put<Printer>(`/api/printers/${printer.id}`, printer),

  deletePrinter: (id: string) =>
    api.delete<void>(`/api/printers/${id}`),
};
