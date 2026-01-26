# Guide de Test - PrintDaemon C#

Le PrintDaemon est un serveur HTTP C# qui écoute en permanence sur `http://127.0.0.1:9100`.

## 🚀 Démarrage

### Mode Développement
```bash
cd PrintDaemon
dotnet run
```

### Mode Production (compilé)
```bash
cd PrintDaemon
dotnet publish -c Release -r win-x64 --self-contained
.\bin\Release\net8.0\win-x64\publish\PrintDaemon.exe
```

Le serveur démarre et affiche :
```
╔════════════════════════════════════════════╗
║     🖨️  PrintDaemon v1.1.0                  ║
║     Quick Order Hub - Print Service        ║
╠════════════════════════════════════════════╣
║  ✅ Print Queue: enabled (thread-safe)     ║
║  ✅ CORS: localhost only                   ║
║  ✅ IP detection: improved                 ║
╠════════════════════════════════════════════╣
║  Listening on: http://127.0.0.1:9100       ║
```

---

## 📋 Tests des Endpoints

### 1. Test de Santé (Health Check)

**PowerShell :**
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:9100/status" -Method GET
```

**cURL :**
```bash
curl http://127.0.0.1:9100/status
```

**Réponse attendue :**
```json
{
  "running": true,
  "version": "1.1.0",
  "timestamp": "2026-01-25T22:30:00Z",
  "message": "PrintDaemon is running (with print queue)"
}
```

---

### 2. Lister les Imprimantes USB Windows

**PowerShell :**
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:9100/printers" -Method GET
```

**cURL :**
```bash
curl http://127.0.0.1:9100/printers
```

**Réponse attendue :**
```json
{
  "success": true,
  "printers": [
    "EPSON TM-T20II",
    "Microsoft Print to PDF",
    "OneNote"
  ]
}
```

---

### 3. Test de Connexion à une Imprimante

#### Test Imprimante Réseau

**PowerShell :**
```powershell
$headers = @{
    "X-Printer-Name" = "192.168.1.100:9100"
    "X-Printer-Type" = "network"
}

Invoke-RestMethod -Uri "http://127.0.0.1:9100/test" -Method POST -Headers $headers
```

**cURL :**
```bash
curl -X POST http://127.0.0.1:9100/test \
  -H "X-Printer-Name: 192.168.1.100:9100" \
  -H "X-Printer-Type: network"
```

#### Test Imprimante USB

**PowerShell :**
```powershell
$headers = @{
    "X-Printer-Name" = "EPSON TM-T20II"
    "X-Printer-Type" = "usb"
}

Invoke-RestMethod -Uri "http://127.0.0.1:9100/test" -Method POST -Headers $headers
```

**cURL :**
```bash
curl -X POST http://127.0.0.1:9100/test \
  -H "X-Printer-Name: EPSON TM-T20II" \
  -H "X-Printer-Type: usb"
```

**Réponse attendue :**
```json
{
  "success": true,
  "message": "Connexion réseau OK à 192.168.1.100:9100"
}
```

---

### 4. Impression ESC/POS (Bytes Bruts)

#### Impression Réseau

**PowerShell :**
```powershell
# Créer un fichier de test (bytes ESC/POS)
$escPosBytes = [byte[]](0x1B, 0x40, 0x48, 0x65, 0x6C, 0x6C, 0x6F, 0x0A, 0x0A, 0x0A, 0x1D, 0x56, 0x00)
# 0x1B 0x40 = ESC @ (Initialize)
# 0x48 0x65 0x6C 0x6C 0x6F = "Hello"
# 0x0A = Line feed
# 0x1D 0x56 0x00 = GS V 0 (Cut)

$headers = @{
    "X-Printer-Name" = "192.168.1.100:9100"
    "X-Printer-Type" = "network"
    "Content-Type" = "application/octet-stream"
}

Invoke-RestMethod -Uri "http://127.0.0.1:9100/print" -Method POST -Headers $headers -Body $escPosBytes -ContentType "application/octet-stream"
```

**cURL :**
```bash
# Créer un fichier test.bin avec les bytes ESC/POS
echo -ne '\x1B\x40Hello\n\n\n\x1D\x56\x00' > test.bin

curl -X POST http://127.0.0.1:9100/print \
  -H "X-Printer-Name: 192.168.1.100:9100" \
  -H "X-Printer-Type: network" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @test.bin
```

#### Impression USB

**PowerShell :**
```powershell
$escPosBytes = [byte[]](0x1B, 0x40, 0x48, 0x65, 0x6C, 0x6C, 0x6F, 0x0A, 0x0A, 0x0A, 0x1D, 0x56, 0x00)

$headers = @{
    "X-Printer-Name" = "EPSON TM-T20II"
    "X-Printer-Type" = "usb"
    "Content-Type" = "application/octet-stream"
}

Invoke-RestMethod -Uri "http://127.0.0.1:9100/print" -Method POST -Headers $headers -Body $escPosBytes -ContentType "application/octet-stream"
```

**Réponse attendue :**
```json
{
  "success": true,
  "bytesWritten": 13
}
```

---

### 5. Impression de Texte Simple (Auto-conversion ESC/POS)

**PowerShell :**
```powershell
$body = @{
    text = "Test d'impression`n`nDate: $(Get-Date -Format 'dd/MM/yyyy HH:mm')`n`nLigne 1`nLigne 2`n`n"
    cut = $true
} | ConvertTo-Json

