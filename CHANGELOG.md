# Changelog

Toutes les modifications notables de ce projet seront documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

## [Non publié]

### Ajouté
- Système de logging centralisé avec niveaux (DEBUG, INFO, WARN, ERROR, FATAL)
- Persistance des logs dans des fichiers (un fichier par jour)
- Error Boundary React pour capturer les erreurs non gérées
- Handlers globaux pour les erreurs JavaScript et promesses rejetées
- Rapport de documentation et monitoring (`RAPPORT_DOCUMENTATION_MONITORING.md`)
- Sauvegarde automatique avec plusieurs types de planification :
  - À intervalles réguliers (configurable en minutes)
  - Quotidienne (heure fixe)
  - Hebdomadaire (jour + heure)
  - Mensuelle (jour du mois + heure)

### Modifié
- Documentation mise à jour avec les nouvelles fonctionnalités
- Amélioration de la gestion des erreurs

### Technique
- Module de logging centralisé (`src/lib/logger.ts`)
- Composant ErrorBoundary (`src/components/ErrorBoundary.tsx`)
- API Electron pour la persistance des logs
- Rotation automatique des fichiers de logs (10 jours)

---

## [1.0.0] - 2025-01-15

### Ajouté
- Application POS complète pour restaurants
- Gestion des commandes (sur place, à emporter)
- Gestion des produits et catégories
- Système d'utilisateurs avec rôles (Admin, Chef, Caissier)
- Impression directe TCP/IP (imprimantes thermiques)
- Gestion d'inventaire
- Rapports et statistiques
- Personnalisation des tickets (reçu client et ticket cuisine)
- Sauvegarde/Restauration des données
- Export/Import de templates de produits
- Multi-langue (Français/Anglais)
- Clavier virtuel (QWERTY/AZERTY)

---

## Format des versions

- **MAJOR** : Changements incompatibles avec les versions précédentes
- **MINOR** : Nouvelles fonctionnalités rétrocompatibles
- **PATCH** : Corrections de bugs rétrocompatibles
