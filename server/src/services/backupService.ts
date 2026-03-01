import path from 'node:path';
import fs from 'node:fs/promises';

/**
 * BackupService — server/src/services/backupService.ts
 *
 * Phase 1.5 : Interface définie, scheduling prêt.
 *             Non encore actif : en Phase 1, la source de données est IndexedDB
 *             (navigateur uniquement, inaccessible depuis le Main Process).
 *
 * Phase 2 : Activer en remplaçant `performBackup()` par une copie du fichier
 *           SQLite (better-sqlite3) vers le répertoire de backup.
 *           Appeler `backupService.start(settings)` depuis server/src/index.ts
 *           après avoir chargé les settings depuis SQLite.
 */

export interface BackupConfig {
  enabled: boolean;
  directory: string;
  scheduleType: 'interval' | 'daily' | 'weekly' | 'monthly';
  intervalHours?: number;   // pour scheduleType === 'interval'
  dailyTime?: string;       // 'HH:MM' — pour scheduleType === 'daily'
  weeklyDay?: number;       // 0–6 (dimanche–samedi) — pour scheduleType === 'weekly'
  weeklyTime?: string;      // 'HH:MM'
  monthlyDay?: number;      // 1–31 — pour scheduleType === 'monthly'
  monthlyTime?: string;     // 'HH:MM'
}

export interface BackupResult {
  success: boolean;
  path?: string;
  error?: string;
  timestamp: Date;
}

class BackupService {
  private config: BackupConfig | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private checkIntervalId: NodeJS.Timeout | null = null;
  private dbPath: string | null = null;

  /**
   * Démarre le service de backup avec la config fournie.
   * @param config  Paramètres de backup issus des settings
   * @param dbPath  Chemin vers le fichier SQLite (disponible en Phase 2)
   */
  start(config: BackupConfig, dbPath?: string): void {
    this.stop(); // Nettoyer tout scheduling précédent

    if (!config.enabled || !config.directory) {
      console.log('[BackupService] Backup disabled or no directory configured');
      return;
    }

    this.config = config;
    this.dbPath = dbPath ?? null;

    if (!this.dbPath) {
      // Phase 1 : SQLite pas encore disponible — service en attente
      console.log('[BackupService] Waiting for SQLite database (Phase 2). Backup not yet active.');
      return;
    }

    console.log(`[BackupService] Starting backup service (${config.scheduleType}) → ${config.directory}`);

    // Backup immédiat au démarrage
    this.performBackup();

    if (config.scheduleType === 'interval') {
      const ms = (config.intervalHours ?? 1) * 60 * 60 * 1000;
      this.intervalId = setInterval(() => this.performBackup(), ms);
    } else {
      this.scheduleNextBackup();
      // Vérification à la minute pour rattraper un redémarrage
      this.checkIntervalId = setInterval(() => this.checkScheduledBackup(), 60_000);
    }
  }

  /** Arrête tous les timers en cours. */
  stop(): void {
    if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; }
    if (this.checkIntervalId) { clearInterval(this.checkIntervalId); this.checkIntervalId = null; }
    this.config = null;
    this.dbPath = null;
    console.log('[BackupService] Stopped');
  }

  /** Lance un backup immédiat (appel manuel). */
  async runNow(): Promise<BackupResult> {
    return this.performBackup();
  }

  // ---------------------------------------------------------------------------
  // Implémentation privée
  // ---------------------------------------------------------------------------

  private async performBackup(): Promise<BackupResult> {
    const timestamp = new Date();

    if (!this.dbPath || !this.config) {
      return { success: false, error: 'BackupService not configured', timestamp };
    }

    try {
      await fs.mkdir(this.config.directory, { recursive: true });

      const ts = timestamp.toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const dest = path.join(this.config.directory, `backup_${ts}.db`);

      await fs.copyFile(this.dbPath, dest);
      console.log(`[BackupService] Backup created: ${dest}`);
      return { success: true, path: dest, timestamp };
    } catch (err: any) {
      console.error('[BackupService] Backup failed:', err);
      return { success: false, error: err?.message ?? String(err), timestamp };
    }
  }

  private scheduleNextBackup(): void {
    if (!this.config) return;
    const delay = this.getNextBackupDelay();
    if (this.intervalId) clearTimeout(this.intervalId);
    this.intervalId = setTimeout(() => {
      this.performBackup();
      this.scheduleNextBackup();
    }, delay);
  }

  private checkScheduledBackup(): void {
    if (!this.config) return;
    const now = new Date();
    const { scheduleType, dailyTime, weeklyDay, weeklyTime, monthlyDay, monthlyTime } = this.config;
    let should = false;

    if (scheduleType === 'daily' && dailyTime) {
      const [h, m] = dailyTime.split(':').map(Number);
      should = now.getHours() === h && now.getMinutes() === m;
    } else if (scheduleType === 'weekly' && weeklyTime) {
      const [h, m] = weeklyTime.split(':').map(Number);
      should = now.getDay() === (weeklyDay ?? 0) && now.getHours() === h && now.getMinutes() === m;
    } else if (scheduleType === 'monthly' && monthlyTime) {
      const [h, m] = monthlyTime.split(':').map(Number);
      should = now.getDate() === (monthlyDay ?? 1) && now.getHours() === h && now.getMinutes() === m;
    }

    if (should) this.performBackup();
  }

  private getNextBackupDelay(): number {
    if (!this.config) return 60 * 60 * 1000;
    const now = new Date();
    const { scheduleType, dailyTime, weeklyDay, weeklyTime, monthlyDay, monthlyTime } = this.config;

    switch (scheduleType) {
      case 'daily': {
        const [h, m] = (dailyTime ?? '02:00').split(':').map(Number);
        const t = new Date(now);
        t.setHours(h, m, 0, 0);
        if (t <= now) t.setDate(t.getDate() + 1);
        return t.getTime() - now.getTime();
      }
      case 'weekly': {
        const day = weeklyDay ?? 0;
        const [h, m] = (weeklyTime ?? '02:00').split(':').map(Number);
        const t = new Date(now);
        t.setHours(h, m, 0, 0);
        let diff = (day - now.getDay() + 7) % 7;
        if (diff === 0 && t <= now) diff = 7;
        t.setDate(t.getDate() + diff);
        return t.getTime() - now.getTime();
      }
      case 'monthly': {
        const dom = monthlyDay ?? 1;
        const [h, m] = (monthlyTime ?? '02:00').split(':').map(Number);
        const t = new Date(now);
        t.setHours(h, m, 0, 0);
        t.setDate(dom);
        if (t <= now) t.setMonth(t.getMonth() + 1);
        return t.getTime() - now.getTime();
      }
      default:
        return 60 * 60 * 1000;
    }
  }
}

export const backupService = new BackupService();
