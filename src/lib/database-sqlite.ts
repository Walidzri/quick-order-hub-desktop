// SQLite implementation using sql.js
import initSqlJs, { Database } from 'sql.js';

// Re-export all types from database.ts (or define them here if separate)
export type {
  OrderStatus,
  PaymentMethod,
  OrderType,
  PrinterMode,
  PrinterRole,
  PrintJobStatus,
  PromoType,
  UserRole,
  Size,
  Category,
  ProductVariant,
  ModifierGroup,
  ModifierOption,
  Product,
  OrderLineModifier,
  OrderLine,
  Order,
  Printer,
  PrintJob,
  Promotion,
  Settings,
  NumberingCounter,
  User,
  UserSession,
} from './database';

import type {
  OrderStatus,
  PaymentMethod,
  OrderType,
  PrinterMode,
  PrinterRole,
  PrintJobStatus,
  PromoType,
  UserRole,
  Category,
  ProductVariant,
  ModifierGroup,
  ModifierOption,
  Product,
  OrderLineModifier,
  OrderLine,
  Order,
  Printer,
  PrintJob,
  Promotion,
  Settings,
  NumberingCounter,
  User,
  UserSession,
} from './database';

let dbInstance: Database | null = null;
let SQL: typeof initSqlJs | null = null;

/**
 * Initialize SQL.js and return the SQL module
 */
async function initSQL(): Promise<typeof initSqlJs> {
  if (SQL) return SQL;
  
  // Load sql.js from CDN or local files
  // For Vite, we need to configure it properly
  SQL = await initSqlJs({
    locateFile: (file: string) => {
      // Try to load from node_modules, fallback to CDN
      if (typeof window !== 'undefined') {
        return `https://sql.js.org/dist/${file}`;
      }
      return file;
    },
  });
  
  return SQL;
}

/**
 * Load database from localStorage or create a new one
 */
async function loadOrCreateDB(): Promise<Database> {
  if (dbInstance) return dbInstance;
  
  const SQLModule = await initSQL();
  
  // Try to load existing database from localStorage
  const savedDb = localStorage.getItem('pos_sqlite_db');
  
  if (savedDb) {
    try {
      const uint8Array = Uint8Array.from(atob(savedDb), c => c.charCodeAt(0));
      dbInstance = new SQLModule.Database(uint8Array);
    } catch (error) {
      console.warn('Failed to load saved database, creating new one:', error);
      dbInstance = new SQLModule.Database();
      createSchema(dbInstance);
      saveDatabase();
    }
  } else {
    dbInstance = new SQLModule.Database();
    createSchema(dbInstance);
    saveDatabase();
  }
  
  return dbInstance;
}

/**
 * Save database to localStorage
 * Uses chunking to avoid stack overflow with large databases
 */
function saveDatabase(): void {
  if (!dbInstance) return;
  
  try {
    const data = dbInstance.export();
    
    // Convert Uint8Array to base64 in chunks to avoid stack overflow
    const chunkSize = 8192; // Process 8KB at a time
    let binaryString = '';
    
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      binaryString += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    const base64 = btoa(binaryString);
    localStorage.setItem('pos_sqlite_db', base64);
  } catch (error) {
    console.error('Failed to save database:', error);
  }
}

/**
 * Create database schema
 */
function createSchema(db: Database): void {
  // Categories
  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sortOrder INTEGER NOT NULL,
      icon TEXT,
      image TEXT
    )
  `);
  
  // Add image column if it doesn't exist (for existing databases)
  try {
    db.run(`ALTER TABLE categories ADD COLUMN image TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }
  
  db.run(`CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(sortOrder)`);
  
  // Products
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      categoryId TEXT NOT NULL,
      name TEXT NOT NULL,
      basePrice REAL,
      modifierGroupIds TEXT,
      sortOrder INTEGER NOT NULL,
      description TEXT,
      available INTEGER DEFAULT 1,
      image TEXT,
      FOREIGN KEY (categoryId) REFERENCES categories(id)
    )
  `);
  
  // Add image column if it doesn't exist (for existing databases)
  try {
    db.run(`ALTER TABLE products ADD COLUMN image TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }
  
  db.run(`CREATE INDEX IF NOT EXISTS idx_products_category ON products(categoryId)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_products_sort ON products(sortOrder)`);
  
  // Product Variants
  db.run(`
    CREATE TABLE IF NOT EXISTS productVariants (
      id TEXT PRIMARY KEY,
      productId TEXT NOT NULL,
      size TEXT NOT NULL,
      price REAL NOT NULL,
      FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE
    )
  `);
  
  db.run(`CREATE INDEX IF NOT EXISTS idx_variants_product ON productVariants(productId)`);
  
  // Modifier Groups
  db.run(`
    CREATE TABLE IF NOT EXISTS modifierGroups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      required INTEGER NOT NULL DEFAULT 0,
      multiSelect INTEGER NOT NULL DEFAULT 0
    )
  `);
  
  // Modifier Options
  db.run(`
    CREATE TABLE IF NOT EXISTS modifierOptions (
      id TEXT PRIMARY KEY,
      groupId TEXT NOT NULL,
      name TEXT NOT NULL,
      priceAdjustment REAL NOT NULL DEFAULT 0,
      sizeBasedPrices TEXT,
      FOREIGN KEY (groupId) REFERENCES modifierGroups(id) ON DELETE CASCADE
    )
  `);
  
  db.run(`CREATE INDEX IF NOT EXISTS idx_options_group ON modifierOptions(groupId)`);
  
  // Orders
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      orderNumber TEXT NOT NULL,
      status TEXT NOT NULL,
      type TEXT NOT NULL,
      lines TEXT NOT NULL,
      subtotal REAL NOT NULL,
      discount REAL NOT NULL DEFAULT 0,
      promoCode TEXT,
      promoName TEXT,
      total REAL NOT NULL,
      paymentMethod TEXT,
      createdBy TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      paidAt TEXT,
      sentToKitchenAt TEXT
    )
  `);
  
  db.run(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(createdAt)`);
  
  // Migration: add delivery columns (ignore if already exist)
  try { db.run('ALTER TABLE orders ADD COLUMN deliveryAddress TEXT'); } catch (_e) { /* column exists */ }
  try { db.run('ALTER TABLE orders ADD COLUMN deliveryPhone TEXT'); } catch (_e) { /* column exists */ }
  try { db.run('ALTER TABLE orders ADD COLUMN deliveryCustomerName TEXT'); } catch (_e) { /* column exists */ }
  
  // Printers
  db.run(`
    CREATE TABLE IF NOT EXISTS printers (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      mode TEXT NOT NULL,
      queueName TEXT,
      tcpHost TEXT,
      tcpPort INTEGER
    )
  `);
  
  db.run(`CREATE INDEX IF NOT EXISTS idx_printers_role ON printers(role)`);
  
  // Print Jobs
  db.run(`
    CREATE TABLE IF NOT EXISTS printJobs (
      id TEXT PRIMARY KEY,
      orderId TEXT NOT NULL,
      printerRole TEXT NOT NULL,
      status TEXT NOT NULL,
      errorMessage TEXT,
      createdAt TEXT NOT NULL,
      printedAt TEXT,
      FOREIGN KEY (orderId) REFERENCES orders(id)
    )
  `);
  
  db.run(`CREATE INDEX IF NOT EXISTS idx_printjobs_order ON printJobs(orderId)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_printjobs_status ON printJobs(status)`);
  
  // Promotions
  db.run(`
    CREATE TABLE IF NOT EXISTS promotions (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      value REAL NOT NULL,
      startDate TEXT NOT NULL,
      endDate TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      minOrderTotal REAL,
      freeItemId TEXT
    )
  `);
  
  db.run(`CREATE INDEX IF NOT EXISTS idx_promotions_code ON promotions(code)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(active)`);
  
  // Settings
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY,
      language TEXT NOT NULL,
      currency TEXT NOT NULL,
      restaurantName TEXT NOT NULL,
      address TEXT NOT NULL,
      phone TEXT NOT NULL,
      logo TEXT,
      numberingStrategy TEXT NOT NULL,
      numberingPrefix TEXT NOT NULL,
      receiptHeader TEXT NOT NULL,
      receiptFooter TEXT NOT NULL,
      showAddress INTEGER NOT NULL DEFAULT 1,
      showPhone INTEGER NOT NULL DEFAULT 1,
      darkMode INTEGER NOT NULL DEFAULT 0,
      primaryColor TEXT NOT NULL,
      kioskMode INTEGER NOT NULL DEFAULT 0,
      uiScale REAL DEFAULT 1.0,
      receiptCustomization TEXT,
      savedReceiptTemplates TEXT,
      backupEnabled INTEGER DEFAULT 0,
      backupScheduleType TEXT DEFAULT 'interval',
      backupInterval INTEGER DEFAULT 60,
      backupDailyTime TEXT,
      backupWeeklyDay INTEGER,
      backupWeeklyTime TEXT,
      backupMonthlyDay INTEGER,
      backupMonthlyTime TEXT,
      backupDirectory TEXT,
      cardPaymentEnabled INTEGER DEFAULT 0
    )
  `);
  
  // Migration: Add uiScale column if it doesn't exist
  try {
    db.run(`ALTER TABLE settings ADD COLUMN uiScale REAL DEFAULT 1.0`);
  } catch (e) {
    // Column already exists, ignore error
  }
  
  // Migration: Add backup columns if they don't exist
  try {
    db.run(`ALTER TABLE settings ADD COLUMN backupEnabled INTEGER DEFAULT 0`);
  } catch (e) {
    // Column already exists, ignore error
  }
  try {
    db.run(`ALTER TABLE settings ADD COLUMN backupScheduleType TEXT DEFAULT 'interval'`);
  } catch (e) {
    // Column already exists, ignore error
  }
  try {
    db.run(`ALTER TABLE settings ADD COLUMN backupInterval INTEGER DEFAULT 60`);
  } catch (e) {
    // Column already exists, ignore error
  }
  try {
    db.run(`ALTER TABLE settings ADD COLUMN backupDailyTime TEXT`);
  } catch (e) {
    // Column already exists, ignore error
  }
  try {
    db.run(`ALTER TABLE settings ADD COLUMN backupWeeklyDay INTEGER`);
  } catch (e) {
    // Column already exists, ignore error
  }
  try {
    db.run(`ALTER TABLE settings ADD COLUMN backupWeeklyTime TEXT`);
  } catch (e) {
    // Column already exists, ignore error
  }
  try {
    db.run(`ALTER TABLE settings ADD COLUMN backupMonthlyDay INTEGER`);
  } catch (e) {
    // Column already exists, ignore error
  }
  try {
    db.run(`ALTER TABLE settings ADD COLUMN backupMonthlyTime TEXT`);
  } catch (e) {
    // Column already exists, ignore error
  }
  try {
    db.run(`ALTER TABLE settings ADD COLUMN backupDirectory TEXT`);
  } catch (e) {
    // Column already exists, ignore error
  }
  try {
    db.run(`ALTER TABLE settings ADD COLUMN cardPaymentEnabled INTEGER DEFAULT 0`);
  } catch (e) {
    // Column already exists, ignore error
  }
  
  // Migration: Add receiptCustomization column if it doesn't exist
  try {
    db.run(`ALTER TABLE settings ADD COLUMN receiptCustomization TEXT`);
  } catch (e) {
    // Column already exists, ignore error
  }
  
  // Migration: Add savedReceiptTemplates column if it doesn't exist
  try {
    db.run(`ALTER TABLE settings ADD COLUMN savedReceiptTemplates TEXT`);
  } catch (e) {
    // Column already exists, ignore error
  }
  
  // Numbering Counters
  db.run(`
    CREATE TABLE IF NOT EXISTS numberingCounters (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      counter INTEGER NOT NULL DEFAULT 0
    )
  `);
  
  db.run(`CREATE INDEX IF NOT EXISTS idx_counters_date ON numberingCounters(date)`);
  
  // Users
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      name TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      lastLogin TEXT
    )
  `);
  
  db.run(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`);
  
  // User Sessions
  db.run(`
    CREATE TABLE IF NOT EXISTS userSessions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      loginAt TEXT NOT NULL,
      logoutAt TEXT,
      isActive INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);
  
  db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_user ON userSessions(userId)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_date ON userSessions(loginAt)`);
  
  // Suppliers
  db.run(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contact TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      notes TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name)`);
  
  // Inventory Items
  db.run(`
    CREATE TABLE IF NOT EXISTS inventoryItems (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      unit TEXT NOT NULL,
      currentStock REAL NOT NULL DEFAULT 0,
      minStock REAL,
      unitPrice REAL NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventoryItems(category)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_inventory_name ON inventoryItems(name)`);
  
  // Invoices
  db.run(`
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      invoiceNumber TEXT NOT NULL UNIQUE,
      supplierId TEXT NOT NULL,
      supplierName TEXT NOT NULL,
      date TEXT NOT NULL,
      lines TEXT NOT NULL,
      subtotal REAL NOT NULL DEFAULT 0,
      tax REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      notes TEXT,
      createdBy TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (supplierId) REFERENCES suppliers(id)
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_invoices_supplier ON invoices(supplierId)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoiceNumber)`);
}

