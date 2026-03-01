import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { writeFile, readFile, appendFile } from 'fs/promises';
import { Socket, createConnection } from 'net';
import { request } from 'http';
import { createRequire } from 'module';
import { spawn, ChildProcess } from 'child_process';
import { startServer, stopServer } from '../server/src/index';
// PrintDaemon C# is now used instead of integrated Node.js daemon
// import { createPrintDaemonServer } from './print-daemon-integrated';

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
// Using createRequire for CommonJS module in ESM context
try {
  const require = createRequire(import.meta.url);
  if (require('electron-squirrel-startup')) {
    app.quit();
  }
} catch (e) {
  // electron-squirrel-startup not available, continue
}

let mainWindow: BrowserWindow | null = null;
let printDaemonProcess: ChildProcess | null = null;
let isQuitting = false;

// PrintDaemon C# runs on port 9100 as a separate process
const PRINT_DAEMON_PORT = 9100;
const PRINT_DAEMON_HOST = '127.0.0.1';

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
    fullscreen: true, // Afficher en plein écran au lancement (POS/kiosque)
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
            console.log('[RENDERER] electronAPI.testPrinter exists:', typeof window.electronAPI.testPrinter);
            console.log('[RENDERER] electronAPI.testPrinter is function:', typeof window.electronAPI.testPrinter === 'function');
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

