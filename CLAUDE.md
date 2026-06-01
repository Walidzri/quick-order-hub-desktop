# CLAUDE.md — Quick Order Hub Desktop

> Ce fichier est le contexte principal du projet. Tu dois le lire en entier avant toute action.
> Il définit l'architecture, les conventions, et l'état d'avancement réel du projet.

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
- **Fastify :3002** — backend embarqué (Main Process)
- **SQLite (better-sqlite3)** — base de données locale
- **PrintDaemon C#** — microservice d'impression (TCP/IP, USB, Bluetooth)
- **server-cloud** — backend VPS Fastify + PostgreSQL (sync cloud)

### Ce que fait l'app aujourd'hui
- Prise de commande (sur place, à emporter, livraison)
- Historique des commandes + rapports et statistiques
- Paramètres (imprimantes, ticket, utilisateurs, backup...)
- Impression cuisine + caisse via PrintDaemon C#
- **Tablette cuisine** — page web temps réel (`/cuisine`) servie par Fastify
- **Écran salle** — page web temps réel (`/display`) servie par Fastify
- **Sync cloud** — SyncService vers VPS PostgreSQL (toggle dans les paramètres)
- **Multi-langue** — Français / Anglais / Arabe RTL
- **Démarrage automatique** — open at login Windows

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         ELECTRON APP                            │
│                                                                 │
│  ┌──────────────────────┐      ┌──────────────────────────────┐ │
│  │   RENDERER PROCESS   │      │       MAIN PROCESS           │ │
│  │   (Frontend)         │      │       (Backend embarqué)     │ │
│  │                      │      │                              │ │
│  │  React + TypeScript  │      │  Fastify :3002               │ │
│  │  └── Pages           │ HTTP │  ├── /api/orders             │ │
│  │  └── Components      │◄────►│  ├── /api/products           │ │
│  │  └── Contexts légers │      │  ├── /api/settings           │ │
│  │  └── Services front  │      │  ├── /api/print              │ │
│  │                      │  WS  │  ├── /api/sync               │ │
│  │                      │◄────►│  ├── /cuisine  (HTML)        │ │
│  │                      │      │  ├── /display  (HTML)        │ │
│  │                      │      │  └── /ws/events              │ │
│  │                      │      │                              │ │
│  │                      │      │  better-sqlite3              │ │
│  │                      │      │  └── database.db             │ │
│  │                      │      │                              │ │
│  │                      │      │  SyncService ✅              │ │
│  │                      │      │  └── sync vers VPS :4000     │ │
│  └──────────────────────┘      └──────────────┬───────────────┘ │
│                                               │                 │
└───────────────────────────────────────────────┼─────────────────┘
                                                │
                    ┌───────────────────────────┤
                    │                           │
                    ▼                           ▼
          PrintDaemon C#                VPS — server-cloud
          Microservice                  └── Fastify :4000
          └── TCP/IP :9100              └── PostgreSQL
          └── USB                           └── /api/sync/*
          └── Bluetooth                     └── WireGuard VPN
          └── Toute impression
```

### Structure réelle du projet

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
│   │   ├── pos/                       ← composants métier
│   │   └── auth/                      ← auth
│   ├── contexts/                      ← contextes légers (éclatés)
│   │   ├── CartContext.tsx
│   │   ├── CatalogContext.tsx
│   │   ├── OrderContext.tsx
│   │   ├── SettingsContext.tsx
│   │   └── PrinterContext.tsx
│   ├── services/                      ← appels HTTP vers Fastify
│   │   ├── api.ts                     ← config base URL http://127.0.0.1:3002
│   │   ├── orderService.ts
│   │   ├── productService.ts
│   │   ├── settingsService.ts
│   │   └── printerService.ts
│   ├── hooks/
│   └── pages/
│
├── server/                            ← Backend Fastify embarqué
│   └── src/
│       ├── routes/
│       │   ├── orders.ts
│       │   ├── products.ts
│       │   ├── categories.ts
│       │   ├── settings.ts
│       │   ├── print.ts
│       │   ├── sync.ts                ← GET /api/sync/status, POST /api/sync/now
│       │   ├── cuisine.ts             ← sert la page HTML tablette cuisine
│       │   └── display.ts             ← sert la page HTML écran salle
│       ├── services/
│       │   ├── orderService.ts
│       │   ├── productService.ts
│       │   ├── settingsService.ts
│       │   ├── printService.ts        ← délègue au PrintDaemon C#
│       │   ├── backupService.ts
│       │   ├── wsService.ts           ← broadcast WebSocket
│       │   └── syncService.ts         ← sync vers VPS (boucle 30s, retry)
│       ├── db/
│       │   ├── connection.ts
│       │   ├── schema.ts              ← colonnes sync_status, synced_at
│       │   ├── seed.ts
│       │   └── migrations/
│       │       ├── 001_initial.sql
│       │       ├── 002_users.sql
│       │       ├── 003_inventory.sql
│       │       └── postgres/
│       │           └── 001_initial.sql ← schéma PostgreSQL VPS
│       └── index.ts                   ← entry point Fastify
│
├── server-cloud/                      ← Backend VPS (Fastify + PostgreSQL)
│   ├── src/
│   │   ├── routes/
│   │   │   └── sync.ts                ← POST /api/sync/categories|orders|products
│   │   ├── db/
│   │   │   └── connection.ts          ← pool PostgreSQL
│   │   └── index.ts                   ← Fastify :4000 + auth x-api-key
│   ├── docker-compose.yml
│   └── .env.example
│
├── packages/
│   └── shared/                        ← types partagés front + back
│       └── types/
│           ├── order.ts
│           ├── product.ts
│           ├── settings.ts            ← cloudSyncEnabled, defaultReceiptCustomization
│           ├── auth.ts
│           ├── inventory.ts
│           ├── print.ts
│           └── index.ts
│
├── tests/
│   ├── phase1/
│   │   ├── api.curl.sh                ← 30/30 PASS ✅
│   │   └── checklist.md               ← 83/83 validés ✅
│   ├── phase2/
│   │   └── checklist.md               ← 88/88 validés ✅
│   └── phase3/
│       └── checklist.md               ← 49/49 validés ✅
│
├── README/                            ← Documentation technique
│   └── ARCHITECTURE.md                ← Architecture complète Phase 4 (VPS, sécurité, licences)
│
└── PrintDaemon/                       ← inchangé (C#)
```

---

## 🔑 Décisions techniques

| Sujet | Décision | Statut |
|---|---|---|
| **Framework backend** | Fastify | ✅ En prod |
| **Base de données locale** | SQLite + better-sqlite3 | ✅ En prod |
| **Frontend** | React (inchangé) | ✅ En prod |
| **Impression** | PrintDaemon C# (inchangé) | ✅ En prod |
| **Cloud** | VPS perso + PostgreSQL | ✅ server-cloud implémenté |
| **Langage** | TypeScript partout sauf PrintDaemon | ✅ En prod |
| **Offline-first** | SQLite local = source de vérité | ✅ En prod |
| **Sync cloud** | SyncService async + retry, toggle UI | ✅ Implémenté |
| **Tablette cuisine** | Page HTML vanilla servie par Fastify | ✅ En prod |
| **Écran salle** | Page HTML vanilla servie par Fastify | ✅ En prod |

---

## 🧪 Stratégie de tests

### Phase 4 — Tests unitaires Vitest
L'architecture est stable. Vitest peut maintenant être introduit pour tester la logique métier.

```typescript
// Exemple : server/src/services/orderService.test.ts
describe('orderService', () => {
  it('calcule le total correctement avec une promo', () => {
    const total = orderService.calculateTotal(lines, promo)
    expect(total).toBe(850)
  })
})
```

---

## 📋 Plan d'action — Phases

---

### ✅ PHASE 0 — Analyse complète du projet
**Statut : TERMINÉE** — 36 fichiers analysés, conclusions intégrées dans ce fichier

---

### ✅ PHASE 1 — Séparation Frontend / Backend
**Statut : VALIDÉE** — 30/30 tests curl PASS, 83/83 items UI validés

- [x] `packages/shared/types/` — types partagés extraits
- [x] Serveur Fastify créé (`server/`)
- [x] Couche services frontend (`src/services/`)
- [x] POSContext éclaté en 5 contextes
- [x] `backupService.ts` + `syncService.ts` créés

---

### ✅ PHASE 2 — Migration IndexedDB → SQLite
**Statut : VALIDÉE** — 88/88 items validés

- [x] SQLite + better-sqlite3 installé, schéma + migrations créés
- [x] Script de migration IndexedDB → SQLite (one-shot, succès confirmé en prod)
- [x] Tous les services branchés sur SQLite
- [x] `database.ts`, `database-sqlite.ts`, fichiers de migration supprimés
- [x] `InventoryManagement.tsx`, `ReportsScreen.tsx`, `SettingsScreen.tsx` → HTTP
- [x] Zéro référence IndexedDB dans le code

---

### ✅ PHASE 3 — Tablette cuisine + Écran salle
**Statut : VALIDÉE** — 49/49 items validés

- [x] WebSocket `/ws/events` + `wsService.ts` (broadcast temps réel)
- [x] Page `/cuisine` — tablette cuisine HTML vanilla
- [x] Page `/display` — écran salle HTML vanilla
- [x] Notification toast POS quand commande passe à "ready"

---

### 🔄 PHASE 4 — Sync cloud + VPS
**Statut : EN COURS**

#### Ce qui est déjà implémenté ✅
- [x] `server-cloud/` — Fastify :4000 + PostgreSQL + Docker Compose
- [x] Routes `/api/sync/categories|orders|products` (upsert batch)
- [x] `syncService.ts` — boucle 30s, retry, sync catégories + commandes + produits
- [x] `/api/sync/status|now|reset` — endpoints de contrôle
- [x] Colonnes `sync_status` + `synced_at` dans SQLite
- [x] Toggle cloud sync dans les paramètres (UI + backend)
- [x] Schéma PostgreSQL (`server/src/db/migrations/postgres/001_initial.sql`)

#### Ce qui reste à faire
- [ ] **Tester la sync end-to-end** en conditions réelles (POS → VPS)
- [ ] **Champ `published`** sur les produits — toggle dans la gestion produits
- [ ] **SyncService : ne sync que les produits `published: true`**
- [ ] **Long polling click & collect** — `GET /api/orders/pending` (VPS) toutes les 30s
- [ ] **Panel admin** — interface web sur VPS (commandes, stats, produits)
- [ ] **Système de licences** — machine ID + vérification locale ou VPS (voir `README/ARCHITECTURE.md` section 13)
- [ ] **Tests Vitest** — orderService, syncService, backupService

#### Tests Phase 4
- [ ] `tests/phase4/sync.curl.sh` — vérifier sync POS → VPS
- [ ] `tests/phase4/checklist.md` — panel admin, offline, produits publiés

#### Validation Phase 4
- [ ] Produits publiés visibles côté VPS automatiquement
- [ ] Commandes payées synchronisées vers VPS
- [ ] POS fonctionne offline si VPS injoignable
- [ ] Tests Vitest passent

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
- **Auth** — `AuthContext.tsx` toujours sur IndexedDB → à migrer vers HTTP (hors scope immédiat)
- **UI components** — `src/components/ui/` ne pas y toucher
- **Offline-first** — toujours vérifier que l'app fonctionne sans réseau après chaque changement
- **Credentials VPS** — `CLOUD_API_URL` et `CLOUD_API_KEY` hardcodés dans `electron/main.ts` → à externaliser dans un fichier de config avant mise en production
- **Architecture Phase 4** — détails VPS, sécurité réseau, licences dans `README/ARCHITECTURE.md`

---

## 📌 Session en cours

> Mettre à jour cette section à chaque session de travail.
> Ne jamais modifier cette section sans validation du développeur.

**Dernière session :** Nettoyage docs markdown — ports/IPs corrigés, fichiers archivés, CLAUDE.md mis à jour
**Phase active :** Phase 4 — Sync cloud + VPS
**Prochaine tâche :** Test end-to-end sync POS → VPS, puis champ `published` sur les produits
**Blockers :** Aucun

---

## 📝 Conclusions d'analyse Phase 0
*(36 fichiers analysés — problèmes identifiés et résolus dans les Phases 1, 2, 3)*

Les 5 problèmes critiques identifiés (POSContext God Object, IndexedDB direct dans React, logique métier dans les composants, duplication de code, TypeScript non strict) ont tous été traités dans les phases suivantes. Le détail complet est archivé dans `_archive/rapport.md`.

**Dettes techniques restantes :**
- `AuthContext.tsx` toujours sur IndexedDB (dépriorisé volontairement)
- Deux renderers de ticket non synchronisés (`formatTextReceipt` ESC/POS vs `renderReceiptHTML` JSX)
- TypeScript strict non activé globalement (à renforcer progressivement)
