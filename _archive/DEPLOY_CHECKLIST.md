# Récap déploiement — Quick Order Hub v3.5.2

> Généré le 2026-05-15

---

## 1. État de la migration IndexedDB → SQLite

### Ce qui est FAIT ✅

| Composant | État |
|---|---|
| `server/src/db/connection.ts` | SQLite `better-sqlite3` opérationnel |
| `server/src/db/schema.ts` + migrations SQL | En place |
| Services backend (order, product, settings, print, backup, inventory) | Tous sur SQLite |
| Fastify lancé depuis `electron/main.ts` sur port **3002** | Confirmé |
| DB stockée dans `app.getPath('userData')/pos.db` | Confirmé |
| `POSContext.tsx` — shim de compatibilité, zéro IndexedDB | 122 lignes, propre |
| `src/services/` — tous les appels HTTP vers Fastify | Complet |
| Zéro import `idb` dans le frontend | Confirmé |

### Reliquats inoffensifs (non bloquants)

| Fichier | Résidu | Impact |
|---|---|---|
| `electron/main.ts` + `preload.ts` | `getIndexedDBPath()` IPC | Affichage informatif dans Paramètres → Infos système. Ne touche plus les données. |
| `server/src/services/migrationService.ts` | Script de migration one-shot | Inactif sauf appel explicite. Peut rester. |
| `package.json` | Paquet `idb` encore listé en dépendance | Non importé dans le code — vestige. Pas bloquant pour le build. |

---

## 2. Peut-on builder l'installateur ?

**Oui.** La commande est :

```bash
cd quick-order-hub-desktop
npm run electron:build
```

Ce que fait cette commande :
1. `tsc` — compile TypeScript
2. `vite build` — bundle le frontend React
3. `electron-builder` — génère l'installateur NSIS dans `release/`

### Point d'attention avant de builder

S'assurer que le `PrintDaemon.exe` est bien compilé et présent ici :
```
PrintDaemon/bin/Release/net8.0/win-x64/publish/PrintDaemon.exe
```
L'electron-builder le copie dans les `extraResources`. Si le fichier manque, le build échoue.

---

## 3. Installation sur la machine cible — écrase ou désinstalle d'abord ?

### Réponse courte : pas besoin de désinstaller manuellement

L'installateur est NSIS avec `oneClick: false`. Comportement au lancement :

1. **NSIS détecte l'ancienne version** via le registre Windows (AppId `com.doudoutacos.quickorderhub`)
2. **Il désinstalle automatiquement l'ancienne version** avant d'installer la nouvelle
3. L'installateur est interactif (pas one-click) — l'utilisateur clique "Suivant"

### Les données sont-elles préservées ?

**Oui — les données sont complètement séparées du répertoire d'installation.**

| Donnée | Emplacement | Lors d'une mise à jour |
|---|---|---|
| Base SQLite `pos.db` | `C:\Users\<user>\AppData\Roaming\Quick Order Hub\pos.db` | **Non touchée** |
| Logs | `C:\Users\<user>\AppData\Roaming\Quick Order Hub\logs\` | **Non touchés** |
| Backups | Dossier configuré dans les paramètres | **Non touchés** |
| Fichiers app | `C:\Program Files\Quick Order Hub\` | Remplacés par la nouvelle version |

> `deleteAppDataOnUninstall` n'est pas activé dans la config NSIS — les données AppData sont donc préservées même si l'utilisateur désinstalle manuellement.

### Cas limite : si la machine a une très vieille version (avant la migration SQLite)

Si la machine tourne encore sur une version IndexedDB (avant ce refactoring) :
- La nouvelle app démarre avec une **base SQLite vide** (pas de migration automatique au démarrage)
- Il faudra lancer la migration manuellement via l'interface Paramètres → Migration
- Les données IndexedDB sont toujours dans `AppData\Roaming\Quick Order Hub\IndexedDB\`

---

## 4. Récapitulatif des commandes

```bash
# 1. Builder
npm run electron:build

# 2. L'installateur généré se trouve dans :
#    release/Quick Order Hub Setup 3.5.2.exe

# 3. Copier l'exe sur la machine cible et lancer — c'est tout
```

---

## 5. Statut des phases du projet

| Phase | Statut |
|---|---|
| Phase 0 — Analyse | Terminée |
| Phase 1 — Séparation Frontend/Backend (Fastify) | Terminée — 30/30 tests curl, 83/83 UI |
| Phase 2 — Migration IndexedDB → SQLite | **Terminée** |
| Phase 3 — Tablette cuisine + Télé salle | En attente |
| Phase 4 — VPS cloud + Sync | En attente |
