import { getApiBaseUrl } from '@/lib/config';

function appendMediaVersion(url: string, version?: string | null) {
  const normalizedVersion = typeof version === 'string' ? version.trim() : '';
  if (!normalizedVersion || !url || url.startsWith('data:')) {
    return url;
  }

  const joiner = url.includes('?') ? '&' : '?';
  return `${url}${joiner}v=${encodeURIComponent(normalizedVersion)}`;
}

export function resolveMediaUrl(value: string | null | undefined, options?: { version?: string | null }) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) {
    return '';
  }

  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) {
    return appendMediaVersion(trimmed, options?.version);
  }

  const baseUrl = getApiBaseUrl();
  if (trimmed.startsWith('/')) {
    return appendMediaVersion(`${baseUrl}${trimmed}`, options?.version);
  }

  return appendMediaVersion(`${baseUrl}/${trimmed}`, options?.version);
}
