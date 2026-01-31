import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UtensilsCrossed, ShoppingBag, Truck, X, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TouchInput } from '@/components/ui/touch-input';
import { usePOS } from '@/contexts/POSContext';
import { OrderType } from '@/lib/database';

export interface DeliveryInfo {
  address: string;
  phone: string;
  customerName: string;
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
  });
  const [formError, setFormError] = useState('');

  if (!isOpen) return null;

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
      setFormError(t('order.deliveryCustomerName') + ' requis');
      return;
    }
    if (!address.trim()) {
      setFormError(t('order.deliveryAddress') + ' requise');
      return;
    }
    if (!phone.trim()) {
      setFormError(t('order.deliveryPhone') + ' requis');
      return;
    }
    onSelect('delivery', { address: address.trim(), phone: phone.trim(), customerName: customerName.trim() });
    onClose();
    resetState();
  };

  const resetState = () => {
    setStep('select');
    setDeliveryForm({ address: '', phone: '', customerName: '' });
    setFormError('');
  };

  const handleBack = () => {
    setStep('select');
    setFormError('');
  };

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
        className="bg-background rounded-lg shadow-lg p-6 max-w-md w-full"
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
                Renseignez les informations de livraison
              </p>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium block mb-1">
                    {t('order.deliveryCustomerName')} *
                  </label>
                  <TouchInput
                    value={deliveryForm.customerName}
                    onChange={(value) => setDeliveryForm((f) => ({ ...f, customerName: value }))}
                    placeholder="Nom du client"
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
                    placeholder="06 12 34 56 78"
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
                    placeholder="123 rue Example, 75001 Paris"
                    showQuickSuggestions={true}
                    quickSuggestions={['Rue', 'Avenue', 'Boulevard', 'Place', 'Allée', 'Chemin', 'Impasse', 'Cours']}
                    className="h-11"
                  />
                </div>
              </div>

              {formError && (
                <p className="text-sm text-destructive">{formError}</p>
              )}

              <Button
                onClick={handleDeliverySubmit}
                className="w-full mt-4"
              >
                Valider la livraison
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
