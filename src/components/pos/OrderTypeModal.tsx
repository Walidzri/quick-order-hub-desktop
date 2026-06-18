import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UtensilsCrossed, ShoppingBag, Truck, X, ChevronLeft, Delete } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TouchInput } from '@/components/ui/touch-input';
import { usePOS } from '@/contexts/POSContext';
import { OrderType } from '@shared/types';

export interface DeliveryInfo {
  address: string;
  phone: string;
  customerName: string;
  fee?: number;
}

interface OrderTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (type: OrderType, deliveryInfo?: DeliveryInfo) => void;
  /** Valeurs initiales pour le formulaire livraison (édition) */
  initialDeliveryInfo?: DeliveryInfo;
}

export function OrderTypeModal({ isOpen, onClose, onSelect, initialDeliveryInfo }: OrderTypeModalProps) {
  const { t } = usePOS();
  const [step, setStep] = useState<'select' | 'delivery-form'>('select');
  const [deliveryForm, setDeliveryForm] = useState<DeliveryInfo>({
    address: initialDeliveryInfo?.address ?? '',
    phone: initialDeliveryInfo?.phone ?? '',
    customerName: initialDeliveryInfo?.customerName ?? '',
    fee: initialDeliveryInfo?.fee,
  });
  const [formError, setFormError] = useState('');
  const [showFeeKeypad, setShowFeeKeypad] = useState(false);
  const [feeRaw, setFeeRaw] = useState<string>(
    initialDeliveryInfo?.fee !== undefined ? String(initialDeliveryInfo.fee) : ''
  );

  if (!isOpen) return null;

  // ── Pavé numérique frais de livraison ──────────────────────────────────────

  const handleFeeKey = (key: string) => {
    // Une seule virgule autorisée
    if (key === ',' && (feeRaw.includes(',') || feeRaw.includes('.'))) return;
    // Max 8 caractères
    if (feeRaw.length >= 8) return;
    const next = feeRaw + key;
    setFeeRaw(next);
    const parsed = parseFloat(next.replace(',', '.'));
    setDeliveryForm(f => ({ ...f, fee: isNaN(parsed) ? undefined : parsed }));
  };

  const handleFeeBackspace = () => {
    const next = feeRaw.slice(0, -1);
    setFeeRaw(next);
    const parsed = parseFloat(next.replace(',', '.'));
    setDeliveryForm(f => ({ ...f, fee: next && !isNaN(parsed) ? parsed : undefined }));
  };

  const handleFeeClear = () => {
    setFeeRaw('');
    setDeliveryForm(f => ({ ...f, fee: undefined }));
  };

  // ── Handlers formulaire ────────────────────────────────────────────────────

  const handleDineIn = () => {
    onSelect('dine-in');
    onClose();
    resetState();
  };

  const handleTakeaway = () => {
    onSelect('takeaway');
    onClose();
    resetState();
  };

  const handleDeliveryClick = () => {
    setStep('delivery-form');
    setFormError('');
  };

  const handleDeliverySubmit = () => {
    const { address, phone, customerName } = deliveryForm;
    if (!customerName.trim()) {
      setFormError(t('order.deliveryCustomerName') + ' ' + t('general.required'));
      return;
    }
    if (!address.trim()) {
      setFormError(t('order.deliveryAddress') + ' ' + t('general.requiredFem'));
      return;
    }
    if (!phone.trim()) {
      setFormError(t('order.deliveryPhone') + ' ' + t('general.required'));
      return;
    }
    onSelect('delivery', { address: address.trim(), phone: phone.trim(), customerName: customerName.trim(), fee: deliveryForm.fee });
    onClose();
    resetState();
  };

  const resetState = () => {
    setStep('select');
    setDeliveryForm({ address: '', phone: '', customerName: '', fee: undefined });
    setFeeRaw('');
    setShowFeeKeypad(false);
    setFormError('');
  };

  const handleBack = () => {
    setStep('select');
    setShowFeeKeypad(false);
    setFormError('');
  };

  // ── Rendu ──────────────────────────────────────────────────────────────────

  const feeDisplayValue = feeRaw || '';

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
        className="bg-background rounded-lg shadow-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <AnimatePresence mode="wait">
          {step === 'select' ? (
            <motion.div
              key="select"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">{t('order.selectType') || 'Type de commande'}</h2>
                <button
                  onClick={onClose}
                  className="p-1 hover:bg-muted rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <button
                onClick={handleDineIn}
                className="w-full p-6 rounded-lg border-2 border-muted hover:border-primary hover:bg-primary/5 transition-all active:scale-95"
              >
                <div className="flex items-center gap-4">
                  <UtensilsCrossed className="w-8 h-8 text-primary" />
                  <div className="text-left">
                    <div className="font-bold text-lg">{t('order.dineIn') || 'Sur place'}</div>
                    <div className="text-sm text-muted-foreground">{t('order.dineInDesc') || 'À manger sur place'}</div>
                  </div>
                </div>
              </button>

              <button
                onClick={handleTakeaway}
                className="w-full p-6 rounded-lg border-2 border-muted hover:border-primary hover:bg-primary/5 transition-all active:scale-95"
              >
                <div className="flex items-center gap-4">
                  <ShoppingBag className="w-8 h-8 text-primary" />
                  <div className="text-left">
                    <div className="font-bold text-lg">{t('order.takeaway') || 'À emporter'}</div>
                    <div className="text-sm text-muted-foreground">{t('order.takeawayDesc') || 'À emporter'}</div>
                  </div>
                </div>
              </button>

              <button
                onClick={handleDeliveryClick}
                className="w-full p-6 rounded-lg border-2 border-muted hover:border-primary hover:bg-primary/5 transition-all active:scale-95"
              >
                <div className="flex items-center gap-4">
                  <Truck className="w-8 h-8 text-primary" />
                  <div className="text-left">
                    <div className="font-bold text-lg">{t('order.delivery') || 'Livraison'}</div>
                    <div className="text-sm text-muted-foreground">{t('order.deliveryDesc') || 'À livrer à domicile'}</div>
                  </div>
                </div>
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="delivery-form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={handleBack}
                  className="p-1 hover:bg-muted rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-xl font-bold">{t('order.delivery') || 'Livraison'}</h2>
                <button
                  onClick={onClose}
                  className="p-1 hover:bg-muted rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm text-muted-foreground mb-4">
                {t('order.deliveryFormInfo')}
              </p>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium block mb-1">
                    {t('order.deliveryCustomerName')} *
                  </label>
                  <TouchInput
                    value={deliveryForm.customerName}
                    onChange={(value) => setDeliveryForm((f) => ({ ...f, customerName: value }))}
                    placeholder={t('order.deliveryCustomerNamePlaceholder')}
                    showQuickSuggestions={false}
                    className="h-11"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">
                    {t('order.deliveryPhone')} *
                  </label>
                  <TouchInput
                    value={deliveryForm.phone}
                    onChange={(value) => setDeliveryForm((f) => ({ ...f, phone: value }))}
                    placeholder={t('order.deliveryPhonePlaceholder')}
                    showQuickSuggestions={false}
                    className="h-11"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">
                    {t('order.deliveryAddress')} *
                  </label>
                  <TouchInput
                    value={deliveryForm.address}
                    onChange={(value) => setDeliveryForm((f) => ({ ...f, address: value }))}
                    placeholder={t('order.deliveryAddressPlaceholder')}
                    showQuickSuggestions={true}
                    quickSuggestions={['Rue', 'Avenue', 'Boulevard', 'Place', 'Allée', 'Chemin', 'Impasse', 'Cours']}
                    className="h-11"
                  />
                </div>

                {/* Frais de livraison — affichage + pavé numérique */}
                <div>
                  <label className="text-sm font-medium block mb-1">
                    {t('order.deliveryFee')}
                  </label>

                  {/* Champ d'affichage tactile */}
                  <button
                    type="button"
                    onClick={() => setShowFeeKeypad(v => !v)}
                    className={`w-full h-11 px-3 rounded-md border text-left font-mono text-base transition-colors ${
                      showFeeKeypad
                        ? 'border-primary ring-2 ring-primary/30 bg-background'
                        : 'border-input bg-background hover:border-primary/50'
                    }`}
                  >
                    {feeDisplayValue
                      ? <span>{feeDisplayValue}</span>
                      : <span className="text-muted-foreground">0</span>
                    }
                  </button>

                  {/* Pavé numérique */}
                  {showFeeKeypad && (
                    <div className="mt-2 p-2 bg-muted/30 rounded-lg border border-border">
                      <div className="grid grid-cols-3 gap-1.5">
                        {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => handleFeeKey(String(n))}
                            className="h-11 text-lg font-bold bg-background border border-border rounded-lg hover:bg-muted active:bg-primary active:text-primary-foreground transition-colors"
                          >
                            {n}
                          </button>
                        ))}
                        {/* Dernière ligne : virgule / 0 / effacer */}
                        <button
                          type="button"
                          onClick={() => handleFeeKey(',')}
                          className="h-11 text-lg font-bold bg-background border border-border rounded-lg hover:bg-muted active:bg-primary active:text-primary-foreground transition-colors"
                        >
                          ,
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFeeKey('0')}
                          className="h-11 text-lg font-bold bg-background border border-border rounded-lg hover:bg-muted active:bg-primary active:text-primary-foreground transition-colors"
                        >
                          0
                        </button>
                        <button
                          type="button"
                          onClick={handleFeeBackspace}
                          className="h-11 flex items-center justify-center rounded-lg bg-secondary border border-border hover:bg-secondary/80 active:bg-destructive active:text-destructive-foreground transition-colors"
                        >
                          <Delete className="w-4 h-4" />
                        </button>
                      </div>
                      {/* Bouton effacer tout */}
                      {feeRaw && (
                        <button
                          type="button"
                          onClick={handleFeeClear}
                          className="w-full mt-1.5 h-8 text-xs text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                        >
                          Effacer
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {formError && (
                <p className="text-sm text-destructive">{formError}</p>
              )}

              <Button
                onClick={handleDeliverySubmit}
                className="w-full mt-4"
              >
                {t('order.validateDelivery')}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {step === 'select' && (
          <Button
            variant="outline"
            className="w-full mt-6"
            onClick={onClose}
          >
            {t('general.cancel') || 'Annuler'}
          </Button>
        )}
      </motion.div>
    </motion.div>
  );
}
