# Changelog

Toutes les modifications notables de ce projet seront documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

---

## [Non publié] — Phase 4 en cours

### En cours
- API cloud + Sync VPS (PostgreSQL/MariaDB)
- Toggle cloud sync depuis les paramètres
- Démarrage automatique avec Windows (open at login)

---

## [1.3.0] — Phase 3 : Tablette cuisine + Télé salle

### Ajouté
- Page `/cuisine` — interface tablette cuisine (HTML vanilla, zéro dépendance client)
  - Affichage des commandes en cours par ordre d'arrivée avec timer
  - Code couleur urgence (bleu < 5min, orange > 5min, rouge > 10min)
  - Bouton "Prêt" → `PATCH /api/orders/:id { status: "ready" }`
  - Son d'alerte à l'arrivée d'une nouvelle commande
- Page `/display` — écran salle (plein écran, compatible Smart TV / tablette)
  - Commandes prêtes affichées en grand vert
  - Commandes en préparation affichées en gris
  - Mise à jour automatique sans rechargement
- WebSocket `/ws/events` — broadcast temps réel vers tous les clients connectés
- Notification toast dans le POS quand une commande passe à "ready"

### Technique
- `server/src/routes/cuisine.ts` — sert le HTML statique `/cuisine`
- `server/src/routes/display.ts` — sert le HTML statique `/display`
- `server/src/services/wsService.ts` — `broadcastEvent(type, payload)`
- Broadcast branché sur toutes les mutations d'ordres (create, status change)

---

## [1.2.0] — Phase 2 : Migration IndexedDB → SQLite

### Ajouté
- Backend SQLite avec `better-sqlite3` (remplace IndexedDB)
- Migrations SQL (`server/src/db/migrations/`)
- Script de migration one-shot IndexedDB → SQLite
- `server/src/services/inventoryService.ts` — gestion fournisseurs, articles, factures
- Sauvegarde automatique dans `server/src/services/backupService.ts` (sort de React)

### Modifié
- `InventoryManagement.tsx`, `ReportsScreen.tsx`, `SettingsScreen.tsx` → appels HTTP uniquement
- Tous les services backend branchés sur SQLite

### Supprimé
- `src/lib/database.ts` (remplacé par `server/src/db/`)
- `src/lib/database-sqlite.ts` (migration ratée)
- `src/lib/migrate-to-sqlite.ts` + `migration-idb-to-sqlite.ts`
- `useEffect` backup automatique retiré de `SettingsContext.tsx`
- Dépendances `idb`, `sql.js`, `escpos`, `escpos-usb`

---

## [1.1.0] — Phase 1 : Séparation Frontend / Backend

### Ajouté
- Backend Fastify embarqué (port 3002) lancé depuis `electron/main.ts`
- `packages/shared/types/` — types TypeScript partagés front + back
  - `product.ts`, `order.ts`, `settings.ts`, `auth.ts`, `inventory.ts`, `print.ts`
  - `defaultReceiptCustomization` — source de vérité unique (3 copies → 1)
- `src/services/` — couche d'appels HTTP vers Fastify
  - `api.ts`, `orderService.ts`, `productService.ts`, `settingsService.ts`, `printerService.ts`
- Contextes React éclatés (POSContext God Object → 5 contextes indépendants)
  - `SettingsContext.tsx`, `CatalogContext.tsx`, `PrinterContext.tsx`, `CartContext.tsx`, `OrderContext.tsx`
  - `POSContext.tsx` → shim de compatibilité (0 changement dans les composants)
- `server/src/services/backupService.ts` — scheduling complet (interval/daily/weekly/monthly)
- `server/src/services/syncService.ts` — interface vide, branchable Phase 4
- `tests/phase1/api.curl.sh` — 30 routes testées (30/30 PASS)
- `tests/phase1/checklist.md` — 83 items validés (83/83)

### Technique
- Alias `@shared/*` dans `vite.config.ts` et `tsconfig.json`
- `tsconfig.server.json` pour le backend Fastify

---

## [1.0.0] — 2025-01-15

### Ajouté
- Application POS complète pour restaurants
- Gestion des commandes (sur place, à emporter)
- Gestion des produits et catégories
- Système d'utilisateurs avec rôles (Admin, Chef, Caissier)
- Impression directe TCP/IP (imprimantes thermiques)
- PrintDaemon C# — microservice d'impression (TCP/IP, USB, Bluetooth)
- Gestion d'inventaire
- Rapports et statistiques
- Personnalisation des tickets (reçu client et ticket cuisine)
- Sauvegarde/Restauration des données
- Export/Import de templates de produits
- Multi-langue (Français/Anglais/Arabe)
- Clavier virtuel (QWERTY/AZERTY)
- Système de logging centralisé avec persistance des logs

---

## Format des versions

- **MAJOR** : Changements incompatibles avec les versions précédentes
- **MINOR** : Nouvelles fonctionnalités rétrocompatibles
- **PATCH** : Corrections de bugs rétrocompatibles
