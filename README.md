# Quick Order Hub Desktop

Application de Point de Vente (POS) complète pour restaurants, développée avec Electron, React et TypeScript.

## Fonctionnalités

- **Gestion complète des commandes** (sur place, à emporter, livraison)
- **Gestion des produits et catégories** avec variantes et modificateurs
- **Système d'utilisateurs avec rôles** (Admin, Chef, Caissier)
- **Impression directe TCP/IP** via PrintDaemon C# (thermiques, USB, Bluetooth)
- **Tablette cuisine** — interface web temps réel sur n'importe quelle tablette
- **Écran salle** — affichage des commandes prêtes sur TV ou tablette
- **Gestion d'inventaire** (fournisseurs, articles, factures)
- **Rapports et statistiques** (CA, top produits, stats caissiers)
- **Personnalisation des tickets** (reçu client et ticket cuisine)
- **Sauvegarde automatique** avec planification flexible (intervalles, quotidienne, hebdomadaire, mensuelle)
- **Sauvegarde/Restauration manuelle** des données (format JSON)
- **Export/Import de templates** de produits
- **Multi-langue** (Français / Anglais / Arabe RTL)
- **Clavier virtuel** (QWERTY/AZERTY)

## Architecture

```
Electron App
├── Renderer (React + TypeScript)  — interface utilisateur
└── Main Process
    ├── Fastify :3002              — API REST + WebSocket
    │   ├── /api/orders
    │   ├── /api/products
    │   ├── /api/settings
    │   ├── /api/print
    │   ├── /cuisine               — tablette cuisine (HTML)
    │   ├── /display               — écran salle (HTML)
    │   └── /ws/events             — WebSocket temps réel
    └── SQLite (better-sqlite3)    — base de données locale
```

Le PrintDaemon C# est un microservice séparé inclus dans l'installateur — il gère toute l'impression (TCP/IP, USB, Bluetooth) et est transparent pour l'app.

## Installation

### Utilisateurs

1. Télécharger `Quick Order Hub Setup X.X.X.exe`
2. Exécuter l'installateur
3. Lancer l'application

### Développeurs

```bash
git clone https://github.com/VOTRE_USERNAME/quick-order-hub-desktop.git
cd quick-order-hub-desktop
npm install
npm run electron:dev
```

## Build pour Production

```bash
npm run electron:build
# Installateur généré dans : release/Quick Order Hub Setup X.X.X.exe
```

## Technologies

| Composant | Technologie |
|-----------|-------------|
| Desktop | Electron v40 |
| Frontend | React v18 + TypeScript |
| Backend embarqué | Fastify (Node.js) |
| Base de données | SQLite via better-sqlite3 |
| Build tool | Vite |
| Styling | Tailwind CSS |
| Impression | PrintDaemon C# (microservice) |

## Structure du Projet

```
quick-order-hub-desktop/
├── electron/              # Main Process Electron
│   ├── main.ts            # Point d'entrée + lancement Fastify
│   └── preload.ts
├── src/                   # Frontend React (Renderer)
│   ├── components/        # Composants UI et POS
│   ├── contexts/          # Contextes légers (Cart, Catalog, Orders, Settings, Printer)
│   ├── services/          # Appels HTTP vers Fastify
│   └── pages/
├── server/                # Backend Fastify
│   └── src/
│       ├── routes/        # API REST + pages cuisine/display
│       ├── services/      # Logique métier
│       └── db/            # SQLite, schema, migrations
├── packages/shared/       # Types TypeScript partagés front + back
├── tests/                 # Checklists et scripts curl par phase
└── PrintDaemon/           # Microservice C# d'impression
```

## Configuration

### Impression

Configurée dans **Paramètres > Imprimantes**. L'app communique avec le PrintDaemon C# (port 9100 par défaut) qui gère :
- Imprimantes thermiques ESC/POS via TCP/IP
- Imprimantes USB/spooler Windows
- Bluetooth

### Tablette cuisine / Écran salle

Accessibles depuis n'importe quel appareil sur le même réseau local :

```
http://[IP-DU-PC]:3002/cuisine   → tablette cuisine
http://[IP-DU-PC]:3002/display   → écran salle / TV
```

Trouver l'IP : `ipconfig` (Windows) → adresse 192.168.x.x

### Base de données

SQLite stocké dans `%APPDATA%\Quick Order Hub\database.db`

### Sauvegarde automatique

Configurée dans **Paramètres > Données**. Sauvegardes JSON dans le répertoire configuré.

### Logs

Stockés dans `%APPDATA%\Quick Order Hub\logs\` (un fichier par jour, rotation 10 jours).

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Vite en mode dev |
| `npm run build` | Build React |
| `npm run electron:dev` | Electron en mode dev |
| `npm run electron:build` | Build complet |
| `npm run lint` | ESLint |

## Sécurité

- Mots de passe hashés SHA-256 (crypto.subtle)
- Toutes les données stockées localement (SQLite)
- Aucune donnée envoyée sur Internet (mode offline-first)
- Authentification par PIN ou mot de passe avec lockout automatique

## Licence

[À compléter]

---

**Version** : 1.3.0 | **Dernière mise à jour** : 2026-06-01
