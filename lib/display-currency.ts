export function getCurrencyDisplayUnit(currency: string | null | undefined) {
  const normalized = typeof currency === 'string' ? currency.trim().toUpperCase() : '';

  switch (normalized) {
    case 'CNY':
    case 'RMB':
      return '\u5143';
    case 'USD':
      return 'USD';
    case 'EUR':
      return 'EUR';
    case 'GBP':
      return 'GBP';
    case 'JPY':
      return 'JPY';
    case 'HKD':
      return 'HKD';
    case 'SGD':
      return 'SGD';
    case 'AUD':
      return 'AUD';
    case 'CAD':
      return 'CAD';
    default:
      return normalized || '\u5143';
  }
}

export function formatCurrencyValue(value: number | null, currency: string | null | undefined) {
  if (value === null) {
    return '\u2014';
  }

  const amount = new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

  const unit = getCurrencyDisplayUnit(currency);
  return `${amount} ${unit}`;
}
