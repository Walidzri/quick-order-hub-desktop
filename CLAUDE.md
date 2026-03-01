# CLAUDE.md — Quick Order Hub Desktop

> Ce fichier est le contexte principal du projet. Tu dois le lire en entier avant toute action.
> Il définit l'architecture cible, les conventions, et l'état d'avancement du refactoring.

---

## 🤖 Règles de comportement — OBLIGATOIRES

Ces règles s'appliquent à chaque session, sans exception.

### Workflow séquentiel
- **Toujours** lire ce fichier en entier avant de faire quoi que ce soit
- **Toujours** annoncer ce que tu vas faire avant de le faire
- **Toujours** demander confirmation avant d'exécuter une action
- **Toujours** demander confirmation avant de passer à l'étape suivante
- **Ne jamais** sauter une étape ou anticiper la phase suivante
- **Ne jamais** faire plusieurs étapes en une seule session sans validation entre chaque

### Modifications du CLAUDE.md
- **Ne jamais** modifier ce fichier sans validation explicite du développeur
- Si tu identifies quelque chose qui nécessite une mise à jour → **proposer la modification**, attendre un "ok" avant d'écrire
- Formuler les propositions ainsi :
  > "Je suggère de modifier le CLAUDE.md pour [raison]. Voici ce que je changerais : [détail]. Tu confirmes ?"

### Format de communication
Avant chaque action, toujours présenter :
```
📋 Ce que je vais faire : [description claire]
📁 Fichiers concernés : [liste]
⚠️  Impact : [ce que ça change]
👉 On y va ?
```

---

## 🧭 Contexte du projet

Application POS (Point of Sale) pour restaurant/bar, développée avec :
- **Electron** — wrapper desktop
- **React + TypeScript** — frontend (Renderer Process)
- **IndexedDB (idb)** — stockage actuel (à migrer)
- **PrintDaemon C#** — microservice d'impression (TCP/IP, USB, Bluetooth)

### Ce que fait l'app aujourd'hui
- Prise de commande (sur place, à emporter, livraison)
- Historique des commandes
- Reporting / statistiques
- Paramètres (imprimantes, ticket, utilisateurs, backup...)
- Impression cuisine + caisse via PrintDaemon C#

### Le problème actuel
Le code est en mode "spaghetti" :
- `POSContext.tsx` est un God Object (~600 lignes) qui fait tout
- `database.ts` mélange types, schéma, migrations et seed (~800 lignes)
- La logique métier est dans le Renderer React (mauvaise couche)
- IndexedDB est inaccessible depuis l'extérieur — impossible d'exposer une API
- Le backup automatique est dans un `useEffect` React — aberrant

---

## 🏗️ Architecture cible

```
┌─────────────────────────────────────────────────────────────────┐
│                         ELECTRON APP                            │
│                                                                 │
│  ┌──────────────────────┐      ┌──────────────────────────────┐ │
│  │   RENDERER PROCESS   │      │       MAIN PROCESS           │ │
│  │   (Frontend)         │      │       (Backend embarqué)     │ │
│  │                      │      │                              │ │
│  │  React + TypeScript  │      │  Fastify :3001               │ │
│  │  └── Pages           │ HTTP │  ├── /api/orders             │ │
│  │  └── Components      │◄────►│  ├── /api/products           │ │
│  │  └── Contexts légers │      │  ├── /api/settings           │ │
│  │  └── Services front  │      │  ├── /api/print              │ │
│  │                      │  WS  │  └── /ws/events              │ │
│  │                      │◄────►│                              │ │
│  │                      │      │  better-sqlite3              │ │
│  │                      │      │  └── database.db             │ │
│  │                      │      │                              │ │
│  │                      │      │  SyncService                 │ │
│  │                      │      │  └── (interface branchable)  │ │
│  └──────────────────────┘      └──────────────┬───────────────┘ │
│                                               │                 │
└───────────────────────────────────────────────┼─────────────────┘
                                                │
                    ┌───────────────────────────┤
                    │                           │
                    ▼                           ▼
          PrintDaemon C#                VPS (plus tard)
          Microservice                  └── Fastify
          └── TCP/IP :9100              └── PostgreSQL/MariaDB
          └── USB                            └── Panel admin
          └── Bluetooth                      └── Site web
          └── Toute impression               └── Écran salle externe
```

