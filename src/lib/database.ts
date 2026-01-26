// IndexedDB implementation (original)
// SQLite implementation is available in database-sqlite.ts
// To test SQLite, you can temporarily change the imports in this file

import { openDB, DBSchema, IDBPDatabase, deleteDB } from 'idb';

// Re-export all types and interfaces
export type OrderStatus = 'draft' | 'sentToKitchen' | 'paid' | 'cancelled';
export type PaymentMethod = 'cash' | 'card';
export type OrderType = 'dine-in' | 'takeaway';
export type PrinterMode = 'queue' | 'tcp';
// Type de connexion physique de l'imprimante
// - 'tcp' / 'wifi' / 'bluetooth' : gérés via daemon
// - 'windows' : impression via daemon local + spooler Windows (RawPrinterHelper)
export type PrinterConnectionType = 'tcp' | 'bluetooth' | 'wifi' | 'windows';
export type PrinterRole = 'kitchen' | 'cashier';
export type PrintJobStatus = 'pending' | 'printed' | 'failed';
export type PromoType = 'percent' | 'fixed' | 'freeItem';
export type UserRole = 'admin' | 'caissier' | 'chef';
export type Size = 'L' | 'XL' | 'XXL' | 'XXXL' | 'petite' | 'grande' | 'Simple' | 'Cheddar' | 'Classique' | 'Double';

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
  icon?: string;
  image?: string; // Base64 image data
  supplementIds?: string[]; // IDs of supplements available for all products in this category
}

export interface ProductVariant {
  id: string;
  productId: string;
  size: string;
  price: number;
}

export interface ModifierGroup {
  id: string;
  name: string;
  required: boolean;
  multiSelect: boolean;
}

export interface ModifierOption {
  id: string;
  groupId: string;
  name: string;
  priceAdjustment: number;
  sizeBasedPrices?: Record<string, number>;
}

export interface Product {
  id: string;
  categoryId: string;
  name: string;
  basePrice?: number;
  variants?: ProductVariant[];
  modifierGroupIds?: string[];
  sortOrder: number;
  description?: string;
  available?: boolean;
  image?: string; // Base64 image data
  supplementIds?: string[]; // IDs of supplements that can be added to this product
}

export interface OrderLineModifier {
  optionId: string;
  optionName: string;
  priceAdjustment: number;
}

export interface OrderLine {
  id: string;
  productId?: string;
  productName: string;
  categoryId?: string; // For category breakdown in reports
  variantId?: string;
  variantSize?: string;
  quantity: number;
  unitPrice: number;
  modifiers: OrderLineModifier[];
  note?: string;
  isManual: boolean;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  type: OrderType;
  lines: OrderLine[];
  subtotal: number;
  discount: number;
  promoCode?: string;
  promoName?: string;
  total: number;
  paymentMethod?: PaymentMethod;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
  paidAt?: Date;
  sentToKitchenAt?: Date;
}

export interface Printer {
  id: string;
  /** Rôle principal de l'imprimante (pour quel ticket elle sert) */
  role: PrinterRole;
  /** Mode interne (hérité de l'ancienne implémentation) */
  mode: PrinterMode;
  /** Type de connexion physique de l'imprimante */
  connectionType?: PrinterConnectionType;
  /** Nom lisible de l'imprimante (ex: Cuisine 1, Caisse 2) */
  name?: string;
  queueName?: string;
  tcpHost?: string;
  tcpPort?: number;
  isThermalPrinter?: boolean; // true for ESC/POS thermal printers, false for regular printers
  /** Imprimante active ou désactivée (true par défaut si non défini) */
  enabled?: boolean;
}

export interface PrintJob {
  id: string;
  orderId: string;
  printerRole: PrinterRole;
  status: PrintJobStatus;
  errorMessage?: string;
  createdAt: Date;
  printedAt?: Date;
}

export interface Promotion {
  id: string;
  code: string;
  name: string;
  type: PromoType;
  value: number;
  startDate: Date;
  endDate: Date;
  active: boolean;
  minOrderTotal?: number;
  freeItemId?: string;
}

export interface ReceiptCustomization {
  // Display options
  showOrderNumber: boolean;
  showDate: boolean;
  showTime: boolean;
  showOrderType: boolean;
  showPaymentMethod: boolean;
  showCashier: boolean;
  showProducts: boolean;
  showProductPrices: boolean;
  showModifiers: boolean;
  showNotes: boolean;
  showSubtotal: boolean;
  showDiscount: boolean;
  showTotal: boolean;
  showAmountReceived: boolean;
  showChange: boolean;
  
  // Formatting options
  dateFormat: string; // "DD/MM/YYYY", "MM/DD/YYYY", etc.
  timeFormat: string; // "HH:mm", "hh:mm A", etc.
  
  // Layout options
  headerAlignment: 'left' | 'center' | 'right';
  restaurantNameStyle: 'normal' | 'uppercase' | 'lowercase';
  productNameStyle: 'normal' | 'uppercase' | 'lowercase';
  separatorStyle: 'dashes' | 'dots' | 'equals' | 'line' | 'none';
  separatorChar: string; // Custom separator character
  
  // Text options
  fontSize: 'small' | 'normal' | 'large';
  fontFamily: 'monospace' | 'sans-serif' | 'serif';
  
  // Custom labels
  labelOrderNumber: string;
  labelDate: string;
  labelTime: string;
  labelOrderType: string;
  labelPaymentMethod: string;
  labelCashier: string;
  labelSubtotal: string;
  labelDiscount: string;
  labelTotal: string;
  labelAmountReceived: string;
  labelChange: string;
  labelThankYou: string;
  
