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

# 4. Test impression USB (si des imprimantes sont disponibles)
if ($printers.success -and $printers.printers.Count -gt 0) {
    Write-Host "4. Test impression USB..." -ForegroundColor Yellow
    $useUsb = Read-Host "   Tester l'impression USB ? (O/N)"
    if ($useUsb -eq "O" -or $useUsb -eq "o") {
        Write-Host "   Imprimantes disponibles:" -ForegroundColor Gray
        for ($i = 0; $i -lt $printers.printers.Count; $i++) {
            Write-Host "      $($i + 1). $($printers.printers[$i])" -ForegroundColor Gray
        }
        $choice = Read-Host "   Choisissez un numéro"
        $selectedPrinter = $printers.printers[[int]$choice - 1]
        
        if ($selectedPrinter) {
            Write-Host "   📤 Impression vers: $selectedPrinter" -ForegroundColor Gray
            $usbHeaders = @{
                "X-Printer-Name" = $selectedPrinter
                "X-Printer-Type" = "usb"
                "Content-Type" = "application/octet-stream"
            }
            
            try {
                $usbResult = Invoke-RestMethod -Uri "$baseUrl/print" -Method POST -Headers $usbHeaders -Body $escPosBytes -ContentType "application/octet-stream" -ErrorAction Stop
                if ($usbResult.success) {
                    Write-Host "   ✅ Impression USB réussie ! ($($usbResult.bytesWritten) bytes)" -ForegroundColor Green
                } else {
                    Write-Host "   ❌ Échec: $($usbResult.error)" -ForegroundColor Red
                }
            } catch {
                Write-Host "   ❌ Erreur: $_" -ForegroundColor Red
            }
        }
    }
}

Write-Host ""
Write-Host "=== Fin des tests ===" -ForegroundColor Cyan
