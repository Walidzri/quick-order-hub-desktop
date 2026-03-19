import { useState } from 'react';
import { usePOS } from '@/contexts/POSContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/i18n';
import { PaymentMethod, Order, PrinterConnectionType } from '@shared/types';
import { motion } from 'framer-motion';
import { X, Banknote, CreditCard, Check, Trash2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { DirectPrinter, PrinterConnection } from '@/lib/printer';

interface PaymentModalProps {
  onClose: () => void;
  onPaymentSuccess?: (order: Order, amountReceived: number, change: number) => void;
}

export function PaymentModal({ onClose, onPaymentSuccess }: PaymentModalProps) {
  const { 
    createOrder, 
    sendToKitchen, 
    markAsPaid, 
    total, 
    subtotal,
    discount,
    appliedPromo,
    currency, 
    t,
    settings,
    printers
  } = usePOS();
  const { user, users } = useAuth();
  
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'method' | 'cash' | 'processing' | 'done'>('method');
  const [paymentAmountReceived, setPaymentAmountReceived] = useState<number>(0);
  const [paymentChange, setPaymentChange] = useState<number>(0);

  const change = (parseFloat(amountReceived) || 0) - total;

  // Handle numeric keypad input
  const handleNumberInput = (num: string) => {
    const newValue = amountReceived === '0' ? num : amountReceived + num;
    
    // Limit total length to prevent overflow
    if (newValue.length > 10) return;
    
    setAmountReceived(newValue);
  };

  const handleBackspace = () => {
    if (amountReceived.length > 0) {
      setAmountReceived(amountReceived.slice(0, -1));
    }
  };

  const handleClear = () => {
    setAmountReceived('');
  };

  // Print kitchen ticket automatically after payment
  // onOpenDrawerIfCash: appelé au lancement du ticket cuisine si paiement espèces (impulsion tiroir RJ12)
  const printKitchenTicketAutomatically = async (
    order: Order,
    onOpenDrawerIfCash?: () => Promise<void>
  ) => {
    try {
      // Ouvrir le tiroir caisse au moment où le ticket cuisine est lancé (si paiement espèces)
      if (order.paymentMethod === 'cash' && onOpenDrawerIfCash) {
        await onOpenDrawerIfCash();
      }

      console.log('[AUTO-KITCHEN] Imprimantes disponibles =', printers);
      // Toutes les imprimantes cuisine actives
      const kitchenPrinters = printers?.filter(
        (p) => p.role === 'kitchen' && p.enabled !== false
      );
      console.log('[AUTO-KITCHEN] Imprimantes cuisine actives =', kitchenPrinters);
      if (!kitchenPrinters || kitchenPrinters.length === 0) {
        console.log('[AUTO-KITCHEN] Aucune imprimante cuisine ACTIVE définie.');
        return;
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

      // Nom du caissier : toujours résolu depuis order.createdBy (créateur de la commande)
      // pour éviter tout affichage incorrect après changement de compte
      const cashierName = order.createdBy
        ? (users.find((u) => u.id === order.createdBy)?.name ?? user?.name ?? '')
        : (user?.name ?? '');

      // Format kitchen ticket
      const receiptText = DirectPrinter.formatTextReceipt({
        restaurantName: settings?.restaurantName,
        logo: settings?.logo,
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

      // Impression en parallèle sur toutes les imprimantes cuisine actives
      await Promise.all(
        kitchenPrinters.map(async (kitchenPrinter) => {
          const effectiveConnectionType: PrinterConnectionType =
            kitchenPrinter.connectionType || 'tcp';

          if (
            (effectiveConnectionType === 'tcp' ||
              effectiveConnectionType === 'wifi') &&
            !kitchenPrinter.tcpHost
          ) {
            console.log(
              '[AUTO-KITCHEN] Imprimante cuisine sans IP configurée, ignorée.',
              kitchenPrinter
            );
            return;
          }

          try {
            // Use DirectPrinter which handles PrintDaemon C# API internally
            let connection: PrinterConnection;

            if (effectiveConnectionType === 'windows') {
              if (!kitchenPrinter.name) {
                console.error(
                  "[AUTO-KITCHEN] Nom d'imprimante Windows manquant dans la config.",
                  kitchenPrinter
                );
                return;
              }

              connection = {
                type: 'windows',
                name: kitchenPrinter.name,
                printerName: kitchenPrinter.name,
              };
            } else if (
              (effectiveConnectionType === 'tcp' ||
                effectiveConnectionType === 'wifi') &&
              kitchenPrinter.tcpHost
            ) {
              connection = {
                type: 'network',
                name: kitchenPrinter.name || 'Imprimante cuisine',
                address: kitchenPrinter.tcpHost,
                port: kitchenPrinter.tcpPort || 9100,
              };
            } else {
              console.warn(
                '[AUTO-KITCHEN] Type de connexion non supporté, ignorée:',
                effectiveConnectionType
              );
              return;
            }

            const printer = new DirectPrinter(connection);
            // Logo seulement pour les reçus clients, pas pour les tickets cuisine
            await printer.print(receiptText, kitchenPrinter.isThermalPrinter ?? true);

            console.log(
              '✅ Kitchen ticket printed automatically via PrintDaemon C# sur',
              kitchenPrinter.name
            );
          } catch (err) {
            console.error(
              '[AUTO-KITCHEN] Erreur sur une imprimante cuisine (non bloquant):',
              err
            );
          }
        })
      );
    } catch (error) {
      // Silent fail - don't block payment if kitchen printer fails
      console.error('Kitchen ticket auto-print error (non-blocking):', error);
    }
  };

  // Open cash drawer (RJ12) when paying cash - uses first receipt printer
  const openCashDrawerIfNeeded = async () => {
    if (method !== 'cash') return;
    const receiptPrinters = printers?.filter(
      (p) => p.role === 'cashier' && p.enabled !== false
    );
    if (!receiptPrinters?.length) return;

    const printer = receiptPrinters[0];
    const effectiveConnectionType: PrinterConnectionType =
      printer.connectionType || 'tcp';

    let connection: PrinterConnection;
    if (effectiveConnectionType === 'windows') {
      if (!printer.name) return;
      connection = {
        type: 'windows',
        name: printer.name,
        printerName: printer.name,
      };
    } else if (
      (effectiveConnectionType === 'tcp' || effectiveConnectionType === 'wifi') &&
      printer.tcpHost
    ) {
      connection = {
        type: 'network',
        name: printer.name || 'Reçu client',
        address: printer.tcpHost,
        port: printer.tcpPort || 9100,
      };
    } else {
      return;
    }

    try {
      const directPrinter = new DirectPrinter(connection);
      await directPrinter.openDrawer();
    } catch (err) {
      console.error('[DRAWER] Ouverture tiroir caisse (non bloquant):', err);
    }
  };

  const handlePayment = async () => {
    setIsProcessing(true);
    setStep('processing');
    
    try {
      // Calculate payment amounts
      const received = method === 'cash' ? (parseFloat(amountReceived) || total) : total;
      const change = Math.max(0, received - total);
      
      // Store payment info for receipt
      setPaymentAmountReceived(received);
      setPaymentChange(change);
      
      // Create order
      const order = await createOrder();
      
      // Send to kitchen if not already sent
      await sendToKitchen(order.id);
      
      // Mark as paid
      const paidOrderData = await markAsPaid(order.id, method);
      
      // Automatically print kitchen ticket after payment (l'impulsion tiroir est lancée au début du ticket cuisine)
      printKitchenTicketAutomatically(paidOrderData, openCashDrawerIfNeeded).catch(err => {
        console.error('Kitchen ticket print failed (non-blocking):', err);
      });
      
      setStep('done');
      
      // Notify parent and close payment modal after short delay (pass computed values, not state - state update is async)
      setTimeout(() => {
        if (onPaymentSuccess) {
          onPaymentSuccess(paidOrderData, received, change);
        }
        onClose(); // Close payment modal
      }, 500);
    } catch (error) {
      console.error('Payment error:', error);
      setStep('method');
      setIsProcessing(false);
    }
  };

  const quickAmounts = [
    Math.ceil(total / 100) * 100,
    Math.ceil(total / 500) * 500,
    Math.ceil(total / 1000) * 1000,
    Math.ceil(total / 1000) * 1000 + 1000,
  ].filter((v, i, arr) => v > total && arr.indexOf(v) === i).slice(0, 4);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-card rounded-2xl w-full max-w-md max-h-[95vh] sm:max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {step === 'done' ? (
          <div className="p-8 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-20 h-20 mx-auto bg-success rounded-full flex items-center justify-center mb-4"
            >
              <Check className="w-10 h-10 text-success-foreground" />
            </motion.div>
            <h2 className="text-2xl font-bold text-success mb-2">
              {t('payment.successTitle')}
            </h2>
            <p className="text-muted-foreground">
              {t('payment.preparingReceipt')}
            </p>
          </div>
        ) : step === 'processing' ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-lg font-medium">Traitement en cours...</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
              <h2 className="text-xl font-bold">{t('payment.title')}</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-accent rounded-xl transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Order Summary */}
            <div className="p-4 bg-muted/30 border-b border-border flex-shrink-0">
              <div className="flex justify-between text-sm mb-1">
                <span>{t('order.subtotal')}</span>
                <span>{formatCurrency(subtotal, currency)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm text-success mb-1">
                  <span>{t('order.discount')} ({appliedPromo?.code})</span>
                  <span>-{formatCurrency(discount, currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-xl font-bold pt-2 border-t border-border">
                <span>{t('order.total')}</span>
                <span className="text-primary">{formatCurrency(total, currency)}</span>
              </div>
            </div>

            {step === 'method' && (
              <div className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  {t('payment.method')}
                </h3>
                
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setMethod('cash')}
                    className={cn(
                      "p-6 rounded-xl border-2 transition-all flex flex-col items-center gap-2",
                      method === 'cash'
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <Banknote className="w-10 h-10 text-success" />
                    <span className="font-bold">{t('payment.cash')}</span>
                  </button>
                  
                  <button
                    onClick={() => setMethod('card')}
                    disabled={!settings?.cardPaymentEnabled}
                    className={cn(
                      "p-6 rounded-xl border-2 transition-all flex flex-col items-center gap-2 relative",
                      !settings?.cardPaymentEnabled
                        ? "border-border/30 bg-muted/30 opacity-50 cursor-not-allowed"
                        : method === 'card'
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                    )}
                    title={!settings?.cardPaymentEnabled ? t('payment.cardDisabledTooltip') : undefined}
                  >
                    <CreditCard className={cn(
                      "w-10 h-10",
                      !settings?.cardPaymentEnabled ? "text-muted-foreground" : "text-info"
                    )} />
                    <span className={cn(
                      "font-bold",
                      !settings?.cardPaymentEnabled && "text-muted-foreground"
                    )}>
                      {t('payment.card')}
                    </span>
                    {!settings?.cardPaymentEnabled && (
                      <span className="absolute top-2 right-2 text-xs bg-muted-foreground/20 text-muted-foreground px-2 py-0.5 rounded">
                        {t('payment.disabled')}
                      </span>
                    )}
                  </button>
                </div>

                <div className="pt-2 flex-shrink-0 sticky bottom-0 bg-card">
                  <Button
                    onClick={() => method === 'cash' ? setStep('cash') : handlePayment()}
                    disabled={method === 'card' && !settings?.cardPaymentEnabled}
                    className="w-full h-14 text-base sm:text-lg font-bold gradient-primary border-0"
                  >
                    {method === 'cash' ? t('payment.continue') : t('payment.confirm')}
                  </Button>
                  {method === 'card' && !settings?.cardPaymentEnabled && (
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      {t('payment.cardDisabledMessage')}
                    </p>
                  )}
                </div>
              </div>
            )}

            {step === 'cash' && (
              <div className="p-3 flex flex-col flex-1 min-h-0 overflow-hidden">
                {/* Montant reçu + Monnaie à rendre sur une seule ligne (tout visible sans scroll) */}
                <div className="grid grid-cols-2 gap-2 flex-shrink-0 mb-2">
                  <div className="rounded-lg bg-muted border border-border p-2 flex flex-col justify-center min-h-[3.5rem]">
                    <span className="text-xs text-muted-foreground">{t('payment.amountReceived')}</span>
                    <span className="text-lg font-bold text-primary truncate">
                      {formatCurrency(parseFloat(amountReceived) || 0, currency)}
                    </span>
                  </div>
                  <div className="rounded-lg bg-success/10 border border-success/20 p-2 flex flex-col justify-center min-h-[3.5rem]">
                    <span className="text-xs text-muted-foreground">{t('payment.change')}</span>
                    <span className="text-lg font-bold text-success truncate">
                      {amountReceived && !isNaN(parseFloat(amountReceived)) && parseFloat(amountReceived) >= total
                        ? formatCurrency(Math.max(0, change), currency)
                        : '—'}
                    </span>
                  </div>
                </div>

                {/* Raccourcis montants */}
                <div className="grid grid-cols-4 gap-1 flex-shrink-0 mb-2">
                  {quickAmounts.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setAmountReceived(amount.toString())}
                      className="py-1.5 rounded-md bg-secondary hover:bg-secondary/80 font-medium text-xs transition-colors touch-target"
                    >
                      {formatCurrency(amount, currency)}
                    </button>
                  ))}
                </div>

                {/* Clavier numérique compact */}
                <div className="grid grid-cols-3 gap-1 flex-shrink-0 mb-2">
                  {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((n) => (
                    <button key={n} onClick={() => handleNumberInput(String(n))} type="button"
                      className="h-11 text-lg font-bold bg-background border border-border rounded-lg hover:bg-muted active:bg-primary active:text-primary-foreground transition-colors touch-target"
                    >{n}</button>
                  ))}
                  <button onClick={handleClear} type="button" className="h-11 flex items-center justify-center rounded-lg bg-destructive/10 border border-destructive/20 hover:bg-destructive/20 active:bg-destructive text-destructive touch-target">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleNumberInput('0')} type="button" className="h-11 text-lg font-bold bg-background border border-border rounded-lg hover:bg-muted active:bg-primary active:text-primary-foreground transition-colors touch-target">0</button>
                  <button onClick={handleBackspace} type="button" className="h-11 flex items-center justify-center rounded-lg bg-secondary border border-border hover:bg-secondary/80 touch-target">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                </div>

                {/* Annuler / Valider */}
                <div className="flex gap-2 flex-shrink-0">
                  <Button onClick={() => setStep('method')} variant="outline" className="flex-1 h-12 text-base font-medium">
                    {t('general.cancel')}
                  </Button>
                  <Button
                    onClick={handlePayment}
                    disabled={!amountReceived || isNaN(parseFloat(amountReceived)) || parseFloat(amountReceived) < total}
                    className="flex-1 h-12 text-base font-bold gradient-primary border-0"
                  >
                    {t('payment.confirm')}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>

    </motion.div>
  );
}
