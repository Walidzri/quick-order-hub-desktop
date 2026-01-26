using System.Drawing.Printing;
using System.Net;
using System.Net.Sockets;
using System.Threading.Channels;

namespace PrintDaemon.Services;

/// <summary>
/// Service de gestion des imprimantes (USB et réseau)
/// Inclut une queue d'impression pour éviter les conflits
/// </summary>
public class PrinterService
{
    /// <summary>
    /// Résultat d'une opération d'impression
    /// </summary>
    public record PrintResult(bool Success, string? Error = null);

    /// <summary>
    /// Job d'impression dans la queue
    /// </summary>
    public record PrintJob(
        string PrinterName,
        byte[] Data,
        bool IsNetwork,
        TaskCompletionSource<PrintResult> Completion
    );

    // Queue d'impression (Channel = thread-safe, performant)
    private readonly Channel<PrintJob> _printQueue;
    private readonly Task _workerTask;

    public PrinterService()
    {
        // Queue non bornée, mais on pourrait limiter (ex: 100 jobs max)
        _printQueue = Channel.CreateUnbounded<PrintJob>(new UnboundedChannelOptions
        {
            SingleReader = true, // Un seul worker lit la queue
            SingleWriter = false // Plusieurs requêtes peuvent écrire
        });

        // Démarrer le worker en background
        _workerTask = Task.Run(ProcessPrintQueueAsync);
        Console.WriteLine("[QUEUE] ✅ Print worker started");
    }

    /// <summary>
    /// Worker qui traite les jobs un par un (évite les conflits)
    /// </summary>
    private async Task ProcessPrintQueueAsync()
    {
        await foreach (var job in _printQueue.Reader.ReadAllAsync())
        {
            PrintResult result;
            try
            {
                if (job.IsNetwork)
                {
                    result = await PrintToNetworkInternalAsync(job.PrinterName, job.Data);
                }
                else
                {
                    result = PrintToUsbInternal(job.PrinterName, job.Data);
                }
            }
            catch (Exception ex)
            {
                result = new PrintResult(false, ex.Message);
            }

            // Signaler le résultat au caller
            job.Completion.SetResult(result);
        }
    }

    /// <summary>
    /// Ajoute un job à la queue et attend le résultat
    /// </summary>
    public async Task<PrintResult> EnqueuePrintAsync(string printerName, byte[] data, bool isNetwork)
    {
        var tcs = new TaskCompletionSource<PrintResult>();
        var job = new PrintJob(printerName, data, isNetwork, tcs);

        await _printQueue.Writer.WriteAsync(job);
        Console.WriteLine($"[QUEUE] 📥 Job enqueued for '{printerName}' ({data.Length} bytes)");

        return await tcs.Task;
    }

    /// <summary>
    /// Détecte si l'adresse est une imprimante réseau ou USB
    /// </summary>
    public static bool IsNetworkPrinter(string printerName, string? printerTypeHeader)
    {
        // 1. Header explicite
        if (!string.IsNullOrEmpty(printerTypeHeader))
        {
            return printerTypeHeader.Equals("network", StringComparison.OrdinalIgnoreCase);
        }

        // 2. Format IP:Port (ex: "192.168.1.100:9100")
        if (printerName.Contains(':'))
        {
            var parts = printerName.Split(':');
            if (parts.Length == 2 && IPAddress.TryParse(parts[0], out _) && int.TryParse(parts[1], out _))
            {
                return true;
            }
        }

        // 3. IP seule sans port (ex: "192.168.1.100")
        if (IPAddress.TryParse(printerName, out _))
        {
            return true;
        }

        // 4. Sinon c'est USB
        return false;
    }

    /// <summary>
    /// Liste les imprimantes Windows installées
    /// </summary>
    public List<string> GetAvailablePrinters()
    {
        var printers = new List<string>();
        
        foreach (string printer in PrinterSettings.InstalledPrinters)
        {
            printers.Add(printer);
        }
        
        return printers;
    }

    /// <summary>
    /// Impression sur imprimante USB/locale via Win32 API (via queue)
    /// </summary>
    public Task<PrintResult> PrintToUsbAsync(string printerName, byte[] data)
    {
        return EnqueuePrintAsync(printerName, data, isNetwork: false);
    }

    /// <summary>
    /// Impression sur imprimante réseau via TCP Socket (via queue)
    /// </summary>
    public Task<PrintResult> PrintToNetworkAsync(string printerName, byte[] data)
    {
        return EnqueuePrintAsync(printerName, data, isNetwork: true);
    }

    /// <summary>
    /// Impression USB interne (appelée par le worker)
    /// </summary>
    private PrintResult PrintToUsbInternal(string printerName, byte[] data)
    {
        try
        {
            bool success = RawPrinterHelper.SendBytesToPrinter(printerName, data);
            
            if (success)
            {
                Console.WriteLine($"[USB] ✅ Imprimé {data.Length} bytes sur '{printerName}'");
                return new PrintResult(true);
            }
            else
            {
                return new PrintResult(false, "WritePrinter failed");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[USB] ❌ Erreur: {ex.Message}");
            return new PrintResult(false, ex.Message);
        }
    }

    /// <summary>
    /// Impression réseau interne (appelée par le worker)
    /// </summary>
    private async Task<PrintResult> PrintToNetworkInternalAsync(string address, byte[] data, int timeoutMs = 5000)
    {
        try
        {
            // Parser l'adresse (format: "192.168.1.100:9100" ou "192.168.1.100")
            var parts = address.Split(':');
            var ip = parts[0];
            var port = parts.Length > 1 ? int.Parse(parts[1]) : 9100;

            using var client = new TcpClient();
            
            // Connexion avec timeout
            using var cts = new CancellationTokenSource(timeoutMs);
            
            try
            {
                await client.ConnectAsync(ip, port, cts.Token);
            }
            catch (OperationCanceledException)
            {
                return new PrintResult(false, $"Timeout: impossible de se connecter à {address} en {timeoutMs}ms");
            }

            if (!client.Connected)
            {
                return new PrintResult(false, $"Connexion refusée par {address}");
            }

            // Envoyer les données
            using var stream = client.GetStream();
            await stream.WriteAsync(data, 0, data.Length);
            await stream.FlushAsync();

            Console.WriteLine($"[NET] ✅ Imprimé {data.Length} bytes sur '{address}'");
            return new PrintResult(true);
        }
        catch (SocketException ex)
        {
            Console.WriteLine($"[NET] ❌ Socket error: {ex.Message}");
            return new PrintResult(false, $"Erreur réseau: {ex.Message}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[NET] ❌ Erreur: {ex.Message}");
            return new PrintResult(false, ex.Message);
        }
    }

    /// <summary>
    /// Test de connexion réseau (sans envoyer de données)
    /// </summary>
    public async Task<bool> TestNetworkConnectionAsync(string address, int timeoutMs = 3000)
    {
        try
        {
            var parts = address.Split(':');
            var ip = parts[0];
            var port = parts.Length > 1 ? int.Parse(parts[1]) : 9100;

            using var client = new TcpClient();
            using var cts = new CancellationTokenSource(timeoutMs);
            
            try
            {
                await client.ConnectAsync(ip, port, cts.Token);
                
                if (client.Connected)
                {
                    Console.WriteLine($"[NET] ✅ Test OK: {address}");
                    return true;
                }
            }
            catch (OperationCanceledException)
            {
                Console.WriteLine($"[NET] ⏱️ Timeout: {address}");
            }

            return false;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[NET] ❌ Test échoué: {ex.Message}");
            return false;
        }
    }
}
