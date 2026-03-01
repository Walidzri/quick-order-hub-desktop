import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getDB } from '@/lib/database';
import type { Printer } from '@/lib/database';

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
    async function init() {
      try {
        const db = await getDB();
        setPrinters(await db.getAll('printers'));
      } catch (err) {
        console.error('[PrinterContext] init error:', err);
      }
    }
    init();
  }, []);

  const updatePrinter = useCallback(async (printer: Printer) => {
    const db = await getDB();
    await db.put('printers', printer);
    setPrinters(await db.getAll('printers'));
  }, []);

  const deletePrinter = useCallback(async (id: string) => {
    const db = await getDB();
    await db.delete('printers', id);
    setPrinters(await db.getAll('printers'));
  }, []);

  return (
    <PrinterContext.Provider value={{ printers, updatePrinter, deletePrinter }}>
      {children}
    </PrinterContext.Provider>
  );
}
