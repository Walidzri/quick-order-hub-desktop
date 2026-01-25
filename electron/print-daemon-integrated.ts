// Integrated print daemon - runs directly in Electron main process
// No separate process needed

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { Socket, createConnection } from 'net';
import { existsSync, writeFileSync, unlinkSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { spawn } from 'child_process';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { app } from 'electron';

const PORT = 9100;
const HOST = '127.0.0.1';

// Helper: send ESC/POS content over raw TCP to a network printer
function sendToNetworkPrinter(payload: { host: string; port?: number; content: string; isThermal?: boolean }): Promise<{ success: boolean }> {
  const { host, port = 9100, content, isThermal = true } = payload;

  console.log(`[PRINT-DAEMON] Connecting to printer ${host}:${port} (thermal: ${isThermal})`);

  return new Promise((resolve, reject) => {
    const client = new Socket();
    let hasEnded = false;

    client.connect(port, host, () => {
      console.log(`[PRINT-DAEMON] Connected to printer ${host}:${port}`);
      try {
        let buffer: Buffer;

        if (isThermal) {
          const ESC = '\x1B';
          const GS = '\x1D';

          const init = Buffer.from(ESC + '@', 'latin1');
          const encoding = Buffer.from(ESC + 't' + String.fromCharCode(0), 'latin1');
          const alignLeft = Buffer.from(ESC + 'a' + String.fromCharCode(0), 'latin1');

          // Normalize content
          let normalizedContent = content.replace(/\u00A0/g, ' ');
          normalizedContent = normalizedContent.replace(/[\u2000-\u200B\u202F\u205F]/g, ' ');
          normalizedContent = normalizedContent.replace(/[\s\n\r]+$/, '');
          normalizedContent = normalizedContent.replace(/^[\s\n\r]+/, '');
          normalizedContent = normalizedContent.replace(/\r\n/g, '\n');
          normalizedContent = normalizedContent.replace(/\r/g, '\n');
          normalizedContent = normalizedContent.replace(/\n{4,}/g, '\n\n\n');
          
          const contentBuffer = Buffer.from(normalizedContent, 'latin1');
          const feed = Buffer.from(ESC + 'd' + String.fromCharCode(5), 'latin1');
          const cut = Buffer.from(GS + 'V' + String.fromCharCode(0), 'latin1');
          // Extra feed after cut for some printers (same as printDirect)
          const extraFeed = Buffer.from('\n', 'latin1');

          buffer = Buffer.concat([init, encoding, alignLeft, contentBuffer, feed, cut, extraFeed]);
          console.log(`[PRINT-DAEMON] Thermal buffer created: ${buffer.length} bytes`);
        } else {
          buffer = Buffer.from(content, 'utf8');
          console.log(`[PRINT-DAEMON] Plain text buffer created: ${buffer.length} bytes`);
        }

        client.write(buffer, (err) => {
          if (err && !hasEnded) {
            hasEnded = true;
            console.error(`[PRINT-DAEMON] Write error:`, err);
            client.destroy();
            return reject(err);
          }

          if (!hasEnded) {
            hasEnded = true;
            console.log(`[PRINT-DAEMON] Data sent successfully`);
            setTimeout(() => {
              client.destroy();
            }, 100);
            resolve({ success: true });
          }
        });
      } catch (e) {
        if (!hasEnded) {
          hasEnded = true;
          console.error(`[PRINT-DAEMON] Buffer creation error:`, e);
          client.destroy();
          reject(e);
        }
      }
    });

    client.on('error', (err) => {
      if (!hasEnded) {
        hasEnded = true;
        console.error(`[PRINT-DAEMON] Connection error to ${host}:${port}:`, err);
        client.destroy();
        reject(err);
      }
    });

    client.setTimeout(5000, () => {
      if (!hasEnded) {
        hasEnded = true;
        console.error(`[PRINT-DAEMON] Connection timeout to ${host}:${port}`);
        client.destroy();
        reject(new Error('Connection timeout to printer'));
      }
    });
  });
}

// Helper: send ESC/POS content via Windows spooler using external C# helper
function sendToWindowsPrinter(payload: { content: string; printerName?: string; helperPath?: string; resourcesPath?: string }): Promise<{ success: boolean }> {
  const { content, printerName, helperPath, resourcesPath } = payload;

  // Generate temp file
  const tmpDir = tmpdir();
  const fileName = `qoh-print-${Date.now()}-${Math.random().toString(16).slice(2)}.bin`;
  const filePath = join(tmpDir, fileName);

  // Build ESC/POS buffer
  const ESC = '\x1B';
  const GS = '\x1D';

  let normalizedContent = content.replace(/\u00A0/g, ' ');
  normalizedContent = normalizedContent.replace(/[\u2000-\u200B\u202F\u205F]/g, ' ');
  normalizedContent = normalizedContent.replace(/[\s\n\r]+$/, '');
  normalizedContent = normalizedContent.replace(/^[\s\n\r]+/, '');
  normalizedContent = normalizedContent.replace(/\r\n/g, '\n');
  normalizedContent = normalizedContent.replace(/\r/g, '\n');
  normalizedContent = normalizedContent.replace(/\n{4,}/g, '\n\n\n');

  const init = Buffer.from(ESC + '@', 'latin1');
  const encoding = Buffer.from(ESC + 't' + String.fromCharCode(0), 'latin1');
  const alignLeft = Buffer.from(ESC + 'a' + String.fromCharCode(0), 'latin1');
  const contentBuffer = Buffer.from(normalizedContent, 'latin1');
  const feed = Buffer.from(ESC + 'd' + String.fromCharCode(5), 'latin1');
  const cut = Buffer.from([0x1D, 0x56, 0x42, 0x00]);

  const buffer = Buffer.concat([init, encoding, alignLeft, contentBuffer, feed, cut]);
  
  try {
    writeFileSync(filePath, buffer);
    console.log(`[PRINT-DAEMON] Temp file created: ${filePath} (${buffer.length} bytes)`);
    
    // Verify file was created
    if (!existsSync(filePath)) {
      throw new Error(`Failed to create temp file: ${filePath}`);
    }
    
    const stats = statSync(filePath);
    console.log(`[PRINT-DAEMON] Temp file verified: ${stats.size} bytes`);
  } catch (writeError) {
    console.error(`[PRINT-DAEMON] Failed to write temp file:`, writeError);
    throw new Error(`Failed to create temp file: ${writeError instanceof Error ? writeError.message : String(writeError)}`);
  }

  // Get helper path
  let exePath: string;
  if (helperPath) {
    exePath = helperPath;
  } else if (resourcesPath) {
    // Check if we're in development or production
    const isDev = !app.isPackaged;
    
    if (isDev) {
      // Development mode: 
      // - app.getAppPath() returns node_modules/electron/dist/
      // - We need to find the project root (where print-daemon/ is located)
      // Try multiple possible paths
      const projectRoot = process.cwd(); // Should be the project root when running from npm
      const possiblePaths = [
        join(projectRoot, 'print-daemon', 'RawPrinterHelper', 'RawPrinterHelper.exe'), // From project root (most likely)
        join(resourcesPath, '..', '..', '..', '..', 'print-daemon', 'RawPrinterHelper', 'RawPrinterHelper.exe'), // node_modules/electron/dist/../../../../print-daemon/
        join(resourcesPath, '..', '..', 'print-daemon', 'RawPrinterHelper', 'RawPrinterHelper.exe'), // node_modules/electron/dist/../../print-daemon/
      ];
      
      exePath = '';
      for (const path of possiblePaths) {
        console.log(`[PRINT-DAEMON] Checking path: ${path}`);
        if (existsSync(path)) {
          exePath = path;
          console.log(`[PRINT-DAEMON] ✅ Found RawPrinterHelper.exe in dev mode at: ${exePath}`);
          break;
        }
      }
      
      if (!exePath) {
        // Last resort: try resourcesPath directly
        exePath = join(resourcesPath, 'print-daemon', 'RawPrinterHelper', 'RawPrinterHelper.exe');
        console.log(`[PRINT-DAEMON] ⚠️ Trying fallback path: ${exePath}`);
      }
    } else {
      // Production mode: files are in resources/print-daemon/RawPrinterHelper/
      exePath = join(resourcesPath, 'print-daemon', 'RawPrinterHelper', 'RawPrinterHelper.exe');
      console.log(`[PRINT-DAEMON] Production mode, using path: ${exePath}`);
    }
  } else {
    throw new Error('RawPrinterHelper.exe path not found. resourcesPath not provided.');
  }

  if (!existsSync(exePath)) {
    // List all tried paths for debugging
    console.error(`[PRINT-DAEMON] ❌ RawPrinterHelper.exe not found at: ${exePath}`);
    console.error(`[PRINT-DAEMON] resourcesPath: ${resourcesPath}`);
    console.error(`[PRINT-DAEMON] process.cwd(): ${process.cwd()}`);
    console.error(`[PRINT-DAEMON] app.isPackaged: ${app.isPackaged}`);
    throw new Error(`RawPrinterHelper.exe not found at: ${exePath}`);
  }
  
  console.log(`[PRINT-DAEMON] ✅ Using RawPrinterHelper.exe at: ${exePath}`);

  return new Promise((resolve, reject) => {
    const args: string[] = [];
    if (printerName) {
      args.push('-p', printerName);
    }
    args.push('-f', filePath);

    console.log(`[PRINT-DAEMON] Executing: ${exePath} ${args.join(' ')}`);
    console.log(`[PRINT-DAEMON] Temp file exists: ${existsSync(filePath)}`);
    console.log(`[PRINT-DAEMON] Temp file path: ${filePath}`);
    console.log(`[PRINT-DAEMON] Printer name: ${printerName || '(default)'}`);

    let stderr = '';
    let stdout = '';
    let hasResolved = false;
    let timeoutId: NodeJS.Timeout | null = null;

    const proc = spawn(exePath, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false, // Le processus est attaché au parent, se terminera automatiquement
    });

    // Timeout de sécurité : tuer le processus après 30 secondes maximum
    timeoutId = setTimeout(() => {
      if (!hasResolved && proc && !proc.killed) {
        console.error(`[PRINT-DAEMON] ⚠️ Timeout: RawPrinterHelper prend trop de temps, arrêt forcé`);
        hasResolved = true;
        try {
          // Tuer le processus et tous ses enfants
          proc.kill('SIGTERM');
          // Si SIGTERM ne fonctionne pas, forcer avec SIGKILL après 2 secondes
          setTimeout(() => {
            if (proc && !proc.killed) {
              console.error(`[PRINT-DAEMON] ⚠️ Force kill du processus`);
              proc.kill('SIGKILL');
            }
          }, 2000);
        } catch (e) {
          console.error(`[PRINT-DAEMON] Erreur lors du kill du processus:`, e);
        }
        
        // Nettoyer le fichier temporaire
        try {
          if (existsSync(filePath)) {
            unlinkSync(filePath);
          }
        } catch (e) {
          console.warn(`[PRINT-DAEMON] Failed to delete temp file:`, e);
        }
        
        reject(new Error('RawPrinterHelper: Timeout - le processus a pris plus de 30 secondes et a été arrêté'));
      }
    }, 30000); // 30 secondes timeout

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('error', (error) => {
      if (timeoutId) clearTimeout(timeoutId);
      if (!hasResolved) {
        hasResolved = true;
        console.error(`[PRINT-DAEMON] Spawn error:`, error);
        reject(new Error(`Failed to execute RawPrinterHelper: ${error.message}. Path: ${exePath}`));
      }
    });

    proc.on('exit', (code, signal) => {
      if (timeoutId) clearTimeout(timeoutId);
      
      if (hasResolved) {
        // Déjà résolu (timeout ou erreur)
        return;
      }
      hasResolved = true;

      // Le processus s'est terminé normalement
      console.log(`[PRINT-DAEMON] RawPrinterHelper process exited with code ${code}, signal ${signal}`);
      
      // Clean up temp file
      try {
        if (existsSync(filePath)) {
          unlinkSync(filePath);
        }
      } catch (e) {
        console.warn(`[PRINT-DAEMON] Failed to delete temp file:`, e);
      }

      if (code === 0) {
        console.log(`[PRINT-DAEMON] ✅ RawPrinterHelper succeeded`);
        if (stdout) console.log(`[PRINT-DAEMON] stdout:`, stdout);
        resolve({ success: true });
      } else {
        const errorCode = code ?? signal ?? 'unknown';
        const errorMsg = stderr || stdout || 'No error message';
        console.error(`[PRINT-DAEMON] ❌ RawPrinterHelper failed with code ${errorCode}`);
        console.error(`[PRINT-DAEMON] stderr:`, stderr);
        console.error(`[PRINT-DAEMON] stdout:`, stdout);
        console.error(`[PRINT-DAEMON] File path: ${filePath}`);
        console.error(`[PRINT-DAEMON] Printer: ${printerName || '(default)'}`);
        console.error(`[PRINT-DAEMON] Exe path: ${exePath}`);
        
        // Convert Windows error code to readable message
        let readableError = `RawPrinterHelper exited with code ${errorCode}`;
        if (code === 1) {
          readableError = `RawPrinterHelper: Fichier non trouvé ou paramètres manquants. Vérifiez que le fichier existe et que le nom de l'imprimante est correct.`;
        } else if (code === 2) {
          readableError = `RawPrinterHelper: Erreur d'impression. Vérifiez que l'imprimante "${printerName || '(par défaut)'}" existe et est accessible.`;
        } else if (code && code > 2) {
          // Windows error code
          readableError = `RawPrinterHelper: Erreur Windows (code ${code}). ${errorMsg}`;
        }
        
        reject(new Error(`${readableError}\nDétails: ${errorMsg}`));
      }
    });
  });
}

