import { Platform } from 'react-native';

const AUTH_USERNAME_KEY = 'myapp-mobile.auth.username';
const AUTH_TOKEN_KEY = 'myapp-mobile.auth.token';
const AUTH_MODE_KEY = 'myapp-mobile.auth.mode';

function canUseWebStorage() {
  return Platform.OS === 'web' && typeof window !== 'undefined' && !!window.localStorage;
}

export function loadStoredUsername() {
  if (!canUseWebStorage()) {
    return null;
  }

  return window.localStorage.getItem(AUTH_USERNAME_KEY);
}

export function saveStoredUsername(username: string | null) {
  if (!canUseWebStorage()) {
    return;
  }

  if (!username) {
    window.localStorage.removeItem(AUTH_USERNAME_KEY);
    return;
  }

  window.localStorage.setItem(AUTH_USERNAME_KEY, username);
}

export function loadStoredToken() {
  if (!canUseWebStorage()) {
    return null;
  }

  return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

export function saveStoredToken(token: string | null) {
  if (!canUseWebStorage()) {
    return;
  }

  if (!token) {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    return;
  }

  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function loadStoredAuthMode() {
  if (!canUseWebStorage()) {
    return null;
  }

  return window.localStorage.getItem(AUTH_MODE_KEY);
}

export function saveStoredAuthMode(mode: 'session' | 'token' | null) {
  if (!canUseWebStorage()) {
    return;
  }

  if (!mode) {
    window.localStorage.removeItem(AUTH_MODE_KEY);
    return;
  }

  window.localStorage.setItem(AUTH_MODE_KEY, mode);
}