/**
 * IndexedDB-compatible wrapper for SQLite
 */
export class IndexedDBLikeDB {
  private sqliteDB: SQLiteDB;
  
  constructor(sqliteDB: SQLiteDB) {
    this.sqliteDB = sqliteDB;
  }
  
  async get<T = any>(store: string, key: string): Promise<T | undefined> {
    switch (store) {
      case 'categories':
        return await this.sqliteDB.getCategory(key) as T;
      case 'products':
        return await this.sqliteDB.getProduct(key) as T;
      case 'productVariants':
        return await this.sqliteDB.getVariant(key) as T;
      case 'settings':
        return await this.sqliteDB.getSettings(key) as T;
      case 'orders':
        return await this.sqliteDB.getOrder(key) as T;
      case 'printers':
        return await this.sqliteDB.getPrinter(key) as T;
      case 'promotions':
        return await this.sqliteDB.getPromotion(key) as T;
      case 'numberingCounters':
        return await this.sqliteDB.getNumberingCounter(key) as T;
      case 'users':
        return await this.sqliteDB.getUser(key) as T;
      case 'userSessions':
        return await this.sqliteDB.getUserSession(key) as T;
      case 'suppliers':
        return await this.sqliteDB.getSupplier(key) as T;
      case 'inventoryItems':
        return await this.sqliteDB.getInventoryItem(key) as T;
      case 'invoices':
        return await this.sqliteDB.getInvoice(key) as T;
      default:
        throw new Error(`Unknown store: ${store}`);
    }
  }
  
  async getAll<T = any>(store: string): Promise<T[]> {
    switch (store) {
      case 'categories':
        return await this.sqliteDB.getAllCategories() as T[];
      case 'products':
        return await this.sqliteDB.getAllProducts() as T[];
      case 'productVariants':
        return await this.sqliteDB.getAllVariants() as T[];
      case 'printers':
        return await this.sqliteDB.getAllPrinters() as T[];
      case 'promotions':
        return await this.sqliteDB.getAllPromotions() as T[];
      case 'users':
        return await this.sqliteDB.getAllUsers() as T[];
      case 'userSessions':
        return await this.sqliteDB.getAllUserSessions() as T[];
      case 'orders':
        return await this.sqliteDB.getAllOrders() as T[];
      case 'suppliers':
        return await this.sqliteDB.getAllSuppliers() as T[];
      case 'inventoryItems':
        return await this.sqliteDB.getAllInventoryItems() as T[];
      case 'invoices':
        return await this.sqliteDB.getAllInvoices() as T[];
      default:
        throw new Error(`Unknown store: ${store}`);
    }
  }
  
  async put<T = any>(store: string, value: T): Promise<void> {
    switch (store) {
      case 'categories':
        await this.sqliteDB.putCategory(value as Category);
        break;
      case 'products':
        await this.sqliteDB.putProduct(value as Product);
        break;
      case 'productVariants':
        await this.sqliteDB.putVariant(value as ProductVariant);
        break;
      case 'settings':
        await this.sqliteDB.putSettings(value as Settings);
        break;
      case 'orders':
        await this.sqliteDB.putOrder(value as Order);
        break;
      case 'printers':
        await this.sqliteDB.putPrinter(value as Printer);
        break;
      case 'promotions':
        await this.sqliteDB.putPromotion(value as Promotion);
        break;
      case 'numberingCounters':
        await this.sqliteDB.putNumberingCounter(value as NumberingCounter);
        break;
      case 'users':
        await this.sqliteDB.putUser(value as User);
        break;
      case 'userSessions':
        await this.sqliteDB.putUserSession(value as UserSession);
        break;
      case 'suppliers':
        await this.sqliteDB.putSupplier(value as Supplier);
        break;
      case 'inventoryItems':
        await this.sqliteDB.putInventoryItem(value as InventoryItem);
        break;
      case 'invoices':
        await this.sqliteDB.putInvoice(value as Invoice);
        break;
      default:
        throw new Error(`Unknown store: ${store}`);
    }
  }
  
  async delete(store: string, key: string): Promise<void> {
    switch (store) {
      case 'categories':
        await this.sqliteDB.deleteCategory(key);
        break;
      case 'products':
        await this.sqliteDB.deleteProduct(key);
        break;
      case 'productVariants':
        await this.sqliteDB.deleteVariant(key);
        break;
      case 'orders':
        await this.sqliteDB.deleteOrder(key);
        break;
      case 'promotions':
        await this.sqliteDB.deletePromotion(key);
        break;
      case 'users':
        await this.sqliteDB.deleteUser(key);
        break;
      default:
        throw new Error(`Delete not implemented for store: ${store}`);
    }
  }
  
  async getFromIndex<T = any>(store: string, index: string, value: any): Promise<T | undefined> {
    switch (store) {
      case 'users':
        if (index === 'by-username') {
          return await this.sqliteDB.getUserByUsername(value) as T;
        }
        break;
      case 'promotions':
        if (index === 'by-code') {
          return await this.sqliteDB.getPromotionByCode(value) as T;
        }
        break;
      default:
        throw new Error(`getFromIndex not implemented for store: ${store}, index: ${index}`);
    }
    return undefined;
  }
  
  async getAllFromIndex<T = any>(store: string, index: string, value: any): Promise<T[]> {
    switch (store) {
      case 'productVariants':
        if (index === 'by-product') {
          return await this.sqliteDB.getVariantsByProduct(value) as T[];
        }
        break;
      case 'products':
        if (index === 'by-category') {
          return await this.sqliteDB.getProductsByCategory(value) as T[];
        }
        break;
      case 'userSessions':
        if (index === 'by-user') {
          return await this.sqliteDB.getUserSessionsByUser(value) as T[];
        }
        if (index === 'by-date') {
          // This is more complex, we'd need date range
          // For now, return all and filter in application code
          const all = await this.sqliteDB.getAllUserSessions();
          return all as T[];
        }
        break;
      case 'orders':
        if (index === 'by-status') {
          return await this.sqliteDB.getOrdersByStatus(value) as T[];
        }
        if (index === 'by-date') {
          // Similar to userSessions, return all for now
          const all = await this.sqliteDB.getAllOrders();
          return all as T[];
        }
        break;
      default:
        throw new Error(`getAllFromIndex not implemented for store: ${store}, index: ${index}`);
    }
    return [];
  }
  
  close(): void {
    // SQLite doesn't need explicit close in sql.js
    // The database will be saved on the next saveDatabase() call
  }

  /**
   * Get orders by date range (optimized query)
   */
  async getOrdersByDateRange(startDate: Date, endDate: Date): Promise<Order[]> {
    return await this.sqliteDB.getOrdersByDateRange(startDate, endDate);
  }

  /**
   * Get orders with pagination (optimized query)
   */
  async getOrdersPaginated(limit: number, offset: number): Promise<{ orders: Order[]; total: number }> {
    return await this.sqliteDB.getOrdersPaginated(limit, offset);
  }

  /**
   * Get total count of orders
   */
  async getOrdersCount(): Promise<number> {
    return await this.sqliteDB.getOrdersCount();
  }
}

/**
 * Get database instance (compatible with old API)
 */
export async function getDB(): Promise<IndexedDBLikeDB> {
  const db = await loadOrCreateDB();
  const sqliteDB = new SQLiteDB(db);
  return new IndexedDBLikeDB(sqliteDB);
}

/**
 * Serialize/deserialize JSON helpers for SQLite
 */
function serializeJSON(obj: any): string {
  return JSON.stringify(obj);
}