// Check if PrintDaemon is already running by checking port 9100
function isPrintDaemonRunning(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = request({
      hostname: '127.0.0.1',
      port: 9100,
      path: '/status',
      method: 'GET',
      timeout: 500,
    }, (res) => {
      resolve(res.statusCode === 200);
      res.on('data', () => {}); // Consume response
      res.on('end', () => {});
    });

    req.on('error', () => {
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

// Start PrintDaemon C# process
async function startPrintDaemon(): Promise<void> {
  // Don't start if already running
  if (printDaemonProcess && !printDaemonProcess.killed) {
    console.log('[MAIN] PrintDaemon C# process is already running');
    return;
  }

  // Check if PrintDaemon is already running on port 9100
  const alreadyRunning = await isPrintDaemonRunning();
  if (alreadyRunning) {
    console.log('[MAIN] PrintDaemon C# is already running on port 9100 (started externally)');
    return;
  }

  try {
    const resourcesPath = process.resourcesPath || app.getAppPath();
    let printDaemonPath: string;

    if (app.isPackaged) {
      // Production: PrintDaemon.exe is in resources/PrintDaemon/
      printDaemonPath = join(resourcesPath, 'PrintDaemon', 'PrintDaemon.exe');
    } else {
      // Development: PrintDaemon.exe is in PrintDaemon/bin/Release/net8.0/win-x64/publish/
      printDaemonPath = join(__dirname, '..', 'PrintDaemon', 'bin', 'Release', 'net8.0', 'win-x64', 'publish', 'PrintDaemon.exe');
      
      // Fallback: try project root
      if (!existsSync(printDaemonPath)) {
        printDaemonPath = join(__dirname, '..', '..', 'PrintDaemon', 'bin', 'Release', 'net8.0', 'win-x64', 'publish', 'PrintDaemon.exe');
      }
    }

    if (!existsSync(printDaemonPath)) {
      console.warn(`[MAIN] ⚠️  PrintDaemon.exe not found at: ${printDaemonPath}`);
      console.warn(`[MAIN] Resources path: ${resourcesPath}`);
      console.warn(`[MAIN] App path: ${app.getAppPath()}`);
      console.warn(`[MAIN] Is packaged: ${app.isPackaged}`);
      console.warn(`[MAIN] Please compile PrintDaemon.exe or start it manually`);
      return;
    }

    console.log(`[MAIN] 🚀 Starting PrintDaemon C# from: ${printDaemonPath}`);

    // Start PrintDaemon.exe as a detached process
    printDaemonProcess = spawn(printDaemonPath, [], {
      detached: false, // Keep attached so we can kill it when app closes
      stdio: ['ignore', 'pipe', 'pipe'], // Capture stdout/stderr for logging
      windowsHide: true, // Hide console window on Windows
    });

    // Log stdout
    if (printDaemonProcess.stdout) {
      printDaemonProcess.stdout.on('data', (data) => {
        console.log(`[PRINT-DAEMON] ${data.toString().trim()}`);
      });
    }

    // Log stderr
    if (printDaemonProcess.stderr) {
      printDaemonProcess.stderr.on('data', (data) => {
        console.error(`[PRINT-DAEMON] ${data.toString().trim()}`);
      });
    }

    // Handle process exit
    printDaemonProcess.on('exit', (code, signal) => {
      console.log(`[MAIN] PrintDaemon C# exited with code ${code}, signal ${signal}`);
      printDaemonProcess = null;
      
      // Restart if not quitting (unless it was killed intentionally)
      if (!isQuitting && code !== 0 && signal !== 'SIGTERM') {
        console.log('[MAIN] PrintDaemon C# crashed, restarting in 2 seconds...');
        setTimeout(() => {
          if (!isQuitting) {
            startPrintDaemon();
          }
        }, 2000);
      }
    });

    // Handle spawn errors
    printDaemonProcess.on('error', (error) => {
      console.error('[MAIN] ❌ Failed to start PrintDaemon C#:', error);
      printDaemonProcess = null;
    });

    console.log(`[MAIN] ✅ PrintDaemon C# started (PID: ${printDaemonProcess.pid})`);
  } catch (error) {
    console.error('[MAIN] ❌ Error starting PrintDaemon C#:', error);
    printDaemonProcess = null;
  }
}

// Stop PrintDaemon C# process
function stopPrintDaemon(): void {
  if (printDaemonProcess && !printDaemonProcess.killed) {
    console.log('[MAIN] Stopping PrintDaemon C#...');
    try {
      // Try graceful shutdown first
      if (process.platform === 'win32') {
        // On Windows, use taskkill for graceful shutdown
        spawn('taskkill', ['/PID', printDaemonProcess.pid!.toString(), '/T', '/F'], {
          stdio: 'ignore',
          windowsHide: true,
        });
      } else {
        printDaemonProcess.kill('SIGTERM');
      }
      
      // Force kill after 3 seconds if still running
      setTimeout(() => {
        if (printDaemonProcess && !printDaemonProcess.killed) {
          console.log('[MAIN] Force killing PrintDaemon C#...');
          printDaemonProcess.kill('SIGKILL');
        }
      }, 3000);
    } catch (error) {
      console.error('[MAIN] Error stopping PrintDaemon C#:', error);
    }
    printDaemonProcess = null;
  }
}

// This method will be called when Electron has finished initialization
app.on('ready', async () => {
  // Remove the menu bar completely
  Menu.setApplicationMenu(null);

  // Start Fastify backend server
  try {
    const dbPath = join(app.getPath('userData'), 'pos.db');
    console.log('[MAIN] SQLite path:', dbPath);
    await startServer(3001, dbPath);
  } catch (error) {
    console.error('[MAIN] Failed to start Fastify server:', error);
  }

  createWindow();

  // Start PrintDaemon C# after a short delay to ensure everything is ready
  setTimeout(() => {
    startPrintDaemon().catch((error) => {
      console.error('[MAIN] Error starting PrintDaemon:', error);
    });
  }, 1000); // 1 second delay
});

// Quit when all windows are closed, except on macOS
app.on('before-quit', () => {
  isQuitting = true;
  stopPrintDaemon();
  stopServer().catch((err) => console.error('[MAIN] Error stopping Fastify:', err));
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    isQuitting = true;
    stopPrintDaemon();
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
    // Ensure PrintDaemon C# is running
    if (!printDaemonProcess || printDaemonProcess.killed) {
      startPrintDaemon();
    }
  }
});

// IPC Handlers for printer functionality
// Test printer connectivity
ipcMain.handle('print:test', async (event, { printerAddress, printerPort }) => {
  return new Promise((resolve) => {
    let resolved = false;
    let timeoutId: NodeJS.Timeout;
    const port = printerPort || 9100;

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (!client.destroyed) {
        client.destroy();
      }
    };

    const client = new Socket();
    
    client.connect(port, printerAddress, () => {
      console.log(`✅ Test connection successful to ${printerAddress}:${port}`);
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve({ 
          success: true, 
          message: `Connexion réussie à ${printerAddress}:${port}`,
          printer: printerAddress,
          port: port
        });
      }
    });

    client.on('error', (error: Error) => {
      console.error(`❌ Test connection failed to ${printerAddress}:${port}:`, error.message);
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve({ 
          success: false,
          error: 'Impossible de se connecter à l\'imprimante',
          message: `L'imprimante ${printerAddress}:${port} n'est pas accessible sur le réseau`,
          printer: printerAddress,
          port: port,
          details: `Erreur: ${error.message}. Vérifiez que: 1) L'imprimante est allumée, 2) L'IP est correcte, 3) L'imprimante est sur le même réseau, 4) Le port est correct (généralement 9100)`
        });
      }
    });

    // Timeout after 10 seconds
    timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.error(`⏱️ Test connection timeout to ${printerAddress}:${port} after 10 seconds`);
        cleanup();
        resolve({ 
          success: false,
          error: 'Timeout',
          message: `Timeout: l'imprimante ${printerAddress}:${port} n'a pas répondu dans les 10 secondes`,
          printer: printerAddress,
          port: port
        });
      }
    }, 10000);
  });
});

