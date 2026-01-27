# Guide de Test du Print Daemon

Le print daemon est intégré dans Electron et écoute sur `http://127.0.0.1:9100`.

## Prérequis

1. L'application Electron doit être lancée (le daemon démarre automatiquement)
2. Vérifiez que le daemon est actif avec le test de santé

## Tests

### 1. Test de Santé (Health Check)

Vérifie que le daemon est actif et répond.

#### PowerShell
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:9100/health" -Method GET
```

#### cURL
```bash
curl http://127.0.0.1:9100/health
```

#### Réponse attendue
```json
{
  "status": "ok",
  "message": "Print daemon running",
  "version": "0.2.0"
}
```

---

### 2. Test d'Impression Réseau (TCP/IP)

Envoie des données à une imprimante réseau.

#### PowerShell
```powershell
$body = @{
    connectionType = "tcp"
    target = @{
        host = "192.168.1.100"
        port = 9100
    }
    content = "Test d'impression`n`nLigne 1`nLigne 2`n`n"
    isThermalPrinter = $true
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri "http://127.0.0.1:9100/print" -Method POST -Body $body -ContentType "application/json"
```

#### cURL
```bash
curl -X POST http://127.0.0.1:9100/print \
  -H "Content-Type: application/json" \
  -d '{
    "connectionType": "tcp",
    "target": {
      "host": "192.168.1.100",
      "port": 9100
    },
    "content": "Test d'\''impression\n\nLigne 1\nLigne 2\n\n",
    "isThermalPrinter": true
  }'
```

#### Réponse attendue (succès)
```json
{
  "success": true
}
```

#### Réponse attendue (erreur)
```json
{
  "success": false,
  "message": "Connection timeout to printer"
}
```

---

### 3. Test d'Impression Windows (Spooler)

Envoie des données à une imprimante Windows via le spooler.

#### PowerShell
```powershell
$body = @{
    connectionType = "windows"
    target = @{
        printerName = "Nom de votre imprimante Windows"
    }
    content = "Test d'impression`n`nLigne 1`nLigne 2`n`n"
    isThermalPrinter = $true
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri "http://127.0.0.1:9100/print" -Method POST -Body $body -ContentType "application/json"
```

#### cURL
```bash
curl -X POST http://127.0.0.1:9100/print \
  -H "Content-Type: application/json" \
  -d '{
    "connectionType": "windows",
    "target": {
      "printerName": "Nom de votre imprimante Windows"
    },
    "content": "Test d'\''impression\n\nLigne 1\nLigne 2\n\n",
    "isThermalPrinter": true
  }'
```

#### Réponse attendue (succès)
```json
{
  "success": true
}
```

#### Réponse attendue (erreur)
```json
{
  "success": false,
  "message": "RawPrinterHelper: Erreur d'impression. Vérifiez que l'imprimante \"NomImprimante\" existe et est accessible."
}
```

---

### 4. Test avec Ticket Complet (Exemple Réel)

Exemple avec un ticket de commande formaté :

#### PowerShell
```powershell
$ticketContent = @"
DOUDOU TACOS
123 Rue Example
Tel: 01 23 45 67 89

Commande #001
Date: 25/01/2026 14:30
Type: SUR PLACE
Caissier: Admin

─────────────────────
2x Tacos Classique XL    17.00
  + Sauce blanche
  + Frites
─────────────────────
1x Burger Deluxe         12.00
  + Fromage supplémentaire
─────────────────────

Sous-total:              29.00
Total:                   29.00

Paiement: Espèces
Montant reçu:            35.00
Monnaie:                  6.00

Merci de votre visite !
"@

$body = @{
    connectionType = "tcp"
    target = @{
        host = "192.168.1.100"
        port = 9100
    }
    content = $ticketContent
    isThermalPrinter = $true
    role = "cashier"
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri "http://127.0.0.1:9100/print" -Method POST -Body $body -ContentType "application/json"
```

---

## Vérification des Logs

Les logs du daemon s'affichent dans la console Electron. Pour les voir :

1. **En mode développement** : Les logs apparaissent dans le terminal où vous avez lancé `npm run electron:dev`
2. **En mode production** : Ouvrez les DevTools avec `F12` ou `Ctrl+Shift+I` et regardez la console

### Logs à surveiller

- `[PRINT-DAEMON] Creating server with resourcesPath: ...`
- `[PRINT-DAEMON] ✅ Print daemon server listening on http://127.0.0.1:9100`
- `[PRINT-DAEMON] Received POST /print request`
- `[PRINT-DAEMON] Sending to network printer: ...` ou `[PRINT-DAEMON] Sending to Windows printer: ...`
- `[PRINT-DAEMON] Network print successful` ou `[PRINT-DAEMON] Windows print successful`

---

## Dépannage

### Erreur : "ECONNREFUSED" ou "Connection refused"

**Cause** : Le daemon n'est pas démarré ou l'application Electron n'est pas lancée.

**Solution** : 
1. Lancez l'application Electron
2. Vérifiez les logs pour confirmer que le daemon a démarré
3. Vérifiez que le port 9100 n'est pas utilisé par un autre processus

### Erreur : "RawPrinterHelper.exe not found"

**Cause** : Le fichier `RawPrinterHelper.exe` n'est pas trouvé.

**Solution** :
1. Vérifiez que le fichier existe dans `print-daemon/RawPrinterHelper/RawPrinterHelper.exe`
2. Recompilez-le en mode self-contained si nécessaire
3. Vérifiez les logs pour voir le chemin exact recherché

### Erreur : "RawPrinterHelper exited with code 2147516547"

**Cause** : Runtime .NET manquant (erreur 0x80008083).

**Solution** :
1. Recompilez `RawPrinterHelper.exe` en mode self-contained :
   ```bash
   cd print-daemon/RawPrinterHelper
   dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true
   ```
2. Copiez le fichier compilé vers `print-daemon/RawPrinterHelper/RawPrinterHelper.exe`

---

## Script de Test Automatique

Créez un fichier `test-print-daemon.ps1` :

```powershell
# Test Print Daemon
Write-Host "=== Test Print Daemon ===" -ForegroundColor Cyan

# 1. Health Check
Write-Host "`n1. Test de santé..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:9100/health" -Method GET
    Write-Host "✅ Daemon actif: $($health.status)" -ForegroundColor Green
    Write-Host "   Version: $($health.version)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Daemon non accessible: $_" -ForegroundColor Red
    exit 1
}

# 2. Test impression réseau (remplacez par votre IP d'imprimante)
Write-Host "`n2. Test impression réseau..." -ForegroundColor Yellow
$body = @{
    connectionType = "tcp"
    target = @{
        host = "192.168.1.100"  # ← REMPLACEZ PAR VOTRE IP
        port = 9100
    }
    content = "Test Print Daemon`n`n$(Get-Date -Format 'dd/MM/yyyy HH:mm')`n`n"
    isThermalPrinter = $true
} | ConvertTo-Json -Depth 10

try {
    $result = Invoke-RestMethod -Uri "http://127.0.0.1:9100/print" -Method POST -Body $body -ContentType "application/json"
    if ($result.success) {
        Write-Host "✅ Impression réussie !" -ForegroundColor Green
    } else {
        Write-Host "❌ Échec: $($result.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
}

Write-Host "`n=== Fin des tests ===" -ForegroundColor Cyan
```

Exécutez-le avec :
```powershell
.\test-print-daemon.ps1
```
