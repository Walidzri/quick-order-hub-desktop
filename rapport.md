# Rapport d'analyse — Phase 0
> Fichier généré automatiquement durant la Phase 0 du refactoring.
> Mis à jour à chaque fichier analysé.

---

## État d'avancement

| Fichier | Analysé |
|---|---|
| `electron/main.ts` | ✅ |
| `electron/preload.ts` | ✅ |
| `electron/preload.cjs` | ✅ |
| `src/contexts/POSContext.tsx` | ✅ |
| `src/contexts/AuthContext.tsx` | ✅ |
| `src/pages/Index.tsx` | ✅ |
| `src/components/pos/OrderScreen.tsx` | ✅ |
| `src/components/pos/Cart.tsx` | ✅ |
| `src/components/pos/PaymentModal.tsx` | ✅ |
| `src/components/pos/OrdersScreen.tsx` | ✅ |
| `src/components/pos/ReportsScreen.tsx` | ✅ |
| `src/components/pos/SettingsScreen.tsx` | ✅ |
| `src/components/pos/ProductGrid.tsx` | ✅ |
| `src/components/pos/CategorySidebar.tsx` | ✅ |
| `src/components/pos/ProductModal.tsx` | ✅ |
| `src/components/pos/ProductsManagement.tsx` | ✅ |
| `src/components/pos/InventoryManagement.tsx` | ✅ |
| `src/components/pos/MainNav.tsx` | ✅ |
| `src/components/pos/PrintPreviewModal.tsx` | ✅ |
| `src/components/pos/ReceiptCustomizationSection.tsx` | ✅ |
| `src/components/pos/UserModal.tsx` | ✅ |
| `src/components/pos/CategoryModal.tsx` | ✅ |
| `src/components/pos/EditCartItemModal.tsx` | ✅ |
| `src/components/pos/ManualItemModal.tsx` | ✅ |
| `src/components/pos/OrderTypeModal.tsx` | ✅ |
| `src/components/auth/LoginScreen.tsx` | ✅ |
| `src/components/auth/LockScreen.tsx` | ✅ |
| `src/components/auth/SetupScreen.tsx` | ✅ |
| `src/lib/database.ts` | ✅ |
| `src/lib/printer.ts` | ✅ |
| `src/lib/receipt-renderer.tsx` | ✅ |
| `src/lib/logger.ts` | ✅ |
| `src/lib/i18n.ts` | ✅ |
| `src/lib/utils.ts` | ✅ |
| `package.json` | ✅ |
| `vite.config.ts` | ✅ |
| `tsconfig.json` | ✅ |
| `tsconfig.electron.json` | ✅ |

---

## Analyses détaillées

---

### `electron/main.ts` — ~705 lignes

**Responsabilité actuelle :** Point d'entrée du Main Process Electron. Fait trop de choses.

**Blocs identifiés :**

| Bloc | Lignes | Description |
|---|---|---|
| Cycle de vie app | 1–45 | Init, squirrel-startup, création fenêtre |
| Gestion PrintDaemon | 195–344 | Démarrage/arrêt du process C# |
| IPC `print:test` | 385–448 | Test TCP de connexion imprimante |
| IPC `print:direct` | 450–543 | Envoi direct ESC/POS via TCP (doublon PrintDaemon) |
| IPC `fs:*` | 545–564 | Lecture/écriture fichiers |
| IPC `dialog:*` | 566–588 | Boîtes de dialogue natives |
| IPC `backup:*` | 590–608 | Sauvegarde/chargement backup |
| IPC `app:*` | 610–638 | Chemins userData, shutdown PC |
| Logging | 641–700 | Écriture logs fichier |

**Problèmes identifiés :**

1. **`print:direct` duplique le PrintDaemon** — ~80 lignes d'ESC/POS et TCP dans le Main Process alors que c'est exactement le rôle du PrintDaemon C#. Deux chemins d'impression coexistent.
2. **Backup dispersé** — IPC `backup:*` ici + `useEffect` dans React. Logique éclatée.
3. **Rotation des logs vide** — fonction `rotateLogFiles()` jamais implémentée (commentaire "for now").

**Ce qui reste après refactoring :**
- Cycle de vie fenêtre + démarrage PrintDaemon
- Lancement du serveur Fastify (à ajouter)
- IPC `dialog:*` (Electron uniquement)
- IPC `app:shutdownPC`

**Ce qui migre :**
- `print:direct` / `print:test` → PrintDaemon C# via Fastify
- `backup:*` → `server/src/services/backupService.ts`
- `fs:*` → backend Fastify
- Logging → backend

---

### `electron/preload.ts` — ~57 lignes
### `electron/preload.cjs` — ~51 lignes

**Responsabilité actuelle :** Pont sécurisé Main ↔ Renderer via `contextBridge`. Expose `window.electronAPI`.

**API exposée :**

| Méthode | IPC cible |
|---|---|
| `printDirect` | `print:direct` |
| `testPrinter` | `print:test` |
| `readFile` / `writeFile` | `fs:*` |
| `showMessageBox/SaveDialog/OpenDialog` | `dialog:*` |
| `saveBackup` / `loadBackup` | `backup:*` |
| `getUserDataPath` / `getIndexedDBPath` | `app:*` |
| `shutdownPC` | `app:shutdownPC` |
| `writeLog` | `log:write` (absent dans `.cjs`) |
| `platform` | valeur directe |

**Problèmes identifiés :**

1. **Deux fichiers à synchroniser manuellement** — `.ts` et `.cjs` doivent toujours être identiques. `writeLog` est absent du `.cjs` → désynchronisation déjà présente.

**Après refactoring :**
Seuls restent : `showMessageBox/SaveDialog/OpenDialog`, `shutdownPC`, `platform`.
Tout le reste disparaît (React appellera Fastify en HTTP).

---

### `src/contexts/POSContext.tsx` — ~1199 lignes

**Responsabilité actuelle :** God Object. Gère la totalité de la logique métier du POS depuis React.

**Blocs identifiés :**

