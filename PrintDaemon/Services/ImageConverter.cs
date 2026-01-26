using System.Drawing;
using System.Drawing.Imaging;
using System.Security.Cryptography;
using System.Text;

namespace PrintDaemon.Services;

/// <summary>
/// Convertit une image (base64) en bitmap monochrome ESC/POS avec cache
/// </summary>
public static class ImageConverter
{
    /// <summary>
    /// Largeur standard d'une imprimante thermique 80mm (en pixels à 203 DPI)
    /// </summary>
    private const int PrinterWidth = 576; // 80mm * 203 DPI / 25.4mm ≈ 576 pixels
    
    /// <summary>
    /// Largeur maximale pour le logo (50% de la largeur imprimante pour une taille cohérente)
    /// </summary>
    private const int LogoMaxWidth = 288; // 50% de 576px = 288px

    // Cache des logos convertis (clé = hash MD5 du base64, valeur = bytes ESC/POS)
    private static readonly Dictionary<string, byte[]> _logoCache = new();
    private static readonly object _cacheLock = new();

    /// <summary>
    /// Convertit une image base64 en commandes ESC/POS bitmap monochrome
    /// Utilise GS v 0 (raster format) pour meilleure compatibilité
    /// </summary>
    /// <param name="base64Image">Image en base64 (data URL ou base64 pur)</param>
    /// <param name="maxWidth">Largeur maximale en pixels (par défaut: 50% de la largeur imprimante pour une taille cohérente)</param>
    /// <returns>Bytes ESC/POS pour imprimer l'image</returns>
    public static byte[] ConvertBase64ToEscPos(string base64Image, int maxWidth = LogoMaxWidth)
    {
        try
        {
            // Nettoyer le data URL si présent (ex: "data:image/png;base64,...")
            string base64Data = base64Image;
            if (base64Image.Contains(","))
            {
                base64Data = base64Image.Split(',')[1];
            }

            // Vérifier le cache (la clé inclut maintenant la taille pour éviter les conflits)
            string cacheKey = GetCacheKey(base64Data, maxWidth);
            lock (_cacheLock)
            {
                if (_logoCache.TryGetValue(cacheKey, out byte[]? cachedBytes))
                {
                    Console.WriteLine($"[LOGO] ✅ Logo récupéré du cache (taille: {maxWidth}px, {cachedBytes.Length} bytes)");
                    return cachedBytes;
                }
            }

            // Décoder base64 en bytes
            byte[] imageBytes = Convert.FromBase64String(base64Data);

            // Charger l'image
            using var ms = new MemoryStream(imageBytes);
            using var originalImage = Image.FromStream(ms);

            // Redimensionner si nécessaire (garder le ratio, max 288px de largeur pour une taille cohérente)
            int targetWidth = Math.Min(originalImage.Width, maxWidth);
            int targetHeight = (int)(originalImage.Height * ((double)targetWidth / originalImage.Width));

            // Créer un bitmap avec fond blanc pour gérer la transparence
            using var resizedImage = new Bitmap(targetWidth, targetHeight, PixelFormat.Format32bppArgb);
            using (var g = Graphics.FromImage(resizedImage))
            {
                // Remplir avec un fond blanc (pour gérer la transparence)
                g.Clear(Color.White);
                g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                g.CompositingMode = System.Drawing.Drawing2D.CompositingMode.SourceOver;
                g.CompositingQuality = System.Drawing.Drawing2D.CompositingQuality.HighQuality;
                // Dessiner l'image (les pixels transparents laisseront le fond blanc visible)
                g.DrawImage(originalImage, 0, 0, targetWidth, targetHeight);
            }

            using var monochromeBitmap = ConvertToMonochromeWithDithering(resizedImage);
            using var trimmed = TrimVerticalWhiteSpace1bpp(monochromeBitmap); // <<< NEW
            byte[] escPosBytes = GenerateEscPosRaster(trimmed);

            // Mettre en cache
            lock (_cacheLock)
            {
                _logoCache[cacheKey] = escPosBytes;
                // Limiter le cache à 10 logos max pour éviter la consommation mémoire
                if (_logoCache.Count > 10)
                {
                    var firstKey = _logoCache.Keys.First();
                    _logoCache.Remove(firstKey);
                }
            }



            return escPosBytes;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[IMAGE] ❌ Erreur conversion image: {ex.Message}");
            return Array.Empty<byte>(); // Retourne vide en cas d'erreur (n'empêche pas l'impression)
        }
    }

