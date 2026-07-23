const UOM_BUSINESS_PRIORITY: Record<string, number> = {
  BOX: 0,
  BOXES: 0,
  '\u7bb1': 0,
  NOS: 1,
  NO: 1,
  PCS: 1,
  PC: 1,
  '\u4ef6': 1,
};

export function getUomBusinessPriority(
  uom: string | null | undefined,
  displayName?: string | null,
) {
  for (const value of [uom, displayName]) {
    const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
    if (normalized && UOM_BUSINESS_PRIORITY[normalized] !== undefined) {
      return UOM_BUSINESS_PRIORITY[normalized];
    }
  }
  return Number.MAX_SAFE_INTEGER;
}

export function sortUomsByBusinessPriority<T>(
  values: readonly T[],
  getUom: (value: T) => string | null | undefined,
  getDisplayName?: (value: T) => string | null | undefined,
) {
  return values
    .map((value, index) => ({ index, value }))
    .sort((left, right) => {
      const priorityDifference =
        getUomBusinessPriority(getUom(left.value), getDisplayName?.(left.value)) -
        getUomBusinessPriority(getUom(right.value), getDisplayName?.(right.value));
      return priorityDifference || left.index - right.index;
    })
    .map(({ value }) => value);
}

export function formatDisplayUom(uom: string | null | undefined) {
  const normalized = typeof uom === 'string' ? uom.trim() : '';

  if (!normalized) {
    return '\u4ef6';
  }

  const upper = normalized.toUpperCase();

  switch (upper) {
    case 'NOS':
    case 'NO':
    case 'PCS':
    case 'PC':
    case 'PIECE':
    case 'PIECES':
      return '\u4ef6';
    case 'BOX':
    case 'BOXES':
      return '\u7bb1';
    case 'BAG':
    case 'BAGS':
      return '\u888b';
    case 'KG':
    case 'KGS':
      return '\u5343\u514b';
    case 'G':
    case 'GRAM':
    case 'GRAMS':
      return '\u514b';
    case 'L':
    case 'LTR':
    case 'LITER':
    case 'LITRE':
      return '\u5347';
    case 'ML':
      return '\u6beb\u5347';
    case 'M':
    case 'METER':
    case 'METRE':
      return '\u7c73';
    case 'YARD':
    case 'YD':
    case 'YDS':
      return '\u7801';
    case 'CM':
      return '\u5398\u7c73';
    case 'MM':
      return '\u6beb\u7c73';
    case 'SET':
    case 'SETS':
      return '\u5957';
    case 'PACK':
    case 'PACKS':
      return '\u5305';
    case 'ROLL':
    case 'ROLLS':
      return '\u5377';
    default:
      return normalized;
  }
}

export function resolveDisplayUom(
  uom: string | null | undefined,
  displayName?: string | null,
) {
  const normalizedUom = typeof uom === 'string' ? uom.trim() : '';
  const normalizedDisplayName = typeof displayName === 'string' ? displayName.trim() : '';

  if (
    normalizedDisplayName &&
    (!normalizedUom || normalizedDisplayName.toUpperCase() !== normalizedUom.toUpperCase())
  ) {
    return normalizedDisplayName;
  }

  return formatDisplayUom(uom);
}
