import type { Settings, Printer } from '@shared/types';
import { defaultReceiptCustomization } from '@shared/types';

// Stub — sera remplacé par SQLite en Phase 2
export const settingsService = {
  get: async (): Promise<Settings> => {
    // Retourne des settings par défaut jusqu'à la Phase 2
    return {
      id: 'main',
      language: 'fr-FR',
      currency: 'DZD',
      restaurantName: 'Fast Food Restaurant',
      address: '',
      phone: '',
      receiptHeader: '',
      receiptFooter: '',
      showAddress: true,
      showPhone: true,
      darkMode: true,
      primaryColor: '#f97316',
      kioskMode: false,
      receiptCustomization: defaultReceiptCustomization,
    };
  },

  update: async (data: Partial<Settings>): Promise<Settings> => {
    throw new Error('settingsService.update: non implémenté — Phase 2');
  },

  getPrinters: async (): Promise<Printer[]> => {
    return [];
  },

  upsertPrinter: async (printer: Printer): Promise<Printer> => {
    throw new Error('settingsService.upsertPrinter: non implémenté — Phase 2');
  },

  deletePrinter: async (id: string): Promise<void> => {
    throw new Error('settingsService.deletePrinter: non implémenté — Phase 2');
  },
};
