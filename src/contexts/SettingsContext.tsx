// Settings context — editable rules for Days Worked and benchmark threshold
import { createContext, useContext, useState, type ReactNode } from 'react';
import type { DaysWorkedRule } from '../lib/analytics';
import { DEFAULT_DAYS_RULE } from '../lib/analytics';

export interface AppSettings {
  daysWorkedRule: DaysWorkedRule;
  benchmarkThreshold: number; // percent, default 20
  benchmarkMode: 'national' | 'role';
}

const DEFAULT_SETTINGS: AppSettings = {
  daysWorkedRule: DEFAULT_DAYS_RULE,
  benchmarkThreshold: 20,
  benchmarkMode: 'national',
};

interface SettingsContextValue {
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => void;
  reset: () => void;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  update: () => {},
  reset: () => {},
});

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem('tada-settings');
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_SETTINGS;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  const update = (patch: Partial<AppSettings>) => {
    setSettings(s => {
      const next = { ...s, ...patch };
      localStorage.setItem('tada-settings', JSON.stringify(next));
      return next;
    });
  };

  const reset = () => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.removeItem('tada-settings');
  };

  return (
    <SettingsContext.Provider value={{ settings, update, reset }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
