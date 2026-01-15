import { useState } from 'react';
import { usePOS } from '@/contexts/POSContext';
import { OrderLine } from '@/lib/database';
import { motion } from 'framer-motion';
import { X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TouchTextarea } from '@/components/ui/touch-textarea';
import { TouchInput } from '@/components/ui/touch-input';
import { NumericInput } from '@/components/ui/numeric-input';
import { generateUUID } from '@/lib/utils';

interface ManualItemModalProps {
  onClose: () => void;
}

export function ManualItemModal({ onClose }: ManualItemModalProps) {
  const { addToCart, t } = usePOS();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!name.trim()) {
      setError(t('manual.nameRequired'));
      return;
    }
    
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      setError(t('manual.invalidPrice'));
      return;
    }

    const orderLine: OrderLine = {
      id: generateUUID(),
      productName: name.trim(),
      quantity,
      unitPrice: priceNum,
      modifiers: [],
      note: note.trim() || undefined,
      isManual: true,
    };

    addToCart(orderLine);
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
        className="bg-card rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-xl font-bold">{t('manual.title')}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-accent rounded-xl transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <div className="p-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              {t('manual.name')} *
            </label>
            <TouchInput
              value={name}
              onChange={setName}
              placeholder={t('manual.namePlaceholder')}
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">
              {t('manual.price')} *
            </label>
            <NumericInput
              value={price}
              onChange={setPrice}
              placeholder="0"
              className="mt-1 h-12 text-lg"
              min={0}
              step={1}
              allowDecimal={true}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">
              {t('order.quantity')}
            </label>
            <div className="flex items-center gap-4 mt-1">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center hover:bg-secondary/80"
              >
                -
              </button>
              <span className="text-2xl font-bold min-w-[40px] text-center">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center hover:bg-secondary/80"
              >
                +
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">
              {t('order.note')}
            </label>
            <TouchTextarea
              value={note}
              onChange={setNote}
              placeholder={t('product.optionalNote')}
              rows={2}
              showQuickSuggestions={true}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <Button
            onClick={handleSubmit}
            className="w-full h-14 text-lg font-bold gradient-primary border-0"
          >
            <Plus className="w-6 h-6 mr-2" />
            {t('manual.add')}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
