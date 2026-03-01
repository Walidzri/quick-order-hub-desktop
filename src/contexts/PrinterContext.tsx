import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { settingsService } from '@/services/settingsService';
import type { Printer } from '@shared/types';

interface PrinterContextType {
  printers: Printer[];
  updatePrinter: (printer: Printer) => Promise<void>;
  deletePrinter: (id: string) => Promise<void>;
}

const PrinterContext = createContext<PrinterContextType | null>(null);

export function usePrinter() {
  const ctx = useContext(PrinterContext);
  if (!ctx) throw new Error('usePrinter must be used within a PrinterProvider');
  return ctx;
}

export function PrinterProvider({ children }: { children: ReactNode }) {
  const [printers, setPrinters] = useState<Printer[]>([]);

  useEffect(() => {
    settingsService.getPrinters()
      .then(setPrinters)
      .catch(err => console.error('[PrinterContext] init error:', err));
  }, []);

  const updatePrinter = useCallback(async (printer: Printer) => {
    await settingsService.upsertPrinter(printer);
    const updated = await settingsService.getPrinters();
    setPrinters(updated);
  }, []);

  const deletePrinter = useCallback(async (id: string) => {
    await settingsService.deletePrinter(id);
    const updated = await settingsService.getPrinters();
    setPrinters(updated);
  }, []);

  return (
    <PrinterContext.Provider value={{ printers, updatePrinter, deletePrinter }}>
      {children}
    </PrinterContext.Provider>
  );
}
