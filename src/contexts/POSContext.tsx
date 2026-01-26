import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { 
  getDB, 
  initializeDatabase,
  resetDatabase,
  exportProductsTemplate,
  importProductsTemplate,
  Settings, 
  Category, 
  Product, 
  ProductVariant, 
  Order, 
  OrderLine, 
  Promotion,
  Printer,
  PrintJob,
  OrderStatus,
  PaymentMethod,
  OrderType,
  NumberingCounter,
} from '@/lib/database';
import { createBackup } from '@/lib/database-sqlite';
import { Language, Currency, LANGUAGES, translations } from '@/lib/i18n';
import { DirectPrinter } from '@/lib/printer';

// Polyfill for crypto.randomUUID (works on HTTP as well)
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface CartItem extends OrderLine {}

export interface OrderDraft {
  id: string;
  name: string;
  type: OrderType; // 'dine-in' or 'takeaway'
  cart: CartItem[];
  appliedPromo: Promotion | null;
  createdAt: number;
}

interface POSContextType {
  // Settings
  settings: Settings | null;
  updateSettings: (settings: Partial<Settings>) => Promise<void>;
  
  // Localization
  t: (key: string) => string;
  language: Language;
  currency: Currency;
  direction: 'ltr' | 'rtl';
  
  // Menu
  categories: Category[];
  products: Product[];
  variants: ProductVariant[];
  getProductsByCategory: (categoryId: string) => Product[];
  getVariantsByProduct: (productId: string) => ProductVariant[];
  saveProduct: (product: Product, variants?: ProductVariant[]) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;
  loadProducts: () => Promise<void>;
  saveCategory: (category: Category) => Promise<void>;
  deleteCategory: (categoryId: string) => Promise<void>;
  loadCategories: () => Promise<void>;
  
  // Cart -> now multi-draft
  orderDrafts: OrderDraft[];
  activeOrderId: string | null;
  setActiveOrderId: (id: string | null) => void;
  createNewDraft: (name?: string, type?: OrderType) => OrderDraft;
  deleteDraft: (draftId: string) => void;
  addToCart: (item: CartItem) => void;
  updateCartItem: (itemId: string, updates: Partial<CartItem>) => void;
  removeFromCart: (itemId: string) => void;
  clearCart: (draftId?: string) => void;
  
  // Order calculations
  subtotal: number;
  discount: number;
  total: number;
  appliedPromo: Promotion | null;
  applyPromoCode: (code: string) => Promise<{ success: boolean; message: string }>;
  removePromo: () => void;
  
  // Orders
  currentOrder: Order | null;
  orders: Order[];
  createOrder: () => Promise<Order>;
  sendToKitchen: (orderId: string) => Promise<void>;
  markAsPaid: (orderId: string, paymentMethod: PaymentMethod) => Promise<Order>;
  cancelOrder: (orderId: string) => Promise<void>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  deleteOrder: (orderId: string) => Promise<void>;
  deleteOrders: (orderIds: string[]) => Promise<void>;
  deleteAllOrders: () => Promise<void>;
  loadOrders: (startDate?: Date, endDate?: Date) => Promise<void>;
  loadOrdersByDateRange: (startDate: Date, endDate: Date) => Promise<Order[]>;
  loadOrdersPaginated: (page: number, pageSize: number) => Promise<{ orders: Order[]; total: number; totalPages: number }>;
  
  // Promotions
  promotions: Promotion[];
  loadPromotions: () => Promise<void>;
  savePromotion: (promo: Promotion) => Promise<void>;
  deletePromotion: (id: string) => Promise<void>;
  
  // Printers
  printers: Printer[];
  updatePrinter: (printer: Printer) => Promise<void>;
  deletePrinter: (printerId: string) => Promise<void>;
  
  // Utilities
  generateOrderNumber: () => Promise<string>;
  resetDatabase: () => Promise<void>;
  exportProductsTemplate: () => Promise<{
    categories: any[];
    products: any[];
    productVariants: any[];
    modifierGroups: any[];
    modifierOptions: any[];
  }>;
  importProductsTemplate: (templateData: {
    categories?: any[];
    products?: any[];
    productVariants?: any[];
    modifierGroups?: any[];
    modifierOptions?: any[];
  }) => Promise<void>;
  isLoading: boolean;
  kioskMode: boolean;
  toggleKioskMode: () => void;
  pendingCartItem: CartItem | null;
  setPendingCartItem: (item: CartItem | null) => void;
  createDraftWithType: (type: OrderType, item?: CartItem) => OrderDraft;
  updateDraftType: (draftId: string, type: OrderType) => void;
}

