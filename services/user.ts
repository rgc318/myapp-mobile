import { getApiBaseUrl } from '@/lib/config';

export type UserProfile = {
  username: string;
  fullName: string | null;
  email: string | null;
  mobileNo: string | null;
  userImage: string | null;
};

function buildHeaders(authToken?: string | null) {
  return {
    Accept: 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  };
}

function normalizeImageUrl(userImage: string | null) {
  if (!userImage) {
    return null;
  }

  if (/^https?:\/\//i.test(userImage)) {
    return userImage;
  }

  return `${getApiBaseUrl()}${userImage.startsWith('/') ? '' : '/'}${userImage}`;
}

export async function getCurrentUserRoles(authToken?: string | null) {
  const apiBaseUrl = getApiBaseUrl();

  try {
    const response = await fetch(`${apiBaseUrl}/api/method/frappe.core.doctype.user.user.get_roles`, {
      headers: buildHeaders(authToken),
      credentials: 'include',
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || !Array.isArray(payload?.message)) {
      return [] as string[];
    }

    return payload.message.filter((role: unknown): role is string => typeof role === 'string');
  } catch {
    return [] as string[];
  }
}

export async function getCurrentUserProfile(username: string, authToken?: string | null) {
  const apiBaseUrl = getApiBaseUrl();

  try {
    const response = await fetch(`${apiBaseUrl}/api/method/frappe.client.get_value`, {
      method: 'POST',
      headers: {
        ...buildHeaders(authToken),
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        doctype: 'User',
        filters: { name: username },
        fieldname: ['full_name', 'email', 'mobile_no', 'user_image'],
      }),
    });
    const payload = await response.json().catch(() => ({}));
    const message = payload?.message ?? {};

    return {
      username,
      fullName: typeof message.full_name === 'string' && message.full_name.trim() ? message.full_name.trim() : null,
      email: typeof message.email === 'string' && message.email.trim() ? message.email.trim() : null,
      mobileNo:
        typeof message.mobile_no === 'string' && message.mobile_no.trim() ? message.mobile_no.trim() : null,
      userImage: normalizeImageUrl(
        typeof message.user_image === 'string' && message.user_image.trim() ? message.user_image.trim() : null,
      ),
    } satisfies UserProfile;
  } catch {
    return {
      username,
      fullName: null,
      email: null,
      mobileNo: null,
      userImage: null,
    } satisfies UserProfile;
  }
}