  // Kitchen ticket specific
  labelKitchenTicket: string;
  labelBonAppetit: string;
  kitchenShowOrderNumber: boolean;
  kitchenShowDate: boolean;
  kitchenShowTime: boolean;
  kitchenShowOrderType: boolean;
  kitchenShowCashier: boolean;
  kitchenShowProducts: boolean;
  kitchenShowProductPrices: boolean;
  kitchenShowModifiers: boolean;
  kitchenShowNotes: boolean;
}

export interface SavedReceiptTemplate {
  id: string;
  name: string;
  customization: ReceiptCustomization;
}

export interface Settings {
  id: string;
  language: string;
  currency: string;
  restaurantName: string;
  address: string;
  phone: string;
  logo?: string;
  receiptHeader: string;
  receiptFooter: string;
  showAddress: boolean;
  showPhone: boolean;
  darkMode: boolean;
  primaryColor: string;
  kioskMode: boolean;
  uiScale?: number; // UI scale factor (0.5 to 2.0, default: 1.0)
  receiptCustomization?: ReceiptCustomization;
  /** Modèles de ticket sauvegardés (mode rapide) */
  savedReceiptTemplates?: SavedReceiptTemplate[];
  /** Configuration de la sauvegarde automatique */
  backupEnabled?: boolean; // Activer/désactiver la sauvegarde automatique
  backupScheduleType?: 'interval' | 'daily' | 'weekly' | 'monthly'; // Type de planification
  backupInterval?: number; // Intervalle en minutes (pour type 'interval')
  backupDailyTime?: string; // Heure au format HH:MM (pour type 'daily', ex: "02:00")
  backupWeeklyDay?: number; // Jour de la semaine 0-6 (0=dimanche, pour type 'weekly')
  backupWeeklyTime?: string; // Heure au format HH:MM (pour type 'weekly')
  backupMonthlyDay?: number; // Jour du mois 1-31 (pour type 'monthly')
  backupMonthlyTime?: string; // Heure au format HH:MM (pour type 'monthly')
  backupDirectory?: string; // Répertoire de sauvegarde
  /** Paiement par carte */
  cardPaymentEnabled?: boolean; // Activer/désactiver le paiement par carte (défaut: false)
}

export interface NumberingCounter {
  id: string;
  date: string;
  counter: number;
}

export interface User {
  id: string;
  username: string;
  password: string;
  pin?: string; // 4-6 digit PIN for quick login
  role: UserRole;
  name: string;
  avatar?: string; // Emoji or initials for quick selection
  createdAt: Date;
  lastLogin?: Date;
  failedAttempts?: number; // Track failed login attempts
  lockedUntil?: Date; // Account lockout time
}

export interface UserSession {
  id: string;
  userId: string;
  loginAt: Date;
  logoutAt?: Date;
  isActive: boolean;
}

