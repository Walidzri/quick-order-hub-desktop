import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { writeFile, readFile } from 'fs/promises';

// Get user data path (where IndexedDB and app data are stored)
function getUserDataPath(): string {
  return app.getPath('userData');
}

// Get IndexedDB path
function getIndexedDBPath(): string {
  const userData = app.getPath('userData');
  // IndexedDB is stored in a subdirectory
  // Format: userData/IndexedDB/https_localhost_5173.indexeddb.leveldb (dev)
  // or: userData/IndexedDB/file__<hash>.indexeddb.leveldb (production)
  return join(userData, 'IndexedDB');
}

// Define __dirname for ES modules using import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// Note: electron-squirrel-startup may not be available, so we check first
try {
  if (require('electron-squirrel-startup')) {
    app.quit();
  }
} catch (e) {
  // electron-squirrel-startup not available, continue
}

let mainWindow: BrowserWindow | null = null;

const createWindow = (): void => {
  // Create the browser window.
  // Use preload.cjs directly (CommonJS) - more reliable than compiled preload.js
  let preloadPath = join(__dirname, 'preload.cjs');
  if (!existsSync(preloadPath)) {
    // Fallback to preload.js if .cjs doesn't exist
    preloadPath = join(__dirname, 'preload.js');
  }
  // Only log in development
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev) {
    console.log('[MAIN] Preload path:', preloadPath);
    console.log('[MAIN] Preload exists:', existsSync(preloadPath));
  }
  
  if (!existsSync(preloadPath)) {
    // Always log errors, even in production
    console.error('[MAIN] ERROR: Preload file not found!');
    if (isDev) {
      console.error('[MAIN] __dirname:', __dirname);
      console.error('[MAIN] Looking for:', preloadPath);
    }
  }
  
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    // icon: join(__dirname, '../build/icon.png'), // Uncomment when icon is available
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: true,
    show: false,
    autoHideMenuBar: true, // Hide menu bar (can be toggled with Alt key)
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // Open DevTools only in development
    mainWindow.webContents.openDevTools();
    
    // Wait for page to load and check electronAPI (dev only)
    mainWindow.webContents.on('did-finish-load', () => {
      setTimeout(() => {
        mainWindow?.webContents.executeJavaScript(`
          console.log('[RENDERER] Checking electronAPI:', typeof window.electronAPI);
          console.log('[RENDERER] window keys:', Object.keys(window).filter(k => k.toLowerCase().includes('electron')));
          if (window.electronAPI) {
            console.log('[RENDERER] electronAPI methods:', Object.keys(window.electronAPI));
            console.log('[RENDERER] electronAPI platform:', window.electronAPI.platform);
          } else {
            console.error('[RENDERER] electronAPI is NOT available!');
            console.error('[RENDERER] This means the preload script did not load correctly.');
          }
        `).catch(console.error);
      }, 1000);
    });
    
    // Suppress DevTools console errors (non-critical warnings) - dev only
    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
      // Filter out non-critical DevTools errors
      if (
        message.includes('Unknown VE context') ||
        message.includes('Autofill.enable') ||
        message.includes('Autofill.setAddresses') ||
        message.includes('Unable to move the cache') ||
        message.includes('Unable to create cache') ||
        message.includes('Gpu Cache Creation failed')
      ) {
        return; // Suppress these messages
      }
    });
    
    // Suppress stderr errors for cache (non-critical)
    process.stderr.on('data', (data) => {
      const message = data.toString();
      if (
        message.includes('Unable to move the cache') ||
        message.includes('Unable to create cache') ||
        message.includes('Gpu Cache Creation failed')
      ) {
        return; // Suppress these messages
      }
      // Allow other errors through
      process.stderr.write(data);
    });
  } else {
    // Production: Load from dist and don't open DevTools
    // In packaged app, files are in app.asar or resources/app
    // app.getAppPath() handles both cases automatically
    const appPath = app.getAppPath();
    
    // Try multiple possible paths for index.html
    const possiblePaths = [
      join(appPath, 'dist/index.html'),
      join(__dirname, '../dist/index.html'),
      join(__dirname, '../../dist/index.html'),
      join(appPath, 'index.html'),
    ];
    
    let loaded = false;
    for (const indexPath of possiblePaths) {
      try {
        if (existsSync(indexPath)) {
          mainWindow.loadFile(indexPath);
          loaded = true;
          console.log('[MAIN] Loaded index.html from:', indexPath);
          break;
        }
      } catch (err) {
        // Continue to next path
      }
    }
    
    if (!loaded) {
      // Last resort: try loading anyway (works with app.asar)
      const indexPath = join(appPath, 'dist/index.html');
      mainWindow.loadFile(indexPath).catch((err) => {
        console.error('[MAIN] Failed to load index.html:', err);
        console.error('[MAIN] app.getAppPath():', appPath);
        console.error('[MAIN] __dirname:', __dirname);
        console.error('[MAIN] Tried paths:', possiblePaths);
      });
    }
    // DevTools are NOT opened in production for security
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

// This method will be called when Electron has finished initialization
app.on('ready', () => {
  // Remove the menu bar completely
  Menu.setApplicationMenu(null);
  createWindow();
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC Handlers for printer functionality
ipcMain.handle('print:direct', async (event, { content, printerAddress, printerPort, isThermalPrinter }) => {
  try {
    const net = require('net');
    
    return new Promise((resolve, reject) => {
      const client = new net.Socket();
      let hasResolved = false;
      
      client.connect(printerPort || 9100, printerAddress, () => {
        // Convert content to buffer
        let buffer: Buffer;
        if (isThermalPrinter) {
          // For thermal printers, add ESC/POS commands
          // Initialize printer
          const init = Buffer.from('\x1B@', 'latin1');
          // Set encoding to PC437
          const encoding = Buffer.from('\x1Bt\x00', 'latin1');
          // Content
          const contentBuffer = Buffer.from(content, 'latin1');
          // Feed and cut
          const feed = Buffer.from('\n\n\n', 'latin1');
          const cut = Buffer.from('\x1D\x56\x00', 'latin1');
          
          buffer = Buffer.concat([init, encoding, contentBuffer, feed, cut]);
        } else {
          // For regular printers, plain text
          buffer = Buffer.from(content, 'utf8');
        }
        
        client.write(buffer, (err?: Error) => {
          if (err && !hasResolved) {
            hasResolved = true;
            reject(err);
            client.destroy();
          } else if (!hasResolved) {
            hasResolved = true;
            resolve({ success: true });
            // Give a small delay before closing
            setTimeout(() => {
              client.destroy();
            }, 100);
          }
        });
      });
      
      client.on('error', (err: Error) => {
        if (!hasResolved) {
          hasResolved = true;
          reject(err);
          client.destroy();
        }
      });
      
      client.setTimeout(5000, () => {
        if (!hasResolved) {
          hasResolved = true;
          reject(new Error('Connection timeout'));
          client.destroy();
        }
      });
    });
  } catch (error) {
    throw error;
  }
});

// IPC Handler for file operations
ipcMain.handle('fs:readFile', async (event, filePath: string) => {
  try {
    if (existsSync(filePath)) {
      return readFileSync(filePath, 'utf8');
    }
    return null;
  } catch (error) {
    throw error;
  }
});

ipcMain.handle('fs:writeFile', async (event, filePath: string, data: string) => {
  try {
    writeFileSync(filePath, data, 'utf8');
    return { success: true };
  } catch (error) {
    throw error;
  }
});

// IPC Handler for dialog
ipcMain.handle('dialog:showMessageBox', async (event, options) => {
  if (mainWindow) {
    return await dialog.showMessageBox(mainWindow, options);
  }
  return { response: 0 };
});

// IPC Handler for file save dialog
ipcMain.handle('dialog:showSaveDialog', async (event, options) => {
  if (mainWindow) {
    return await dialog.showSaveDialog(mainWindow, options);
  }
  return { canceled: true };
});

// IPC Handler for file open dialog
ipcMain.handle('dialog:showOpenDialog', async (event, options) => {
  if (mainWindow) {
    return await dialog.showOpenDialog(mainWindow, options);
  }
  return { canceled: true, filePaths: [] };
});

// IPC Handler for saving backup file
ipcMain.handle('backup:save', async (event, data: string, filePath: string) => {
  try {
    await writeFile(filePath, data, 'utf8');
    return { success: true };
  } catch (error) {
    throw error;
  }
});

// IPC Handler for loading backup file
ipcMain.handle('backup:load', async (event, filePath: string) => {
  try {
    const data = await readFile(filePath, 'utf8');
    return { success: true, data };
  } catch (error) {
    throw error;
  }
});

// IPC Handler for getting user data path
ipcMain.handle('app:getUserDataPath', () => {
  return getUserDataPath();
});

// IPC Handler for getting IndexedDB path
ipcMain.handle('app:getIndexedDBPath', () => {
  return getIndexedDBPath();
});
