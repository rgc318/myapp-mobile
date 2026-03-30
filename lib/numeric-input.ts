type NumericInputOptions = {
  allowDecimal?: boolean;
};

function normalizeIntegerPart(value: string) {
  if (!value) {
    return '';
  }

  const stripped = value.replace(/^0+(?=\d)/, '');
  return stripped || '0';
}

export function sanitizeNumericInput(raw: string, options?: NumericInputOptions) {
  const allowDecimal = options?.allowDecimal ?? true;

  if (!raw) {
    return '';
  }

  if (!allowDecimal) {
    const digitsOnly = raw.replace(/\D/g, '');
    return normalizeIntegerPart(digitsOnly);
  }

  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned) {
    return '';
  }

  const firstDotIndex = cleaned.indexOf('.');
  if (firstDotIndex === -1) {
    return normalizeIntegerPart(cleaned);
  }

  const integerPart = cleaned.slice(0, firstDotIndex);
  const fractionPart = cleaned.slice(firstDotIndex + 1).replace(/\./g, '');
  const normalizedIntegerPart = normalizeIntegerPart(integerPart);

  if (!fractionPart && cleaned.endsWith('.')) {
    return `${normalizedIntegerPart || '0'}.`;
  }

  return `${normalizedIntegerPart || '0'}.${fractionPart}`;
}

export function sanitizeDecimalInput(raw: string) {
  return sanitizeNumericInput(raw, { allowDecimal: true });
}

export function sanitizeIntegerInput(raw: string) {
  return sanitizeNumericInput(raw, { allowDecimal: false });
}
