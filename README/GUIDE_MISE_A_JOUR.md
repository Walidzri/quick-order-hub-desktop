# 🔄 Guide de Mise à Jour - Quick Order Hub Desktop

## Processus de Développement et Mise à Jour

### 1. Développement et Tests

#### Mode Développement

```bash
# Lancer l'application en mode développement
npm run electron:dev
```

**Avantages** :
- ✅ Rechargement automatique des modifications
- ✅ DevTools disponibles pour le débogage
- ✅ Pas besoin de rebuild complet
- ✅ Logs détaillés dans la console

#### Faire des Modifications

1. **Modifier le code** dans `src/`
2. **Tester** en mode dev (`npm run electron:dev`)
3. **Vérifier** que tout fonctionne correctement
4. **Commit** les changements (si vous utilisez Git)

### 2. Créer une Nouvelle Version

#### Étape 1 : Mettre à Jour la Version

Éditer `package.json` :

```json
{
  "name": "quick-order-hub-desktop",
  "version": "1.0.1",  // ← Incrémenter la version
  ...
}
```

**Convention de versionnement (SemVer)** :
- **1.0.0** → **1.0.1** : Correction de bugs (patch)
- **1.0.0** → **1.1.0** : Nouvelles fonctionnalités (minor)
- **1.0.0** → **2.0.0** : Changements majeurs (major)

#### Étape 2 : Build de Production

```bash
# Build complet (React + Electron)
npm run electron:build
```

**Ce qui se passe** :
1. Compilation TypeScript
2. Build React (optimisé, minifié)
3. Build Electron (main process, preload)
4. Packaging avec electron-builder
5. Création de l'installateur dans `release/`

**Résultat** :
```
release/
└── Quick Order Hub Setup 1.0.1.exe  ← Nouveau fichier d'installation
```

### 3. Distribution de la Mise à Jour

#### Option A : Installation Manuelle (Recommandé pour l'instant)

**Pour les utilisateurs** :

1. **Télécharger** le nouveau fichier `Quick Order Hub Setup X.X.X.exe`
2. **Désinstaller** l'ancienne version (optionnel, mais recommandé)
3. **Installer** la nouvelle version
4. ✅ **Les données sont préservées** (IndexedDB reste intact)

**Note** : Les données utilisateur sont stockées dans :
```
C:\Users\[USERNAME]\AppData\Roaming\Quick Order Hub\
```
Elles ne sont **pas** supprimées lors de la désinstallation.

#### Option B : Installation par-dessus (Update in-place)

1. **Télécharger** le nouveau fichier d'installation
2. **Exécuter** l'installateur
3. L'installateur NSIS détecte l'ancienne version
4. **Remplacer** les fichiers de l'application
5. ✅ **Les données sont préservées**

### 4. Checklist Avant une Mise à Jour

#### Avant de Build

- [ ] Tester toutes les fonctionnalités en mode dev
- [ ] Vérifier qu'il n'y a pas d'erreurs de compilation
- [ ] Mettre à jour la version dans `package.json`
- [ ] Mettre à jour le CHANGELOG (si vous en avez un)
- [ ] Tester le build localement

#### Après le Build

- [ ] Tester l'installateur sur une machine propre
- [ ] Vérifier que les données sont préservées
- [ ] Tester les fonctionnalités principales
- [ ] Créer une sauvegarde de test
- [ ] Documenter les changements

### 5. Gestion des Versions

#### Structure Recommandée

```
v1.0.0  → Version initiale
v1.0.1  → Corrections de bugs
v1.0.2  → Corrections de bugs
v1.1.0  → Nouvelles fonctionnalités
v1.2.0  → Nouvelles fonctionnalités
v2.0.0  → Refonte majeure
```

#### Exemple de Workflow

```bash
# 1. Développement
npm run electron:dev

# 2. Tests
# ... tester les fonctionnalités ...

# 3. Mettre à jour la version
# Éditer package.json : "version": "1.0.1"

# 4. Build
npm run electron:build

# 5. Tester l'installateur
# Installer release/Quick Order Hub Setup 1.0.1.exe

# 6. Distribuer
# Partager le fichier .exe avec les utilisateurs
```

### 6. Migration des Données (Si Nécessaire)

Si vous modifiez la structure de la base de données :

#### Exemple de Migration

