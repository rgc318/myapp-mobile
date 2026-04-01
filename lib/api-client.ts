import { Platform } from 'react-native';

import { loadStoredCsrfToken, saveStoredCsrfToken } from '@/lib/auth-storage';
import { getApiBaseUrl } from '@/lib/config';
import { buildFrappeHeaders } from '@/lib/frappe-http';

type RequestOptions = {
  authToken?: string | null;
  body?: BodyInit | null;
  contentType?: string;
  method?: 'GET' | 'POST';
};

function getErrorMessage(payload: any, fallback: string) {
  return String(payload?.message?.message || payload?.message || payload?.exc || fallback);
}

async function parseJsonResponse(response: Response) {
  return response.json().catch(() => ({}));
}

let csrfBootstrapPromise: Promise<string | null> | null = null;

function extractCsrfToken(payload: any, response: Response) {
  const headerToken =
    response.headers.get('x-frappe-csrf-token') || response.headers.get('X-Frappe-CSRF-Token');
  const payloadTokenCandidates = [
    payload?.csrf_token,
    payload?.message?.csrf_token,
    payload?.data?.csrf_token,
  ];

  if (typeof headerToken === 'string' && headerToken.trim()) {
    return headerToken.trim();
  }

  for (const candidate of payloadTokenCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

async function fetchCsrfTokenFromDesk() {
  if (Platform.OS !== 'web') {
    return null;
  }

  const response = await fetch(`${getApiBaseUrl()}/app`, {
    method: 'GET',
    credentials: 'include',
  });

  const html = await response.text().catch(() => '');
  const patterns = [
    /csrf_token\s*[:=]\s*"([^"]+)"/,
    /csrf_token\s*[:=]\s*'([^']+)'/,
    /"csrf_token"\s*:\s*"([^"]+)"/,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

async function ensureCsrfToken(options?: { forceRefresh?: boolean }) {
  if (options?.forceRefresh) {
    saveStoredCsrfToken(null);
  }

  const storedToken = loadStoredCsrfToken();
  if (storedToken?.trim()) {
    return storedToken.trim();
  }

  if (!csrfBootstrapPromise) {
    csrfBootstrapPromise = fetchCsrfTokenFromDesk()
      .then((token) => {
        if (token) {
          saveStoredCsrfToken(token);
        }
        return token;
      })
      .finally(() => {
        csrfBootstrapPromise = null;
      });
  }

  return csrfBootstrapPromise;
}

function isCsrfFailure(payload: any) {
  const message = getErrorMessage(payload, '').toLowerCase();
  return message.includes('csrf') || message.includes('invalid request') || message.includes('无效请求');
}

async function requestJson(path: string, options?: RequestOptions) {
  let ensuredCsrfToken: string | null = null;

  if ((options?.method ?? 'GET') !== 'GET') {
    ensuredCsrfToken = await ensureCsrfToken();
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response: Response;

    try {
      response = await fetch(`${getApiBaseUrl()}${path}`, {
        method: options?.method ?? 'GET',
        headers: buildFrappeHeaders({
          authToken: options?.authToken,
          contentType: options?.contentType,
          csrfToken: ensuredCsrfToken,
        }),
        credentials: 'include',
        body: options?.body,
      });
    } catch {
      if (Platform.OS === 'web') {
        throw new Error('无法连接后端，请检查浏览器跨域、服务地址或登录状态。');
      }
      throw new Error('无法连接后端，请检查服务地址或网络环境。');
    }

    const payload = await parseJsonResponse(response);
    const csrfToken = extractCsrfToken(payload, response);
    if (csrfToken) {
      saveStoredCsrfToken(csrfToken);
      ensuredCsrfToken = csrfToken;
    }

    if (!response.ok) {
      if ((options?.method ?? 'GET') !== 'GET' && attempt === 0 && isCsrfFailure(payload)) {
        ensuredCsrfToken = await ensureCsrfToken({ forceRefresh: true });
        continue;
      }
      throw new Error(getErrorMessage(payload, '请求失败，请稍后重试。'));
    }

    return payload;
  }

  throw new Error('请求失败，请稍后重试。');
}

export async function callFrappeMethod<T = any>(
  method: string,
  payload?: Record<string, unknown>,
  options?: Omit<RequestOptions, 'body' | 'contentType' | 'method'>,
) {
  const body = payload ? JSON.stringify(payload) : undefined;
  const result = await requestJson(`/api/method/${method}`, {
    method: 'POST',
    contentType: 'application/json',
    body,
    authToken: options?.authToken,
  });

  return result?.message as T;
}

export async function callGatewayMethod<T = any>(
  method: string,
  payload?: Record<string, unknown>,
  options?: Omit<RequestOptions, 'body' | 'contentType' | 'method'>,
) {
  const result = await requestJson(`/api/method/${method}`, {
    method: 'POST',
    contentType: 'application/json',
    body: JSON.stringify(payload ?? {}),
    authToken: options?.authToken,
  });

  if (result?.message?.ok === false) {
    throw new Error(getErrorMessage(result, '请求失败，请稍后重试。'));
  }

  return result?.message?.data as T;
}

export async function loginWithSessionRequest(payload: URLSearchParams) {
  return requestJson('/api/method/login', {
    method: 'POST',
    contentType: 'application/x-www-form-urlencoded',
    body: payload.toString(),
  });
}

export async function getLoggedUserRequest(authToken?: string | null) {
  const result = await requestJson('/api/method/frappe.auth.get_logged_user', {
    method: 'GET',
    authToken,
  });

  return result?.message ?? null;
}

export async function logoutRequest(authToken?: string | null) {
  return requestJson('/api/method/logout', {
    method: 'POST',
    authToken,
  }).catch(() => undefined);
}
