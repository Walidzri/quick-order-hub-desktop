/**
 * SyncService — server/src/services/syncService.ts
 *
 * Interface vide — Phase 3 uniquement.
 *
 * Objectif Phase 3 :
 *   - Synchroniser les commandes payées (SQLite local) vers le VPS (PostgreSQL/MariaDB)
 *   - Retry automatique si le réseau est indisponible
 *   - L'app doit fonctionner offline si le VPS est injoignable
 *
 * Architecture prévue :
 *   - Chaque commande a un champ `syncStatus`: 'pending' | 'synced' | 'failed'
 *   - SyncService tourne en arrière-plan, envoie les `pending` au VPS
 *   - En cas d'échec : retry exponentiel (1s, 2s, 4s, ... 5min max)
 */

export interface SyncConfig {
  vpsUrl: string;         // ex: 'https://api.mon-vps.com'
  apiKey: string;
  retryMaxDelay: number;  // ms — délai max entre retries
  syncInterval: number;   // ms — fréquence de vérification des pending
}

export interface SyncResult {
  synced: number;
  failed: number;
  pending: number;
  timestamp: Date;
}

class SyncService {
  private config: SyncConfig | null = null;
  private intervalId: NodeJS.Timeout | null = null;

  /** Configure et démarre la synchronisation. */
  start(_config: SyncConfig): void {
    // TODO Phase 3 : implémenter la synchronisation cloud
    console.log('[SyncService] Cloud sync not yet implemented (Phase 3)');
  }

  /** Arrête la synchronisation. */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /** Force une synchronisation immédiate. */
  async syncNow(): Promise<SyncResult> {
    // TODO Phase 3
    return { synced: 0, failed: 0, pending: 0, timestamp: new Date() };
  }
}

export const syncService = new SyncService();