// Inventory Management
export interface Supplier {
  id: string;
  name: string;
  contact?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: 'food' | 'beverage' | 'supplies' | 'other';
  unit: string; // 'kg', 'L', 'piece', 'box', etc.
  currentStock: number;
  minStock?: number; // Alert when stock is below this
  unitPrice: number; // Purchase price per unit
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceLine {
  id: string;
  inventoryItemId?: string; // Link to inventory item if exists
  itemName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  supplierId: string;
  supplierName: string;
  date: Date;
  lines: InvoiceLine[];
  subtotal: number;
  tax?: number;
  discount?: number;
  total: number;
  notes?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface POSDBSchema extends DBSchema {
  categories: {
    key: string;
    value: Category;
    indexes: { 'by-sort': number };
  };
  products: {
    key: string;
    value: Product;
    indexes: { 'by-category': string; 'by-sort': number };
  };
  productVariants: {
    key: string;
    value: ProductVariant;
    indexes: { 'by-product': string };
  };
  modifierGroups: {
    key: string;
    value: ModifierGroup;
  };
  modifierOptions: {
    key: string;
    value: ModifierOption;
    indexes: { 'by-group': string };
  };
  orders: {
    key: string;
    value: Order;
    indexes: { 'by-status': OrderStatus; 'by-date': Date };
  };
  printers: {
    key: string;
    value: Printer;
    indexes: { 'by-role': PrinterRole };
  };
  printJobs: {
    key: string;
    value: PrintJob;
    indexes: { 'by-order': string; 'by-status': PrintJobStatus };
  };
  promotions: {
    key: string;
    value: Promotion;
    indexes: { 'by-code': string; 'by-active': number };
  };
  settings: {
    key: string;
    value: Settings;
  };
  numberingCounters: {
    key: string;
    value: NumberingCounter;
    indexes: { 'by-date': string };
  };
  users: {
    key: string;
    value: User;
    indexes: { 'by-username': string; 'by-role': UserRole };
  };
  userSessions: {
    key: string;
    value: UserSession;
    indexes: { 'by-user': string; 'by-date': Date };
  };
  suppliers: {
    key: string;
    value: Supplier;
    indexes: { 'by-name': string };
  };
  inventoryItems: {
    key: string;
    value: InventoryItem;
    indexes: { 'by-category': string; 'by-name': string };
  };
  invoices: {
    key: string;
    value: Invoice;
    indexes: { 'by-supplier': string; 'by-date': Date; 'by-number': string };
  };
}

let dbInstance: IDBPDatabase<POSDBSchema> | null = null;

export async function getDB(): Promise<IDBPDatabase<POSDBSchema>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<POSDBSchema>('FastFoodPOS', 4, {
    upgrade(db, oldVersion, newVersion, transaction) {
      // Version 3 -> 4: Add inventory management stores
      if (oldVersion < 4) {
        const supplierStore = db.createObjectStore('suppliers', { keyPath: 'id' });
        supplierStore.createIndex('by-name', 'name');
        
        const inventoryStore = db.createObjectStore('inventoryItems', { keyPath: 'id' });
        inventoryStore.createIndex('by-category', 'category');
        inventoryStore.createIndex('by-name', 'name');
        
        const invoiceStore = db.createObjectStore('invoices', { keyPath: 'id' });
        invoiceStore.createIndex('by-supplier', 'supplierId');
        invoiceStore.createIndex('by-date', 'date');
        invoiceStore.createIndex('by-number', 'invoiceNumber');
      }
      
      // Version 2 -> 3: Add userSessions store
      if (oldVersion < 3) {
        const sessionStore = db.createObjectStore('userSessions', { keyPath: 'id' });
        sessionStore.createIndex('by-user', 'userId');
        sessionStore.createIndex('by-date', 'loginAt');
      }
      
      // Version 1 -> 2: Add users store
      if (oldVersion < 2) {
        const userStore = db.createObjectStore('users', { keyPath: 'id' });
        userStore.createIndex('by-username', 'username', { unique: true });
        userStore.createIndex('by-role', 'role');
      }

      // Initial creation (version 0 -> 1 or fresh install)
      if (oldVersion < 1) {
        // Categories
        const categoryStore = db.createObjectStore('categories', { keyPath: 'id' });
        categoryStore.createIndex('by-sort', 'sortOrder');

        // Products
        const productStore = db.createObjectStore('products', { keyPath: 'id' });
        productStore.createIndex('by-category', 'categoryId');
        productStore.createIndex('by-sort', 'sortOrder');

        // Product Variants
        const variantStore = db.createObjectStore('productVariants', { keyPath: 'id' });
        variantStore.createIndex('by-product', 'productId');

        // Modifier Groups
        db.createObjectStore('modifierGroups', { keyPath: 'id' });

        // Modifier Options
        const optionStore = db.createObjectStore('modifierOptions', { keyPath: 'id' });
        optionStore.createIndex('by-group', 'groupId');

        // Orders
        const orderStore = db.createObjectStore('orders', { keyPath: 'id' });
        orderStore.createIndex('by-status', 'status');
        orderStore.createIndex('by-date', 'createdAt');

        // Printers
        const printerStore = db.createObjectStore('printers', { keyPath: 'id' });
        printerStore.createIndex('by-role', 'role');

        // Print Jobs
        const printJobStore = db.createObjectStore('printJobs', { keyPath: 'id' });
        printJobStore.createIndex('by-order', 'orderId');
        printJobStore.createIndex('by-status', 'status');

        // Promotions
        const promoStore = db.createObjectStore('promotions', { keyPath: 'id' });
        promoStore.createIndex('by-code', 'code');
        promoStore.createIndex('by-active', 'active');

        // Settings
        db.createObjectStore('settings', { keyPath: 'id' });

        // Numbering Counters
        const counterStore = db.createObjectStore('numberingCounters', { keyPath: 'id' });
        counterStore.createIndex('by-date', 'date');
      }
    },
  });

  return dbInstance;
}

export async function initializeDatabase(): Promise<void> {
  const db = await getDB();

  // Créer/migrer l'admin par défaut
  const allUsers = await db.getAll('users');
  const existingAdmin = allUsers.find(u => u.role === 'admin');

  if (!existingAdmin) {
    // Aucun admin → créer un compte admin par défaut
    const defaultAdmin: User = {
      id: 'admin-default',
      username: 'admin',
      password: 'admin123', // Mot de passe par défaut (sera migré en hash à la première connexion)
      role: 'admin',
      name: 'Administrateur',
      avatar: '👨‍💼',
      createdAt: new Date(),
    };
    await db.put('users', defaultAdmin);
  } else if (existingAdmin.username === 'administrateur') {
    // Admin existant avec ancien username → le migrer vers "admin"
    existingAdmin.username = 'admin';
    await db.put('users', existingAdmin);
  }

  // Check if already initialized (settings exist)
  const existingSettings = await db.get('settings', 'main');
  if (existingSettings) return;

  // Initialize only basic settings and printers (no products/categories)
  // This makes the software start completely empty and ready for customization
  const defaultReceiptCustomization: ReceiptCustomization = {
    showOrderNumber: true,
    showDate: true,
    showTime: true,
    showOrderType: true,
    showPaymentMethod: true,
    showCashier: true,
    showProducts: true,
    showProductPrices: true,
    showModifiers: true,
    showNotes: true,
    showSubtotal: true,
    showDiscount: true,
    showTotal: true,
    showAmountReceived: true,
    showChange: true,
    dateFormat: 'DD/MM/YYYY',
    timeFormat: 'HH:mm',
    headerAlignment: 'center',
    restaurantNameStyle: 'uppercase',
    productNameStyle: 'uppercase',
    separatorStyle: 'dashes',
    separatorChar: '─',
    fontSize: 'normal',
    fontFamily: 'monospace',
    labelOrderNumber: 'COMMANDE N°',
    labelDate: 'DATE',
    labelTime: 'HEURE',
    labelOrderType: 'TYPE',
    labelPaymentMethod: 'PAIEMENT',
    labelCashier: 'CAISSIER',
    labelSubtotal: 'SOUS-TOTAL',
    labelDiscount: 'REMISE',
    labelTotal: 'TOTAL',
    labelAmountReceived: 'MONTANT REÇU',
    labelChange: 'MONNAIE',
    labelThankYou: 'MERCI DE VOTRE VISITE !',
    kitchenShowOrderNumber: true,
    kitchenShowDate: true,
    kitchenShowTime: true,
    kitchenShowOrderType: true,
    kitchenShowCashier: true,
    kitchenShowProducts: true,
    kitchenShowProductPrices: false,
    kitchenShowModifiers: true,
    kitchenShowNotes: true,
  };

  // Create default settings
  await db.put('settings', {
    id: 'main',
    language: 'fr-FR',
    currency: 'DZD',
    restaurantName: 'Fast Food Restaurant',
    address: '123 Rue Principale',
    phone: '+213 555 123 456',
    receiptHeader: 'Bienvenue!',
    receiptFooter: 'Merci de votre visite!',
    showAddress: true,
    showPhone: true,
    darkMode: true,
    primaryColor: '#f97316',
    kioskMode: false,
    receiptCustomization: defaultReceiptCustomization,
  });

  // Aucune imprimante n'est créée par défaut - l'utilisateur les ajoute manuellement
  // No products or categories are seeded - software starts completely empty
}

/**
 * Export products template (categories, products, variants, modifiers)
 * This exports only the product-related data for use as a template
 */
export async function exportProductsTemplate(): Promise<{
  categories: Category[];
  products: Product[];
  productVariants: ProductVariant[];
  modifierGroups: ModifierGroup[];
  modifierOptions: ModifierOption[];
}> {
  const db = await getDB();
  
  return {
    categories: await db.getAll('categories'),
    products: await db.getAll('products'),
    productVariants: await db.getAll('productVariants'),
    modifierGroups: await db.getAll('modifierGroups'),
    modifierOptions: await db.getAll('modifierOptions'),
  };
}

/**
 * Import products template (categories, products, variants, modifiers)
 * This imports only the product-related data from a template file
 * Existing products will be replaced/merged with the imported ones
 */
export async function importProductsTemplate(templateData: {
  categories?: Category[];
  products?: Product[];
  productVariants?: ProductVariant[];
  modifierGroups?: ModifierGroup[];
  modifierOptions?: ModifierOption[];
}): Promise<void> {
  const db = await getDB();

  // Import categories
  if (templateData.categories && Array.isArray(templateData.categories)) {
    for (const category of templateData.categories) {
      await db.put('categories', category);
    }
  }

  // Import modifier groups (must be imported before options)
  if (templateData.modifierGroups && Array.isArray(templateData.modifierGroups)) {
    for (const group of templateData.modifierGroups) {
      await db.put('modifierGroups', group);
    }
  }

  // Import modifier options (depends on groups)
  if (templateData.modifierOptions && Array.isArray(templateData.modifierOptions)) {
    for (const option of templateData.modifierOptions) {
      await db.put('modifierOptions', option);
    }
  }

  // Import products (must be imported before variants)
  if (templateData.products && Array.isArray(templateData.products)) {
    for (const product of templateData.products) {
      await db.put('products', product);
    }
  }

  // Import product variants (depends on products)
  if (templateData.productVariants && Array.isArray(templateData.productVariants)) {
    for (const variant of templateData.productVariants) {
      await db.put('productVariants', variant);
    }
  }
}

/**
 * Reset the database by deleting it and reinitializing
 * WARNING: This will delete ALL data including orders, settings, products, etc.
 * The database will be completely empty (no default products)
 * NOTE: The administrator account is preserved
 */
export async function resetDatabase(): Promise<void> {
  // Sauvegarder l'administrateur avant de supprimer la DB
  let adminUser: User | undefined;
  try {
    const currentDb = await getDB();
    const allUsers = await currentDb.getAll('users');
    adminUser = allUsers.find(u => u.role === 'admin');
  } catch (error) {
    console.warn('Could not backup admin user:', error);
  }

  // Close existing connection if any
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }

