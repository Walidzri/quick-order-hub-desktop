// Simple local print-daemon for Quick Order Hub
// v0.1 - supports network (TCP) printers; USB/Windows hooks à venir

const http = require('http');
const { Socket } = require('net');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

// USB printing removed - not supported

// Optional Windows spooler printing via "printer" module
let windowsSpoolerAvailable = false;
let windowsPrinter = null;
try {
  // Optional: run `npm install printer` (ou un fork compatible) pour activer
  windowsPrinter = require('printer');
  windowsSpoolerAvailable = true;
  console.log('[PRINT-DAEMON] printer module detected, Windows spooler printing enabled.');
} catch (e) {
  console.warn('[PRINT-DAEMON] printer module not available, Windows spooler printing disabled.');
}

const PORT = process.env.PRINT_DAEMON_PORT ? Number(process.env.PRINT_DAEMON_PORT) : 9100;
const HOST = '127.0.0.1';

/**
 * Helper: send ESC/POS content over raw TCP to a network printer
 * payload = { host, port, content, isThermal }
 */
function sendToNetworkPrinter(payload) {
  const { host, port = 9100, content, isThermal = true } = payload;

  return new Promise((resolve, reject) => {
    const client = new Socket();
    let hasEnded = false;

    client.connect(port, host, () => {
      try {
        let buffer;

        if (isThermal) {
          const ESC = '\x1B';
          const GS = '\x1D';

          const init = Buffer.from(ESC + '@', 'latin1');
          const encoding = Buffer.from(ESC + 't' + String.fromCharCode(0), 'latin1');
          const alignLeft = Buffer.from(ESC + 'a' + String.fromCharCode(0), 'latin1');

          // Normaliser le contenu de la même manière que pour Windows
          let normalizedContent = content.replace(/\u00A0/g, ' ');
          normalizedContent = normalizedContent.replace(/[\u2000-\u200B\u202F\u205F]/g, ' ');
          // Retirer les espaces et sauts de ligne en fin de contenu
          normalizedContent = normalizedContent.replace(/[\s\n\r]+$/, '');
          // Retirer les espaces en début de contenu
          normalizedContent = normalizedContent.replace(/^[\s\n\r]+/, '');
          // Remplacer les séquences de retours à la ligne multiples par un seul
          normalizedContent = normalizedContent.replace(/\r\n/g, '\n'); // Normaliser CRLF en LF
          normalizedContent = normalizedContent.replace(/\r/g, '\n'); // Normaliser CR en LF
          // Remplacer les séquences de plusieurs sauts de ligne consécutifs par un seul (max 2 pour les séparateurs)
          normalizedContent = normalizedContent.replace(/\n{4,}/g, '\n\n\n'); // Max 3 sauts de ligne consécutifs
          
          const contentBuffer = Buffer.from(normalizedContent, 'latin1');

          const feed = Buffer.from(ESC + 'd' + String.fromCharCode(5), 'latin1');
          const cut = Buffer.from(GS + 'V' + String.fromCharCode(0), 'latin1');

          buffer = Buffer.concat([init, encoding, alignLeft, contentBuffer, feed, cut]);
        } else {
          buffer = Buffer.from(content, 'utf8');
        }

        client.write(buffer, (err) => {
          if (err && !hasEnded) {
            hasEnded = true;
            client.destroy();
            return reject(err);
          }

          if (!hasEnded) {
            hasEnded = true;
            setTimeout(() => {
              client.destroy();
            }, 100);
            resolve({ success: true });
          }
        });
      } catch (e) {
        if (!hasEnded) {
          hasEnded = true;
          client.destroy();
          reject(e);
        }
      }
    });

    client.on('error', (err) => {
      if (!hasEnded) {
        hasEnded = true;
        client.destroy();
        reject(err);
      }
    });

    client.setTimeout(5000, () => {
      if (!hasEnded) {
        hasEnded = true;
        client.destroy();
        reject(new Error('Connection timeout to printer'));
      }
    });
  });
}

/**
 * Helper: send ESC/POS content via Windows spooler using external C# helper
 * payload = { content, printerName?, helperPath? }
 */