### Structure cible du projet

```
quick-order-hub-desktop/
│
├── CLAUDE.md                          ← ce fichier
├── electron/                          ← Electron (Main Process)
│   ├── main.ts                        ← lance Fastify + la fenêtre
│   └── preload.ts
│
├── src/                               ← Frontend React (Renderer)
│   ├── components/
│   │   ├── ui/                        ← composants génériques (inchangé)
│   │   ├── pos/                       ← composants métier (refactorisés)
│   │   └── auth/                      ← auth (inchangé)
│   ├── contexts/                      ← contextes légers (éclatés)
│   │   ├── CartContext.tsx
│   │   ├── CatalogContext.tsx
│   │   ├── OrderContext.tsx
│   │   ├── SettingsContext.tsx
│   │   └── PrinterContext.tsx
│   ├── services/                      ← appels HTTP vers Fastify
│   │   ├── api.ts                     ← config base URL
│   │   ├── orderService.ts
│   │   ├── productService.ts
│   │   ├── settingsService.ts
│   │   └── printerService.ts
│   ├── hooks/
│   └── pages/
│
├── server/                            ← Backend Fastify (nouveau)
│   └── src/
│       ├── routes/
│       │   ├── orders.ts
│       │   ├── products.ts
│       │   ├── categories.ts
│       │   ├── settings.ts
│       │   ├── print.ts
│       │   └── events.ts              ← WebSocket écran salle
│       ├── services/
│       │   ├── orderService.ts
│       │   ├── productService.ts
│       │   ├── settingsService.ts
│       │   ├── printService.ts        ← délègue au PrintDaemon C#
│       │   ├── backupService.ts       ← sort de React
│       │   └── syncService.ts         ← interface vide, branchable plus tard
│       ├── db/
│       │   ├── connection.ts
│       │   ├── schema.ts
│       │   ├── seed.ts
│       │   └── migrations/
│       │       ├── 001_initial.sql
│       │       ├── 002_users.sql
│       │       └── 003_inventory.sql
│       └── index.ts                   ← entry point Fastify
│
├── packages/
│   └── shared/                        ← types partagés front + back
│       └── types/
│           ├── order.ts
│           ├── product.ts
│           ├── settings.ts
│           └── index.ts
│
├── tests/                             ← tests par phase (voir section Tests)
│   ├── phase1/
│   │   ├── api.curl.sh                ← tests curl routes Fastify
│   │   └── checklist.md               ← vérifications manuelles UI
│   ├── phase2/
│   │   ├── migration.curl.sh          ← vérification données migrées
│   │   └── checklist.md
│   └── phase3/
│       ├── sync.curl.sh               ← vérification sync cloud
│       └── checklist.md
│
└── PrintDaemon/                       ← inchangé (C#)
```

---

## 🔑 Décisions techniques (NE PAS remettre en question sans validation)

Ces décisions ont été prises après discussion avec le développeur.
Si l'analyse révèle une raison valable de les changer → proposer, ne pas imposer.

| Sujet | Décision | Raison |
|---|---|---|
| **Framework backend** | Fastify | TypeScript natif, rapide, WebSocket intégré |
| **Base de données locale** | SQLite + better-sqlite3 | Fichier local, zéro config, sync possible |
| **Frontend** | React (inchangé) | Déjà en place, pas de migration |
| **Impression** | PrintDaemon C# (inchangé) | Microservice indépendant, gère tous types |
| **Cloud** | VPS perso + PostgreSQL ou MariaDB | Contrôle total, pas de dépendance externe |
| **Langage** | TypeScript partout sauf PrintDaemon | Cohérence front/back |
| **Offline-first** | SQLite local = source de vérité | POS doit fonctionner sans internet |
| **Sync cloud** | Async, branchable plus tard | Pas prioritaire maintenant |

---

