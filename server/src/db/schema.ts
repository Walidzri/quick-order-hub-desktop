/**
 * schema.ts — Schéma SQLite v2, corrigé pour correspondre exactement
 * aux interfaces TypeScript des packages/shared/types/.
 *
 * Géré par user_version SQLite : si la version stockée != SCHEMA_VERSION,
 * connection.ts drop toutes les tables et recrée depuis zéro.
 */

import Database from 'better-sqlite3';

export const SCHEMA_VERSION = 2;

const SCHEMA_SQL = `
-- ============================================================
-- Catalogue
-- ============================================================

CREATE TABLE IF NOT EXISTS categories (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  sortOrder    INTEGER NOT NULL DEFAULT 0,
  icon         TEXT,
  image        TEXT,
  supplementIds TEXT DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS products (
  id              TEXT PRIMARY KEY,
  categoryId      TEXT REFERENCES categories(id),
  name            TEXT NOT NULL,
  basePrice       REAL NOT NULL DEFAULT 0,
  sortOrder       INTEGER NOT NULL DEFAULT 0,
  available       INTEGER NOT NULL DEFAULT 1,
  description     TEXT,
  image           TEXT,
  modifierGroupIds TEXT DEFAULT '[]',
  supplementIds   TEXT DEFAULT '[]',
  sync_status     TEXT NOT NULL DEFAULT 'pending',
  synced_at       TEXT
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(categoryId);

CREATE TABLE IF NOT EXISTS product_variants (
  id        TEXT PRIMARY KEY,
  productId TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size      TEXT NOT NULL,
  price     REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(productId);

CREATE TABLE IF NOT EXISTS modifier_groups (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  required    INTEGER NOT NULL DEFAULT 0,
  multiSelect INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS modifier_options (
  id              TEXT PRIMARY KEY,
  groupId         TEXT NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  priceAdjustment REAL NOT NULL DEFAULT 0,
  sizeBasedPrices TEXT
);
CREATE INDEX IF NOT EXISTS idx_options_group ON modifier_options(groupId);

-- ============================================================
-- Commandes
-- ============================================================

CREATE TABLE IF NOT EXISTS orders (
  id                     TEXT PRIMARY KEY,
  orderNumber            TEXT,
  status                 TEXT NOT NULL DEFAULT 'pending',
  type                   TEXT NOT NULL DEFAULT 'dine-in',
  lines                  TEXT NOT NULL DEFAULT '[]',
  subtotal               REAL NOT NULL DEFAULT 0,
  discount               REAL NOT NULL DEFAULT 0,
  total                  REAL NOT NULL DEFAULT 0,
  paymentMethod          TEXT,
  promoCode              TEXT,
  promoName              TEXT,
  createdBy              TEXT,
  createdAt              TEXT NOT NULL,
  updatedAt              TEXT NOT NULL,
  paidAt                 TEXT,
  sentToKitchenAt        TEXT,
  deliveryAddress        TEXT,
  deliveryPhone          TEXT,
  deliveryCustomerName   TEXT,
  deliveryFee            REAL,
  sync_status            TEXT NOT NULL DEFAULT 'pending',
  synced_at              TEXT
);
CREATE INDEX IF NOT EXISTS idx_orders_status  ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(createdAt);

-- ============================================================
-- Imprimantes & Jobs d'impression
-- ============================================================

CREATE TABLE IF NOT EXISTS printers (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  host             TEXT,
  port             INTEGER DEFAULT 9100,
  role             TEXT NOT NULL,
  connectionType   TEXT NOT NULL DEFAULT 'network',
  enabled          INTEGER NOT NULL DEFAULT 1,
  paperWidth       INTEGER DEFAULT 80,
  mode             TEXT,
  usbVendorId      TEXT,
  usbProductId     TEXT,
  bluetoothAddress TEXT
);

CREATE TABLE IF NOT EXISTS print_jobs (
  id          TEXT PRIMARY KEY,
  orderId     TEXT,
  printerRole TEXT,
  content     TEXT,
  status      TEXT NOT NULL DEFAULT 'pending',
  createdAt   TEXT NOT NULL,
  completedAt TEXT,
  error       TEXT
);
CREATE INDEX IF NOT EXISTS idx_jobs_order  ON print_jobs(orderId);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON print_jobs(status);

-- ============================================================
-- Promotions
-- ============================================================

CREATE TABLE IF NOT EXISTS promotions (
  id            TEXT PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,
  name          TEXT,
  type          TEXT NOT NULL,
  value         REAL NOT NULL DEFAULT 0,
  active        INTEGER NOT NULL DEFAULT 1,
  startDate     TEXT,
  endDate       TEXT,
  minOrderTotal REAL,
  freeItemId    TEXT
);
CREATE INDEX IF NOT EXISTS idx_promos_code   ON promotions(code);
CREATE INDEX IF NOT EXISTS idx_promos_active ON promotions(active);

-- ============================================================
-- Paramètres & Compteurs
-- ============================================================

CREATE TABLE IF NOT EXISTS settings (
  id   TEXT PRIMARY KEY,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS numbering_counters (
  id      TEXT PRIMARY KEY,
  date    TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_counters_date ON numbering_counters(date);

-- ============================================================
-- Utilisateurs & Sessions
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  username       TEXT NOT NULL UNIQUE,
  password       TEXT,
  pin            TEXT,
  role           TEXT NOT NULL DEFAULT 'caissier',
  name           TEXT NOT NULL,
  avatar         TEXT,
  active         INTEGER NOT NULL DEFAULT 1,
  createdAt      TEXT NOT NULL,
  lastLogin      TEXT,
  failedAttempts INTEGER DEFAULT 0,
  lockedUntil    TEXT
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id       TEXT PRIMARY KEY,
  userId   TEXT NOT NULL REFERENCES users(id),
  loginAt  TEXT NOT NULL,
  logoutAt TEXT,
  isActive INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(userId);

-- ============================================================
-- Inventaire
-- ============================================================

CREATE TABLE IF NOT EXISTS suppliers (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  contact   TEXT,
  phone     TEXT,
  email     TEXT,
  address   TEXT,
  notes     TEXT,
  createdAt TEXT,
  updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  category     TEXT,
  unit         TEXT,
  currentStock REAL NOT NULL DEFAULT 0,
  minStock     REAL,
  unitPrice    REAL NOT NULL DEFAULT 0,
  createdAt    TEXT,
  updatedAt    TEXT
);
CREATE INDEX IF NOT EXISTS idx_inventory_name     ON inventory_items(name);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory_items(category);

CREATE TABLE IF NOT EXISTS invoices (
  id            TEXT PRIMARY KEY,
  invoiceNumber TEXT,
  supplierId    TEXT REFERENCES suppliers(id),
  supplierName  TEXT,
  date          TEXT NOT NULL,
  lines         TEXT NOT NULL DEFAULT '[]',
  subtotal      REAL NOT NULL DEFAULT 0,
  tax           REAL,
  discount      REAL,
  total         REAL NOT NULL DEFAULT 0,
  notes         TEXT,
  createdBy     TEXT,
  createdAt     TEXT NOT NULL,
  updatedAt     TEXT
);
CREATE INDEX IF NOT EXISTS idx_invoices_supplier ON invoices(supplierId);
CREATE INDEX IF NOT EXISTS idx_invoices_date     ON invoices(date);
`;