$headers = @{
    "X-Printer-Name" = "192.168.1.100:9100"
    "Content-Type" = "application/json"
}

Invoke-RestMethod -Uri "http://127.0.0.1:9100/print/text" -Method POST -Headers $headers -Body $body -ContentType "application/json"
```

**cURL :**
```bash
curl -X POST http://127.0.0.1:9100/print/text \
  -H "X-Printer-Name: 192.168.1.100:9100" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Test impression\n\nLigne 1\nLigne 2\n\n",
    "cut": true
  }'
```

**Réponse attendue :**
```json
{
  "success": true
}
```

---

## 🔧 Script de Test Complet

Créez un fichier `test-printdaemon.ps1` :

```powershell
# Test PrintDaemon C#
Write-Host "=== Test PrintDaemon C# ===" -ForegroundColor Cyan
Write-Host "Assurez-vous que PrintDaemon.exe est lancé`n" -ForegroundColor Yellow

$baseUrl = "http://127.0.0.1:9100"

# 1. Health Check
Write-Host "1. Test de santé..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/status" -Method GET -ErrorAction Stop
    Write-Host "   ✅ Daemon actif: $($health.running)" -ForegroundColor Green
    Write-Host "   📦 Version: $($health.version)" -ForegroundColor Gray
    Write-Host "   💬 Message: $($health.message)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Daemon non accessible: $_" -ForegroundColor Red
    Write-Host "   💡 Lancez PrintDaemon.exe d'abord" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# 2. Lister les imprimantes
Write-Host "2. Liste des imprimantes USB..." -ForegroundColor Yellow
try {
    $printers = Invoke-RestMethod -Uri "$baseUrl/printers" -Method GET -ErrorAction Stop
    if ($printers.success) {
        Write-Host "   ✅ Imprimantes trouvées:" -ForegroundColor Green
        foreach ($printer in $printers.printers) {
            Write-Host "      - $printer" -ForegroundColor Gray
        }
    } else {
        Write-Host "   ⚠️  Aucune imprimante trouvée" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ Erreur: $_" -ForegroundColor Red
}

Write-Host ""

# 3. Test impression réseau
Write-Host "3. Test impression réseau..." -ForegroundColor Yellow
$printerIP = Read-Host "   Entrez l'IP de l'imprimante (ex: 192.168.1.100:9100)"
if ([string]::IsNullOrWhiteSpace($printerIP)) {
    $printerIP = "192.168.1.100:9100"
    Write-Host "   Utilisation de l'IP par défaut: $printerIP" -ForegroundColor Gray
}

# Test de connexion
Write-Host "   🔍 Test de connexion..." -ForegroundColor Gray
$testHeaders = @{
    "X-Printer-Name" = $printerIP
    "X-Printer-Type" = "network"
}
try {
    $testResult = Invoke-RestMethod -Uri "$baseUrl/test" -Method POST -Headers $testHeaders -ErrorAction Stop
    if ($testResult.success) {
        Write-Host "   ✅ $($testResult.message)" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Échec: $($testResult.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "   ❌ Erreur: $_" -ForegroundColor Red
}

# Impression test
Write-Host "   📤 Envoi d'une impression test..." -ForegroundColor Gray
$escPosBytes = [byte[]](0x1B, 0x40) + [System.Text.Encoding]::ASCII.GetBytes("Test PrintDaemon`n`n$(Get-Date -Format 'dd/MM/yyyy HH:mm')`n`n") + [byte[]](0x1D, 0x56, 0x00)

$printHeaders = @{
    "X-Printer-Name" = $printerIP
    "X-Printer-Type" = "network"
    "Content-Type" = "application/octet-stream"
}

try {
    $printResult = Invoke-RestMethod -Uri "$baseUrl/print" -Method POST -Headers $printHeaders -Body $escPosBytes -ContentType "application/octet-stream" -ErrorAction Stop
    if ($printResult.success) {
        Write-Host "   ✅ Impression réussie ! ($($printResult.bytesWritten) bytes)" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Échec: $($printResult.error)" -ForegroundColor Red
    }
} catch {
    Write-Host "   ❌ Erreur: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Fin des tests ===" -ForegroundColor Cyan
```

---

## 📝 Notes Importantes

1. **Le daemon doit être lancé en permanence** : C'est un service qui écoute en continu
2. **Port 9100** : Port standard pour les imprimantes réseau RAW
3. **Localhost uniquement** : Le daemon n'écoute que sur `127.0.0.1` pour la sécurité
4. **Queue d'impression** : Les impressions sont mises en queue pour éviter les conflits
5. **Auto-détection** : Si `X-Printer-Type` n'est pas fourni, le type est détecté automatiquement (IP = réseau, sinon USB)

---

## 🐛 Dépannage

### Erreur : "Connection refused"
- Vérifiez que `PrintDaemon.exe` est lancé
- Vérifiez que le port 9100 n'est pas utilisé par un autre processus

### Erreur : "X-Printer-Name header is required"
- Ajoutez le header `X-Printer-Name` dans votre requête

### Erreur : "Empty print data"
- Vérifiez que le body contient bien des bytes (pour `/print`)
- Vérifiez que le JSON contient `"text"` (pour `/print/text`)
