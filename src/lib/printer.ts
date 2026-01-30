// Direct printing utilities without browser dialog
import { ReceiptCustomization } from './database';

export interface PrinterConnection {
  type: 'network' | 'bluetooth' | 'windows';
  name: string;
  address?: string; // IP address for network printers
  port?: number; // Port for network printers (default 9100 for raw printing)
  printerName?: string; // Windows printer name for USB/Windows printing
}

export class DirectPrinter {
  private connection: PrinterConnection | null = null;

  constructor(connection: PrinterConnection) {
    this.connection = connection;
  }
  

  // ESC/POS commands for thermal printers
  private ESC = '\x1B';
  private GS = '\x1D';
  
  private commands = {
    // Initialize printer
    init: () => `${this.ESC}@`,
    // Text alignment
    alignLeft: () => `${this.ESC}a0`,
    alignCenter: () => `${this.ESC}a1`,
    alignRight: () => `${this.ESC}a2`,
    // Font size
    fontSize: (width: number = 1, height: number = 1) => 
      `${this.ESC}!${String.fromCharCode((width - 1) | ((height - 1) << 4))}`,
    // Bold
    boldOn: () => `${this.ESC}E1`,
    boldOff: () => `${this.ESC}E0`,
    // Cut paper - GS V 0 = full cut, GS V 1 = partial cut
    // Use full cut (V0) for better compatibility
    cut: () => `${this.GS}V${String.fromCharCode(0)}`,
    // Alternative: partial cut (if full cut doesn't work)
    cutPartial: () => `${this.GS}V${String.fromCharCode(1)}`,
    // Feed lines
    feed: (lines: number = 1) => `${this.ESC}d${String.fromCharCode(lines)}`,
    // Open drawer
    openDrawer: () => `${this.ESC}p0${String.fromCharCode(25)}${String.fromCharCode(250)}`,
  };

  private formatReceipt(content: string, isThermalPrinter: boolean = true): Uint8Array {
    // Build receipt as string first
    let receiptStr = '';
    
    if (isThermalPrinter) {
      // ESC/POS commands for thermal printers
      // Initialize printer (resets all settings)
      receiptStr += this.commands.init();
      
      // Set encoding to PC437 (most common for ESC/POS, supports basic ASCII)
      // ESC t 0 = PC437
      receiptStr += `${this.ESC}t${String.fromCharCode(0)}`;
      
      // Set left alignment (default)
      receiptStr += this.commands.alignLeft();
      
      // Add content as-is (content already contains proper formatting)
      // Remove leading newlines/whitespace to avoid extra space at top
      const trimmedContent = content.replace(/^\s*\n+/, '');
      receiptStr += trimmedContent;
      
      // Feed lines before cutting (more lines for better compatibility)
      receiptStr += this.commands.feed(5);
      
      // Cut paper (full cut)
      receiptStr += this.commands.cut();
      
      // Extra feed after cut for some printers
      receiptStr += '\n';
    } else {
      // For regular printers (inkjet/laser), send plain text only
      // No ESC/POS commands, just the content
      receiptStr = content;
      
      // Add some line feeds at the end
      receiptStr += '\n\n\n';
    }
    
    // Normalize string: replace non-breaking spaces (U+00A0) and other Unicode spaces with regular ASCII space
    // This fixes issues with thousands separators in currency formatting
    receiptStr = receiptStr.replace(/\u00A0/g, ' '); // Non-breaking space -> space
    receiptStr = receiptStr.replace(/[\u2000-\u200B\u202F\u205F]/g, ' '); // Other Unicode spaces -> space
    
    // Debug: Log what we're sending
    if (process.env.NODE_ENV === 'development') {
      console.log('Sending to printer (first 500 chars):', receiptStr.substring(0, 500));
      console.log('Total length:', receiptStr.length);
      console.log('Is thermal printer:', isThermalPrinter);
    }
    
    // Convert to bytes - use simple ASCII encoding (0-127)
    // For characters > 127, replace with '?' to avoid encoding issues
    const bytes = new Uint8Array(receiptStr.length);
    for (let i = 0; i < receiptStr.length; i++) {
      const charCode = receiptStr.charCodeAt(i);
      if (charCode < 128) {
        bytes[i] = charCode;
      } else {
        // Replace non-ASCII with '?' for safety
        bytes[i] = 63; // '?'
      }
    }
    return bytes;
  }

