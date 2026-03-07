-- ============================================================
-- Migration PostgreSQL 001 — Schéma initial doudoutacos
-- Adapté du schéma SQLite (schema.ts v2)
-- À appliquer une seule fois sur la DB cloud
-- ============================================================
-- Adaptations SQLite → PostgreSQL :
--   INTEGER (bool) → BOOLEAN
--   REAL           → NUMERIC(10,2)
--   TEXT (JSON)    → JSONB
--   Dates          → TEXT (ISO 8601 — homogène avec SQLite local)
-- Colonnes sync ajoutées sur orders et products :
--   sync_status    TEXT DEFAULT 'pending'  ('pending'|'synced'|'error')
--   synced_at      TEXT (ISO 8601 timestamp)
-- ============================================================

-- ============================================================
-- Catalogue
-- ============================================================

CREATE TABLE IF NOT EXISTS categories (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  "sortOrder"   INTEGER NOT NULL DEFAULT 0,
  icon          TEXT,
  image         TEXT,
  "supplementIds" JSONB NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS products (
  id                TEXT PRIMARY KEY,
  "categoryId"      TEXT REFERENCES categories(id),
  name              TEXT NOT NULL,
  "basePrice"       NUMERIC(10,2) NOT NULL DEFAULT 0,
  "sortOrder"       INTEGER NOT NULL DEFAULT 0,
  available         BOOLEAN NOT NULL DEFAULT TRUE,
  description       TEXT,
  image             TEXT,
  "modifierGroupIds" JSONB NOT NULL DEFAULT '[]',
  "supplementIds"   JSONB NOT NULL DEFAULT '[]',
  sync_status       TEXT NOT NULL DEFAULT 'pending',
  synced_at         TEXT
);
CREATE INDEX IF NOT EXISTS idx_products_category   ON products("categoryId");
CREATE INDEX IF NOT EXISTS idx_products_sync       ON products(sync_status);

CREATE TABLE IF NOT EXISTS product_variants (
  id          TEXT PRIMARY KEY,
  "productId" TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size        TEXT NOT NULL,
  price       NUMERIC(10,2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants("productId");

CREATE TABLE IF NOT EXISTS modifier_groups (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  required      BOOLEAN NOT NULL DEFAULT FALSE,
  "multiSelect" BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS modifier_options (
  id                TEXT PRIMARY KEY,
  "groupId"         TEXT NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  "priceAdjustment" NUMERIC(10,2) NOT NULL DEFAULT 0,
  "sizeBasedPrices" JSONB
);
CREATE INDEX IF NOT EXISTS idx_options_group ON modifier_options("groupId");

-- ============================================================
-- Commandes
-- ============================================================

CREATE TABLE IF NOT EXISTS orders (
  id                     TEXT PRIMARY KEY,
  "orderNumber"          TEXT,
  status                 TEXT NOT NULL DEFAULT 'pending',
  type                   TEXT NOT NULL DEFAULT 'dine-in',
  lines                  JSONB NOT NULL DEFAULT '[]',
  subtotal               NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount               NUMERIC(10,2) NOT NULL DEFAULT 0,
  total                  NUMERIC(10,2) NOT NULL DEFAULT 0,
  "paymentMethod"        TEXT,
  "promoCode"            TEXT,
  "promoName"            TEXT,
  "createdBy"            TEXT,
  "createdAt"            TEXT NOT NULL,
  "updatedAt"            TEXT NOT NULL,
  "paidAt"               TEXT,
  "sentToKitchenAt"      TEXT,
  "deliveryAddress"      TEXT,
  "deliveryPhone"        TEXT,
  "deliveryCustomerName" TEXT,
  sync_status            TEXT NOT NULL DEFAULT 'pending',
  synced_at              TEXT
);
CREATE INDEX IF NOT EXISTS idx_orders_status   ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created  ON orders("createdAt");
CREATE INDEX IF NOT EXISTS idx_orders_sync     ON orders(sync_status);

-- ============================================================
-- Imprimantes & Jobs d'impression
-- ============================================================

CREATE TABLE IF NOT EXISTS printers (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  host              TEXT,
  port              INTEGER DEFAULT 9100,
  role              TEXT NOT NULL,
  "connectionType"  TEXT NOT NULL DEFAULT 'network',
  enabled           BOOLEAN NOT NULL DEFAULT TRUE,
  "paperWidth"      INTEGER DEFAULT 80,
  mode              TEXT,
  "usbVendorId"     TEXT,
  "usbProductId"    TEXT,
  "bluetoothAddress" TEXT
);

CREATE TABLE IF NOT EXISTS print_jobs (
  id            TEXT PRIMARY KEY,
  "orderId"     TEXT,
  "printerRole" TEXT,
  content       TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',
  "createdAt"   TEXT NOT NULL,
  "completedAt" TEXT,
  error         TEXT
);
CREATE INDEX IF NOT EXISTS idx_jobs_order  ON print_jobs("orderId");
CREATE INDEX IF NOT EXISTS idx_jobs_status ON print_jobs(status);

-- ============================================================
-- Promotions
-- ============================================================

CREATE TABLE IF NOT EXISTS promotions (
  id              TEXT PRIMARY KEY,
  code            TEXT NOT NULL UNIQUE,
  name            TEXT,
  type            TEXT NOT NULL,
  value           NUMERIC(10,2) NOT NULL DEFAULT 0,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  "startDate"     TEXT,
  "endDate"       TEXT,
  "minOrderTotal" NUMERIC(10,2),
  "freeItemId"    TEXT
);
CREATE INDEX IF NOT EXISTS idx_promos_code   ON promotions(code);
CREATE INDEX IF NOT EXISTS idx_promos_active ON promotions(active);

-- ============================================================
-- Paramètres & Compteurs
-- ============================================================

CREATE TABLE IF NOT EXISTS settings (
  id   TEXT PRIMARY KEY,
  data JSONB NOT NULL
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
  id               TEXT PRIMARY KEY,
  username         TEXT NOT NULL UNIQUE,
  password         TEXT,
  pin              TEXT,
  role             TEXT NOT NULL DEFAULT 'caissier',
  name             TEXT NOT NULL,
  avatar           TEXT,
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"      TEXT NOT NULL,
  "lastLogin"      TEXT,
  "failedAttempts" INTEGER DEFAULT 0,
  "lockedUntil"    TEXT
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id        TEXT PRIMARY KEY,
  "userId"  TEXT NOT NULL REFERENCES users(id),
  "loginAt" TEXT NOT NULL,
  "logoutAt" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions("userId");

-- ============================================================
-- Inventaire
-- ============================================================

CREATE TABLE IF NOT EXISTS suppliers (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  contact     TEXT,
  phone       TEXT,
  email       TEXT,
  address     TEXT,
  notes       TEXT,
  "createdAt" TEXT,
  "updatedAt" TEXT
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  category       TEXT,
  unit           TEXT,
  "currentStock" NUMERIC(10,2) NOT NULL DEFAULT 0,
  "minStock"     NUMERIC(10,2),
  "unitPrice"    NUMERIC(10,2) NOT NULL DEFAULT 0,
  "createdAt"    TEXT,
  "updatedAt"    TEXT
);
CREATE INDEX IF NOT EXISTS idx_inventory_name     ON inventory_items(name);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory_items(category);

CREATE TABLE IF NOT EXISTS invoices (
  id              TEXT PRIMARY KEY,
  "invoiceNumber" TEXT,
  "supplierId"    TEXT REFERENCES suppliers(id),
  "supplierName"  TEXT,
  date            TEXT NOT NULL,
  lines           JSONB NOT NULL DEFAULT '[]',
  subtotal        NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax             NUMERIC(10,2),
  discount        NUMERIC(10,2),
  total           NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes           TEXT,
  "createdBy"     TEXT,
  "createdAt"     TEXT NOT NULL,
  "updatedAt"     TEXT
);
CREATE INDEX IF NOT EXISTS idx_invoices_supplier ON invoices("supplierId");
CREATE INDEX IF NOT EXISTS idx_invoices_date     ON invoices(date);
