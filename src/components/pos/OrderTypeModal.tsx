import { motion } from 'framer-motion';
import { UtensilsCrossed, ShoppingBag, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePOS } from '@/contexts/POSContext';
import { OrderType } from '@/lib/database';

interface OrderTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (type: OrderType) => void;
}

export function OrderTypeModal({ isOpen, onClose, onSelect }: OrderTypeModalProps) {
  const { t } = usePOS();

  if (!isOpen) return null;

  const handleDineIn = () => {
    onSelect('dine-in');
    onClose();
  };

  const handleTakeaway = () => {
    onSelect('takeaway');
    onClose();
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
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">{t('order.selectType') || 'Type de commande'}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
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
        </div>

        <Button
          variant="outline"
          className="w-full mt-6"
          onClick={onClose}
        >
          {t('general.cancel') || 'Annuler'}
        </Button>
      </motion.div>
    </motion.div>
  );
}