  // Print via Network (TCP/IP for network printers)
  // Uses PrintDaemon C# API (http://127.0.0.1:9100/print)
  async printViaNetwork(content: string, isThermalPrinter: boolean = true, logoBase64?: string, logoSize?: number): Promise<void> {
    if (!this.connection?.address) {
      throw new Error('Adresse réseau non configurée');
    }

    const port = this.connection.port || 9100;
    const address = this.connection.address;

    // Try WebSocket first if URL starts with ws:// or wss://
    if (address.startsWith('ws://') || address.startsWith('wss://')) {
      return this.printViaWebSocket(content, address, isThermalPrinter);
    }

    // Use PrintDaemon C# API
    // Format: Headers X-Printer-Name (IP:Port) + X-Printer-Type (network) + Body (bytes ESC/POS)
    const daemonUrl = 'http://127.0.0.1:9100/print';
    
    try {
      // Format content as ESC/POS bytes
      const escPosBytes = this.formatReceipt(content, isThermalPrinter);
      
      // Format printer name as "IP:Port" for network printers
      const printerName = `${address}:${port}`;

      console.log('[PRINTER] Sending to PrintDaemon C# via TCP/IP:', { address, port, isThermalPrinter, bytes: escPosBytes.length });

      // Si logo présent, utiliser l'endpoint /print/with-logo avec JSON
      if (logoBase64) {
        // Convertir les bytes Uint8Array en base64 pour le JSON
          const base64Data = uint8ToBase64(escPosBytes);

        
        const jsonBodyWithBase64 = JSON.stringify({
          logo: logoBase64,
          data: base64Data
        });

        const response = await fetch('http://127.0.0.1:9100/print/with-logo', {
          method: 'POST',
          headers: {
            'X-Printer-Name': printerName,
            'X-Printer-Type': 'network',
            'Content-Type': 'application/json',
          },
          body: jsonBodyWithBase64,
        });

        if (!response.ok) {
          const result = await response.json().catch(() => null);
          const errorMsg = result?.error || result?.message || `HTTP ${response.status}`;
          throw new Error(`Erreur PrintDaemon: ${errorMsg}`);
        }

        const result = await response.json();
        if (!result || result.success !== true) {
          throw new Error(result?.error || result?.message || 'Erreur lors de l\'impression');
        }

        console.log('[PRINTER] ✅ Print successful via PrintDaemon C# (with logo)', { bytesWritten: result.bytesWritten });
        return;
      }

      // Sinon, utiliser l'endpoint standard /print
      const response = await fetch(daemonUrl, {
        method: 'POST',
        headers: {
          'X-Printer-Name': printerName,
          'X-Printer-Type': 'network',
          'Content-Type': 'application/octet-stream',
        },
        body: escPosBytes,
      });

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        const errorMsg = result?.error || result?.message || `HTTP ${response.status}`;
        throw new Error(`Erreur PrintDaemon: ${errorMsg}`);
      }

      const result = await response.json();
      if (!result || result.success !== true) {
        throw new Error(result?.error || result?.message || 'Erreur lors de l\'impression');
      }

      console.log('[PRINTER] ✅ Print successful via PrintDaemon C#', { bytesWritten: result.bytesWritten });
    } catch (error) {
      console.error('[PRINTER] Network print error:', error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error(
          'PrintDaemon C# non accessible. Vérifiez qu\'il est démarré (http://127.0.0.1:9100).'
        );
      }
      throw error;
    }
  }

  // Print via WebSocket (for network printers with WebSocket support)
  async printViaWebSocket(content: string, wsUrl: string, isThermalPrinter: boolean = true): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        const data = this.formatReceipt(content, isThermalPrinter);
        // Send as ArrayBuffer for binary data
        ws.binaryType = 'arraybuffer';
        ws.send(data.buffer);
        ws.close();
        resolve();
      };
      
      ws.onerror = (error) => {
        reject(new Error(`Erreur WebSocket: ${error}`));
      };
      
      ws.onclose = () => {
        resolve();
      };
    });
  }

  // Print via Windows (USB/Spooler)
  // Uses PrintDaemon C# API
  async printViaWindows(content: string, isThermalPrinter: boolean = true, logoBase64?: string, logoSize?: number): Promise<void> {
    if (!this.connection?.printerName) {
      throw new Error('Nom d\'imprimante Windows non configuré');
    }

    const daemonUrl = 'http://127.0.0.1:9100/print';
    
    try {
      // Format content as ESC/POS bytes
      const escPosBytes = this.formatReceipt(content, isThermalPrinter);

      console.log('[PRINTER] Sending to PrintDaemon C# via Windows:', { printerName: this.connection.printerName, bytes: escPosBytes.length });

      // Si logo présent, utiliser l'endpoint /print/with-logo avec JSON
      if (logoBase64) {
        const base64Data = uint8ToBase64(escPosBytes);
        const jsonBodyWithBase64 = JSON.stringify({
          logo: logoBase64,
          data: base64Data,
          logoSize: logoSize || 50 // Taille par défaut: 50% (288px)
        });

        const response = await fetch('http://127.0.0.1:9100/print/with-logo', {
          method: 'POST',
          headers: {
            'X-Printer-Name': this.connection.printerName,
            'X-Printer-Type': 'usb',
            'Content-Type': 'application/json',
          },
          body: jsonBodyWithBase64,
        });

        if (!response.ok) {
          const result = await response.json().catch(() => null);
          const errorMsg = result?.error || result?.message || `HTTP ${response.status}`;
          throw new Error(`Erreur PrintDaemon: ${errorMsg}`);
        }

        const result = await response.json();
        if (!result || result.success !== true) {
          throw new Error(result?.error || result?.message || 'Erreur lors de l\'impression');
        }

        console.log('[PRINTER] ✅ Print successful via PrintDaemon C# (Windows, with logo)', { bytesWritten: result.bytesWritten });
        return;
      }

      // Sinon, utiliser l'endpoint standard /print
      const response = await fetch(daemonUrl, {
        method: 'POST',
        headers: {
          'X-Printer-Name': this.connection.printerName,
          'X-Printer-Type': 'usb',
          'Content-Type': 'application/octet-stream',
        },
        body: escPosBytes,
      });

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        const errorMsg = result?.error || result?.message || `HTTP ${response.status}`;
        throw new Error(`Erreur PrintDaemon: ${errorMsg}`);
      }

      const result = await response.json();
      if (!result || result.success !== true) {
        throw new Error(result?.error || result?.message || 'Erreur lors de l\'impression');
      }

      console.log('[PRINTER] ✅ Print successful via PrintDaemon C# (Windows)', { bytesWritten: result.bytesWritten });
    } catch (error) {
      console.error('[PRINTER] Windows print error:', error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error(
          'PrintDaemon C# non accessible. Vérifiez qu\'il est démarré (http://127.0.0.1:9100).'
        );
      }
      throw error;
    }
  }

  /**
   * Ouvre le tiroir caisse (connecté en RJ12 à l'imprimante).
   * Utilise l'endpoint dédié du PrintDaemon POST /open-drawer.
   */
  async openDrawer(): Promise<void> {
    if (!this.connection) {
      throw new Error('Aucune connexion imprimante configurée');
    }
    if (this.connection.type === 'bluetooth') {
      throw new Error('Tiroir caisse non supporté en Bluetooth');
    }

    const daemonUrl = 'http://127.0.0.1:9100/open-drawer';
    let printerName: string;
    let printerType: string;

    if (this.connection.type === 'network') {
      const address = this.connection.address;
      if (!address || address.startsWith('ws://') || address.startsWith('wss://')) {
        throw new Error('Adresse réseau non configurée ou WebSocket (tiroir non supporté)');
      }
      const port = this.connection.port || 9100;
      printerName = `${address}:${port}`;
      printerType = 'network';
    } else {
      if (!this.connection.printerName) {
        throw new Error('Nom d\'imprimante Windows non configuré');
      }
      printerName = this.connection.printerName;
      printerType = 'usb';
    }

    const response = await fetch(daemonUrl, {
      method: 'POST',
      headers: {
        'X-Printer-Name': printerName,
        'X-Printer-Type': printerType,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(
          'PrintDaemon ne propose pas l\'endpoint /open-drawer. Recompilez et redémarrez le PrintDaemon (voir README du dossier PrintDaemon).'
        );
      }
      const result = await response.json().catch(() => null);
      const errorMsg = result?.error || result?.message || `HTTP ${response.status}`;
      throw new Error(`Erreur PrintDaemon: ${errorMsg}`);
    }

    const result = await response.json();
    if (!result || result.success !== true) {
      throw new Error(result?.error || result?.message || 'Erreur ouverture tiroir');
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[PRINTER] ✅ Tiroir caisse ouvert');
    }
  }

  // Main print method - tries different methods
  // isThermalPrinter: true for ESC/POS thermal printers, false for regular printers
  // logoBase64: optional logo image in base64 format (will be printed before content)
  // logoSize: optional logo size in percentage of printer width (default: 50)
  async print(content: string, isThermalPrinter: boolean = true, logoBase64?: string, logoSize?: number): Promise<void> {
    if (!this.connection) {
      throw new Error('Aucune connexion imprimante configurée');
    }

    switch (this.connection.type) {
      case 'network':
        // Try direct network first, fallback to WebSocket if configured
        if (this.connection.address?.startsWith('ws://') || this.connection.address?.startsWith('wss://')) {
          return this.printViaWebSocket(content, this.connection.address, isThermalPrinter);
        }
        return this.printViaNetwork(content, isThermalPrinter, logoBase64, logoSize);
      case 'windows':
        return this.printViaWindows(content, isThermalPrinter, logoBase64, logoSize);
      case 'bluetooth':
        // Bluetooth printing requires Web Bluetooth API
        throw new Error('Impression Bluetooth non encore implémentée');
      default:
        throw new Error(`Type de connexion non supporté: ${this.connection.type}`);
    }
  }

  // ESC/POS raw strings for use in static formatTextReceipt (order number large, centered)
  private static ESC = '\x1B';
  private static escCenter = '\x1Ba1'; // ESC a 1 = center alignment
  private static escLeft = '\x1Ba0'; // ESC a 0 = left alignment
  private static escRight = '\x1Ba2'; // ESC a 2 = right alignment
  // ESC/POS font size command: ESC ! n
  // n = (width-1) | ((height-1) << 4)
  // For double width and height: (2-1) | ((2-1) << 4) = 1 | 16 = 17 = 0x11
  // Use String.fromCharCode to ensure correct byte encoding
  private static escDoubleSize = '\x1B!' + String.fromCharCode(0x11); // Double width + double height
  private static escNormalSize = '\x1B!' + String.fromCharCode(0x00);
  // Bold commands: ESC E n (n=1 for on, n=0 for off)
  private static escBoldOn = '\x1BE' + String.fromCharCode(0x01);
  private static escBoldOff = '\x1BE' + String.fromCharCode(0x00);

  // Get default customization
  static getDefaultCustomization(): ReceiptCustomization {
    return {
      showOrderNumber: true,
      showDate: true,
      showTime: true,
      showOrderType: true,
      showPaymentMethod: true,
      showCashier: true,
      showProducts: true,
      showProductPrices: true,
      showModifiers: true,
      showNotes: true,
      showSubtotal: true,
      showDiscount: true,
      showTotal: true,
      showItemCount: true,
      showAmountReceived: true,
      showChange: true,
      showLogo: true,
      logoSize: 50, // 50% de la largeur de l'imprimante (288px par défaut)
      dateFormat: 'DD/MM/YYYY',
      timeFormat: 'HH:mm',
      headerAlignment: 'center',
      restaurantNameStyle: 'uppercase',
      productNameStyle: 'uppercase',
      separatorStyle: 'dashes',
      separatorChar: '-',
      fontSize: 'normal',
      fontFamily: 'monospace',
      labelOrderNumber: 'COMMANDE No',
      labelDate: 'DATE',
      labelTime: 'HEURE',
      labelOrderType: 'TYPE',
      labelPaymentMethod: 'PAIEMENT',
      labelCashier: 'CAISSIER',
      labelSubtotal: 'SOUS-TOTAL',
      labelDiscount: 'REMISE',
      labelTotal: 'TOTAL',
      labelItemCount: 'ARTICLES',
      showLogo: true,
      labelAmountReceived: 'MONTANT REÇU',
      labelChange: 'MONNAIE',
      labelThankYou: 'MERCI DE VOTRE VISITE !',
      labelKitchenTicket: 'TICKET CUISINE',
      labelBonAppetit: 'Bon appétit !',
      kitchenLabelItemCount: 'ARTICLES',
      kitchenShowItemCount: true,
      kitchenShowOrderNumber: true,
      kitchenShowDate: true,
      kitchenShowTime: true,
      kitchenShowOrderType: true,
      kitchenShowCashier: true,
      kitchenShowProducts: true,
      kitchenShowProductPrices: false,
      kitchenShowModifiers: true,
      kitchenShowNotes: true,
    };
  }

  // Format date according to format string
  static formatDate(date: Date, format: string): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = date.getHours() >= 12 ? 'PM' : 'AM';
    const hours12 = (date.getHours() % 12 || 12).toString().padStart(2, '0');

    return format
      .replace('DD', day)
      .replace('MM', month)
      .replace('YYYY', year.toString())
      .replace('HH', hours)
      .replace('hh', hours12)
      .replace('mm', minutes)
      .replace('A', ampm);
  }

  // Clean text for ESC/POS printer compatibility (remove emojis, special Unicode chars)
  static cleanTextForPrinter(text: string): string {
    if (!text) return '';
    
    // Replace emojis and special characters with ASCII equivalents
    let cleaned = text
      // Normalize spaces FIRST - replace non-breaking spaces and Unicode spaces with regular ASCII space
      // This fixes issues with thousands separators in currency formatting (e.g., "1 000" instead of "1?000")
      .replace(/\u00A0/g, ' ') // Non-breaking space (U+00A0) -> space
      .replace(/[\u2000-\u200B\u202F\u205F]/g, ' ') // Other Unicode spaces -> space
      // Emojis (common ones)
      .replace(/🍽️/g, '[SUR PLACE]')
      .replace(/📦/g, '[A EMPORTER]')
      .replace(/⚠/g, '[!]')
      .replace(/[🚀🎉✅❌⭐💯🔥]/g, '') // Remove other common emojis
      // Common Unicode characters
      .replace(/─/g, '-')
      .replace(/–/g, '-')
      .replace(/—/g, '-')
      .replace(/°/g, 'o')
      .replace(/€/g, 'EUR')
      .replace(/£/g, 'GBP')
      .replace(/…/g, '...');
    
    // Map accented characters to ASCII
    const accentMap: Record<string, string> = {
      'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a',
      'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
      'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i',
      'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o',
      'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u',
      'ý': 'y', 'ÿ': 'y',
      'ç': 'c',
      'ñ': 'n',
      'À': 'A', 'Á': 'A', 'Â': 'A', 'Ã': 'A', 'Ä': 'A', 'Å': 'A',
      'È': 'E', 'É': 'E', 'Ê': 'E', 'Ë': 'E',
      'Ì': 'I', 'Í': 'I', 'Î': 'I', 'Ï': 'I',
      'Ò': 'O', 'Ó': 'O', 'Ô': 'O', 'Õ': 'O', 'Ö': 'O',
      'Ù': 'U', 'Ú': 'U', 'Û': 'U', 'Ü': 'U',
      'Ý': 'Y',
      'Ç': 'C',
      'Ñ': 'N',
    };
    
    // Replace accented characters
    cleaned = cleaned.replace(/[àáâãäåèéêëìíîïòóôõöùúûüýÿçñÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÝÇÑ]/g, (char) => accentMap[char] || char);
    
    // Remove any remaining non-ASCII characters (except basic printable ASCII 32-126)
    cleaned = cleaned.replace(/[^\x20-\x7E\n\r\t]/g, '?');
    
    return cleaned;
  }

  // Apply text style
  static applyTextStyle(text: string, style: 'normal' | 'uppercase' | 'lowercase'): string {
    // Don't clean again if text is already cleaned
    // Just apply the style transformation
    switch (style) {
      case 'uppercase':
        return text.toUpperCase();
      case 'lowercase':
        return text.toLowerCase();
      default:
        return text;
    }
  }

  // Format text content for receipt (professional thermal printer format)
  static formatTextReceipt(data: {
    restaurantName?: string;
    address?: string;
    phone?: string;
    header?: string;
    footer?: string;
    logo?: string; // Base64 image data URL
    orderNumber: string;
    date: string;
    type: string;
    paymentMethod: string;
    cashier?: string;
    lines: Array<{
      quantity: number;
      name: string;
      size?: string;
      modifiers?: string[];
      modifierPrices?: string[]; // Prix par supplément, même ordre que modifiers (ex: "+1,00 €")
      note?: string;
      price?: string;
      unitPrice?: string; // Prix unitaire du produit (sans suppléments)
      unitPriceSubtotal?: string; // Prix unitaire × quantité (pour afficher "5,00 € x 2 = 10,00 €")
    }>;
    subtotal: string;
    discount?: string;
    total: string;
    amountReceived?: string;
    change?: string;
    showPrices: boolean;
    customization?: ReceiptCustomization;
    isKitchenTicket?: boolean;
  }): string {
    const custom = data.customization || this.getDefaultCustomization();
    const isKitchen = data.isKitchenTicket || false;
    const width = 48; // Standard thermal printer width (80mm)
    
    // Helper function to format label-value pairs with label on left and value on right
    // Similar to the preview which uses flex justify-between
    // Calculates spaces to justify the value to the right edge of the printer
    const formatLabelValue = (label: string, value: string): string => {
      const cleanedLabel = this.cleanTextForPrinter(label);
      const cleanedValue = this.cleanTextForPrinter(value);
      const labelWithColon = `${cleanedLabel}:`;
      
      // Calculate spaces needed to justify value to the right
      // Total width - label length - value length = spaces needed
      const totalLength = labelWithColon.length + cleanedValue.length;
      const spacesNeeded = Math.max(1, width - totalLength);
      
      // If label is too long, just add one space
      if (labelWithColon.length >= width - cleanedValue.length) {
        return `${labelWithColon} ${cleanedValue}\n`;
      }
      
      return `${labelWithColon}${' '.repeat(spacesNeeded)}${cleanedValue}\n`;
    };
    
    // Use simple dash for separator to avoid encoding issues
    const separatorChar = custom.separatorStyle === 'none' ? ' ' : 
                         custom.separatorChar === '─' ? '-' : 
                         custom.separatorChar || '-';
    const separator = separatorChar.repeat(width);
    
    // Use kitchen-specific display options if it's a kitchen ticket
    const showOrderNumber = isKitchen ? custom.kitchenShowOrderNumber : custom.showOrderNumber;
    const showDate = isKitchen ? custom.kitchenShowDate : custom.showDate;
    const showTime = isKitchen ? custom.kitchenShowTime : custom.showTime;
    const showOrderType = isKitchen ? custom.kitchenShowOrderType : custom.showOrderType;
    const showCashier = isKitchen ? custom.kitchenShowCashier : custom.showCashier;
    const showProducts = isKitchen ? custom.kitchenShowProducts : custom.showProducts;
    const showProductPrices = isKitchen ? (custom.kitchenShowProductPrices && data.showPrices) : (custom.showProductPrices && data.showPrices);
    const showModifiers = isKitchen ? custom.kitchenShowModifiers : custom.showModifiers;
    const showNotes = isKitchen ? custom.kitchenShowNotes : custom.showNotes;
    
    let receipt = '';
    const bigOrderNumberBlock = () => {
      if (!showOrderNumber) return;
      const num = this.cleanTextForPrinter(data.orderNumber);
      // Build the order number block with proper ESC/POS commands
      // Use explicit byte values to ensure correct encoding
      // ESC a 1 = center alignment
      receipt += '\x1B\x61\x01';
      // ESC E 1 = bold on
      receipt += '\x1B\x45\x01';
      // ESC ! n where n = (width-1) | ((height-1) << 4)
      // For double width + double height: (2-1) | ((2-1) << 4) = 1 | 16 = 17 = 0x11
      // Some printers may need: 0x22 (double width only) or 0x30 (alternative)
      // Try 0x11 first (standard double width + double height)
      // If 0x11 doesn't work, try 0x22 (double width) or 0x30 (some printers)
      receipt += '\x1D\x21\x11'; // GS ! 0x11  (2x width + 2x height)
        // Alternative if above doesn't work: '\x1B\x21\x22' (double width only) or '\x1B\x21\x30'
      receipt += num; // Order number
      receipt += '\n'; // Newline
      // Reset: Normal size, bold off, left align
      receipt += '\x1B\x21\x00'; // ESC ! 0x00 = normal size
      receipt += '\x1B\x45\x00'; // ESC E 0x00 = bold off
      // Pour le ticket cuisine, ajouter le type de commande juste en dessous du numéro
      if (isKitchen && showOrderType && data.type) {
        const orderTypeText = data.type === 'dine-in' ? 'SUR PLACE' : 'A EMPORTER';
        const cleanedType = this.cleanTextForPrinter(orderTypeText);
        receipt += '\n'; // Retour à la ligne pour le type
        receipt += '\x1B\x61\x01'; // ESC a 1 = center alignment
        receipt += '\x1B\x45\x01'; // ESC E 1 = bold on
        receipt += '\x1B\x21\x10'; // ESC ! 0x10 = double height
        receipt += cleanedType;
        receipt += '\x1B\x21\x00'; // ESC ! 0x00 = normal size
        receipt += '\n'; // Retour à la ligne après le type
        receipt += '\x1B\x45\x00'; // ESC E 0x00 = bold off
      }
      receipt += '\x1B\x61\x00'; // ESC a 0x00 = left align
      if (custom.separatorStyle !== 'none') receipt += '\n' + separator;
      receipt += '\n';
    };
    
    // Ne pas ajouter de retour à la ligne au début - le contenu commence directement
    if (isKitchen) {
      // Kitchen: TICKET CUISINE → #XXX large, centered
      // Use ESC/POS alignment command based on headerAlignment (same as receipt)
      const cleanedTitle = this.cleanTextForPrinter(custom.labelKitchenTicket);
      const title = this.applyTextStyle(cleanedTitle, 'normal');
      if (custom.headerAlignment === 'center') {
        receipt += DirectPrinter.escCenter + title + '\n' + DirectPrinter.escLeft;
      } else if (custom.headerAlignment === 'right') {
        receipt += DirectPrinter.escRight + title + '\n' + DirectPrinter.escLeft;
      } else {
        receipt += title + '\n';
      }
      if (custom.separatorStyle !== 'none') receipt += '\n' + separator;
      receipt += '\n'; // Retour à la ligne après la séparation
      receipt += '\n'; // Retour à la ligne supplémentaire avant le numéro de commande
      bigOrderNumberBlock();
    } else {
      // Receipt: restaurant, address, phone, Bienvenue (header) → #XXX large, centered
      // Logo (si présent) - doit être converti en bitmap ESC/POS
      // Note: La conversion d'image base64 en bitmap monochrome ESC/POS nécessite l'API Canvas
      // Pour l'instant, le logo n'est pas imprimé car la conversion nécessite une fonction asynchrone
      // et formatTextReceipt est synchrone. Le logo peut être géré par le daemon C# si nécessaire.
      // TODO: Implémenter la conversion d'image ou déléguer au daemon C#
      if (data.restaurantName) {
        // Use ESC/POS alignment commands (like order number) instead of manual spacing
        const cleanedName = this.cleanTextForPrinter(data.restaurantName);
        const name = this.applyTextStyle(cleanedName, custom.restaurantNameStyle);
        // Grossir le nom du restaurant (comme dans l'aperçu : text-lg = plus grand)
        receipt += '\x1B\x45\x01'; // ESC E 1 = bold on
        receipt += '\x1B\x21\x10'; // ESC ! 0x10 = double height
        if (custom.headerAlignment === 'center') {
          receipt += DirectPrinter.escCenter + name + '\n' + DirectPrinter.escLeft;
        } else if (custom.headerAlignment === 'right') {
          receipt += DirectPrinter.escRight + name + '\n' + DirectPrinter.escLeft;
        } else {
          receipt += name + '\n';
        }
        // Reset: normal size, bold off
        receipt += '\x1B\x21\x00'; // ESC ! 0x00 = normal size
        receipt += '\x1B\x45\x00'; // ESC E 0x00 = bold off
        // Pas de séparateur après le nom du restaurant (comme dans l'aperçu)
        receipt += '\n';
      }
      if (data.address) {
        // Use ESC/POS alignment command based on headerAlignment (same as restaurant name)
        const cleanedAddress = this.cleanTextForPrinter(data.address);
        if (custom.headerAlignment === 'center') {
          receipt += DirectPrinter.escCenter + cleanedAddress + '\n' + DirectPrinter.escLeft;
        } else if (custom.headerAlignment === 'right') {
          receipt += DirectPrinter.escRight + cleanedAddress + '\n' + DirectPrinter.escLeft;
        } else {
          receipt += cleanedAddress + '\n';
        }
      }
      if (data.phone) {
        // Use ESC/POS alignment command based on headerAlignment (same as restaurant name)
        const cleanedPhone = this.cleanTextForPrinter(data.phone);
        if (custom.headerAlignment === 'center') {
          receipt += DirectPrinter.escCenter + cleanedPhone + '\n' + DirectPrinter.escLeft;
        } else if (custom.headerAlignment === 'right') {
          receipt += DirectPrinter.escRight + cleanedPhone + '\n' + DirectPrinter.escLeft;
        } else {
          receipt += cleanedPhone + '\n';
        }
      }
      // Pas de séparation entre address/phone et header (bienvenue)
      // if (data.address || data.phone) receipt += separator + '\n';
      if (data.header) {
        // Retour à la ligne pour aérer avant "bienvenue"
        receipt += '\n';
        // Use ESC/POS alignment command based on headerAlignment (same as restaurant name)
        const headerLines = data.header.split('\n');
        headerLines.forEach(line => {
          const cleanedLine = this.cleanTextForPrinter(line);
          if (custom.headerAlignment === 'center') {
            receipt += DirectPrinter.escCenter + cleanedLine + '\n' + DirectPrinter.escLeft;
          } else if (custom.headerAlignment === 'right') {
            receipt += DirectPrinter.escRight + cleanedLine + '\n' + DirectPrinter.escLeft;
          } else {
            receipt += cleanedLine + '\n';
          }
        });
        // Séparation entre le bloc "bienvenue" et le numéro de commande
        if (custom.separatorStyle !== 'none') receipt += '\n' + separator;
        receipt += '\n'; // Retour à la ligne après la séparation
        receipt += '\n'; // Retour à la ligne supplémentaire avant le numéro de commande
      }
      bigOrderNumberBlock();
    }
    
    // Order info - Conditional display (no order number here)
    // Pour le ticket cuisine, le type de commande est déjà affiché sous le numéro de commande
    receipt += '\n';
    if (showDate) {
      receipt += formatLabelValue(custom.labelDate, data.date.split(' ')[0]);
    }
    if (showTime && data.date.includes(' ')) {
      const timePart = data.date.split(' ')[1];
      if (timePart) {
        receipt += formatLabelValue(custom.labelTime, timePart);
      }
    }
    // Ne pas afficher le type de commande dans la section INFOS pour le ticket cuisine (déjà affiché sous le numéro)
    if (showOrderType && !isKitchen) {
      receipt += formatLabelValue(custom.labelOrderType, data.type);
    }
    if (!isKitchen && custom.showPaymentMethod) {
      receipt += formatLabelValue(custom.labelPaymentMethod, data.paymentMethod);
    }
    if (showCashier && data.cashier) {
      receipt += formatLabelValue(custom.labelCashier, data.cashier);
    }
    // Afficher le nombre d'articles dans la section INFOS
    const totalItemCount = data.lines.reduce((sum, line) => sum + line.quantity, 0);
    if (isKitchen && custom.kitchenShowItemCount && totalItemCount > 0) {
      // Utiliser le libellé personnalisé pour le ticket cuisine
      receipt += formatLabelValue(custom.kitchenLabelItemCount || custom.labelItemCount, String(totalItemCount));
    } else if (!isKitchen && custom.showItemCount && totalItemCount > 0) {
      // Utiliser le libellé standard pour le reçu client
      receipt += formatLabelValue(custom.labelItemCount, String(totalItemCount));
    }
    if (custom.separatorStyle !== 'none') {
      receipt += separator + '\n';
    }
    receipt += '\n';
    
    // Debug: Log receipt content (first 500 chars)
    if (process.env.NODE_ENV === 'development') {
      console.log('Receipt content (first 500 chars):', receipt.substring(0, 500));
      console.log('Receipt total length:', receipt.length);
      console.log('Number of lines:', data.lines.length);
    }
    
    // Order lines - Conditional display
    if (showProducts && data.lines.length > 0) {
      data.lines.forEach((line, index) => {
        const productName = this.applyTextStyle(this.cleanTextForPrinter(line.name), custom.productNameStyle);
        const qtyName = `${line.quantity}x ${productName}`;
        receipt += qtyName + '\n';
        
        if (showModifiers && line.size) {
          receipt += `   Variante: ${this.cleanTextForPrinter(line.size)}\n`;
        }
        
        if (showModifiers && line.modifiers && line.modifiers.length > 0) {
          line.modifiers.forEach((mod, modIdx) => {
            const modPrice = line.modifierPrices && line.modifierPrices[modIdx];
            receipt += `   + (S) ${this.cleanTextForPrinter(mod)}${showProductPrices && modPrice ? ' ' + modPrice : ''}\n`;
          });
        }
        
        if (showNotes && line.note) {
          receipt += `   NOTE: ${this.cleanTextForPrinter(line.note)}\n`;
        }
        
        if (showProductPrices) {
          if (line.unitPrice) {
            const unitLabel = 'Prix unit.:';
            const unitValue = line.quantity > 1 && line.unitPriceSubtotal
              ? `${line.unitPrice} x ${line.quantity} = ${line.unitPriceSubtotal}`
              : line.quantity > 1
                ? `${line.unitPrice} x ${line.quantity}`
                : line.unitPrice;
            const unitPadding = Math.max(1, width - unitLabel.length - this.cleanTextForPrinter(unitValue).length);
            receipt += unitLabel + ' '.repeat(unitPadding) + unitValue + '\n';
          }
          if (line.price) {
            const priceText = this.cleanTextForPrinter(line.price);
            const padding = Math.max(0, width - priceText.length);
            receipt += ' '.repeat(padding) + priceText + '\n';
          }
        }
        
        if (index < data.lines.length - 1 && custom.separatorStyle !== 'none') {
          receipt += '   ' + separatorChar.repeat(Math.max(0, width - 6)) + '\n';
        }
      });
      
      receipt += '\n';
      if (custom.separatorStyle !== 'none') {
        receipt += separator + '\n';
      }
    }
    
    // Totals section - Professional format (only for receipts, not kitchen tickets)
    if (!isKitchen) {
      receipt += '\n';
      const subtotalLabel = this.cleanTextForPrinter(custom.labelSubtotal);
      const subtotalValue = this.cleanTextForPrinter(data.subtotal);
      const subtotalPadding = Math.max(0, width - subtotalLabel.length - subtotalValue.length);
      receipt += subtotalLabel + ' '.repeat(subtotalPadding) + subtotalValue + '\n';
      if (data.discount) {
        const discountLabel = this.cleanTextForPrinter(custom.labelDiscount);
        const discountValue = this.cleanTextForPrinter(data.discount);
        const discountPadding = Math.max(0, width - discountLabel.length - discountValue.length - 1);
        receipt += discountLabel + ' '.repeat(discountPadding) + '-' + discountValue + '\n';
      }
      receipt += separator + '\n';
      const totalLabel = this.cleanTextForPrinter(custom.labelTotal);
      const totalValue = this.cleanTextForPrinter(data.total);
      const totalPadding = Math.max(0, width - totalLabel.length - totalValue.length);
      receipt += totalLabel + ' '.repeat(totalPadding) + totalValue + '\n';
      receipt += separator + '\n';
      
      // Payment details
      if (data.amountReceived && data.change) {
        receipt += '\n';
        const amountLabel = this.cleanTextForPrinter(custom.labelAmountReceived);
        const amountValue = this.cleanTextForPrinter(data.amountReceived);
        const amountPadding = Math.max(0, width - amountLabel.length - amountValue.length);
        receipt += amountLabel + ' '.repeat(amountPadding) + amountValue + '\n';
        const changeLabel = this.cleanTextForPrinter(custom.labelChange);
        const changeValue = this.cleanTextForPrinter(data.change);
        const changePadding = Math.max(0, width - changeLabel.length - changeValue.length);
        receipt += changeLabel + ' '.repeat(changePadding) + changeValue + '\n';
        receipt += separator + '\n';
      }
    }
    
    receipt += '\n';
    
    // Footer (only for receipts, not kitchen tickets)
    if (!isKitchen && data.footer) {
      const footerLines = data.footer.split('\n');
      footerLines.forEach(line => {
        const cleanedLine = this.cleanTextForPrinter(line);
        const padding = Math.max(0, Math.floor((width - cleanedLine.length) / 2));
        receipt += ' '.repeat(padding) + cleanedLine + '\n';
      });
      receipt += separator + '\n';
    }
    
    // Closing message
    receipt += '\n';
    if (isKitchen) {
      // Kitchen ticket closing message - use ESC/POS alignment based on headerAlignment
      const bonAppetitMsg = this.cleanTextForPrinter(custom.labelBonAppetit);
      if (custom.headerAlignment === 'center') {
        receipt += DirectPrinter.escCenter + bonAppetitMsg + '\n' + DirectPrinter.escLeft;
      } else if (custom.headerAlignment === 'right') {
        receipt += DirectPrinter.escRight + bonAppetitMsg + '\n' + DirectPrinter.escLeft;
      } else {
        receipt += bonAppetitMsg + '\n';
      }
      receipt += '\n';
    } else {
      // Receipt closing message - use ESC/POS alignment based on headerAlignment
      const thankYouMsg = this.cleanTextForPrinter(custom.labelThankYou);
      if (custom.headerAlignment === 'center') {
        receipt += DirectPrinter.escCenter + thankYouMsg + '\n' + DirectPrinter.escLeft;
      } else if (custom.headerAlignment === 'right') {
        receipt += DirectPrinter.escRight + thankYouMsg + '\n' + DirectPrinter.escLeft;
      } else {
        receipt += thankYouMsg + '\n';
      }
      receipt += '\n';
    }
    
    return receipt;
  }
}

// Utility function to detect available printing methods
export async function detectPrintCapabilities(): Promise<{
  network: boolean;
  bluetooth: boolean;
}> {
  return {
    network: true, // Always available via fetch/WebSocket
    bluetooth: !!navigator.bluetooth,
  };
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000; // 32 KB
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}