## 🧪 Stratégie de tests

> Les tests évoluent avec les phases. Pas de tests unitaires pendant le refactoring
> — l'architecture change trop vite. On les introduit quand la structure est stable.

### Phase 0 & 1 — Checklists manuelles + curl
Pas de framework de test. Une checklist markdown à valider après chaque étape,
et des scripts curl pour tester chaque route Fastify dès qu'elle est créée.

**Principe des scripts curl :**
```bash
# Format standard de chaque test curl
echo "--- TEST: GET /api/orders ---"
curl -s -X GET http://localhost:3001/api/orders \
  -H "Content-Type: application/json" | jq .
# Résultat attendu : tableau JSON (vide ou avec commandes)

echo "--- TEST: POST /api/orders ---"
curl -s -X POST http://localhost:3001/api/orders \
  -H "Content-Type: application/json" \
  -d '{"type": "dine-in", "lines": []}' | jq .
# Résultat attendu : objet commande avec id généré
```

Les scripts curl sont dans `tests/phase1/api.curl.sh` — ils se lancent
en une commande et affichent pass/fail pour chaque route.

**Principe des checklists manuelles :**
Vérifier que chaque fonctionnalité de l'app marche toujours après chaque étape.
Fichier : `tests/phase1/checklist.md`

### Phase 2 — Tests de migration
Vérifier que les données migrées d'IndexedDB vers SQLite sont identiques.
Comparer counts, totaux, et quelques enregistrements spot-check.

### Phase 3 — Tests unitaires sur les services
Une fois l'architecture stable, on introduit **Vitest** pour tester
la logique métier des services backend de façon isolée.

```typescript
// Exemple : server/src/services/orderService.test.ts
describe('orderService', () => {
  it('calcule le total correctement avec une promo', () => {
    const total = orderService.calculateTotal(lines, promo)
    expect(total).toBe(850)
  })

  it('rejette une commande sans lignes', async () => {
    await expect(orderService.create({ lines: [] }))
      .rejects.toThrow('Commande vide')
  })
})
```

---

## 📋 Plan d'action — Phases séquentielles

> ⚠️ RÈGLE ABSOLUE : Une phase doit être 100% terminée et validée par le développeur
> avant de commencer la suivante. Ne pas anticiper, ne pas mélanger les phases.

---

### ✅ PHASE 0 — Analyse complète du projet
**Statut : TERMINÉE**
**Objectif : Analyser TOUS les fichiers du projet avant de toucher quoi que ce soit.**

> L'analyse faite via chat web était incomplète — seulement 4 fichiers vus sur l'ensemble du projet.
> Claude Code doit lire chaque fichier listé ci-dessous avant de tirer des conclusions.

#### Fichiers à analyser

**Electron / Main Process**
- [ ] `electron/main.ts`
- [ ] `electron/preload.ts`
- [ ] `electron/preload.cjs`

**Frontend — Contexts**
- [ ] `src/contexts/POSContext.tsx` ← partiellement vu
- [ ] `src/contexts/AuthContext.tsx`

**Frontend — Pages**
- [ ] `src/pages/Index.tsx` ← partiellement vu

**Frontend — Composants POS**
- [ ] `src/components/pos/OrderScreen.tsx` ← partiellement vu
- [ ] `src/components/pos/Cart.tsx`
- [ ] `src/components/pos/PaymentModal.tsx`
- [ ] `src/components/pos/OrdersScreen.tsx`
- [ ] `src/components/pos/ReportsScreen.tsx`
- [ ] `src/components/pos/SettingsScreen.tsx`
- [ ] `src/components/pos/ProductGrid.tsx`
- [ ] `src/components/pos/CategorySidebar.tsx`
- [ ] `src/components/pos/ProductModal.tsx`
- [ ] `src/components/pos/ProductsManagement.tsx`
- [ ] `src/components/pos/InventoryManagement.tsx`
- [ ] `src/components/pos/MainNav.tsx`
- [ ] `src/components/pos/PrintPreviewModal.tsx`
- [ ] `src/components/pos/ReceiptCustomizationSection.tsx`
- [ ] `src/components/pos/UserModal.tsx`
- [ ] `src/components/pos/CategoryModal.tsx`
- [ ] `src/components/pos/EditCartItemModal.tsx`
- [ ] `src/components/pos/ManualItemModal.tsx`
- [ ] `src/components/pos/OrderTypeModal.tsx`

