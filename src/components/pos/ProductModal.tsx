import { useState, useMemo, useEffect } from 'react';
import { usePOS } from '@/contexts/POSContext';
import { Product, ProductVariant, OrderLine, OrderLineModifier } from '@shared/types';
import { formatCurrency } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Minus, Plus, MessageSquare, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TouchTextarea } from '@/components/ui/touch-textarea';
import { cn, generateUUID } from '@/lib/utils';

interface ProductModalProps {
  product: Product;
  variants: ProductVariant[];
  onClose: () => void;
}

interface SelectedSupplement {
  supplementProduct: Product;
  supplementVariant: ProductVariant | null;
  price: number;
}

export function ProductModal({ product, variants, onClose }: ProductModalProps) {
  const { addToCart, currency, t, categories, products, getVariantsByProduct, getProductsByCategory } = usePOS();
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    variants.length === 1 ? variants[0] : null
  );
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [selectedSupplements, setSelectedSupplements] = useState<Map<string, SelectedSupplement>>(new Map());

  // Get supplements category products filtered by product, category, and supplement associations
  const supplementsProducts = useMemo(() => {
    const allSupplements = getProductsByCategory('supplements');
    const productCategory = categories.find(cat => cat.id === product.categoryId);
    
    // Collect all available supplement IDs from different sources
    const availableSupplementIds = new Set<string>();
    
    // 1. Supplements explicitly associated with the product
    if (product.supplementIds && product.supplementIds.length > 0) {
      product.supplementIds.forEach(id => availableSupplementIds.add(id));
    }
    
    // 2. Supplements associated with the category
    if (productCategory?.supplementIds && productCategory.supplementIds.length > 0) {
      productCategory.supplementIds.forEach(id => availableSupplementIds.add(id));
    }
    
    // 3. Supplements that have this product in their productIds list
    allSupplements.forEach(supplement => {
      if (supplement.productIds && supplement.productIds.includes(product.id)) {
        availableSupplementIds.add(supplement.id);
      }
    });
    
    // Filter supplements based on collected IDs
    return allSupplements.filter(sup => availableSupplementIds.has(sup.id));
  }, [getProductsByCategory, categories, product.categoryId, product.id, product.supplementIds]);

  const hasVariants = variants.length > 0;
  const basePrice = hasVariants 
    ? (selectedVariant?.price || 0) 
    : (product.basePrice || 0);
  
  // Calculate supplements total
  const supplementsTotal = Array.from(selectedSupplements.values()).reduce((sum, sup) => sum + sup.price, 0);
  
  const currentPrice = basePrice + supplementsTotal;
  const totalPrice = currentPrice * quantity;

  // Get matching supplement variant based on selected product variant size
  const getSupplementPriceForSize = (supplementProduct: Product, supplementVariants: ProductVariant[], selectedSize: string | undefined): number => {
    if (supplementVariants.length === 0) {
      return supplementProduct.basePrice || 0;
    }
    
    // If we have a selected size, try to find matching supplement variant
    if (selectedSize) {
      // Try exact match first
      let matchingVariant = supplementVariants.find(v => v.size === selectedSize);
      
      // If no exact match, try to match by common sizes (L, XL, XXL, etc.)
      if (!matchingVariant && (selectedSize === 'L' || selectedSize === 'XL' || selectedSize === 'XXL' || selectedSize === 'XXXL')) {
        matchingVariant = supplementVariants.find(v => 
          v.size === selectedSize || 
          (selectedSize === 'L' && ['L', 'petite'].includes(v.size)) ||
          (selectedSize === 'XL' && ['XL', 'grande'].includes(v.size))
        );
      }
      
      if (matchingVariant) {
        return matchingVariant.price;
      }
    }
    
    // Default: return the first variant price or base price
    return supplementVariants[0]?.price || supplementProduct.basePrice || 0;
  };

  // Toggle supplement selection
  const toggleSupplement = (supplementProduct: Product) => {
    const supplementVariants = getVariantsByProduct(supplementProduct.id);
    const supplementId = supplementProduct.id;

    if (selectedSupplements.has(supplementId)) {
      // Remove supplement
      const newMap = new Map(selectedSupplements);
      newMap.delete(supplementId);
      setSelectedSupplements(newMap);
    } else {
      // Add supplement - match size with selected product variant if possible
      const selectedSize = selectedVariant?.size;
      const price = getSupplementPriceForSize(supplementProduct, supplementVariants, selectedSize);
      
      // Find the variant that matches the price (for display)
      let matchingVariant: ProductVariant | null = null;
      if (supplementVariants.length > 0 && selectedSize) {
        matchingVariant = supplementVariants.find(v => {
          if (v.size === selectedSize) return true;
          // Fallback matching
          if (selectedSize === 'L' && ['L', 'petite'].includes(v.size)) return true;
          if (selectedSize === 'XL' && ['XL', 'grande'].includes(v.size)) return true;
          return v.price === price;
        }) || supplementVariants.find(v => v.price === price) || null;
      } else if (supplementVariants.length === 1) {
        matchingVariant = supplementVariants[0];
      }

      const newMap = new Map(selectedSupplements);
      newMap.set(supplementId, {
        supplementProduct,
        supplementVariant: matchingVariant,
        price,
      });
      setSelectedSupplements(newMap);
    }
  };

  // Update supplement prices when variant size changes
  useEffect(() => {
    if (selectedVariant && selectedSupplements.size > 0) {
      setSelectedSupplements(prev => {
        const newMap = new Map(prev);
        prev.forEach((sup, id) => {
          const supplementVariants = getVariantsByProduct(sup.supplementProduct.id);
          const newPrice = getSupplementPriceForSize(sup.supplementProduct, supplementVariants, selectedVariant.size);
          const matchingVariant = supplementVariants.find(v => {
            if (v.size === selectedVariant.size) return true;
            if (selectedVariant.size === 'L' && ['L', 'petite'].includes(v.size)) return true;
            if (selectedVariant.size === 'XL' && ['XL', 'grande'].includes(v.size)) return true;
            return v.price === newPrice;
          }) || supplementVariants.find(v => v.price === newPrice) || sup.supplementVariant;
          
          newMap.set(id, {
            ...sup,
            supplementVariant: matchingVariant,
            price: newPrice,
          });
        });
        return newMap;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVariant?.size]);

  // Get category name to prefix product name
  const category = categories.find(cat => cat.id === product.categoryId);
  const productNameWithCategory = category 
    ? `${category.name} ${product.name}`
    : product.name;

  const handleAdd = () => {
    // Convert selected supplements to modifiers
    const modifiers: OrderLineModifier[] = Array.from(selectedSupplements.values()).map(sup => ({
      optionId: sup.supplementVariant?.id || sup.supplementProduct.id,
      optionName: sup.supplementProduct.name + (sup.supplementVariant ? ` (${sup.supplementVariant.size})` : ''),
      priceAdjustment: sup.price,
    }));

    const orderLine: OrderLine = {
      id: generateUUID(),
      productId: product.id,
      productName: productNameWithCategory,
      categoryId: product.categoryId, // For category breakdown in reports
      variantId: selectedVariant?.id,
      variantSize: selectedVariant?.size,
      quantity,
      unitPrice: basePrice, // Base price without supplements
      modifiers,
      note: note.trim() || undefined,
      isManual: false,
    };
    
    addToCart(orderLine);
    onClose();
  };

  const canAdd = !hasVariants || selectedVariant !== null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className={cn(
            "bg-card rounded-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden shadow-2xl flex flex-col",
            supplementsProducts.length > 0 ? "max-w-6xl" : "max-w-lg"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
            <h2 className="text-xl font-bold text-card-foreground">{product.name}</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-accent rounded-xl transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Product Image */}
          {product.image && (
            <div className="w-full h-48 bg-muted overflow-hidden flex-shrink-0">
              <img 
                src={product.image} 
                alt={product.name} 
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Content */}
          <div className="p-4 overflow-y-auto flex-1 min-h-0">
            {/* Size selection */}
            {hasVariants && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  {t('order.size')}
                </h3>
                <div className="grid grid-cols-2 gap-2 max-w-md">
                  {variants.map((variant) => (
                    <button
                      key={variant.id}
                      onClick={() => setSelectedVariant(variant)}
                      className={cn(
                        "p-4 rounded-xl border-2 transition-all duration-200 text-left",
                        selectedVariant?.id === variant.id
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className="font-bold text-lg">{variant.size}</div>
                      <div className="text-primary font-semibold">
                        {formatCurrency(variant.price, currency)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Supplements - Full width grid */}
            {supplementsProducts.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  Suppléments
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                  {supplementsProducts.map((supplement) => {
                    const supplementVariants = getVariantsByProduct(supplement.id);
                    const isSelected = selectedSupplements.has(supplement.id);
                    const selectedSup = selectedSupplements.get(supplement.id);
                    // Use actual selected price if available, otherwise calculate based on selected variant size
                    const supplementPrice = selectedSup?.price || 
                      getSupplementPriceForSize(supplement, supplementVariants, selectedVariant?.size);

                    return (
                      <button
                        key={supplement.id}
                        onClick={() => toggleSupplement(supplement)}
                        className={cn(
                          "p-3 sm:p-4 rounded-xl border-2 transition-all duration-200 text-left relative touch-target",
                          "flex items-center justify-between gap-3",
                          isSelected
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50 active:bg-muted/50"
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm flex items-center gap-2">
                            {supplement.name}
                            {isSelected && (
                              <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                                <Check className="w-3 h-3 text-primary-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="text-xs sm:text-sm text-primary font-semibold mt-1">
                            {formatCurrency(supplementPrice, currency)}
                            {supplementVariants.length > 1 && !isSelected && selectedVariant && (
                              <span className="text-muted-foreground text-xs"> ({selectedVariant.size})</span>
                            )}
                          </div>
                        </div>
                        {!isSelected && (
                          <div className="w-6 h-6 rounded-full border-2 border-border flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quantity */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                {t('order.quantity')}
              </h3>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="touch-target rounded-xl bg-secondary hover:bg-secondary/80 transition-colors"
                  disabled={quantity <= 1}
                >
                  <Minus className="w-6 h-6" />
                </button>
                <span className="text-3xl font-bold min-w-[60px] text-center">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="touch-target rounded-xl bg-secondary hover:bg-secondary/80 transition-colors"
                >
                  <Plus className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Note */}
            <div>
              <button
                onClick={() => setShowNote(!showNote)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                <span>{t('product.addNote')}</span>
              </button>
              
              {showNote && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  className="mt-2"
                >
                  <TouchTextarea
                    value={note}
                    onChange={setNote}
                    placeholder={t('product.specialInstructions')}
                    rows={2}
                    showQuickSuggestions={true}
                    quickSuggestions={[
                      'Sans oignon',
                      'Sans tomate',
                      'Sans sauce',
                      'Extra sauce',
                      'Bien cuit',
                      'Pas trop cuit',
                      'Sans piment',
                      'Avec piment',
                    ]}
                  />
                </motion.div>
              )}
            </div>
          </div>

          {/* Footer - Always visible at bottom */}
          <div className="p-3 sm:p-4 border-t border-border bg-muted/30 flex-shrink-0 sticky bottom-0">
            <div className="max-w-md mx-auto">
              {selectedSupplements.size > 0 && (
                <div className="mb-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('product.product')}:</span>
                    <span>{formatCurrency(basePrice * quantity, currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('product.supplements')}:</span>
                    <span>{formatCurrency(supplementsTotal * quantity, currency)}</span>
                  </div>
                </div>
              )}
              <Button
                onClick={handleAdd}
                disabled={!canAdd}
                className="w-full h-14 sm:h-16 text-base sm:text-lg font-bold gradient-primary border-0"
              >
                <span className="flex-1">{t('order.addToCart')}</span>
                <span className="px-4 py-1 bg-white/20 rounded-lg">
                  {formatCurrency(totalPrice, currency)}
                </span>
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
