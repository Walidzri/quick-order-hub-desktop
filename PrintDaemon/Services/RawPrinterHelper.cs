using System.Runtime.InteropServices;

namespace PrintDaemon.Services;

/// <summary>
/// Classe utilitaire pour envoyer des données brutes (RAW) à une imprimante Windows
/// Utilise les API Win32 winspool.drv pour contourner le driver GDI
/// </summary>
public static class RawPrinterHelper
{
    #region Win32 Structures

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    private class DOCINFOA
    {
        [MarshalAs(UnmanagedType.LPStr)]
        public string? pDocName;
        [MarshalAs(UnmanagedType.LPStr)]
        public string? pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)]
        public string? pDataType;
    }

    #endregion

    #region Win32 API Imports

    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    private static extern bool OpenPrinter(
        [MarshalAs(UnmanagedType.LPStr)] string szPrinter,
        out IntPtr hPrinter,
        IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    private static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    private static extern bool StartDocPrinter(
        IntPtr hPrinter,
        int level,
        [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    private static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    private static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    private static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    private static extern bool WritePrinter(
        IntPtr hPrinter,
        IntPtr pBytes,
        int dwCount,
        out int dwWritten);

    #endregion

    /// <summary>
    /// Envoie des bytes directement à l'imprimante Windows en mode RAW
    /// </summary>
    /// <param name="printerName">Nom de l'imprimante Windows (ex: "EPSON TM-T20II")</param>
    /// <param name="data">Données ESC/POS à envoyer</param>
    /// <returns>true si l'envoi a réussi</returns>
    public static bool SendBytesToPrinter(string printerName, byte[] data)
    {
        IntPtr hPrinter = IntPtr.Zero;
        
        DOCINFOA di = new()
        {
            pDocName = "Quick Order Hub - ESC/POS Print Job",
            pDataType = "RAW"
        };

        bool success = false;

        try
        {
            // 1. Ouvrir l'imprimante
            if (!OpenPrinter(printerName.Normalize(), out hPrinter, IntPtr.Zero))
            {
                int error = Marshal.GetLastWin32Error();
                throw new Exception($"OpenPrinter failed for '{printerName}' (Win32 error: {error})");
            }

            // 2. Démarrer le document
            if (!StartDocPrinter(hPrinter, 1, di))
            {
                int error = Marshal.GetLastWin32Error();
                throw new Exception($"StartDocPrinter failed (Win32 error: {error})");
            }

            try
            {
                // 3. Démarrer la page
                if (!StartPagePrinter(hPrinter))
                {
                    int error = Marshal.GetLastWin32Error();
                    throw new Exception($"StartPagePrinter failed (Win32 error: {error})");
                }

                try
                {
                    // 4. Écrire les données
                    IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(data.Length);
                    
                    try
                    {
                        Marshal.Copy(data, 0, pUnmanagedBytes, data.Length);

                        if (!WritePrinter(hPrinter, pUnmanagedBytes, data.Length, out int dwWritten))
                        {
                            int error = Marshal.GetLastWin32Error();
                            throw new Exception($"WritePrinter failed (Win32 error: {error})");
                        }

                        success = (dwWritten == data.Length);
                        
                        if (!success)
                        {
                            Console.WriteLine($"[WARN] WritePrinter: wrote {dwWritten}/{data.Length} bytes");
                        }
                    }
                    finally
                    {
                        Marshal.FreeCoTaskMem(pUnmanagedBytes);
                    }
                }
                finally
                {
                    EndPagePrinter(hPrinter);
                }
            }
            finally
            {
                EndDocPrinter(hPrinter);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ERROR] RawPrinterHelper: {ex.Message}");
            throw;
        }
        finally
        {
            // 5. Fermer l'imprimante
            if (hPrinter != IntPtr.Zero)
            {
                ClosePrinter(hPrinter);
            }
        }

        return success;
    }

    /// <summary>
    /// Vérifie si une imprimante existe dans le système
    /// </summary>
    public static bool PrinterExists(string printerName)
    {
        if (OpenPrinter(printerName, out IntPtr hPrinter, IntPtr.Zero))
        {
            ClosePrinter(hPrinter);
            return true;
        }
        return false;
    }
}
