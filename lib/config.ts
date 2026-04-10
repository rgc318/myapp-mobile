import { Platform } from 'react-native';

const envBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
const API_BASE_URL_KEY = 'myapp-mobile.api-base-url';
const WEB_BACKEND_PORT = '18081';

let memoryOverride: string | null = null;

function getWebDefaultApiBaseUrl() {
  if (typeof window !== 'undefined' && window.location.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:${WEB_BACKEND_PORT}`;
  }

  return 'http://192.168.31.63:18081';
}

function getDefaultApiBaseUrl() {
  return envBaseUrl || (Platform.OS === 'web' ? getWebDefaultApiBaseUrl() : 'http://192.168.31.63:18081');
  // return envBaseUrl || (Platform.OS === 'web' ? `${window.location.protocol}//${window.location.hostname}:28080` : 'http://192.168.31.229:28080');
  // return envBaseUrl || (Platform.OS === 'web' ? `${window.location.protocol}//${window.location.hostname}:18888` : 'http://39.104.204.79:18888');
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
