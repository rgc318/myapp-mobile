import { Platform } from 'react-native';

export type AppPreferences = {
  defaultCompany: string;
  defaultWarehouse: string;
};

const STORAGE_KEY = 'myapp-mobile.app-preferences';

const DEFAULT_PREFERENCES: AppPreferences = {
  defaultCompany: 'rgc (Demo)',
  defaultWarehouse: 'Stores - RD',
};

let memoryPreferences: AppPreferences | null = null;

function canUseWebStorage() {
  return Platform.OS === 'web' && typeof window !== 'undefined' && !!window.localStorage;
}

function normalizeText(value: string | null | undefined, fallback: string) {
  const normalized = value?.trim();
  return normalized || fallback;
}

function normalizePreferences(partial?: Partial<AppPreferences> | null): AppPreferences {
  return {
    defaultCompany: normalizeText(partial?.defaultCompany, DEFAULT_PREFERENCES.defaultCompany),
    defaultWarehouse: normalizeText(partial?.defaultWarehouse, DEFAULT_PREFERENCES.defaultWarehouse),
  };
}

export function getDefaultPreferences() {
  return { ...DEFAULT_PREFERENCES };
}

export function getAppPreferences() {
  if (memoryPreferences) {
    return memoryPreferences;
  }

  if (canUseWebStorage()) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        memoryPreferences = normalizePreferences(JSON.parse(raw));
        return memoryPreferences;
      }
    } catch {
      // Ignore malformed storage and fall back to defaults.
    }
  }

  memoryPreferences = getDefaultPreferences();
  return memoryPreferences;
}

export function setAppPreferences(next: Partial<AppPreferences>) {
  const merged = normalizePreferences({
    ...getAppPreferences(),
    ...next,
  });

  memoryPreferences = merged;

  if (canUseWebStorage()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  }

  return merged;
}

export function resetAppPreferences() {
  memoryPreferences = getDefaultPreferences();

  if (canUseWebStorage()) {
    window.localStorage.removeItem(STORAGE_KEY);
  }

  return memoryPreferences;
}
