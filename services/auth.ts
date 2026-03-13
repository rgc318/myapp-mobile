import { Platform } from 'react-native';

import { getApiBaseUrl } from '@/lib/config';

export type LoginParams = {
  username: string;
  password: string;
};

export async function loginWithPassword({ username, password }: LoginParams) {
  const apiBaseUrl = getApiBaseUrl();
  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl}/api/method/login`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      credentials: 'include',
      body: new URLSearchParams({
        usr: username,
        pwd: password,
      }).toString(),
    });
  } catch {
    if (Platform.OS === 'web') {
      throw new Error(
        '当前是 Web 预览环境，浏览器被 ERPNext 的 CORS 策略拦截。请改用 Expo Go / 真机测试，或为 http://localhost:8081 放开后端跨域。 ',
      );
    }

    throw new Error('无法连接后端，请检查服务地址或网络环境。');
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload?.message !== 'Logged In') {
    const message =
      payload?.message ||
      payload?.exc ||
      '登录失败，请检查账号密码或后端地址配置。';
    throw new Error(String(message));
  }

  return payload;
}

export async function getLoggedUser() {
  const apiBaseUrl = getApiBaseUrl();
  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl}/api/method/frappe.auth.get_logged_user`, {
      headers: {
        Accept: 'application/json',
      },
      credentials: 'include',
    });
  } catch {
    return null;
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || typeof payload?.message !== 'string') {
    return null;
  }

  return payload.message;
}

export async function logoutFromSession() {
  const apiBaseUrl = getApiBaseUrl();

  await fetch(`${apiBaseUrl}/api/method/logout`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
    },
    credentials: 'include',
  }).catch(() => undefined);
}
