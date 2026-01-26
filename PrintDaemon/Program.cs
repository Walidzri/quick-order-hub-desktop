using PrintDaemon.Services;
using System.Text;

// Enregistrer le provider pour les encodages de code page (nécessaire pour CP437)
Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);

var builder = WebApplication.CreateBuilder(args);

// Configuration pour écouter uniquement en local (sécurité)
builder.WebHost.UseUrls("http://127.0.0.1:9100");

// Désactiver les logs verbeux en production
builder.Logging.SetMinimumLevel(LogLevel.Warning);

// Services
builder.Services.AddCors(); // Requis pour UseCors()
builder.Services.AddSingleton<PrinterService>();

var app = builder.Build();

// CORS restreint aux origines locales (sécurité)
app.UseCors(policy => policy
    .SetIsOriginAllowed(origin =>
    {
        // Autoriser uniquement les origines locales
        if (string.IsNullOrEmpty(origin)) return true; // Pas d'origine = appel local/Node
        var uri = new Uri(origin);
        return uri.Host == "localhost" || uri.Host == "127.0.0.1" || origin.StartsWith("app://");
    })
    .AllowAnyMethod()
    .AllowAnyHeader());

var printerService = app.Services.GetRequiredService<PrinterService>();

// ===== ENDPOINTS =====

/// <summary>
/// GET /status - Vérifie que le daemon est en cours d'exécution
/// </summary>
app.MapGet("/status", () => Results.Ok(new
{
    running = true,
    version = "1.1.0", // Version avec queue
    timestamp = DateTime.Now.ToString("o"),
    message = "PrintDaemon is running (with print queue)"
}));

/// <summary>
/// GET /printers - Liste les imprimantes Windows installées
/// </summary>
app.MapGet("/printers", () =>
{
    try
    {
        var printers = printerService.GetAvailablePrinters();
        return Results.Ok(new { success = true, printers });
    }
    catch (Exception ex)
    {
        return Results.Ok(new { success = false, error = ex.Message, printers = Array.Empty<string>() });
    }
});