  // Delete the database
  await deleteDB('FastFoodPOS');

  // Reinitialize (but don't seed products - keep it empty)
  const db = await getDB();
  
  // Restaurer l'administrateur s'il existait
  if (adminUser) {
    await db.put('users', adminUser);
  }
  
  // Create default settings (but no products/categories)
  const defaultReceiptCustomization: ReceiptCustomization = {
    showOrderNumber: true,
    showDate: true,
    showTime: true,
    showOrderType: true,
    showPaymentMethod: true,
    showCashier: true,
    showProducts: true,
    showProductPrices: true,
    showModifiers: true,
    showNotes: true,
    showSubtotal: true,
    showDiscount: true,
    showTotal: true,
    showAmountReceived: true,
    showChange: true,
    dateFormat: 'DD/MM/YYYY',
    timeFormat: 'HH:mm',
    headerAlignment: 'center',
    restaurantNameStyle: 'uppercase',
    productNameStyle: 'uppercase',
    separatorStyle: 'dashes',
    separatorChar: '─',
    fontSize: 'normal',
    fontFamily: 'monospace',
    labelOrderNumber: 'COMMANDE N°',
    labelDate: 'DATE',
    labelTime: 'HEURE',
    labelOrderType: 'TYPE',
    labelPaymentMethod: 'PAIEMENT',
    labelCashier: 'CAISSIER',
    labelSubtotal: 'SOUS-TOTAL',
    labelDiscount: 'REMISE',
    labelTotal: 'TOTAL',
    labelAmountReceived: 'MONTANT REÇU',
    labelChange: 'MONNAIE',
    labelThankYou: 'MERCI DE VOTRE VISITE !',
    kitchenShowOrderNumber: true,
    kitchenShowDate: true,
    kitchenShowTime: true,
    kitchenShowOrderType: true,
    kitchenShowCashier: true,
    kitchenShowProducts: true,
    kitchenShowProductPrices: false,
    kitchenShowModifiers: true,
    kitchenShowNotes: true,
  };

