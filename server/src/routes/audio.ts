import { FastifyInstance } from 'fastify';
import { execFile } from 'child_process';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { promisify } from 'util';

const exec = promisify(execFile);

// Dossier de cache — créé une seule fois au démarrage
const CACHE_DIR = join(process.env.APPDATA || join(process.env.HOME || '.', 'AppData', 'Roaming'), 'quick-order-hub', 'audio-cache');
if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

/**
 * Génère un fichier WAV via Windows SAPI (System.Speech.Synthesis).
 * Le fichier est créé une seule fois puis servi depuis le cache à vie.
 */
async function generateWav(orderNumber: string): Promise<string> {
  // Sanitize + normaliser : "009" → 9, "042" → 42
  const raw = orderNumber.replace(/[^0-9]/g, '');
  if (!raw) throw new Error('Numéro de commande invalide');
  const num = String(parseInt(raw, 10));

  const filename = `annonce-${num}.wav`;
  const filepath = join(CACHE_DIR, filename);

  // Déjà en cache → retourner directement
  if (existsSync(filepath)) return filepath;

  const text = `Commande numéro ${num}, prête !`;

  // Script PowerShell — utilise SAPI intégré à Windows
  // Sélectionne la voix par culture fr-FR (plus fiable que par nom)
  const ps = `
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SetOutputToWaveFile("${filepath.replace(/\\/g, '\\\\')}")
$synth.Rate = 1
$fr = $synth.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -like "fr-*" } | Select-Object -First 1
if ($fr) { $synth.SelectVoice($fr.VoiceInfo.Name) }
$synth.Speak("${text}")
$synth.Dispose()
`.trim();

  await exec('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], {
    timeout: 5000,
    windowsHide: true,
  });

  return filepath;
}

export async function audioRoutes(fastify: FastifyInstance) {
  // GET /api/audio/announce/:orderNumber — sert le WAV (généré ou cache)
  fastify.get('/api/audio/announce/:orderNumber', async (request, reply) => {
    const { orderNumber } = request.params as { orderNumber: string };

    try {
      const filepath = await generateWav(orderNumber);
      const buffer = readFileSync(filepath);
      return reply
        .header('Content-Type', 'audio/wav')
        .header('Cache-Control', 'public, max-age=31536000, immutable')
        .send(buffer);
    } catch (e) {
      fastify.log.error(e, 'Erreur génération audio pour commande %s', orderNumber);
      return reply.status(500).send({ error: 'Erreur génération audio' });
    }
  });
}
