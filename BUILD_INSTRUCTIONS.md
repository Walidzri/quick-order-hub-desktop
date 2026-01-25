# Instructions de Build - Quick Order Hub Desktop

## Prérequis

1. **Node.js** (v18 ou supérieur)
2. **.NET 6.0 SDK** (pour compiler RawPrinterHelper.exe si nécessaire)
3. **Windows** (pour le build Windows)

## Structure des Fichiers Embarqués

### Print Daemon

Les fichiers suivants sont inclus dans le build via `extraResources` :

```
print-daemon/
├── server.cjs                    # Serveur Node.js pour l'impression (optionnel, remplacé par print-daemon-integrated.ts)
└── RawPrinterHelper/
    └── RawPrinterHelper.exe      # Exécutable C# self-contained (inclut le runtime .NET)
```

### Emplacement dans le Build

En production, ces fichiers sont copiés dans :
```
resources/
└── print-daemon/
    └── RawPrinterHelper/
        └── RawPrinterHelper.exe  # Fichier unique self-contained (~70-100 MB)
```

Le chemin est accessible via `process.resourcesPath` dans Electron.

## Build

### 1. Vérifier que RawPrinterHelper.exe existe

Assurez-vous que `print-daemon/RawPrinterHelper/RawPrinterHelper.exe` existe.

Si ce n'est pas le cas, compilez-le en mode **self-contained** (inclut le runtime .NET, pas besoin d'installer .NET sur le PC cible) :

```bash
cd print-daemon/RawPrinterHelper
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true
# Le fichier sera dans bin/Release/net6.0-windows/win-x64/publish/RawPrinterHelper.exe
# Copiez-le vers print-daemon/RawPrinterHelper/RawPrinterHelper.exe
```

**Important** : Le mode self-contained inclut le runtime .NET dans l'exécutable, ce qui résout l'erreur `0x80008083` (CoreHostLibMissingFailure) sur les PC sans .NET installé.

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
    "from": "print-daemon/RawPrinterHelper/RawPrinterHelper.exe",
    "to": "print-daemon/RawPrinterHelper/RawPrinterHelper.exe"
  }
]
```

**Note** : Avec `PublishSingleFile=true`, seul le fichier `.exe` est nécessaire. Les fichiers `.dll`, `.deps.json` et `.runtimeconfig.json` ne sont plus requis car tout est inclus dans l'exécutable.

## Notes Importantes

1. **RawPrinterHelper.exe** doit être compilé en mode **self-contained** avec `PublishSingleFile=true` (Release) pour .NET 6.0
   - Cela inclut le runtime .NET dans l'exécutable unique
   - Pas besoin d'installer .NET sur le PC cible
   - Résout l'erreur `0x80008083` (CoreHostLibMissingFailure)
   - **Un seul fichier** : `RawPrinterHelper.exe` (~70-100 MB)
2. Les fichiers de dépendances (.dll, .deps.json, .runtimeconfig.json) ne sont **plus nécessaires** avec `PublishSingleFile=true`
3. Le chemin dans `print-daemon-integrated.ts` utilise `process.resourcesPath` en production
4. Les fichiers sont accessibles via `path.join(process.resourcesPath, 'print-daemon', 'RawPrinterHelper', 'RawPrinterHelper.exe')`

## Dépannage

### RawPrinterHelper.exe non trouvé

Si l'erreur "RawPrinterHelper.exe not found" apparaît :

1. Vérifiez que le fichier existe dans `print-daemon/RawPrinterHelper/RawPrinterHelper.exe`
2. Vérifiez que le fichier est inclus dans `release/win-unpacked/resources/print-daemon/RawPrinterHelper/`
3. Vérifiez les permissions d'exécution

### Dépendances .NET manquantes / Erreur 0x80008083

Si RawPrinterHelper.exe ne démarre pas avec l'erreur `0x80008083` ou `2147516547` :

1. **Cause** : Le runtime .NET n'est pas trouvé sur la machine cible (CoreHostLibMissingFailure)
2. **Solution** : Recompilez en mode **self-contained** qui inclut le runtime .NET :
   ```bash
   cd print-daemon/RawPrinterHelper
   dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true
   ```
   Copiez ensuite `bin/Release/net6.0-windows/win-x64/publish/RawPrinterHelper.exe` vers `print-daemon/RawPrinterHelper/RawPrinterHelper.exe`
3. Vérifiez que tous les fichiers de dépendances sont inclus
4. Testez RawPrinterHelper.exe manuellement :
   ```bash
   cd resources/print-daemon/RawPrinterHelper
   RawPrinterHelper.exe -p "NomImprimante" -f "chemin/vers/fichier.bin"
   ```