/// <summary>
/// POST /print - Impression via queue (bytes ESC/POS dans le body)
/// Headers requis:
///   - X-Printer-Name: nom ou adresse IP:port de l'imprimante
///   - X-Printer-Type: "usb" ou "network" (optionnel, auto-détecté intelligemment)
/// Body: bytes ESC/POS bruts (application/octet-stream)
/// </summary>
app.MapPost("/print", async (HttpContext ctx) =>
{
    try
    {
        // Récupérer les headers
        var printerName = ctx.Request.Headers["X-Printer-Name"].ToString();
        var printerType = ctx.Request.Headers["X-Printer-Type"].ToString();

        if (string.IsNullOrEmpty(printerName))
        {
            return Results.BadRequest(new { success = false, error = "X-Printer-Name header is required" });
        }

        // Lire les bytes ESC/POS du body
        using var ms = new MemoryStream();
        await ctx.Request.Body.CopyToAsync(ms);
        byte[] data = ms.ToArray();

        if (data.Length == 0)
        {
            return Results.BadRequest(new { success = false, error = "Empty print data" });
        }

        // Déterminer le type d'imprimante (amélioration: détecte aussi IP sans port)
        bool isNetwork = PrinterService.IsNetworkPrinter(printerName, printerType);

        // Envoyer à la queue (évite les conflits d'impression simultanée)
        var result = await printerService.EnqueuePrintAsync(printerName, data, isNetwork);

        if (result.Success)
        {
            return Results.Ok(new { success = true, bytesWritten = data.Length });
        }
        else
        {
            return Results.Ok(new { success = false, error = result.Error ?? "Unknown error" });
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[ERROR] /print: {ex.Message}");
        return Results.Ok(new { success = false, error = ex.Message });
    }
});

/// <summary>
/// POST /print/with-logo - Impression avec logo (JSON dans le body)
/// Headers requis:
///   - X-Printer-Name: nom ou adresse IP:port de l'imprimante
///   - X-Printer-Type: "usb" ou "network" (optionnel, auto-détecté intelligemment)
/// Body JSON: { "logo": "base64...", "data": "base64..." } où data est les bytes ESC/POS en base64
/// </summary>
app.MapPost("/print/with-logo", async (HttpContext ctx) =>
{
    try
    {
        // Récupérer les headers
        var printerName = ctx.Request.Headers["X-Printer-Name"].ToString();
        var printerType = ctx.Request.Headers["X-Printer-Type"].ToString();

        if (string.IsNullOrEmpty(printerName))
        {
            return Results.BadRequest(new { success = false, error = "X-Printer-Name header is required" });
        }

        // Lire le JSON du body
        using var reader = new StreamReader(ctx.Request.Body);
        var body = await reader.ReadToEndAsync();
        
        string? logoBase64 = null;
        string? dataBase64 = null;
        int logoSize = 50; // Taille par défaut: 50% (288px)
        
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(body);
            var root = doc.RootElement;
            
            if (root.TryGetProperty("logo", out var logoProp))
            {
                logoBase64 = logoProp.GetString();
            }
            
            if (root.TryGetProperty("data", out var dataProp))
            {
                dataBase64 = dataProp.GetString();
            }
            
            if (root.TryGetProperty("logoSize", out var logoSizeProp))
            {
                if (logoSizeProp.ValueKind == System.Text.Json.JsonValueKind.Number)
                {
                    logoSize = logoSizeProp.GetInt32();
                }
            }
        }
        catch (Exception jsonEx)
        {
            Console.WriteLine($"[ERROR] Failed to parse JSON: {jsonEx.Message}");
            return Results.BadRequest(new { success = false, error = "Invalid JSON format" });
        }

        if (string.IsNullOrEmpty(dataBase64))
        {
            return Results.BadRequest(new { success = false, error = "Missing 'data' field in JSON" });
        }

        // Décoder les données ESC/POS
        byte[] data = Convert.FromBase64String(dataBase64);

        // Construire les données finales (logo + données ESC/POS)
        var finalData = new List<byte>();

        // Ajouter le logo si présent (avant les données ESC/POS)
        if (!string.IsNullOrEmpty(logoBase64))
        {
            try
            {
                // Calculer la largeur maximale en pixels basée sur le pourcentage
                // Largeur imprimante = 576px (80mm à 203 DPI)
                int maxWidth = (int)(576 * (logoSize / 100.0));
                byte[] logoBytes = ImageConverter.ConvertBase64ToEscPos(logoBase64, maxWidth);
                if (logoBytes.Length > 0)
                {
                    // Le logo est déjà centré dans les bytes (padding calculé dans ImageConverter)
                    finalData.AddRange(logoBytes);
                    
                    // Ajouter un saut de ligne après le logo pour séparer du contenu
                    finalData.Add(0x0A); // LF
                    Console.WriteLine($"[LOGO] ✅ Logo converti et ajouté (centré, {logoBytes.Length} bytes)");
                }
            }
            catch (Exception logoEx)
            {
                Console.WriteLine($"[LOGO] ⚠️ Erreur conversion logo (ignoré): {logoEx.Message}");
                // Continue sans logo si erreur
            }
        }

        // Ajouter les données ESC/POS
        // Supprimer les retours à la ligne et initialisations redondantes au début
        if (data.Length > 0)
        {
            int startIndex = 0;
            
            // Ignorer les retours à la ligne et initialisations au début
            while (startIndex < data.Length)
            {
                // Ignorer les retours à la ligne (LF, CR)
                if (data[startIndex] == 0x0A || data[startIndex] == 0x0D)
                {
                    startIndex++;
                    continue;
                }
                
                // Si on trouve ESC @ (initialisation), la garder mais ignorer les retours à la ligne qui suivent
                if (data[startIndex] == 0x1B && startIndex + 1 < data.Length && data[startIndex + 1] == 0x40)
                {
                    // Garder ESC @ mais continuer après
                    startIndex += 2;
                    // Ignorer les retours à la ligne qui suivent
                    while (startIndex < data.Length && (data[startIndex] == 0x0A || data[startIndex] == 0x0D))
                    {
                        startIndex++;
                    }
                    break;
                }
                
                // Sinon, on a trouvé le début du contenu réel
                break;
            }
            
            // Ajouter les données à partir de startIndex
            if (startIndex < data.Length)
            {
                byte[] trimmedData = new byte[data.Length - startIndex];
                Array.Copy(data, startIndex, trimmedData, 0, trimmedData.Length);
                finalData.AddRange(trimmedData);
            }
        }

        if (finalData.Count == 0)
        {
            return Results.BadRequest(new { success = false, error = "No data to print" });
        }

        // Déterminer le type d'imprimante
        bool isNetwork = PrinterService.IsNetworkPrinter(printerName, printerType);

        // Envoyer à la queue
        var result = await printerService.EnqueuePrintAsync(printerName, finalData.ToArray(), isNetwork);

        if (result.Success)
        {
            return Results.Ok(new { success = true, bytesWritten = finalData.Count });
        }
        else
        {
            return Results.Ok(new { success = false, error = result.Error ?? "Unknown error" });
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[ERROR] /print/with-logo: {ex.Message}");
        return Results.Ok(new { success = false, error = ex.Message });
    }
});

/// <summary>
/// POST /test - Test de connexion à une imprimante
/// </summary>
app.MapPost("/test", async (HttpContext ctx) =>
{
    try
    {
        var printerName = ctx.Request.Headers["X-Printer-Name"].ToString();
        var printerType = ctx.Request.Headers["X-Printer-Type"].ToString();

        if (string.IsNullOrEmpty(printerName))
        {
            return Results.BadRequest(new { success = false, error = "X-Printer-Name header is required" });
        }

        bool isNetwork = PrinterService.IsNetworkPrinter(printerName, printerType);

        bool success;
        string message;

        if (isNetwork)
        {
            success = await printerService.TestNetworkConnectionAsync(printerName);
            message = success ? $"Connexion réseau OK à {printerName}" : $"Impossible de se connecter à {printerName}";
        }
        else
        {
            // Pour USB, on envoie juste une commande d'initialisation via la queue
            byte[] initCommand = new byte[] { 0x1B, 0x40 }; // ESC @ (Initialize printer)
            var result = await printerService.EnqueuePrintAsync(printerName, initCommand, isNetwork: false);
            success = result.Success;
            message = success ? $"Imprimante USB OK: {printerName}" : $"Erreur USB: {result.Error}";
        }

        return Results.Ok(new { success, message });
    }
    catch (Exception ex)
    {
        return Results.Ok(new { success = false, error = ex.Message });
    }
});

/// <summary>
/// POST /print/text - Impression de texte simple (converti en ESC/POS)
/// Body JSON: { "text": "...", "cut": true }
/// </summary>
app.MapPost("/print/text", async (HttpContext ctx) =>
{
    try
    {
        var printerName = ctx.Request.Headers["X-Printer-Name"].ToString();
        var printerType = ctx.Request.Headers["X-Printer-Type"].ToString();

        if (string.IsNullOrEmpty(printerName))
        {
            return Results.BadRequest(new { success = false, error = "X-Printer-Name header is required" });
        }

        // Lire le JSON
        using var reader = new StreamReader(ctx.Request.Body);
        var body = await reader.ReadToEndAsync();
        
        // Parser JSON avec System.Text.Json (disponible dans .NET 8)
        string text = "";
        bool cut = false;
        
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(body);
            var root = doc.RootElement;
            
            if (root.TryGetProperty("text", out var textProp))
            {
                text = textProp.GetString() ?? "";
            }
            
            if (root.TryGetProperty("cut", out var cutProp))
            {
                cut = cutProp.ValueKind == System.Text.Json.JsonValueKind.True || 
                      (cutProp.ValueKind == System.Text.Json.JsonValueKind.String && 
                       cutProp.GetString()?.ToLower() == "true");
            }
        }
        catch (Exception jsonEx)
        {
            Console.WriteLine($"[ERROR] Failed to parse JSON: {jsonEx.Message}");
            return Results.BadRequest(new { success = false, error = "Invalid JSON format" });
        }

        // Construire les commandes ESC/POS
        var commands = new List<byte>();
        
        // Initialize
        commands.AddRange(new byte[] { 0x1B, 0x40 });
        
        // Texte (encodé en CP437 pour compatibilité avec imprimantes ESC/POS)
        // CP437 est le code page standard pour les imprimantes thermiques
        Encoding cp437 = Encoding.GetEncoding(437);
        commands.AddRange(cp437.GetBytes(text));
        
        // Saut de ligne
        commands.AddRange(new byte[] { 0x0A, 0x0A, 0x0A });
        
        // Coupe si demandé
        if (cut)
        {
            commands.AddRange(new byte[] { 0x1D, 0x56, 0x00 }); // GS V 0 (Full cut)
        }

        byte[] data = commands.ToArray();
        bool isNetwork = PrinterService.IsNetworkPrinter(printerName, printerType);

        // Envoyer à la queue
        var result = await printerService.EnqueuePrintAsync(printerName, data, isNetwork);

        return Results.Ok(new { success = result.Success, error = result.Error });
    }
    catch (Exception ex)
    {
        return Results.Ok(new { success = false, error = ex.Message });
    }
});