**Frontend — Auth**
- [ ] `src/components/auth/LoginScreen.tsx`
- [ ] `src/components/auth/LockScreen.tsx`
- [ ] `src/components/auth/SetupScreen.tsx`

**Lib / Utilitaires**
- [ ] `src/lib/database.ts` ← partiellement vu
- [ ] `src/lib/printer.ts`
- [ ] `src/lib/receipt-renderer.tsx`
- [ ] `src/lib/logger.ts`
- [ ] `src/lib/i18n.ts`
- [ ] `src/lib/utils.ts`

**Config**
- [ ] `package.json`
- [ ] `vite.config.ts`
- [ ] `tsconfig.json`
- [ ] `tsconfig.electron.json`

#### Ce que l'analyse doit produire pour chaque fichier
- Responsabilité actuelle
- Taille approximative (lignes)
- Ce qui appartient au frontend
- Ce qui appartient au backend
- Dépendances avec les autres fichiers
- Problèmes identifiés

#### Livrable
Une section "Conclusions d'analyse" à ajouter dans ce fichier **après validation du développeur**.
Cette section peut amender le plan d'action si l'analyse révèle des surprises.

---

### ✅ PHASE 1 — Séparation Frontend / Backend
**Statut : VALIDÉE** — 30/30 tests curl PASS, checklist UI 83/83 items validés
**Objectif : Créer le backend Fastify et faire fetcher React dessus. Ne pas encore migrer la DB.**

#### Étape 1.1 — Extraire les types partagés
- [ ] Créer `packages/shared/types/`
- [ ] Extraire toutes les interfaces de `src/lib/database.ts` vers `packages/shared/types/`
- [ ] Mettre à jour les imports dans tout le projet
- [ ] Vérifier que tout compile sans erreur

