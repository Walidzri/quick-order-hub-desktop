-- Migration 001 — Schéma initial
-- Mapping complet du schéma IndexedDB (FastFoodPOS v4) vers SQLite
-- Appliqué une seule fois via applySchema() dans connection.ts

-- ============================================================
-- Catalogue
-- ============================================================

CREATE TABLE IF NOT EXISTS categories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  color       TEXT,
  sortOrder   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  categoryId  TEXT REFERENCES categories(id),
  price       REAL NOT NULL DEFAULT 0,
  description TEXT,
  image       TEXT,
  available   INTEGER NOT NULL DEFAULT 1,
  sortOrder   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(categoryId);

CREATE TABLE IF NOT EXISTS product_variants (
  id          TEXT PRIMARY KEY,
  productId   TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  price       REAL NOT NULL DEFAULT 0,
  available   INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(productId);

CREATE TABLE IF NOT EXISTS modifier_groups (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  productId      TEXT REFERENCES products(id) ON DELETE CASCADE,
  minSelections  INTEGER NOT NULL DEFAULT 0,
  maxSelections  INTEGER NOT NULL DEFAULT 1,
  required       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS modifier_options (
  id        TEXT PRIMARY KEY,
  groupId   TEXT NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  price     REAL NOT NULL DEFAULT 0,
  available INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_options_group ON modifier_options(groupId);

-- ============================================================
-- Commandes
-- ============================================================

CREATE TABLE IF NOT EXISTS orders (
  id            TEXT PRIMARY KEY,
  orderNumber   TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',
  type          TEXT NOT NULL DEFAULT 'dine-in',
  lines         TEXT NOT NULL DEFAULT '[]',  -- JSON
  subtotal      REAL NOT NULL DEFAULT 0,
  discount      REAL NOT NULL DEFAULT 0,
  total         REAL NOT NULL DEFAULT 0,
  paymentMethod TEXT,
  promoCode     TEXT,
  promoType     TEXT,
  promoValue    REAL,
  customerName  TEXT,
  tableNumber   TEXT,
  notes         TEXT,
  createdAt     TEXT NOT NULL,
  updatedAt     TEXT NOT NULL,
  paidAt        TEXT,
  servedBy      TEXT
);
CREATE INDEX IF NOT EXISTS idx_orders_status   ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created  ON orders(createdAt);

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
  id             TEXT PRIMARY KEY,
  code           TEXT NOT NULL UNIQUE,
  name           TEXT,
  type           TEXT NOT NULL,
  value          REAL NOT NULL DEFAULT 0,
  active         INTEGER NOT NULL DEFAULT 1,
  minOrderAmount REAL,
  maxUses        INTEGER,
  currentUses    INTEGER NOT NULL DEFAULT 0,
  expiresAt      TEXT
);
CREATE INDEX IF NOT EXISTS idx_promos_code   ON promotions(code);
CREATE INDEX IF NOT EXISTS idx_promos_active ON promotions(active);

-- ============================================================
-- Paramètres
-- ============================================================

CREATE TABLE IF NOT EXISTS settings (
  id   TEXT PRIMARY KEY,
  data TEXT NOT NULL  -- JSON (objet Settings complet)
);

CREATE TABLE IF NOT EXISTS numbering_counters (
  id    TEXT PRIMARY KEY,
  date  TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_counters_date ON numbering_counters(date);

-- ============================================================
-- Utilisateurs & Sessions
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id        TEXT PRIMARY KEY,
  username  TEXT NOT NULL UNIQUE,
  password  TEXT,
  pin       TEXT,
  role      TEXT NOT NULL DEFAULT 'cashier',
  active    INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id       TEXT PRIMARY KEY,
  userId   TEXT NOT NULL REFERENCES users(id),
  loginAt  TEXT NOT NULL,
  logoutAt TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(userId);

-- ============================================================
-- Inventaire (v4 — fournisseurs, articles, factures d'achat)
-- ============================================================

CREATE TABLE IF NOT EXISTS suppliers (
  id      TEXT PRIMARY KEY,
  name    TEXT NOT NULL,
  contact TEXT,
  phone   TEXT,
  address TEXT,
  notes   TEXT
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  category    TEXT,
  unit        TEXT,
  quantity    REAL NOT NULL DEFAULT 0,
  minQuantity REAL,
  cost        REAL,
  supplierId  TEXT REFERENCES suppliers(id),
  notes       TEXT
);
CREATE INDEX IF NOT EXISTS idx_inventory_name     ON inventory_items(name);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory_items(category);

CREATE TABLE IF NOT EXISTS invoices (
  id            TEXT PRIMARY KEY,
  invoiceNumber TEXT,
  supplierId    TEXT REFERENCES suppliers(id),
  date          TEXT NOT NULL,
  lines         TEXT NOT NULL DEFAULT '[]',  -- JSON (InvoiceLine[])
  total         REAL NOT NULL DEFAULT 0,
  notes         TEXT,
  createdAt     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_invoices_supplier ON invoices(supplierId);
CREATE INDEX IF NOT EXISTS idx_invoices_date     ON invoices(date);
