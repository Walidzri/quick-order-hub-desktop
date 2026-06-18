import { useState, useRef } from 'react';
import { Order, Settings, Printer as PrinterType, PrinterConnectionType } from '@shared/types';
import { formatCurrency, Currency } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Printer, Download, AlertCircle, Check, Loader2 } from 'lucide-react';
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
  const [printSuccess, setPrintSuccess] = useState(false);
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
        logo: undefined,
        orderNumber: order.orderNumber,
        date: `${formattedDate} ${formattedTime}`,
        type: order.type,
        paymentMethod: order.paymentMethod === 'cash' ? 'Especes' : 'Carte',
        cashier: cashierName,
        deliveryCustomerName: order.deliveryCustomerName,
        deliveryPhone: order.deliveryPhone,
        deliveryAddress: order.deliveryAddress,
        lines: order.lines.map(line => {
          const lineTotal = (line.unitPrice + line.modifiers.reduce((sum, m) => sum + m.priceAdjustment, 0)) * line.quantity;
          return {
            quantity: line.quantity,
            name: line.productName,
            size: line.variantSize,
            modifiers: line.modifiers.map(m => m.optionName),
            modifierPrices: line.modifiers.map(m => (m.priceAdjustment >= 0 ? '+' : '') + formatCurrency(m.priceAdjustment, currency)),
            note: line.note,
            price: customization?.kitchenShowProductPrices ? formatCurrency(lineTotal, currency) : undefined,
            unitPrice: customization?.kitchenShowProductPrices ? formatCurrency(line.unitPrice, currency) : undefined,
            unitPriceSubtotal: customization?.kitchenShowProductPrices && line.quantity > 1 ? formatCurrency(line.unitPrice * line.quantity, currency) : undefined,
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
      // Logo seulement pour les reçus clients, pas pour les tickets cuisine
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
        logo: (isKitchen || !customization.showLogo) ? undefined : settings?.logo,
        address: isKitchen ? undefined : (settings?.showAddress ? settings.address : undefined),
        phone: isKitchen ? undefined : (settings?.showPhone ? settings.phone : undefined),
        header: isKitchen ? undefined : settings?.receiptHeader,
        footer: isKitchen ? undefined : settings?.receiptFooter,
        orderNumber: order.orderNumber,
        date: `${formattedDate} ${formattedTime}`,
        type: order.type,
        paymentMethod: order.paymentMethod === 'cash' ? 'Especes' : 'Carte',
        cashier: cashierName,
        deliveryCustomerName: order.deliveryCustomerName,
        deliveryPhone: order.deliveryPhone,
        deliveryAddress: order.deliveryAddress,
        deliveryFee: order.deliveryFee ? formatCurrency(order.deliveryFee, currency) : undefined,
        lines: order.lines.map(line => {
          const lineTotal = (line.unitPrice + line.modifiers.reduce((sum, m) => sum + m.priceAdjustment, 0)) * line.quantity;
          const showPrices = isKitchen ? customization?.kitchenShowProductPrices : true;
          return {
            quantity: line.quantity,
            name: line.productName,
            size: line.variantSize,
            modifiers: line.modifiers.map(m => m.optionName),
            modifierPrices: line.modifiers.map(m => (m.priceAdjustment >= 0 ? '+' : '') + formatCurrency(m.priceAdjustment, currency)),
            note: line.note,
            price: isKitchen 
              ? (customization?.kitchenShowProductPrices ? formatCurrency(lineTotal, currency) : undefined)
              : formatCurrency(lineTotal, currency),
            unitPrice: showPrices ? formatCurrency(line.unitPrice, currency) : undefined,
            unitPriceSubtotal: showPrices && line.quantity > 1 ? formatCurrency(line.unitPrice * line.quantity, currency) : undefined,
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
              // Use DirectPrinter which handles PrintDaemon C# API internally
              let connection: PrinterConnection;

              if (effectiveConnectionType === 'windows') {
                if (!printerConfig.name) {
                  console.warn(
                    "[PRINT][Preview][Cashier] Nom d'imprimante Windows manquant, ignorée:",
                    printerConfig
                  );
                  return;
                }

                connection = {
                  type: 'windows',
                  name: printerConfig.name,
                  printerName: printerConfig.name,
                };
              } else if (
                (effectiveConnectionType === 'tcp' ||
                  effectiveConnectionType === 'wifi') &&
                printerConfig.tcpHost
              ) {
                connection = {
                  type: 'network',
                  name: printerConfig.name || 'Imprimante réseau',
                  address: printerConfig.tcpHost,
                  port: printerConfig.tcpPort || 9100,
                };
              } else {
                console.warn(
                  '[PRINT][Preview][Cashier] Type de connexion non supporté, ignorée:',
                  effectiveConnectionType
                );
                return;
              }

              const printer = new DirectPrinter(connection);
              // Passer le logo pour les reçus clients uniquement, si l'option est activée
              const logoBase64 = (type === 'receipt' && customization.showLogo) ? settings?.logo : undefined;
              const logoSize = (type === 'receipt' && customization.showLogo) ? customization.logoSize : undefined;
              await printer.print(receiptText, printerConfig.isThermalPrinter ?? true, logoBase64, logoSize);

              console.log(
                '✅ Reçu client imprimé via PrintDaemon C# sur',
                printerConfig.name
              );
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
              // Use DirectPrinter which handles PrintDaemon C# API internally
              let connection: PrinterConnection;

              if (effectiveConnectionType === 'windows') {
                if (!printerConfig.name) {
                  console.warn(
                    "[PRINT][Preview][Kitchen] Nom d'imprimante Windows manquant, ignorée:",
                    printerConfig
                  );
                  return;
                }

                connection = {
                  type: 'windows',
                  name: printerConfig.name,
                  printerName: printerConfig.name,
                };
              } else if (
                (effectiveConnectionType === 'tcp' ||
                  effectiveConnectionType === 'wifi') &&
                printerConfig.tcpHost
              ) {
                connection = {
                  type: 'network',
                  name: printerConfig.name || 'Imprimante cuisine',
                  address: printerConfig.tcpHost,
                  port: printerConfig.tcpPort || 9100,
                };
              } else {
                console.warn(
                  '[PRINT][Preview][Kitchen] Type de connexion non supporté, ignorée:',
                  effectiveConnectionType
                );
                return;
              }

              const printer = new DirectPrinter(connection);
              // Passer le logo pour les reçus clients uniquement, si l'option est activée
              const logoBase64 = (type === 'receipt' && customization.showLogo) ? settings?.logo : undefined;
              const logoSize = (type === 'receipt' && customization.showLogo) ? customization.logoSize : undefined;
              await printer.print(receiptText, printerConfig.isThermalPrinter ?? true, logoBase64, logoSize);

              console.log(
                '✅ Ticket cuisine imprimé via PrintDaemon C# sur',
                printerConfig.name
              );
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
      setPrintSuccess(true);
      setTimeout(() => {
        setPrintSuccess(false);
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
          className="bg-card rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
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

          {/* Encadré Monnaie à rendre (cadre du modal, pas le reçu) - visible pour le caissier */}
          {type === 'receipt' && order.paymentMethod === 'cash' && (amountReceived != null || change != null) && (
            <div className="px-4 py-3 bg-primary/10 border-y border-border no-print">
              <div className="flex flex-wrap items-center justify-center gap-6 text-base font-semibold">
                {amountReceived != null && (
                  <span>
                    {t('receipt.amountReceived')}: {formatCurrency(amountReceived, currency)}
                  </span>
                )}
                {change != null && (
                  <span className="text-primary">
                    {t('receipt.change')}: {formatCurrency(change, currency)}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Print Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-4">
            <div
              ref={printRef}
              className="bg-white text-black p-6 rounded-lg shadow-inner"
              style={{
                fontFamily: customization.fontFamily === 'monospace' ? 'Courier New, monospace' :
                            customization.fontFamily === 'sans-serif' ? 'Arial, sans-serif' :
                            'Times New Roman, serif',
                fontSize: customization.fontSize === 'small' ? '11px' :
                          customization.fontSize === 'large' ? '15px' : '13px',
                lineHeight: '1.5',
                letterSpacing: '0.5px',
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
          <div className="p-4 border-t border-border space-y-2 no-print">
            {printError && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{printError}</span>
              </div>
            )}

            {/* Bouton principal — Imprimer */}
            <Button
              onClick={handleDirectPrint}
              disabled={isPrinting || printSuccess}
              className="w-full h-14 text-base font-semibold"
              size="lg"
            >
              {isPrinting ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" />{t('print.printing')}</>
              ) : printSuccess ? (
                <><Check className="w-5 h-5 mr-2" />Impression envoyée</>
              ) : (
                <><Printer className="w-5 h-5 mr-2" />{t('print.print')}</>
              )}
            </Button>

            {/* Boutons secondaires */}
            <div className="flex gap-2">
              <Button onClick={handleDownload} variant="outline" className="flex-1" size="sm">
                <Download className="w-4 h-4 mr-2" />
                {t('pdf.download')}
              </Button>
              <Button onClick={onClose} variant="outline" className="flex-1" size="sm">
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
