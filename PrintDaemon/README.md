# PrintDaemon - Service d'impression ESC/POS

Service HTTP local pour l'impression directe sur imprimantes thermiques (USB et réseau).

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Program.cs                              │
│                   (Serveur HTTP :9100)                       │
│                                                              │
│   GET /status ─────► Retourne { running: true }              │
│   GET /printers ───► PrinterService.GetAvailablePrinters()   │
│   POST /print ─────► Lit body (bytes) puis :                 │
│                      │                                       │
│                      ├── Réseau? → PrinterService            │
│                      │              .PrintToNetworkAsync()   │
│                      │              (TCP Socket)             │
│                      │                                       │
│                      └── USB? ───► PrinterService            │
│                                    .PrintToUsb()             │
│                                    ↓                         │
│                                    RawPrinterHelper          │
│                                    .SendBytesToPrinter()     │
│                                    (Win32 API)               │
└─────────────────────────────────────────────────────────────┘
```

---

## Description des fichiers

### 1. `PrintDaemon.csproj` - Configuration du projet

Ce fichier dit à .NET comment compiler le projet.

| Section | Ce que ça fait |
|---------|----------------|
| `TargetFramework: net8.0` | Utilise .NET 8 |
| `OutputType: Exe` | Crée un `.exe` exécutable |
| `PublishSingleFile: true` | Tout en un seul fichier (pas de DLLs séparées) |
| `SelfContained: true` | Inclut le runtime .NET (pas besoin de l'installer) |
| `RuntimeIdentifier: win-x64` | Compile pour Windows 64-bit |

---

### 2. `Program.cs` - Point d'entrée + API HTTP

C'est le "cerveau" du daemon - il démarre le serveur web et définit les endpoints.

| Partie | Ce que ça fait |
|--------|----------------|
| `builder.WebHost.UseUrls("http://127.0.0.1:9100")` | Écoute uniquement en local sur le port 9100 |
| `app.UseCors(...)` | Autorise Electron à faire des requêtes |
| `app.MapGet("/status", ...)` | Endpoint pour vérifier si le daemon tourne |
| `app.MapGet("/printers", ...)` | Liste les imprimantes USB Windows |
| `app.MapPost("/print", ...)` | Reçoit les bytes ESC/POS et les imprime |
| `app.MapPost("/test", ...)` | Teste la connexion à une imprimante |
| `app.Run()` | Démarre le serveur et reste en écoute |

---

### 3. `Services/PrinterService.cs` - Logique métier

Contient la logique d'impression (USB et réseau).

| Méthode | Ce que ça fait |
|---------|----------------|
| `GetAvailablePrinters()` | Liste les imprimantes installées sur Windows |
| `PrintToUsb(printerName, data)` | Envoie les bytes à une imprimante USB via Win32 API |
| `PrintToNetworkAsync(address, data)` | Envoie les bytes via TCP socket (réseau) |
| `TestNetworkConnectionAsync(address)` | Vérifie si l'imprimante réseau répond |

**Flux réseau :**
```
data (bytes) → TcpClient → Socket TCP → IP:Port imprimante
```

---

### 4. `Services/RawPrinterHelper.cs` - API Windows bas niveau

Utilise les fonctions Win32 pour parler directement aux imprimantes USB (contourne le driver Windows standard).

| Fonction Win32 | Ce que ça fait |
|----------------|----------------|
| `OpenPrinter()` | Ouvre une connexion vers l'imprimante |
| `StartDocPrinter()` | Démarre un nouveau "document" d'impression |
| `StartPagePrinter()` | Démarre une page |
| `WritePrinter()` | **Envoie les bytes RAW** à l'imprimante |
| `EndPagePrinter()` | Termine la page |
| `EndDocPrinter()` | Termine le document |
| `ClosePrinter()` | Ferme la connexion |

**Flux USB :**
```
data (bytes) → Marshal.Copy → WritePrinter → winspool.drv → Imprimante USB
```

---

## Prérequis

- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- Windows 10/11 (pour les imprimantes USB via Win32 API)

## Développement

```bash
# Se placer dans le dossier
cd PrintDaemon

