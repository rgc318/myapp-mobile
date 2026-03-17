import { Platform } from 'react-native';

import { saveStoredCsrfToken } from '@/lib/auth-storage';
import {
  getLoggedUserRequest,
  loginWithSessionRequest,
  logoutRequest,
} from '@/lib/api-client';

export type LoginParams = {
  username: string;
  password: string;
};

export type AuthMode = 'session' | 'token';

export type LoginResult = {
  token: string | null;
  mode: AuthMode;
};

function extractToken(payload: any): string | null {
  const candidates = [
    payload?.token,
    payload?.access_token,
    payload?.data?.token,
    payload?.data?.access_token,
    payload?.message?.token,
    payload?.message?.access_token,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

function extractCsrfToken(payload: any): string | null {
  const candidates = [
    payload?.csrf_token,
    payload?.data?.csrf_token,
    payload?.message?.csrf_token,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

export async function loginWithPassword({ username, password }: LoginParams) {
  let payload: any;

  try {
    payload = await loginWithSessionRequest(
      new URLSearchParams({
        usr: username,
        pwd: password,
      }),
    );
  } catch {
    if (Platform.OS === 'web') {
      throw new Error(
        '当前是 Web 预览环境，浏览器被 ERPNext 的 CORS 策略拦截。请改用 Expo Go / 真机测试，或为 http://localhost:8081 放开后端跨域。 ',
      );
    }

    throw new Error('无法连接后端，请检查服务地址或网络环境。');
  }

  const token = extractToken(payload);
  const csrfToken = extractCsrfToken(payload);
  if (csrfToken) {
    saveStoredCsrfToken(csrfToken);
  }

  if (!token && payload?.message !== 'Logged In') {
    const message =
      payload?.message ||
      payload?.exc ||
      '登录失败，请检查账号密码或后端地址配置。';
    throw new Error(String(message));
  }

  return {
    token,
    mode: token ? 'token' : 'session',
  } satisfies LoginResult;
}

export async function getLoggedUser(authToken?: string | null) {
  try {
    const message = await getLoggedUserRequest(authToken);
    return typeof message === 'string' ? message : null;
  } catch {
    return null;
  }
}

export async function logoutFromSession(authToken?: string | null) {
  saveStoredCsrfToken(null);
  await logoutRequest(authToken);
}
