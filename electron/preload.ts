import { contextBridge, ipcRenderer } from 'electron';

// Only log in development
if (process.env.NODE_ENV === 'development') {
  console.log('[PRELOAD] Preload script starting...');
  console.log('[PRELOAD] contextBridge available:', typeof contextBridge !== 'undefined');
  console.log('[PRELOAD] ipcRenderer available:', typeof ipcRenderer !== 'undefined');
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
try {
  contextBridge.exposeInMainWorld('electronAPI', {
    // Printer API
    printDirect: (content: string, printerAddress: string, printerPort: number, isThermalPrinter: boolean) =>
      ipcRenderer.invoke('print:direct', { content, printerAddress, printerPort, isThermalPrinter }),
    testPrinter: (printerAddress: string, printerPort: number) =>
      ipcRenderer.invoke('print:test', { printerAddress, printerPort }),
    
    // File system API
    readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
    writeFile: (filePath: string, data: string) => ipcRenderer.invoke('fs:writeFile', filePath, data),
    
    // Dialog API
    showMessageBox: (options: Electron.MessageBoxOptions) => ipcRenderer.invoke('dialog:showMessageBox', options),
    showSaveDialog: (options: Electron.SaveDialogOptions) => ipcRenderer.invoke('dialog:showSaveDialog', options),
    showOpenDialog: (options: Electron.OpenDialogOptions) => ipcRenderer.invoke('dialog:showOpenDialog', options),
    
    // Backup API
    saveBackup: (data: string, filePath: string) => ipcRenderer.invoke('backup:save', data, filePath),
    loadBackup: (filePath: string) => ipcRenderer.invoke('backup:load', filePath),
    
  // Platform info
  platform: process.platform,
  
    // App paths
    getUserDataPath: () => ipcRenderer.invoke('app:getUserDataPath'),
    getIndexedDBPath: () => ipcRenderer.invoke('app:getIndexedDBPath'),
    
    // Logging API
    writeLog: (logLine: string) => ipcRenderer.invoke('log:write', logLine),
    
    // PrintDaemon C# runs as separate process - check status via HTTP: http://127.0.0.1:9100/status
    // No IPC handlers needed
});
  
  if (process.env.NODE_ENV === 'development') {
    console.log('[PRELOAD] electronAPI exposed successfully');
    console.log('[PRELOAD] Platform:', process.platform);
  }
} catch (error) {
  // Always log errors, even in production
  console.error('[PRELOAD] Error exposing electronAPI:', error);
}