# Lancer en mode développement
dotnet run

# Le serveur démarre sur http://127.0.0.1:9100
```

## Compilation (Production)

```bash
# Compiler en un seul fichier .exe autonome
dotnet publish -c Release -r win-x64 --self-contained

# L'exécutable se trouve dans:
# bin/Release/net8.0/win-x64/publish/PrintDaemon.exe
```

## API Endpoints

### `GET /status`
Vérifie que le daemon est actif.

**Réponse:**
```json
{
  "running": true,
  "version": "1.0.0",
  "timestamp": "2024-01-15T10:30:00Z",
  "message": "PrintDaemon is running"
}
```

---

### `GET /printers`
Liste les imprimantes Windows installées.

**Réponse:**
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

### `POST /print`
Imprime des données ESC/POS brutes.

**Headers:**
- `X-Printer-Name` (requis): Nom de l'imprimante USB ou `IP:Port` pour réseau
- `X-Printer-Type` (optionnel): `"usb"` ou `"network"` (auto-détecté si l'adresse contient `:`)

**Body:** Bytes ESC/POS bruts (`application/octet-stream`)

**Exemple cURL:**
```bash
# Imprimante réseau
curl -X POST http://127.0.0.1:9100/print \
  -H "X-Printer-Name: 192.168.1.100:9100" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @ticket.bin

# Imprimante USB
curl -X POST http://127.0.0.1:9100/print \
  -H "X-Printer-Name: EPSON TM-T20II" \
  -H "X-Printer-Type: usb" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @ticket.bin
```

**Réponse:**
```json
{
  "success": true,
  "bytesWritten": 1024
}
```

---

### `POST /test`
Teste la connexion à une imprimante.

**Headers:**
- `X-Printer-Name`: Nom ou adresse de l'imprimante
- `X-Printer-Type`: `"usb"` ou `"network"`

**Réponse:**
```json
{
  "success": true,
  "message": "Connexion réseau OK à 192.168.1.100:9100"
}
```

---

### `POST /print/text`
Imprime du texte simple (converti automatiquement en ESC/POS).

**Headers:**
- `X-Printer-Name`: Nom ou adresse de l'imprimante

**Body (JSON):**
```json
{
  "text": "Bonjour!\nTest d'impression.",
  "cut": true
}
```

---

## Utilisation depuis JavaScript/TypeScript

```typescript
const DAEMON_URL = 'http://127.0.0.1:9100';

// Vérifier le status
async function checkDaemon(): Promise<boolean> {
  try {
    const res = await fetch(`${DAEMON_URL}/status`);
    const data = await res.json();
    return data.running === true;
  } catch {
    return false;
  }
}

// Imprimer des bytes ESC/POS
async function printEscPos(data: Uint8Array, printer: string): Promise<boolean> {
  const res = await fetch(`${DAEMON_URL}/print`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-Printer-Name': printer,
    },
    body: data,
  });
  const result = await res.json();
  return result.success;
}

// Lister les imprimantes USB
async function listPrinters(): Promise<string[]> {
  const res = await fetch(`${DAEMON_URL}/printers`);
  const data = await res.json();
  return data.printers || [];
}
```

---

## Structure du projet

```
PrintDaemon/
├── PrintDaemon.csproj      # Configuration du projet
├── Program.cs              # Point d'entrée + API endpoints
├── Services/
│   ├── PrinterService.cs   # Logique d'impression (USB + réseau)
│   └── RawPrinterHelper.cs # API Win32 pour impression USB
└── README.md
```

---

## Notes techniques

- **Port 9100**: Port standard pour les imprimantes réseau (RAW printing)
- **127.0.0.1 uniquement**: Le daemon n'écoute que localement pour des raisons de sécurité
- **Win32 API**: Utilise `winspool.drv` pour l'impression USB raw (contourne le driver GDI)
- **TCP Socket**: Connexion directe pour les imprimantes réseau
- **Pas de dépendances externes**: Utilise uniquement ASP.NET Core Minimal APIs (inclus dans le SDK)
