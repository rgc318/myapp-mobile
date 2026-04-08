import { Platform } from 'react-native';
import { loadStoredUsername } from '@/lib/auth-storage';

export type AppPreferences = {
  defaultCompany: string;
  defaultWarehouse: string;
};

const STORAGE_KEY = 'myapp-mobile.app-preferences';
const DEFAULT_OWNER = '__default__';

const DEFAULT_PREFERENCES: AppPreferences = {
  defaultCompany: 'rgc (Demo)',
  defaultWarehouse: 'Stores - RD',
};

let memoryPreferencesByOwner: Record<string, AppPreferences> | null = null;

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

function normalizeOwner(owner?: string | null) {
	const resolved = owner?.trim() || loadStoredUsername()?.trim();
	return resolved || DEFAULT_OWNER;
}

function normalizePreferenceMap(raw: unknown) {
	if (!raw || typeof raw !== 'object') {
		return {} as Record<string, AppPreferences>;
	}

	if ('defaultCompany' in (raw as Record<string, unknown>) || 'defaultWarehouse' in (raw as Record<string, unknown>)) {
		return {
			[DEFAULT_OWNER]: normalizePreferences(raw as Partial<AppPreferences>),
		} as Record<string, AppPreferences>;
	}

	const next: Record<string, AppPreferences> = {};
	for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
		next[key] = normalizePreferences(value as Partial<AppPreferences>);
	}
	return next;
}

function getPreferenceMap() {
	if (memoryPreferencesByOwner) {
		return memoryPreferencesByOwner;
	}

	if (canUseWebStorage()) {
		try {
			const raw = window.localStorage.getItem(STORAGE_KEY);
			if (raw) {
				memoryPreferencesByOwner = normalizePreferenceMap(JSON.parse(raw));
				return memoryPreferencesByOwner;
			}
		} catch {
			// Ignore malformed storage and fall back to defaults.
		}
	}

	memoryPreferencesByOwner = {};
	return memoryPreferencesByOwner;
}

function persistPreferenceMap(next: Record<string, AppPreferences>) {
	memoryPreferencesByOwner = next;
	if (canUseWebStorage()) {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
	}
}

export function getDefaultPreferences() {
  return { ...DEFAULT_PREFERENCES };
}

export function getStoredAppPreferences(options?: { owner?: string | null }) {
  const owner = normalizeOwner(options?.owner);
  const map = getPreferenceMap();
  return map[owner] || map[DEFAULT_OWNER] || null;
}

export function getAppPreferences(options?: { owner?: string | null }) {
  return getStoredAppPreferences(options) || getDefaultPreferences();
}

export function setAppPreferences(next: Partial<AppPreferences>, options?: { owner?: string | null }) {
  const owner = normalizeOwner(options?.owner);
  const merged = normalizePreferences({
    ...getAppPreferences({ owner }),
    ...next,
  });
  const map = {
    ...getPreferenceMap(),
    [owner]: merged,
  };
  persistPreferenceMap(map);
  return merged;
}

export function replaceAppPreferences(next: Partial<AppPreferences>, options?: { owner?: string | null }) {
  const owner = normalizeOwner(options?.owner);
  const merged = normalizePreferences(next);
  const map = {
    ...getPreferenceMap(),
    [owner]: merged,
  };
  persistPreferenceMap(map);
  return merged;
}

export function resetAppPreferences(options?: { owner?: string | null }) {
  return replaceAppPreferences(getDefaultPreferences(), options);
}
