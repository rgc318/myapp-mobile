export type SalesMode = 'wholesale' | 'retail';

export type PriceSummary = {
  currentPriceList?: string | null;
  currentRate?: number | null;
  standardSellingRate?: number | null;
  wholesaleRate?: number | null;
  retailRate?: number | null;
  standardBuyingRate?: number | null;
  valuationRate?: number | null;
};

export type SalesProfile = {
  modeCode: SalesMode;
  priceList?: string | null;
  defaultUom?: string | null;
  defaultUomDisplay?: string | null;
};

export type SalesModeDefaultsSource = {
  salesProfiles?: SalesProfile[] | null;
  wholesaleDefaultUom?: string | null;
  retailDefaultUom?: string | null;
  allUoms?: string[] | null;
  stockUom?: string | null;
  uom?: string | null;
  priceSummary?: PriceSummary | null;
  price?: number | null;
};

export function normalizeSalesMode(value: unknown): SalesMode {
  return value === 'retail' ? 'retail' : 'wholesale';
}

export function getSalesModeLabel(mode: SalesMode) {
  return mode === 'retail' ? '零售' : '批发';
}

function uniqueUoms(values: (string | null | undefined)[]) {
  return Array.from(new Set(values.map((value) => (typeof value === 'string' ? value.trim() : '')).filter(Boolean)));
}

export function getModeDefaultUom(source: SalesModeDefaultsSource, mode: SalesMode) {
  const profileUom =
    source.salesProfiles?.find((profile) => profile.modeCode === mode)?.defaultUom ?? null;
  const directUom = mode === 'retail' ? source.retailDefaultUom : source.wholesaleDefaultUom;

  return (
    [profileUom, directUom, source.uom, source.stockUom, ...(source.allUoms ?? [])]
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .find(Boolean) ?? ''
  );
}

export function getAvailableUoms(source: SalesModeDefaultsSource) {
  return uniqueUoms([
    ...(source.allUoms ?? []),
    source.wholesaleDefaultUom,
    source.retailDefaultUom,
    source.stockUom,
    source.uom,
  ]);
}

function firstFiniteNumber(values: (number | null | undefined)[]) {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

export function getModeDefaultRate(source: SalesModeDefaultsSource, mode: SalesMode) {
  const summary = source.priceSummary;
  const modeRate = mode === 'retail' ? summary?.retailRate : summary?.wholesaleRate;
  const preferred = firstFiniteNumber([
    modeRate ?? null,
    summary?.currentRate ?? null,
    source.price ?? null,
    summary?.standardSellingRate ?? null,
  ]);

  return preferred;
}

export function buildModeDefaults(source: SalesModeDefaultsSource, mode: SalesMode) {
  return {
    salesMode: normalizeSalesMode(mode),
    uom: getModeDefaultUom(source, mode),
    price: getModeDefaultRate(source, mode),
  };
}
