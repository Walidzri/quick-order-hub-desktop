import { useState, useMemo, useEffect } from 'react';
import { Product, ProductVariant, Category } from '@shared/types';
import { formatCurrency, Currency } from '@/lib/i18n';
import { usePOS } from '@/contexts/POSContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Edit, 
  Trash2, 
  X, 
  Upload, 
  Download, 
  Save,
  Check,
  XCircle,
  Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { TouchInput } from '@/components/ui/touch-input';
import { TouchTextarea } from '@/components/ui/touch-textarea';
import { NumericInput } from '@/components/ui/numeric-input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useDialog } from '@/hooks/use-dialog';
import { CategoryModal } from './CategoryModal';

interface ProductsManagementProps {
  categories: Category[];
  products: Product[];
  variants: ProductVariant[];
  currency: string;
  getVariantsByProduct: (productId: string) => ProductVariant[];
  saveProduct: (product: Product, variants?: ProductVariant[]) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;
  loadProducts: () => Promise<void>;
  saveCategory: (category: Category) => Promise<void>;
  deleteCategory: (categoryId: string) => Promise<void>;
  loadCategories: () => Promise<void>;
}

export function ProductsManagement({
  categories,
  products,
  variants,
  currency,
  getVariantsByProduct,
  saveProduct,
  deleteProduct,
  loadProducts,
  saveCategory,
  deleteCategory,
  loadCategories,
}: ProductsManagementProps) {
  const { t, getProductsByCategory } = usePOS();
  const { showDialog, DialogComponent } = useDialog();
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAvailableOnly, setShowAvailableOnly] = useState(false);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || p.categoryId === selectedCategory;
      const matchesAvailability = !showAvailableOnly || p.available !== false;
      return matchesSearch && matchesCategory && matchesAvailability;
    });
  }, [products, searchTerm, selectedCategory, showAvailableOnly]);

  const handleExportJSON = () => {
    const productsData = products.map(p => ({
      ...p,
      variants: getVariantsByProduct(p.id),
    }));
    const dataStr = JSON.stringify(productsData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `products-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: t('products.exportSuccess'), description: t('products.exportJSONDesc') });
  };

  const handleExportCSV = () => {
    const headers = [t('csv.id'), t('csv.category'), t('csv.name'), t('csv.basePrice'), t('csv.available'), t('csv.variants'), t('csv.description')];
    const rows = products.map(p => {
      const productVariants = getVariantsByProduct(p.id);
      const variantsStr = productVariants.map(v => `${v.size}:${v.price}`).join(';');
      return [
        p.id,
        categories.find(c => c.id === p.categoryId)?.name || p.categoryId,
        p.name,
        p.basePrice?.toString() || '',
        p.available !== false ? t('general.confirm') : t('general.cancel'),
        variantsStr,
        p.description || '',
      ].map(cell => `"${cell}"`).join(',');
    });
    const csv = [headers.map(h => `"${h}"`).join(','), ...rows].join('\n');
    const dataBlob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `products-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: t('products.exportSuccess'), description: t('products.exportCSVDesc') });
  };

  const handleImportJSON = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importedProducts: (Product & { variants?: ProductVariant[] })[] = JSON.parse(text);
      
      for (const productData of importedProducts) {
        const { variants: productVariants, ...product } = productData;
        const productId = product.id || `${product.categoryId}-${product.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
        await saveProduct({ ...product, id: productId }, productVariants || []);
      }
      
      await loadProducts();
      toast({ title: t('general.success'), description: `${importedProducts.length} ${t('products.title').toLowerCase()} ${t('general.loading').toLowerCase()}` });
    } catch (error) {
      toast({ title: t('general.error'), description: t('general.error'), variant: 'destructive' });
    }
  };

  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim());
      const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, ''));
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.replace(/^"|"$/g, ''));
        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });

        const categoryId = categories.find(c => c.name === row[t('products.category')])?.id || row[t('products.category')];
        const productId = row['ID'] || `${categoryId}-${row[t('products.name')].toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
        
        const variants: ProductVariant[] = [];
        if (row[t('products.variants')]) {
          const variantPairs = row[t('products.variants')].split(';');
          variantPairs.forEach(pair => {
            const [size, price] = pair.split(':');
            if (size && price) {
              variants.push({
                id: `${productId}-${size}`,
                productId,
                size,
                price: parseFloat(price),
              });
            }
          });
        }

        const product: Product = {
          id: productId,
          categoryId,
          name: row[t('products.name')],
          basePrice: row[t('products.basePrice')] ? parseFloat(row[t('products.basePrice')]) : undefined,
          available: row[t('products.available')] === t('general.confirm') || row[t('products.available')] === '',
          description: row[t('products.description')] || undefined,
          sortOrder: i,
        };

        await saveProduct(product, variants);
      }

      await loadProducts();
      toast({ title: t('general.success'), description: `${products.length - 1} ${t('products.title').toLowerCase()} importé(s)` });
    } catch (error) {
      toast({ title: t('general.error'), description: t('general.error'), variant: 'destructive' });
    }
  };

  return (
    <>
      {DialogComponent}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t('products.title')}</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleExportJSON}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            {t('products.exportJSON')}
          </Button>
          <Button
            variant="outline"
            onClick={handleExportCSV}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            {t('products.exportCSV')}
          </Button>
          <Button
            onClick={() => {
              setEditingProduct(null);
              setShowProductModal(true);
            }}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            {t('products.add')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
          <TouchInput
            placeholder={t('products.search')}
            value={searchTerm}
            onChange={setSearchTerm}
            className="pl-10"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger>
            <SelectValue placeholder={t('products.allCategories')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('products.allCategories')}</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Switch
            checked={showAvailableOnly}
            onCheckedChange={setShowAvailableOnly}
          />
          <span className="text-sm">{t('products.showAvailableOnly')}</span>
        </div>
      </div>

      {/* Categories Management */}
      <div className="bg-muted/30 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Gestion des catégories</h3>
          <Button
            onClick={() => {
              setEditingCategory(null);
              setShowCategoryModal(true);
            }}
            size="sm"
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            {t('category.add')}
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {categories.map((category) => {
            const productsCount = products.filter(p => p.categoryId === category.id).length;
            return (
              <div
                key={category.id}
                className="flex items-center justify-between p-3 bg-background rounded-lg border border-border"
              >
                <div className="flex items-center gap-2">
                  {category.image ? (
                    <img 
                      src={category.image} 
                      alt={category.name} 
                      className="w-12 h-12 object-cover rounded-lg"
                    />
                  ) : category.icon ? (
                    <span className="text-xl">{category.icon}</span>
                  ) : null}
                  <div>
                    <div className="font-medium">{category.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {productsCount} produit{productsCount !== 1 ? 's' : ''} • Ordre: {category.sortOrder}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditingCategory(category);
                      setShowCategoryModal(true);
                    }}
                    className="h-8 w-8"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      const confirmed = await showDialog({
                        title: 'Supprimer la catégorie',
                        description: `${t('category.deleteConfirm')} "${category.name}" ?`,
                        confirmText: 'Supprimer',
                        cancelText: 'Annuler',
                        variant: 'destructive',
                      });
                      if (confirmed) {
                        try {
                          await deleteCategory(category.id);
                          // deleteCategory already reloads categories, but we call loadCategories to ensure UI updates
                          await loadCategories();
                          toast({ title: t('category.deleted'), description: t('category.deletedDesc').replace('{name}', category.name) });
                        } catch (error) {
                          console.error('Failed to delete category:', error);
                          toast({ 
                            title: t('general.error'), 
                            description: error instanceof Error ? error.message : t('general.cannotDeleteCategory'),
                            variant: 'destructive'
                          });
                        }
                      }
                    }}
                    className="h-8 w-8 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Import buttons */}
      <div className="flex gap-2">
        <input
          type="file"
          accept=".json"
          onChange={handleImportJSON}
          className="hidden"
          id="import-json"
        />
        <label htmlFor="import-json">
          <Button variant="outline" asChild className="gap-2 cursor-pointer">
            <span>
              <Upload className="w-4 h-4" />
              {t('products.importJSON')}
            </span>
          </Button>
        </label>
        <input
          type="file"
          accept=".csv"
          onChange={handleImportCSV}
          className="hidden"
          id="import-csv"
        />
        <label htmlFor="import-csv">
          <Button variant="outline" asChild className="gap-2 cursor-pointer">
            <span>
              <Upload className="w-4 h-4" />
              {t('products.importCSV')}
            </span>
          </Button>
        </label>
      </div>

      {/* Products list */}
      <div className="space-y-3">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {t('products.noProductsFound')}
          </div>
        ) : (
          filteredProducts.map((product) => {
            const productVariants = getVariantsByProduct(product.id);
            const category = categories.find(c => c.id === product.categoryId);

            return (
              <div
                key={product.id}
                className={cn(
                  "p-4 bg-muted/50 rounded-xl flex items-center justify-between",
                  product.available === false && "opacity-50"
                )}
              >
                <div className="flex-1 flex items-start gap-3">
                  {product.image && (
                    <img 
                      src={product.image} 
                      alt={product.name} 
                      className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                    />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold">{product.name}</span>
                    <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                      {category?.name || product.categoryId}
                    </span>
                    {product.available === false && (
                      <span className="text-xs px-2 py-0.5 bg-destructive/10 text-destructive rounded-full">
                        {t('products.unavailable')}
                      </span>
                    )}
                  </div>
                  {product.description && (
                    <div className="text-sm text-muted-foreground mb-2">{product.description}</div>
                  )}
                  <div className="flex items-center gap-4 text-sm">
                    {product.basePrice && (
                      <span className="text-primary font-semibold">
                        {formatCurrency(product.basePrice, currency as Currency)}
                      </span>
                    )}
                    {productVariants.length > 0 && (
                      <div className="flex items-center gap-2">
                        {productVariants.map(v => (
                          <span key={v.id} className="text-muted-foreground">
                            {v.size}: {formatCurrency(v.price, currency as Currency)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingProduct(product);
                      setShowProductModal(true);
                    }}
                    className="p-2 hover:bg-primary/10 rounded-lg transition-colors"
                    title={t('products.edit')}
                  >
                    <Edit className="w-4 h-4 text-primary" />
                  </button>
                  <button
                    onClick={async () => {
                      const confirmed = await showDialog({
                        title: 'Supprimer le produit',
                        description: `${t('products.deleteConfirm')} "${product.name}" ?`,
                        confirmText: 'Supprimer',
                        cancelText: 'Annuler',
                        variant: 'destructive',
                      });
                      if (confirmed) {
                        try {
                          await deleteProduct(product.id);
                          // deleteProduct already reloads products, but we call loadProducts to ensure UI updates
                          await loadProducts();
                          toast({ title: t('products.deleted'), description: t('products.deletedDesc').replace('{name}', product.name) });
                        } catch (error) {
                          console.error('Failed to delete product:', error);
                          toast({ 
                            title: t('general.error'), 
                            description: error instanceof Error ? error.message : t('general.cannotDeleteProduct'),
                            variant: 'destructive'
                          });
                        }
                      }
                    }}
                    className="p-2 hover:bg-destructive/10 rounded-lg transition-colors"
                    title={t('products.delete')}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Product Modal */}
      {showProductModal && (
        <ProductModal
          product={editingProduct}
          categories={categories}
          currency={currency}
          existingVariants={editingProduct ? getVariantsByProduct(editingProduct.id) : undefined}
          onClose={() => {
            setShowProductModal(false);
            setEditingProduct(null);
          }}
          onSave={async (product, productVariants) => {
            await saveProduct(product, productVariants);
            await loadProducts();
            setShowProductModal(false);
            setEditingProduct(null);
          }}
        />
      )}

      {showCategoryModal && (
        <CategoryModal
          category={editingCategory}
          supplements={(() => {
            // Utiliser getProductsByCategory comme dans ProductModal pour avoir les mêmes résultats
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
          })()}
          onClose={() => {
            setEditingCategory(null);
            setShowCategoryModal(false);
          }}
          onSave={async (category) => {
            await saveCategory(category);
            await loadProducts(); // Recharger les produits pour s'assurer que les suppléments sont à jour
            await loadCategories();
            setShowCategoryModal(false);
            setEditingCategory(null);
            toast({ 
              title: t('category.saved'), 
              description: `La catégorie "${category.name}" a été ${editingCategory ? t('general.modified') : t('general.added')}` 
            });
          }}
        />
      )}
      </motion.div>
    </>
  );
}

interface ProductModalProps {
  product: Product | null;
  categories: Category[];
  currency: string;
  existingVariants?: ProductVariant[];
  onClose: () => void;
  onSave: (product: Product, variants: ProductVariant[]) => Promise<void>;
}

function ProductModal({ product, categories, currency, existingVariants = [], onClose, onSave }: ProductModalProps) {
  const { t, getProductsByCategory } = usePOS();
  const { DialogComponent } = useDialog();
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [description, setDescription] = useState('');
  const [available, setAvailable] = useState(true);
  const [sortOrder, setSortOrder] = useState(0);
  const [variants, setVariants] = useState<Array<{ size: string; price: string }>>([]);
  const [hasVariants, setHasVariants] = useState(false);
  const [image, setImage] = useState<string | undefined>(undefined);
  const [selectedSupplementIds, setSelectedSupplementIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  
  // Get all available supplements
  const allSupplements = getProductsByCategory('supplements');

  useEffect(() => {
    if (product) {
      setName(product.name);
      setCategoryId(product.categoryId);
      setBasePrice(product.basePrice?.toString() || '');
      setDescription(product.description || '');
      setAvailable(product.available !== false);
      setSortOrder(product.sortOrder);
      setImage(product.image);
      setSelectedSupplementIds(product.supplementIds || []);
      // Load existing variants
      if (existingVariants && existingVariants.length > 0) {
        setVariants(existingVariants.map(v => ({ size: v.size, price: v.price.toString() })));
        setHasVariants(true);
      } else {
        setHasVariants(false);
        setVariants([]);
      }
    } else {
      setName('');
      setCategoryId(categories[0]?.id || '');
      setBasePrice('');
      setDescription('');
      setAvailable(true);
      setSortOrder(0);
      setVariants([]);
      setHasVariants(false);
      setImage(undefined);
      setSelectedSupplementIds([]);
    }
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id, existingVariants?.length]);
  
  // Update categoryId when categories load (only if no product and categoryId is empty)
  useEffect(() => {
    if (!product && !categoryId && categories.length > 0) {
      setCategoryId(categories[0].id);
    }
  }, [categories, product, categoryId]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError(t('products.name') + ' ' + t('general.error'));
      return;
    }
    if (!categoryId) {
      setError(t('products.category') + ' ' + t('general.error'));
      return;
    }
    if (!hasVariants && !basePrice) {
      setError(t('products.basePrice') + ' ' + t('general.error'));
      return;
    }

    const productId = product?.id || `${categoryId}-${name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
    
    const productVariants: ProductVariant[] = variants
      .filter(v => v.size && v.price)
      .map(v => ({
        id: `${productId}-${v.size}`,
        productId,
        size: v.size,
        price: parseFloat(v.price),
      }));

    const productToSave: Product = {
      id: productId,
      categoryId,
      name: name.trim(),
      basePrice: hasVariants ? undefined : (basePrice ? parseFloat(basePrice) : undefined),
      description: description.trim() || undefined,
      available,
      sortOrder,
      image: image || undefined,
      supplementIds: categoryId !== 'supplements' && selectedSupplementIds.length > 0 ? selectedSupplementIds : undefined,
    };

    await onSave(productToSave, productVariants);
  };

  const addVariant = () => {
    setVariants([...variants, { size: '', price: '' }]);
    setHasVariants(true);
  };

  const removeVariant = (index: number) => {
    const newVariants = variants.filter((_, i) => i !== index);
    setVariants(newVariants);
    if (newVariants.length === 0) {
      setHasVariants(false);
    }
  };

  const updateVariant = (index: number, field: 'size' | 'price', value: string) => {
    const newVariants = [...variants];
    newVariants[index][field] = value;
    setVariants(newVariants);
  };

  return (
    <>
      {DialogComponent}
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
          className="bg-card rounded-2xl w-full max-w-3xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
            <h2 className="text-xl font-bold">
              {product ? t('products.edit') + ' ' + t('products.title').toLowerCase() : t('products.add')}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-accent rounded-xl transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0 overscroll-contain space-y-4">
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                {error}
              </div>
            )}

            {/* Image Upload */}
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-2">
                {t('products.image')}
              </label>
              {image ? (
                <div className="relative">
                  <img 
                    src={image} 
                    alt={name || t('general.product')} 
                    className="w-full h-64 object-cover rounded-lg border-2 border-border"
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
                          setError(t('products.imageTooLarge'));
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
                    id="product-image-upload"
                  />
                  <label
                    htmlFor="product-image-upload"
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    <Upload className="w-8 h-8 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {t('products.imageUpload')}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t('products.imageFormat')}
                    </span>
                  </label>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  {t('products.name')} *
                </label>
                <TouchInput
                  value={name}
                  onChange={setName}
                  placeholder={t('products.name')}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  {t('products.category')} *
                </label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className="mt-1 h-12">
                    <SelectValue placeholder={t('products.category')} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
              <div>
                <span className="font-medium">{t('products.variants')}</span>
                <p className="text-sm text-muted-foreground">
                  {t('products.variantsDesc')}
                </p>
              </div>
              <Switch
                checked={hasVariants}
                onCheckedChange={(checked) => {
                  setHasVariants(checked);
                  if (checked && variants.length === 0) {
                    setVariants([{ size: '', price: '' }]);
                  }
                }}
              />
            </div>

            {hasVariants ? (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-muted-foreground">
                    {t('products.variants')}
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addVariant}
                    className="gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    {t('products.addVariant')}
                  </Button>
                </div>
                <div className="space-y-2">
                  {variants.map((variant, index) => (
                    <div key={index} className="flex gap-2">
                      <TouchInput
                        value={variant.size}
                        onChange={(value) => updateVariant(index, 'size', value)}
                        placeholder={t('products.sizePlaceholder')}
                        className="flex-1"
                      />
                      <NumericInput
                        value={variant.price}
                        onChange={(value) => updateVariant(index, 'price', value)}
                        placeholder={t('products.price')}
                        className="flex-1"
                        min={0}
                        step={0.01}
                        allowDecimal={true}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeVariant(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  {t('products.basePrice')} ({currency})
                </label>
                <NumericInput
                  value={basePrice}
                  onChange={setBasePrice}
                  placeholder="0.00"
                  className="mt-1 h-12"
                  min={0}
                  step={0.01}
                  allowDecimal={true}
                />
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-muted-foreground">
                {t('products.description')}
              </label>
              <TouchTextarea
                value={description}
                onChange={setDescription}
                placeholder={t('products.description')}
                rows={2}
                showQuickSuggestions={false}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  {t('products.sortOrder')}
                </label>
                <NumericInput
                  value={sortOrder}
                  onChange={(value) => setSortOrder(parseInt(value) || 0)}
                  className="mt-1 h-12"
                  min={0}
                  allowDecimal={false}
                />
              </div>
            </div>

            {/* Supplements Association - Only for non-supplement products */}
            {categoryId !== 'supplements' && allSupplements.length > 0 && (
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-3">
                  {t('products.associatedSupplements')}
                </label>
                <p className="text-xs text-muted-foreground mb-3">
                  {t('products.associatedSupplementsDesc')}
                </p>
                <div className="border border-border rounded-lg p-3 max-h-[40vh] sm:max-h-48 overflow-y-auto overscroll-contain space-y-2">
                  {allSupplements.map((supplement) => {
                    const isSelected = selectedSupplementIds.includes(supplement.id);
                    return (
                      <div
                        key={supplement.id}
                        className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded-lg transition-colors"
                      >
                        <Checkbox
                          id={`supplement-${supplement.id}`}
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
                          htmlFor={`supplement-${supplement.id}`}
                          className="flex-1 cursor-pointer text-sm font-medium"
                        >
                          {supplement.name}
                        </label>
                      </div>
                    );
                  })}
                </div>
                {selectedSupplementIds.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    {t('supplements.noneSelectedAuto')}
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
              <div>
                <span className="font-medium">{t('products.available')}</span>
                <p className="text-sm text-muted-foreground">
                  {t('products.availableDesc')}
                </p>
              </div>
              <Switch
                checked={available}
                onCheckedChange={setAvailable}
              />
            </div>
          </div>

          {/* Footer - Always visible at bottom */}
          <div className="flex gap-2 p-3 sm:p-4 border-t border-border flex-shrink-0 sticky bottom-0 bg-card">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 h-12"
            >
              {t('general.cancel')}
            </Button>
            <Button
              onClick={handleSubmit}
              className="flex-1 h-12 gap-2"
            >
              <Save className="w-4 h-4" />
              {t('general.save')}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
    </>
  );
}
