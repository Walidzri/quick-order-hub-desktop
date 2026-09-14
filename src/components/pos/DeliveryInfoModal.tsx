import { useState } from 'react';
import { motion } from 'framer-motion';
import { Truck, X, Delete } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TouchInput } from '@/components/ui/touch-input';
import { usePOS } from '@/contexts/POSContext';

export interface DeliveryInfo {
  address: string;
  phone: string;
  customerName: string;
  fee?: number;
}

interface DeliveryInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (info: DeliveryInfo) => void;
  initialInfo?: DeliveryInfo;
}

export function DeliveryInfoModal({ isOpen, onClose, onSubmit, initialInfo }: DeliveryInfoModalProps) {
  const { t } = usePOS();
  const [deliveryForm, setDeliveryForm] = useState<DeliveryInfo>({
    address: initialInfo?.address ?? '',
    phone: initialInfo?.phone ?? '',
    customerName: initialInfo?.customerName ?? '',
    fee: initialInfo?.fee,
  });
  const [formError, setFormError] = useState('');
  const [showFeeKeypad, setShowFeeKeypad] = useState(false);
  const [feeRaw, setFeeRaw] = useState<string>(
    initialInfo?.fee !== undefined ? String(initialInfo.fee) : ''
  );

  if (!isOpen) return null;

  const handleFeeKey = (key: string) => {
    if (key === ',' && (feeRaw.includes(',') || feeRaw.includes('.'))) return;
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

  const handleSubmit = () => {
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
    onSubmit({
      address: address.trim(),
      phone: phone.trim(),
      customerName: customerName.trim(),
      fee: deliveryForm.fee,
    });
  };

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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" />
            {t('order.delivery')}
          </h2>
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

          {/* Frais de livraison — pavé numérique */}
          <div>
            <label className="text-sm font-medium block mb-1">
              {t('order.deliveryFee')}
            </label>

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
          <p className="text-sm text-destructive mt-3">{formError}</p>
        )}

        <Button
          onClick={handleSubmit}
          className="w-full mt-4"
        >
          {t('order.validateDelivery')}
        </Button>
      </motion.div>
    </motion.div>
  );
}
