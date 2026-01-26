# Script de Test du Print Daemon
# Le daemon écoute sur http://127.0.0.1:9100

Write-Host "=== Test Print Daemon ===" -ForegroundColor Cyan
Write-Host "Assurez-vous que l'application Electron est lancée`n" -ForegroundColor Yellow

# 1. Health Check
Write-Host "1. Test de santé..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:9100/health" -Method GET -ErrorAction Stop
    Write-Host "   ✅ Daemon actif: $($health.status)" -ForegroundColor Green
    Write-Host "   📦 Version: $($health.version)" -ForegroundColor Gray
    Write-Host "   💬 Message: $($health.message)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Daemon non accessible: $_" -ForegroundColor Red
    Write-Host "   💡 Vérifiez que l'application Electron est lancée" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# 2. Test impression réseau
Write-Host "2. Test impression réseau (TCP/IP)..." -ForegroundColor Yellow
Write-Host "   ⚠️  Remplacez l'IP par celle de votre imprimante" -ForegroundColor Yellow

$printerIP = Read-Host "   Entrez l'IP de l'imprimante (ex: 192.168.1.100)"
if ([string]::IsNullOrWhiteSpace($printerIP)) {
    $printerIP = "192.168.1.100"
    Write-Host "   Utilisation de l'IP par défaut: $printerIP" -ForegroundColor Gray
}

$body = @{
    connectionType = "tcp"
    target = @{
        host = $printerIP
        port = 9100
    }
    content = "Test Print Daemon`n`nDate: $(Get-Date -Format 'dd/MM/yyyy HH:mm:ss')`n`nLigne 1`nLigne 2`nLigne 3`n`n"
    isThermalPrinter = $true
    role = "cashier"
} | ConvertTo-Json -Depth 10

try {
    Write-Host "   📤 Envoi vers $printerIP:9100..." -ForegroundColor Gray
    $result = Invoke-RestMethod -Uri "http://127.0.0.1:9100/print" -Method POST -Body $body -ContentType "application/json" -ErrorAction Stop
    if ($result.success) {
        Write-Host "   ✅ Impression réussie !" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Échec: $($result.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "   ❌ Erreur: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "   📄 Réponse: $responseBody" -ForegroundColor Gray
    }
}

Write-Host ""

# 3. Test impression Windows
Write-Host "3. Test impression Windows (Spooler)..." -ForegroundColor Yellow
$useWindows = Read-Host "   Tester l'impression Windows ? (O/N)"
if ($useWindows -eq "O" -or $useWindows -eq "o") {
    $printerName = Read-Host "   Entrez le nom de l'imprimante Windows"
    if ([string]::IsNullOrWhiteSpace($printerName)) {
        Write-Host "   ⚠️  Nom d'imprimante vide, test annulé" -ForegroundColor Yellow
    } else {
        $bodyWindows = @{
            connectionType = "windows"
            target = @{
                printerName = $printerName
            }
            content = "Test Print Daemon Windows`n`nDate: $(Get-Date -Format 'dd/MM/yyyy HH:mm:ss')`n`nLigne 1`nLigne 2`n`n"
            isThermalPrinter = $true
            role = "cashier"
        } | ConvertTo-Json -Depth 10

        try {
            Write-Host "   📤 Envoi vers imprimante Windows: $printerName..." -ForegroundColor Gray
            $result = Invoke-RestMethod -Uri "http://127.0.0.1:9100/print" -Method POST -Body $bodyWindows -ContentType "application/json" -ErrorAction Stop
            if ($result.success) {
                Write-Host "   ✅ Impression réussie !" -ForegroundColor Green
            } else {
                Write-Host "   ❌ Échec: $($result.message)" -ForegroundColor Red
            }
        } catch {
            Write-Host "   ❌ Erreur: $($_.Exception.Message)" -ForegroundColor Red
            if ($_.Exception.Response) {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $responseBody = $reader.ReadToEnd()
                Write-Host "   📄 Réponse: $responseBody" -ForegroundColor Gray
            }
        }
    }
}

Write-Host ""
Write-Host "=== Fin des tests ===" -ForegroundColor Cyan
Write-Host "💡 Consultez les logs dans la console Electron pour plus de détails" -ForegroundColor Yellow
