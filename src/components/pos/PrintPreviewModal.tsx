import { useState, useRef, useEffect } from 'react';
import { Order, Settings, Printer as PrinterType } from '@/lib/database';
import { formatCurrency, Currency } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Printer, Download, FileText, Wifi, Usb, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DirectPrinter, PrinterConnection, detectPrintCapabilities } from '@/lib/printer';
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
  const [printCapabilities, setPrintCapabilities] = useState<Awaited<ReturnType<typeof detectPrintCapabilities>> | null>(null);

  useEffect(() => {
    // Detect print capabilities on mount
    detectPrintCapabilities().then(setPrintCapabilities);
  }, []);

  // Print kitchen ticket separately
  const handlePrintKitchenTicket = async () => {
    if (!order) return;

    try {
      const kitchenPrinter = printers.find(p => p.role === 'kitchen');
      if (!kitchenPrinter || !kitchenPrinter.tcpHost) {
        return; // Silent fail for kitchen printer - not critical
      }

      // Get customization settings for kitchen ticket
      const customization = settings?.receiptCustomization;
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
            modifiers: line.modifiers.map(m => `(S) ${m.optionName}`),
            note: line.note,
            price: customization?.kitchenShowProductPrices ? formatCurrency(lineTotal, currency) : undefined,
          };
        }),
        subtotal: '',
        total: '',
        showPrices: customization?.kitchenShowProductPrices || false,
        customization: customization,
        numberingPrefix: settings?.numberingPrefix || '',
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
      // Find the appropriate printer
      const printerRole = type === 'receipt' ? 'cashier' : 'kitchen';
      const printerConfig = printers.find(p => p.role === printerRole);

      if (!printerConfig || !printerConfig.tcpHost) {
        throw new Error(
          `Imprimante ${printerRole === 'cashier' ? 'caissier' : 'cuisine'} non configurée. ` +
          `Veuillez configurer l'imprimante dans Paramètres > Imprimantes avec son adresse IP réseau.`
        );
      }

      // Get customization settings
      const customization = settings?.receiptCustomization;
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
            modifiers: line.modifiers.map(m => `(S) ${m.optionName}`),
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
        numberingPrefix: settings?.numberingPrefix || '',
        isKitchenTicket: isKitchen, // CRITICAL: Mark as kitchen ticket for proper formatting
      });

      // Create printer connection based on config
      let connection: PrinterConnection;

      if (printerConfig.mode === 'tcp' && printerConfig.tcpHost) {
        connection = {
          type: 'network',
          name: `Imprimante ${printerRole}`,
          address: printerConfig.tcpHost,
          port: printerConfig.tcpPort || 9100,
        };
      } else {
        // Try USB if available, otherwise fallback to network
        if (printCapabilities?.usb) {
          connection = {
            type: 'usb',
            name: `Imprimante ${printerRole}`,
          };
        } else {
          throw new Error(t('print.noPrintMethod'));
        }
      }

      const printer = new DirectPrinter(connection);
      // Use printer type from settings (default to false for regular printers)
      await printer.print(receiptText, printerConfig.isThermalPrinter ?? false);

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

  // Fallback: Browser print dialog
  const handleBrowserPrint = async () => {
    if (!printRef.current || !order) return;

    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        await showAlert(t('print.allowPopups'), 'Erreur');
        return;
      }

      const printContent = printRef.current.innerHTML;
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${type === 'receipt' ? t('print.receipt') : t('print.kitchenTicket')} - ${order.orderNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.4; padding: 20px; max-width: 300px; margin: 0 auto; background: white; color: black; }
    .header { text-align: center; margin-bottom: 15px; border-bottom: 1px dashed #000; padding-bottom: 10px; }
    .restaurant-name { font-size: 16px; font-weight: bold; margin-bottom: 5px; }
    .address, .phone { font-size: 10px; margin: 2px 0; }
    .divider { border-top: 1px dashed #000; margin: 10px 0; }
    .section { margin: 10px 0; }
    .section-title { font-weight: bold; text-align: center; margin-bottom: 5px; font-size: 14px; }
    .order-info { margin: 8px 0; font-size: 11px; }
    .order-line { margin: 5px 0; font-size: 11px; }
    .line-header { font-weight: bold; margin-bottom: 2px; }
    .line-details { font-size: 10px; margin-left: 10px; color: #555; }
    .totals { margin-top: 15px; border-top: 1px dashed #000; padding-top: 10px; }
    .total-line { display: flex; justify-content: space-between; margin: 5px 0; font-size: 11px; }
    .total-final { font-weight: bold; font-size: 14px; border-top: 2px solid #000; padding-top: 5px; margin-top: 5px; }
    .footer { text-align: center; margin-top: 20px; font-size: 10px; border-top: 1px dashed #000; padding-top: 10px; }
    .payment-info { margin: 8px 0; font-size: 11px; text-align: center; }
    .cashier { font-size: 10px; margin-bottom: 5px; }
    @media print { body { padding: 0; } .no-print { display: none; } }
  </style>
</head>
<body>
  ${printContent}
</body>
</html>`;

      printWindow.document.write(htmlContent);
      printWindow.document.close();

      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          setTimeout(() => {
            printWindow.close();
          }, 500);
        }, 250);
      };
    } catch (error) {
      console.error('Browser print error:', error);
      await showAlert(t('print.printError'), 'Erreur d\'impression');
    }
  };

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
            
            <Button
              onClick={handleBrowserPrint}
              variant="outline"
              className="w-full h-11 text-sm"
              title={t('print.useBrowserPrinter')}
            >
              <FileText className="w-4 h-4 mr-2" />
              {t('print.useBrowserPrinter')}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
    </>
  );
}
