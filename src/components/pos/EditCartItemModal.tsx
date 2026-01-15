import { useState, useMemo, useEffect } from 'react';
import { OrderLine, OrderLineModifier, Product, ProductVariant } from '@/lib/database';
import { usePOS } from '@/contexts/POSContext';
import { formatCurrency } from '@/lib/i18n';
import { motion } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, generateUUID } from '@/lib/utils';

interface EditCartItemModalProps {
  item: OrderLine;
  onClose: () => void;
  onSave: (updates: { modifiers: OrderLineModifier[]; variantId?: string; variantSize?: string; unitPrice: number }) => void;
}

interface SelectedSupplement {
  supplementProduct: Product;
  supplementVariant: ProductVariant | null;
  price: number;
}

export function EditCartItemModal({ item, onClose, onSave }: EditCartItemModalProps) {
  const { products, getVariantsByProduct, getProductsByCategory, categories, currency, t } = usePOS();
  
  // Find the original product
  const product = item.productId ? products.find(p => p.id === item.productId) : null;
  const allVariants = product ? getVariantsByProduct(product.id) : [];
  const hasVariants = allVariants.length > 0;
  
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    item.variantId ? allVariants.find(v => v.id === item.variantId) || null : null
  );
  const [selectedSupplements, setSelectedSupplements] = useState<Map<string, SelectedSupplement>>(new Map());

  // Get supplements category products filtered by product, category, and supplement associations
  const supplementsProducts = useMemo(() => {
    if (!product) return [];
    
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
  }, [getProductsByCategory, categories, product?.categoryId, product?.id, product?.supplementIds]);

  // Initialize selected supplements from existing modifiers
  useEffect(() => {
    if (!product || item.modifiers.length === 0) return;
    
    const initialSupplements = new Map<string, SelectedSupplement>();
    const currentSize = selectedVariant?.size || item.variantSize;
    
    item.modifiers.forEach(modifier => {
      // Try to find the supplement product by optionId or optionName
      const supplementProduct = supplementsProducts.find(sup => 
        sup.id === modifier.optionId || 
        modifier.optionName.includes(sup.name)
      );
      
      if (supplementProduct) {
        const supplementVariants = getVariantsByProduct(supplementProduct.id);
        // Try to match variant by size if available
        let matchingVariant: ProductVariant | null = null;
        if (currentSize && supplementVariants.length > 0) {
          matchingVariant = supplementVariants.find(v => {
            if (v.size === currentSize) return true;
            if (currentSize === 'L' && ['L', 'petite'].includes(v.size)) return true;
            if (currentSize === 'XL' && ['XL', 'grande'].includes(v.size)) return true;
            return v.price === modifier.priceAdjustment;
          }) || supplementVariants.find(v => v.price === modifier.priceAdjustment) || null;
        } else if (supplementVariants.length === 1) {
          matchingVariant = supplementVariants[0];
        }
        
        initialSupplements.set(supplementProduct.id, {
          supplementProduct,
          supplementVariant: matchingVariant,
          price: modifier.priceAdjustment,
        });
      }
    });
    
    setSelectedSupplements(initialSupplements);
  }, [product, item.modifiers, selectedVariant?.size, item.variantSize, supplementsProducts, getVariantsByProduct]);

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

  // Get matching supplement variant based on selected product variant size
  const getSupplementPriceForSize = (supplementProduct: Product, supplementVariants: ProductVariant[], selectedSize: string | undefined): number => {
    if (supplementVariants.length === 0) {
      return supplementProduct.basePrice || 0;
    }
    
    if (selectedSize) {
      let matchingVariant = supplementVariants.find(v => v.size === selectedSize);
      
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
      const selectedSize = selectedVariant?.size || item.variantSize;
      const price = getSupplementPriceForSize(supplementProduct, supplementVariants, selectedSize);
      
      // Find the variant that matches the price (for display)
      let matchingVariant: ProductVariant | null = null;
      if (supplementVariants.length > 0 && selectedSize) {
        matchingVariant = supplementVariants.find(v => {
          if (v.size === selectedSize) return true;
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

  const handleSave = () => {
    // Convert selected supplements to modifiers
    const modifiers: OrderLineModifier[] = Array.from(selectedSupplements.values()).map(sup => ({
      optionId: sup.supplementVariant?.id || sup.supplementProduct.id,
      optionName: sup.supplementProduct.name + (sup.supplementVariant ? ` (${sup.supplementVariant.size})` : ''),
      priceAdjustment: sup.price,
    }));
    
    // Calculate new unit price
    const newUnitPrice = hasVariants && selectedVariant 
      ? selectedVariant.price 
      : (product?.basePrice || item.unitPrice);
    
    onSave({
      modifiers,
      variantId: selectedVariant?.id,
      variantSize: selectedVariant?.size,
      unitPrice: newUnitPrice,
    });
    onClose();
  };

  if (!product) {
    return null;
  }

  return (
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
        className="bg-card rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-xl font-bold text-card-foreground">{t('order.modifyItem')}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-accent rounded-xl transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[50vh]">
          <div className="mb-4">
            <h3 className="font-semibold text-lg mb-1">{item.productName}</h3>
          </div>

          {/* Size selection */}
          {hasVariants && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                {t('order.size')}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {allVariants.map((variant) => (
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

          {/* Supplements */}
          {supplementsProducts.length > 0 ? (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                {t('general.supplements')}
              </h3>
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                {supplementsProducts.map((supplement) => {
                  const supplementVariants = getVariantsByProduct(supplement.id);
                  const isSelected = selectedSupplements.has(supplement.id);
                  const selectedSup = selectedSupplements.get(supplement.id);
                  const supplementPrice = selectedSup?.price || 
                    getSupplementPriceForSize(supplement, supplementVariants, selectedVariant?.size || item.variantSize);

                  return (
                    <button
                      key={supplement.id}
                      onClick={() => toggleSupplement(supplement)}
                      className={cn(
                        "p-3 rounded-xl border-2 transition-all duration-200 text-left relative",
                        isSelected
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                          <Check className="w-3 h-3 text-primary-foreground" />
                        </div>
                      )}
                      <div className="font-medium text-sm pr-6">{supplement.name}</div>
                      <div className="text-xs text-primary font-semibold mt-1">
                        {formatCurrency(supplementPrice, currency)}
                        {supplementVariants.length > 1 && !isSelected && (selectedVariant?.size || item.variantSize) && (
                          <span className="text-muted-foreground"> ({selectedVariant?.size || item.variantSize})</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>{t('products.noSupplementsAvailable')}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/30">
          <div className="flex gap-2">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1"
            >
              {t('general.cancel')}
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1"
            >
              {t('general.save')}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