```typescript
// src/lib/migrations.ts
export async function migrateToVersion(version: string) {
  const db = await getDB();
  
  if (version === '1.0.1') {
    // Ajouter un nouveau champ à tous les produits
    const products = await db.getAll('products');
    for (const product of products) {
      if (!product.newField) {
        product.newField = 'defaultValue';
        await db.put('products', product);
      }
    }
  }
  
  // Mettre à jour la version dans les settings
  const settings = await db.get('settings', 'main');
  if (settings) {
    settings.appVersion = version;
    await db.put('settings', settings);
  }
}
```

### 7. Communication avec les Utilisateurs

#### Informer les Utilisateurs

**Avant la mise à jour** :
- 📢 Annoncer la nouvelle version
- 📝 Lister les nouvelles fonctionnalités
- ⚠️ Mentionner les changements importants
- 📋 Fournir les instructions d'installation

**Exemple de message** :

```
Nouvelle version 1.0.1 disponible !

Nouvelles fonctionnalités :
- Amélioration de la gestion des mots de passe
- Correction de bugs d'impression
- Interface utilisateur améliorée

Pour mettre à jour :
1. Télécharger Quick Order Hub Setup 1.0.1.exe
2. Exécuter l'installateur
3. Vos données seront préservées automatiquement

⚠️ Important : Faites une sauvegarde avant la mise à jour !
```

### 8. Sauvegarde Avant Mise à Jour

**Recommandation** : Toujours faire une sauvegarde avant une mise à jour majeure.

**Procédure** :
1. Ouvrir l'application
2. **Paramètres > Sauvegarde et Restauration**
3. **Exporter la sauvegarde**
4. Sauvegarder sur une clé USB ou un autre emplacement sûr

### 9. Rollback (Retour en Arrière)

Si une mise à jour pose problème :

1. **Désinstaller** la nouvelle version
2. **Installer** l'ancienne version
3. **Restaurer** la sauvegarde si nécessaire

**Note** : Les données IndexedDB sont généralement compatibles entre versions mineures.

### 10. Automatisation (Futur)

Pour l'instant, les mises à jour sont manuelles. À l'avenir, vous pourriez implémenter :

- **electron-updater** : Mises à jour automatiques
- **Serveur de distribution** : Téléchargement automatique
- **Notifications** : Alertes de nouvelles versions

**Exemple avec electron-updater** :

```typescript
// electron/main.ts
import { autoUpdater } from 'electron-updater';

if (!isDev) {
  autoUpdater.checkForUpdatesAndNotify();
}
```

---

## Résumé du Processus

```
┌─────────────────────────────────────────────────────────┐
│              PROCESSUS DE MISE À JOUR                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. DÉVELOPPEMENT                                       │
│     npm run electron:dev                                │
│     → Modifier le code                                  │
│     → Tester                                            │
│                                                         │
│  2. VERSIONNING                                         │
│     → Éditer package.json                               │
│     → Incrémenter la version (1.0.0 → 1.0.1)           │
│                                                         │
│  3. BUILD                                               │
│     npm run electron:build                              │
│     → Création de l'installateur                        │
│                                                         │
│  4. TEST                                                │
│     → Installer sur machine de test                    │
│     → Vérifier les fonctionnalités                      │
│                                                         │
│  5. DISTRIBUTION                                        │
│     → Partager release/Quick Order Hub Setup X.X.X.exe │
│     → Informer les utilisateurs                         │
│                                                         │
│  6. INSTALLATION (Côté utilisateur)                     │
│     → Télécharger le nouveau .exe                      │
│     → Exécuter l'installateur                           │
│     → Les données sont préservées                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Commandes Rapides

```bash
# Développement
npm run electron:dev

# Build de production
npm run electron:build

# Build pour Windows uniquement
npm run electron:build -- --win

# Build avec version spécifique (via package.json)
# Éditer package.json puis :
npm run electron:build
```

---

## Notes Importantes

1. **Les données sont préservées** : IndexedDB n'est pas supprimé lors de la désinstallation
2. **Pas de migration automatique** : Pour l'instant, les migrations doivent être gérées manuellement
3. **Sauvegarde recommandée** : Toujours faire une sauvegarde avant une mise à jour majeure
4. **Testez avant de distribuer** : Tester l'installateur sur une machine propre

---

**Dernière mise à jour** : 2025-01-15