// Direct print to network printer
ipcMain.handle('print:direct', async (event, { content, printerAddress, printerPort, isThermalPrinter }) => {
  try {
    console.log(`[PRINT] print:direct called - isThermalPrinter: ${isThermalPrinter}, printer: ${printerAddress}:${printerPort || 9100}`);
    return new Promise((resolve, reject) => {
      const client = new Socket();
      let hasResolved = false;
      
      client.connect(printerPort || 9100, printerAddress, () => {
        // Convert content to buffer
        let buffer: Buffer;
        // For network printers on port 9100, they're almost always thermal printers
        // So force thermal mode unless explicitly disabled
        const useThermalMode = isThermalPrinter !== false;
        console.log(`[PRINT] Using thermal mode: ${useThermalMode}`);
        
        if (useThermalMode) {
          // For thermal printers, add ESC/POS commands
          // EXACTLY the same sequence as in DirectPrinter.formatReceipt() to ensure consistency
          
          // 1. Initialize printer (resets all settings) - ESC @
          const init = Buffer.from('\x1B@', 'latin1');
          
          // 2. Set encoding to PC437 - ESC t 0
          const encoding = Buffer.from('\x1Bt' + String.fromCharCode(0), 'latin1');
          
          // 3. Set left alignment (default) - ESC a 0
          const alignLeft = Buffer.from('\x1Ba' + String.fromCharCode(0), 'latin1');
          
          // 4. Content as-is (content already contains proper formatting)
          // Normalize string: replace non-breaking spaces (U+00A0) and other Unicode spaces with regular ASCII space
          // This fixes issues with thousands separators in currency formatting
          let normalizedContent = content.replace(/\u00A0/g, ' '); // Non-breaking space -> space
          normalizedContent = normalizedContent.replace(/[\u2000-\u200B\u202F\u205F]/g, ' '); // Other Unicode spaces -> space
          const contentBuffer = Buffer.from(normalizedContent, 'latin1');
          
          // 5. Feed lines before cutting (more lines for better compatibility) - ESC d n
          // Using exact same format as formatReceipt: this.commands.feed(5)
          const ESC = '\x1B';
          const feed = Buffer.from(ESC + 'd' + String.fromCharCode(5), 'latin1');
          
          // 6. Cut paper (full cut) - GS V 0
          // Using exact same format as formatReceipt: this.commands.cut()
          const GS = '\x1D';
          const cut = Buffer.from(GS + 'V' + String.fromCharCode(0), 'latin1');
          
          // 7. Extra feed after cut for some printers (just like formatReceipt does)
          const extraFeed = Buffer.from('\n', 'latin1');
          
          // Concatenate in exact same order as formatReceipt
          buffer = Buffer.concat([init, encoding, alignLeft, contentBuffer, feed, cut, extraFeed]);
          console.log(`[PRINT] Thermal printer buffer created - length: ${buffer.length}, cut command present: ${buffer.includes(Buffer.from('\x1DV\x00', 'latin1'))}`);
        } else {
          // For regular printers, plain text
          buffer = Buffer.from(content, 'utf8');
          console.log(`[PRINT] Regular printer buffer created - length: ${buffer.length}`);
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

// Shutdown PC (Windows: shutdown /s /t 5, macOS/Linux: shutdown -h now or equivalent)
ipcMain.handle('app:shutdownPC', async () => {
  const platform = process.platform;
  try {
    if (platform === 'win32') {
      const child = spawn('shutdown', ['/s', '/t', '5'], { shell: true, detached: true, stdio: 'ignore' });
      child.unref();
    } else if (platform === 'darwin') {
      const child = spawn('osascript', ['-e', 'tell application "System Events" to shut down'], { detached: true, stdio: 'ignore' });
      child.unref();
    } else {
      const child = spawn('shutdown', ['-h', 'now'], { shell: true, detached: true, stdio: 'ignore' });
      child.unref();
    }
    return { success: true };
  } catch (error) {
    console.error('Shutdown PC error:', error);
    return { success: false, error: String(error) };
  }
});

// Get logs directory path
function getLogsPath(): string {
  const userData = app.getPath('userData');
  return join(userData, 'logs');
}

// Ensure logs directory exists
function ensureLogsDirectory(): void {
  const logsPath = getLogsPath();
  if (!existsSync(logsPath)) {
    mkdirSync(logsPath, { recursive: true });
  }
}

// Get current log file path (one file per day)
function getCurrentLogFile(): string {
  ensureLogsDirectory();
  const logsPath = getLogsPath();
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return join(logsPath, `app-${today}.log`);
}

// Rotate old log files (keep last 10 days)
function rotateLogFiles(): void {
  try {
    const logsPath = getLogsPath();
    if (!existsSync(logsPath)) return;
    
    // In a real implementation, you would list files and delete old ones
    // For now, we just ensure the directory exists
  } catch (error) {
    console.error('Error rotating log files:', error);
  }
}

// Initialize logging on app start
ensureLogsDirectory();
rotateLogFiles();

// Log startup to console
const logsPath = getLogsPath();
console.log('[Electron] Logs directory:', logsPath);
console.log('[Electron] Current log file:', getCurrentLogFile());

// IPC Handler for writing logs
ipcMain.handle('log:write', async (event, logLine: string) => {
  try {
    const logFile = getCurrentLogFile();
    await appendFile(logFile, logLine, 'utf8');
    // Log to console in development for debugging
    if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
      console.log('[Log File] Written to:', logFile);
    }
    return { success: true };
  } catch (error) {
    console.error('Failed to write log:', error);
    console.error('Log file path:', getCurrentLogFile());
    return { success: false, error: String(error) };
  }
});

// PrintDaemon C# runs as a separate process - no IPC handlers needed
// Status can be checked directly via HTTP: http://127.0.0.1:9100/status
// Restart must be done manually or via Windows service management
