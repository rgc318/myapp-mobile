import { Platform } from 'react-native';

const AUTH_USERNAME_KEY = 'myapp-mobile.auth.username';

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
