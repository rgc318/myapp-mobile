export function normalizeText(value: string | null | undefined) {
  return value?.trim() ?? '';
}

export function normalizeDisplayText(value: string | null | undefined) {
  const raw = String(value ?? '');
  const withLineBreaks = raw.replace(/<br\s*\/?>/gi, '\n');
  const withoutTags = withLineBreaks.replace(/<[^>]+>/g, ' ');
  const decoded = withoutTags
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"');

  return decoded
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => {
      const normalized = line.toLowerCase();
      if (!normalized) {
        return false;
      }

      return !(
        normalized.startsWith('电话:') ||
        normalized.startsWith('电话：') ||
        normalized.startsWith('手机:') ||
        normalized.startsWith('手机：') ||
        normalized.startsWith('邮箱:') ||
        normalized.startsWith('邮箱：') ||
        normalized.startsWith('邮件:') ||
        normalized.startsWith('邮件：') ||
        normalized.startsWith('tel:') ||
        normalized.startsWith('phone:') ||
        normalized.startsWith('mobile:') ||
        normalized.startsWith('email:')
      );
    })
    .filter(Boolean)
    .join('\n');
}

export function compactAddressText(value: string | null | undefined) {
  const normalized = normalizeDisplayText(value);
  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return '';
  }

  const kept = lines.filter((line, index) => {
    if (index === 0) {
      return !/^\d{5,6}$/.test(line);
    }

    if (/^\d{5,6}$/.test(line)) {
      return false;
    }

    const lower = line.toLowerCase();
    if (['china', '中国', 'beijing', 'shanghai', 'guangzhou', 'shenzhen'].includes(lower)) {
      return false;
    }

    if (/^[\u4e00-\u9fa5]{2,6}$/.test(line)) {
      return false;
    }

    return /(\d|路|街|道|巷|弄|号|栋|楼|层|室|单元|园区|大厦|广场|street|st\.|road|rd\.|avenue|ave\.|lane|ln\.|building|block|room|suite)/i.test(
      line,
    );
  });

  return (kept.length ? kept : [lines[0]]).join('\n');
}

export function composeStructuredAddressText(parts: {
  addressLine1?: string | null;
  addressLine2?: string | null;
} | null | undefined) {
  if (!parts) {
    return '';
  }

  return [parts.addressLine1, parts.addressLine2]
    .map((value) => normalizeText(value ?? ''))
    .filter(Boolean)
    .join('\n');
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