function deserializeJSON<T>(json: string): T {
  return JSON.parse(json) as T;
}

/**
 * Date helpers for SQLite
 */
function dateToISO(date: Date | string): string {
  if (typeof date === 'string') return date;
  return date.toISOString();
}

function isoToDate(iso: string): Date {
  return new Date(iso);
}

/**
 * Initialize database
 */
export async function initializeDatabase(): Promise<void> {
  const db = await getDB();
  
  // Créer/migrer l'admin par défaut
  const checkAdminStmt = db.prepare('SELECT id, username FROM users WHERE role = ?');
  checkAdminStmt.bind(['admin']);
  const hasAdmin = checkAdminStmt.step();
  const adminRow = hasAdmin ? checkAdminStmt.getAsObject() as { id: string; username: string } : null;
  checkAdminStmt.free();

  if (!hasAdmin) {
    // Aucun admin → créer un compte admin par défaut
    const insertAdminStmt = db.prepare(`
      INSERT INTO users (id, username, password, role, name, avatar, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertAdminStmt.run([
      'admin-default',
      'admin',
      'admin123', // Mot de passe par défaut
      'admin',
      'Administrateur',
      '👨‍💼',
      dateToISO(new Date()),
    ]);
    insertAdminStmt.free();
    saveDatabase();
  } else if (adminRow && adminRow.username === 'administrateur') {
    // Admin existant avec ancien username → le migrer vers "admin"
    const updateStmt = db.prepare('UPDATE users SET username = ? WHERE id = ?');
    updateStmt.run(['admin', adminRow.id]);
    updateStmt.free();
    saveDatabase();
  }
  
  // Check if already initialized (categories exist)
  const stmt = db.prepare('SELECT COUNT(*) as count FROM categories');
  stmt.step();
  const result = stmt.getAsObject();
  const count = result.count as number;
  stmt.free();
  
  if (count > 0) return;
  
  // Seed database
  await seedDatabase(db);
}

/**
 * Reset database
 * NOTE: The administrator account is preserved
 */
export async function resetDatabase(): Promise<void> {
  // Sauvegarder l'administrateur avant de supprimer la DB
  let adminData: any = null;
  try {
    const db = await getDB();
    const stmt = db.prepare('SELECT * FROM users WHERE role = ?');
    stmt.bind(['admin']);
    if (stmt.step()) {
      adminData = stmt.getAsObject();
    }
    stmt.free();
  } catch (error) {
    console.warn('Could not backup admin user:', error);
  }

  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
  
  localStorage.removeItem('pos_sqlite_db');
  
  // Reinitialize
  await initializeDatabase();
  
  // Restaurer l'administrateur s'il existait
  if (adminData) {
    try {
      const db = await getDB();
      const insertStmt = db.prepare(`
        INSERT OR REPLACE INTO users (id, username, password, pin, role, name, avatar, createdAt, lastLogin, failedAttempts, lockedUntil)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insertStmt.run([
        adminData.id,
        adminData.username,
        adminData.password,
        adminData.pin || null,
        adminData.role,
        adminData.name,
        adminData.avatar || null,
        adminData.createdAt,
        adminData.lastLogin || null,
        0, // Reset failed attempts
        null // Clear lockout
      ]);
      insertStmt.free();
      saveDatabase();
    } catch (error) {
      console.warn('Could not restore admin user:', error);
    }
  }
}

/**
 * Update supplements
 */
