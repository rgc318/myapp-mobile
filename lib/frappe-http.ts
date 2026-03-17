import { Platform } from 'react-native';
import { loadStoredCsrfToken } from '@/lib/auth-storage';

export function getFrappeCsrfToken() {
  const storedToken = loadStoredCsrfToken();
  if (storedToken?.trim()) {
    return storedToken.trim();
  }

  if (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    (window as typeof window & { frappe?: { csrf_token?: string } }).frappe?.csrf_token
  ) {
    return (window as typeof window & { frappe?: { csrf_token?: string } }).frappe?.csrf_token ?? null;
  }

  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return null;
  }

  const cookies = document.cookie ? document.cookie.split(';') : [];
  for (const cookie of cookies) {
    const [rawKey, ...rest] = cookie.trim().split('=');
    if (rawKey === 'csrf_token') {
      const rawValue = rest.join('=').trim();
      return rawValue ? decodeURIComponent(rawValue) : null;
    }
  }

  return null;
}

export function buildFrappeHeaders(options?: {
  authToken?: string | null;
  contentType?: string;
}) {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (options?.contentType) {
    headers['Content-Type'] = options.contentType;
  }

  if (options?.authToken) {
    headers.Authorization = `Bearer ${options.authToken}`;
  }

  const csrfToken = getFrappeCsrfToken();
  if (csrfToken) {
    headers['X-Frappe-CSRF-Token'] = csrfToken;
  }

  return headers;
}