    /// <summary>
    /// Génère une clé de cache MD5 à partir du base64 et de la taille
    /// </summary>
    private static string GetCacheKey(string base64Data, int maxWidth)
    {
        using var md5 = MD5.Create();
        // Inclure la taille dans la clé de cache pour éviter les conflits entre différentes tailles
        string keyData = $"{base64Data}|{maxWidth}";
        byte[] hash = md5.ComputeHash(Encoding.UTF8.GetBytes(keyData));
        return Convert.ToBase64String(hash);
    }

    /// <summary>
    /// Convertit une image en bitmap monochrome avec dithering (Floyd-Steinberg)
    /// </summary>
    private static unsafe Bitmap ConvertToMonochromeWithDithering(Bitmap source)
    {
        // Créer un bitmap en Format32bppArgb pour le traitement
        var tempBitmap = new Bitmap(source.Width, source.Height, PixelFormat.Format32bppArgb);
        
        // Copier l'image source
        using (var g = Graphics.FromImage(tempBitmap))
        {
            g.DrawImage(source, 0, 0);
        }

        // Convertir en niveaux de gris et appliquer le dithering Floyd-Steinberg
        var grayData = new int[source.Width, source.Height];
        var sourceData = tempBitmap.LockBits(
            new Rectangle(0, 0, tempBitmap.Width, tempBitmap.Height),
            ImageLockMode.ReadWrite,
            PixelFormat.Format32bppArgb
        );

        byte* ptr = (byte*)sourceData.Scan0;

        // Étape 1: Convertir en niveaux de gris en tenant compte de la transparence
        for (int y = 0; y < source.Height; y++)
        {
            int offset = y * sourceData.Stride;
            for (int x = 0; x < source.Width; x++)
            {
                int index = offset + (x * 4);
                byte b = ptr[index];
                byte g = ptr[index + 1];
                byte r = ptr[index + 2];
                byte a = ptr[index + 3]; // Canal alpha (transparence)
                
                // Si pixel transparent (alpha < 128), traiter comme blanc
                if (a < 128)
                {
                    grayData[x, y] = 255; // Blanc
                }
                else
                {
                    // Calculer la luminosité
                    grayData[x, y] = (int)(0.299 * r + 0.587 * g + 0.114 * b);
                }
            }
        }

        // Étape 2: Appliquer le dithering Floyd-Steinberg
        for (int y = 0; y < source.Height; y++)
        {
            for (int x = 0; x < source.Width; x++)
            {
                int oldPixel = grayData[x, y];
                int newPixel = oldPixel < 128 ? 0 : 255; // Seuil
                int error = oldPixel - newPixel;

                grayData[x, y] = newPixel;

                // Distribuer l'erreur aux pixels voisins (Floyd-Steinberg)
                if (x + 1 < source.Width)
                    grayData[x + 1, y] = Math.Clamp(grayData[x + 1, y] + (error * 7 / 16), 0, 255);
                if (x - 1 >= 0 && y + 1 < source.Height)
                    grayData[x - 1, y + 1] = Math.Clamp(grayData[x - 1, y + 1] + (error * 3 / 16), 0, 255);
                if (y + 1 < source.Height)
                    grayData[x, y + 1] = Math.Clamp(grayData[x, y + 1] + (error * 5 / 16), 0, 255);
                if (x + 1 < source.Width && y + 1 < source.Height)
                    grayData[x + 1, y + 1] = Math.Clamp(grayData[x + 1, y + 1] + (error * 1 / 16), 0, 255);
            }
        }

        // Étape 3: Appliquer les valeurs au bitmap
        for (int y = 0; y < source.Height; y++)
        {
            int offset = y * sourceData.Stride;
            for (int x = 0; x < source.Width; x++)
            {
                int index = offset + (x * 4);
                byte value = (byte)grayData[x, y];
                ptr[index] = value;     // B
                ptr[index + 1] = value; // G
                ptr[index + 2] = value; // R
                ptr[index + 3] = 255;   // A
            }
        }

        tempBitmap.UnlockBits(sourceData);

        // Créer le bitmap résultat en Format1bppIndexed
        var result = new Bitmap(tempBitmap.Width, tempBitmap.Height, PixelFormat.Format1bppIndexed);
        
        // Palette monochrome (noir et blanc)
        var palette = result.Palette;
        palette.Entries[0] = Color.White;
        palette.Entries[1] = Color.Black;
        result.Palette = palette;

        // Copier les données en utilisant LockBits
        var resultData = result.LockBits(
            new Rectangle(0, 0, result.Width, result.Height),
            ImageLockMode.WriteOnly,
            PixelFormat.Format1bppIndexed
        );

        var sourceData2 = tempBitmap.LockBits(
            new Rectangle(0, 0, tempBitmap.Width, tempBitmap.Height),
            ImageLockMode.ReadOnly,
            PixelFormat.Format32bppArgb
        );

        byte* sourcePtr = (byte*)sourceData2.Scan0;
        byte* resultPtr = (byte*)resultData.Scan0;

        for (int y = 0; y < source.Height; y++)
        {
            int sourceOffset = y * sourceData2.Stride;
            int resultOffset = y * resultData.Stride;

            for (int x = 0; x < source.Width; x++)
            {
                int sourceIndex = sourceOffset + (x * 4);
                byte value = sourcePtr[sourceIndex];
                bool isBlack = value < 128;

                int resultByteIndex = resultOffset + (x / 8);
                int bitIndex = 7 - (x % 8);

                if (isBlack)
                {
                    resultPtr[resultByteIndex] |= (byte)(1 << bitIndex);
                }
            }
        }

        tempBitmap.UnlockBits(sourceData2);
        result.UnlockBits(resultData);
        tempBitmap.Dispose();

        return result;
    }

