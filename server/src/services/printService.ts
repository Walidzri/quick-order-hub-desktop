import type { Order, Printer } from '@shared/types';

// Délègue au PrintDaemon C# sur port 9100 — sera complété en Phase 1.5
export const printService = {
  printReceipt: async (order: Order, printer: Printer): Promise<void> => {
    throw new Error('printService.printReceipt: non implémenté — Phase 1.5');
  },

  printKitchenTicket: async (order: Order, printer: Printer): Promise<void> => {
    throw new Error('printService.printKitchenTicket: non implémenté — Phase 1.5');
  },

  openDrawer: async (printer: Printer): Promise<void> => {
    throw new Error('printService.openDrawer: non implémenté — Phase 1.5');
  },

  testConnection: async (host: string, port: number): Promise<boolean> => {
    // Délègue la vérification au PrintDaemon
    try {
      const res = await fetch(`http://127.0.0.1:9100/status`);
      return res.ok;
    } catch {
      return false;
    }
  },
};