| Bloc | Lignes | Description |
|---|---|---|
| Types / interfaces | 39–147 | `CartItem`, `OrderDraft`, `POSContextType` |
| Init DB + chargement données | 178–242 | `useEffect` → IndexedDB direct |
| Traduction / i18n | 244–251 | Fonction `t()` |
| Thème (hexToHSL, darkMode, RTL) | 254–333 | Manipulation DOM directe depuis un Context |
| Gestion produits | 344–430 | CRUD produits, variantes, catégories |
| Gestion panier (multi-draft) | 432–554 | Logique de draft, cart, activeOrder |
| Calcul totaux | 556–574 | subtotal, discount, total |
| Codes promo | 576–606 | Application/retrait de promos |
| Numérotation commandes | 608–624 | Compteur journalier en IndexedDB |
| Gestion commandes | 626–851 | CRUD, pagination, date range |
| Gestion promotions | 853–870 | CRUD promotions |
| Gestion imprimantes | 872–893 | CRUD printers (+ 2 fonctions vidées) |
| Kiosk mode | 895–920 | Toggle fullscreen |
| Backup automatique | 1005–1191 | `useEffect` avec setInterval/setTimeout |

**Problèmes identifiés :**

1. **Appels IndexedDB directs depuis React** — `getDB()` appelé partout dans le Context. Aucune couche service.
2. **Backup automatique dans un `useEffect` React** — ~185 lignes de scheduling (interval, daily, weekly, monthly) dans le Renderer. Catastrophique : le backup s'arrête si le composant se démonte ou si la fenêtre est minimisée.
3. **Manipulation DOM dans un Context** — `document.documentElement.classList`, `style.setProperty` appelés dans `updateSettings`. Ce n'est pas le rôle d'un Context.
4. **Logique métier mélangée avec état UI** — calcul de totaux, validation promos, numérotation commandes : tout est dans le même fichier.
5. **Deux fonctions vidées** — `printKitchenTicket` et `printReceipt` sont des stubs vides (lignes 887–893).
6. **`any` utilisé** — lignes 128–138 dans `exportProductsTemplate` / `importProductsTemplate`.
7. **Logique de draft complexe** — multi-draft (plusieurs commandes en parallèle) bien implémentée mais difficile à tester unitairement dans cet état.

**Découpage cible :**

| Responsabilité | Destination |
|---|---|
| Données produits/catégories | `CatalogContext.tsx` → fetch HTTP |
| Panier / drafts | `CartContext.tsx` (état pur, pas de DB) |
| Commandes | `OrderContext.tsx` → fetch HTTP |
| Settings + thème | `SettingsContext.tsx` → fetch HTTP |
| Imprimantes | `PrinterContext.tsx` → fetch HTTP |
| Backup automatique | `server/src/services/backupService.ts` |
| Calcul totaux | `server/src/services/orderService.ts` |
| Codes promo | `server/src/services/orderService.ts` |
| Numérotation | `server/src/services/orderService.ts` |

---

### `src/contexts/AuthContext.tsx` — ~735 lignes

**Responsabilité actuelle :** Authentification complète : login/logout, PIN, verrouillage automatique, gestion des utilisateurs, système de permissions par rôle.

**Blocs identifiés :**

| Bloc | Lignes | Description |
|---|---|---|
| Constantes sécurité | 6–8 | MAX_LOGIN_ATTEMPTS, LOCKOUT, AUTO_LOCK |
| Système de permissions | 43–110 | ROLE_PERMISSIONS, VIEW_PERMISSIONS, SETTINGS_SECTION_PERMISSIONS |
| Timer inactivité | 120–162 | `useRef` + `setTimeout` + listeners DOM |
| `login` / `loginWithPin` | 193–345 | Auth avec hash/migration mot de passe |
| `logout` / `lock` / `unlock` / `unlockWithPin` | 347–500 | Session, verrouillage écran |
| `createInitialAdmin` | 502–555 | Setup initial |
| `saveUser` / `deleteUser` / `loadUsers` | 574–665 | CRUD utilisateurs |
| `hasPermission` / `canAccessView` / `canAccessSettingsSection` | 672–709 | Logique de permissions (wildcards) |

**Points positifs :**
- Logique de sécurité correcte : tentatives échouées, lockout, timer inactivité
- Migration automatique mot de passe clair → hash (backward compat)
- Système de permissions par wildcard bien conçu (`settings.*` couvre tout)
- Déconnexion systématique au démarrage (pas de restauration de session)

**Problèmes identifiés :**

1. **Appels IndexedDB directs depuis React** — `getDB()` appelé dans `login`, `loginWithPin`, `logout`, `unlock`, `saveUser`, `deleteUser`, `loadUsers`, `checkSetupRequired`. Même problème que POSContext.
2. **`localStorage` pour session** — `pos_user` et `pos_session_id` stockés en clair dans le localStorage. En contexte Electron local c'est acceptable, mais à noter.
3. **Un `any` utilisé** — ligne 548 (`error: any` dans `createInitialAdmin`).
4. **Pas de logout automatique à l'expiration de session** — le timer lock l'écran mais ne déconnecte pas vraiment.

**Verdict CLAUDE.md :** Le CLAUDE.md dit explicitement "ne pas refactoriser AuthContext pour l'instant, pas prioritaire". Ce fichier **ne sera pas touché en Phase 1**. Il sera migré vers Fastify uniquement en Phase 2 (quand IndexedDB est remplacé par SQLite).

**Ce qui change en Phase 1 :** Rien sur ce fichier.
**Ce qui change en Phase 2 :** Remplacer les appels `getDB()` par des appels HTTP vers `server/src/services/userService.ts`.

---

### `src/components/pos/OrderScreen.tsx` — ~55 lignes

**Responsabilité :** Écran principal de prise de commande. Compose `CategorySidebar` + `ProductGrid` + `Cart` + `ProductModal`.

**Points positifs :** Très propre. Composant de layout pur, aucune logique métier.
**Impact refactoring : NULO** — aucun changement nécessaire.

---

### `src/components/pos/OrdersScreen.tsx` — ~762 lignes

**Responsabilité :** Liste paginée des commandes avec filtres, sélection multiple, export CSV, impression.

**Problèmes identifiés :**
1. **`usePOS()` appelé pour tout** — charge `printKitchenTicket`, `printReceipt` (fonctions vides), `loadOrdersPaginated`, etc.
2. **Export CSV généré côté client** — `generateOrdersCSV()` directement dans le composant. À déplacer vers un service.
3. **Filtrage client-side** — le filtre par statut et la recherche se font sur la page en mémoire, pas côté serveur. Acceptable pour 50 lignes, mais à terme devrait être en query param.
4. **Référence à des fonctions de POSContext qui sont des stubs vides** — `printKitchenTicket`, `printReceipt` ne font rien.

**Impact refactoring : MOYEN** — `usePOS()` remplacé par `useOrders()` + `usePrinter()`, export CSV → service.

