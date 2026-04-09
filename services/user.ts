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

export type MobileReleaseInfo = {
  enabled: boolean;
  provider: string;
  repo: string;
  currentVersion: string;
  currentBuildNumber: number | null;
  latestVersion: string;
  latestBuildNumber: number | null;
  latestTag: string;
  releaseName: string;
  releaseNotes: string;
  publishedAt: string | null;
  downloadUrl: string;
  releasePageUrl: string;
  assetName: string;
  assetSize: number | null;
  isPrerelease: boolean;
  hasUpdate: boolean;
  forceUpdate: boolean;
};

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

function normalizeMobileReleaseInfo(payload: Record<string, unknown> | null | undefined): MobileReleaseInfo {
  return {
    enabled: Boolean(payload?.enabled),
    provider: typeof payload?.provider === 'string' ? payload.provider : 'github',
    repo: typeof payload?.repo === 'string' ? payload.repo : '',
    currentVersion: typeof payload?.current_version === 'string' ? payload.current_version : '',
    currentBuildNumber: typeof payload?.current_build_number === 'number' ? payload.current_build_number : null,
    latestVersion: typeof payload?.latest_version === 'string' ? payload.latest_version : '',
    latestBuildNumber: typeof payload?.latest_build_number === 'number' ? payload.latest_build_number : null,
    latestTag: typeof payload?.latest_tag === 'string' ? payload.latest_tag : '',
    releaseName: typeof payload?.release_name === 'string' ? payload.release_name : '',
    releaseNotes: typeof payload?.release_notes === 'string' ? payload.release_notes : '',
    publishedAt: typeof payload?.published_at === 'string' ? payload.published_at : null,
    downloadUrl: typeof payload?.download_url === 'string' ? payload.download_url : '',
    releasePageUrl: typeof payload?.release_page_url === 'string' ? payload.release_page_url : '',
    assetName: typeof payload?.asset_name === 'string' ? payload.asset_name : '',
    assetSize: typeof payload?.asset_size === 'number' ? payload.asset_size : null,
    isPrerelease: Boolean(payload?.is_prerelease),
    hasUpdate: Boolean(payload?.has_update),
    forceUpdate: Boolean(payload?.force_update),
  } satisfies MobileReleaseInfo;
}

export async function getMobileReleaseInfo(
  payload?: { currentVersion?: string | null; currentBuildNumber?: number | null },
  authToken?: string | null,
) {
  const data = await callGatewayMethod<Record<string, unknown>>(
    'myapp.api.gateway.get_mobile_release_info_v1',
    {
      current_version: payload?.currentVersion ?? null,
      current_build_number: payload?.currentBuildNumber ?? null,
    },
    { authToken },
  );
  return normalizeMobileReleaseInfo(data);
}
