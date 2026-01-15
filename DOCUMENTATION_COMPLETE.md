# 📚 Documentation Complète - Quick Order Hub Desktop

## Table des Matières

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture](#architecture)
3. [Installation](#installation)
4. [Configuration Initiale](#configuration-initiale)
5. [Guide d'Utilisation](#guide-dutilisation)
6. [Fonctionnalités Détaillées](#fonctionnalités-détaillées)
7. [Gestion des Données](#gestion-des-données)
8. [Configuration des Imprimantes](#configuration-des-imprimantes)
9. [Sauvegarde et Restauration](#sauvegarde-et-restauration)
10. [Dépannage](#dépannage)
11. [Développement](#développement)

---

## Vue d'ensemble

**Quick Order Hub Desktop** est une application de Point de Vente (POS) complète pour restaurants, développée avec Electron, React et TypeScript. Elle permet de gérer les commandes, les produits, les utilisateurs, l'inventaire et l'impression de tickets.

### Caractéristiques Principales

- ✅ **Gestion complète des commandes** (sur place, à emporter)
- ✅ **Gestion des produits et catégories**
- ✅ **Système d'utilisateurs avec rôles** (Admin, Chef, Caissier)
- ✅ **Impression directe** via TCP/IP (imprimantes thermiques et classiques)
- ✅ **Gestion d'inventaire** (marchandises, fournisseurs, factures)
- ✅ **Rapports et statistiques**
- ✅ **Personnalisation des tickets** (reçu client et ticket cuisine)
- ✅ **Sauvegarde/Restauration** des données
- ✅ **Export/Import de templates** de produits
- ✅ **Multi-langue** (Français/Anglais)
- ✅ **Clavier virtuel** (QWERTY/AZERTY)

---

## Architecture

### Schéma Général

```
┌─────────────────────────────────────────────────────────────┐
│                    QUICK ORDER HUB DESKTOP                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐         ┌──────────────────┐        │
│  │   MAIN PROCESS   │◄────────┤  RENDERER PROCESS │        │
│  │   (Electron)     │  IPC    │   (React App)    │        │
│  └──────────────────┘         └──────────────────┘        │
│         │                              │                   │
│         │                              │                   │
│         ▼                              ▼                   │
│  ┌──────────────┐              ┌──────────────┐           │
│  │ File System  │              │  IndexedDB   │           │
│  │  (Backups)   │              │  (Local DB)  │           │
│  └──────────────┘              └──────────────┘           │
│         │                              │                   │
│         └──────────┬───────────────────┘                   │
│                    ▼                                      │
│            ┌──────────────┐                               │
│            │   Network    │                               │
│            │  (Printers)  │                               │
│            └──────────────┘                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Architecture Technique

```
┌─────────────────────────────────────────────────────────────┐
│                        STACK TECHNIQUE                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Frontend:                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   React     │  │ TypeScript  │  │   Vite     │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                             │
│  Backend (Electron):                                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Node.js    │  │   IPC       │  │ File System │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                             │
│  Base de Données:                                           │
│  ┌─────────────┐                                            │
│  │ IndexedDB   │  (Stockage local côté navigateur)         │
│  └─────────────┘                                            │
│                                                             │
│  Impression:                                                │
│  ┌─────────────┐  ┌─────────────┐                         │
│  │  TCP/IP     │  │  ESC/POS    │                         │
│  └─────────────┘  └─────────────┘                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Flux de Données

```
┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
│  User    │─────▶│  React   │─────▶│ Context  │─────▶│ IndexedDB│
│ Interface│      │ Component│      │  (State) │      │  (Data)  │
└──────────┘      └──────────┘      └──────────┘      └──────────┘
     │                  │                  │                  │
     │                  │                  │                  │
     ▼                  ▼                  ▼                  ▼
┌──────────────────────────────────────────────────────────────┐
│                    ELECTRON MAIN PROCESS                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   IPC        │  │ File System  │  │   Network    │       │
│  │  (Bridge)    │  │  (Backups)   │  │  (Printers)  │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└──────────────────────────────────────────────────────────────┘
```

### Structure des Fichiers

```
quick-order-hub-desktop/
├── electron/                    # Processus principal Electron
│   ├── main.ts                 # Point d'entrée Electron
│   ├── preload.ts              # Preload script (ESM)
│   └── preload.cjs             # Preload script (CommonJS)
│
├── src/                         # Code source React
│   ├── components/             # Composants React
│   │   ├── pos/               # Composants POS
│   │   └── ui/                # Composants UI génériques
│   ├── contexts/              # Contextes React
│   │   ├── AuthContext.tsx    # Authentification
│   │   └── POSContext.tsx     # État global POS
│   ├── lib/                    # Bibliothèques utilitaires
│   │   ├── database.ts        # Gestion IndexedDB
│   │   ├── printer.ts         # Gestion impression
│   │   └── i18n.ts            # Internationalisation
│   └── pages/                  # Pages de l'application
│
├── dist/                        # Build React (production)
├── dist-electron/               # Build Electron (production)
├── release/                     # Installateurs générés
│   └── Quick Order Hub Setup X.X.X.exe
│
└── package.json                 # Configuration projet
```

---

## Installation

### Prérequis

- **Windows 10/11** (64-bit)
- **Espace disque** : ~500 MB pour l'installation
- **Réseau** : Pour l'impression réseau (optionnel)

### Installation Standard

1. **Télécharger l'installateur**
   - Fichier : `Quick Order Hub Setup X.X.X.exe`
   - Taille : ~100-150 MB

2. **Exécuter l'installateur**
   - Double-cliquer sur le fichier `.exe`
   - Suivre l'assistant d'installation
   - Choisir le dossier d'installation (par défaut : `C:\Program Files\Quick Order Hub`)

3. **Lancer l'application**
   - Raccourci créé sur le Bureau
   - Ou via le menu Démarrer : "Quick Order Hub"

### Installation Silencieuse (Optionnel)

```powershell
Quick Order Hub Setup X.X.X.exe /S /D=C:\Program Files\Quick Order Hub
```

---

## Configuration Initiale

### Premier Lancement

Lors du premier lancement, l'application est **vierge** (aucun produit, aucune catégorie).

#### 1. Connexion

Utilisateurs par défaut :

| Rôle | Nom d'utilisateur | Mot de passe | Permissions |
|------|-------------------|-------------|-------------|
| **Admin** | `admin` | `admin123` | Accès complet |
| **Chef** | `chef` | `chef123` | Gestion produits, commandes, inventaire |
| **Caissier** | `caissier` | `caissier123` | Prise de commandes uniquement |

⚠️ **Important** : Changez les mots de passe après la première connexion !

#### 2. Configuration de Base

**Paramètres Généraux** (Paramètres > Paramètres généraux) :

```
┌─────────────────────────────────────────┐
│     CONFIGURATION INITIALE              │
├─────────────────────────────────────────┤
│                                         │
│  Nom du Restaurant: [____________]    │
│  Adresse: [______________________]     │
│  Téléphone: [____________________]     │
│                                         │
│  Devise: [EUR ▼]                       │
│  Langue: [Français ▼]                  │
│                                         │
│  Numérotation des commandes:             │
│  ○ Quotidienne (YYYYMMDD-###)          │
│  ○ Continue (###)                      │
│  ○ Avec préfixe (PREFIX-###)            │
│                                         │
│  [Enregistrer]                          │
│                                         │
└─────────────────────────────────────────┘
```

#### 3. Ajout de Produits

**Option A : Import de Template**
1. Aller dans **Paramètres > Template des Produits**
2. Cliquer sur **"Importer"**
3. Sélectionner un fichier JSON de template
4. Les produits, catégories et variantes sont importés automatiquement

**Option B : Création Manuelle**
1. Aller dans **Articles > Gérer les Articles**
2. Créer des catégories (ex: "Tacos", "Boissons", "Desserts")
3. Ajouter des produits dans chaque catégorie
4. Configurer les variantes (tailles, options)

---

## Guide d'Utilisation

### Écran Principal

```
┌─────────────────────────────────────────────────────────────┐
│  [Logo] Quick Order Hub          [Nom Restaurant] [User]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ COMMANDES│  │  RAPPORTS│  │ ARTICLES │  │ PARAMÈTRES│   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              CATÉGORIES                             │   │
│  │  [Tacos] [Boissons] [Desserts] [Suppléments]       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              PRODUITS                               │   │
│  │  ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐           │   │
│  │  │Taco│  │Taco│  │Taco│  │Coca│  │Eau │           │   │
│  │  │ XL │  │ L  │  │ M  │  │Cola│  │    │           │   │
│  │  └────┘  └────┘  └────┘  └────┘  └────┘           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              PANIER                                 │   │
│  │  Taco XL x2                   12.00€               │   │
│  │  Coca Cola x1                  2.50€                │   │
│  │  ─────────────────────────────────────              │   │
│  │  TOTAL:                         14.50€              │   │
│  │  [Type] [Payer]                                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Prise de Commande

#### Étape 1 : Sélectionner le Type de Commande

```
┌─────────────────────────────┐
│   Type de Commande          │
├─────────────────────────────┤
│                             │
│  ┌─────────────────────┐   │
│  │   SUR PLACE         │   │
│  └─────────────────────┘   │
│                             │
│  ┌─────────────────────┐   │
│  │   À EMPORTER        │   │
│  └─────────────────────┘   │
│                             │
└─────────────────────────────┘
```

#### Étape 2 : Ajouter des Produits

1. Cliquer sur une **catégorie** (ex: "Tacos")
2. Cliquer sur un **produit** (ex: "Taco XL")
3. Sélectionner les **variantes** (taille, options)
4. Ajouter des **modificateurs** (suppléments)
5. Ajouter une **note** si nécessaire
6. Cliquer sur **"Ajouter au panier"**

#### Étape 3 : Paiement

1. Vérifier le **panier**
2. Cliquer sur **"Payer"**
3. Choisir le **mode de paiement** :
   - Espèces
   - Carte bancaire
4. Si espèces, entrer le **montant reçu**
5. Cliquer sur **"Valider"**

**Résultat** :
- ✅ Commande enregistrée
- ✅ Ticket client imprimé automatiquement
- ✅ Ticket cuisine imprimé automatiquement (si configuré)

### Gestion des Commandes

**Accès** : Menu > Commandes

```
┌─────────────────────────────────────────────────────────────┐
│  COMMANDES                                    [Filtres ▼]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ #001 - 15/01/2025 14:30 - SUR PLACE - 25.50€       │   │
│  │ [Voir] [Tickets] [Supprimer]                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ #002 - 15/01/2025 14:45 - À EMPORTER - 18.00€      │   │
│  │ [Voir] [Tickets] [Supprimer]                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Actions (Admin/Chef uniquement):                          │
│  [Sélectionner tout] [Supprimer sélection] [Tout supprimer]│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Fonctionnalités** :
- **Filtrer** par date, type, statut
- **Voir les détails** d'une commande
- **Imprimer les tickets** (client/cuisine)
- **Télécharger en PDF**
- **Supprimer** des commandes (Admin/Chef uniquement)

---

## Fonctionnalités Détaillées

### 1. Gestion des Produits

#### Structure des Produits

```
PRODUIT
├── Nom
├── Catégorie
├── Prix de base
├── Variantes
│   ├── Taille (L, XL, XXL)
│   └── Type (Simple, Double, Cheddar)
├── Modificateurs
│   ├── Suppléments (fromage, oignons, etc.)
│   └── Options (sauce, boisson incluse)
└── Image (optionnel)
```

#### Création d'un Produit

1. **Articles > Gérer les Articles**
2. Cliquer sur **"Ajouter un produit"**
3. Remplir le formulaire :
   ```
   Nom: Taco XL
   Catégorie: Tacos
   Prix: 6.00€
   Variantes: [L] [XL] [XXL]
   Modificateurs: [Fromage] [Oignons] [Sauce]
   ```
4. **Enregistrer**

### 2. Gestion des Utilisateurs

**Accès** : Paramètres > Utilisateurs (Admin uniquement)

```
┌─────────────────────────────────────────┐
│  UTILISATEURS                           │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Admin - admin                   │   │
│  │ [Modifier] [Supprimer]          │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Chef - chef                      │   │
│  │ [Modifier] [Supprimer]           │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [Ajouter un utilisateur]              │
│                                         │
└─────────────────────────────────────────┘
```

#### Modification d'un Utilisateur

1. Cliquer sur l'icône **"Modifier"** (crayon) à côté de l'utilisateur
2. Modifier les informations souhaitées :
   - **Nom** : Modifiable
   - **Nom d'utilisateur** : Non modifiable (sécurité)
   - **Rôle** : Modifiable
   - **Mot de passe** : Optionnel

#### Modification du Mot de Passe

**Pour modifier le mot de passe d'un utilisateur** (y compris admin) :

1. Ouvrir **Paramètres > Utilisateurs**
2. Cliquer sur **"Modifier"** à côté de l'utilisateur
3. Dans le champ **"Nouveau mot de passe"** :
   - **Laisser vide** = Conserver le mot de passe actuel
   - **Entrer un nouveau mot de passe** = Changer le mot de passe
4. Si vous entrez un nouveau mot de passe :
   - Un champ **"Confirmer le mot de passe"** apparaît
   - Les deux mots de passe doivent correspondre
   - Le mot de passe doit contenir au moins 4 caractères
5. Cliquer sur **"Enregistrer"**

**Exemple de modification du mot de passe admin** :

```
┌─────────────────────────────────────────┐
│  Modifier l'utilisateur                │
├─────────────────────────────────────────┤
│                                         │
│  Nom: [Administrateur]                  │
│                                         │
│  Nom d'utilisateur: [admin]            │
│  (non modifiable)                       │
│                                         │
│  Nouveau mot de passe: [________]       │
│  Laisser vide pour conserver l'actuel   │
│                                         │
│  Confirmer le mot de passe: [________]  │
│  (apparaît si nouveau mot de passe)    │
│                                         │
│  Rôle: [Administrateur ▼]              │
│                                         │
│  [Annuler] [Enregistrer]                │
│                                         │
└─────────────────────────────────────────┘
```

**⚠️ Important** :
- Vous ne pouvez pas modifier votre propre compte (protection)
- Le nom d'utilisateur ne peut jamais être modifié
- Si vous oubliez le mot de passe admin, vous devrez réinitialiser la base de données

**Rôles et Permissions** :

| Rôle | Commandes | Produits | Utilisateurs | Paramètres | Inventaire | Rapports |
|------|-----------|----------|--------------|------------|------------|----------|
| **Admin** | ✅ Tous | ✅ Tous | ✅ Tous | ✅ Tous | ✅ Tous | ✅ Tous |
| **Chef** | ✅ Voir/Modifier | ✅ Tous | ❌ | ✅ Partiel | ✅ Tous | ✅ Voir |
| **Caissier** | ✅ Créer | ❌ | ❌ | ❌ | ❌ | ❌ |

### 3. Gestion d'Inventaire

**Accès** : Paramètres > Inventaire (Admin/Chef)

#### Fonctionnalités

1. **Marchandises**
   - Ajouter des articles en stock
   - Suivi des quantités
   - Catégorisation (nourriture, boissons, etc.)

2. **Fournisseurs**
   - Gérer la liste des fournisseurs
   - Coordonnées et informations

3. **Factures**
   - Enregistrer les factures fournisseurs
   - Prix et dates
   - Lien avec les fournisseurs

4. **Rapports**
   - Bilan par période
   - Statistiques d'achats
   - Export des données

### 4. Rapports et Statistiques

**Accès** : Menu > Rapports

**Types de Rapports** :

1. **Ventes**
   - Chiffre d'affaires par jour/semaine/mois
   - Graphiques d'évolution
   - Top produits

2. **Commandes**
   - Nombre de commandes
   - Répartition sur place/à emporter
   - Moyenne par commande

3. **Inventaire**
   - Stock actuel
   - Mouvements de stock
   - Alertes de réapprovisionnement

---

## Gestion des Données

### Emplacement des Données

Les données sont stockées localement sur chaque machine :

**Windows** :
```
C:\Users\[USERNAME]\AppData\Roaming\Quick Order Hub\
├── IndexedDB\
│   └── FastFoodPOS.indexeddb.leveldb\
└── Local Storage\
```

**Accès via l'application** :
- Paramètres > Emplacement des Données
- Cliquer sur "Afficher l'emplacement des données"

### Structure de la Base de Données

```
IndexedDB: FastFoodPOS
│
├── categories          # Catégories de produits
├── products           # Produits
├── productVariants    # Variantes de produits
├── modifierGroups    # Groupes de modificateurs
├── modifierOptions   # Options de modificateurs
├── orders            # Commandes
├── users             # Utilisateurs
├── settings          # Paramètres
├── printers          # Configuration imprimantes
├── inventoryItems    # Articles d'inventaire
├── suppliers         # Fournisseurs
└── invoices          # Factures
```

### Sauvegarde et Restauration

#### Sauvegarde

1. **Paramètres > Sauvegarde et Restauration**
2. Cliquer sur **"Exporter la sauvegarde"**
3. Choisir l'emplacement de sauvegarde
4. Le fichier JSON contient toutes les données

**Contenu de la sauvegarde** :
- ✅ Toutes les commandes
- ✅ Tous les produits et catégories
- ✅ Tous les utilisateurs
- ✅ Tous les paramètres
- ✅ Configuration des imprimantes
- ✅ Données d'inventaire

#### Restauration

1. **Paramètres > Sauvegarde et Restauration**
2. Cliquer sur **"Importer la sauvegarde"**
3. Sélectionner le fichier JSON de sauvegarde
4. Confirmer l'importation
5. ⚠️ **Attention** : Les données existantes seront remplacées !

### Export/Import de Templates de Produits

#### Export

1. **Paramètres > Template des Produits**
2. Cliquer sur **"Exporter"**
3. Sauvegarder le fichier JSON

**Contenu du template** :
- Catégories
- Produits
- Variantes
- Modificateurs

#### Import

1. **Paramètres > Template des Produits**
2. Cliquer sur **"Importer"**
3. Sélectionner le fichier JSON
4. Les produits sont ajoutés (sans supprimer les existants)

---

## Configuration des Imprimantes

### Types d'Imprimantes Supportées

1. **Imprimante Thermique ESC/POS** (recommandée)
   - Format : 80mm
   - Protocole : ESC/POS
   - Connexion : TCP/IP (port 9100)

2. **Imprimante Classique** (inkjet/laser)
   - Format : A4
   - Protocole : Plain text
   - Connexion : TCP/IP (port 9100)

### Configuration

**Accès** : Paramètres > Imprimantes

#### Configuration Imprimante Caissier

```
┌─────────────────────────────────────────┐
│  IMPRIMANTE CAISSIER                   │
├─────────────────────────────────────────┤
│                                         │
│  Type: [Thermique ESC/POS ▼]           │
│                                         │
│  Adresse IP: [192.168.1.100]           │
│  Port: [9100]                           │
│                                         │
│  [Tester la connexion]                 │
│                                         │
│  [Enregistrer]                         │
│                                         │
└─────────────────────────────────────────┘
```

#### Configuration Imprimante Cuisine

```
┌─────────────────────────────────────────┐
│  IMPRIMANTE CUISINE                     │
├─────────────────────────────────────────┤
│                                         │
│  Type: [Thermique ESC/POS ▼]           │
│                                         │
│  Adresse IP: [192.168.1.101]           │
│  Port: [9100]                           │
│                                         │
│  [Tester la connexion]                 │
│                                         │
│  [Enregistrer]                         │
│                                         │
└─────────────────────────────────────────┘
```

### Test de Connexion

1. Configurer l'adresse IP et le port
2. Cliquer sur **"Tester la connexion"**
3. Si succès : ✅ "Connexion réussie"
4. Si échec : ❌ Vérifier :
   - L'adresse IP est correcte
   - Le port est ouvert (9100)
   - L'imprimante est allumée
   - Le pare-feu autorise la connexion

### Schéma de Connexion

```
┌─────────────────┐         TCP/IP          ┌─────────────────┐
│  Quick Order    │◄───────────────────────►│   Imprimante    │
│     Hub         │    Port 9100            │   Thermique     │
│  (PC Windows)   │                         │  (192.168.1.x) │
└─────────────────┘                         └─────────────────┘
```

### Personnalisation des Tickets

**Accès** : Paramètres > Personnalisation des Tickets

#### Options Disponibles

1. **En-tête**
   - Nom du restaurant
   - Adresse
   - Téléphone
   - Logo (optionnel)

2. **Format**
   - Police (monospace, sans-serif, serif)
   - Taille (petite, normale, grande)
   - Espacement

3. **Contenu Ticket Client**
   - Afficher les prix
   - Afficher les détails des modificateurs
   - Format de date/heure

4. **Contenu Ticket Cuisine**
   - Afficher les prix (optionnel)
   - Notes spéciales
   - Format simplifié

---

## Sauvegarde et Restauration

### Sauvegarde Manuelle

**Procédure** :

1. Ouvrir **Paramètres > Sauvegarde et Restauration**
2. Cliquer sur **"Exporter la sauvegarde"**
3. Choisir l'emplacement (ex: Bureau, clé USB)
4. Nommer le fichier (ex: `sauvegarde_2025-01-15.json`)
5. Cliquer sur **"Enregistrer"**

**Fréquence recommandée** : Quotidienne ou après chaque modification importante

### Restauration

**Procédure** :

1. Ouvrir **Paramètres > Sauvegarde et Restauration**
2. Cliquer sur **"Importer la sauvegarde"**
3. Sélectionner le fichier JSON de sauvegarde
4. Confirmer l'importation
5. ⚠️ **Attention** : Toutes les données actuelles seront remplacées !

### Sauvegarde Automatique

L'application sauvegarde automatiquement les données dans IndexedDB. Cependant, pour une sécurité maximale, effectuez des sauvegardes manuelles régulières.

---

## Dépannage

### Problèmes Courants

#### 1. Erreur 404 au Lancement

**Symptôme** : Page blanche avec "404 - Page not found"

**Solutions** :
- Vérifier que l'application est bien installée
- Réinstaller l'application
- Vérifier les logs dans la console (F12 si DevTools disponibles)

#### 2. L'Imprimante ne Fonctionne Pas

**Symptômes** :
- Aucun ticket imprimé
- Erreur de connexion

**Solutions** :
1. Vérifier l'adresse IP de l'imprimante
   ```
   Ping 192.168.1.100
   ```
2. Vérifier le port (9100 par défaut)
3. Tester la connexion depuis Paramètres > Imprimantes
4. Vérifier le pare-feu Windows
5. Vérifier que l'imprimante est allumée et connectée au réseau

#### 3. Les Données ont Disparu

**Causes possibles** :
- Réinitialisation de la base de données
- Suppression accidentelle
- Corruption des données

**Solutions** :
1. Vérifier s'il existe une sauvegarde
2. Restaurer depuis une sauvegarde
3. Si aucune sauvegarde : les données sont perdues

#### 4. L'Application est Lente

**Solutions** :
- Fermer d'autres applications
- Vérifier l'espace disque disponible
- Redémarrer l'application
- Vérifier le nombre de commandes (trop de données peuvent ralentir)

#### 5. Erreur "electronAPI is undefined"

**Symptôme** : Certaines fonctionnalités ne fonctionnent pas (sauvegarde, impression)

**Solutions** :
- Redémarrer l'application
- Réinstaller l'application
- Vérifier que vous utilisez la version desktop (pas la version web)

### Logs et Debug

**Accès aux logs** :
- En développement : Console du terminal
- En production : Logs système Windows

**Emplacement des logs système** :
```
C:\Users\[USERNAME]\AppData\Roaming\Quick Order Hub\logs\
```

---

## Développement

### Prérequis

- **Node.js** : v18 ou supérieur
- **npm** : v9 ou supérieur
- **Git** (optionnel)

### Installation pour Développement

```bash
# Cloner le projet (si disponible)
git clone [repository-url]
cd quick-order-hub-desktop

# Installer les dépendances
npm install

# Lancer en mode développement
npm run electron:dev
```

### Structure du Code

```
src/
├── components/
│   ├── pos/              # Composants métier POS
│   │   ├── OrderScreen.tsx
│   │   ├── ProductsManagement.tsx
│   │   └── SettingsScreen.tsx
│   └── ui/               # Composants UI réutilisables
│       ├── button.tsx
│       └── dialog.tsx
│
├── contexts/             # Contextes React
│   ├── AuthContext.tsx   # Gestion authentification
│   └── POSContext.tsx    # État global POS
│
├── lib/                  # Utilitaires
│   ├── database.ts       # IndexedDB
│   ├── printer.ts        # Impression
│   └── i18n.ts           # Traductions
│
└── pages/                # Pages de routage
    ├── Index.tsx
    └── NotFound.tsx
```

### Build de Production

```bash
# Build complet
npm run electron:build

# Le fichier d'installation sera dans :
# release/Quick Order Hub Setup X.X.X.exe
```

### Scripts Disponibles

| Script | Description |
|--------|-------------|
| `npm run dev` | Lancer Vite en mode dev |
| `npm run build` | Build React uniquement |
| `npm run electron:dev` | Lancer Electron en mode dev |
| `npm run electron:build` | Build complet (React + Electron) |
| `npm run lint` | Vérifier le code avec ESLint |

### Technologies Utilisées

- **Electron** : v33.2.1
- **React** : v18.3.1
- **TypeScript** : v5.8.3
- **Vite** : v5.4.19
- **IndexedDB** : Via `idb` (v8.0.0)
- **React Router** : v6.30.1 (HashRouter)
- **Tailwind CSS** : v3.4.17

---

## FAQ (Foire Aux Questions)

### Q: Puis-je utiliser l'application sur plusieurs ordinateurs ?

**R:** Oui, mais chaque installation a ses propres données. Pour synchroniser :
1. Exporter la sauvegarde sur le premier PC
2. Importer la sauvegarde sur le deuxième PC

### Q: Les données sont-elles stockées dans le cloud ?

**R:** Non, toutes les données sont stockées localement sur chaque machine. Aucune donnée n'est envoyée sur Internet.

### Q: Puis-je personnaliser les tickets ?

**R:** Oui, allez dans Paramètres > Personnalisation des Tickets. Vous pouvez modifier :
- Le format (police, taille)
- Le contenu (en-tête, pied de page)
- Les informations affichées

### Q: Comment mettre à jour l'application ?

**R:** Pour l'instant, téléchargez et installez la nouvelle version. Les données existantes seront préservées.

### Q: L'application fonctionne-t-elle hors ligne ?

**R:** Oui, l'application fonctionne entièrement hors ligne. Seule l'impression réseau nécessite une connexion au réseau local.

### Q: Puis-je exporter mes données en Excel/CSV ?

**R:** Actuellement, l'export se fait en JSON. Pour Excel/CSV, utilisez les rapports qui peuvent être copiés/collés dans Excel.

---

## Support et Contact

### Problèmes Techniques

En cas de problème :
1. Consulter la section [Dépannage](#dépannage)
2. Vérifier les logs de l'application
3. Contacter le support technique

### Mises à Jour

Les mises à jour seront disponibles via :
- Téléchargement de la nouvelle version
- Installation par-dessus l'ancienne version (les données sont préservées)

---

## Changelog

### Version 1.0.0 (Initial Release)

- ✅ Gestion complète des commandes
- ✅ Gestion des produits et catégories
- ✅ Système d'utilisateurs avec rôles
- ✅ Impression directe TCP/IP
- ✅ Gestion d'inventaire
- ✅ Rapports et statistiques
- ✅ Sauvegarde/Restauration
- ✅ Export/Import de templates
- ✅ Multi-langue (FR/EN)
- ✅ Clavier virtuel (QWERTY/AZERTY)

---

## Licence

[À compléter selon votre licence]

---

**Documentation générée le** : 2025-01-15  
**Version de l'application** : 1.0.0  
**Dernière mise à jour** : 2025-01-15