---

### `src/components/pos/ReportsScreen.tsx` — ~765 lignes

**Responsabilité :** Tableau de bord statistiques : revenus, top produits, répartition catégories, stats caissiers.

**Problèmes identifiés :**
1. **`getDB()` appelé directement** — `loadCashierStats()` appelle `getDB()` pour charger les sessions, sans passer par le Context. Violation directe de l'architecture cible.
2. **Logique de calcul dans le composant** — calcul de `cashierStats`, `topProducts`, `categoryData` dans le render. Devrait être dans un service.
3. **`now` non défini à la ligne 432** — référence à `now` dans `handleExportCSV` qui n'est pas déclarée dans le scope de la fonction (variable flottante au niveau module). Bug potentiel.
4. **`interface` déclarées à l'intérieur du composant** — `CashierStats`, `ProductStats`, `CategoryStats` déclarées dans la fonction. Devraient être dans les types partagés.

**Impact refactoring : FORT** — toute la logique de calcul migre vers `server/src/services/reportService.ts`. Le composant ne fait que du rendu.

---

### `src/components/pos/SettingsScreen.tsx` — ~900+ lignes (fichier trop grand pour lecture complète)

**Responsabilité :** Écran de paramètres. Contient TOUTES les sections de settings en un seul fichier.

**Sections incluses :** general, branding, products, inventory, printers, receipt, promotions, theme, users, data (backup/restore).

**Problèmes identifiés :**
1. **Fichier monolithique** — ~900+ lignes pour 10 sections de settings. Chaque section mériterait son propre composant.
2. **`getDB()` appelé directement dans `handleExportBackup`** — ligne 258 : `import('@/lib/database')` et `getDB()` dans un handler de click React. C'est le pire endroit pour appeler la DB.
3. **Logique de backup complète dans le composant** — export/import JSON de toutes les stores IndexedDB depuis un composant React.
4. **`fetch('http://127.0.0.1:9100/status')`** — appel HTTP direct vers PrintDaemon depuis le Renderer. Correct en attendant Fastify, mais devra passer par le backend.
5. **`DirectPrinter` instancié dans un handler React** — ligne 210 : `new DirectPrinter(connection)` directement dans `handleOpenDrawer`. Logique d'impression dans un composant.
6. **Mélange de responsabilités** — ce fichier touche à la DB, à l'impression, au backup, aux users, aux printers, aux promotions.

**Impact refactoring : TRÈS FORT** — c'est le 2ème plus grand chantier après `POSContext.tsx`. Chaque section devient un composant séparé, la logique migre vers les services backend.

---

## Problèmes transversaux identifiés (jusqu'ici)

| Problème | Fichiers concernés | Impact |
|---|---|---|
| Deux chemins d'impression | `main.ts` + PrintDaemon C# | Risque d'incohérence |
| Backup dans React | `POSContext.tsx` | Backup peut rater si app minimisée |
| Zéro couche service | `POSContext.tsx` | IndexedDB appelé depuis 20+ endroits |
| preload désynchronisé | `preload.ts` vs `preload.cjs` | `writeLog` absent du `.cjs` |
| `any` TypeScript | `POSContext.tsx` | Contourne le typage strict |

---

---

### `src/pages/Index.tsx` — ~140 lignes

**Responsabilité actuelle :** Point d'entrée de l'application React. Routage entre les vues principales, gestion des états d'auth.

**Ce qu'il fait :**
- Monte les providers `AuthProvider` et `POSProvider`
- Gère les états d'affichage : Setup → Login → Lock → Loading → App
- Route entre les 4 vues : `order`, `orders`, `reports`, `settings`
- Applique le scale UI et la direction RTL/LTR
- Intègre les claviers virtuels globaux

**Points positifs :**
- Très propre, bien découpé, responsabilité unique
- Utilise `canAccessView()` pour protéger les vues par rôle
- `AnimatePresence` / `motion` pour les transitions

**Problèmes identifiés :**
- Aucun problème majeur. Ce fichier survivra au refactoring quasiment intact.
- Après Phase 1 : `POSProvider` sera remplacé par les nouveaux contexts éclatés (`CartProvider`, `CatalogProvider`, etc.)

**Impact refactoring : FAIBLE** — seule l'arborescence des providers change.

---

---

### `src/components/pos/CategorySidebar.tsx` — ~48 lignes

**Parfait.** Composant pur, memoïsé, uniquement du rendu. Lit `categories` depuis `usePOS()`.
**Impact refactoring : NUL** — juste changer `usePOS()` → `useCatalog()`.

---

### `src/components/pos/ProductGrid.tsx` — ~99 lignes

**Très propre.** Composant pur de rendu. Utilise `getProductsByCategory` et `getVariantsByProduct` depuis `usePOS()`.
**Impact refactoring : NUL** — juste changer `usePOS()` → `useCatalog()`.

---

### `src/components/pos/Cart.tsx` — ~472 lignes

**Responsabilité :** Panier multi-draft, gestion des items, codes promo, bouton de paiement.

**Points positifs :** Logique de panier propre, gère bien les états UI complexes (multi-draft, modals).

**Problèmes identifiés :**
1. **`any` utilisé** — `paidOrder: { order: any; ... }` (ligne 66) et `editingCartItem: any` (ligne 68). Types à définir proprement.
2. **Trop de responsabilités via `usePOS()`** — importe settings, printers, fonctions d'ordre, de panier et de traduction depuis le même contexte monolithique.
3. **Logique "pending cart item"** — gestion d'un item en attente quand aucun draft n'existe. Logique correcte mais complexe, dispersée entre `useEffect` et handlers.

**Impact refactoring : FAIBLE** — `usePOS()` → `useCart()` + `useOrders()` + `useSettings()`. Pas de logique métier à migrer.

---

### `src/components/pos/PaymentModal.tsx` — ~510 lignes

**C'est le composant le plus problématique côté impression.**

**Responsabilité actuelle :** Modal de paiement + **impression automatique du ticket cuisine** + **ouverture du tiroir caisse**.

**Problèmes identifiés :**

