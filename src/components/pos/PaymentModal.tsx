import { useState } from 'react';
import { usePOS } from '@/contexts/POSContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/i18n';
import { PaymentMethod, Order, PrinterConnectionType } from '@/lib/database';
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
  const { user } = useAuth();
  
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
  const printKitchenTicketAutomatically = async (order: Order) => {
    try {
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

      // Get cashier name
      const cashierName = user?.name || '';

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
            const daemonUrl = 'http://127.0.0.1:9100/print';

            // Impression via daemon : Windows (spooler), Ethernet, Wi‑Fi
            if (effectiveConnectionType === 'windows') {
              if (!kitchenPrinter.name) {
                console.error(
                  "[AUTO-KITCHEN][Daemon] Nom d'imprimante Windows manquant dans la config.",
                  kitchenPrinter
                );
                return;
              }

              const body = {
                connectionType: 'windows',
                target: { printerName: kitchenPrinter.name },
                content: receiptText,
                isThermalPrinter: kitchenPrinter.isThermalPrinter ?? true,
                role: 'kitchen' as const,
              };

              console.log('[AUTO-KITCHEN][Daemon] Payload envoyé =', body);

              const response = await fetch(daemonUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              });

              if (!response.ok) {
                console.error(
                  '[AUTO-KITCHEN][Daemon] HTTP error =',
                  response.status
                );
                return;
              }

              const result = await response.json().catch(() => null);
              if (!result || result.success !== true) {
                console.error(
                  '[AUTO-KITCHEN][Daemon] Erreur côté daemon:',
                  result
                );
                return;
              }

              console.log(
                '✅ Kitchen ticket printed automatically via Windows daemon sur',
                kitchenPrinter.name
              );
            } else if (
              (effectiveConnectionType === 'tcp' ||
                effectiveConnectionType === 'wifi') &&
              kitchenPrinter.tcpHost
            ) {
              const body = {
                connectionType: effectiveConnectionType,
                target: {
                  host: kitchenPrinter.tcpHost,
                  port: kitchenPrinter.tcpPort || 9100,
                },
                content: receiptText,
                isThermalPrinter: kitchenPrinter.isThermalPrinter ?? true,
                role: 'kitchen' as const,
              };

              console.log('[AUTO-KITCHEN][Daemon] Payload TCP/WiFi envoyé =', body);

              const response = await fetch(daemonUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              });

              if (!response.ok) {
                console.error(
                  '[AUTO-KITCHEN][Daemon] HTTP error =',
                  response.status
                );
                return;
              }

              const result = await response.json().catch(() => null);
              if (!result || result.success !== true) {
                console.error(
                  '[AUTO-KITCHEN][Daemon] Erreur côté daemon:',
                  result
                );
                return;
              }

              console.log(
                '✅ Kitchen ticket printed automatically via Ethernet/Wi‑Fi sur',
                kitchenPrinter.name
              );
            } else {
              console.log(
                "[AUTO-KITCHEN] Type de connexion non supporté pour l'auto-impression cuisine:",
                effectiveConnectionType
              );
            }
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
      
      // Automatically print kitchen ticket after payment
      // This is non-blocking - if it fails, payment still succeeds
      printKitchenTicketAutomatically(paidOrderData).catch(err => {
        console.error('Kitchen ticket print failed (non-blocking):', err);
      });
      
      setStep('done');
      
      // Notify parent and close payment modal after short delay
      setTimeout(() => {
        if (onPaymentSuccess) {
          onPaymentSuccess(paidOrderData, paymentAmountReceived, paymentChange);
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
              Paiement Réussi!
            </h2>
            <p className="text-muted-foreground">
              Préparation du reçu...
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
                    title={!settings?.cardPaymentEnabled ? "Paiement par carte désactivé dans les paramètres" : undefined}
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
                        Désactivé
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
                    {method === 'cash' ? 'Continuer' : t('payment.confirm')}
                  </Button>
                  {method === 'card' && !settings?.cardPaymentEnabled && (
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      Le paiement par carte est désactivé. Activez-le dans les paramètres.
                    </p>
                  )}
                </div>
              </div>
            )}

            {step === 'cash' && (
              <div className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0 overscroll-contain">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    {t('payment.amountReceived')}
                  </label>
                  {/* Amount Display */}
                  <div className="mt-1 h-20 rounded-xl bg-muted border-2 border-border flex items-center justify-center">
                    <span className="text-4xl font-bold text-primary">
                      {formatCurrency(parseFloat(amountReceived) || 0, currency)}
                    </span>
                  </div>
                </div>

                {/* Quick amounts */}
                <div className="grid grid-cols-4 gap-2">
                  {quickAmounts.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setAmountReceived(amount.toString())}
                      className="py-3 rounded-lg bg-secondary hover:bg-secondary/80 font-medium transition-colors text-sm"
                    >
                      {formatCurrency(amount, currency)}
                    </button>
                  ))}
                </div>

                {/* Numeric Keypad */}
                <div className="grid grid-cols-3 gap-2">
                  {/* Row 1 */}
                  <button
                    onClick={() => handleNumberInput('7')}
                    className="h-16 text-2xl font-bold bg-background border-2 border-border rounded-xl hover:bg-muted active:bg-primary active:text-primary-foreground transition-colors touch-target"
                    type="button"
                  >
                    7
                  </button>
                  <button
                    onClick={() => handleNumberInput('8')}
                    className="h-16 text-2xl font-bold bg-background border-2 border-border rounded-xl hover:bg-muted active:bg-primary active:text-primary-foreground transition-colors touch-target"
                    type="button"
                  >
                    8
                  </button>
                  <button
                    onClick={() => handleNumberInput('9')}
                    className="h-16 text-2xl font-bold bg-background border-2 border-border rounded-xl hover:bg-muted active:bg-primary active:text-primary-foreground transition-colors touch-target"
                    type="button"
                  >
                    9
                  </button>

                  {/* Row 2 */}
                  <button
                    onClick={() => handleNumberInput('4')}
                    className="h-16 text-2xl font-bold bg-background border-2 border-border rounded-xl hover:bg-muted active:bg-primary active:text-primary-foreground transition-colors touch-target"
                    type="button"
                  >
                    4
                  </button>
                  <button
                    onClick={() => handleNumberInput('5')}
                    className="h-16 text-2xl font-bold bg-background border-2 border-border rounded-xl hover:bg-muted active:bg-primary active:text-primary-foreground transition-colors touch-target"
                    type="button"
                  >
                    5
                  </button>
                  <button
                    onClick={() => handleNumberInput('6')}
                    className="h-16 text-2xl font-bold bg-background border-2 border-border rounded-xl hover:bg-muted active:bg-primary active:text-primary-foreground transition-colors touch-target"
                    type="button"
                  >
                    6
                  </button>

                  {/* Row 3 */}
                  <button
                    onClick={() => handleNumberInput('1')}
                    className="h-16 text-2xl font-bold bg-background border-2 border-border rounded-xl hover:bg-muted active:bg-primary active:text-primary-foreground transition-colors touch-target"
                    type="button"
                  >
                    1
                  </button>
                  <button
                    onClick={() => handleNumberInput('2')}
                    className="h-16 text-2xl font-bold bg-background border-2 border-border rounded-xl hover:bg-muted active:bg-primary active:text-primary-foreground transition-colors touch-target"
                    type="button"
                  >
                    2
                  </button>
                  <button
                    onClick={() => handleNumberInput('3')}
                    className="h-16 text-2xl font-bold bg-background border-2 border-border rounded-xl hover:bg-muted active:bg-primary active:text-primary-foreground transition-colors touch-target"
                    type="button"
                  >
                    3
                  </button>

                  {/* Row 4 */}
                  <button
                    onClick={handleClear}
                    className="h-16 text-lg font-bold bg-destructive/10 border-2 border-destructive/20 rounded-xl hover:bg-destructive/20 active:bg-destructive text-destructive transition-colors touch-target flex items-center justify-center"
                    type="button"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleNumberInput('0')}
                    className="h-16 text-2xl font-bold bg-background border-2 border-border rounded-xl hover:bg-muted active:bg-primary active:text-primary-foreground transition-colors touch-target"
                    type="button"
                  >
                    0
                  </button>
                  <button
                    onClick={handleBackspace}
                    className="h-16 text-lg font-bold bg-secondary border-2 border-border rounded-xl hover:bg-secondary/80 active:bg-secondary/60 transition-colors touch-target flex items-center justify-center"
                    type="button"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                </div>

                {amountReceived && !isNaN(parseFloat(amountReceived)) && parseFloat(amountReceived) >= total && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-success/10 border border-success/20 rounded-xl text-center"
                  >
                    <span className="text-sm text-muted-foreground">{t('payment.change')}</span>
                    <div className="text-3xl font-bold text-success">
                      {formatCurrency(Math.max(0, change), currency)}
                    </div>
                  </motion.div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={() => setStep('method')}
                    variant="outline"
                    className="flex-1 h-14"
                  >
                    {t('general.cancel')}
                  </Button>
                  <Button
                    onClick={handlePayment}
                    disabled={!amountReceived || isNaN(parseFloat(amountReceived)) || parseFloat(amountReceived) < total}
                    className="flex-1 h-14 text-lg font-bold gradient-primary border-0"
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
