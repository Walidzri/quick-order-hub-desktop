/**
 * Système de logging centralisé pour Quick Order Hub Desktop
 * 
 * Fournit un système de logging structuré avec :
 * - Niveaux de log (DEBUG, INFO, WARN, ERROR, FATAL)
 * - Persistance dans des fichiers
 * - Rotation automatique des logs
 * - Filtrage par niveau selon l'environnement
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: string;
  data?: any;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private logLevel: LogLevel;
  private logs: LogEntry[] = [];
  private maxLogsInMemory = 100;
  private logFileHandle: FileSystemFileHandle | null = null;
  private isElectron: boolean;
  private logDirectory: string | null = null;

  constructor() {
    // Déterminer l'environnement
    this.isElectron = typeof window !== 'undefined' && !!window.electronAPI;
    
    // En production, ne logger que WARN et plus
    // En développement, logger tout
    this.logLevel = import.meta.env.DEV ? LogLevel.DEBUG : LogLevel.WARN;
    
    // Initialiser la persistance si Electron
    if (this.isElectron) {
      this.initializeLogFile();
    }
  }

  /**
   * Initialise le fichier de log (Electron uniquement)
   */
  private async initializeLogFile(): Promise<void> {
    try {
      // Le répertoire de logs sera géré par Electron
      // Pour l'instant, on stocke juste en mémoire et on expose une méthode pour sauvegarder
      if (typeof window !== 'undefined' && window.electronAPI) {
        // Demander le répertoire de logs à Electron
        // Pour l'instant, on utilise localStorage comme fallback
      }
    } catch (error) {
      console.error('Failed to initialize log file:', error);
    }
  }

  /**
   * Formate un message de log
   */
  private formatMessage(level: LogLevel, message: string, context?: string, data?: any, error?: Error): LogEntry {
    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];
    
    const entry: LogEntry = {
      timestamp,
      level: levelName,
      message,
      ...(context && { context }),
      ...(data && { data }),
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      }),
    };

    return entry;
  }

  /**
   * Affiche un log dans la console avec le bon format
   */
  private logToConsole(entry: LogEntry): void {
    const { timestamp, level, message, context, data, error } = entry;
    const time = new Date(timestamp).toLocaleTimeString();
    const prefix = `[${time}] [${level}]${context ? ` [${context}]` : ''}`;

    switch (entry.level) {
      case 'DEBUG':
        console.debug(prefix, message, data || '');
        break;
      case 'INFO':
        console.info(prefix, message, data || '');
        break;
      case 'WARN':
        console.warn(prefix, message, data || '');
        break;
      case 'ERROR':
      case 'FATAL':
        console.error(prefix, message, error || data || '');
        break;
      default:
        console.log(prefix, message, data || '');
    }
  }

  /**
   * Ajoute un log à la mémoire et le persiste si nécessaire
   */
  private async addLog(entry: LogEntry): Promise<void> {
    // Ajouter à la mémoire
    this.logs.push(entry);
    
    // Limiter la taille en mémoire
    if (this.logs.length > this.maxLogsInMemory) {
      this.logs.shift();
    }

    // Afficher dans la console
    this.logToConsole(entry);

    // Persister si Electron et niveau suffisant
    if (this.isElectron && entry.level !== 'DEBUG') {
      await this.persistLog(entry);
    }
  }

  /**
   * Persiste un log (via Electron API ou localStorage en fallback)
   */
  private async persistLog(entry: LogEntry): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.writeLog) {
        // Mode Electron : écrire dans un fichier
        const logLine = JSON.stringify(entry) + '\n';
        const result = await window.electronAPI.writeLog(logLine);
        if (!result.success) {
          console.error('Failed to write log to file:', result.error);
        }
      } else {
        // Mode navigateur : stocker dans localStorage comme fallback
        try {
          const logsKey = 'app_logs';
          const today = new Date().toISOString().split('T')[0];
          const dayKey = `${logsKey}_${today}`;
          
          // Récupérer les logs existants pour aujourd'hui
          const existingLogs = localStorage.getItem(dayKey) || '[]';
          const logsArray = JSON.parse(existingLogs);
          
          // Ajouter le nouveau log
          logsArray.push(entry);
          
          // Limiter à 1000 logs par jour en mode navigateur
          if (logsArray.length > 1000) {
            logsArray.shift();
          }
          
          // Sauvegarder
          localStorage.setItem(dayKey, JSON.stringify(logsArray));
          
          // Nettoyer les anciens logs (garder seulement les 7 derniers jours)
          this.cleanOldLocalStorageLogs();
          
          // Feedback silencieux en dev (pas de console.log pour éviter le spam)
          // Les logs sont sauvegardés, on peut le vérifier via getLocalStorageLogs()
        } catch (storageError) {
          // Si localStorage est plein ou indisponible, juste afficher
          if (import.meta.env.DEV) {
            console.warn('[Logger] Could not save log to localStorage:', storageError);
          }
        }
      }
    } catch (error) {
      // Ne pas logger l'erreur de logging pour éviter les boucles infinies
      console.error('Failed to persist log:', error);
    }
  }

  /**
   * Nettoie les anciens logs dans localStorage (garde 7 jours)
   */
  private cleanOldLocalStorageLogs(): void {
    try {
      const logsKey = 'app_logs';
      const today = new Date();
      const keysToRemove: string[] = [];
      
      // Parcourir localStorage pour trouver les clés de logs
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(logsKey + '_')) {
          const dateStr = key.replace(logsKey + '_', '');
          const logDate = new Date(dateStr);
          const daysDiff = Math.floor((today.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24));
          
          // Supprimer les logs de plus de 7 jours
          if (daysDiff > 7) {
            keysToRemove.push(key);
          }
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      // Ignorer les erreurs de nettoyage
    }
  }

  /**
   * Log un message de niveau DEBUG
   */
  debug(message: string, context?: string, data?: any): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      this.addLog(this.formatMessage(LogLevel.DEBUG, message, context, data));
    }
  }

  /**
   * Log un message de niveau INFO
   */
  info(message: string, context?: string, data?: any): void {
    if (this.logLevel <= LogLevel.INFO) {
      this.addLog(this.formatMessage(LogLevel.INFO, message, context, data));
    }
  }

  /**
   * Log un message de niveau WARN
   */
  warn(message: string, context?: string, data?: any): void {
    if (this.logLevel <= LogLevel.WARN) {
      this.addLog(this.formatMessage(LogLevel.WARN, message, context, data));
    }
  }

  /**
   * Log un message de niveau ERROR
   */
  error(message: string, error?: Error, context?: string, data?: any): void {
    if (this.logLevel <= LogLevel.ERROR) {
      this.addLog(this.formatMessage(LogLevel.ERROR, message, context, data, error));
    }
  }

  /**
   * Log un message de niveau FATAL
   */
  fatal(message: string, error?: Error, context?: string, data?: any): void {
    if (this.logLevel <= LogLevel.FATAL) {
      this.addLog(this.formatMessage(LogLevel.FATAL, message, context, data, error));
    }
  }

  /**
   * Récupère les logs en mémoire
   */
  getLogs(level?: LogLevel, limit?: number): LogEntry[] {
    let filtered = this.logs;
    
    if (level !== undefined) {
      filtered = filtered.filter(log => {
        const logLevel = LogLevel[log.level as keyof typeof LogLevel];
        return logLevel >= level;
      });
    }
    
    if (limit) {
      filtered = filtered.slice(-limit);
    }
    
    return filtered;
  }

  /**
   * Exporte les logs au format JSON
   */
  exportLogs(level?: LogLevel): string {
    const logs = this.getLogs(level);
    return JSON.stringify(logs, null, 2);
  }

  /**
   * Récupère les logs depuis localStorage (mode navigateur)
   */
  getLocalStorageLogs(date?: string): LogEntry[] {
    try {
      const logsKey = 'app_logs';
      const targetDate = date || new Date().toISOString().split('T')[0];
      const dayKey = `${logsKey}_${targetDate}`;
      const logsJson = localStorage.getItem(dayKey);
      
      if (logsJson) {
        return JSON.parse(logsJson);
      }
      return [];
    } catch (error) {
      console.error('Failed to get localStorage logs:', error);
      return [];
    }
  }

  /**
   * Exporte les logs depuis localStorage au format JSON
   */
  exportLocalStorageLogs(date?: string, level?: LogLevel): string {
    const logs = this.getLocalStorageLogs(date);
    let filtered = logs;
    
    if (level !== undefined) {
      filtered = filtered.filter(log => {
        const logLevel = LogLevel[log.level as keyof typeof LogLevel];
        return logLevel >= level;
      });
    }
    
    return JSON.stringify(filtered, null, 2);
  }

  /**
   * Vide les logs en mémoire
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Définit le niveau de log
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * Récupère le niveau de log actuel
   */
  getLogLevel(): LogLevel {
    return this.logLevel;
  }
}

// Instance singleton
export const logger = new Logger();

// Exposer logger globalement en dev pour faciliter le débogage
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as any).logger = logger;
}

// Export des fonctions de convenance
export const logDebug = (message: string, context?: string, data?: any) => logger.debug(message, context, data);
export const logInfo = (message: string, context?: string, data?: any) => logger.info(message, context, data);
export const logWarn = (message: string, context?: string, data?: any) => logger.warn(message, context, data);
export const logError = (message: string, error?: Error, context?: string, data?: any) => logger.error(message, error, context, data);
export const logFatal = (message: string, error?: Error, context?: string, data?: any) => logger.fatal(message, error, context, data);