1. **`DirectPrinter` instancié directement dans le composant React** — `new DirectPrinter(connection)` aux lignes 190 et 247. 200 lignes de logique d'impression dans un composant UI.
2. **`printKitchenTicketAutomatically`** (~140 lignes) — formatage du ticket cuisine, résolution des imprimantes, impression en parallèle, tout dans le composant.
3. **`openCashDrawerIfNeeded`** (~40 lignes) — logique tiroir caisse dans le composant.
4. **`DirectPrinter.formatTextReceipt()`** appelé directement — le formatage du ticket est dans le composant, pas dans un service.
5. **Couplage fort** — le paiement, l'impression cuisine et l'ouverture du tiroir sont dans le même flux synchrone/asynchrone, difficile à tester.

**Découpage cible :**
- `handlePayment()` → `POST /api/orders/:id/pay` → Fastify appelle PrintDaemon C# automatiquement
- `printKitchenTicketAutomatically()` → `server/src/services/printService.ts`
- `openCashDrawerIfNeeded()` → `server/src/services/printService.ts`
- Le composant ne fait plus que : choisir le moyen de paiement + afficher le résultat

**Impact refactoring : TRÈS FORT** — ce composant doit être radicalement simplifié en Phase 1.

---

---

### `src/components/pos/ManualItemModal.tsx` — ~160 lignes

**Parfait.** Formulaire simple (nom, prix, quantité, note), appelle `addToCart`. Aucune logique métier, aucun appel DB.
**Impact refactoring : NUL** — juste renommer `usePOS()` → `useCart()`.

---

### `src/components/pos/OrderTypeModal.tsx` — ~250 lignes

**Propre.** Modal de sélection de type de commande (sur place / à emporter / livraison) avec formulaire de livraison. Aucun appel DB.
**Impact refactoring : NUL** — juste renommer `usePOS()` → `useCart()`.

---

### `src/components/pos/ProductModal.tsx` — ~421 lignes

**Responsabilité :** Sélection de variante, suppléments, quantité, note → `addToCart`.

**Points positifs :** Pas d'appel DB direct. Logique de correspondance de suppléments par taille bien pensée.

**Problèmes identifiés :**
1. **Logique de correspondance suppléments complexe** — `getSupplementPriceForSize()` avec matching par taille (L/XL/XXL). Correcte mais difficile à tester unitairement dans cet état.
2. **Duplication avec `EditCartItemModal`** — `getSupplementPriceForSize()`, `toggleSupplement()` et la sélection de variants sont quasi-identiques dans les deux fichiers.

**Impact refactoring : FAIBLE** — `usePOS()` → `useCatalog()` + `useCart()`.

---

### `src/components/pos/EditCartItemModal.tsx` — ~384 lignes

**Responsabilité :** Modification d'un article dans le panier (variante, suppléments, note).

**Problèmes identifiés :**
1. **Code quasi-identique à `ProductModal`** — `getSupplementPriceForSize()`, `toggleSupplement()`, `useEffect` de mise à jour des prix : tout est dupliqué. Un hook partagé `useSupplementSelection()` éliminerait cette duplication.

**Impact refactoring : FAIBLE** — même changement que `ProductModal`.

---

### `src/components/pos/PrintPreviewModal.tsx` — ~530 lignes

**3ème composant majeur d'impression** (après `PaymentModal` et `SettingsScreen`).

**Responsabilité :** Prévisualisation HTML + impression via PrintDaemon + téléchargement PDF.

**Problèmes identifiés :**
1. **`DirectPrinter` instancié 3 fois** dans `handleDirectPrint` — une fois pour cashier, une fois pour kitchen, une fois dans `handlePrintKitchenTicket`. Toute la logique de résolution d'imprimante (~200 lignes) est dans le composant.
2. **`DirectPrinter.formatTextReceipt()`** appelé directement — formatage ticket dans le composant.
3. **`html2pdf.js` sans types TypeScript** — `@ts-ignore` à la ligne 13.
4. **Duplication massive avec `PaymentModal`** — le formatage du ticket cuisine est quasi-identique entre `PrintPreviewModal.handlePrintKitchenTicket()` et `PaymentModal.printKitchenTicketAutomatically()`. Le même code existe en 2 endroits.

**Découpage cible :**
- `handleDirectPrint()` → `POST /api/print/receipt` ou `POST /api/print/kitchen` → Fastify → PrintDaemon
- Le composant se réduit à : affichage preview HTML + bouton "Imprimer" + bouton "Télécharger PDF"

**Impact refactoring : TRÈS FORT** — même traitement que `PaymentModal`.

---

---

### `src/components/pos/MainNav.tsx` — 129 lignes

**Responsabilité :** Barre de navigation fixée en bas. Purement présentationnelle.

- `usePOS()` pour : `t`, `kioskMode`, `toggleKioskMode`, `settings`
- `useAuth()` pour : `canAccessView`, `logout`, `lock`, `user`
- Aucune logique métier, aucun appel DB.

**Impact refactoring : NUL** — seul `usePOS()` → `useSettings()` est à changer.

---

### `src/components/pos/ReceiptCustomizationSection.tsx` — 594 lignes

**Responsabilité :** Section de personnalisation tickets/reçus avec prévisualisation live (reçu caisse + ticket cuisine).

- `usePOS()` uniquement pour : `currency` (ligne 35). Tout le reste arrive par props (`settings`, `updateSettings`, `t`).
- `DirectPrinter.getDefaultCustomization()` — méthode statique, retourne uniquement un objet de config par défaut. Pas d'impression.
- `renderReceiptHTML()` pour le rendu preview.

**Problèmes identifiés :**
1. **Duplication du bloc preview** — le rendu `renderReceiptHTML()` est copié-collé deux fois : desktop (lignes 527–536) et mobile (lignes 552–561). Même appel, même arguments, deux blocs JSX séparés uniquement par un breakpoint CSS.
2. **Mélange reçu / cuisine dans le même fichier** — les paramètres de `dateFormat`/`timeFormat` apparaissent deux fois (une pour reçu, une pour cuisine) et modifient le même champ `customization.dateFormat` — les deux sections partagent le même format.

**Impact refactoring : FAIBLE** — `usePOS()` → `useSettings()` pour `currency`. La duplication desktop/mobile est à consolider hors scope Phase 1.

---

### `src/components/pos/UserModal.tsx` — 457 lignes

**Responsabilité :** Modal de création/édition d'utilisateur. Entièrement découplé via props.

- Reçoit `user`, `existingUsers`, `onSave`, `t` — zéro appel à un contexte.
- Validation complète : unicité admin, PIN 4–6 chiffres, longueur mot de passe, confirmation.
- Un seul `any` : ligne 147 — `catch (error: any)`.

**Impact refactoring : NUL** — aucun changement nécessaire.

