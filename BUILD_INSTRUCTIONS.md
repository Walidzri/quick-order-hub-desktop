# Instructions de Build - Quick Order Hub Desktop

## Prérequis

1. **Node.js** (v18 ou supérieur)
2. **.NET 8.0 SDK** (pour compiler PrintDaemon.exe)
3. **Windows** (pour le build Windows)

## Structure des Fichiers Embarqués

### PrintDaemon C#

Le PrintDaemon C# est un serveur HTTP qui écoute en permanence sur `http://127.0.0.1:9100`.

Les fichiers suivants sont inclus dans le build via `extraResources` :

```
PrintDaemon/
└── PrintDaemon.exe      # Serveur HTTP C# self-contained (inclut le runtime .NET 8.0)
```

### Emplacement dans le Build

En production, ce fichier est copié dans :
```
resources/
└── PrintDaemon/
    └── PrintDaemon.exe  # Fichier unique self-contained (~80-120 MB)
```

Le chemin est accessible via `process.resourcesPath` dans Electron.

## Build

### 1. Compiler PrintDaemon C#

Assurez-vous que `PrintDaemon/bin/Release/net8.0/win-x64/publish/PrintDaemon.exe` existe.

Si ce n'est pas le cas, compilez-le en mode **self-contained** :

```bash
cd PrintDaemon
dotnet publish -c Release -r win-x64 --self-contained
# Le fichier sera dans bin/Release/net8.0/win-x64/publish/PrintDaemon.exe
```

**Important** : 
- Le mode self-contained inclut le runtime .NET 8.0 dans l'exécutable
- Pas besoin d'installer .NET sur le PC cible
- Le PrintDaemon C# doit être démarré manuellement ou configuré comme service Windows

### 2. Build Electron

```bash
npm run electron:build
```

### 3. Vérifier le Build

Après le build, vérifiez que les fichiers sont bien inclus :

```
release/
└── win-unpacked/
    └── resources/
        └── print-daemon/
            └── RawPrinterHelper/
                └── RawPrinterHelper.exe  # Fichier unique self-contained
```

## Configuration electron-builder

La configuration dans `package.json` inclut :

```json
"extraResources": [
  {
    "from": "public",
    "to": "public"
  },
  {
    "from": "PrintDaemon/bin/Release/net8.0/win-x64/publish/PrintDaemon.exe",
    "to": "PrintDaemon/PrintDaemon.exe"
  }
]
```

**Note** : Avec `PublishSingleFile=true`, seul le fichier `.exe` est nécessaire. Tout est inclus dans l'exécutable.

## Notes Importantes

1. **PrintDaemon.exe** doit être compilé en mode **self-contained** (Release) pour .NET 8.0
   - Cela inclut le runtime .NET 8.0 dans l'exécutable unique
   - Pas besoin d'installer .NET sur le PC cible
   - **Un seul fichier** : `PrintDaemon.exe` (~80-120 MB)
2. **PrintDaemon C#** est un serveur HTTP qui écoute en permanence sur `http://127.0.0.1:9100`
   - Il doit être démarré manuellement ou configuré comme service Windows
   - Plus performant que l'ancien système (appels directs Win32, queue d'impression intégrée)
3. Les fichiers de dépendances (.dll, .deps.json, .runtimeconfig.json) ne sont **plus nécessaires** avec `PublishSingleFile=true`
4. Le chemin dans le build utilise `process.resourcesPath` en production
5. Les fichiers sont accessibles via `path.join(process.resourcesPath, 'PrintDaemon', 'PrintDaemon.exe')`

## Dépannage

### PrintDaemon.exe non trouvé

Si l'erreur "PrintDaemon.exe not found" apparaît :

1. Vérifiez que le fichier existe dans `PrintDaemon/bin/Release/net8.0/win-x64/publish/PrintDaemon.exe`
2. Vérifiez que le fichier est inclus dans `release/win-unpacked/resources/PrintDaemon/PrintDaemon.exe`
3. Vérifiez les permissions d'exécution

### PrintDaemon C# non démarré

Si l'impression ne fonctionne pas :

1. **Cause** : PrintDaemon C# n'est pas démarré
2. **Solution** : Démarrez PrintDaemon.exe manuellement :
   ```bash
   cd resources/PrintDaemon
   PrintDaemon.exe
   ```
   Ou configurez-le comme service Windows pour qu'il démarre automatiquement
3. Vérifiez que le port 9100 n'est pas utilisé par un autre processus
4. Testez le statut via HTTP :
   ```bash
   curl http://127.0.0.1:9100/status
   ```

### Dépendances .NET manquantes / Erreur 0x80008083

Si PrintDaemon.exe ne démarre pas avec l'erreur `0x80008083` ou `2147516547` :

1. **Cause** : Le runtime .NET 8.0 n'est pas trouvé sur la machine cible (CoreHostLibMissingFailure)
2. **Solution** : Recompilez en mode **self-contained** qui inclut le runtime .NET 8.0 :
   ```bash
   cd PrintDaemon
   dotnet publish -c Release -r win-x64 --self-contained
   ```
