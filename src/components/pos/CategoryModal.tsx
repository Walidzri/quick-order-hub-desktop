import { useState, useEffect } from 'react';
import { Category, Product } from '@shared/types';
import { motion } from 'framer-motion';
import { X, Save, Upload, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TouchInput } from '@/components/ui/touch-input';
import { NumericInput } from '@/components/ui/numeric-input';
import { Checkbox } from '@/components/ui/checkbox';
import { generateUUID } from '@/lib/utils';
import { usePOS } from '@/contexts/POSContext';

interface CategoryModalProps {
  category: Category | null;
  supplements?: Product[];
  onClose: () => void;
  onSave: (category: Category) => Promise<void>;
}

export function CategoryModal({ category, supplements: supplementsProp = [], onClose, onSave }: CategoryModalProps) {
  const { t, products, getProductsByCategory } = usePOS();
  const [name, setName] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  const [icon, setIcon] = useState('');
  const [image, setImage] = useState<string | undefined>(undefined);
  const [selectedSupplementIds, setSelectedSupplementIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  
  // Récupérer tous les suppléments depuis le contexte POS (comme dans ProductModal)
  const supplements = (() => {
    // Utiliser getProductsByCategory comme dans ProductModal
    const availableSupplements = getProductsByCategory('supplements');
    // Ajouter aussi les suppléments non disponibles depuis products
    const unavailableSupplements = products.filter(p => 
      p.categoryId === 'supplements' && p.available === false
    );
    // Combiner et dédupliquer
    const all = [...availableSupplements, ...unavailableSupplements];
    const unique = all.filter((s, index, self) => 
      self.findIndex(item => item.id === s.id) === index
    );
    return unique.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  })();

  useEffect(() => {
    if (category) {
      setName(category.name);
      setSortOrder(category.sortOrder);
      setIcon(category.icon || '');
      setImage(category.image);
      setSelectedSupplementIds(category.supplementIds || []);
    } else {
      setName('');
      setSortOrder(0);
      setIcon('');
      setImage(undefined);
      setSelectedSupplementIds([]);
    }
    setError('');
  }, [category]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError(t('general.nameRequired'));
      return;
    }

    if (sortOrder < 0) {
      setError(t('general.orderMustBePositive'));
      return;
    }

    try {
      const categoryToSave: Category = {
        id: category?.id || generateUUID(),
        name: name.trim(),
        sortOrder: sortOrder,
        icon: icon.trim() || undefined,
        image: image || undefined,
        supplementIds: selectedSupplementIds.length > 0 ? selectedSupplementIds : undefined,
      };

      await onSave(categoryToSave);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('general.errorOccurred'));
    }
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
        className="bg-card rounded-2xl w-full max-w-md max-h-[95vh] sm:max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-xl font-bold">
            {category ? t('products.edit') : t('category.add')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-accent rounded-xl transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0 overscroll-contain">
          {/* Image Upload */}
          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-2">
              {t('category.image')}
            </label>
            {image ? (
              <div className="relative">
                <img 
                  src={image} 
                  alt={name || t('general.category')} 
                  className="w-full h-48 object-cover rounded-lg border-2 border-border"
                />
                <button
                  onClick={() => setImage(undefined)}
                  className="absolute top-2 right-2 p-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      // Check file size (max 2MB)
                      if (file.size > 2 * 1024 * 1024) {
                        setError(t('category.imageTooLarge'));
                        return;
                      }
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setImage(reader.result as string);
                        setError('');
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="hidden"
                  id="category-image-upload"
                />
                <label
                  htmlFor="category-image-upload"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <Upload className="w-8 h-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {t('category.imageUpload')}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t('category.imageFormat')}
                  </span>
                </label>
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">
              {t('category.name')} *
            </label>
            <TouchInput
              value={name}
              onChange={setName}
              placeholder={t('category.namePlaceholder')}
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">
              {t('category.icon')}
            </label>
            <TouchInput
              value={icon}
              onChange={setIcon}
              placeholder={t('category.iconPlaceholder')}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t('category.iconDesc')}
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">
              {t('category.sortOrder')}
            </label>
            <NumericInput
              value={sortOrder}
              onChange={(value) => setSortOrder(parseInt(value) || 0)}
              className="mt-1 h-12"
              min={0}
              allowDecimal={false}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t('category.sortOrderDesc')}
            </p>
          </div>

          {/* Supplements Association - Only for non-supplement categories */}
          {(category === null || category.id !== 'supplements') && (
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-3">
                {t('category.associatedSupplements')}
              </label>
              <p className="text-xs text-muted-foreground mb-3">
                {t('category.associatedSupplementsDesc')}
              </p>
              {supplements.length > 0 ? (
                <div className="border border-border rounded-lg max-h-[40vh] sm:max-h-64 overflow-y-auto overscroll-contain">
                  <div className="p-3 space-y-2">
                    {supplements.map((supplement) => {
                      const isSelected = selectedSupplementIds.includes(supplement.id);
                      return (
                        <div
                          key={supplement.id}
                          className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded-lg transition-colors"
                        >
                          <Checkbox
                            id={`category-supplement-${supplement.id}`}
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedSupplementIds([...selectedSupplementIds, supplement.id]);
                              } else {
                                setSelectedSupplementIds(selectedSupplementIds.filter(id => id !== supplement.id));
                              }
                            }}
                          />
                          <label
                            htmlFor={`category-supplement-${supplement.id}`}
                            className="flex-1 cursor-pointer text-sm font-medium"
                          >
                            {supplement.name}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="border border-border rounded-lg p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    {t('category.noSupplements')}
                  </p>
                </div>
              )}
              {selectedSupplementIds.length === 0 && supplements.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2 italic">
                  {t('category.noSupplementsSelected')}
                </p>
              )}
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        {/* Footer - Always visible at bottom */}
        <div className="p-3 sm:p-4 border-t border-border flex gap-2 flex-shrink-0 sticky bottom-0 bg-card">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1"
          >
            {t('general.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            className="flex-1 gap-2"
          >
            <Save className="w-4 h-4" />
            {category ? t('general.save') : t('general.add')}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
