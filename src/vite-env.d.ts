/// <reference types="vite/client" />

interface Window {
  electronAPI?: {
    printDirect: (content: string, printerAddress: string, printerPort: number, isThermalPrinter: boolean) => Promise<{ success: boolean }>;
    testPrinter: (printerAddress: string, printerPort: number) => Promise<{ success: boolean; message?: string; error?: string; details?: string }>;
    readFile: (filePath: string) => Promise<string | null>;
    writeFile: (filePath: string, data: string) => Promise<{ success: boolean }>;
    showMessageBox: (options: Electron.MessageBoxOptions) => Promise<Electron.MessageBoxReturnValue>;
    showSaveDialog: (options: Electron.SaveDialogOptions) => Promise<Electron.SaveDialogReturnValue>;
    showOpenDialog: (options: Electron.OpenDialogOptions) => Promise<Electron.OpenDialogReturnValue>;
    saveBackup: (data: string, filePath: string) => Promise<{ success: boolean }>;
    loadBackup: (filePath: string) => Promise<{ success: boolean; data: string }>;
    platform: string;
    getUserDataPath: () => Promise<string>;
    getIndexedDBPath: () => Promise<string>;
    writeLog: (logLine: string) => Promise<{ success: boolean; error?: string }>;
    getDaemonStatus: () => Promise<{
      running: boolean;
      status?: string;
      message?: string;
      version?: string;
      error?: string;
      daemonProcess?: { pid: number | undefined; killed: boolean };
    }>;
    restartDaemon: () => Promise<{ success: boolean; message?: string; error?: string }>;
  };
}
