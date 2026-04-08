import { callFrappeMethod, callGatewayMethod } from '@/lib/api-client';
import { getApiBaseUrl } from '@/lib/config';
import type { AppPreferences } from '@/lib/app-preferences';

export type UserProfile = {
  username: string;
  fullName: string | null;
  email: string | null;
  mobileNo: string | null;
  userImage: string | null;
};

export type UserWorkspacePreferences = AppPreferences;

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
  try {
    const message = await callFrappeMethod<string[]>(
      'frappe.core.doctype.user.user.get_roles',
      undefined,
      { authToken },
    );
    if (!Array.isArray(message)) {
      return [] as string[];
    }

    return message.filter((role: unknown): role is string => typeof role === 'string');
  } catch {
    return [] as string[];
  }
}

export async function getCurrentUserProfile(username: string, authToken?: string | null) {
  try {
    const message = await callFrappeMethod<Record<string, unknown>>(
      'frappe.client.get_value',
      {
        doctype: 'User',
        filters: { name: username },
        fieldname: ['full_name', 'email', 'mobile_no', 'user_image'],
      },
      { authToken },
    );
    const result = message ?? {};

    return {
      username,
      fullName:
        typeof result.full_name === 'string' && result.full_name.trim() ? result.full_name.trim() : null,
      email: typeof result.email === 'string' && result.email.trim() ? result.email.trim() : null,
      mobileNo:
        typeof result.mobile_no === 'string' && result.mobile_no.trim() ? result.mobile_no.trim() : null,
      userImage: normalizeImageUrl(
        typeof result.user_image === 'string' && result.user_image.trim() ? result.user_image.trim() : null,
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

function normalizeWorkspacePreferences(payload: Record<string, unknown> | null | undefined): UserWorkspacePreferences {
  return {
    defaultCompany:
      typeof payload?.default_company === 'string' && payload.default_company.trim() ? payload.default_company.trim() : '',
    defaultWarehouse:
      typeof payload?.default_warehouse === 'string' && payload.default_warehouse.trim()
        ? payload.default_warehouse.trim()
        : '',
  } satisfies UserWorkspacePreferences;
}

export async function getCurrentUserWorkspacePreferences(authToken?: string | null) {
  const data = await callGatewayMethod<Record<string, unknown>>(
    'myapp.api.gateway.get_current_user_workspace_preferences_v1',
    {},
    { authToken },
  );
  return normalizeWorkspacePreferences(data);
}

export async function updateCurrentUserWorkspacePreferences(
  payload: Partial<UserWorkspacePreferences>,
  authToken?: string | null,
) {
  const data = await callGatewayMethod<Record<string, unknown>>(
    'myapp.api.gateway.update_current_user_workspace_preferences_v1',
    {
      default_company: payload.defaultCompany ?? null,
      default_warehouse: payload.defaultWarehouse ?? null,
    },
    { authToken },
  );
  return normalizeWorkspacePreferences(data);
}
