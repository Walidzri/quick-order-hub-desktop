# 📦 Guide GitHub - Créer et Publier le Projet

## Prérequis

- Compte GitHub créé
- Git installé sur votre machine
- Accès en ligne de commande (PowerShell, Terminal, etc.)

## Étape 1 : Créer le Repository sur GitHub

1. **Aller sur GitHub.com**
2. Cliquer sur le **"+"** en haut à droite
3. Sélectionner **"New repository"**
4. Remplir les informations :
   ```
   Repository name: quick-order-hub-desktop
   Description: Quick Order Hub - Desktop POS Application
   Visibility: Private (recommandé) ou Public
   ```
5. **NE PAS** cocher "Initialize with README" (on va le faire localement)
6. Cliquer sur **"Create repository"**

## Étape 2 : Initialiser Git Localement

### Ouvrir le terminal dans le dossier du projet

```powershell
cd e:\Bureau\doudou-tacos\doudou-webapp\quick-order-hub-desktop
```

### Initialiser Git

```bash
# Initialiser le dépôt Git
git init

# Vérifier que Git est bien initialisé
git status
```

## Étape 3 : Configurer Git (Si pas déjà fait)

```bash
# Configurer votre nom (une seule fois)
git config --global user.name "Votre Nom"

# Configurer votre email (une seule fois)
git config --global user.email "votre.email@example.com"
```

## Étape 4 : Ajouter les Fichiers

### Vérifier le .gitignore

Le fichier `.gitignore` est déjà présent et ignore :
- `node_modules/`
- `dist/` et `dist-electron/`
- `release/` (installateurs)
- Fichiers de build

### Ajouter tous les fichiers

```bash
# Ajouter tous les fichiers (sauf ceux dans .gitignore)
git add .

# Vérifier ce qui sera commité
git status
```

## Étape 5 : Premier Commit

```bash
# Créer le premier commit
git commit -m "Initial commit: Quick Order Hub Desktop v1.0.0"
```

## Étape 6 : Connecter au Repository GitHub

### Récupérer l'URL du repository

Sur GitHub, après avoir créé le repository, vous verrez quelque chose comme :

```
https://github.com/VOTRE_USERNAME/quick-order-hub-desktop.git
```

ou en SSH :

```
git@github.com:VOTRE_USERNAME/quick-order-hub-desktop.git
```

### Ajouter le remote

```bash
# Remplacer VOTRE_USERNAME par votre nom d'utilisateur GitHub
git remote add origin https://github.com/VOTRE_USERNAME/quick-order-hub-desktop.git

# Vérifier que le remote est bien ajouté
git remote -v
```

## Étape 7 : Pousser le Code sur GitHub

```bash
# Renommer la branche principale en "main" (si nécessaire)
git branch -M main

# Pousser le code sur GitHub
git push -u origin main
```

**Si c'est la première fois**, GitHub vous demandera de vous authentifier :
- **Option 1** : Utiliser GitHub Desktop (plus simple)
- **Option 2** : Utiliser un Personal Access Token (PAT)
- **Option 3** : Utiliser SSH keys

## Authentification GitHub

### Option A : Personal Access Token (Recommandé)

