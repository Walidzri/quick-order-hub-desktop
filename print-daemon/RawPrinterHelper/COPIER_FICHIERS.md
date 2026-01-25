# Instructions pour copier les fichiers après compilation

## 1. Compiler en mode self-contained

```bash
cd print-daemon/RawPrinterHelper
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true
```

## 2. Fichiers générés

Après la compilation, les fichiers sont dans :
```
bin/Release/net6.0-windows/win-x64/publish/
```

## 3. Fichiers à copier

### Avec PublishSingleFile=true (recommandé)

**Un seul fichier principal :**
- `RawPrinterHelper.exe` → Copiez vers `print-daemon/RawPrinterHelper/RawPrinterHelper.exe`

**Fichiers optionnels (si présents) :**
- `RawPrinterHelper.dll` → Copiez vers `print-daemon/RawPrinterHelper/RawPrinterHelper.dll` (si présent)
- `RawPrinterHelper.deps.json` → Copiez vers `print-daemon/RawPrinterHelper/RawPrinterHelper.deps.json` (si présent)
- `RawPrinterHelper.runtimeconfig.json` → Copiez vers `print-daemon/RawPrinterHelper/RawPrinterHelper.runtimeconfig.json` (si présent)

## 4. Commandes PowerShell pour copier

Ouvrez PowerShell dans le dossier `print-daemon/RawPrinterHelper` et exécutez :

```powershell
# Aller dans le dossier publish
cd bin\Release\net6.0-windows\win-x64\publish

# Copier le fichier principal (remplace l'ancien)
Copy-Item -Path "RawPrinterHelper.exe" -Destination "..\..\..\..\..\..\..\RawPrinterHelper.exe" -Force

# Copier les fichiers optionnels s'ils existent
if (Test-Path "RawPrinterHelper.dll") {
    Copy-Item -Path "RawPrinterHelper.dll" -Destination "..\..\..\..\..\..\..\RawPrinterHelper.dll" -Force
}
if (Test-Path "RawPrinterHelper.deps.json") {
    Copy-Item -Path "RawPrinterHelper.deps.json" -Destination "..\..\..\..\..\..\..\RawPrinterHelper.deps.json" -Force
}
if (Test-Path "RawPrinterHelper.runtimeconfig.json") {
    Copy-Item -Path "RawPrinterHelper.runtimeconfig.json" -Destination "..\..\..\..\..\..\..\RawPrinterHelper.runtimeconfig.json" -Force
}

Write-Host "✅ Fichiers copiés avec succès !"
```

## 5. Vérification

Vérifiez que les fichiers sont bien dans :
```
print-daemon/RawPrinterHelper/
├── RawPrinterHelper.exe          ← Fichier principal (OBLIGATOIRE)
├── RawPrinterHelper.dll           ← Optionnel
├── RawPrinterHelper.deps.json    ← Optionnel
└── RawPrinterHelper.runtimeconfig.json ← Optionnel
```

## 6. Important

- Le fichier `RawPrinterHelper.exe` est maintenant **self-contained** (inclut le runtime .NET)
- Taille attendue : ~70-100 MB (contient le runtime .NET)
- **Pas besoin d'installer .NET sur le PC cible** ✅
