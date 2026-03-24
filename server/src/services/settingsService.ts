import type { Settings, Printer } from '@shared/types';
import { defaultReceiptCustomization } from '@shared/types';
import { getDatabase } from '../db/connection';

// ─── helpers ────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: Settings = {
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

function rowToSettings(row: { id: string; data: string }): Settings {
  try {
    const parsed = JSON.parse(row.data) as Settings;
    // Merge receiptCustomization with defaults so new fields are always present
    // even on settings saved before those fields existed
    if (parsed.receiptCustomization) {
      parsed.receiptCustomization = { ...defaultReceiptCustomization, ...parsed.receiptCustomization };
    }
    return parsed;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function rowToPrinter(row: Record<string, unknown>): Printer {
  return {
    id:              row['id']             as string,
    name:            (row['name']          as string | null) ?? undefined,
    role:            row['role']           as Printer['role'],
    mode:            (row['mode']          as Printer['mode'] | null) ?? 'queue',
    connectionType:  (row['connectionType'] as Printer['connectionType'] | null) ?? undefined,
    tcpHost:         (row['host']          as string | null) ?? undefined,
    tcpPort:         (row['port']          as number | null) ?? undefined,
    enabled:         row['enabled'] === 1 || row['enabled'] === true,
  };
}

// ─── service ────────────────────────────────────────────────────────────────

export const settingsService = {

  get(): Settings {
    const db = getDatabase();
    const row = db.prepare('SELECT id, data FROM settings WHERE id = ?').get('main') as
      { id: string; data: string } | undefined;
    return row ? rowToSettings(row) : DEFAULT_SETTINGS;
  },

  update(data: Partial<Settings>): Settings {
    const db = getDatabase();
    const current = settingsService.get();
    const merged: Settings = { ...current, ...data, id: 'main' };
    db.prepare('INSERT OR REPLACE INTO settings (id, data) VALUES (?, ?)')
      .run('main', JSON.stringify(merged));
    return merged;
  },

  getPrinters(): Printer[] {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM printers').all() as Record<string, unknown>[];
    return rows.map(rowToPrinter);
  },

  upsertPrinter(printer: Printer): Printer {
    const db = getDatabase();
    db.prepare(`
      INSERT OR REPLACE INTO printers
        (id, name, host, port, role, connectionType, enabled, paperWidth, mode,
         usbVendorId, usbProductId, bluetoothAddress)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      printer.id,
      printer.name ?? null,
      printer.tcpHost ?? null,
      printer.tcpPort ?? 9100,
      printer.role,
      printer.connectionType ?? 'network',
      printer.enabled !== false ? 1 : 0,
      80,
      printer.mode ?? null,
      null, null, null,
    );
    return printer;
  },

  deletePrinter(id: string): void {
    const db = getDatabase();
    db.prepare('DELETE FROM printers WHERE id = ?').run(id);
  },
};