// Helper pour extraire une valeur JSON (remplacé par System.Text.Json dans /print/text)
// Conservé pour compatibilité si utilisé ailleurs
static string? ExtractJsonValue(string json, string key)
{
    var pattern = $"\"{key}\"\\s*:\\s*\"?([^\"\\,\\}}]+)\"?";
    var match = System.Text.RegularExpressions.Regex.Match(json, pattern);
    return match.Success ? match.Groups[1].Value.Trim() : null;
}

// Démarrage
Console.WriteLine("╔════════════════════════════════════════════╗");
Console.WriteLine("║     🖨️  PrintDaemon v1.1.0                  ║");
Console.WriteLine("║     Quick Order Hub - Print Service        ║");
Console.WriteLine("╠════════════════════════════════════════════╣");
Console.WriteLine("║  ✅ Print Queue: enabled (thread-safe)     ║");
Console.WriteLine("║  ✅ CORS: localhost only                   ║");
Console.WriteLine("║  ✅ IP detection: improved                 ║");
Console.WriteLine("╠════════════════════════════════════════════╣");
Console.WriteLine("║  Listening on: http://127.0.0.1:9100       ║");
Console.WriteLine("║  Endpoints:                                ║");
Console.WriteLine("║    GET  /status   - Check daemon status    ║");
Console.WriteLine("║    GET  /printers - List USB printers      ║");
Console.WriteLine("║    POST /print    - Print ESC/POS (queued) ║");
Console.WriteLine("║    POST /print/with-logo - Print with logo ║");
Console.WriteLine("║    POST /test     - Test printer conn.     ║");
Console.WriteLine("╚════════════════════════════════════════════╝");

app.Run();