/**
 * Migration non-destructive — ajoute les colonnes sync si elles n'existent pas.
 * SQLite ne supporte pas ALTER TABLE ADD COLUMN IF NOT EXISTS, donc on vérifie
 * d'abord via pragma_table_info.
 */
function applyColumnMigrations(db: Database.Database): void {
  const hasColumn = (table: string, col: string): boolean => {
    const rows = db.prepare(
      `SELECT name FROM pragma_table_info(?) WHERE name = ?`
    ).all(table, col) as Array<{ name: string }>;
    return rows.length > 0;
  };

  if (!hasColumn('orders', 'sync_status')) {
    db.exec(`ALTER TABLE orders ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'pending'`);
    console.log('[DB] Migration : orders.sync_status ajouté');
  }
  if (!hasColumn('orders', 'synced_at')) {
    db.exec(`ALTER TABLE orders ADD COLUMN synced_at TEXT`);
    console.log('[DB] Migration : orders.synced_at ajouté');
  }
  if (!hasColumn('orders', 'kitchen_ready_at')) {
    db.exec(`ALTER TABLE orders ADD COLUMN kitchen_ready_at TEXT`);
    console.log('[DB] Migration : orders.kitchen_ready_at ajouté');
  }
  if (!hasColumn('orders', 'deliveryFee')) {
    db.exec(`ALTER TABLE orders ADD COLUMN deliveryFee REAL`);
    console.log('[DB] Migration : orders.deliveryFee ajouté');
  }
  if (!hasColumn('products', 'sync_status')) {
    db.exec(`ALTER TABLE products ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'pending'`);
    console.log('[DB] Migration : products.sync_status ajouté');
  }
  if (!hasColumn('products', 'synced_at')) {
    db.exec(`ALTER TABLE products ADD COLUMN synced_at TEXT`);
    console.log('[DB] Migration : products.synced_at ajouté');
  }
}

/** Supprime toutes les tables (utilisé lors d'un changement de version de schéma). */
function dropAllTables(db: Database.Database): void {
  const tables = (db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
  `).all() as Array<{ name: string }>).map(r => r.name);

  for (const table of tables) {
    db.exec(`DROP TABLE IF EXISTS "${table}"`);
  }
}

/**
 * Applique le schéma SQLite.
 * Si la user_version stockée != SCHEMA_VERSION, drop + recrée toutes les tables.
 */
export function applySchema(db: Database.Database): void {
  const currentVersion = db.pragma('user_version', { simple: true }) as number;

  if (currentVersion !== SCHEMA_VERSION) {
    console.log(`[DB] Schéma v${currentVersion} → v${SCHEMA_VERSION} : recréation des tables`);
    dropAllTables(db);
  }

  db.exec(SCHEMA_SQL);
  db.pragma(`user_version = ${SCHEMA_VERSION}`);

  // Migrations non-destructives (colonnes ajoutées sans changer la version)
  applyColumnMigrations(db);
}