function sendToWindowsPrinter(payload) {
  const { content, printerName, helperPath } = payload;

  // Générer un fichier temporaire avec le contenu ESC/POS brut
  const tmpDir = os.tmpdir();
  const fileName = `qoh-print-${Date.now()}-${Math.random().toString(16).slice(2)}.bin`;
  const filePath = path.join(tmpDir, fileName);

  // Construire un buffer ESC/POS complet (init + contenu + feed + cut)
  const ESC = '\x1B';
  const GS = '\x1D';

  // Normaliser le contenu : remplacer les espaces Unicode et nettoyer les espaces/retours à la ligne en trop
  let normalizedContent = content.replace(/\u00A0/g, ' ');
  normalizedContent = normalizedContent.replace(/[\u2000-\u200B\u202F\u205F]/g, ' ');
  // Retirer les espaces et sauts de ligne en fin de contenu
  normalizedContent = normalizedContent.replace(/[\s\n\r]+$/, '');
  // Retirer les espaces en début de contenu
  normalizedContent = normalizedContent.replace(/^[\s\n\r]+/, '');
  // Remplacer les séquences de retours à la ligne multiples par un seul
  normalizedContent = normalizedContent.replace(/\r\n/g, '\n'); // Normaliser CRLF en LF
  normalizedContent = normalizedContent.replace(/\r/g, '\n'); // Normaliser CR en LF
  // Remplacer les séquences de plusieurs sauts de ligne consécutifs par un seul (max 2 pour les séparateurs)
  normalizedContent = normalizedContent.replace(/\n{4,}/g, '\n\n\n'); // Max 3 sauts de ligne consécutifs

  const init = Buffer.from(ESC + '@', 'latin1');
  const encoding = Buffer.from(ESC + 't' + String.fromCharCode(0), 'latin1');
  const alignLeft = Buffer.from(ESC + 'a' + String.fromCharCode(0), 'latin1');
  const contentBuffer = Buffer.from(normalizedContent, 'latin1');
  // On alimente un peu avant la coupe
  const feed = Buffer.from(ESC + 'd' + String.fromCharCode(5), 'latin1');
  // Pour Epson TM-T20II via spooler Windows, la séquence qui fonctionne est GS V 66 0
  // (coupe complète, mode B). On ne garde que celle-là pour éviter les coupes multiples.
  const cut = Buffer.from([0x1D, 0x56, 0x42, 0x00]);

  // Ne pas ajouter de feed supplémentaire après la coupure pour éviter les coupures multiples
  const buffer = Buffer.concat([init, encoding, alignLeft, contentBuffer, feed, cut]);

  // On écrit le buffer binaire dans le fichier temporaire
  fs.writeFileSync(filePath, buffer);

  // Chemin par défaut du helper C# compilé
  // En production (Electron), utiliser process.resourcesPath
  // En développement, utiliser __dirname
  let exePath;
  if (helperPath) {
    exePath = helperPath;
  } else if (process.resourcesPath) {
    // Mode production Electron - fichiers dans resources/
    exePath = path.join(process.resourcesPath, 'print-daemon', 'RawPrinterHelper', 'RawPrinterHelper.exe');
  } else {
    // Mode développement - fichiers dans __dirname
    exePath = path.join(__dirname, 'RawPrinterHelper', 'RawPrinterHelper.exe');
  }

  return new Promise((resolve, reject) => {
    const args = [];
    if (printerName) {
      args.push('-p', printerName);
    }
    args.push('-f', filePath);

    console.log('[PRINT-DAEMON] Calling RawPrinterHelper:', exePath, args.join(' '));

    const child = spawn(exePath, args, { windowsHide: true });

    let stderr = '';
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('exit', (code) => {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // ignore
      }

      if (code === 0) {
        resolve({ success: true });
      } else {
        reject(new Error(`RawPrinterHelper exited with code ${code}. ${stderr}`));
      }
    });

    child.on('error', (err) => {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // ignore
      }
      reject(err);
    });
  });
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk.toString();
      if (data.length > 1_000_000) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        const json = data ? JSON.parse(data) : {};
        resolve(json);
      } catch (e) {
        reject(e);
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status: 'ok',
      message: 'Print daemon running',
      version: '0.1.0',
    }));
  }

  if (req.url === '/print' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const { connectionType, target, content, isThermalPrinter = true, role } = body || {};

      if (!content || typeof content !== 'string') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, message: 'Missing content' }));
      }

      if (!connectionType || !target) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, message: 'Missing connectionType or target' }));
      }

      console.log('[PRINT-DAEMON] New job:', {
        role,
        connectionType,
        target,
        length: content.length,
        isThermalPrinter,
      });

      if (connectionType === 'tcp' || connectionType === 'ethernet' || connectionType === 'wifi') {
        if (!target.host) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, message: 'Missing target.host for network printer' }));
        }
        await sendToNetworkPrinter({
          host: target.host,
          port: target.port || 9100,
          content,
          isThermal: isThermalPrinter !== false,
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true }));
      }

      if (connectionType === 'windows') {
        try {
          await sendToWindowsPrinter({
            content,
            isThermal: isThermalPrinter !== false,
            printerName: target.printerName,
          });
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

      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        message: `Unsupported connectionType: ${connectionType}`,
      }));
    } catch (error) {
      console.error('[PRINT-DAEMON] Error handling /print:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: false, message: 'Not found' }));
});

server.listen(PORT, HOST, () => {
  console.log(`[PRINT-DAEMON] Listening on http://${HOST}:${PORT}`);
});

