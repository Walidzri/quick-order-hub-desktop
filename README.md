# 🍕 Quick Order Hub Desktop

Application de Point de Vente (POS) complète pour restaurants, développée avec Electron, React et TypeScript.

## ✨ Fonctionnalités

- ✅ **Gestion complète des commandes** (sur place, à emporter)
- ✅ **Gestion des produits et catégories**
- ✅ **Système d'utilisateurs avec rôles** (Admin, Chef, Caissier)
- ✅ **Impression directe TCP/IP** (imprimantes thermiques et classiques)
- ✅ **Gestion d'inventaire** (marchandises, fournisseurs, factures)
- ✅ **Rapports et statistiques**
- ✅ **Personnalisation des tickets** (reçu client et ticket cuisine)
- ✅ **Sauvegarde automatique** avec planification flexible (intervalles, quotidienne, hebdomadaire, mensuelle)
- ✅ **Sauvegarde/Restauration manuelle** des données (format JSON)
- ✅ **Export/Import de templates** de produits
- ✅ **Système de logging** centralisé avec persistance des logs
- ✅ **Multi-langue** (Français/Anglais)
- ✅ **Clavier virtuel** (QWERTY/AZERTY)

## 🚀 Installation

### Pour les Utilisateurs

1. Télécharger `Quick Order Hub Setup X.X.X.exe`
2. Exécuter l'installateur
3. Suivre l'assistant d'installation
4. Lancer l'application

### Pour les Développeurs

```bash
# Cloner le repository
git clone https://github.com/VOTRE_USERNAME/quick-order-hub-desktop.git
cd quick-order-hub-desktop

# Installer les dépendances
npm install

# Lancer en mode développement
npm run electron:dev
```

## 📦 Build pour Production

```bash
# Build complet
npm run electron:build

# Le fichier d'installation sera dans :
# release/Quick Order Hub Setup X.X.X.exe
```

## 📚 Documentation

- 📖 [Documentation Complète](DOCUMENTATION_COMPLETE.md) - Guide exhaustif avec schémas et détails
- 🚀 [Guide de Démarrage Rapide](GUIDE_DEMARRAGE_RAPIDE.md) - Pour démarrer rapidement (5 minutes)
- 🔄 [Guide de Mise à Jour](GUIDE_MISE_A_JOUR.md) - Processus de mise à jour et versioning
- ✅ [Checklist Production](PRODUCTION_CHECKLIST.md) - Vérifications avant production
- 📦 [Guide GitHub](GUIDE_GITHUB.md) - Gestion du repository Git
- 📊 [Rapport Documentation & Monitoring](RAPPORT_DOCUMENTATION_MONITORING.md) - État de la documentation et du monitoring
- 📝 [Changelog](CHANGELOG.md) - Historique des versions et modifications

## 🛠️ Technologies

- **Electron** v33.2.1 - Framework desktop
- **React** v18.3.1 - Interface utilisateur
- **TypeScript** v5.8.3 - Typage statique
- **Vite** v5.4.19 - Build tool
- **SQLite** (via sql.js) - Base de données locale (stockée dans localStorage)
- **Tailwind CSS** - Styling

## 📁 Structure du Projet

```
quick-order-hub-desktop/
├── electron/              # Processus principal Electron
│   ├── main.ts          # Point d'entrée Electron
│   ├── preload.ts       # Preload script (ESM)
│   └── preload.cjs      # Preload script (CommonJS)
├── src/                  # Code source React
│   ├── components/      # Composants React
│   ├── contexts/        # Contextes (Auth, POS)
│   ├── lib/             # Utilitaires (database, printer, i18n)
│   └── pages/           # Pages de routage
├── dist/                 # Build React (production)
├── dist-electron/        # Build Electron (production)
└── release/              # Installateurs générés
```

## 🔧 Configuration

### Impression

L'application supporte l'impression directe via TCP/IP :
- **Imprimantes thermiques ESC/POS** (port 9100)
- **Imprimantes classiques** (inkjet/laser)

**Système d'impression automatique :**
- ✅ **Ticket cuisine** : Impression automatique lors de la confirmation de paiement
- ✅ **Reçu client** : Aperçu avant impression avec possibilité de téléchargement PDF
- ✅ **Impression directe** : Communication TCP/IP directe avec les imprimantes réseau (pas besoin de serveur d'impression séparé en mode desktop)
- ✅ **Coupure automatique** : Les tickets sont automatiquement coupés après impression
- ✅ **Formatage optimisé** : Support des tickets 80mm avec mise en page professionnelle

Configuration dans : **Paramètres > Imprimantes**

**Note** : Pour activer la coupure automatique, assurez-vous d'activer l'option "Imprimante thermique" dans les paramètres de chaque imprimante.

### Base de Données

Les données sont stockées localement en SQLite (via sql.js) :
- **Windows** : `C:\Users\[USERNAME]\AppData\Roaming\Quick Order Hub\`
- **Format** : Base SQLite stockée dans localStorage (encodée en Base64)

### Sauvegarde Automatique

L'application peut effectuer des sauvegardes automatiques selon plusieurs planifications :
- **À intervalles réguliers** : Toutes les X minutes (configurable)
- **Quotidienne** : À une heure fixe chaque jour
- **Hebdomadaire** : Un jour spécifique de la semaine
- **Mensuelle** : Un jour spécifique du mois

Configuration dans : **Paramètres > Données > Sauvegarde automatique**

Les sauvegardes sont créées au format JSON et stockées dans le répertoire configuré.

### Logs et Monitoring

L'application dispose d'un système de logging centralisé :
- **Logs persistants** : Sauvegardés dans `%APPDATA%/Quick Order Hub/logs/`
- **Format** : Un fichier par jour (`app-YYYY-MM-DD.log`)
- **Niveaux** : DEBUG, INFO, WARN, ERROR, FATAL
- **Rotation automatique** : Conservation des 10 derniers jours

Les erreurs sont automatiquement capturées et loggées pour faciliter le diagnostic.

## 🐛 Dépannage

Voir la section [Dépannage](DOCUMENTATION_COMPLETE.md#dépannage) dans la documentation complète.

## 📝 Scripts Disponibles

| Script | Description |
|--------|-------------|
| `npm run dev` | Lancer Vite en mode dev |
| `npm run build` | Build React uniquement |
| `npm run electron:dev` | Lancer Electron en mode dev |
| `npm run electron:build` | Build complet (React + Electron) |
| `npm run lint` | Vérifier le code avec ESLint |

## 🔒 Sécurité

- Les mots de passe sont stockés en clair (application locale)
- Toutes les données sont stockées localement (pas de cloud)
- Aucune donnée n'est envoyée sur Internet

## 📄 Licence

[À compléter selon votre licence]

## 👥 Contribution

[À compléter si vous acceptez les contributions]

## 📞 Support

[Vos coordonnées de support]

---

**Version** : 1.0.0  
**Dernière mise à jour** : 2026-01-25

> 📝 Pour les détails complets, consultez la [Documentation Complète](DOCUMENTATION_COMPLETE.md)
