export function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function isValidIsoDate(value: string | null | undefined) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }

  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function splitIsoDate(value: string | null | undefined) {
  if (!isValidIsoDate(value ?? '')) {
    return { year: '', month: '', day: '' };
  }

  const [year, month, day] = String(value).trim().split('-');
  return { year, month, day };
}

export function buildIsoDate(year: string, month: string, day: string) {
  const normalized = `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  return isValidIsoDate(normalized) ? normalized : '';
}

export function addDaysToIsoDate(base: string | null | undefined, offset: number) {
  const origin = isValidIsoDate(base ?? '') ? new Date(`${String(base).trim()}T00:00:00`) : new Date();
  origin.setDate(origin.getDate() + offset);
  const year = origin.getFullYear();
  const month = String(origin.getMonth() + 1).padStart(2, '0');
  const day = String(origin.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
