const { contextBridge, ipcRenderer } = require('electron');

// Only log in development
if (process.env.NODE_ENV === 'development') {
  console.log('[PRELOAD] Preload script starting (CommonJS)...');
  console.log('[PRELOAD] contextBridge available:', typeof contextBridge !== 'undefined');
  console.log('[PRELOAD] ipcRenderer available:', typeof ipcRenderer !== 'undefined');
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
try {
  contextBridge.exposeInMainWorld('electronAPI', {
    // Printer API
    printDirect: (content, printerAddress, printerPort, isThermalPrinter) =>
      ipcRenderer.invoke('print:direct', { content, printerAddress, printerPort, isThermalPrinter }),
    testPrinter: (printerAddress, printerPort) =>
      ipcRenderer.invoke('print:test', { printerAddress, printerPort }),
    
    // File system API
    readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
    writeFile: (filePath, data) => ipcRenderer.invoke('fs:writeFile', filePath, data),
    
    // Dialog API
    showMessageBox: (options) => ipcRenderer.invoke('dialog:showMessageBox', options),
    showSaveDialog: (options) => ipcRenderer.invoke('dialog:showSaveDialog', options),
    showOpenDialog: (options) => ipcRenderer.invoke('dialog:showOpenDialog', options),
    
    // Backup API
    saveBackup: (data, filePath) => ipcRenderer.invoke('backup:save', data, filePath),
    loadBackup: (filePath) => ipcRenderer.invoke('backup:load', filePath),
    
    // Platform info
    platform: process.platform,
    
    // App paths
    getUserDataPath: () => ipcRenderer.invoke('app:getUserDataPath'),
    getIndexedDBPath: () => ipcRenderer.invoke('app:getIndexedDBPath'),
    shutdownPC: () => ipcRenderer.invoke('app:shutdownPC'),
  });
  
  if (process.env.NODE_ENV === 'development') {
    console.log('[PRELOAD] electronAPI exposed successfully');
    console.log('[PRELOAD] Platform:', process.platform);
    console.log('[PRELOAD] Available methods:', Object.keys(contextBridge.exposeInMainWorld).length > 0 ? 'contextBridge methods' : 'electronAPI methods:', ['printDirect', 'testPrinter', 'readFile', 'writeFile', 'showMessageBox', 'showSaveDialog', 'showOpenDialog', 'saveBackup', 'loadBackup', 'platform', 'getUserDataPath', 'getIndexedDBPath']);
  }
} catch (error) {
  // Always log errors, even in production
  console.error('[PRELOAD] Error exposing electronAPI:', error);
}