---

### `src/components/pos/CategoryModal.tsx` — 302 lignes

**Responsabilité :** Formulaire de catégorie : nom, ordre, icône, image (FileReader base64, max 2Mo), suppléments associés.

- `usePOS()` pour : `t`, `products`, `getProductsByCategory` (ligne 20).
- Calcul des suppléments en IIFE (lignes 29–42) : combine `getProductsByCategory('supplements')` + filtre direct sur `products` pour inclure les suppléments non disponibles (available === false).
- Aucun appel DB direct.

**Impact refactoring : FAIBLE** — `usePOS()` → `useCatalog()` pour `t`, `products`, `getProductsByCategory`.

---

---

### `src/components/pos/ProductsManagement.tsx` — ~1003 lignes

**Responsabilité :** Gestion des produits et catégories. Liste filtrée, export/import JSON+CSV, modale d'édition.

**Structure :** Reçoit les opérations DB par props (`saveProduct`, `deleteProduct`, `loadProducts`, `saveCategory`, `deleteCategory`, `loadCategories`) — bon pattern. Contient également `ProductModal` comme composant privé embarqué (~446 lignes, lignes 558–1003).

**Problèmes identifiés :**
1. **Export JSON/CSV dans le composant** — `handleExportJSON` (lignes 77–91) et `handleExportCSV` (lignes 93–117) construisent et déclenchent le téléchargement directement dans le composant.
2. **Import JSON/CSV dans le composant** — `handleImportJSON` (lignes 119–138) et `handleImportCSV` (lignes 140–193) parsent les fichiers et bouclent sur `saveProduct` dans le composant.
3. **IIFE supplément dupliquée** — lignes 522–535 : même calcul de suppléments que dans `CategoryModal.tsx` (duplicata #3 de ce pattern).
4. **`usePOS()` pour `t` et `getProductsByCategory` seulement** (ligne 58) — le reste arrive bien par props.

**Impact refactoring : MOYEN** — export/import → service backend. `usePOS()` → `useCatalog()`. `ProductModal` peut rester embarqué ou être extrait (hors scope Phase 1).

---

### `src/components/pos/InventoryManagement.tsx` — ~49 Ko (le plus gros fichier)

**Responsabilité :** Gestion fournisseurs, articles d'inventaire, factures d'achat, rapports de stock. 4 onglets.

**Problèmes identifiés :**

1. **9 appels directs à `getDB()`** — chaque fonction CRUD fait `import('@/lib/database')` + `getDB()` dans un try/catch indépendant. C'est le cas le plus flagrant du projet :
   - `loadSuppliers` (ligne 79–88)
   - `loadInventoryItems` (ligne 90–99)
   - `loadInvoices` (ligne 101–110)
   - `saveSupplier` (ligne 112–123)
   - `saveInventoryItem` (ligne 125–136)
   - `saveInvoice` (ligne 138–162)
   - `deleteSupplier` (ligne 164–175)
   - `deleteInventoryItem` (ligne 177–188)
   - `deleteInvoice` (ligne 190–216)

2. **Logique métier de stock dans le composant** :
   - `saveInvoice` met à jour `inventoryItems.currentStock` pour chaque ligne de facture (lignes 147–156)
   - `deleteInvoice` inverse ces mouvements de stock (lignes 196–207)
   Ces deux opérations sont des transactions métier qui doivent être atomiques côté serveur.

3. **Bypasse complètement `usePOS()`** — accède à IndexedDB directement sans passer par le contexte. Le pire niveau d'isolation.

**Découpage cible :**
- Toute la logique → `server/src/services/inventoryService.ts`
- Le composant ne garde que : affichage des listes filtrées, formulaires de saisie, appels HTTP.

**Impact refactoring : TRÈS FORT** — 3ème plus grand chantier après `POSContext` et `SettingsScreen`.

---

---

### `src/components/auth/LoginScreen.tsx` — 511 lignes

**Responsabilité :** Écran de connexion. 3 modes : sélection utilisateur → PIN keypad → formulaire mot de passe.

- `useAuth()` pour : `login`, `loginWithPin`, `users`, `loadUsers`, `getRemainingLockoutTime`
- `usePOS()` pour : `kioskMode`, `toggleKioskMode`, `settings`, `updateSettings`, `t`
- Auto-submit PIN à 4–6 chiffres (via `setTimeout` 300ms)
- Timer lockout avec countdown en temps réel

**Problèmes identifiés :**
1. **`usePOS()` sur l'écran de connexion** — `settings` est utilisé uniquement pour le sélecteur de langue (`settings.language`). `updateSettings` pour changer la langue avant auth. Tout utilisateur peut changer la langue sans être connecté — c'est probablement voulu.
2. **`formatLockoutTime()` dupliquée** — même fonction dans `LoginScreen` et `LockScreen`. Devrait être dans `src/lib/utils.ts`.
3. **Clavier PIN 3×4 dupliqué** — même grille `['1','2',...,'backspace']` avec même logique dans `LoginScreen` et `LockScreen`. Devrait être un composant partagé `PinKeypad`.

**Impact refactoring : FAIBLE** — `usePOS()` → `useSettings()`.

---

### `src/components/auth/LockScreen.tsx` — 355 lignes

**Responsabilité :** Écran de verrouillage. 2 modes : PIN / mot de passe (admin seulement).

- `useAuth()` uniquement — **aucun appel à `usePOS()`**
- Auto-submit PIN, timer lockout, bouton déconnexion

**Problèmes identifiés :**
1. **`formatLockoutTime()` dupliquée** — identique à `LoginScreen`.
2. **Clavier PIN dupliqué** — identique à `LoginScreen`.

**Impact refactoring : NUL** — aucun changement context nécessaire.

---

### `src/components/auth/SetupScreen.tsx` — 392 lignes

**Responsabilité :** Wizard 2 étapes pour créer le compte Chef initial (premier lancement).

- `useAuth()` pour : `saveUser`, `loadUsers`
- `usePOS()` pour : `kioskMode`, `toggleKioskMode`, `settings`, `updateSettings`, `t`

**Problèmes identifiés :**
1. **Bloc language selector copié-collé** — lignes 117–161 : même JSX que dans `LoginScreen`. Devrait être un composant `LanguageSelector`.
2. **`window.location.reload()`** — rechargement brut après création du chef (ligne 100). Fonctionnel mais brutal.
3. **`catch (error: any)`** — ligne 101.

**Impact refactoring : FAIBLE** — `usePOS()` → `useSettings()`.

---

---

### `src/lib/database.ts` — ~800 lignes

**Responsabilité :** Source de vérité actuelle. Mélange 4 rôles dans un seul fichier.

| Bloc | Lignes | Contenu |
|---|---|---|
| Types / interfaces | 1–336 | 16 types (`OrderStatus`, `UserRole`...), 15 interfaces (`Order`, `Product`, `Settings`...) |
| Schéma IndexedDB | 337–506 | `POSDBSchema` + `getDB()` singleton + migrations v1→v4 |
| Seed initial | 508–614 | `initializeDatabase()` — admin par défaut + settings complets |
| Utilitaires | 616–795+ | `exportProductsTemplate`, `importProductsTemplate`, `resetDatabase` |

**16 stores IndexedDB :** categories, products, productVariants, modifierGroups, modifierOptions, orders, printers, printJobs, promotions, settings, numberingCounters, users, userSessions, suppliers, inventoryItems, invoices.

**Problèmes identifiés :**
1. **`defaultReceiptCustomization` dupliqué 3 fois** — dans `initializeDatabase()` (ligne ~539), dans `resetDatabase()` (ligne ~723), et dans `printer.ts::getDefaultCustomization()`. Trois copies du même objet de 45 champs.
2. **Types mélangés avec la logique DB** — les interfaces (`Order`, `User`, etc.) devraient être dans `packages/shared/types/`, pas dans le fichier de connexion DB.
3. **Migrations inline** — le callback `upgrade()` contient toute l'historique de migrations (v0→v1→v2→v3→v4). Impossible à tester, difficile à maintenir.
4. **Pas de transactions** — les opérations multi-store (`exportProductsTemplate`) font des `db.getAll` séquentiels sans transaction. Risque de données incohérentes.

**Ce qui se passe en Phase 2 :**
- Types → `packages/shared/types/`
- Schéma + migrations → `server/src/db/schema.ts` + `server/src/db/migrations/*.sql`
- Seed → `server/src/db/seed.ts`
- Utilitaires → `server/src/services/`
- Ce fichier **disparaît entièrement** à la fin de la Phase 2.

---

### `src/lib/printer.ts` — ~989 lignes

**Responsabilité :** Classe `DirectPrinter` — interface TypeScript avec le PrintDaemon C#.

| Méthode | Rôle |
|---|---|
| `formatReceipt()` | Contenu string → `Uint8Array` ESC/POS (init, alignement, feed, cut) |
| `printViaNetwork()` | POST `http://127.0.0.1:9100/print` — imprimante réseau |
| `printViaWindows()` | POST `http://127.0.0.1:9100/print` — imprimante USB/spooler |
| `printViaWebSocket()` | WebSocket fallback |
| `openDrawer()` | POST `http://127.0.0.1:9100/open-drawer` |
| `print()` | Dispatch selon le type de connexion |
| `formatTextReceipt()` | ~400 lignes — formatage complet reçu/ticket cuisine en texte ESC/POS |
| `getDefaultCustomization()` | Objet config par défaut (3ème copie de `defaultReceiptCustomization`) |
| `cleanTextForPrinter()` | Supprime accents, emojis, non-ASCII |

**Points clés :**
1. **Le PrintDaemon C# ne fait que relayer les bytes** — tout le formatage ESC/POS est en TypeScript. Migration vers Fastify = déplacer cette classe, **pas** modifier le PrintDaemon.
2. **`printViaNetwork` et `printViaWindows` quasi-identiques** — seul `X-Printer-Type` change (network vs usb). Une refactorisation possible mais hors scope.
3. **Logo non supporté dans `formatTextReceipt`** — TODO ligne ~704 : conversion base64→bitmap ESC/POS nécessite Canvas async, incompatible avec méthode sync. Le daemon gère ça via `/print/with-logo` en séparé.
4. **Bluetooth non implémenté** — `throw new Error('non encore implémentée')`.

**Après refactoring :**
- La classe `DirectPrinter` migre **intégralement** vers `server/src/services/printService.ts` sans réécriture majeure.
- Les composants React qui l'instancient (`PaymentModal`, `PrintPreviewModal`, `SettingsScreen`) sont remplacés par des appels HTTP vers `POST /api/print`.

---

---

### `src/lib/receipt-renderer.tsx` — 542 lignes

**Responsabilité :** Renderer HTML/JSX du ticket — utilisé pour l'aperçu dans le navigateur.

- Fonction pure `renderReceiptHTML()` : `Order` + `Settings` + `ReceiptCustomization` → `React.ReactElement`
- Deux branches : reçu client et ticket cuisine
- Utilise uniquement des méthodes statiques de `DirectPrinter` (`formatDate`, `applyTextStyle`)

**Problèmes identifiés :**
1. **Duplication interne du séparateur** — le même bloc CSS inline (5 lignes) pour le séparateur est copié-collé 3 fois dans le fichier (lignes ~63, ~200, ~415) alors qu'un composant `<Separator />` existe dans le même fichier.
2. **Deux moteurs de rendu parallèles non synchronisés** — `renderReceiptHTML()` (JSX, pour l'aperçu) et `DirectPrinter.formatTextReceipt()` (texte ESC/POS, pour l'impression) sont deux implémentations indépendantes du même ticket. Si on modifie la logique dans l'un, il faut le faire dans l'autre manuellement.

**Après refactoring :** Ce fichier reste dans le frontend (c'est de l'UI). Seul l'import de `ReceiptCustomization` migre vers `packages/shared/types/`. L'import de `DirectPrinter` sera remplacé par les méthodes statiques migrées.

**Impact refactoring : FAIBLE**

---

### `src/lib/logger.ts` — 371 lignes

**Responsabilité :** Logger singleton côté Renderer (frontend).

- 5 niveaux : DEBUG→FATAL, buffer mémoire 100 entrées
- Mode Electron : `window.electronAPI.writeLog` → fichier
- Mode browser : localStorage (7 jours)

**Problèmes identifiés :**
1. **`initializeLogFile()` est un stub vide** — lignes 57–68 : corps vide avec commentaires. La persistance Electron fonctionne via `persistLog()`, pas via cette méthode.
2. **`data?: any`** dans `LogEntry` — contourne le typage strict.
3. **Frontend seulement** — utilise `window.electronAPI`, incompatible avec Node.js/Fastify.

**Après refactoring :** Remplacé par Pino (logger intégré Fastify) côté backend. Le frontend peut garder une version simplifiée ou supprimer ce logger.

**Impact refactoring : FAIBLE**

---

### `src/lib/i18n.ts` — ~1898 lignes

**Responsabilité :** Système de traduction + formatage de devise.

- 3 langues : `fr-FR`, `en-US`, `ar-DZ` (arabe RTL)
- 4 devises : `EUR`, `DZD`, `USD`, `GBP`
- ~600 clés de traduction × 3 langues = ~1800 lignes d'objet statique
- `formatCurrency(amount, currency)` — utilise `toLocaleString(undefined, ...)` (locale navigateur)
- `getTranslation(key, language)` — helper sans context

**Problèmes identifiés :**
1. **`toLocaleString(undefined, ...)` — locale `undefined`** — le formatage dépend de la locale du navigateur, pas de la langue choisie dans les settings.

**Après refactoring :** `LANGUAGES`, `CURRENCIES`, types → `packages/shared/types/`. Les traductions restent frontend. `formatCurrency` peut aller dans shared utils.

**Impact refactoring : TRÈS FAIBLE**

---

### `src/lib/utils.ts` — 38 lignes

**Responsabilité :** Utilitaires purs (classes CSS, UUID, hash mot de passe).

- `cn()` — Tailwind class merge (clsx + tailwind-merge)
- `generateUUID()` — UUID v4 avec polyfill pour HTTP (non-HTTPS)
- `hashPassword()` / `verifyPassword()` — SHA-256 via `crypto.subtle` (browser API)
- `isPasswordHashed()` — regex `/^[a-f0-9]{64}$/`

**Point d'attention :**
- `hashPassword()` utilise `crypto.subtle` (browser-only). Le backend Fastify aura besoin d'une version Node.js identique via `node:crypto` (`createHash('sha256')`).

**Impact refactoring : NUL** — pur utilitaire frontend.

---

---

### `package.json` — 152 lignes

**Responsabilité actuelle :** Manifeste npm — dépendances, scripts, config electron-builder.

**Dépendances notables :**

| Package | Version | Observation |
|---|---|---|
| `idb` | ^8.0.0 | IndexedDB wrapper — **le problème principal** |
| `sql.js` | ^1.13.0 | SQLite en WebAssembly (navigateur) — présent mais ce n'est **pas** `better-sqlite3` |
| `escpos` | ^3.0.0-alpha.6 | Alpha, USB printing TS — probablement vestige avant PrintDaemon |
| `escpos-usb` | ^3.0.0-alpha.4 | Même vestige |
| `@tanstack/react-query` | ^5.83.0 | Présent — utile pour la couche services frontend Phase 1 |
| `electron` | ^40.0.0 | Très récent |
| `zod` | ^3.25.76 | Validation — utile pour valider les routes Fastify |

**Problèmes identifiés :**

1. **`better-sqlite3` absent** — la cible de Phase 2 n'est pas encore installée (normal, mais à noter).
2. **`sql.js` présent mais non utilisé** (`better-sqlite3` doit remplacer `sql.js`, pas l'inverse) — à supprimer en Phase 2.
3. **`escpos` + `escpos-usb` alpha** — packages alpha dans les dépendances de production. Vestiges probables d'une approche USB abandonnée au profit du PrintDaemon. À supprimer quand confirmé.
4. **Fastify absent** — logique (Phase 1 pas encore faite).

**electron-builder extraResources :**
```json
"from": "PrintDaemon/bin/Release/net8.0/win-x64/publish/PrintDaemon.exe"
```
Le PrintDaemon.exe est inclus dans le paquet installateur. ✅ Correct, ne pas toucher.

**Impact refactoring :**
- Phase 1 : ajouter `fastify`, `@fastify/cors`, `@fastify/websocket`, `better-sqlite3`
- Phase 2 : supprimer `idb`, `sql.js`, `escpos`, `escpos-usb`

---

### `vite.config.ts` — 91 lignes

**Responsabilité actuelle :** Config Vite + intégration Electron (plugin).

**Points clés :**

| Point | Détail |
|---|---|
| Alias `@` | `./src` — `@/lib/database` fonctionne grâce à ça |
| Entry Electron | `electron/main.ts` + `electron/preload.ts` |
| `__APP_VERSION__` | Injecté depuis `package.json` au build |
| Dev server | `0.0.0.0:5173` |
| Base | `'./'` — chemins relatifs pour Electron (file://) |

**Problèmes identifiés :**

1. **Hack `preload.cjs`** (lignes 41–53) — copie manuelle de `electron/preload.cjs` vers `dist-electron/` à chaque reload. Conséquence de la coexistence CJS/ESM dans le preload. Fonctionnel mais fragile.
2. **Alias `@shared/*` absent** — quand `packages/shared/types/` sera créé en Phase 1, il faudra ajouter l'alias `'@shared': path.resolve(__dirname, './packages/shared')` ici.
3. **Pas de port 3001** — aucune config proxy vers Fastify. En dev, le frontend devra pointer vers `http://localhost:3001` directement (via `src/services/api.ts`).

**Impact refactoring :**
- Phase 1 : ajouter l'alias `@shared/*`
- Aucun autre changement nécessaire sur vite.config.ts

---

### `tsconfig.json` — 20 lignes

**Responsabilité actuelle :** Racine du projet TypeScript — références vers 3 configs spécialisées.

**Config globale (s'applique à tout le projet) :**

| Option | Valeur | Problème |
|---|---|---|
| `noImplicitAny` | `false` | TS non strict — explique tous les `any` vus |
| `strictNullChecks` | `false` | Null/undefined non vérifiés — source de bugs potentiels |
| `noUnusedLocals` | `false` | Variables inutilisées non signalées |
| `noUnusedParameters` | `false` | Paramètres inutilisés non signalés |
| `allowJs` | `true` | Fichiers `.js` acceptés |
| `skipLibCheck` | `true` | Types des libs non vérifiés |

**Problèmes identifiés :**

1. **TypeScript non strict** — `noImplicitAny: false` + `strictNullChecks: false` expliquent toute la dette de typage observée (`error: any`, objets partiels, etc.). C'est cohérent avec ce qu'on a vu dans le code.
2. **`allowJs: true`** — le `preload.cjs` est inclus. Pratique mais à surveiller.
3. **Pas de référence à `server/`** — le futur backend Fastify aura besoin de son propre `tsconfig.server.json`.

**Impact refactoring :**
- Phase 1 : créer `tsconfig.server.json` pour `server/`
- Ne pas activer `strict: true` globalement maintenant — trop brutal. Activer progressivement fichier par fichier.

---

### `tsconfig.electron.json` — 17 lignes

**Responsabilité actuelle :** Config TypeScript pour le Main Process Electron (`electron/**/*`).

**Options :**

| Option | Valeur |
|---|---|
| `target` | ES2020 |
| `module` | ESNext |
| `strict` | `false` |
| `outDir` | `./dist-electron` |
| `rootDir` | `./electron` |
| `types` | `["node", "electron"]` |

**Problèmes identifiés :**

1. **`strict: false`** — cohérent avec la config globale, mais le Main Process est justement là où on voudra du TypeScript solide (gestion des IPC, chemins fichiers).
2. **`rootDir: './electron'`** — le Main Process est bien isolé. ✅
3. **`module: ESNext`** mais Electron utilise CommonJS en pratique (d'où le hack `preload.cjs`). C'est géré par le bundler Vite + rollup.

**Impact refactoring :** Aucun changement immédiat nécessaire.

---

*Dernière mise à jour : analyse complète des 36 fichiers — Phase 0 terminée*

---

## Phase 1 — Séparation Frontend / Backend

---

### Étape 1.1 — Extraire les types partagés

**Objectif :** Déplacer toutes les interfaces/types de `src/lib/database.ts` (lignes 1–336) vers `packages/shared/types/`. Ne pas toucher à `getDB()` ni au schéma IndexedDB (Phase 2).

#### Structure cible

```
packages/shared/types/
├── product.ts      ← Category, ProductVariant, ModifierOption, ModifierGroup, Product
├── order.ts        ← OrderLine, OrderModifier, Order, Promotion
├── settings.ts     ← PrinterConfig, ReceiptCustomization, Settings, NumberingConfig
│                      + defaultReceiptCustomization (constante, actuellement définie 3×)
├── auth.ts         ← User, UserSession
├── inventory.ts    ← Supplier, InventoryItem, Invoice, InvoiceItem
├── print.ts        ← PrintJob
└── index.ts        ← re-export de tout
```

#### Étapes dans l'ordre

| # | Action | Fichiers |
|---|---|---|
| 1 | Créer `packages/shared/types/` avec les 7 fichiers | `product.ts`, `order.ts`, `settings.ts`, `auth.ts`, `inventory.ts`, `print.ts`, `index.ts` |
| 2 | Ajouter alias `@shared/*` | `vite.config.ts` |
| 3 | Ajouter alias `@shared/*` | `tsconfig.json` |
| 4 | Remplacer les imports de types dans database.ts | `src/lib/database.ts` |
| 5 | Mettre à jour les imports dans tous les fichiers | `POSContext.tsx`, `AuthContext.tsx`, `printer.ts`, `receipt-renderer.tsx`, + ~10 composants |
| 6 | Vérifier compilation sans erreur | — |

#### Ce qui NE change PAS
- `getDB()` et le schéma IndexedDB → restent dans `src/lib/database.ts`
- Toute logique métier → inchangée
- Les composants → leurs imports sont mis à jour mais le code ne change pas

#### Résultat
| Fichier/Action | Statut |
|---|---|
| `packages/shared/types/product.ts` | ✅ Créé |
| `packages/shared/types/order.ts` | ✅ Créé |
| `packages/shared/types/settings.ts` + `defaultReceiptCustomization` | ✅ Créé |
| `packages/shared/types/auth.ts` | ✅ Créé |
| `packages/shared/types/inventory.ts` | ✅ Créé |
| `packages/shared/types/print.ts` | ✅ Créé |
| `packages/shared/types/index.ts` | ✅ Créé |
| Alias `@shared/*` dans `vite.config.ts` | ✅ Ajouté |
| Alias `@shared/*` dans `tsconfig.json` | ✅ Ajouté |
| Alias `@shared/*` dans `tsconfig.app.json` | ✅ Ajouté |
| `database.ts` → import + re-export depuis `@shared/types` | ✅ Mis à jour |
| `printer.ts` → `getDefaultCustomization()` → constante partagée | ✅ Mis à jour |
| `defaultReceiptCustomization` : 3 copies → 1 seule source de vérité | ✅ Éliminées |
| `tsc --noEmit` | ✅ 0 erreur |
| 22 fichiers existants (imports `@/lib/database`) | ✅ Inchangés |

#### Statut
- [x] Étape 1.1 — Extraire les types partagés ✅
- [x] Étape 1.2 — Créer le serveur Fastify ✅
- [x] Étape 1.3 — Créer la couche services frontend ✅
- [ ] Étape 1.4 — Éclater POSContext
- [ ] Étape 1.5 — Déplacer la logique métier vers server/services

### Étape 1.2 — Créer le serveur Fastify

**Fichiers créés :**

| Fichier | Rôle |
|---|---|
| `server/src/index.ts` | Entry point Fastify (port 3001) + `startServer()` / `stopServer()` |
| `server/src/routes/orders.ts` | GET/POST/PATCH/DELETE `/api/orders` |
| `server/src/routes/products.ts` | GET/POST/PATCH/DELETE `/api/products` + variants + modifiers |
| `server/src/routes/categories.ts` | GET/POST/PATCH/DELETE `/api/categories` |
| `server/src/routes/settings.ts` | GET/PATCH `/api/settings` + printers |
| `server/src/routes/print.ts` | POST `/api/print/receipt\|kitchen\|drawer` |
| `server/src/services/orderService.ts` | Stub — sera SQLite en Phase 2 |
| `server/src/services/productService.ts` | Stub — sera SQLite en Phase 2 |
| `server/src/services/settingsService.ts` | Stub — sera SQLite en Phase 2 |
| `server/src/services/printService.ts` | Stub — délègue au PrintDaemon C# |
| `tsconfig.server.json` | TypeScript config pour server/ |

**Fichiers modifiés :**

| Fichier | Changement |
|---|---|
| `tsconfig.electron.json` | Supprimé `rootDir`, ajouté `server/` dans `include`, alias `@shared/*` |
| `electron/main.ts` | Import + appel `startServer(3001)` au démarrage, `stopServer()` au quit |

**Résultat :**
- `tsc --noEmit` ✅ 0 erreur (tsconfig global)
- `tsc -p tsconfig.server.json --noEmit` ✅ 0 erreur

*Dernière mise à jour : Étape 1.2 terminée — serveur Fastify créé*
