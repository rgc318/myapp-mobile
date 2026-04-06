export type StockSyncMode = 'manual' | 'wholesale' | 'retail';

type UomConversionEntry = {
  uom: string;
  conversionFactor: number | null;
};

function normalizeText(value: string | null | undefined) {
  return (value ?? '').trim();
}

function snapNearInteger(value: number, tolerance: number) {
  const nearestInteger = Math.round(value);
  return Math.abs(value - nearestInteger) < tolerance ? nearestInteger : null;
}

export function normalizeFactor(value: number | null | undefined, precision = 6) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  const snappedInteger = snapNearInteger(value, 0.001);
  if (snappedInteger != null) {
    return snappedInteger;
  }
  const multiplier = 10 ** precision;
  const rounded = Math.round(value * multiplier) / multiplier;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function formatFactorInput(value: number | null | undefined, precision = 6) {
  const normalized = normalizeFactor(value, precision);
  if (normalized == null) {
    return '';
  }
  if (Number.isInteger(normalized)) {
    return String(normalized);
  }
  return normalized.toFixed(precision).replace(/\.?0+$/, '');
}

export function invertFactor(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value === 0) {
    return null;
  }
  const inverted = 1 / value;
  const snappedInteger = snapNearInteger(inverted, 0.01);
  if (snappedInteger != null) {
    return snappedInteger;
  }
  return normalizeFactor(inverted);
}

export function inferStockSyncMode(params: {
  stockUom?: string | null;
  wholesaleDefaultUom?: string | null;
  retailDefaultUom?: string | null;
}): StockSyncMode {
  const stockUom = normalizeText(params.stockUom);
  const wholesaleDefaultUom = normalizeText(params.wholesaleDefaultUom);
  const retailDefaultUom = normalizeText(params.retailDefaultUom);

  if (stockUom && stockUom === wholesaleDefaultUom) {
    return 'wholesale';
  }

  if (stockUom && stockUom === retailDefaultUom) {
    return 'retail';
  }

  return 'manual';
}

export function resolveDisplayConversionFactors(params: {
  stockUom?: string | null;
  wholesaleDefaultUom?: string | null;
  retailDefaultUom?: string | null;
  uomConversions?: UomConversionEntry[];
}) {
  const stockSyncMode = inferStockSyncMode(params);
  const conversionMap = new Map(
    (params.uomConversions ?? [])
      .filter((row) => normalizeText(row.uom))
      .map((row) => [normalizeText(row.uom), row.conversionFactor]),
  );
  const stockUom = normalizeText(params.stockUom);
  const wholesaleDefaultUom = normalizeText(params.wholesaleDefaultUom);
  const retailDefaultUom = normalizeText(params.retailDefaultUom);

  const wholesaleFactor =
    wholesaleDefaultUom && wholesaleDefaultUom === stockUom
      ? 1
      : normalizeFactor(conversionMap.get(wholesaleDefaultUom) ?? null);

  const rawRetailFactor =
    retailDefaultUom && retailDefaultUom === stockUom
      ? 1
      : normalizeFactor(conversionMap.get(retailDefaultUom) ?? null);

  const retailFactor =
    stockSyncMode === 'wholesale'
      ? invertFactor(rawRetailFactor)
      : rawRetailFactor;

  return {
    stockSyncMode,
    wholesaleFactor,
    retailFactor,
  };
}

export function buildProductUomConversions(params: {
  stockUom: string;
  wholesaleDefaultUom?: string | null;
  retailDefaultUom?: string | null;
  wholesaleFactor?: number | null;
  retailFactor?: number | null;
  stockSyncMode: StockSyncMode;
}) {
  const stockUom = normalizeText(params.stockUom);
  const wholesaleDefaultUom = normalizeText(params.wholesaleDefaultUom);
  const retailDefaultUom = normalizeText(params.retailDefaultUom);

  return [
    { uom: stockUom, conversionFactor: 1 },
    ...(wholesaleDefaultUom
      ? [
          {
            uom: wholesaleDefaultUom,
            conversionFactor:
              wholesaleDefaultUom === stockUom ? 1 : (params.wholesaleFactor as number),
          },
        ]
      : []),
    ...(retailDefaultUom
      ? [
          {
            uom: retailDefaultUom,
            conversionFactor:
              retailDefaultUom === stockUom
                ? 1
                : params.stockSyncMode === 'wholesale'
                  ? 1 / (params.retailFactor as number)
                  : (params.retailFactor as number),
          },
        ]
      : []),
  ].filter((entry, index, array) => array.findIndex((row) => row.uom === entry.uom) === index);
}