export async function updateSupplements(): Promise<void> {
  const db = await getDB();
  
  // Get all existing supplements
  const stmt = db.prepare('SELECT MAX(sortOrder) as maxSort FROM products WHERE categoryId = ?');
  stmt.bind(['supplements']);
  stmt.step();
  const result = stmt.getAsObject();
  const maxSortOrder = (result.maxSort as number) || 0;
  stmt.free();
  
  const newSupplements = [
    { name: 'Poulet Tacos', prices: { L: 150, XL: 300, XXL: 350 }, sortOrder: maxSortOrder + 1 },
    { name: 'Merguez Tacos', prices: { L: 150, XL: 300, XXL: 350 }, sortOrder: maxSortOrder + 2 },
    { name: 'Abats Tacos', prices: { L: 150, XL: 300, XXL: 350 }, sortOrder: maxSortOrder + 3 },
    { name: 'VH Tacos', prices: { L: 150, XL: 300, XXL: 350 }, sortOrder: maxSortOrder + 4 },
    { name: 'Poulet Pizza', prices: { L: 150, XL: 300, XXL: 400 }, sortOrder: maxSortOrder + 5 },
    { name: 'VH Pizza', prices: { L: 150, XL: 300, XXL: 400 }, sortOrder: maxSortOrder + 6 },
    { name: 'Merguez Pizza', prices: { L: 150, XL: 300, XXL: 400 }, sortOrder: maxSortOrder + 7 },
    { name: 'Champignons Pizza', prices: { L: 150, XL: 300, XXL: 400 }, sortOrder: maxSortOrder + 8 },
    { name: 'Dinde fumée Pizza', prices: { L: 150, XL: 300, XXL: 400 }, sortOrder: maxSortOrder + 9 },
    { name: 'Thon Pizza', prices: { L: 150, XL: 300, XXL: 400 }, sortOrder: maxSortOrder + 10 },
    { name: 'Crevettes Pizza', prices: { L: 150, XL: 300, XXL: 400 }, sortOrder: maxSortOrder + 11 },
  ];
  
  for (const supplement of newSupplements) {
    const productId = `supplements-${supplement.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
    
    // Check if product exists
    const checkStmt = db.prepare('SELECT id FROM products WHERE id = ?');
    checkStmt.bind([productId]);
    const exists = checkStmt.step();
    checkStmt.free();
    
    if (!exists) {
      // Create product
      const insertProduct = db.prepare(`
        INSERT INTO products (id, categoryId, name, sortOrder, available)
        VALUES (?, ?, ?, ?, ?)
      `);
      insertProduct.run([productId, 'supplements', supplement.name, supplement.sortOrder, 1]);
      insertProduct.free();
      
      // Create variants
      for (const [size, price] of Object.entries(supplement.prices)) {
        const variantId = `${productId}-${size}`;
        const insertVariant = db.prepare(`
          INSERT INTO productVariants (id, productId, size, price)
          VALUES (?, ?, ?, ?)
        `);
        insertVariant.run([variantId, productId, size, price]);
        insertVariant.free();
      }
    } else {
      // Product exists, check variants
      for (const [size, price] of Object.entries(supplement.prices)) {
        const variantId = `${productId}-${size}`;
        const checkVariant = db.prepare('SELECT id FROM productVariants WHERE id = ?');
        checkVariant.bind([variantId]);
        const variantExists = checkVariant.step();
        checkVariant.free();
        
        if (!variantExists) {
          const insertVariant = db.prepare(`
            INSERT INTO productVariants (id, productId, size, price)
            VALUES (?, ?, ?, ?)
          `);
          insertVariant.run([variantId, productId, size, price]);
          insertVariant.free();
        }
      }
    }
  }
  
  saveDatabase();
}

/**
 * Seed database with initial data
 */
async function seedDatabase(db: Database): Promise<void> {
  // Default settings
  const settingsStmt = db.prepare(`
    INSERT INTO settings (
      id, language, currency, restaurantName, address, phone, numberingStrategy,
      numberingPrefix, receiptHeader, receiptFooter, showAddress, showPhone,
      darkMode, primaryColor, kioskMode
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  settingsStmt.run([
    'main',
    'fr-FR',
    'DZD',
    'Fast Food Restaurant',
    '123 Rue Principale',
    '+213 555 123 456',
    'continuous',
    '',
    'Bienvenue!',
    'Merci de votre visite!',
    1,
    1,
    1,
    '#f97316',
    0,
  ]);
  settingsStmt.free();
  
  // Default printers
  const printerStmt = db.prepare(`
    INSERT INTO printers (id, role, mode) VALUES (?, ?, ?)
  `);
  printerStmt.run(['kitchen', 'kitchen', 'queue']);
  printerStmt.run(['cashier', 'cashier', 'queue']);
  printerStmt.free();
  
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
  
  const categoryStmt = db.prepare(`
    INSERT INTO categories (id, name, sortOrder, icon) VALUES (?, ?, ?, ?)
  `);
  for (const cat of categories) {
    categoryStmt.run([cat.id, cat.name, cat.sortOrder, cat.icon || null]);
  }
  categoryStmt.free();
  
  // Helper to create products with variants
  const createProductWithVariants = (
    categoryId: string,
    name: string,
    prices: Record<string, number>,
    sortOrder: number
  ) => {
    const productId = `${categoryId}-${name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
    
    const productStmt = db.prepare(`
      INSERT INTO products (id, categoryId, name, sortOrder, available)
      VALUES (?, ?, ?, ?, ?)
    `);
    productStmt.run([productId, categoryId, name, sortOrder, 1]);
    productStmt.free();
    
    const variantStmt = db.prepare(`
      INSERT INTO productVariants (id, productId, size, price)
      VALUES (?, ?, ?, ?)
    `);
    for (const [size, price] of Object.entries(prices)) {
      variantStmt.run([`${productId}-${size}`, productId, size, price]);
    }
    variantStmt.free();
  };
  
  const createSimpleProduct = (
    categoryId: string,
    name: string,
    price: number,
    sortOrder: number
  ) => {
    const productId = `${categoryId}-${name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
    const productStmt = db.prepare(`
      INSERT INTO products (id, categoryId, name, basePrice, sortOrder, available)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    productStmt.run([productId, categoryId, name, price, sortOrder, 1]);
    productStmt.free();
  };
  
  // Seed all products (same as original seedDatabase function)
  // TACOS GRATINEE
  createProductWithVariants('tacos-gratinee', 'Poulet', { L: 400, XL: 800, XXL: 1200 }, 1);
  createProductWithVariants('tacos-gratinee', 'Viande hachée', { L: 450, XL: 900, XXL: 1350 }, 2);
  createProductWithVariants('tacos-gratinee', 'Merguez', { L: 400, XL: 800, XXL: 1200 }, 3);
  createProductWithVariants('tacos-gratinee', 'Abats', { L: 400, XL: 800, XXL: 1200 }, 4);
  createProductWithVariants('tacos-gratinee', 'Mixte', { L: 550, XL: 1100, XXL: 1650 }, 5);
  
  // TACOS
  createProductWithVariants('tacos', 'Poulet', { L: 350, XL: 700, XXL: 1050 }, 1);
  createProductWithVariants('tacos', 'Viande hachée', { L: 400, XL: 800, XXL: 1200 }, 2);
  createProductWithVariants('tacos', 'Merguez', { L: 350, XL: 700, XXL: 1050 }, 3);
  createProductWithVariants('tacos', 'Abats', { L: 350, XL: 700, XXL: 1050 }, 4);
  createProductWithVariants('tacos', 'Mixte', { L: 500, XL: 1000, XXL: 1500 }, 5);
  
  // MAKLOUB
  createSimpleProduct('makloub', 'Poulet', 350, 1);
  createSimpleProduct('makloub', 'V.H', 400, 2);
  createSimpleProduct('makloub', 'Merguez', 350, 3);
  createSimpleProduct('makloub', 'Abats', 350, 4);
  createSimpleProduct('makloub', 'Mixte', 500, 5);
  
  // GRATINS
  createSimpleProduct('gratins', 'Poulet', 450, 1);
  createSimpleProduct('gratins', 'V.H', 500, 2);
  createSimpleProduct('gratins', 'Panaché', 600, 3);
  
  // FRIED CHICKEN
  createSimpleProduct('fried-chicken', 'Wings x4 + frites', 350, 1);
  createSimpleProduct('fried-chicken', 'Wings x6 + frites', 450, 2);
  createSimpleProduct('fried-chicken', 'Wings x8 + frites', 550, 3);
  createSimpleProduct('fried-chicken', 'Wings x10 + frites', 650, 4);
  
  // TABOUNA
  createSimpleProduct('tabouna', 'Poulet', 300, 1);
  createSimpleProduct('tabouna', 'V.H', 350, 2);
  createSimpleProduct('tabouna', 'Merguez', 300, 3);
  createSimpleProduct('tabouna', 'Abats', 300, 4);
  createSimpleProduct('tabouna', 'Mixte', 450, 5);
  
  // SOUFFLE
  createProductWithVariants('souffle', 'Poulet', { 'Sauce rouge': 450, 'Sauce Boisée': 500 }, 1);
  createProductWithVariants('souffle', 'V.H', { 'Sauce rouge': 500, 'Sauce Boisée': 550 }, 2);
  createProductWithVariants('souffle', 'Merguez', { 'Sauce rouge': 450, 'Sauce Boisée': 500 }, 3);
  createProductWithVariants('souffle', 'Panaché', { 'Sauce rouge': 550, 'Sauce Boisée': 600 }, 4);
  
  // MALFOUF
  createSimpleProduct('malfouf', 'Poulet', 300, 1);
  createSimpleProduct('malfouf', 'V.H', 350, 2);
  createSimpleProduct('malfouf', 'Merguez', 300, 3);
  createSimpleProduct('malfouf', 'Abats', 300, 4);
  createSimpleProduct('malfouf', 'Mixte', 450, 5);
  
  // POUTINE
  createSimpleProduct('poutine', 'Poulet', 450, 1);
  createSimpleProduct('poutine', 'V.H', 500, 2);
  createSimpleProduct('poutine', 'Panaché', 600, 3);
  
  // PIZZA
  createProductWithVariants('pizza', 'Margherita', { L: 300, XL: 550, XXL: 700 }, 1);
  createProductWithVariants('pizza', 'Végétarienne', { L: 450, XL: 850, XXL: 1100 }, 2);
  createProductWithVariants('pizza', 'Orientale', { L: 450, XL: 900, XXL: 1200 }, 3);
  createProductWithVariants('pizza', 'Orientale Boisée', { L: 500, XL: 1100, XXL: 1400 }, 4);
  createProductWithVariants('pizza', 'V.H (Viande hachée)', { L: 450, XL: 900, XXL: 1200 }, 5);
  createProductWithVariants('pizza', 'V.H Boisée', { L: 500, XL: 1100, XXL: 1400 }, 6);
  createProductWithVariants('pizza', 'Crevette', { L: 800, XL: 1600, XXL: 2000 }, 7);
  createProductWithVariants('pizza', 'Crevette Boisée', { L: 900, XL: 1700, XXL: 2200 }, 8);
  createProductWithVariants('pizza', 'Poulet', { L: 450, XL: 900, XXL: 1200 }, 9);
  createProductWithVariants('pizza', 'Poulet Boisée', { L: 500, XL: 1100, XXL: 1400 }, 10);
  createProductWithVariants('pizza', '3 fromages', { L: 500, XL: 900, XXL: 1300 }, 11);
  createProductWithVariants('pizza', '3 fromages boisée', { L: 600, XL: 1100, XXL: 1450 }, 12);
  createProductWithVariants('pizza', 'Thon', { L: 450, XL: 900, XXL: 1200 }, 13);
  createProductWithVariants('pizza', 'Dinde fumée', { L: 500, XL: 1000, XXL: 1500 }, 14);
  createProductWithVariants('pizza', 'Dinde fumée boisée', { L: 600, XL: 1100, XXL: 1600 }, 15);
  createProductWithVariants('pizza', 'Panachée', { L: 550, XL: 1100, XXL: 1500 }, 16);
  createProductWithVariants('pizza', '4 saisons', { L: 800, XL: 1300, XXL: 1600 }, 17);
  
  // BURGERS
  createProductWithVariants('burgers', 'Poulet Classique', { Simple: 300, Cheddar: 400 }, 1);
  createProductWithVariants('burgers', 'Poulet Double', { Simple: 500, Cheddar: 600 }, 2);
  createProductWithVariants('burgers', 'V.H Classique', { Simple: 250, Cheddar: 350 }, 3);
  createProductWithVariants('burgers', 'V.H Double', { Simple: 450, Cheddar: 550 }, 4);
  
  // BAGUETTE FARCIE
  createSimpleProduct('baguette', 'Mixte', 500, 1);
  
  // SUPPLEMENTS
  createProductWithVariants('supplements', 'Cheddar Tacos', { L: 100, XL: 200, XXL: 300 }, 1);
  createProductWithVariants('supplements', 'Sauce Gruyere Tacos', { L: 100, XL: 200, XXL: 300 }, 2);
  createProductWithVariants('supplements', 'Viande Tacos', { L: 150, XL: 300, XXL: 350 }, 3);
  createProductWithVariants('supplements', 'Camembert Tacos', { L: 100, XL: 200, XXL: 300 }, 4);
  createProductWithVariants('supplements', 'Poulet Tacos', { L: 150, XL: 300, XXL: 350 }, 5);
  createProductWithVariants('supplements', 'Merguez Tacos', { L: 150, XL: 300, XXL: 350 }, 6);
  createProductWithVariants('supplements', 'Abats Tacos', { L: 150, XL: 300, XXL: 350 }, 7);
  createProductWithVariants('supplements', 'VH Tacos', { L: 150, XL: 300, XXL: 350 }, 8);
  createProductWithVariants('supplements', 'Camembert', { L: 150, XL: 250, XXL: 350 }, 9);
  createProductWithVariants('supplements', 'Cheddar', { L: 150, XL: 300, XXL: 400 }, 10);
  createProductWithVariants('supplements', 'Sauce Gruyere Pizza', { L: 150, XL: 250, XXL: 350 }, 11);
  createProductWithVariants('supplements', 'Poulet Pizza', { L: 150, XL: 300, XXL: 400 }, 12);
  createProductWithVariants('supplements', 'VH Pizza', { L: 150, XL: 300, XXL: 400 }, 13);
  createProductWithVariants('supplements', 'Merguez Pizza', { L: 150, XL: 300, XXL: 400 }, 14);
  createProductWithVariants('supplements', 'Champignons Pizza', { L: 150, XL: 300, XXL: 400 }, 15);
  createProductWithVariants('supplements', 'Dinde fumée Pizza', { L: 150, XL: 300, XXL: 400 }, 16);
  createProductWithVariants('supplements', 'Thon Pizza', { L: 150, XL: 300, XXL: 400 }, 17);
  createProductWithVariants('supplements', 'Crevettes Pizza', { L: 150, XL: 300, XXL: 400 }, 18);
  
  // FRITES
  createSimpleProduct('frites', 'Petite', 100, 1);
  createSimpleProduct('frites', 'Grande', 200, 2);
  createProductWithVariants('frites', 'Épicée', { petite: 150, grande: 250 }, 3);
  createProductWithVariants('frites', 'Cheddar', { petite: 200, grande: 300 }, 4);
  
  // BOISSONS
  createSimpleProduct('boissons', 'Coca Cola Canette', 80, 1);
  createSimpleProduct('boissons', 'Fanta Canette', 80, 2);
  createSimpleProduct('boissons', 'Sprite Canette', 80, 3);
  createSimpleProduct('boissons', 'Orangina Canette', 80, 4);
  createSimpleProduct('boissons', 'Schweppes Canette', 80, 5);
  createSimpleProduct('boissons', '7Up Canette', 80, 6);
  createSimpleProduct('boissons', 'Mirinda Canette', 80, 7);
  createSimpleProduct('boissons', 'Pepsi Canette', 80, 8);
  createSimpleProduct('boissons', 'IZEM Canette', 80, 9);
  createSimpleProduct('boissons', 'Coca Cola 0.5L', 120, 10);
  createSimpleProduct('boissons', 'Fanta 0.5L', 120, 11);
  createSimpleProduct('boissons', 'Sprite 0.5L', 120, 12);
  createSimpleProduct('boissons', 'Orangina 0.5L', 120, 13);
  createSimpleProduct('boissons', 'Schweppes 0.5L', 120, 14);
  createSimpleProduct('boissons', 'IZEM 0.5L', 120, 15);
  createSimpleProduct('boissons', 'Coca Cola 1L', 200, 16);
  createSimpleProduct('boissons', 'Fanta 1L', 200, 17);
  createSimpleProduct('boissons', 'Sprite 1L', 200, 18);
  createSimpleProduct('boissons', 'Orangina 1L', 200, 19);
  createSimpleProduct('boissons', 'IZEM 1L', 200, 20);
  createSimpleProduct('boissons', 'Coca Cola 1.5L', 280, 21);
  createSimpleProduct('boissons', 'Fanta 1.5L', 280, 22);
  createSimpleProduct('boissons', 'Sprite 1.5L', 280, 23);
  createSimpleProduct('boissons', 'IZEM 1.5L', 280, 24);
  createSimpleProduct('boissons', 'Eau Minérale 0.5L', 50, 25);
  createSimpleProduct('boissons', 'Eau Minérale 1L', 70, 26);
  createSimpleProduct('boissons', 'Eau Minérale 1.5L', 100, 27);
  createSimpleProduct('boissons', 'Jus d\'Orange 0.5L', 100, 28);
  createSimpleProduct('boissons', 'Jus de Pomme 0.5L', 100, 29);
  createSimpleProduct('boissons', 'Jus Multifruits 0.5L', 100, 30);
  createSimpleProduct('boissons', 'Red Bull', 150, 31);
  createSimpleProduct('boissons', 'Monster', 180, 32);
  createSimpleProduct('boissons', 'Café', 30, 33);
  createSimpleProduct('boissons', 'Thé', 30, 34);
  
  // Sample promotions
  const promoStmt = db.prepare(`
    INSERT INTO promotions (
      id, code, name, type, value, startDate, endDate, active, minOrderTotal, freeItemId
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  promoStmt.run([
    'promo-welcome10',
    'WELCOME10',
    'Bienvenue -10%',
    'percent',
    10,
    dateToISO(new Date('2024-01-01')),
    dateToISO(new Date('2030-12-31')),
    1,
    null,
    null,
  ]);
  promoStmt.run([
    'promo-100off',
    '100OFF',
    '100 DZD de réduction',
    'fixed',
    100,
    dateToISO(new Date('2024-01-01')),
    dateToISO(new Date('2030-12-31')),
    1,
    500,
    null,
  ]);
  promoStmt.free();
  
  saveDatabase();
}

// Export wrapper functions to match IndexedDB API
// These will be used by POSContext and AuthContext

/**
 * Database wrapper class to mimic IndexedDB API
 */
export class SQLiteDB {
  public db: Database; // Make public for migration
  
  constructor(db: Database) {
    this.db = db;
  }
  
  // Categories
  async getAllCategories(): Promise<Category[]> {
    const stmt = this.db.prepare('SELECT * FROM categories ORDER BY sortOrder');
    const categories: Category[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      categories.push({
        id: row.id as string,
        name: row.name as string,
        sortOrder: row.sortOrder as number,
        icon: row.icon as string | undefined,
        image: row.image as string | undefined,
      });
    }
    stmt.free();
    return categories;
  }
  
  async getCategory(id: string): Promise<Category | undefined> {
    const stmt = this.db.prepare('SELECT * FROM categories WHERE id = ?');
    stmt.bind([id]);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return {
        id: row.id as string,
        name: row.name as string,
        sortOrder: row.sortOrder as number,
        icon: row.icon as string | undefined,
        image: row.image as string | undefined,
      };
    }
    stmt.free();
    return undefined;
  }
  
  async deleteCategory(id: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM categories WHERE id = ?');
    stmt.run([id]);
    stmt.free();
    // Ensure dbInstance is synchronized with this.db for saveDatabase()
    if (dbInstance !== this.db) {
      dbInstance = this.db;
    }
    saveDatabase();
  }
  
  async putCategory(category: Category): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO categories (id, name, sortOrder, icon, image)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run([category.id, category.name, category.sortOrder, category.icon || null, category.image || null]);
    stmt.free();
    // Ensure dbInstance is synchronized with this.db for saveDatabase()
    if (dbInstance !== this.db) {
      dbInstance = this.db;
    }
    saveDatabase();
  }
  
  // Products
  async getAllProducts(): Promise<Product[]> {
    const stmt = this.db.prepare('SELECT * FROM products ORDER BY sortOrder');
    const products: Product[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      products.push({
        id: row.id as string,
        categoryId: row.categoryId as string,
        name: row.name as string,
        basePrice: row.basePrice as number | undefined,
        modifierGroupIds: row.modifierGroupIds ? deserializeJSON<string[]>(row.modifierGroupIds as string) : undefined,
        sortOrder: row.sortOrder as number,
        description: row.description as string | undefined,
        available: (row.available as number) === 1,
        image: row.image as string | undefined,
      });
    }
    stmt.free();
    return products;
  }
  
  async getProduct(id: string): Promise<Product | undefined> {
    const stmt = this.db.prepare('SELECT * FROM products WHERE id = ?');
    stmt.bind([id]);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return {
        id: row.id as string,
        categoryId: row.categoryId as string,
        name: row.name as string,
        basePrice: row.basePrice as number | undefined,
        modifierGroupIds: row.modifierGroupIds ? deserializeJSON<string[]>(row.modifierGroupIds as string) : undefined,
        sortOrder: row.sortOrder as number,
        description: row.description as string | undefined,
        available: (row.available as number) === 1,
        image: row.image as string | undefined,
      };
    }
    stmt.free();
    return undefined;
  }
  
  async getProductsByCategory(categoryId: string): Promise<Product[]> {
    const stmt = this.db.prepare('SELECT * FROM products WHERE categoryId = ? ORDER BY sortOrder');
    stmt.bind([categoryId]);
    const products: Product[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      products.push({
        id: row.id as string,
        categoryId: row.categoryId as string,
        name: row.name as string,
        basePrice: row.basePrice as number | undefined,
        modifierGroupIds: row.modifierGroupIds ? deserializeJSON<string[]>(row.modifierGroupIds as string) : undefined,
        sortOrder: row.sortOrder as number,
        description: row.description as string | undefined,
        available: (row.available as number) === 1,
        image: row.image as string | undefined,
      });
    }
    stmt.free();
    return products;
  }
  
  async putProduct(product: Product): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO products (
        id, categoryId, name, basePrice, modifierGroupIds, sortOrder, description, available, image
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run([
      product.id,
      product.categoryId,
      product.name,
      product.basePrice || null,
      product.modifierGroupIds ? serializeJSON(product.modifierGroupIds) : null,
      product.sortOrder,
      product.description || null,
      product.available !== false ? 1 : 0,
      product.image || null,
    ]);
    stmt.free();
    // Ensure dbInstance is synchronized with this.db for saveDatabase()
    if (dbInstance !== this.db) {
      dbInstance = this.db;
    }
    saveDatabase();
  }
  
  async deleteProduct(id: string): Promise<void> {
    // Delete variants first (CASCADE should handle this, but we'll do it explicitly)
    const deleteVariants = this.db.prepare('DELETE FROM productVariants WHERE productId = ?');
    deleteVariants.run([id]);
    deleteVariants.free();
    
    const stmt = this.db.prepare('DELETE FROM products WHERE id = ?');
    stmt.run([id]);
    stmt.free();
    // Ensure dbInstance is synchronized with this.db for saveDatabase()
    if (dbInstance !== this.db) {
      dbInstance = this.db;
    }
    saveDatabase();
  }
  
  // Product Variants
  async getAllVariants(): Promise<ProductVariant[]> {
    const stmt = this.db.prepare('SELECT * FROM productVariants');
    const variants: ProductVariant[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      variants.push({
        id: row.id as string,
        productId: row.productId as string,
        size: row.size as string,
        price: row.price as number,
      });
    }
    stmt.free();
    return variants;
  }
  
  async getVariantsByProduct(productId: string): Promise<ProductVariant[]> {
    const stmt = this.db.prepare('SELECT * FROM productVariants WHERE productId = ?');
    stmt.bind([productId]);
    const variants: ProductVariant[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      variants.push({
        id: row.id as string,
        productId: row.productId as string,
        size: row.size as string,
        price: row.price as number,
      });
    }
    stmt.free();
    return variants;
  }
  
  async getVariant(id: string): Promise<ProductVariant | undefined> {
    const stmt = this.db.prepare('SELECT * FROM productVariants WHERE id = ?');
    stmt.bind([id]);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return {
        id: row.id as string,
        productId: row.productId as string,
        size: row.size as string,
        price: row.price as number,
      };
    }
    stmt.free();
    return undefined;
  }
  
  async putVariant(variant: ProductVariant): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO productVariants (id, productId, size, price)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run([variant.id, variant.productId, variant.size, variant.price]);
    stmt.free();
    saveDatabase();
  }
  
  async deleteVariant(id: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM productVariants WHERE id = ?');
    stmt.run([id]);
    stmt.free();
    saveDatabase();
  }
  
  // Settings
  async getSettings(id: string = 'main'): Promise<Settings | undefined> {
    const stmt = this.db.prepare('SELECT * FROM settings WHERE id = ?');
    stmt.bind([id]);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return {
        id: row.id as string,
        language: row.language as string,
        currency: row.currency as string,
        restaurantName: row.restaurantName as string,
        address: row.address as string,
        phone: row.phone as string,
        logo: row.logo as string | undefined,
        receiptHeader: row.receiptHeader as string,
        receiptFooter: row.receiptFooter as string,
        showAddress: (row.showAddress as number) === 1,
        showPhone: (row.showPhone as number) === 1,
        darkMode: (row.darkMode as number) === 1,
        primaryColor: row.primaryColor as string,
        kioskMode: (row.kioskMode as number) === 1,
        uiScale: row.uiScale !== undefined && row.uiScale !== null ? (row.uiScale as number) : undefined,
        receiptCustomization: row.receiptCustomization ? deserializeJSON(row.receiptCustomization as string) : undefined,
        savedReceiptTemplates: row.savedReceiptTemplates ? deserializeJSON(row.savedReceiptTemplates as string) : undefined,
        backupEnabled: row.backupEnabled !== undefined && row.backupEnabled !== null ? (row.backupEnabled as number) === 1 : false,
        backupScheduleType: (row.backupScheduleType as 'interval' | 'daily' | 'weekly' | 'monthly') || 'interval',
        backupInterval: row.backupInterval !== undefined && row.backupInterval !== null ? (row.backupInterval as number) : 60,
        backupDailyTime: row.backupDailyTime as string | undefined,
        backupWeeklyDay: row.backupWeeklyDay !== undefined && row.backupWeeklyDay !== null ? (row.backupWeeklyDay as number) : undefined,
        backupWeeklyTime: row.backupWeeklyTime as string | undefined,
        backupMonthlyDay: row.backupMonthlyDay !== undefined && row.backupMonthlyDay !== null ? (row.backupMonthlyDay as number) : undefined,
        backupMonthlyTime: row.backupMonthlyTime as string | undefined,
        backupDirectory: row.backupDirectory as string | undefined,
        cardPaymentEnabled: row.cardPaymentEnabled !== undefined && row.cardPaymentEnabled !== null ? (row.cardPaymentEnabled as number) === 1 : false,
      };
    }
    stmt.free();
    return undefined;
  }
  
  async putSettings(settings: Settings): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO settings (
        id, language, currency, restaurantName, address, phone, logo,
        numberingStrategy, numberingPrefix, receiptHeader, receiptFooter,
        showAddress, showPhone, darkMode, primaryColor, kioskMode, uiScale, receiptCustomization, savedReceiptTemplates,
        backupEnabled, backupScheduleType, backupInterval, backupDailyTime, backupWeeklyDay, backupWeeklyTime, backupMonthlyDay, backupMonthlyTime, backupDirectory, cardPaymentEnabled
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run([
      settings.id,
      settings.language,
      settings.currency,
      settings.restaurantName,
      settings.address,
      settings.phone,
      settings.logo || null,
      'continuous',
      '',
      settings.receiptHeader,
      settings.receiptFooter,
      settings.showAddress ? 1 : 0,
      settings.showPhone ? 1 : 0,
      settings.darkMode ? 1 : 0,
      settings.primaryColor,
      settings.kioskMode ? 1 : 0,
      settings.uiScale !== undefined ? settings.uiScale : 1.0,
      settings.receiptCustomization ? serializeJSON(settings.receiptCustomization) : null,
      settings.savedReceiptTemplates ? serializeJSON(settings.savedReceiptTemplates) : null,
      settings.backupEnabled ? 1 : 0,
      settings.backupScheduleType || 'interval',
      settings.backupInterval !== undefined ? settings.backupInterval : 60,
      settings.backupDailyTime || null,
      settings.backupWeeklyDay !== undefined ? settings.backupWeeklyDay : null,
      settings.backupWeeklyTime || null,
      settings.backupMonthlyDay !== undefined ? settings.backupMonthlyDay : null,
      settings.backupMonthlyTime || null,
      settings.backupDirectory || null,
      settings.cardPaymentEnabled ? 1 : 0,
    ]);
    stmt.free();
    saveDatabase();
  }
  
  // Orders
  async getAllOrders(): Promise<Order[]> {
    const stmt = this.db.prepare('SELECT * FROM orders ORDER BY createdAt DESC');
    const orders: Order[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      orders.push({
        id: row.id as string,
        orderNumber: row.orderNumber as string,
        status: row.status as OrderStatus,
        type: row.type as OrderType,
        lines: deserializeJSON<OrderLine[]>(row.lines as string),
        subtotal: row.subtotal as number,
        discount: row.discount as number,
        promoCode: row.promoCode as string | undefined,
        promoName: row.promoName as string | undefined,
        total: row.total as number,
        paymentMethod: row.paymentMethod as PaymentMethod | undefined,
        createdBy: row.createdBy as string | undefined,
        createdAt: isoToDate(row.createdAt as string),
        updatedAt: isoToDate(row.updatedAt as string),
        paidAt: row.paidAt ? isoToDate(row.paidAt as string) : undefined,
        sentToKitchenAt: row.sentToKitchenAt ? isoToDate(row.sentToKitchenAt as string) : undefined,
        deliveryAddress: row.deliveryAddress as string | undefined,
        deliveryPhone: row.deliveryPhone as string | undefined,
        deliveryCustomerName: row.deliveryCustomerName as string | undefined,
      });
    }
    stmt.free();
    return orders;
  }
  
  async getOrder(id: string): Promise<Order | undefined> {
    const stmt = this.db.prepare('SELECT * FROM orders WHERE id = ?');
    stmt.bind([id]);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return {
        id: row.id as string,
        orderNumber: row.orderNumber as string,
        status: row.status as OrderStatus,
        type: row.type as OrderType,
        lines: deserializeJSON<OrderLine[]>(row.lines as string),
        subtotal: row.subtotal as number,
        discount: row.discount as number,
        promoCode: row.promoCode as string | undefined,
        promoName: row.promoName as string | undefined,
        total: row.total as number,
        paymentMethod: row.paymentMethod as PaymentMethod | undefined,
        createdBy: row.createdBy as string | undefined,
        createdAt: isoToDate(row.createdAt as string),
        updatedAt: isoToDate(row.updatedAt as string),
        paidAt: row.paidAt ? isoToDate(row.paidAt as string) : undefined,
        sentToKitchenAt: row.sentToKitchenAt ? isoToDate(row.sentToKitchenAt as string) : undefined,
      };
    }
    stmt.free();
    return undefined;
  }
  
  async getOrdersByStatus(status: OrderStatus): Promise<Order[]> {
    const stmt = this.db.prepare('SELECT * FROM orders WHERE status = ? ORDER BY createdAt DESC');
    stmt.bind([status]);
    const orders: Order[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      orders.push({
        id: row.id as string,
        orderNumber: row.orderNumber as string,
        status: row.status as OrderStatus,
        type: row.type as OrderType,
        lines: deserializeJSON<OrderLine[]>(row.lines as string),
        subtotal: row.subtotal as number,
        discount: row.discount as number,
        promoCode: row.promoCode as string | undefined,
        promoName: row.promoName as string | undefined,
        total: row.total as number,
        paymentMethod: row.paymentMethod as PaymentMethod | undefined,
        createdBy: row.createdBy as string | undefined,
        createdAt: isoToDate(row.createdAt as string),
        updatedAt: isoToDate(row.updatedAt as string),
        paidAt: row.paidAt ? isoToDate(row.paidAt as string) : undefined,
        sentToKitchenAt: row.sentToKitchenAt ? isoToDate(row.sentToKitchenAt as string) : undefined,
        deliveryAddress: row.deliveryAddress as string | undefined,
        deliveryPhone: row.deliveryPhone as string | undefined,
        deliveryCustomerName: row.deliveryCustomerName as string | undefined,
      });
    }
    stmt.free();
    return orders;
  }
  
  async getOrdersByDateRange(startDate: Date, endDate: Date): Promise<Order[]> {
    const stmt = this.db.prepare('SELECT * FROM orders WHERE createdAt >= ? AND createdAt <= ? ORDER BY createdAt DESC');
    stmt.bind([dateToISO(startDate), dateToISO(endDate)]);
    const orders: Order[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      orders.push({
        id: row.id as string,
        orderNumber: row.orderNumber as string,
        status: row.status as OrderStatus,
        type: row.type as OrderType,
        lines: deserializeJSON<OrderLine[]>(row.lines as string),
        subtotal: row.subtotal as number,
        discount: row.discount as number,
        promoCode: row.promoCode as string | undefined,
        promoName: row.promoName as string | undefined,
        total: row.total as number,
        paymentMethod: row.paymentMethod as PaymentMethod | undefined,
        createdBy: row.createdBy as string | undefined,
        createdAt: isoToDate(row.createdAt as string),
        updatedAt: isoToDate(row.updatedAt as string),
        paidAt: row.paidAt ? isoToDate(row.paidAt as string) : undefined,
        sentToKitchenAt: row.sentToKitchenAt ? isoToDate(row.sentToKitchenAt as string) : undefined,
        deliveryAddress: row.deliveryAddress as string | undefined,
        deliveryPhone: row.deliveryPhone as string | undefined,
        deliveryCustomerName: row.deliveryCustomerName as string | undefined,
      });
    }
    stmt.free();
    return orders;
  }

  async getOrdersPaginated(limit: number, offset: number): Promise<{ orders: Order[]; total: number }> {
    // Get total count
    const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM orders');
    countStmt.step();
    const total = (countStmt.getAsObject() as { count: number }).count;
    countStmt.free();

    // Get paginated orders
    const stmt = this.db.prepare('SELECT * FROM orders ORDER BY createdAt DESC LIMIT ? OFFSET ?');
    stmt.bind([limit, offset]);
    const orders: Order[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      orders.push({
        id: row.id as string,
        orderNumber: row.orderNumber as string,
        status: row.status as OrderStatus,
        type: row.type as OrderType,
        lines: deserializeJSON<OrderLine[]>(row.lines as string),
        subtotal: row.subtotal as number,
        discount: row.discount as number,
        promoCode: row.promoCode as string | undefined,
        promoName: row.promoName as string | undefined,
        total: row.total as number,
        paymentMethod: row.paymentMethod as PaymentMethod | undefined,
        createdBy: row.createdBy as string | undefined,
        createdAt: isoToDate(row.createdAt as string),
        updatedAt: isoToDate(row.updatedAt as string),
        paidAt: row.paidAt ? isoToDate(row.paidAt as string) : undefined,
        sentToKitchenAt: row.sentToKitchenAt ? isoToDate(row.sentToKitchenAt as string) : undefined,
        deliveryAddress: row.deliveryAddress as string | undefined,
        deliveryPhone: row.deliveryPhone as string | undefined,
        deliveryCustomerName: row.deliveryCustomerName as string | undefined,
      });
    }
    stmt.free();
    return { orders, total };
  }

  async getOrdersCount(): Promise<number> {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM orders');
    stmt.step();
    const result = (stmt.getAsObject() as { count: number }).count;
    stmt.free();
    return result;
  }
  
  async putOrder(order: Order): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO orders (
        id, orderNumber, status, type, lines, subtotal, discount, promoCode, promoName,
        total, paymentMethod, createdBy, createdAt, updatedAt, paidAt, sentToKitchenAt,
        deliveryAddress, deliveryPhone, deliveryCustomerName
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run([
      order.id,
      order.orderNumber,
      order.status,
      order.type,
      serializeJSON(order.lines),
      order.subtotal,
      order.discount,
      order.promoCode || null,
      order.promoName || null,
      order.total,
      order.paymentMethod || null,
      order.createdBy || null,
      dateToISO(order.createdAt),
      dateToISO(order.updatedAt),
      order.paidAt ? dateToISO(order.paidAt) : null,
      order.sentToKitchenAt ? dateToISO(order.sentToKitchenAt) : null,
      order.deliveryAddress || null,
      order.deliveryPhone || null,
      order.deliveryCustomerName || null,
    ]);
    stmt.free();
    saveDatabase();
  }
  
  async deleteOrder(id: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM orders WHERE id = ?');
    stmt.run([id]);
    stmt.free();
    saveDatabase();
  }
  
  // Printers
  async getAllPrinters(): Promise<Printer[]> {
    const stmt = this.db.prepare('SELECT * FROM printers');
    const printers: Printer[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      printers.push({
        id: row.id as string,
        role: row.role as PrinterRole,
        mode: row.mode as PrinterMode,
        queueName: row.queueName as string | undefined,
        tcpHost: row.tcpHost as string | undefined,
        tcpPort: row.tcpPort as number | undefined,
      });
    }
    stmt.free();
    return printers;
  }
  
  async getPrinter(id: string): Promise<Printer | undefined> {
    const stmt = this.db.prepare('SELECT * FROM printers WHERE id = ?');
    stmt.bind([id]);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return {
        id: row.id as string,
        role: row.role as PrinterRole,
        mode: row.mode as PrinterMode,
        queueName: row.queueName as string | undefined,
        tcpHost: row.tcpHost as string | undefined,
        tcpPort: row.tcpPort as number | undefined,
      };
    }
    stmt.free();
    return undefined;
  }
  
  async putPrinter(printer: Printer): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO printers (id, role, mode, queueName, tcpHost, tcpPort)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run([
      printer.id,
      printer.role,
      printer.mode,
      printer.queueName || null,
      printer.tcpHost || null,
      printer.tcpPort || null,
    ]);
    stmt.free();
    saveDatabase();
  }
  
  // Promotions
  async getAllPromotions(): Promise<Promotion[]> {
    const stmt = this.db.prepare('SELECT * FROM promotions');
    const promotions: Promotion[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      promotions.push({
        id: row.id as string,
        code: row.code as string,
        name: row.name as string,
        type: row.type as PromoType,
        value: row.value as number,
        startDate: isoToDate(row.startDate as string),
        endDate: isoToDate(row.endDate as string),
        active: (row.active as number) === 1,
        minOrderTotal: row.minOrderTotal as number | undefined,
        freeItemId: row.freeItemId as string | undefined,
      });
    }
    stmt.free();
    return promotions;
  }
  
  async getPromotion(id: string): Promise<Promotion | undefined> {
    const stmt = this.db.prepare('SELECT * FROM promotions WHERE id = ?');
    stmt.bind([id]);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return {
        id: row.id as string,
        code: row.code as string,
        name: row.name as string,
        type: row.type as PromoType,
        value: row.value as number,
        startDate: isoToDate(row.startDate as string),
        endDate: isoToDate(row.endDate as string),
        active: (row.active as number) === 1,
        minOrderTotal: row.minOrderTotal as number | undefined,
        freeItemId: row.freeItemId as string | undefined,
      };
    }
    stmt.free();
    return undefined;
  }
  
  async getPromotionByCode(code: string): Promise<Promotion | undefined> {
    const stmt = this.db.prepare('SELECT * FROM promotions WHERE code = ?');
    stmt.bind([code]);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return {
        id: row.id as string,
        code: row.code as string,
        name: row.name as string,
        type: row.type as PromoType,
        value: row.value as number,
        startDate: isoToDate(row.startDate as string),
        endDate: isoToDate(row.endDate as string),
        active: (row.active as number) === 1,
        minOrderTotal: row.minOrderTotal as number | undefined,
        freeItemId: row.freeItemId as string | undefined,
      };
    }
    stmt.free();
    return undefined;
  }
  
  async putPromotion(promotion: Promotion): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO promotions (
        id, code, name, type, value, startDate, endDate, active, minOrderTotal, freeItemId
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run([
      promotion.id,
      promotion.code,
      promotion.name,
      promotion.type,
      promotion.value,
      dateToISO(promotion.startDate),
      dateToISO(promotion.endDate),
      promotion.active ? 1 : 0,
      promotion.minOrderTotal || null,
      promotion.freeItemId || null,
    ]);
    stmt.free();
    saveDatabase();
  }
  
  async deletePromotion(id: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM promotions WHERE id = ?');
    stmt.run([id]);
    stmt.free();
    saveDatabase();
  }
  
  // Numbering Counters
  async getNumberingCounter(id: string): Promise<NumberingCounter | undefined> {
    const stmt = this.db.prepare('SELECT * FROM numberingCounters WHERE id = ?');
    stmt.bind([id]);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return {
        id: row.id as string,
        date: row.date as string,
        counter: row.counter as number,
      };
    }
    stmt.free();
    return undefined;
  }
  
  async putNumberingCounter(counter: NumberingCounter): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO numberingCounters (id, date, counter)
      VALUES (?, ?, ?)
    `);
    stmt.run([counter.id, counter.date, counter.counter]);
    stmt.free();
    saveDatabase();
  }
  
  // Modifier Groups
  async getAllModifierGroups(): Promise<ModifierGroup[]> {
    const stmt = this.db.prepare('SELECT * FROM modifierGroups');
    const groups: ModifierGroup[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      groups.push({
        id: row.id as string,
        name: row.name as string,
        required: (row.required as number) === 1,
        multiSelect: (row.multiSelect as number) === 1,
      });
    }
    stmt.free();
    return groups;
  }
  
  async getModifierGroup(id: string): Promise<ModifierGroup | undefined> {
    const stmt = this.db.prepare('SELECT * FROM modifierGroups WHERE id = ?');
    stmt.bind([id]);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return {
        id: row.id as string,
        name: row.name as string,
        required: (row.required as number) === 1,
        multiSelect: (row.multiSelect as number) === 1,
      };
    }
    stmt.free();
    return undefined;
  }
  
  async putModifierGroup(group: ModifierGroup): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO modifierGroups (id, name, required, multiSelect)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run([
      group.id,
      group.name,
      group.required ? 1 : 0,
      group.multiSelect ? 1 : 0,
    ]);
    stmt.free();
    saveDatabase();
  }
  
  // Modifier Options
  async getAllModifierOptions(): Promise<ModifierOption[]> {
    const stmt = this.db.prepare('SELECT * FROM modifierOptions');
    const options: ModifierOption[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      options.push({
        id: row.id as string,
        groupId: row.groupId as string,
        name: row.name as string,
        priceAdjustment: row.priceAdjustment as number,
        sizeBasedPrices: row.sizeBasedPrices ? deserializeJSON<Record<string, number>>(row.sizeBasedPrices as string) : undefined,
      });
    }
    stmt.free();
    return options;
  }
  
  async getModifierOptionsByGroup(groupId: string): Promise<ModifierOption[]> {
    const stmt = this.db.prepare('SELECT * FROM modifierOptions WHERE groupId = ?');
    stmt.bind([groupId]);
    const options: ModifierOption[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      options.push({
        id: row.id as string,
        groupId: row.groupId as string,
        name: row.name as string,
        priceAdjustment: row.priceAdjustment as number,
        sizeBasedPrices: row.sizeBasedPrices ? deserializeJSON<Record<string, number>>(row.sizeBasedPrices as string) : undefined,
      });
    }
    stmt.free();
    return options;
  }
  
  async putModifierOption(option: ModifierOption): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO modifierOptions (id, groupId, name, priceAdjustment, sizeBasedPrices)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run([
      option.id,
      option.groupId,
      option.name,
      option.priceAdjustment,
      option.sizeBasedPrices ? serializeJSON(option.sizeBasedPrices) : null,
    ]);
    stmt.free();
    saveDatabase();
  }
  
  // Users
  async getAllUsers(): Promise<User[]> {
    const stmt = this.db.prepare('SELECT * FROM users');
    const users: User[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      users.push({
        id: row.id as string,
        username: row.username as string,
        password: row.password as string,
        role: row.role as UserRole,
        name: row.name as string,
        createdAt: isoToDate(row.createdAt as string),
        lastLogin: row.lastLogin ? isoToDate(row.lastLogin as string) : undefined,
      });
    }
    stmt.free();
    return users;
  }
  
  async getUser(id: string): Promise<User | undefined> {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    stmt.bind([id]);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return {
        id: row.id as string,
        username: row.username as string,
        password: row.password as string,
        role: row.role as UserRole,
        name: row.name as string,
        createdAt: isoToDate(row.createdAt as string),
        lastLogin: row.lastLogin ? isoToDate(row.lastLogin as string) : undefined,
      };
    }
    stmt.free();
    return undefined;
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    const stmt = this.db.prepare('SELECT * FROM users WHERE username = ?');
    stmt.bind([username]);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return {
        id: row.id as string,
        username: row.username as string,
        password: row.password as string,
        role: row.role as UserRole,
        name: row.name as string,
        createdAt: isoToDate(row.createdAt as string),
        lastLogin: row.lastLogin ? isoToDate(row.lastLogin as string) : undefined,
      };
    }
    stmt.free();
    return undefined;
  }
  
  async putUser(user: User): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO users (id, username, password, role, name, createdAt, lastLogin)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run([
      user.id,
      user.username,
      user.password,
      user.role,
      user.name,
      dateToISO(user.createdAt),
      user.lastLogin ? dateToISO(user.lastLogin) : null,
    ]);
    stmt.free();
    saveDatabase();
  }
  
  async deleteUser(id: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM users WHERE id = ?');
    stmt.run([id]);
    stmt.free();
    saveDatabase();
  }
  
  // User Sessions
  async getAllUserSessions(): Promise<UserSession[]> {
    const stmt = this.db.prepare('SELECT * FROM userSessions ORDER BY loginAt DESC');
    const sessions: UserSession[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      sessions.push({
        id: row.id as string,
        userId: row.userId as string,
        loginAt: isoToDate(row.loginAt as string),
        logoutAt: row.logoutAt ? isoToDate(row.logoutAt as string) : undefined,
        isActive: (row.isActive as number) === 1,
      });
    }
    stmt.free();
    return sessions;
  }
  
  // Suppliers methods
  async getAllSuppliers(): Promise<Supplier[]> {
    const stmt = this.db.prepare('SELECT * FROM suppliers ORDER BY name');
    const suppliers: Supplier[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      suppliers.push({
        id: row.id as string,
        name: row.name as string,
        contact: row.contact as string | undefined,
        phone: row.phone as string | undefined,
        email: row.email as string | undefined,
        address: row.address as string | undefined,
        notes: row.notes as string | undefined,
        createdAt: isoToDate(row.createdAt as string),
        updatedAt: isoToDate(row.updatedAt as string),
      });
    }
    stmt.free();
    return suppliers;
  }
  
  async getSupplier(id: string): Promise<Supplier | undefined> {
    const stmt = this.db.prepare('SELECT * FROM suppliers WHERE id = ?');
    stmt.bind([id]);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return {
        id: row.id as string,
        name: row.name as string,
        contact: row.contact as string | undefined,
        phone: row.phone as string | undefined,
        email: row.email as string | undefined,
        address: row.address as string | undefined,
        notes: row.notes as string | undefined,
        createdAt: isoToDate(row.createdAt as string),
        updatedAt: isoToDate(row.updatedAt as string),
      };
    }
    stmt.free();
    return undefined;
  }
  
  async putSupplier(supplier: Supplier): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO suppliers (
        id, name, contact, phone, email, address, notes, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run([
      supplier.id,
      supplier.name,
      supplier.contact || null,
      supplier.phone || null,
      supplier.email || null,
      supplier.address || null,
      supplier.notes || null,
      dateToISO(supplier.createdAt),
      dateToISO(supplier.updatedAt),
    ]);
    stmt.free();
  }
  
  async deleteSupplier(id: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM suppliers WHERE id = ?');
    stmt.run([id]);
    stmt.free();
  }
  
  // Inventory Items methods
  async getAllInventoryItems(): Promise<InventoryItem[]> {
    const stmt = this.db.prepare('SELECT * FROM inventoryItems ORDER BY name');
    const items: InventoryItem[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      items.push({
        id: row.id as string,
        name: row.name as string,
        category: row.category as 'food' | 'beverage' | 'supplies' | 'other',
        unit: row.unit as string,
        currentStock: row.currentStock as number,
        minStock: row.minStock as number | undefined,
        unitPrice: row.unitPrice as number,
        createdAt: isoToDate(row.createdAt as string),
        updatedAt: isoToDate(row.updatedAt as string),
      });
    }
    stmt.free();
    return items;
  }
  
  async getInventoryItem(id: string): Promise<InventoryItem | undefined> {
    const stmt = this.db.prepare('SELECT * FROM inventoryItems WHERE id = ?');
    stmt.bind([id]);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return {
        id: row.id as string,
        name: row.name as string,
        category: row.category as 'food' | 'beverage' | 'supplies' | 'other',
        unit: row.unit as string,
        currentStock: row.currentStock as number,
        minStock: row.minStock as number | undefined,
        unitPrice: row.unitPrice as number,
        createdAt: isoToDate(row.createdAt as string),
        updatedAt: isoToDate(row.updatedAt as string),
      };
    }
    stmt.free();
    return undefined;
  }
  
  async putInventoryItem(item: InventoryItem): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO inventoryItems (
        id, name, category, unit, currentStock, minStock, unitPrice, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run([
      item.id,
      item.name,
      item.category,
      item.unit,
      item.currentStock,
      item.minStock || null,
      item.unitPrice,
      dateToISO(item.createdAt),
      dateToISO(item.updatedAt),
    ]);
    stmt.free();
  }
  
  async deleteInventoryItem(id: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM inventoryItems WHERE id = ?');
    stmt.run([id]);
    stmt.free();
  }
  
  // Invoices methods
  async getAllInvoices(): Promise<Invoice[]> {
    const stmt = this.db.prepare('SELECT * FROM invoices ORDER BY date DESC');
    const invoices: Invoice[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      invoices.push({
        id: row.id as string,
        invoiceNumber: row.invoiceNumber as string,
        supplierId: row.supplierId as string,
        supplierName: row.supplierName as string,
        date: isoToDate(row.date as string),
        lines: deserializeJSON<InvoiceLine[]>(row.lines as string),
        subtotal: row.subtotal as number,
        tax: row.tax as number | undefined,
        discount: row.discount as number | undefined,
        total: row.total as number,
        notes: row.notes as string | undefined,
        createdBy: row.createdBy as string | undefined,
        createdAt: isoToDate(row.createdAt as string),
        updatedAt: isoToDate(row.updatedAt as string),
      });
    }
    stmt.free();
    return invoices;
  }
  
  async getInvoice(id: string): Promise<Invoice | undefined> {
    const stmt = this.db.prepare('SELECT * FROM invoices WHERE id = ?');
    stmt.bind([id]);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return {
        id: row.id as string,
        invoiceNumber: row.invoiceNumber as string,
        supplierId: row.supplierId as string,
        supplierName: row.supplierName as string,
        date: isoToDate(row.date as string),
        lines: deserializeJSON<InvoiceLine[]>(row.lines as string),
        subtotal: row.subtotal as number,
        tax: row.tax as number | undefined,
        discount: row.discount as number | undefined,
        total: row.total as number,
        notes: row.notes as string | undefined,
        createdBy: row.createdBy as string | undefined,
        createdAt: isoToDate(row.createdAt as string),
        updatedAt: isoToDate(row.updatedAt as string),
      };
    }
    stmt.free();
    return undefined;
  }
  
  async putInvoice(invoice: Invoice): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO invoices (
        id, invoiceNumber, supplierId, supplierName, date, lines, subtotal, tax, discount, total, notes, createdBy, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run([
      invoice.id,
      invoice.invoiceNumber,
      invoice.supplierId,
      invoice.supplierName,
      dateToISO(invoice.date),
      serializeJSON(invoice.lines),
      invoice.subtotal,
      invoice.tax || null,
      invoice.discount || null,
      invoice.total,
      invoice.notes || null,
      invoice.createdBy || null,
      dateToISO(invoice.createdAt),
      dateToISO(invoice.updatedAt),
    ]);
    stmt.free();
  }
  
  async deleteInvoice(id: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM invoices WHERE id = ?');
    stmt.run([id]);
    stmt.free();
  }
  
  async getUserSession(id: string): Promise<UserSession | undefined> {
    const stmt = this.db.prepare('SELECT * FROM userSessions WHERE id = ?');
    stmt.bind([id]);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return {
        id: row.id as string,
        userId: row.userId as string,
        loginAt: isoToDate(row.loginAt as string),
        logoutAt: row.logoutAt ? isoToDate(row.logoutAt as string) : undefined,
        isActive: (row.isActive as number) === 1,
      };
    }
    stmt.free();
    return undefined;
  }
  
  async getUserSessionsByUser(userId: string): Promise<UserSession[]> {
    const stmt = this.db.prepare('SELECT * FROM userSessions WHERE userId = ? ORDER BY loginAt DESC');
    stmt.bind([userId]);
    const sessions: UserSession[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      sessions.push({
        id: row.id as string,
        userId: row.userId as string,
        loginAt: isoToDate(row.loginAt as string),
        logoutAt: row.logoutAt ? isoToDate(row.logoutAt as string) : undefined,
        isActive: (row.isActive as number) === 1,
      });
    }
    stmt.free();
    return sessions;
  }
  
  async getUserSessionsByDateRange(startDate: Date, endDate: Date): Promise<UserSession[]> {
    const stmt = this.db.prepare('SELECT * FROM userSessions WHERE loginAt >= ? AND loginAt <= ? ORDER BY loginAt DESC');
    stmt.bind([dateToISO(startDate), dateToISO(endDate)]);
    const sessions: UserSession[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      sessions.push({
        id: row.id as string,
        userId: row.userId as string,
        loginAt: isoToDate(row.loginAt as string),
        logoutAt: row.logoutAt ? isoToDate(row.logoutAt as string) : undefined,
        isActive: (row.isActive as number) === 1,
      });
    }
    stmt.free();
    return sessions;
  }
  
  async putUserSession(session: UserSession): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO userSessions (id, userId, loginAt, logoutAt, isActive)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run([
      session.id,
      session.userId,
      dateToISO(session.loginAt),
      session.logoutAt ? dateToISO(session.logoutAt) : null,
      session.isActive ? 1 : 0,
    ]);
    stmt.free();
    saveDatabase();
  }
}

/**
 * Get database wrapper instance (internal use)
 */
export async function getSQLiteDB(): Promise<SQLiteDB> {
  const db = await loadOrCreateDB();
  return new SQLiteDB(db);
}

/**
 * Export database as Uint8Array for backup
 */
export async function exportDatabase(): Promise<Uint8Array> {
  const db = await loadOrCreateDB();
  return db.export();
}

/**
 * Export database as base64 string for backup
 * Uses chunking to avoid stack overflow with large databases
 */
export async function exportDatabaseAsBase64(): Promise<string> {
  const data = await exportDatabase();
  
  // Convert Uint8Array to base64 in chunks to avoid stack overflow
  const chunkSize = 8192; // Process 8KB at a time
  let binaryString = '';
  
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    binaryString += String.fromCharCode.apply(null, Array.from(chunk));
  }
  
  return btoa(binaryString);
}

/**
 * Create a backup of the database to a JSON file (compatible with existing import/export)
 * @param directory Directory where to save the backup
 * @returns Path to the saved backup file or null if failed
 */
export async function createBackup(directory: string): Promise<string | null> {
  try {
    // Check if Electron API is available
    if (typeof window === 'undefined' || !window.electronAPI) {
      console.error('Electron API not available for backup');
      return null;
    }

    // Generate backup filename with timestamp
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `backup_${timestamp}.json`;
    const filePath = directory ? `${directory}/${filename}` : filename;

    // Get database wrapper
    const { getDB } = await import('@/lib/database');
    const db = await getDB();

    // Export all data from all stores (same format as manual export)
    const backupData = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      data: {
        categories: await db.getAll('categories'),
        products: await db.getAll('products'),
        productVariants: await db.getAll('productVariants'),
        modifierGroups: await db.getAll('modifierGroups'),
        modifierOptions: await db.getAll('modifierOptions'),
        orders: await db.getAll('orders'),
        printers: await db.getAll('printers'),
        printJobs: await db.getAll('printJobs'),
        promotions: await db.getAll('promotions'),
        settings: await db.getAll('settings'),
        numberingCounters: await db.getAll('numberingCounters'),
        users: await db.getAll('users'),
        userSessions: await db.getAll('userSessions'),
        suppliers: await db.getAll('suppliers'),
        inventoryItems: await db.getAll('inventoryItems'),
        invoices: await db.getAll('invoices'),
      },
    };

    const jsonData = JSON.stringify(backupData, null, 2);

    // Save to file using Electron API (saveBackup expects string data)
    const result = await window.electronAPI.saveBackup(jsonData, filePath);

    if (result.success) {
      console.log('Backup created successfully:', filePath);
      console.log(`Backup contains: ${backupData.data.categories.length} categories, ${backupData.data.products.length} products, ${backupData.data.orders.length} orders`);
      return filePath;
    } else {
      console.error('Failed to create backup');
      return null;
    }
  } catch (error) {
    console.error('Error creating backup:', error);
    return null;
  }
}
