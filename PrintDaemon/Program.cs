using PrintDaemon.Services;

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
        
        // Parser simple (sans dépendance JSON)
        var text = ExtractJsonValue(body, "text") ?? "";
        var cut = ExtractJsonValue(body, "cut")?.ToLower() == "true";

        // Construire les commandes ESC/POS
        var commands = new List<byte>();
        
        // Initialize
        commands.AddRange(new byte[] { 0x1B, 0x40 });
        
        // Texte (encodé en CP437 pour compatibilité)
        commands.AddRange(System.Text.Encoding.GetEncoding(437).GetBytes(text));
        
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

// Helper pour extraire une valeur JSON sans dépendance
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
Console.WriteLine("║    POST /test     - Test printer conn.     ║");
Console.WriteLine("╚════════════════════════════════════════════╝");

app.Run();