const POSContext = createContext<POSContextType | null>(null);

export function usePOS() {
  const context = useContext(POSContext);
  if (!context) {
    throw new Error('usePOS must be used within a POSProvider');
  }
  return context;
}

export function POSProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  // Multi-draft cart state
  // Start with no draft: the first time a produit est ajouté, on demande le type (sur place / à emporter)
  const [orderDrafts, setOrderDrafts] = useState<OrderDraft[]>([]);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [kioskMode, setKioskMode] = useState(false);
  const [pendingCartItem, setPendingCartItem] = useState<CartItem | null>(null);

  // Initialize database and load data
  useEffect(() => {
    async function init() {
      try {
        await initializeDatabase();
        const db = await getDB();
        
        // Load settings
        const loadedSettings = await db.get('settings', 'main');
        if (loadedSettings) {
          setSettings(loadedSettings);
          setKioskMode(loadedSettings.kioskMode);
          
          // Apply dark mode
          if (loadedSettings.darkMode) {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
          
          // Apply primary color
          if (loadedSettings.primaryColor) {
            const hslColor = hexToHSL(loadedSettings.primaryColor);
            document.documentElement.style.setProperty('--primary', hslColor);
            document.documentElement.style.setProperty('--ring', hslColor);
            document.documentElement.style.setProperty('--sidebar-primary', hslColor);
            document.documentElement.style.setProperty('--sidebar-ring', hslColor);
          }
          
          // Apply RTL
          const lang = loadedSettings.language as Language;
          document.documentElement.dir = LANGUAGES[lang]?.dir || 'ltr';
          
          // Apply UI scale
          const uiScale = loadedSettings.uiScale ?? 1.0;
          document.documentElement.style.setProperty('--ui-scale', uiScale.toString());
        }
        
        // Load categories
        const loadedCategories = await db.getAll('categories');
        setCategories(loadedCategories.sort((a, b) => a.sortOrder - b.sortOrder));
        
        // Load products
        const loadedProducts = await db.getAll('products');
        setProducts(loadedProducts.sort((a, b) => a.sortOrder - b.sortOrder));
        
        // Load variants
        const loadedVariants = await db.getAll('productVariants');
        setVariants(loadedVariants);
        
        // Load printers
        const loadedPrinters = await db.getAll('printers');
        setPrinters(loadedPrinters);
        
        // Load promotions
        const loadedPromos = await db.getAll('promotions');
        setPromotions(loadedPromos);
        
      } catch (error) {
        console.error('Failed to initialize POS:', error);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  // Translation function
  const language = (settings?.language || 'fr-FR') as Language;
  const currency = (settings?.currency || 'DZD') as Currency;
  const direction = LANGUAGES[language]?.dir || 'ltr';
  
  const t = useCallback((key: string): string => {
    return translations[language]?.[key] || translations['fr-FR']?.[key] || key;
  }, [language]);

  // Helper function to convert hex to HSL
  const hexToHSL = (hex: string): string => {
    // Remove # if present
    hex = hex.replace('#', '');
    
    // Convert hex to RGB
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      
      switch (max) {
        case r:
          h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
          break;
        case g:
          h = ((b - r) / d + 2) / 6;
          break;
        case b:
          h = ((r - g) / d + 4) / 6;
          break;
      }
    }
    
    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  };

  // Update settings
  const updateSettings = useCallback(async (updates: Partial<Settings>) => {
    if (!settings) return;
    
    const newSettings = { ...settings, ...updates };
    const db = await getDB();
    await db.put('settings', newSettings);
    setSettings(newSettings);
    
    // Apply theme changes
    if (updates.darkMode !== undefined) {
      if (updates.darkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
    
    // Apply primary color changes
    if (updates.primaryColor !== undefined) {
      const hslColor = hexToHSL(updates.primaryColor);
      document.documentElement.style.setProperty('--primary', hslColor);
      
      // Also update the ring color to match
      document.documentElement.style.setProperty('--ring', hslColor);
      
      // Update sidebar primary colors too
      document.documentElement.style.setProperty('--sidebar-primary', hslColor);
      document.documentElement.style.setProperty('--sidebar-ring', hslColor);
    }
    
    // Apply language direction
    if (updates.language) {
      const lang = updates.language as Language;
      document.documentElement.dir = LANGUAGES[lang]?.dir || 'ltr';
    }
    
    // Apply UI scale changes
    if (updates.uiScale !== undefined) {
      document.documentElement.style.setProperty('--ui-scale', updates.uiScale.toString());
    }
    
    if (updates.kioskMode !== undefined) {
      setKioskMode(updates.kioskMode);
    }
  }, [settings]);

  // Menu helpers
  const getProductsByCategory = useCallback((categoryId: string) => {
    return products.filter(p => p.categoryId === categoryId && (p.available !== false));
  }, [products]);

  const getVariantsByProduct = useCallback((productId: string) => {
    return variants.filter(v => v.productId === productId);
  }, [variants]);

  // Product management
  const saveProduct = useCallback(async (product: Product, productVariants: ProductVariant[] = []) => {
    const db = await getDB();
    // Set default available to true if not specified
    const productToSave = { ...product, available: product.available !== false };
    await db.put('products', productToSave);
    
    // Save variants
    if (productVariants.length > 0) {
      // Delete old variants
      const existingVariants = await db.getAllFromIndex('productVariants', 'by-product', product.id);
      for (const variant of existingVariants) {
        await db.delete('productVariants', variant.id);
      }
      // Add new variants
      for (const variant of productVariants) {
        await db.put('productVariants', variant);
      }
    }
    
    // Reload products and variants
    const loadedProducts = await db.getAll('products');
    setProducts(loadedProducts.sort((a, b) => a.sortOrder - b.sortOrder));
    const loadedVariants = await db.getAll('productVariants');
    setVariants(loadedVariants);
  }, []);

  const deleteProduct = useCallback(async (productId: string) => {
    try {
      const db = await getDB();
      // Delete variants first
      const productVariants = await db.getAllFromIndex('productVariants', 'by-product', productId);
      for (const variant of productVariants) {
        await db.delete('productVariants', variant.id);
      }
      // Delete product
      await db.delete('products', productId);
      
      // Reload products and variants
      const loadedProducts = await db.getAll('products');
      setProducts(loadedProducts.sort((a, b) => a.sortOrder - b.sortOrder));
      const loadedVariants = await db.getAll('productVariants');
      setVariants(loadedVariants);
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  }, []);

  const loadProducts = useCallback(async () => {
    const db = await getDB();
    const loadedProducts = await db.getAll('products');
    setProducts(loadedProducts.sort((a, b) => a.sortOrder - b.sortOrder));
    const loadedVariants = await db.getAll('productVariants');
    setVariants(loadedVariants);
  }, []);

  const saveCategory = useCallback(async (category: Category) => {
    const db = await getDB();
    await db.put('categories', category);
    const loadedCategories = await db.getAll('categories');
    setCategories(loadedCategories.sort((a, b) => a.sortOrder - b.sortOrder));
  }, []);

  const deleteCategory = useCallback(async (categoryId: string) => {
    try {
      const db = await getDB();
      // Check if category has products
      const allProducts = await db.getAll('products');
      const productsInCategory = allProducts.filter(p => p.categoryId === categoryId);
      if (productsInCategory.length > 0) {
        throw new Error(`Impossible de supprimer cette catégorie car elle contient ${productsInCategory.length} produit(s). Veuillez d'abord supprimer ou déplacer les produits.`);
      }
      await db.delete('categories', categoryId);
      const loadedCategories = await db.getAll('categories');
      setCategories(loadedCategories.sort((a, b) => a.sortOrder - b.sortOrder));
    } catch (error) {
      console.error('Error deleting category:', error);
      throw error;
    }
  }, []);

  const loadCategories = useCallback(async () => {
    const db = await getDB();
    const loadedCategories = await db.getAll('categories');
    setCategories(loadedCategories.sort((a, b) => a.sortOrder - b.sortOrder));
  }, []);

  // Cart management
  const addToCart = useCallback((item: CartItem) => {
    setOrderDrafts(prev => {
      // If no drafts exist, store the item and wait for user to select type
      if (prev.length === 0) {
        setPendingCartItem(item);
        return prev;
      }
      
      const activeId = (activeOrderId ?? prev[0]?.id) || null;
      if (!activeId) return prev;
      
      return prev.map(d => d.id === activeId
        ? { ...d, cart: [...d.cart, { ...item, id: generateUUID() }] }
        : d
      );
    });
  }, [activeOrderId]);

  const createNewDraft = useCallback((name?: string, type: OrderType = 'dine-in'): OrderDraft => {
    // Calculate next number based on existing drafts, not the counter
    const maxNum = orderDrafts.reduce((max, draft) => {
      const match = draft.name.match(/Commande (\d+)/);
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 0);
    const nextNum = maxNum + 1;
    
    const newDraft: OrderDraft = {
      id: generateUUID(),
      name: name || `Commande ${nextNum}`,
      type,
      cart: [],
      appliedPromo: null,
      createdAt: Date.now(),
    };
    setOrderDrafts(prevDrafts => [...prevDrafts, newDraft]);
    setActiveOrderId(newDraft.id);
    return newDraft;
  }, [orderDrafts]);

  const createDraftWithType = useCallback((type: OrderType, item?: CartItem): OrderDraft => {
    const maxNum = orderDrafts.reduce((max, draft) => {
      const match = draft.name.match(/Commande (\d+)/);
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 0);
    const nextNum = maxNum + 1;
    
    const newDraft: OrderDraft = {
      id: generateUUID(),
      name: `Commande ${nextNum}`,
      type,
      cart: item ? [{ ...item, id: generateUUID() }] : [],
      appliedPromo: null,
      createdAt: Date.now(),
    };
    setOrderDrafts(prevDrafts => [...prevDrafts, newDraft]);
    setActiveOrderId(newDraft.id);
    setPendingCartItem(null);
    return newDraft;
  }, [orderDrafts]);

  const updateDraftType = useCallback((draftId: string, type: OrderType) => {
    setOrderDrafts(prev => prev.map(draft => 
      draft.id === draftId ? { ...draft, type } : draft
    ));
  }, []);

  const updateCartItem = useCallback((itemId: string, updates: Partial<CartItem>) => {
    setOrderDrafts(prev => prev.map(draft => {
      if (draft.id !== activeOrderId) return draft;
      return { ...draft, cart: draft.cart.map(item => item.id === itemId ? { ...item, ...updates } : item) };
    }));
  }, [activeOrderId]);

  const removeFromCart = useCallback((itemId: string) => {
    setOrderDrafts(prev => prev.map(draft => {
      if (draft.id !== activeOrderId) return draft;
      return { ...draft, cart: draft.cart.filter(item => item.id !== itemId) };
    }));
  }, [activeOrderId]);

  const clearCart = useCallback((draftId?: string) => {
    const idToClear = draftId ?? activeOrderId;
    if (!idToClear) return;
    setOrderDrafts(prev => prev.map(draft => draft.id === idToClear ? { ...draft, cart: [], appliedPromo: null } : draft));
  }, [activeOrderId]);

  const deleteDraft = useCallback((draftId: string) => {
    setOrderDrafts(prev => {
      const next = prev.filter(d => d.id !== draftId);
      // if we removed the active draft, choose another or set to null
      if (activeOrderId === draftId) {
        if (next.length > 0) {
          // pick first remaining
          setActiveOrderId(next[0].id);
        } else {
          // allow empty list - set activeOrderId to null
          setActiveOrderId(null);
        }
      }
      return next;
    });
  }, [activeOrderId]);

  // Calculate totals
  // Totals are based on the active draft
  const activeDraft = orderDrafts.find(d => d.id === activeOrderId) || orderDrafts[0] || null;

  const subtotal = (activeDraft?.cart || []).reduce((sum, item) => {
    const itemTotal = item.unitPrice * item.quantity;
    const modifiersTotal = item.modifiers.reduce((m, mod) => m + mod.priceAdjustment, 0) * item.quantity;
    return sum + itemTotal + modifiersTotal;
  }, 0);

  const discount = activeDraft?.appliedPromo
    ? activeDraft.appliedPromo.type === 'percent'
      ? subtotal * (activeDraft.appliedPromo.value / 100)
      : activeDraft.appliedPromo.type === 'fixed'
        ? activeDraft.appliedPromo.value
        : 0
    : 0;

  const total = Math.max(0, subtotal - discount);

  // Promo code handling
  const applyPromoCode = useCallback(async (code: string): Promise<{ success: boolean; message: string }> => {
    const db = await getDB();
    const allPromos = await db.getAll('promotions');
    const promo = allPromos.find(p => p.code.toUpperCase() === code.toUpperCase());
    
    if (!promo) {
      return { success: false, message: t('promo.invalid') };
    }
    
    if (!promo.active) {
      return { success: false, message: t('promo.invalid') };
    }
    
    const now = new Date();
    if (now < new Date(promo.startDate) || now > new Date(promo.endDate)) {
      return { success: false, message: t('promo.expired') };
    }
    
    if (promo.minOrderTotal && subtotal < promo.minOrderTotal) {
      return { success: false, message: `Minimum ${promo.minOrderTotal} ${currency} required` };
    }
    
    // apply promo to active draft
    setOrderDrafts(prev => prev.map(d => d.id === activeOrderId ? { ...d, appliedPromo: promo } : d));
    return { success: true, message: t('promo.applied') };
  }, [subtotal, currency, t]);

  const removePromo = useCallback(() => {
    setOrderDrafts(prev => prev.map(d => d.id === activeOrderId ? { ...d, appliedPromo: null } : d));
  }, [activeOrderId]);

  // Generate order number: single incremental #001, #002, ...
  const generateOrderNumber = useCallback(async (): Promise<string> => {
    const db = await getDB();
    const counterId = 'counter-global';
    let counter = await db.get('numberingCounters', counterId);
    if (!counter) {
      counter = { id: counterId, date: '', counter: 0 };
    }
    counter.counter += 1;
    await db.put('numberingCounters', counter);
    return `#${counter.counter.toString().padStart(3, '0')}`;
  }, []);

  // Order management
  const createOrder = useCallback(async (): Promise<Order> => {
    const orderNumber = await generateOrderNumber();
    const now = new Date();
    const draft = orderDrafts.find(d => d.id === activeOrderId) || orderDrafts[0];
    const lines = draft?.cart || [];
    const draftPromo = draft?.appliedPromo || null;

    const order: Order = {
      id: generateUUID(),
      orderNumber,
      status: 'draft',
      type: draft?.type || 'dine-in',
      lines: [...lines],
      subtotal,
      discount,
      promoCode: draftPromo?.code,
      promoName: draftPromo?.name,
      total,
      createdBy: user?.id, // Associate order with current user
      createdAt: now,
      updatedAt: now,
    };

    const db = await getDB();
    await db.put('orders', order);

    // remove the draft we just converted
    setOrderDrafts(prev => {
      const next = prev.filter(d => d.id !== (draft?.id));
      // If we removed the active draft, select another one or set to null
      if (activeOrderId === draft?.id) {
        if (next.length > 0) {
          setActiveOrderId(next[0].id);
        } else {
          setActiveOrderId(null);
        }
      }
      return next;
    });
    // Don't create a new draft automatically - let user create one manually if needed

    setCurrentOrder(order);
    return order;
  }, [orderDrafts, activeOrderId, subtotal, discount, total, generateOrderNumber, user]);

  const sendToKitchen = useCallback(async (orderId: string) => {
    const db = await getDB();
    const order = await db.get('orders', orderId);
    
    if (!order) return;
    
    const now = new Date();
    order.status = 'sentToKitchen';
    order.sentToKitchenAt = now;
    order.updatedAt = now;
    
    await db.put('orders', order);
    
    // Create print job for kitchen
    const printJob: PrintJob = {
      id: generateUUID(),
      orderId: order.id,
      printerRole: 'kitchen',
      status: 'pending',
      createdAt: now,
    };
    await db.put('printJobs', printJob);
    
    // Note: Kitchen ticket printing is now handled by PrintPreviewModal
    // after payment, not automatically here
  }, []);

  const loadOrders = useCallback(async (startDate?: Date, endDate?: Date) => {
    const db = await getDB();
    let allOrders = await db.getAll('orders');
    
    if (startDate || endDate) {
      allOrders = allOrders.filter(order => {
        const orderDate = new Date(order.createdAt);
        if (startDate && orderDate < startDate) return false;
        if (endDate && orderDate > endDate) return false;
        return true;
      });
    }
    
    setOrders(allOrders.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ));
  }, []);

  const markAsPaid = useCallback(async (orderId: string, paymentMethod: PaymentMethod): Promise<Order> => {
    const db = await getDB();
    const order = await db.get('orders', orderId);
    
    if (!order) throw new Error('Order not found');
    
    const now = new Date();
    order.status = 'paid';
    order.paymentMethod = paymentMethod;
    order.paidAt = now;
    order.updatedAt = now;
    
    await db.put('orders', order);
    
    // Create print job for cashier receipt
    const printJob: PrintJob = {
      id: generateUUID(),
      orderId: order.id,
      printerRole: 'cashier',
      status: 'pending',
      createdAt: now,
    };
    await db.put('printJobs', printJob);
    
    // Don't trigger print automatically - let the modal handle it
    
    // Remove the empty draft that was created after the order
    setOrderDrafts(prev => {
      const remaining = prev.filter(d => d.cart.length > 0 || d.id !== activeOrderId);
      // If we removed the active draft, select the first remaining one or null
      if (remaining.length < prev.length && activeOrderId) {
        setActiveOrderId(remaining.length > 0 ? remaining[0].id : null);
      }
      return remaining;
    });
    
    // Refresh orders
    await loadOrders();
    
    return order;
  }, [activeOrderId, loadOrders]);

  const cancelOrder = useCallback(async (orderId: string) => {
    const db = await getDB();
    const order = await db.get('orders', orderId);
    
    if (!order) return;
    
    order.status = 'cancelled';
    order.updatedAt = new Date();
    
    await db.put('orders', order);
    await loadOrders();
  }, [loadOrders]);

  const updateOrderStatus = useCallback(async (orderId: string, status: OrderStatus) => {
    const db = await getDB();
    const order = await db.get('orders', orderId);
    
    if (!order) return;
    
    order.status = status;
    order.updatedAt = new Date();
    
    await db.put('orders', order);
    await loadOrders();
  }, [loadOrders]);

  const deleteOrder = useCallback(async (orderId: string) => {
    const db = await getDB();
    await db.delete('orders', orderId);
    await loadOrders();
  }, [loadOrders]);

  const deleteOrders = useCallback(async (orderIds: string[]) => {
    const db = await getDB();
    for (const orderId of orderIds) {
      await db.delete('orders', orderId);
    }
    await loadOrders();
  }, [loadOrders]);

  const deleteAllOrders = useCallback(async () => {
    const db = await getDB();
    const allOrders = await db.getAll('orders');
    for (const order of allOrders) {
      await db.delete('orders', order.id);
    }
    await loadOrders();
  }, [loadOrders]);

  // Optimized order loading - by date range (doesn't update state, returns directly)
  const loadOrdersByDateRange = useCallback(async (startDate: Date, endDate: Date): Promise<Order[]> => {
    const db = await getDB();
    // Use optimized query if available
    if ('getOrdersByDateRange' in db) {
      return await (db as any).getOrdersByDateRange(startDate, endDate);
    }
    // Fallback to loading all and filtering
    const allOrders = await db.getAll('orders') as Order[];
    return allOrders.filter(order => {
      const orderDate = new Date(order.createdAt);
      return orderDate >= startDate && orderDate <= endDate;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, []);

  // Optimized order loading - with pagination
  const loadOrdersPaginated = useCallback(async (page: number, pageSize: number): Promise<{ orders: Order[]; total: number; totalPages: number }> => {
    const db = await getDB();
    const offset = (page - 1) * pageSize;
    
    // Use optimized query if available
    if ('getOrdersPaginated' in db) {
      const result = await (db as any).getOrdersPaginated(pageSize, offset);
      return {
        orders: result.orders,
        total: result.total,
        totalPages: Math.ceil(result.total / pageSize),
      };
    }
    
    // Fallback to loading all and slicing
    const allOrders = await db.getAll('orders') as Order[];
    const sorted = allOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return {
      orders: sorted.slice(offset, offset + pageSize),
      total: allOrders.length,
      totalPages: Math.ceil(allOrders.length / pageSize),
    };
  }, []);

  // Promotions management
  const loadPromotions = useCallback(async () => {
    const db = await getDB();
    const promos = await db.getAll('promotions');
    setPromotions(promos);
  }, []);

  const savePromotion = useCallback(async (promo: Promotion) => {
    const db = await getDB();
    await db.put('promotions', promo);
    await loadPromotions();
  }, [loadPromotions]);

  const deletePromotion = useCallback(async (id: string) => {
    const db = await getDB();
    await db.delete('promotions', id);
    await loadPromotions();
  }, [loadPromotions]);

  // Printer management
  const updatePrinter = useCallback(async (printer: Printer) => {
    const db = await getDB();
    await db.put('printers', printer);
    const allPrinters = await db.getAll('printers');
    setPrinters(allPrinters);
  }, []);

  const deletePrinter = useCallback(async (printerId: string) => {
    const db = await getDB();
    await db.delete('printers', printerId);
    const allPrinters = await db.getAll('printers');
    setPrinters(allPrinters);
  }, []);

  const printKitchenTicket = useCallback(async (order: Order) => {
    // Function removed - browser print fallback no longer used
  }, []);

  const printReceipt = useCallback(async (order: Order) => {
    // Function removed - browser print fallback no longer used
  }, [settings]);

  const toggleKioskMode = useCallback(() => {
    const newMode = !kioskMode;
    setKioskMode(newMode);
    updateSettings({ kioskMode: newMode });
    
    if (newMode) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }, [kioskMode, updateSettings]);

  const value: POSContextType = {
    settings,
    updateSettings,
    t,
    language,
    currency,
    direction,
    categories,
    products,
    variants,
    getProductsByCategory,
    getVariantsByProduct,
    saveProduct,
    deleteProduct,
    loadProducts,
    saveCategory,
    deleteCategory,
    loadCategories,
    orderDrafts,
    activeOrderId,
    setActiveOrderId,
    createNewDraft,
  deleteDraft,
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart,
    subtotal,
    discount,
    total,
    appliedPromo: activeDraft?.appliedPromo || null,
    applyPromoCode,
    removePromo,
    currentOrder,
    orders,
    createOrder,
    sendToKitchen,
    markAsPaid,
    cancelOrder,
    updateOrderStatus,
    deleteOrder,
    deleteOrders,
    deleteAllOrders,
    loadOrders,
    loadOrdersByDateRange,
    loadOrdersPaginated,
    promotions,
    loadPromotions,
    savePromotion,
    deletePromotion,
    printers,
    updatePrinter,
    deletePrinter,
    generateOrderNumber,
    resetDatabase: async () => {
      await resetDatabase();
      // Reload window to reinitialize everything
      window.location.reload();
    },
    exportProductsTemplate: async () => {
      return await exportProductsTemplate();
    },
    importProductsTemplate: async (templateData) => {
      await importProductsTemplate(templateData);
      // Reload products and categories after import
      await loadCategories();
      await loadProducts();
      // Reload products and variants to show new supplements
      const db = await getDB();
      const loadedProducts = await db.getAll('products');
      setProducts(loadedProducts.sort((a, b) => a.sortOrder - b.sortOrder));
      const loadedVariants = await db.getAll('productVariants');
      setVariants(loadedVariants);
    },
    isLoading,
    kioskMode,
    toggleKioskMode,
    pendingCartItem,
    setPendingCartItem,
    createDraftWithType,
    updateDraftType,
  };

  // Automatic backup system with multiple schedule types
  useEffect(() => {
    if (!settings?.backupEnabled || !settings.backupDirectory) {
      return;
    }

    const scheduleType = settings.backupScheduleType || 'interval';
    let intervalId: NodeJS.Timeout | null = null;
    let checkIntervalId: NodeJS.Timeout | null = null;

    // Create backup function
    const performBackup = async () => {
      try {
        const backupPath = await createBackup(settings.backupDirectory!);
        if (backupPath) {
          console.log('Automatic backup completed:', backupPath);
        } else {
          console.error('Automatic backup failed');
        }
      } catch (error) {
        console.error('Error during automatic backup:', error);
      }
    };

    // Calculate next backup time based on schedule type
    const getNextBackupTime = (): number => {
      const now = new Date();
      
      switch (scheduleType) {
        case 'interval': {
          const intervalMinutes = settings.backupInterval || 60;
          return intervalMinutes * 60 * 1000;
        }
        
        case 'daily': {
          const timeStr = settings.backupDailyTime || '02:00';
          const [hours, minutes] = timeStr.split(':').map(Number);
          const backupTime = new Date(now);
          backupTime.setHours(hours, minutes, 0, 0);
          
          // If time has passed today, schedule for tomorrow
          if (backupTime <= now) {
            backupTime.setDate(backupTime.getDate() + 1);
          }
          
          return backupTime.getTime() - now.getTime();
        }
        
        case 'weekly': {
          const dayOfWeek = settings.backupWeeklyDay !== undefined ? settings.backupWeeklyDay : 0; // 0 = Sunday
          const timeStr = settings.backupWeeklyTime || '02:00';
          const [hours, minutes] = timeStr.split(':').map(Number);
          const backupTime = new Date(now);
          backupTime.setHours(hours, minutes, 0, 0);
          
          // Calculate days until next scheduled day
          const currentDay = now.getDay();
          let daysUntil = (dayOfWeek - currentDay + 7) % 7;
          
          // If it's the same day but time has passed, schedule for next week
          if (daysUntil === 0 && backupTime <= now) {
            daysUntil = 7;
          }
          
          backupTime.setDate(backupTime.getDate() + daysUntil);
          return backupTime.getTime() - now.getTime();
        }
        
        case 'monthly': {
          const dayOfMonth = settings.backupMonthlyDay !== undefined ? settings.backupMonthlyDay : 1;
          const timeStr = settings.backupMonthlyTime || '02:00';
          const [hours, minutes] = timeStr.split(':').map(Number);
          const backupTime = new Date(now);
          backupTime.setHours(hours, minutes, 0, 0);
          backupTime.setDate(dayOfMonth);
          
          // If date has passed this month, schedule for next month
          if (backupTime <= now) {
            backupTime.setMonth(backupTime.getMonth() + 1);
          }
          
          return backupTime.getTime() - now.getTime();
        }
        
        default:
          return 60 * 60 * 1000; // Default: 1 hour
      }
    };

    // Schedule next backup
    const scheduleNextBackup = () => {
      const delay = getNextBackupTime();
      const delayMinutes = Math.round(delay / 1000 / 60);
      const delayHours = Math.round(delay / 1000 / 60 / 60);
      console.log(`Scheduling next backup in ${delayMinutes} minutes (${delayHours} hours)`);
      
      if (intervalId) {
        clearTimeout(intervalId);
      }
      
      intervalId = setTimeout(() => {
        performBackup();
        scheduleNextBackup(); // Schedule the next one
      }, delay);
    };

    // Check if it's time for backup (for time-based schedules)
    const checkAndPerformBackup = () => {
      const now = new Date();
      let shouldBackup = false;
      
      switch (scheduleType) {
        case 'daily': {
          const timeStr = settings.backupDailyTime || '02:00';
          const [hours, minutes] = timeStr.split(':').map(Number);
          if (now.getHours() === hours && now.getMinutes() === minutes) {
            shouldBackup = true;
          }
          break;
        }
        case 'weekly': {
          const dayOfWeek = settings.backupWeeklyDay !== undefined ? settings.backupWeeklyDay : 0;
          const timeStr = settings.backupWeeklyTime || '02:00';
          const [hours, minutes] = timeStr.split(':').map(Number);
          if (now.getDay() === dayOfWeek && now.getHours() === hours && now.getMinutes() === minutes) {
            shouldBackup = true;
          }
          break;
        }
        case 'monthly': {
          const dayOfMonth = settings.backupMonthlyDay !== undefined ? settings.backupMonthlyDay : 1;
          const timeStr = settings.backupMonthlyTime || '02:00';
          const [hours, minutes] = timeStr.split(':').map(Number);
          if (now.getDate() === dayOfMonth && now.getHours() === hours && now.getMinutes() === minutes) {
            shouldBackup = true;
          }
          break;
        }
      }
      
      if (shouldBackup) {
        performBackup();
      }
    };

    // Perform initial backup
    performBackup();

    // Schedule based on type
    if (scheduleType === 'interval') {
      // For interval, use setInterval
      const intervalMinutes = settings.backupInterval || 60;
      const intervalMs = intervalMinutes * 60 * 1000;
      console.log(`Starting automatic backup: every ${intervalMinutes} minutes to ${settings.backupDirectory}`);
      intervalId = setInterval(performBackup, intervalMs) as unknown as NodeJS.Timeout;
    } else {
      // For daily/weekly/monthly, use setTimeout with recalculation
      console.log(`Starting automatic backup: ${scheduleType} schedule to ${settings.backupDirectory}`);
      scheduleNextBackup();
      
      // Check every minute to see if it's time for backup (handles app restarts)
      checkIntervalId = setInterval(() => {
        checkAndPerformBackup();
      }, 60000) as unknown as NodeJS.Timeout; // Check every minute
    }

    // Cleanup on unmount or when settings change
    return () => {
      console.log('Stopping automatic backup');
      if (intervalId) {
        clearTimeout(intervalId);
      }
      if (checkIntervalId) {
        clearInterval(checkIntervalId);
      }
    };
  }, [
    settings?.backupEnabled,
    settings?.backupDirectory,
    settings?.backupScheduleType,
    settings?.backupInterval,
    settings?.backupDailyTime,
    settings?.backupWeeklyDay,
    settings?.backupWeeklyTime,
    settings?.backupMonthlyDay,
    settings?.backupMonthlyTime,
  ]);

  return (
    <POSContext.Provider value={value}>
      {children}
    </POSContext.Provider>
  );
}
