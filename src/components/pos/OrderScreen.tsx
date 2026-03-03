import { useState, useEffect } from 'react';
import { Product, ProductVariant } from '@shared/types';
import { CategorySidebar } from './CategorySidebar';
import { ProductGrid } from './ProductGrid';
import { Cart } from './Cart';
import { ProductModal } from './ProductModal';

export function OrderScreen() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<{
    product: Product;
    variants: ProductVariant[];
  } | null>(null);

  // Persist selectedCategory to prevent it from being reset
  useEffect(() => {
    if (selectedCategory) {
      sessionStorage.setItem('pos_selected_category', selectedCategory);
    }
  }, [selectedCategory]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Categories Sidebar */}
      <div className="w-[220px] lg:w-[260px] shrink-0">
        <CategorySidebar
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />
      </div>

      {/* Products Grid */}
      <div className="flex-1 flex flex-col bg-background overflow-hidden">
        <ProductGrid
          categoryId={selectedCategory}
          onSelectProduct={(product, variants) => setSelectedProduct({ product, variants })}
        />
      </div>

      {/* Cart */}
      <div className="w-[380px] lg:w-[440px] shrink-0">
        <Cart />
      </div>

      {/* Product Selection Modal */}
      {selectedProduct && (
        <ProductModal
          product={selectedProduct.product}
          variants={selectedProduct.variants}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
}
