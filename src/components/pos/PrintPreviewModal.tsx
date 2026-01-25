import { useState, useRef, useEffect } from 'react';
import { Order, Settings, Printer as PrinterType, PrinterConnectionType } from '@/lib/database';
import { formatCurrency, Currency } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Printer, Download, FileText, Wifi, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DirectPrinter, PrinterConnection } from '@/lib/printer';
import { usePOS } from '@/contexts/POSContext';
import { renderReceiptHTML } from '@/lib/receipt-renderer';
import { useDialog } from '@/hooks/use-dialog';
// @ts-ignore - html2pdf.js doesn't have TypeScript definitions
import html2pdf from 'html2pdf.js';

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  settings: Settings | null;
  currency: Currency;
  type: 'receipt' | 'kitchen';
  cashierName?: string;
  amountReceived?: number;
  change?: number;
  printers?: PrinterType[];
}

export function PrintPreviewModal({ 
  isOpen, 
  onClose, 
  order, 
  settings, 
  currency, 
  type,
  cashierName = '',
  amountReceived,
  change,
  printers = []
}: PrintPreviewModalProps) {
  const { t } = usePOS();
  const { showAlert, DialogComponent } = useDialog();
  const printRef = useRef<HTMLDivElement>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);

  // Print kitchen ticket separately
  const handlePrintKitchenTicket = async () => {
    if (!order) return;

    try {
      const kitchenPrinter = printers.find(p => p.role === 'kitchen');
      if (!kitchenPrinter || !kitchenPrinter.tcpHost) {
        return; // Silent fail for kitchen printer - not critical
      }

      // Get customization settings for kitchen ticket
      const customization = settings?.receiptCustomization || DirectPrinter.getDefaultCustomization();
      const dateObj = new Date(order.createdAt);
      const formattedDate = customization 
        ? DirectPrinter.formatDate(dateObj, customization.dateFormat)
        : dateObj.toLocaleDateString('fr-FR');
      const formattedTime = customization
        ? DirectPrinter.formatDate(dateObj, customization.timeFormat)
        : dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

      // Format kitchen ticket
      const receiptText = DirectPrinter.formatTextReceipt({
        restaurantName: settings?.restaurantName,
        orderNumber: order.orderNumber,
        date: `${formattedDate} ${formattedTime}`,
        type: order.type === 'dine-in' ? '[SUR PLACE]' : '[A EMPORTER]',
        paymentMethod: order.paymentMethod === 'cash' ? 'Especes' : 'Carte',
        cashier: cashierName,
        lines: order.lines.map(line => {
          const lineTotal = (line.unitPrice + line.modifiers.reduce((sum, m) => sum + m.priceAdjustment, 0)) * line.quantity;
          return {
            quantity: line.quantity,
            name: line.productName,
            size: line.variantSize,
            modifiers: line.modifiers.map(m => m.optionName),
            note: line.note,
            price: customization?.kitchenShowProductPrices ? formatCurrency(lineTotal, currency) : undefined,
          };
        }),
        subtotal: '',
        total: '',
        showPrices: customization?.kitchenShowProductPrices || false,
        customization: customization,
        isKitchenTicket: true,
      });

      const connection: PrinterConnection = {
        type: 'network',
        name: t('printer.kitchenPrinter'),
        address: kitchenPrinter.tcpHost,
        port: kitchenPrinter.tcpPort || 9100,
      };

      const printer = new DirectPrinter(connection);
      // Use printer type from settings (default to false for regular printers)
      await printer.print(receiptText, kitchenPrinter.isThermalPrinter ?? false);
      console.log('Kitchen ticket printed successfully');
    } catch (error) {
      console.error('Kitchen ticket print error:', error);
      // Silent fail - don't show error to user for kitchen printer
    }
  };

  // Remove auto-print - user should click print button manually after preview
  // useEffect removed - no auto-printing anymore

  // Direct printing via app (not browser)
  const handleDirectPrint = async () => {
    if (!order) return;

    setIsPrinting(true);
    setPrintError(null);

    try {
      // Rôle ciblé (caisse ou cuisine)
      const printerRole = type === 'receipt' ? 'cashier' : 'kitchen';
      console.log('[PRINT][Preview] Type demandé =', type, '→ rôle =', printerRole);
      console.log('[PRINT][Preview] Imprimantes disponibles =', printers);

      // On ne prend que les imprimantes actives (enabled !== false)
      const rolePrinters = printers.filter(
        (p) => p.role === printerRole && p.enabled !== false
      );

      if (rolePrinters.length === 0) {
        throw new Error(
          `Aucune imprimante ACTIVE configurée pour le rôle "${printerRole === 'cashier' ? 'Reçu client' : 'Ticket cuisine'}".`
        );
      }

      // Get customization settings
      const customization = settings?.receiptCustomization || DirectPrinter.getDefaultCustomization();
      const dateObj = new Date(order.createdAt);
      const formattedDate = customization 
        ? DirectPrinter.formatDate(dateObj, customization.dateFormat)
        : dateObj.toLocaleDateString('fr-FR');
      const formattedTime = customization
        ? DirectPrinter.formatDate(dateObj, customization.timeFormat)
        : dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

      // Format receipt content as text (ESC/POS format)
      const isKitchen = type === 'kitchen';
      const receiptText = DirectPrinter.formatTextReceipt({
        restaurantName: settings?.restaurantName,
        address: isKitchen ? undefined : (settings?.showAddress ? settings.address : undefined),
        phone: isKitchen ? undefined : (settings?.showPhone ? settings.phone : undefined),
        header: isKitchen ? undefined : settings?.receiptHeader,
        footer: isKitchen ? undefined : settings?.receiptFooter,
        orderNumber: order.orderNumber,
        date: `${formattedDate} ${formattedTime}`,
        type: order.type === 'dine-in' ? '[SUR PLACE]' : '[A EMPORTER]',
        paymentMethod: order.paymentMethod === 'cash' ? 'Especes' : 'Carte',
        cashier: cashierName,
        lines: order.lines.map(line => {
          const lineTotal = (line.unitPrice + line.modifiers.reduce((sum, m) => sum + m.priceAdjustment, 0)) * line.quantity;
          return {
            quantity: line.quantity,
            name: line.productName,
            size: line.variantSize,
            modifiers: line.modifiers.map(m => m.optionName),
            note: line.note,
            // For kitchen tickets, only show price if enabled in customization
            price: isKitchen 
              ? (customization?.kitchenShowProductPrices ? formatCurrency(lineTotal, currency) : undefined)
              : formatCurrency(lineTotal, currency),
          };
        }),
        subtotal: isKitchen ? '' : formatCurrency(order.subtotal, currency),
        discount: isKitchen ? undefined : (order.discount > 0 ? formatCurrency(order.discount, currency) : undefined),
        total: isKitchen ? '' : formatCurrency(order.total, currency),
        amountReceived: isKitchen ? undefined : (amountReceived ? formatCurrency(amountReceived, currency) : undefined),
        change: isKitchen ? undefined : (change ? formatCurrency(change, currency) : undefined),
        showPrices: isKitchen ? (customization?.kitchenShowProductPrices || false) : true,
        customization: customization,
        isKitchenTicket: isKitchen,
      });

      if (printerRole === 'cashier') {
        // Reçu client : impression en parallèle sur toutes les imprimantes caissier actives
        console.log('[PRINT][Preview] Imprimantes caisse actives =', rolePrinters);

        await Promise.all(
          rolePrinters.map(async (printerConfig) => {
            const effectiveConnectionType: PrinterConnectionType =
              printerConfig.connectionType || 'tcp';

            // Validation par imprimante
            if (
              (effectiveConnectionType === 'tcp' || effectiveConnectionType === 'wifi') &&
              !printerConfig.tcpHost
            ) {
              console.warn(
                '[PRINT][Preview][Cashier] Imprimante sans IP, ignorée:',
                printerConfig
              );
              return;
            }

            try {
              const daemonUrl = 'http://127.0.0.1:9100/print';

              if (effectiveConnectionType === 'windows') {
                if (!printerConfig.name) {
                  console.warn(
                    "[PRINT][Preview][Cashier] Nom d'imprimante Windows manquant, ignorée:",
                    printerConfig
                  );
                  return;
                }

                const body = {
                  connectionType: 'windows',
                  target: { printerName: printerConfig.name },
                  content: receiptText,
                  isThermalPrinter: printerConfig.isThermalPrinter ?? true,
                  role: 'cashier' as const,
                };

                console.log('[PRINT][Preview][Cashier][Daemon] Payload envoyé =', body);

                const response = await fetch(daemonUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(body),
                });

                if (!response.ok) {
                  console.error(
                    '[PRINT][Preview][Cashier][Daemon] HTTP error =',
                    response.status
                  );
                  return;
                }

                const result = await response.json().catch(() => null);
                if (!result || result.success !== true) {
                  console.error(
                    '[PRINT][Preview][Cashier][Daemon] Erreur côté daemon:',
                    result
                  );
                  return;
                }

                console.log(
                  '✅ Reçu client imprimé via daemon Windows sur',
                  printerConfig.name
                );
              } else if (
                (effectiveConnectionType === 'tcp' ||
                  effectiveConnectionType === 'wifi') &&
                printerConfig.tcpHost
              ) {
                const body = {
                  connectionType: effectiveConnectionType,
                  target: {
                    host: printerConfig.tcpHost,
                    port: printerConfig.tcpPort || 9100,
                  },
                  content: receiptText,
                  isThermalPrinter: printerConfig.isThermalPrinter ?? true,
                  role: 'cashier' as const,
                };

                console.log('[PRINT][Preview][Cashier][Daemon] Payload TCP/WiFi envoyé =', body);

                const response = await fetch(daemonUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(body),
                });

                if (!response.ok) {
                  console.error(
                    '[PRINT][Preview][Cashier][Daemon] HTTP error =',
                    response.status
                  );
                  return;
                }

                const result = await response.json().catch(() => null);
                if (!result || result.success !== true) {
                  console.error(
                    '[PRINT][Preview][Cashier][Daemon] Erreur côté daemon:',
                    result
                  );
                  return;
                }

                console.log(
                  '✅ Reçu client imprimé via daemon Ethernet/Wi‑Fi sur',
                  printerConfig.name
                );
              } else {
                console.warn(
                  '[PRINT][Preview][Cashier] Type de connexion non supporté, ignorée:',
                  effectiveConnectionType
                );
              }
            } catch (err) {
              console.error(
                '[PRINT][Preview][Cashier] Erreur sur une imprimante caisse (non bloquant):',
                err
              );
            }
          })
        );
      } else {
        // Ticket cuisine : impression en parallèle sur toutes les imprimantes cuisine actives
        console.log('[PRINT][Preview] Imprimantes cuisine actives =', rolePrinters);

        await Promise.all(
          rolePrinters.map(async (printerConfig) => {
            const effectiveConnectionType: PrinterConnectionType =
              printerConfig.connectionType || 'tcp';

            // Validation par imprimante
            if (
              (effectiveConnectionType === 'tcp' || effectiveConnectionType === 'wifi') &&
              !printerConfig.tcpHost
            ) {
              console.warn(
                '[PRINT][Preview][Kitchen] Imprimante sans IP, ignorée:',
                printerConfig
              );
              return;
            }

            try {
              const daemonUrl = 'http://127.0.0.1:9100/print';

              if (effectiveConnectionType === 'windows') {
                if (!printerConfig.name) {
                  console.warn(
                    "[PRINT][Preview][Kitchen] Nom d'imprimante Windows manquant, ignorée:",
                    printerConfig
                  );
                  return;
                }

                const body = {
                  connectionType: 'windows',
                  target: { printerName: printerConfig.name },
                  content: receiptText,
                  isThermalPrinter: printerConfig.isThermalPrinter ?? true,
                  role: 'kitchen' as const,
                };

                console.log('[PRINT][Preview][Kitchen][Daemon] Payload envoyé =', body);

                const response = await fetch(daemonUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(body),
                });

                if (!response.ok) {
                  console.error(
                    '[PRINT][Preview][Kitchen][Daemon] HTTP error =',
                    response.status
                  );
                  return;
                }

                const result = await response.json().catch(() => null);
                if (!result || result.success !== true) {
                  console.error(
                    '[PRINT][Preview][Kitchen][Daemon] Erreur côté daemon:',
                    result
                  );
                  return;
                }

                console.log(
                  '✅ Ticket cuisine imprimé via daemon Windows sur',
                  printerConfig.name
                );
              } else if (
                (effectiveConnectionType === 'tcp' ||
                  effectiveConnectionType === 'wifi') &&
                printerConfig.tcpHost
              ) {
                const body = {
                  connectionType: effectiveConnectionType,
                  target: {
                    host: printerConfig.tcpHost,
                    port: printerConfig.tcpPort || 9100,
                  },
                  content: receiptText,
                  isThermalPrinter: printerConfig.isThermalPrinter ?? true,
                  role: 'kitchen' as const,
                };

                console.log('[PRINT][Preview][Kitchen][Daemon] Payload TCP/WiFi envoyé =', body);

                const response = await fetch(daemonUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(body),
                });

                if (!response.ok) {
                  console.error(
                    '[PRINT][Preview][Kitchen][Daemon] HTTP error =',
                    response.status
                  );
                  return;
                }

                const result = await response.json().catch(() => null);
                if (!result || result.success !== true) {
                  console.error(
                    '[PRINT][Preview][Kitchen][Daemon] Erreur côté daemon:',
                    result
                  );
                  return;
                }

                console.log(
                  '✅ Ticket cuisine imprimé via daemon Ethernet/Wi‑Fi sur',
                  printerConfig.name
                );
              } else {
                console.warn(
                  '[PRINT][Preview][Kitchen] Type de connexion non supporté, ignorée:',
                  effectiveConnectionType
                );
              }
            } catch (err) {
              console.error(
                '[PRINT][Preview][Kitchen] Erreur sur une imprimante cuisine (non bloquant):',
                err
              );
            }
          })
        );
      }

      setIsPrinting(false);
      
      // Auto-close modal after successful print after 2 seconds
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Direct print error:', error);
      setPrintError(error instanceof Error ? error.message : t('print.unknownError'));
      setIsPrinting(false);
      
      // Don't automatically fallback - let user choose to use browser print manually
      // handleBrowserPrint();
    }
  };

  // Browser print function removed - no longer used

  const handleDownload = async () => {
    if (!printRef.current || !order) return;
    
    try {
      const element = printRef.current;
      const fileName = `${type === 'receipt' ? 'recu' : 'ticket-cuisine'}_${order.orderNumber}.pdf`;
      
      // Configuration for PDF generation
      const opt = {
        margin: [5, 5, 5, 5],
        filename: fileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2,
          useCORS: true,
          letterRendering: true,
          backgroundColor: '#ffffff'
        },
        jsPDF: { 
          unit: 'mm', 
          format: [80, 297], // Receipt width (80mm) and A4 height
          orientation: 'portrait'
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      // Generate and download PDF directly
      await html2pdf().set(opt).from(element).save();
    } catch (error) {
      console.error('PDF download error:', error);
      await showAlert('Erreur lors du téléchargement du PDF: ' + (error instanceof Error ? error.message : 'Erreur inconnue'), 'Erreur');
    }
  };

  if (!isOpen || !order) return null;

  const customization = settings?.receiptCustomization || DirectPrinter.getDefaultCustomization();

  return (
    <>
      {DialogComponent}
      <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="bg-card rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-4 border-b border-border flex items-center justify-between no-print">
            <h2 className="text-xl font-bold">
              {type === 'receipt' ? t('print.previewReceipt') : t('print.previewKitchenTicket')}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-accent rounded-xl transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Print Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-4">
            <div 
              ref={printRef}
              className="bg-white text-black p-6 rounded-lg shadow-inner max-w-sm mx-auto"
              style={{ 
                fontFamily: customization.fontFamily === 'monospace' ? 'Courier New, monospace' : 
                           customization.fontFamily === 'sans-serif' ? 'Arial, sans-serif' : 
                           'Times New Roman, serif',
                fontSize: customization.fontSize === 'small' ? '11px' : 
                         customization.fontSize === 'large' ? '15px' : 
                         '13px',
                lineHeight: '1.5',
                letterSpacing: '0.5px'
              }}
            >
              {renderReceiptHTML({
                order,
                settings: settings || {} as Settings,
                currency,
                customization,
                cashierName,
                amountReceived,
                change,
                t,
                type
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="p-4 border-t border-border space-y-3 no-print">
            {printError && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                <AlertCircle className="w-5 h-5" />
                <span>{printError}</span>
              </div>
            )}
            
            <div className="flex gap-3">
              <Button
                onClick={handleDownload}
                variant="outline"
                className="flex-1 h-12 text-base font-medium"
                size="lg"
              >
                <Download className="w-5 h-5 mr-2" />
                Télécharger en PDF
              </Button>
              <Button
                onClick={handleDirectPrint}
                disabled={isPrinting}
                className="flex-1 h-12 text-base font-medium"
                size="lg"
              >
                <Printer className="w-5 h-5 mr-2" />
                {isPrinting ? t('print.printing') : t('print.print')}
              </Button>
              <Button
                onClick={onClose}
                variant="outline"
                className="flex-1 h-12 text-base font-medium"
                size="lg"
              >
                {t('general.close')}
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
    </>
  );
}
