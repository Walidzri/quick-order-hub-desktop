import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Language, Currency, LANGUAGES, translations } from '@/lib/i18n';
import { settingsService } from '@/services/settingsService';
import type { Settings } from '@shared/types';

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
  const uiScale = (s as any).uiScale ?? 1.0;
  document.documentElement.style.setProperty('--ui-scale', uiScale.toString());
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [kioskMode, setKioskMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        const loaded = await settingsService.get();
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
    const newSettings = await settingsService.update(updates);
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

  return (
    <SettingsContext.Provider value={{
      settings, updateSettings, t, language, currency, direction,
      kioskMode, toggleKioskMode, isLoading,
    }}>
      {children}
    </SettingsContext.Provider>
  );
}
