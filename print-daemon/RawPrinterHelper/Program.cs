using System;
using System.IO;
using System.Runtime.InteropServices;

namespace RawPrinterHelper
{
    internal class Program
    {
        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        public class DOCINFO
        {
            [MarshalAs(UnmanagedType.LPWStr)]
            public string? pDocName;

            [MarshalAs(UnmanagedType.LPWStr)]
            public string? pOutputFile;

            [MarshalAs(UnmanagedType.LPWStr)]
            public string? pDataType;
        }

        [DllImport("winspool.Drv", EntryPoint = "OpenPrinterW",
            SetLastError = true, CharSet = CharSet.Unicode, ExactSpelling = true)]
        public static extern bool OpenPrinter(string src, out IntPtr hPrinter, IntPtr pd);

        [DllImport("winspool.Drv", SetLastError = true, ExactSpelling = true, CharSet = CharSet.Unicode)]
        public static extern bool ClosePrinter(IntPtr hPrinter);

        [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterW",
            SetLastError = true, CharSet = CharSet.Unicode, ExactSpelling = true)]
        public static extern bool StartDocPrinter(IntPtr hPrinter, int level,
            [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFO di);

        [DllImport("winspool.Drv", SetLastError = true, ExactSpelling = true)]
        public static extern bool EndDocPrinter(IntPtr hPrinter);

        [DllImport("winspool.Drv", SetLastError = true, ExactSpelling = true)]
        public static extern bool StartPagePrinter(IntPtr hPrinter);

        [DllImport("winspool.Drv", SetLastError = true, ExactSpelling = true)]
        public static extern bool EndPagePrinter(IntPtr hPrinter);

        [DllImport("winspool.Drv", SetLastError = true, ExactSpelling = true)]
        public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

        private static bool SendBytesToPrinter(string printerName, byte[] bytes)
        {
            IntPtr hPrinter = IntPtr.Zero;
            var di = new DOCINFO
            {
                pDocName = "QuickOrderHub ESC/POS Job",
                pDataType = "RAW"
            };

            try
            {
                if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero))
                    throw new Exception($"OpenPrinter failed: {Marshal.GetLastWin32Error()}");

                if (!StartDocPrinter(hPrinter, 1, di))
                    throw new Exception($"StartDocPrinter failed: {Marshal.GetLastWin32Error()}");

                if (!StartPagePrinter(hPrinter))
                    throw new Exception($"StartPagePrinter failed: {Marshal.GetLastWin32Error()}");

                IntPtr unmanagedBytes = Marshal.AllocHGlobal(bytes.Length);
                try
                {
                    Marshal.Copy(bytes, 0, unmanagedBytes, bytes.Length);

                    if (!WritePrinter(hPrinter, unmanagedBytes, bytes.Length, out int dwWritten) ||
                        dwWritten != bytes.Length)
                        throw new Exception($"WritePrinter failed: {Marshal.GetLastWin32Error()}");
                }
                finally
                {
                    Marshal.FreeHGlobal(unmanagedBytes);
                }

                if (!EndPagePrinter(hPrinter))
                    throw new Exception($"EndPagePrinter failed: {Marshal.GetLastWin32Error()}");

                if (!EndDocPrinter(hPrinter))
                    throw new Exception($"EndDocPrinter failed: {Marshal.GetLastWin32Error()}");

                return true;
            }
            finally
            {
                if (hPrinter != IntPtr.Zero)
                {
                    ClosePrinter(hPrinter);
                }
            }
        }

        private static int Main(string[] args)
        {
            string? printerName = null;
            string? filePath = null;

            for (int i = 0; i < args.Length; i++)
            {
                if (args[i] == "-p" && i + 1 < args.Length)
                {
                    printerName = args[++i];
                }
                else if (args[i] == "-f" && i + 1 < args.Length)
                {
                    filePath = args[++i];
                }
            }

            if (string.IsNullOrWhiteSpace(filePath) || !File.Exists(filePath))
            {
                Console.Error.WriteLine("Usage: RawPrinterHelper.exe -p \"NomImprimante\" -f \"C:\\chemin\\ticket.bin\"");
                return 1;
            }

            // Pour simplifier et éviter les dépendances supplémentaires,
            // on exige ici que le nom de l'imprimante soit passé via -p.
            if (string.IsNullOrWhiteSpace(printerName))
            {
                Console.Error.WriteLine("Aucun nom d'imprimante fourni. Utilisez -p \"NomImprimante\".");
                return 1;
            }

            try
            {
                // On lit le fichier tel quel (binaire) pour préserver tous les codes ESC/POS
                byte[] data = File.ReadAllBytes(filePath);
                if (!SendBytesToPrinter(printerName!, data))
                    throw new Exception("SendBytesToPrinter returned false");

                return 0;
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error: " + ex.Message);
                return 2;
            }
        }
    }
}

