export function normalizeText(value: string | null | undefined) {
  return value?.trim() ?? '';
}

export function requireText(value: string | null | undefined, message: string) {
  return normalizeText(value) ? null : message;
}

export function toOptionalText(value: string | null | undefined) {
  const normalized = normalizeText(value);
  return normalized || undefined;
}

export function toPositiveInteger(value: string | number | null | undefined, fallback = 1) {
  const parsed = typeof value === 'number' ? value : Number(String(value ?? '').trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}
