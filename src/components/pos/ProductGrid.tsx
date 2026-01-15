import { usePOS } from '@/contexts/POSContext';
import { Product, ProductVariant } from '@/lib/database';
import { formatCurrency } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';

interface ProductGridProps {
  categoryId: string | null;
  onSelectProduct: (product: Product, variants: ProductVariant[]) => void;
}

export function ProductGrid({ categoryId, onSelectProduct }: ProductGridProps) {
  const { getProductsByCategory, getVariantsByProduct, currency, t } = usePOS();

  if (!categoryId) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <span className="text-6xl mb-4 block">👈</span>
          <p className="text-lg">{t('productGrid.selectCategory')}</p>
        </div>
      </div>
    );
  }

  const products = getProductsByCategory(categoryId);

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <AnimatePresence mode="popLayout">
        <motion.div 
          key={categoryId}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3"
        >
          {products.map((product, index) => {
            const variants = getVariantsByProduct(product.id);
            const minPrice = product.basePrice || (variants.length > 0 
              ? Math.min(...variants.map(v => v.price)) 
              : 0);

            return (
              <motion.button
                key={product.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.02 }}
                onClick={() => onSelectProduct(product, variants)}
                className="product-card text-left group"
              >
                {product.image && (
                  <div className="w-full h-32 mb-3 rounded-lg overflow-hidden bg-muted">
                    <img 
                      src={product.image} 
                      alt={product.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  </div>
                )}
                
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-card-foreground line-clamp-2 flex-1 pr-2">
                    {product.name}
                  </h3>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="p-1.5 bg-primary rounded-lg">
                      <Plus className="w-4 h-4 text-primary-foreground" />
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between mt-auto">
                  <span className="text-lg font-bold text-primary">
                    {variants.length > 1 && t('productGrid.from') + ' '}
                    {formatCurrency(minPrice, currency)}
                  </span>
                  
                  {variants.length > 1 && (
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                      {variants.length} {t('productGrid.sizes')}
                    </span>
                  )}
                </div>
              </motion.button>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
