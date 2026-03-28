import { Platform } from 'react-native';

const envBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
const API_BASE_URL_KEY = 'myapp-mobile.api-base-url';

let memoryOverride: string | null = null;

function getDefaultApiBaseUrl() {
  return envBaseUrl || (Platform.OS === 'web' ? 'http://localhost:8080' : 'http://.31.63:18081');
}

function canUseWebStorage() {
  return Platform.OS === 'web' && typeof window !== 'undefined' && !!window.localStorage;
}

function normalizeBaseUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().replace(/\/+$/, '');
  return normalized || null;
}

export function getApiBaseUrl() {
  if (memoryOverride) {
    return memoryOverride;
  }

  if (canUseWebStorage()) {
    const storedValue = normalizeBaseUrl(window.localStorage.getItem(API_BASE_URL_KEY));
    if (storedValue) {
      return storedValue;
    }
  }

  return getDefaultApiBaseUrl();
}

export function getDefaultBaseUrl() {
  return getDefaultApiBaseUrl();
}

export function setApiBaseUrl(value: string | null) {
  const normalized = normalizeBaseUrl(value);
  memoryOverride = normalized;

  if (canUseWebStorage()) {
    if (normalized) {
      window.localStorage.setItem(API_BASE_URL_KEY, normalized);
    } else {
      window.localStorage.removeItem(API_BASE_URL_KEY);
    }
  }

  return getApiBaseUrl();
}
