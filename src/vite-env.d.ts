/// <reference types="vite/client" />

interface Window {
  electronAPI?: {
    printDirect: (content: string, printerAddress: string, printerPort: number, isThermalPrinter: boolean) => Promise<{ success: boolean }>;
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
  };
}
