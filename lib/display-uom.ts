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
