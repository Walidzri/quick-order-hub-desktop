# Guide de Diagnostic - Daemon d'Impression

## Problème : Le daemon ne démarre pas sur un PC après installation

### Améliorations apportées

Le code a été amélioré pour :
1. **Utiliser le Node.js d'Electron** : Le daemon utilise maintenant `process.execPath` (le même Node.js qui exécute Electron) au lieu de chercher "node" dans le PATH
2. **Logs détaillés** : Tous les événements du daemon sont maintenant loggés dans les fichiers de logs
3. **Capture des erreurs** : Les erreurs stdout/stderr sont capturées même en production

### Diagnostic sur l'autre PC

#### Étape 1 : Vérifier les logs

Les logs sont stockés dans :
```
%APPDATA%\Quick Order Hub\logs\app-YYYY-MM-DD.log
```

**Comment accéder :**
1. Appuyer sur `Win + R`
2. Taper : `%APPDATA%\Quick Order Hub\logs`
3. Ouvrir le fichier du jour (ex: `app-2026-01-25.log`)
4. Chercher les lignes avec `[DAEMON-` pour voir les erreurs

**Exemples de messages à chercher :**
- `[DAEMON-ERROR] Print daemon not found at: ...` → Le fichier server.cjs n'est pas trouvé
- `[DAEMON-ERROR] Node.js executable not found` → Problème avec Node.js (ne devrait plus arriver)
- `[DAEMON-ERROR] STDOUT: ...` ou `[DAEMON-ERROR] STDERR: ...` → Erreurs du daemon lui-même

#### Étape 2 : Vérifier que les fichiers sont présents

Après installation, vérifier que les fichiers existent dans :
```
C:\Users\[USERNAME]\AppData\Local\Programs\quick-order-hub-desktop\resources\print-daemon\
```

**Fichiers requis :**
- `server.cjs`
- `RawPrinterHelper/RawPrinterHelper.exe`
- `RawPrinterHelper/RawPrinterHelper.dll`
- `RawPrinterHelper/RawPrinterHelper.deps.json`
- `RawPrinterHelper/RawPrinterHelper.runtimeconfig.json`

**Si les fichiers manquent :**
- Le build n'a pas inclus les fichiers correctement
- Vérifier `package.json` → `build.extraResources`

#### Étape 3 : Vérifier le processus

**Dans PowerShell (en tant qu'administrateur) :**
```powershell
# Vérifier si le processus Node.js du daemon tourne
Get-Process | Where-Object {$_.ProcessName -like "*node*" -or $_.CommandLine -like "*server.cjs*"}

# Vérifier le port 9100
netstat -ano | findstr :9100
```

**Si le port 9100 n'est pas en écoute :**
- Le daemon n'a pas démarré
- Consulter les logs (Étape 1)

#### Étape 4 : Tester manuellement le daemon

**Dans PowerShell :**
```powershell
# Aller dans le dossier resources
cd "C:\Users\[USERNAME]\AppData\Local\Programs\quick-order-hub-desktop\resources\print-daemon"

# Tester si Node.js peut exécuter le daemon
# (Utiliser le Node.js d'Electron - chemin à adapter)
& "C:\Users\[USERNAME]\AppData\Local\Programs\quick-order-hub-desktop\resources\app.asar.unpacked\electron.exe" --version
```

**Note :** En production, Electron utilise son propre Node.js embarqué, donc le test manuel est complexe.

#### Étape 5 : Vérifier les permissions

**Vérifier que l'application a les permissions nécessaires :**
1. Clic droit sur l'exécutable de l'application
2. Propriétés → Onglet "Sécurité"
3. Vérifier que l'utilisateur a les droits "Lecture et exécution"

### Solutions courantes

#### Solution 1 : Redémarrer l'application

Parfois, un simple redémarrage résout le problème :
1. Fermer complètement l'application
2. Relancer l'application
3. Vérifier le statut dans Paramètres → Données

#### Solution 2 : Vérifier les logs

Si les logs montrent `Print daemon not found at: ...` :
- Vérifier que le chemin dans les logs correspond à l'emplacement réel des fichiers
- Si le chemin est incorrect, c'est un problème de configuration `process.resourcesPath`

#### Solution 3 : Réinstaller l'application

Si les fichiers manquent :
1. Désinstaller l'application
2. Vérifier que le build inclut bien tous les fichiers (`extraResources`)
3. Réinstaller

#### Solution 4 : Vérifier .NET Runtime

Si `RawPrinterHelper.exe` ne peut pas démarrer :
- Vérifier que `.NET 6.0 Runtime` est installé sur le PC
- Télécharger depuis : https://dotnet.microsoft.com/download/dotnet/6.0

### Informations à collecter pour le diagnostic

Si le problème persiste, collecter :

1. **Les logs** : `%APPDATA%\Quick Order Hub\logs\app-YYYY-MM-DD.log`
2. **Le chemin exact** où l'application est installée
3. **La version de Windows** : `Win + R` → `winver`
4. **Les erreurs dans la console** (si DevTools sont ouverts)
5. **Le résultat de** : `netstat -ano | findstr :9100`

### Contact et Support

Si le problème persiste après avoir suivi ce guide, fournir :
- Les logs complets du jour
- Les informations collectées ci-dessus
- Une description précise du comportement observé