1. **Créer un token** :
   - GitHub.com → Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Generate new token (classic)
   - Cocher `repo` (accès complet aux repositories)
   - Générer et **copier le token** (il ne sera affiché qu'une fois !)

2. **Utiliser le token** :
   ```bash
   # Quand Git demande le mot de passe, utiliser le token
   # Username: votre_username_github
   # Password: votre_token
   ```

### Option B : GitHub Desktop

1. Télécharger [GitHub Desktop](https://desktop.github.com/)
2. Se connecter avec votre compte GitHub
3. Ajouter le repository local
4. Faire le commit et push via l'interface

### Option C : SSH Keys

```bash
# Générer une clé SSH (si pas déjà fait)
ssh-keygen -t ed25519 -C "votre.email@example.com"

# Copier la clé publique
cat ~/.ssh/id_ed25519.pub

# Ajouter la clé sur GitHub :
# Settings → SSH and GPG keys → New SSH key
# Coller la clé publique

# Utiliser l'URL SSH pour le remote
git remote set-url origin git@github.com:VOTRE_USERNAME/quick-order-hub-desktop.git
```

## Commandes Git Essentielles

### Workflow Quotidien

```bash
# Voir l'état des fichiers
git status

# Ajouter des fichiers modifiés
git add .
# ou pour un fichier spécifique
git add nom-du-fichier.ts

# Créer un commit
git commit -m "Description des changements"

# Pousser sur GitHub
git push

# Récupérer les dernières modifications
git pull
```

### Créer une Nouvelle Branche

```bash
# Créer et basculer sur une nouvelle branche
git checkout -b nom-de-la-branche

# Ou avec la nouvelle syntaxe
git switch -c nom-de-la-branche

# Pousser la branche sur GitHub
git push -u origin nom-de-la-branche
```

### Voir l'Historique

```bash
# Voir les commits
git log

# Voir les commits de manière compacte
git log --oneline

# Voir les différences
git diff
```

## Structure Recommandée du Repository

```
quick-order-hub-desktop/
├── .git/                    # (ignoré, créé par Git)
├── .gitignore              # ✅ Fichiers à ignorer
├── README.md               # ✅ Description du projet
├── DOCUMENTATION_COMPLETE.md  # ✅ Documentation complète
├── GUIDE_DEMARRAGE_RAPIDE.md  # ✅ Guide rapide
├── GUIDE_MISE_A_JOUR.md    # ✅ Guide de mise à jour
├── PRODUCTION_CHECKLIST.md # ✅ Checklist production
├── package.json            # ✅ Configuration projet
├── electron/               # ✅ Code Electron
├── src/                    # ✅ Code source React
├── public/                 # ✅ Assets publics
├── node_modules/          # ❌ Ignoré (.gitignore)
├── dist/                   # ❌ Ignoré (.gitignore)
├── dist-electron/          # ❌ Ignoré (.gitignore)
└── release/                # ❌ Ignoré (.gitignore)
```

## Fichiers à NE PAS Commiter

Le `.gitignore` ignore déjà :
- ✅ `node_modules/` - Dépendances (trop volumineux)
- ✅ `dist/` et `dist-electron/` - Builds (générés)
- ✅ `release/` - Installateurs (générés)
- ✅ `.DS_Store` - Fichiers système Mac
- ✅ `*.log` - Logs

**Ne jamais commiter** :
- ❌ Mots de passe ou clés API
- ❌ Fichiers de configuration locaux avec secrets
- ❌ Données utilisateur (IndexedDB)

## README.md Recommandé

Créer ou mettre à jour `README.md` :

```markdown
# Quick Order Hub Desktop

Application de Point de Vente (POS) complète pour restaurants.

## 🚀 Installation

Télécharger et exécuter `Quick Order Hub Setup X.X.X.exe`

## 📚 Documentation

- [Guide de Démarrage Rapide](GUIDE_DEMARRAGE_RAPIDE.md)
- [Documentation Complète](DOCUMENTATION_COMPLETE.md)
- [Guide de Mise à Jour](GUIDE_MISE_A_JOUR.md)

## 🛠️ Développement

```bash
npm install
npm run electron:dev
```

## 📦 Build

```bash
npm run electron:build
```

## 📄 Licence

[Votre licence]
```

## Workflow Complet (Résumé)

```bash
# 1. Initialiser Git
git init

# 2. Ajouter les fichiers
git add .

# 3. Premier commit
git commit -m "Initial commit: Quick Order Hub Desktop v1.0.0"

# 4. Ajouter le remote GitHub
git remote add origin https://github.com/VOTRE_USERNAME/quick-order-hub-desktop.git

# 5. Renommer la branche
git branch -M main

# 6. Pousser sur GitHub
git push -u origin main
```

## Mises à Jour Futures

Après avoir fait des modifications :

```bash
# 1. Voir les changements
git status

# 2. Ajouter les fichiers modifiés
git add .

# 3. Créer un commit
git commit -m "Description des changements"

# 4. Pousser sur GitHub
git push
```

## Tags de Version

Pour marquer une version :

```bash
# Créer un tag
git tag -a v1.0.0 -m "Version 1.0.0"

# Pousser le tag sur GitHub
git push origin v1.0.0
```

Sur GitHub, vous verrez alors une section "Releases" avec vos versions.

## Protection de la Branche Main (Optionnel)

Sur GitHub :
1. Settings → Branches
2. Add rule pour `main`
3. Require pull request reviews (optionnel)
4. Require status checks (optionnel)

---

## Dépannage

### Erreur : "remote origin already exists"

```bash
# Supprimer le remote existant
git remote remove origin

# Réajouter
git remote add origin https://github.com/VOTRE_USERNAME/quick-order-hub-desktop.git
```

### Erreur : "failed to push some refs"

```bash
# Récupérer les changements distants d'abord
git pull origin main --allow-unrelated-histories

# Puis pousser
git push -u origin main
```

### Oublier un fichier dans .gitignore

```bash
# Supprimer du cache Git (mais garder le fichier local)
git rm --cached nom-du-fichier

# Commit
git commit -m "Remove file from Git tracking"
```

---

**Bon développement ! 🚀**
