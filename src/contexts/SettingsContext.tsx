import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getDB, initializeDatabase, Settings } from '@/lib/database';
import { createBackup } from '@/lib/database-sqlite';
import { Language, Currency, LANGUAGES, translations } from '@/lib/i18n';

interface SettingsContextType {
  settings: Settings | null;
  updateSettings: (updates: Partial<Settings>) => Promise<void>;
  t: (key: string) => string;
  language: Language;
  currency: Currency;
  direction: 'ltr' | 'rtl';
  kioskMode: boolean;
  toggleKioskMode: () => void;
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider');
  return ctx;
}

function hexToHSL(hex: string): string {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function applyTheme(s: Settings) {
  if (s.darkMode) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  if (s.primaryColor) {
    const hsl = hexToHSL(s.primaryColor);
    document.documentElement.style.setProperty('--primary', hsl);
    document.documentElement.style.setProperty('--ring', hsl);
    document.documentElement.style.setProperty('--sidebar-primary', hsl);
    document.documentElement.style.setProperty('--sidebar-ring', hsl);
  }
  const lang = s.language as Language;
  document.documentElement.dir = LANGUAGES[lang]?.dir || 'ltr';
  const uiScale = s.uiScale ?? 1.0;
  document.documentElement.style.setProperty('--ui-scale', uiScale.toString());
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [kioskMode, setKioskMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        await initializeDatabase();
        const db = await getDB();
        const loaded = await db.get('settings', 'main');
        if (loaded) {
          setSettings(loaded);
          setKioskMode(loaded.kioskMode);
          applyTheme(loaded);
        }
      } catch (err) {
        console.error('[SettingsContext] init error:', err);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  const updateSettings = useCallback(async (updates: Partial<Settings>) => {
    if (!settings) return;
    const newSettings = { ...settings, ...updates };
    const db = await getDB();
    await db.put('settings', newSettings);
    setSettings(newSettings);
    applyTheme(newSettings);
    if (updates.kioskMode !== undefined) setKioskMode(updates.kioskMode);
  }, [settings]);

  const language = (settings?.language || 'fr-FR') as Language;
  const currency = (settings?.currency || 'DZD') as Currency;
  const direction = LANGUAGES[language]?.dir || 'ltr';

  const t = useCallback((key: string): string => {
    return translations[language]?.[key] || translations['fr-FR']?.[key] || key;
  }, [language]);

  const toggleKioskMode = useCallback(() => {
    const newMode = !kioskMode;
    setKioskMode(newMode);
    updateSettings({ kioskMode: newMode });
    if (newMode) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
  }, [kioskMode, updateSettings]);

  // Automatic backup — sera déplacé vers server/services/backupService en Phase 1.5
  useEffect(() => {
    if (!settings?.backupEnabled || !settings.backupDirectory) return;

    const scheduleType = settings.backupScheduleType || 'interval';
    let intervalId: NodeJS.Timeout | null = null;
    let checkIntervalId: NodeJS.Timeout | null = null;

    const performBackup = async () => {
      try {
        const backupPath = await createBackup(settings.backupDirectory!);
        if (backupPath) console.log('Automatic backup completed:', backupPath);
        else console.error('Automatic backup failed');
      } catch (err) {
        console.error('Error during automatic backup:', err);
      }
    };

    const getNextBackupTime = (): number => {
      const now = new Date();
      switch (scheduleType) {
        case 'interval': return (settings.backupInterval || 60) * 60 * 1000;
        case 'daily': {
          const [h, m] = (settings.backupDailyTime || '02:00').split(':').map(Number);
          const t = new Date(now); t.setHours(h, m, 0, 0);
          if (t <= now) t.setDate(t.getDate() + 1);
          return t.getTime() - now.getTime();
        }
        case 'weekly': {
          const day = settings.backupWeeklyDay ?? 0;
          const [h, m] = (settings.backupWeeklyTime || '02:00').split(':').map(Number);
          const t = new Date(now); t.setHours(h, m, 0, 0);
          let diff = (day - now.getDay() + 7) % 7;
          if (diff === 0 && t <= now) diff = 7;
          t.setDate(t.getDate() + diff);
          return t.getTime() - now.getTime();
        }
        case 'monthly': {
          const dom = settings.backupMonthlyDay ?? 1;
          const [h, m] = (settings.backupMonthlyTime || '02:00').split(':').map(Number);
          const t = new Date(now); t.setHours(h, m, 0, 0); t.setDate(dom);
          if (t <= now) t.setMonth(t.getMonth() + 1);
          return t.getTime() - now.getTime();
        }
        default: return 60 * 60 * 1000;
      }
    };

    const scheduleNextBackup = () => {
      if (intervalId) clearTimeout(intervalId);
      intervalId = setTimeout(() => { performBackup(); scheduleNextBackup(); }, getNextBackupTime());
    };

    performBackup();

    if (scheduleType === 'interval') {
      intervalId = setInterval(performBackup, (settings.backupInterval || 60) * 60 * 1000) as unknown as NodeJS.Timeout;
    } else {
      scheduleNextBackup();
      checkIntervalId = setInterval(() => {
        const now = new Date();
        let should = false;
        if (scheduleType === 'daily') {
          const [h, m] = (settings.backupDailyTime || '02:00').split(':').map(Number);
          should = now.getHours() === h && now.getMinutes() === m;
        } else if (scheduleType === 'weekly') {
          const day = settings.backupWeeklyDay ?? 0;
          const [h, m] = (settings.backupWeeklyTime || '02:00').split(':').map(Number);
          should = now.getDay() === day && now.getHours() === h && now.getMinutes() === m;
        } else if (scheduleType === 'monthly') {
          const dom = settings.backupMonthlyDay ?? 1;
          const [h, m] = (settings.backupMonthlyTime || '02:00').split(':').map(Number);
          should = now.getDate() === dom && now.getHours() === h && now.getMinutes() === m;
        }
        if (should) performBackup();
      }, 60000) as unknown as NodeJS.Timeout;
    }

    return () => {
      if (intervalId) clearTimeout(intervalId);
      if (checkIntervalId) clearInterval(checkIntervalId);
    };
  }, [
    settings?.backupEnabled, settings?.backupDirectory, settings?.backupScheduleType,
    settings?.backupInterval, settings?.backupDailyTime, settings?.backupWeeklyDay,
    settings?.backupWeeklyTime, settings?.backupMonthlyDay, settings?.backupMonthlyTime,
  ]);

  return (
    <SettingsContext.Provider value={{
      settings, updateSettings, t, language, currency, direction,
      kioskMode, toggleKioskMode, isLoading,
    }}>
      {children}
    </SettingsContext.Provider>
  );
}
