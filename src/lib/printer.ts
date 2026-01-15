// Direct printing utilities without browser dialog
import { ReceiptCustomization } from './database';

export interface PrinterConnection {
  type: 'usb' | 'network' | 'bluetooth';
  name: string;
  address?: string; // IP address for network printers
  port?: number; // Port for network printers (default 9100 for raw printing)
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
    // Cut paper
    cut: () => `${this.GS}V0`,
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
      receiptStr += content;
      
      // Feed lines before cutting
      receiptStr += this.commands.feed(3);
      
      // Cut paper
      receiptStr += this.commands.cut();
    } else {
      // For regular printers (inkjet/laser), send plain text only
      // No ESC/POS commands, just the content
      receiptStr = content;
      
      // Add some line feeds at the end
      receiptStr += '\n\n\n';
    }
    
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

  // Print via Web USB (for USB printers)
  async printViaUSB(content: string, isThermalPrinter: boolean = true): Promise<void> {
    if (!navigator.usb) {
      throw new Error('Web USB API is not available. Please use HTTPS or localhost.');
    }

    try {
      // Request USB device
      const device = await navigator.usb.requestDevice({
        filters: [
          { classCode: 7 }, // Printer class
        ],
      });

      await device.open();
      await device.selectConfiguration(1);
      await device.claimInterface(0);

      // Format and send data
      const data = this.formatReceipt(content, isThermalPrinter);
      
      // Send data to printer
      await device.transferOut(1, data);

      await device.releaseInterface(0);
      await device.close();
    } catch (error) {
      console.error('USB print error:', error);
      throw new Error(`Erreur d'impression USB: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  }

  // Print via Network (TCP/IP for network printers)
  // In Electron, we can use the Electron API for direct printing
  async printViaNetwork(content: string, isThermalPrinter: boolean = true): Promise<void> {
    if (!this.connection?.address) {
      throw new Error('Adresse réseau non configurée');
    }

    const port = this.connection.port || 9100;
    const address = this.connection.address;

    // Try WebSocket first if URL starts with ws:// or wss://
    if (address.startsWith('ws://') || address.startsWith('wss://')) {
      return this.printViaWebSocket(content, address, isThermalPrinter);
    }

    // In Electron, use the Electron API for direct printing
    if (typeof window !== 'undefined' && window.electronAPI) {
      try {
        const result = await window.electronAPI.printDirect(
          content,
          address,
          port,
          isThermalPrinter
        );
        if (!result.success) {
          throw new Error('Erreur lors de l\'impression');
        }
        return;
      } catch (error) {
        console.error('Electron print error:', error);
        throw error;
      }
    }

    // Fallback to backend print server (for web version)
    try {
      const printServerUrl = import.meta.env.VITE_PRINT_SERVER_URL || 'http://localhost:3001';
      const proxyUrl = `${printServerUrl}/print`;
      
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          printer: {
            address,
            port,
          },
          data: Array.from(this.formatReceipt(content, isThermalPrinter)),
          isThermalPrinter,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Erreur inconnue' }));
        throw new Error(errorData.message || `Erreur du serveur d'impression: ${response.status}`);
      }

      const result = await response.json();
      console.log('Print success:', result);
    } catch (error) {
      console.error('Network print error:', error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error(
          `Serveur d'impression non accessible. Assurez-vous que le serveur d'impression est démarré sur ${printServerUrl}`
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

  // Main print method - tries different methods
  // isThermalPrinter: true for ESC/POS thermal printers, false for regular printers
  async print(content: string, isThermalPrinter: boolean = true): Promise<void> {
    if (!this.connection) {
      throw new Error('Aucune connexion imprimante configurée');
    }

    switch (this.connection.type) {
      case 'usb':
        return this.printViaUSB(content, isThermalPrinter);
      case 'network':
        // Try direct network first, fallback to WebSocket if configured
        if (this.connection.address?.startsWith('ws://') || this.connection.address?.startsWith('wss://')) {
          return this.printViaWebSocket(content, this.connection.address, isThermalPrinter);
        }
        return this.printViaNetwork(content, isThermalPrinter);
      case 'bluetooth':
        // Bluetooth printing requires Web Bluetooth API
        throw new Error('Impression Bluetooth non encore implémentée');
      default:
        throw new Error(`Type de connexion non supporté: ${this.connection.type}`);
    }
  }

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
      showAmountReceived: true,
      showChange: true,
      orderNumberFormat: '{prefix}{number}',
      orderNumberPadding: 6,
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
      labelAmountReceived: 'MONTANT REÇU',
      labelChange: 'MONNAIE',
      labelThankYou: 'MERCI DE VOTRE VISITE !',
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

  // Format order number according to template
  // The orderNumber stored in DB may already be formatted according to numbering strategy:
  // - daily: "20240101-001" (YYYYMMDD-NNN) - keep original format as-is
  // - prefixed: "CMD-0001" (PREFIX-NNNN) - apply customization format
  // - continuous: "000001" (NNNNNN) - apply customization format
  // We need to detect the format and apply the customization format accordingly
  static formatOrderNumber(orderNumber: string, prefix: string, customization: ReceiptCustomization): string {
    // Detect if it's a daily format (8 digits-date followed by dash and number)
    const dailyMatch = orderNumber.match(/^(\d{8})-(\d+)$/);
    if (dailyMatch) {
      // Daily format: keep the original format exactly as stored (same as in order history)
      // Don't apply customization padding, just return the original format
      return orderNumber;
    }
    
    // Detect if it's a prefixed format (letters/prefix followed by dash and number)
    const prefixedMatch = orderNumber.match(/^([A-Za-z]+)-(\d+)$/);
    if (prefixedMatch) {
      // Prefixed format: extract number and apply customization format with prefix
      const numPart = prefixedMatch[2];
      const actualNumber = parseInt(numPart, 10) || 0;
      const padded = actualNumber.toString().padStart(customization.orderNumberPadding, '0');
      
      return customization.orderNumberFormat
        .replace('{prefix}', prefix)
        .replace('{number}', padded);
    }
    
    // Continuous format: just numbers, apply customization format
    const digitsOnly = orderNumber.replace(/\D/g, '');
    if (digitsOnly) {
      const actualNumber = parseInt(digitsOnly, 10) || 0;
      const padded = actualNumber.toString().padStart(customization.orderNumberPadding, '0');
      
      // For continuous, use prefix only if format includes it
      if (customization.orderNumberFormat.includes('{prefix}')) {
        return customization.orderNumberFormat
          .replace('{prefix}', prefix)
          .replace('{number}', padded);
      } else {
        return customization.orderNumberFormat
          .replace('{number}', padded);
      }
    }
    
    // Fallback: try to extract any number and format it
    const match = orderNumber.match(/(\d+)$/);
    if (match) {
      const actualNumber = parseInt(match[1], 10) || 0;
      const padded = actualNumber.toString().padStart(customization.orderNumberPadding, '0');
      return customization.orderNumberFormat
        .replace('{prefix}', prefix)
        .replace('{number}', padded);
    }
    
    // Last resort: return as-is
    return orderNumber;
  }

  // Clean text for ESC/POS printer compatibility (remove emojis, special Unicode chars)
  static cleanTextForPrinter(text: string): string {
    if (!text) return '';
    
    // Replace emojis and special characters with ASCII equivalents
    let cleaned = text
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
    let cleaned = this.cleanTextForPrinter(text);
    switch (style) {
      case 'uppercase':
        return cleaned.toUpperCase();
      case 'lowercase':
        return cleaned.toLowerCase();
      default:
        return cleaned;
    }
  }

  // Format text content for receipt (professional thermal printer format)
  static formatTextReceipt(data: {
    restaurantName?: string;
    address?: string;
    phone?: string;
    header?: string;
    footer?: string;
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
      note?: string;
      price?: string;
    }>;
    subtotal: string;
    discount?: string;
    total: string;
    amountReceived?: string;
    change?: string;
    showPrices: boolean;
    customization?: ReceiptCustomization;
    numberingPrefix?: string;
    isKitchenTicket?: boolean;
  }): string {
    const custom = data.customization || this.getDefaultCustomization();
    const prefix = data.numberingPrefix || '';
    const isKitchen = data.isKitchenTicket || false;
    const width = 32; // Standard thermal printer width (58mm)
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
    
    // Header with customizable alignment
    receipt += '\n';
    if (data.restaurantName) {
      const name = this.applyTextStyle(data.restaurantName, custom.restaurantNameStyle);
      // Simple center alignment calculation
      const padding = Math.max(0, Math.floor((width - name.length) / 2));
      if (custom.headerAlignment === 'center') {
        receipt += ' '.repeat(padding) + name + '\n';
      } else if (custom.headerAlignment === 'right') {
        receipt += ' '.repeat(Math.max(0, width - name.length)) + name + '\n';
      } else {
        receipt += name + '\n';
      }
      if (custom.separatorStyle !== 'none') {
        receipt += separator + '\n';
      }
    }
    if (data.address) {
      const cleanedAddress = this.cleanTextForPrinter(data.address);
      const padding = Math.max(0, Math.floor((width - cleanedAddress.length) / 2));
      receipt += ' '.repeat(padding) + cleanedAddress + '\n';
    }
    if (data.phone) {
      const cleanedPhone = this.cleanTextForPrinter(data.phone);
      const padding = Math.max(0, Math.floor((width - cleanedPhone.length) / 2));
      receipt += ' '.repeat(padding) + cleanedPhone + '\n';
    }
    if (data.address || data.phone) {
      receipt += separator + '\n';
    }
    
    if (data.header) {
      const headerLines = data.header.split('\n');
      headerLines.forEach(line => {
        const cleanedLine = this.cleanTextForPrinter(line);
        const padding = Math.max(0, Math.floor((width - cleanedLine.length) / 2));
        receipt += ' '.repeat(padding) + cleanedLine + '\n';
      });
      receipt += separator + '\n';
    }
    
    // Order info - Conditional display
    receipt += '\n';
    if (showOrderNumber) {
      const formattedOrderNumber = this.formatOrderNumber(data.orderNumber, prefix, custom);
      receipt += `${this.cleanTextForPrinter(custom.labelOrderNumber)}: ${formattedOrderNumber}\n`;
    }
    if (showDate) {
      receipt += `${this.cleanTextForPrinter(custom.labelDate)}: ${data.date.split(' ')[0]}\n`;
    }
    if (showTime && data.date.includes(' ')) {
      const timePart = data.date.split(' ')[1];
      if (timePart) {
        receipt += `${this.cleanTextForPrinter(custom.labelTime)}: ${timePart}\n`;
      }
    }
    if (showOrderType) {
      receipt += `${this.cleanTextForPrinter(custom.labelOrderType)}: ${this.cleanTextForPrinter(data.type)}\n`;
    }
    if (!isKitchen && custom.showPaymentMethod) {
      receipt += `${this.cleanTextForPrinter(custom.labelPaymentMethod)}: ${this.cleanTextForPrinter(data.paymentMethod)}\n`;
    }
    if (showCashier && data.cashier) {
      receipt += `${this.cleanTextForPrinter(custom.labelCashier)}: ${this.cleanTextForPrinter(data.cashier)}\n`;
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
          receipt += `   Taille: ${this.cleanTextForPrinter(line.size)}\n`;
        }
        
        if (showModifiers && line.modifiers && line.modifiers.length > 0) {
          line.modifiers.forEach(mod => {
            receipt += `   + (S) ${this.cleanTextForPrinter(mod)}\n`;
          });
        }
        
        if (showNotes && line.note) {
          receipt += `   NOTE: ${this.cleanTextForPrinter(line.note)}\n`;
        }
        
        if (showProductPrices && line.price) {
          const priceText = this.cleanTextForPrinter(line.price);
          const padding = Math.max(0, width - priceText.length);
          receipt += ' '.repeat(padding) + priceText + '\n';
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
    
    // Closing message (only for receipts, not kitchen tickets)
    if (!isKitchen) {
      receipt += '\n';
      const thankYouMsg = this.cleanTextForPrinter(custom.labelThankYou);
      const padding = Math.max(0, Math.floor((width - thankYouMsg.length) / 2));
      receipt += ' '.repeat(padding) + thankYouMsg + '\n';
      receipt += '\n';
    }
    
    return receipt;
  }
}

// Utility function to detect available printing methods
export async function detectPrintCapabilities(): Promise<{
  usb: boolean;
  network: boolean;
  bluetooth: boolean;
}> {
  return {
    usb: !!navigator.usb,
    network: true, // Always available via fetch/WebSocket
    bluetooth: !!navigator.bluetooth,
  };
}