    /// <summary>
    /// Génère les commandes ESC/POS raster (GS v 0) pour imprimer un bitmap monochrome
    /// GS v 0 est plus efficace et compatible que ESC *
    /// Le logo est centré en calculant le padding nécessaire
    /// </summary>
    private static byte[] GenerateEscPosRaster(Bitmap bitmap)
    {
        var commands = new List<byte>();

        int width = bitmap.Width;
        int height = bitmap.Height;

        // La largeur doit être un multiple de 8 pour GS v 0
        int widthBytes = (width + 7) / 8;
        
        // Largeur de l'imprimante en bytes (576 pixels / 8 = 72 bytes pour 80mm)
        int printerWidthBytes = PrinterWidth / 8;
        
        // Calculer le padding pour centrer (en bytes)
        int paddingBytes = (printerWidthBytes - widthBytes) / 2;
        
        // Largeur totale incluant le padding (pour centrer)
        int totalWidthBytes = printerWidthBytes;
        
        // Commande GS v 0 (Print raster bit image)
        // GS v 0 m xL xH yL yH d1...dk
        // m = 0 (normal), 1 (double width), 2 (double height), 3 (double width + height)
        // xL, xH = largeur totale en bytes (little-endian) - inclut le padding pour centrer
        // yL, yH = hauteur en pixels (little-endian)
        // d1...dk = données raster (1 bit par pixel, ligne par ligne)

        commands.Add(0x1D); // GS
        commands.Add(0x76); // v
        commands.Add(0x30); // 0 (normal mode)
        commands.Add(0x00); // m = 0 (NORMAL)
        commands.Add((byte)(totalWidthBytes & 0xFF));      // xL (low byte) - largeur totale avec padding
        commands.Add((byte)((totalWidthBytes >> 8) & 0xFF)); // xH (high byte)
        commands.Add((byte)(height & 0xFF));          // yL (low byte)
        commands.Add((byte)((height >> 8) & 0xFF));   // yH (high byte)

        // Extraire les données bitmap ligne par ligne
        var bitmapData = bitmap.LockBits(
            new Rectangle(0, 0, bitmap.Width, bitmap.Height),
            ImageLockMode.ReadOnly,
            PixelFormat.Format1bppIndexed
        );

        unsafe
        {
            byte* ptr = (byte*)bitmapData.Scan0;

            for (int y = 0; y < height; y++)
            {
                int rowOffset = y * bitmapData.Stride;
                
                // Ajouter le padding gauche pour centrer (bytes blancs)
                for (int p = 0; p < paddingBytes; p++)
                {
                    commands.Add(0x00); // Byte blanc (tous les bits à 0)
                }

                // Données du bitmap
                for (int xByte = 0; xByte < widthBytes; xByte++)
                {
                    byte dataByte = 0;
                    int bitOffset = xByte * 8;

                    for (int bit = 0; bit < 8; bit++)
                    {
                        int x = bitOffset + bit;
                        if (x < width)
                        {
                            int byteIndex = rowOffset + (x / 8);
                            int bitIndex = 7 - (x % 8);
                            bool isBlack = (ptr[byteIndex] & (1 << bitIndex)) != 0;

                            if (isBlack)
                            {
                                dataByte |= (byte)(1 << (7 - bit));
                            }
                        }
                    }

                    commands.Add(dataByte);
                }
                
                // Ajouter le padding droit pour centrer (bytes blancs)
                int remainingPadding = printerWidthBytes - widthBytes - paddingBytes;
                for (int p = 0; p < remainingPadding; p++)
                {
                    commands.Add(0x00); // Byte blanc (tous les bits à 0)
                }
            }
        }

        bitmap.UnlockBits(bitmapData);

        // Vérification: chaque ligne doit avoir totalWidthBytes bytes
        int expectedBytesPerLine = totalWidthBytes;
        int actualBytesPerLine = (commands.Count - 8) / height; // header = 8 bytes: 1D 76 30 00 xL xH yL yH
        Console.WriteLine($"[LOGO] Raster OK: width={width}px ({widthBytes} bytes), total={totalWidthBytes} bytes/line, height={height}px, padding={paddingBytes} bytes");

        return commands.ToArray();
    }