// Parse JSON body from request
function parseJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        if (!body) {
          reject(new Error('Empty request body'));
          return;
        }
        const parsed = JSON.parse(body);
        resolve(parsed);
      } catch (e) {
        console.error('[PRINT-DAEMON] JSON parse error:', e);
        console.error('[PRINT-DAEMON] Body received:', body.substring(0, 500));
        reject(new Error(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`));
      }
    });
    req.on('error', (err) => {
      console.error('[PRINT-DAEMON] Request error:', err);
      reject(err);
    });
  });
}

// Create and start the HTTP server
export function createPrintDaemonServer(resourcesPath?: string): any {
  console.log('[PRINT-DAEMON] Creating server with resourcesPath:', resourcesPath);
  
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // Wrap everything in try-catch to catch any unhandled errors
    try {
      console.log(`[PRINT-DAEMON] ${req.method} ${req.url} - Headers:`, req.headers);
      
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        console.log('[PRINT-DAEMON] Handling OPTIONS request');
        res.writeHead(204);
        return res.end();
      }

      if (req.url === '/health' && req.method === 'GET') {
        console.log('[PRINT-DAEMON] Handling /health request');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          status: 'ok',
          message: 'Print daemon running',
          version: '0.2.0',
        }));
      }

      if (req.url === '/print' && req.method === 'POST') {
        try {
          console.log('[PRINT-DAEMON] Received POST /print request');
          console.log('[PRINT-DAEMON] Request headers:', JSON.stringify(req.headers, null, 2));
          const body = await parseJsonBody(req);
          console.log('[PRINT-DAEMON] Parsed body:', { 
            connectionType: body?.connectionType, 
            hasTarget: !!body?.target,
            hasContent: !!body?.content,
            contentLength: body?.content?.length 
          });
          
          const { connectionType, target, content, isThermalPrinter = true, role } = body || {};

          if (!content || typeof content !== 'string') {
            console.error('[PRINT-DAEMON] Missing or invalid content');
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: false, message: 'Missing content' }));
          }

          if (!connectionType || !target) {
            console.error('[PRINT-DAEMON] Missing connectionType or target:', { connectionType, hasTarget: !!target });
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: false, message: 'Missing connectionType or target' }));
          }

          console.log('[PRINT-DAEMON] New job:', { role, connectionType, target, length: content.length, isThermalPrinter });

          if (connectionType === 'tcp' || connectionType === 'ethernet' || connectionType === 'wifi') {
            if (!target.host) {
              console.error('[PRINT-DAEMON] Missing target.host for network printer');
              res.writeHead(400, { 'Content-Type': 'application/json' });
              return res.end(JSON.stringify({ success: false, message: 'Missing target.host for network printer' }));
            }
            console.log('[PRINT-DAEMON] Sending to network printer:', target.host, target.port || 9100);
            try {
              await sendToNetworkPrinter({
                host: target.host,
                port: target.port || 9100,
                content,
                isThermal: isThermalPrinter !== false,
              });
              console.log('[PRINT-DAEMON] Network print successful');
              res.writeHead(200, { 'Content-Type': 'application/json' });
              return res.end(JSON.stringify({ success: true }));
            } catch (networkError) {
              console.error('[PRINT-DAEMON] Network print error:', networkError);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              return res.end(JSON.stringify({
                success: false,
                message: networkError instanceof Error ? networkError.message : 'Network print error',
              }));
            }
          }

          if (connectionType === 'windows') {
            try {
              if (!target.printerName || typeof target.printerName !== 'string' || target.printerName.trim() === '') {
                console.error('[PRINT-DAEMON] Missing or invalid printer name for Windows printer');
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({
                  success: false,
                  message: 'Le nom de l\'imprimante est requis pour l\'impression Windows. Configurez l\'imprimante dans les paramètres.',
                }));
              }
              
              console.log('[PRINT-DAEMON] Sending to Windows printer:', target.printerName);
              await sendToWindowsPrinter({
                content,
                printerName: target.printerName.trim(),
                resourcesPath,
              });
              console.log('[PRINT-DAEMON] Windows print successful');
              res.writeHead(200, { 'Content-Type': 'application/json' });
              return res.end(JSON.stringify({ success: true }));
            } catch (winError) {
              console.error('[PRINT-DAEMON] Windows spooler print error:', winError);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              return res.end(JSON.stringify({
                success: false,
                message: winError instanceof Error ? winError.message : 'Windows spooler print error',
              }));
            }
          }

          console.error('[PRINT-DAEMON] Unsupported connectionType:', connectionType);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            success: false,
            message: `Unsupported connectionType: ${connectionType}`,
          }));
        } catch (error) {
          console.error('[PRINT-DAEMON] Error handling /print:', error);
          console.error('[PRINT-DAEMON] Error stack:', error instanceof Error ? error.stack : 'No stack');
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
              success: false,
              message: error instanceof Error ? error.message : 'Unknown error',
              error: error instanceof Error ? error.stack : String(error),
            }));
          }
        }
        return;
      }

      // 404 for other routes
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Not found' }));
    } catch (error) {
      // Catch any unhandled errors in the request handler
      console.error('[PRINT-DAEMON] Unhandled error in request handler:', error);
      console.error('[PRINT-DAEMON] Error stack:', error instanceof Error ? error.stack : 'No stack');
      
      // Only send response if headers haven't been sent
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          message: error instanceof Error ? error.message : 'Internal server error',
          error: error instanceof Error ? error.stack : String(error),
        }));
      }
    }
  });

  return server;
}