  await db.put('settings', {
    id: 'main',
    language: 'fr-FR',
    currency: 'DZD',
    restaurantName: 'Fast Food Restaurant',
    address: '123 Rue Principale',
    phone: '+213 555 123 456',
    receiptHeader: 'Bienvenue!',
    receiptFooter: 'Merci de votre visite!',
    showAddress: true,
    showPhone: true,
    darkMode: true,
    primaryColor: '#f97316',
    kioskMode: false,
  });
  
  // Aucune imprimante par défaut - la base est vide (pas de produits, catégories, commandes, imprimantes, etc.)
}

/**
 * Update supplements without affecting other data
 * This adds missing supplements to the database
 */
export async function updateSupplements(): Promise<void> {
  const db = await getDB();
  
  // Check if supplements category exists - if not, don't create anything
  // This function should only update supplements if the category already exists
  const supplementsCategory = await db.get('categories', 'supplements');
  if (!supplementsCategory) {
    // Category doesn't exist, don't create products automatically
    // User must create categories and products manually
    return;
  }
  
  // Get all existing supplements to determine the highest sortOrder
  const existingSupplements = await db.getAllFromIndex('products', 'by-category', 'supplements');
  const maxSortOrder = existingSupplements.length > 0 
    ? Math.max(...existingSupplements.map(p => p.sortOrder || 0))
    : 0;

  // Define new supplements to add (pizza and meat supplements for tacos)
  const newSupplements = [
    // Suppléments de viande pour Tacos
    { name: 'Poulet Tacos', prices: { L: 150, XL: 300, XXL: 350 }, sortOrder: maxSortOrder + 1 },
    { name: 'Merguez Tacos', prices: { L: 150, XL: 300, XXL: 350 }, sortOrder: maxSortOrder + 2 },
    { name: 'Abats Tacos', prices: { L: 150, XL: 300, XXL: 350 }, sortOrder: maxSortOrder + 3 },
    { name: 'VH Tacos', prices: { L: 150, XL: 300, XXL: 350 }, sortOrder: maxSortOrder + 4 },
    // Suppléments Pizza
    { name: 'Poulet Pizza', prices: { L: 150, XL: 300, XXL: 400 }, sortOrder: maxSortOrder + 5 },
    { name: 'VH Pizza', prices: { L: 150, XL: 300, XXL: 400 }, sortOrder: maxSortOrder + 6 },
    { name: 'Merguez Pizza', prices: { L: 150, XL: 300, XXL: 400 }, sortOrder: maxSortOrder + 7 },
    { name: 'Champignons Pizza', prices: { L: 150, XL: 300, XXL: 400 }, sortOrder: maxSortOrder + 8 },
    { name: 'Dinde fumée Pizza', prices: { L: 150, XL: 300, XXL: 400 }, sortOrder: maxSortOrder + 9 },
    { name: 'Thon Pizza', prices: { L: 150, XL: 300, XXL: 400 }, sortOrder: maxSortOrder + 10 },
    { name: 'Crevettes Pizza', prices: { L: 150, XL: 300, XXL: 400 }, sortOrder: maxSortOrder + 11 },
  ];

  // Add or update each supplement
  for (const supplement of newSupplements) {
    const productId = `supplements-${supplement.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
    
    // Check if product already exists
    const existingProduct = await db.get('products', productId);
    if (existingProduct) {
      // Product exists, check and update variants
      for (const [size, price] of Object.entries(supplement.prices)) {
        const variantId = `${productId}-${size}`;
        const existingVariant = await db.get('productVariants', variantId);
        if (!existingVariant) {
          // Add missing variant
          await db.put('productVariants', {
            id: variantId,
            productId,
            size,
            price,
          });
        }
      }
    } else {
      // Product doesn't exist, create it with all variants
      await db.put('products', {
        id: productId,
        categoryId: 'supplements',
        name: supplement.name,
        sortOrder: supplement.sortOrder,
      });

      for (const [size, price] of Object.entries(supplement.prices)) {
        await db.put('productVariants', {
          id: `${productId}-${size}`,
          productId,
          size,
          price,
        });
      }
    }
  }
}

async function seedDatabase(db: IDBPDatabase<POSDBSchema>): Promise<void> {
  // Default receipt customization
  const defaultReceiptCustomization: ReceiptCustomization = {
    // Display options
    showOrderNumber: true,
    showDate: true,
    showTime: true,
    showOrderType: true,
    showPaymentMethod: true,
    showCashier: true,
    showProducts: true,
    showProductPrices: true,
    showModifiers: true,
    showNotes: true,
    showSubtotal: true,
    showDiscount: true,
    showTotal: true,
    showAmountReceived: true,
    showChange: true,
    
    // Formatting options
    dateFormat: 'DD/MM/YYYY',
    timeFormat: 'HH:mm',
    
    // Layout options
    headerAlignment: 'center',
    restaurantNameStyle: 'uppercase',
    productNameStyle: 'uppercase',
    separatorStyle: 'dashes',
    separatorChar: '─',
    
    // Text options
    fontSize: 'normal',
    fontFamily: 'monospace',
    
    // Custom labels
    labelOrderNumber: 'COMMANDE N°',
    labelDate: 'DATE',
    labelTime: 'HEURE',
    labelOrderType: 'TYPE',
    labelPaymentMethod: 'PAIEMENT',
    labelCashier: 'CAISSIER',
    labelSubtotal: 'SOUS-TOTAL',
    labelDiscount: 'REMISE',
    labelTotal: 'TOTAL',
    labelAmountReceived: 'MONTANT REÇU',
    labelChange: 'MONNAIE',
    labelThankYou: 'MERCI DE VOTRE VISITE !',
    
    // Kitchen ticket specific
    labelKitchenTicket: 'TICKET CUISINE',
    labelBonAppetit: 'Bon appétit !',
    kitchenShowOrderNumber: true,
    kitchenShowDate: true,
    kitchenShowTime: true,
    kitchenShowOrderType: true,
    kitchenShowCashier: true,
    kitchenShowProducts: true,
    kitchenShowProductPrices: false,
    kitchenShowModifiers: true,
    kitchenShowNotes: true,
  };

  // Default settings
  await db.put('settings', {
    id: 'main',
    language: 'fr-FR',
    currency: 'DZD',
    restaurantName: 'Fast Food Restaurant',
    address: '123 Rue Principale',
    phone: '+213 555 123 456',
    receiptHeader: 'Bienvenue!',
    receiptFooter: 'Merci de votre visite!',
    showAddress: true,
    showPhone: true,
    darkMode: true,
    primaryColor: '#f97316',
    kioskMode: false,
    receiptCustomization: defaultReceiptCustomization,
  });

  // Default printers
  await db.put('printers', {
    id: 'kitchen',
    role: 'kitchen',
    mode: 'queue',
  });

  await db.put('printers', {
    id: 'cashier',
    role: 'cashier',
    mode: 'queue',
  });

  // Categories
  const categories: Category[] = [
    { id: 'tacos-gratinee', name: 'Tacos Gratiné', sortOrder: 1, icon: '🌮' },
    { id: 'tacos', name: 'Tacos', sortOrder: 2, icon: '🌯' },
    { id: 'makloub', name: 'Makloub', sortOrder: 3, icon: '🥙' },
    { id: 'gratins', name: 'Gratins', sortOrder: 4, icon: '🧀' },
    { id: 'fried-chicken', name: 'Fried Chicken', sortOrder: 5, icon: '🍗' },
    { id: 'tabouna', name: 'Tabouna', sortOrder: 6, icon: '🫓' },
    { id: 'souffle', name: 'Soufflé', sortOrder: 7, icon: '🍲' },
    { id: 'malfouf', name: 'Malfouf', sortOrder: 8, icon: '🥬' },
    { id: 'poutine', name: 'Poutine', sortOrder: 9, icon: '🍟' },
    { id: 'pizza', name: 'Pizza', sortOrder: 10, icon: '🍕' },
    { id: 'burgers', name: 'Burgers', sortOrder: 11, icon: '🍔' },
    { id: 'baguette', name: 'Baguette Farcie', sortOrder: 12, icon: '🥖' },
    { id: 'supplements', name: 'Suppléments', sortOrder: 13, icon: '➕' },
    { id: 'frites', name: 'Frites', sortOrder: 14, icon: '🍟' },
    { id: 'boissons', name: 'Boissons', sortOrder: 15, icon: '🥤' },
  ];

  for (const cat of categories) {
    await db.put('categories', cat);
  }

  // Helper function to create products with variants
  const createProductWithVariants = async (
    categoryId: string,
    name: string,
    prices: Record<string, number>,
    sortOrder: number
  ) => {
    const productId = `${categoryId}-${name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
    
    await db.put('products', {
      id: productId,
      categoryId,
      name,
      sortOrder,
    });

    for (const [size, price] of Object.entries(prices)) {
      await db.put('productVariants', {
        id: `${productId}-${size}`,
        productId,
        size,
        price,
      });
    }
  };

  const createSimpleProduct = async (
    categoryId: string,
    name: string,
    price: number,
    sortOrder: number
  ) => {
    await db.put('products', {
      id: `${categoryId}-${name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`,
      categoryId,
      name,
      basePrice: price,
      sortOrder,
    });
  };

  // TACOS GRATINEE
  await createProductWithVariants('tacos-gratinee', 'Poulet', { L: 400, XL: 800, XXL: 1200 }, 1);
  await createProductWithVariants('tacos-gratinee', 'Viande hachée', { L: 450, XL: 900, XXL: 1350 }, 2);
  await createProductWithVariants('tacos-gratinee', 'Merguez', { L: 400, XL: 800, XXL: 1200 }, 3);
  await createProductWithVariants('tacos-gratinee', 'Abats', { L: 400, XL: 800, XXL: 1200 }, 4);
  await createProductWithVariants('tacos-gratinee', 'Mixte', { L: 550, XL: 1100, XXL: 1650 }, 5);

  // TACOS
  await createProductWithVariants('tacos', 'Poulet', { L: 350, XL: 700, XXL: 1050 }, 1);
  await createProductWithVariants('tacos', 'Viande hachée', { L: 400, XL: 800, XXL: 1200 }, 2);
  await createProductWithVariants('tacos', 'Merguez', { L: 350, XL: 700, XXL: 1050 }, 3);
  await createProductWithVariants('tacos', 'Abats', { L: 350, XL: 700, XXL: 1050 }, 4);
  await createProductWithVariants('tacos', 'Mixte', { L: 500, XL: 1000, XXL: 1500 }, 5);

  // MAKLOUB
  await createSimpleProduct('makloub', 'Poulet', 350, 1);
  await createSimpleProduct('makloub', 'V.H', 400, 2);
  await createSimpleProduct('makloub', 'Merguez', 350, 3);
  await createSimpleProduct('makloub', 'Abats', 350, 4);
  await createSimpleProduct('makloub', 'Mixte', 500, 5);

  // GRATINS
  await createSimpleProduct('gratins', 'Poulet', 450, 1);
  await createSimpleProduct('gratins', 'V.H', 500, 2);
  await createSimpleProduct('gratins', 'Panaché', 600, 3);

  // FRIED CHICKEN
  await createSimpleProduct('fried-chicken', 'Wings x4 + frites', 350, 1);
  await createSimpleProduct('fried-chicken', 'Wings x6 + frites', 450, 2);
  await createSimpleProduct('fried-chicken', 'Wings x8 + frites', 550, 3);
  await createSimpleProduct('fried-chicken', 'Wings x10 + frites', 650, 4);

  // TABOUNA
  await createSimpleProduct('tabouna', 'Poulet', 300, 1);
  await createSimpleProduct('tabouna', 'V.H', 350, 2);
  await createSimpleProduct('tabouna', 'Merguez', 300, 3);
  await createSimpleProduct('tabouna', 'Abats', 300, 4);
  await createSimpleProduct('tabouna', 'Mixte', 450, 5);

  // SOUFFLE
  await createProductWithVariants('souffle', 'Poulet', { 'Sauce rouge': 450, 'Sauce Boisée': 500 }, 1);
  await createProductWithVariants('souffle', 'V.H', { 'Sauce rouge': 500, 'Sauce Boisée': 550 }, 2);
  await createProductWithVariants('souffle', 'Merguez', { 'Sauce rouge': 450, 'Sauce Boisée': 500 }, 3);
  await createProductWithVariants('souffle', 'Panaché', { 'Sauce rouge': 550, 'Sauce Boisée': 600 }, 4);

  // MALFOUF
  await createSimpleProduct('malfouf', 'Poulet', 300, 1);
  await createSimpleProduct('malfouf', 'V.H', 350, 2);
  await createSimpleProduct('malfouf', 'Merguez', 300, 3);
  await createSimpleProduct('malfouf', 'Abats', 300, 4);
  await createSimpleProduct('malfouf', 'Mixte', 450, 5);

  // POUTINE
  await createSimpleProduct('poutine', 'Poulet', 450, 1);
  await createSimpleProduct('poutine', 'V.H', 500, 2);
  await createSimpleProduct('poutine', 'Panaché', 600, 3);

  // PIZZA
  await createProductWithVariants('pizza', 'Margherita', { L: 300, XL: 550, XXL: 700 }, 1);
  await createProductWithVariants('pizza', 'Végétarienne', { L: 450, XL: 850, XXL: 1100 }, 2);
  await createProductWithVariants('pizza', 'Orientale', { L: 450, XL: 900, XXL: 1200 }, 3);
  await createProductWithVariants('pizza', 'Orientale Boisée', { L: 500, XL: 1100, XXL: 1400 }, 4);
  await createProductWithVariants('pizza', 'V.H (Viande hachée)', { L: 450, XL: 900, XXL: 1200 }, 5);
  await createProductWithVariants('pizza', 'V.H Boisée', { L: 500, XL: 1100, XXL: 1400 }, 6);
  await createProductWithVariants('pizza', 'Crevette', { L: 800, XL: 1600, XXL: 2000 }, 7);
  await createProductWithVariants('pizza', 'Crevette Boisée', { L: 900, XL: 1700, XXL: 2200 }, 8);
  await createProductWithVariants('pizza', 'Poulet', { L: 450, XL: 900, XXL: 1200 }, 9);
  await createProductWithVariants('pizza', 'Poulet Boisée', { L: 500, XL: 1100, XXL: 1400 }, 10);
  await createProductWithVariants('pizza', '3 fromages', { L: 500, XL: 900, XXL: 1300 }, 11);
  await createProductWithVariants('pizza', '3 fromages boisée', { L: 600, XL: 1100, XXL: 1450 }, 12);
  await createProductWithVariants('pizza', 'Thon', { L: 450, XL: 900, XXL: 1200 }, 13);
  await createProductWithVariants('pizza', 'Dinde fumée', { L: 500, XL: 1000, XXL: 1500 }, 14);
  await createProductWithVariants('pizza', 'Dinde fumée boisée', { L: 600, XL: 1100, XXL: 1600 }, 15);
  await createProductWithVariants('pizza', 'Panachée', { L: 550, XL: 1100, XXL: 1500 }, 16);
  await createProductWithVariants('pizza', '4 saisons', { L: 800, XL: 1300, XXL: 1600 }, 17);

  // BURGERS - Poulet
  await createProductWithVariants('burgers', 'Poulet Classique', { Simple: 300, Cheddar: 400 }, 1);
  await createProductWithVariants('burgers', 'Poulet Double', { Simple: 500, Cheddar: 600 }, 2);
  // BURGERS - V.H
  await createProductWithVariants('burgers', 'V.H Classique', { Simple: 250, Cheddar: 350 }, 3);
  await createProductWithVariants('burgers', 'V.H Double', { Simple: 450, Cheddar: 550 }, 4);

  // BAGUETTE FARCIE
  await createSimpleProduct('baguette', 'Mixte', 500, 1);

  // SUPPLEMENTS
  await createProductWithVariants('supplements', 'Cheddar Tacos', { L: 100, XL: 200, XXL: 300 }, 1);
  await createProductWithVariants('supplements', 'Sauce Gruyere Tacos', { L: 100, XL: 200, XXL: 300 }, 2);
  await createProductWithVariants('supplements', 'Viande Tacos', { L: 150, XL: 300, XXL: 350 }, 3);
  await createProductWithVariants('supplements', 'Camembert Tacos', { L: 100, XL: 200, XXL: 300 }, 4);
  // Suppléments de viande pour Tacos
  await createProductWithVariants('supplements', 'Poulet Tacos', { L: 150, XL: 300, XXL: 350 }, 5);
  await createProductWithVariants('supplements', 'Merguez Tacos', { L: 150, XL: 300, XXL: 350 }, 6);
  await createProductWithVariants('supplements', 'Abats Tacos', { L: 150, XL: 300, XXL: 350 }, 7);
  await createProductWithVariants('supplements', 'VH Tacos', { L: 150, XL: 300, XXL: 350 }, 8);
  await createProductWithVariants('supplements', 'Camembert', { L: 150, XL: 250, XXL: 350 }, 9);
  await createProductWithVariants('supplements', 'Cheddar', { L: 150, XL: 300, XXL: 400 }, 10);
  await createProductWithVariants('supplements', 'Sauce Gruyere Pizza', { L: 150, XL: 250, XXL: 350 }, 11);
  // Suppléments Pizza
  await createProductWithVariants('supplements', 'Poulet Pizza', { L: 150, XL: 300, XXL: 400 }, 12);
  await createProductWithVariants('supplements', 'VH Pizza', { L: 150, XL: 300, XXL: 400 }, 13);
  await createProductWithVariants('supplements', 'Merguez Pizza', { L: 150, XL: 300, XXL: 400 }, 14);
  await createProductWithVariants('supplements', 'Champignons Pizza', { L: 150, XL: 300, XXL: 400 }, 15);
  await createProductWithVariants('supplements', 'Dinde fumée Pizza', { L: 150, XL: 300, XXL: 400 }, 16);
  await createProductWithVariants('supplements', 'Thon Pizza', { L: 150, XL: 300, XXL: 400 }, 17);
  await createProductWithVariants('supplements', 'Crevettes Pizza', { L: 150, XL: 300, XXL: 400 }, 18);

  // FRITES
  await createSimpleProduct('frites', 'Petite', 100, 1);
  await createSimpleProduct('frites', 'Grande', 200, 2);
  await createProductWithVariants('frites', 'Épicée', { petite: 150, grande: 250 }, 3);
  await createProductWithVariants('frites', 'Cheddar', { petite: 200, grande: 300 }, 4);

  // BOISSONS
  // Canettes
  await createSimpleProduct('boissons', 'Coca Cola Canette', 80, 1);
  await createSimpleProduct('boissons', 'Fanta Canette', 80, 2);
  await createSimpleProduct('boissons', 'Sprite Canette', 80, 3);
  await createSimpleProduct('boissons', 'Orangina Canette', 80, 4);
  await createSimpleProduct('boissons', 'Schweppes Canette', 80, 5);
  await createSimpleProduct('boissons', '7Up Canette', 80, 6);
  await createSimpleProduct('boissons', 'Mirinda Canette', 80, 7);
  await createSimpleProduct('boissons', 'Pepsi Canette', 80, 8);
  await createSimpleProduct('boissons', 'IZEM Canette', 80, 9);
  // Bouteilles 0.5L
  await createSimpleProduct('boissons', 'Coca Cola 0.5L', 120, 10);
  await createSimpleProduct('boissons', 'Fanta 0.5L', 120, 11);
  await createSimpleProduct('boissons', 'Sprite 0.5L', 120, 12);
  await createSimpleProduct('boissons', 'Orangina 0.5L', 120, 13);
  await createSimpleProduct('boissons', 'Schweppes 0.5L', 120, 14);
  await createSimpleProduct('boissons', 'IZEM 0.5L', 120, 15);
  // Bouteilles 1L
  await createSimpleProduct('boissons', 'Coca Cola 1L', 200, 16);
  await createSimpleProduct('boissons', 'Fanta 1L', 200, 17);
  await createSimpleProduct('boissons', 'Sprite 1L', 200, 18);
  await createSimpleProduct('boissons', 'Orangina 1L', 200, 19);
  await createSimpleProduct('boissons', 'IZEM 1L', 200, 20);
  // Bouteilles 1.5L
  await createSimpleProduct('boissons', 'Coca Cola 1.5L', 280, 21);
  await createSimpleProduct('boissons', 'Fanta 1.5L', 280, 22);
  await createSimpleProduct('boissons', 'Sprite 1.5L', 280, 23);
  await createSimpleProduct('boissons', 'IZEM 1.5L', 280, 24);
  // Eau minérale
  await createSimpleProduct('boissons', 'Eau Minérale 0.5L', 50, 25);
  await createSimpleProduct('boissons', 'Eau Minérale 1L', 70, 26);
  await createSimpleProduct('boissons', 'Eau Minérale 1.5L', 100, 27);
  // Jus de fruits
  await createSimpleProduct('boissons', 'Jus d\'Orange 0.5L', 100, 28);
  await createSimpleProduct('boissons', 'Jus de Pomme 0.5L', 100, 29);
  await createSimpleProduct('boissons', 'Jus Multifruits 0.5L', 100, 30);
  // Boissons énergisantes
  await createSimpleProduct('boissons', 'Red Bull', 150, 31);
  await createSimpleProduct('boissons', 'Monster', 180, 32);
  // Café et thé
  await createSimpleProduct('boissons', 'Café', 30, 33);
  await createSimpleProduct('boissons', 'Thé', 30, 34);

  // Sample promotions
  await db.put('promotions', {
    id: 'promo-welcome10',
    code: 'WELCOME10',
    name: 'Bienvenue -10%',
    type: 'percent',
    value: 10,
    startDate: new Date('2024-01-01'),
    endDate: new Date('2030-12-31'),
    active: true,
  });

  await db.put('promotions', {
    id: 'promo-100off',
    code: '100OFF',
    name: '100 DZD de réduction',
    type: 'fixed',
    value: 100,
    startDate: new Date('2024-01-01'),
    endDate: new Date('2030-12-31'),
    active: true,
    minOrderTotal: 500,
  });
}
