export type PrinterMode = 'queue' | 'tcp';
// Type de connexion physique de l'imprimante
// - 'tcp' / 'wifi' / 'bluetooth' : gérés via daemon
// - 'windows' : impression via PrintDaemon C# + spooler Windows (appels directs Win32)
export type PrinterConnectionType = 'tcp' | 'bluetooth' | 'wifi' | 'windows';
export type PrinterRole = 'kitchen' | 'cashier';
export type PrintJobStatus = 'pending' | 'printed' | 'failed';

export interface Printer {
  id: string;
  /** Rôle principal de l'imprimante (pour quel ticket elle sert) */
  role: PrinterRole;
  /** Mode interne (hérité de l'ancienne implémentation) */
  mode: PrinterMode;
  /** Type de connexion physique de l'imprimante */
  connectionType?: PrinterConnectionType;
  /** Nom lisible de l'imprimante (ex: Cuisine 1, Caisse 2) */
  name?: string;
  queueName?: string;
  tcpHost?: string;
  tcpPort?: number;
  isThermalPrinter?: boolean; // true for ESC/POS thermal printers, false for regular printers
  /** Imprimante active ou désactivée (true par défaut si non défini) */
  enabled?: boolean;
}

export interface PrintJob {
  id: string;
  orderId: string;
  printerRole: PrinterRole;
  status: PrintJobStatus;
  errorMessage?: string;
  createdAt: Date;
  printedAt?: Date;
}