#### Étape 1.2 — Créer le serveur Fastify
- [ ] Créer `server/` avec sa structure
- [ ] Installer les dépendances : `fastify`, `@fastify/cors`, `@fastify/websocket`
- [ ] Créer `server/src/index.ts` — serveur Fastify de base
- [ ] Créer les routes (appellent encore IndexedDB pour l'instant)
- [ ] Lancer Fastify depuis `electron/main.ts`

#### Étape 1.3 — Créer la couche services frontend
- [ ] Créer `src/services/api.ts` — config base URL `http://localhost:3001`
- [ ] Créer `src/services/orderService.ts`
- [ ] Créer `src/services/productService.ts`
- [ ] Créer `src/services/settingsService.ts`
- [ ] Créer `src/services/printerService.ts`

#### Étape 1.4 — Éclater POSContext
- [ ] Créer `src/contexts/CartContext.tsx`
- [ ] Créer `src/contexts/CatalogContext.tsx`
- [ ] Créer `src/contexts/OrderContext.tsx`
- [ ] Créer `src/contexts/SettingsContext.tsx`
- [ ] Créer `src/contexts/PrinterContext.tsx`
- [ ] Supprimer `src/contexts/POSContext.tsx`
- [ ] Mettre à jour tous les composants qui utilisaient `usePOS()`

#### Étape 1.5 — Déplacer la logique métier vers server/services
- [ ] Créer `server/src/services/orderService.ts`
- [ ] Créer `server/src/services/productService.ts`
- [ ] Créer `server/src/services/settingsService.ts`
- [ ] Créer `server/src/services/printService.ts`
- [ ] Créer `server/src/services/backupService.ts`
- [ ] Créer `server/src/services/syncService.ts` (interface vide)

#### Tests Phase 1
- [ ] Créer `tests/phase1/api.curl.sh` — une commande curl par route Fastify
- [ ] Créer `tests/phase1/checklist.md` — vérification manuelle de chaque fonctionnalité UI
- [ ] Exécuter et valider tous les tests avant de passer à la Phase 2

#### Validation Phase 1
- [ ] L'app démarre sans erreur
- [ ] Toutes les fonctionnalités existantes marchent
- [ ] React ne contient plus aucun appel direct à IndexedDB
- [ ] Tous les appels passent par `fetch()` vers Fastify
- [ ] Tous les tests curl passent
- [ ] Checklist UI complète à 100%

---

### 🔄 PHASE 2 — Migration IndexedDB → SQLite
**Statut : EN COURS**

#### Étape 2.1 — Setup SQLite ✅ VALIDÉE
- [x] Installer `better-sqlite3` + types
- [x] Créer `server/src/db/connection.ts`
- [x] Créer `server/src/db/schema.ts`
- [x] Créer les migrations SQL

#### Étape 2.2 — Script de migration des données ✅ VALIDÉE
- [x] Script one-shot : IndexedDB → SQLite
- [x] Tester la migration — succès confirmé en prod

#### Étape 2.3 — Brancher SQLite dans les services
- [ ] Remplacer les appels IndexedDB par SQLite service par service
- [ ] Tester route par route

#### Étape 2.4 — Nettoyer
- [ ] Supprimer `src/lib/database.ts`
- [ ] Supprimer `src/lib/database-sqlite.ts`
- [ ] Supprimer `src/lib/migrate-to-sqlite.ts`

#### Tests Phase 2
- [ ] Créer `tests/phase2/migration.curl.sh` — vérifier counts et données migrées
- [ ] Créer `tests/phase2/checklist.md` — spot-check sur commandes, produits, settings
- [ ] Comparer les résultats avant/après migration

#### Validation Phase 2
- [ ] Toutes les données migrées correctement
- [ ] L'app fonctionne identiquement
- [ ] Zéro référence à IndexedDB dans le code
- [ ] Tous les tests de migration passent

---

### ⏳ PHASE 3 — API cloud + Sync VPS
**Statut : EN ATTENTE (démarrer seulement quand Phase 2 est 100% validée)**

#### Étape 3.1 — Setup VPS
- [ ] Choisir PostgreSQL ou MariaDB
- [ ] Installer et configurer sur le VPS
- [ ] Créer le schéma de la base cloud

#### Étape 3.2 — Backend cloud
- [ ] Projet Fastify sur le VPS
- [ ] Réutiliser `packages/shared/`
- [ ] Exposer les routes nécessaires

#### Étape 3.3 — Implémenter SyncService
- [ ] Ajouter `syncStatus` sur les commandes SQLite
- [ ] Sync async avec retry si réseau down

#### Étape 3.4 — Écran salle
- [ ] WebSocket `/ws/events`
- [ ] Page web simple pour l'écran salle

#### Étape 3.5 — Tests unitaires Vitest (maintenant que l'archi est stable)
- [ ] Installer Vitest dans `server/`
- [ ] Tester `orderService` — calcul totaux, validation, statuts
- [ ] Tester `syncService` — comportement offline, retry
- [ ] Tester `backupService` — scheduling, création fichier

#### Tests Phase 3
- [ ] Créer `tests/phase3/sync.curl.sh` — vérifier sync local → VPS
- [ ] Créer `tests/phase3/checklist.md` — écran salle, panel admin, offline
- [ ] Lancer les tests unitaires Vitest

#### Validation Phase 3
- [ ] Commandes payées synchronisées vers VPS
- [ ] Panel admin fonctionnel
- [ ] Écran salle reçoit les updates
- [ ] POS fonctionne offline si VPS injoignable
- [ ] Tests unitaires passent

---

## 🛠️ Conventions de code

### Nommage
- **Fichiers** : `camelCase.ts` pour les services, `PascalCase.tsx` pour les composants
- **Interfaces** : `PascalCase` — ex: `Order`, `Product`
- **Services** : suffix `Service` — ex: `orderService`, `productService`
- **Routes Fastify** : REST strict — `GET /api/orders`, `POST /api/orders`, `PATCH /api/orders/:id`

### Règles strictes
- **Jamais** de `any` — TypeScript strict partout
- **Jamais** d'appel direct à la DB depuis un composant React
- **Jamais** de logique métier dans un Context React
- **Toujours** passer par `src/services/` côté front pour les appels HTTP
- **Toujours** passer par `server/src/services/` côté back pour la logique métier

### Structure d'une route Fastify
```typescript
// server/src/routes/orders.ts
import { FastifyInstance } from 'fastify'
import { orderService } from '../services/orderService'

export async function ordersRoutes(fastify: FastifyInstance) {
  fastify.get('/api/orders', async (request, reply) => {
    const orders = await orderService.getAll()
    return orders
  })

  fastify.post('/api/orders', async (request, reply) => {
    const order = await orderService.create(request.body)
    return reply.status(201).send(order)
  })
}
```

### Structure d'un service frontend
```typescript
// src/services/orderService.ts
import { api } from './api'
import { Order } from '@shared/types'

export const orderService = {
  getAll: () => api.get<Order[]>('/api/orders'),
  create: (data: Partial<Order>) => api.post<Order>('/api/orders', data),
  updateStatus: (id: string, status: string) =>
    api.patch<Order>(`/api/orders/${id}`, { status }),
}
```

---

## ⚠️ Points d'attention

- **PrintDaemon** — ne pas y toucher, il reste exactement comme il est
- **Auth** — ne pas refactoriser AuthContext pour l'instant, pas prioritaire
- **UI components** — `src/components/ui/` ne pas y toucher
- **database-sqlite.ts** — fichier d'une migration ratée, à supprimer en Phase 2
- **Offline-first** — toujours vérifier que l'app fonctionne sans réseau après chaque changement

---

## 📌 Session en cours

> Mettre à jour cette section à chaque session de travail.
> Ne jamais modifier cette section sans validation du développeur.

**Dernière session :** Phase 2.3 terminée — migration frontend complète (0 getDB() dans les contextes), shim usePOS() corrigé
**Phase active :** Phase 2 — Étape 2.4 — Nettoyage (supprimer database.ts, database-sqlite.ts, migrate-to-sqlite.ts)
**Prochaine tâche :** Tester l'app, puis supprimer les fichiers IDB obsolètes
**Blockers :** Aucun — TypeScript backend 0 erreur, TypeScript des contextes/services 0 erreur

---

## 📝 Conclusions d'analyse
*(Rédigées après Phase 0 — 36 fichiers lus et analysés)*

---

### 🔴 Top 5 problèmes critiques

**1. POSContext.tsx est un vrai God Object (~1199 lignes)**
Il gère en une seule classe : le panier, le catalogue produits, les commandes, les paramètres, l'impression, les utilisateurs, le backup, le mode kiosque et les traductions. Tout composant qui a besoin d'une chose doit importer tout le reste. C'est la source principale de couplage.

**2. IndexedDB (`getDB()`) appelé directement depuis les composants React (20+ endroits)**
Les cas les plus graves :
- `InventoryManagement.tsx` — 9 appels `getDB()` directs, avec logique métier embarquée (mise à jour de stock dans `saveInvoice`, annulation dans `deleteInvoice`)
- `ReportsScreen.tsx`, `SettingsScreen.tsx`, `PaymentModal.tsx`, `OrdersScreen.tsx` — tous font leurs propres requêtes IndexedDB
- `POSContext.tsx` lui-même — ~600 lignes de requêtes IndexedDB

**3. Logique métier dans les mauvaises couches**

| Logique | Où elle est | Où elle devrait être |
|---|---|---|
| Formatage ESC/POS | `printer.ts` (frontend) | `server/services/printService.ts` |
| Impression cuisine | `PaymentModal.tsx` + `PrintPreviewModal.tsx` ×2 | `server/services/printService.ts` |
| Mise à jour de stock | `InventoryManagement.tsx` (composant) | `server/services/inventoryService.ts` |
| Backup automatique | `useEffect` React + IPC `backup:*` main.ts | `server/services/backupService.ts` |
| TCP ESC/POS direct | `electron/main.ts` (`print:direct`) | `PrintDaemon C#` (déjà là) |

**4. Duplication de code significative**

| Code dupliqué | Où | Endroit cible |
|---|---|---|
| `defaultReceiptCustomization` | `database.ts` ×2 + `printer.ts` | `packages/shared/types/settings.ts` |
| `formatLockoutTime()` | `LoginScreen.tsx` + `LockScreen.tsx` | Hook ou util partagé |
| Clavier PIN 3×4 | `LoginScreen.tsx` + `LockScreen.tsx` | Composant `<PinKeypad />` |
| Sélecteur de langue | `LoginScreen.tsx` + `SetupScreen.tsx` | Composant `<LanguageSelector />` |
| Impression cuisine | `PaymentModal.tsx` + `PrintPreviewModal.tsx` ×2 | `server/services/printService.ts` |
| Supplement IIFE | `ProductsManagement.tsx` + `CategoryModal.tsx` | Helper partagé |

**5. TypeScript non strict sur tout le projet**
`noImplicitAny: false` + `strictNullChecks: false` dans `tsconfig.json` expliquent tous les `any` vus dans le code. À renforcer progressivement — pas d'un coup.

---

### ✅ Confirmations du plan initial

| Décision | Statut | Raison |
|---|---|---|
| Fastify backend | ✅ Confirmé | Absent des dépendances, à créer en Phase 1 |
| `better-sqlite3` | ✅ Confirmé | Absent des dépendances, à installer en Phase 2 |
| PrintDaemon inchangé | ✅ Confirmé | Ne fait que transférer les octets — tout le formatage ESC/POS est en TypeScript |
| `packages/shared/types/` | ✅ Urgent | `defaultReceiptCustomization` défini 3 fois — la shared lib résout ça dès Phase 1 |
| Éclater POSContext | ✅ Confirmé | 1199 lignes, couplage total |

---

### ⚠️ Risques non anticipés dans le plan initial

**R1 — `sql.js` déjà installé (≠ `better-sqlite3`)**
`sql.js` est SQLite compilé en WebAssembly pour le navigateur — ce n'est PAS `better-sqlite3`. Présent en dépendance mais apparemment non utilisé activement. À supprimer en Phase 2.

**R2 — Deux chemins d'impression parallèles**
`print:direct` dans `electron/main.ts` (~80 lignes d'ESC/POS + TCP) duplique exactement le PrintDaemon C#. À supprimer en Phase 1 — le PrintDaemon est la source de vérité.

**R3 — Deux renderers de ticket maintenus séparément**
`formatTextReceipt()` (ESC/POS text, ~400 lignes, `printer.ts`) et `renderReceiptHTML()` (JSX preview, `receipt-renderer.tsx`) sont deux implémentations indépendantes du même ticket. Tout changement de layout doit être fait en double. Dette consciente à documenter, pas à résoudre en Phase 1.

**R4 — `InventoryManagement.tsx` plus complexe que prévu (49 KB)**
Le fichier le plus volumineux du projet. 9 appels `getDB()` directs avec logique métier embarquée (gestion de stock). Nécessite un `server/src/services/inventoryService.ts` dédié — non listé dans les services Phase 1 initiaux.

**R5 — Packages alpha en production**
`escpos@3.0.0-alpha.6` et `escpos-usb@3.0.0-alpha.4` dans les dépendances de production. Probablement vestiges d'une approche USB avant PrintDaemon. Confirmer non-usage et supprimer en Phase 2.

---

### 🔧 Amendements au plan d'action

**Phase 1 — items supplémentaires :**
- Ajouter alias `@shared/*` dans `vite.config.ts`
- Créer `tsconfig.server.json` pour `server/`
- Créer `server/src/services/inventoryService.ts` (non listé initialement dans Phase 1.5)
- Supprimer `IPC print:direct` de `electron/main.ts`

**Phase 2 — items supplémentaires :**
- Supprimer `sql.js` de `package.json`
- Supprimer `escpos` et `escpos-usb` de `package.json` (après confirmation non-usage)
