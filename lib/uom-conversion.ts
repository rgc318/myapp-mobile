export type UomConversion = {
  uom: string;
  conversionFactor: number | null;
};

function normalizeUom(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}

export function getConversionFactorToStockUnit(options: {
  stockUom?: string | null;
  uom?: string | null;
  uomConversions?: UomConversion[] | null;
}) {
  const stockUom = normalizeUom(options.stockUom);
  const targetUom = normalizeUom(options.uom) || stockUom;

  if (!stockUom || !targetUom) {
    return null;
  }

  if (targetUom === stockUom) {
    return 1;
  }

  const matched = options.uomConversions?.find((entry) => normalizeUom(entry.uom) === targetUom);
  if (!matched) {
    return null;
  }

  return typeof matched.conversionFactor === 'number' && Number.isFinite(matched.conversionFactor)
    ? matched.conversionFactor
    : null;
}

export function convertQtyToStockQty(options: {
  qty: number;
  stockUom?: string | null;
  uom?: string | null;
  uomConversions?: UomConversion[] | null;
}) {
  if (!Number.isFinite(options.qty)) {
    return null;
  }

  const factor = getConversionFactorToStockUnit(options);
  if (factor == null) {
    return null;
  }

  return options.qty * factor;
}

export function formatConvertedQty(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '';
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}