        private static Bitmap TrimVerticalWhiteSpace1bpp(Bitmap bmp)
    {
        if (bmp.PixelFormat != PixelFormat.Format1bppIndexed)
            return (Bitmap)bmp.Clone();

        var data = bmp.LockBits(new Rectangle(0, 0, bmp.Width, bmp.Height),
            ImageLockMode.ReadOnly, PixelFormat.Format1bppIndexed);

        int widthBytes = (bmp.Width + 7) / 8;
        int top = 0, bottom = bmp.Height - 1;

        unsafe
        {
            byte* ptr = (byte*)data.Scan0;

            bool RowHasBlack(int y)
            {
                byte* row = ptr + y * data.Stride;
                for (int x = 0; x < widthBytes; x++)
                {
                    if (row[x] != 0x00) return true; // au moins un pixel noir
                }
                return false;
            }

            while (top < bmp.Height && !RowHasBlack(top)) top++;
            while (bottom >= top && !RowHasBlack(bottom)) bottom--;
        }

        bmp.UnlockBits(data);

        // Si l'image est totalement blanche, on renvoie l'original
        if (top >= bottom) return (Bitmap)bmp.Clone();

        int newH = bottom - top + 1;
        return bmp.Clone(new Rectangle(0, top, bmp.Width, newH), PixelFormat.Format1bppIndexed);
    }
}



