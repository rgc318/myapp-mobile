import { resolveDisplayUom } from '@/lib/display-uom';
import { convertQtyToStockQty, formatConvertedQty, type UomConversion } from '@/lib/uom-conversion';
import type { SalesMode } from '@/lib/sales-mode';

function normalizeUom(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}

export function buildLineUnitSummary(options: {
  salesMode: SalesMode;
  uom?: string | null;
  uomDisplay?: string | null;
  stockUom?: string | null;
  stockUomDisplay?: string | null;
}) {
  const currentUom = options.uom ? resolveDisplayUom(options.uom, options.uomDisplay) : '未设置单位';
  const stockUom = options.stockUom ? resolveDisplayUom(options.stockUom, options.stockUomDisplay) : '';
  const modeLabel = options.salesMode === 'retail' ? '零售' : '批发';

  if (stockUom && options.uom && normalizeUom(options.uom) !== normalizeUom(options.stockUom)) {
    return `${modeLabel}录入：${currentUom}；库存按 ${stockUom} 自动换算`;
  }

  return `${modeLabel}录入：${currentUom}${stockUom ? `；库存单位 ${stockUom}` : ''}`;
}

export function buildEntryToStockSummary(options: {
  qty: number;
  uom?: string | null;
  uomDisplay?: string | null;
  stockUom?: string | null;
  stockUomDisplay?: string | null;
  uomConversions?: UomConversion[] | null;
}) {
  const stockQty = convertQtyToStockQty(options);
  if (stockQty == null || !options.stockUom) {
    return null;
  }

  if (!options.uom || normalizeUom(options.uom) === normalizeUom(options.stockUom)) {
    return `当前按 ${resolveDisplayUom(options.stockUom, options.stockUomDisplay)} 录入。`;
  }

  return `${options.qty} ${resolveDisplayUom(options.uom, options.uomDisplay)} 约等于 ${formatConvertedQty(stockQty)} ${resolveDisplayUom(options.stockUom, options.stockUomDisplay)}。`;
}

export function buildStockReferenceSummary(options: {
  stockQty?: number | null;
  stockUom?: string | null;
  stockUomDisplay?: string | null;
}) {
  if (typeof options.stockQty !== 'number' || !Number.isFinite(options.stockQty) || !options.stockUom) {
    return null;
  }

  return `参考库存约 ${formatConvertedQty(options.stockQty)} ${resolveDisplayUom(options.stockUom, options.stockUomDisplay)}，仅作提醒。`;
}

export function buildWarehouseStockDisplay(options: {
  warehouseStockQty?: number | null;
  warehouseStockUom?: string | null;
  warehouseStockUomDisplay?: string | null;
  qty: number;
  uom?: string | null;
  stockUom?: string | null;
  uomConversions?: UomConversion[] | null;
}) {
  if (
    typeof options.warehouseStockQty !== 'number' ||
    !Number.isFinite(options.warehouseStockQty) ||
    !options.warehouseStockUom
  ) {
    return null;
  }

  const reservedQty =
    convertQtyToStockQty({
      qty: options.qty,
      uom: options.uom,
      stockUom: options.stockUom ?? options.warehouseStockUom,
      uomConversions: options.uomConversions,
    }) ?? options.qty;
  const remainingQty = Math.max(0, options.warehouseStockQty - reservedQty);
  const tone = remainingQty <= 0 ? 'danger' : remainingQty <= 10 ? 'warning' : 'default';

  return {
    label: `库存剩余：${formatConvertedQty(remainingQty)} ${resolveDisplayUom(options.warehouseStockUom, options.warehouseStockUomDisplay)}`,
    tone: tone as 'default' | 'warning' | 'danger',
  };
}

export function buildQuantitySummary(items: { qty?: number | null; uom?: string | null; uomDisplay?: string | null }[]) {
  if (!items.length) {
    return '暂无商品明细';
  }

  const uomSet = new Set(
    items
      .map((item) => normalizeUom(item.uom))
      .filter(Boolean),
  );

  if (uomSet.size === 1) {
    const onlyUom = Array.from(uomSet)[0];
    const totalQty = items.reduce((count, item) => count + (item.qty ?? 0), 0);
    const display = items.find((item) => normalizeUom(item.uom) === onlyUom)?.uomDisplay ?? null;
    return `录入数量 ${totalQty} ${resolveDisplayUom(onlyUom, display)}`;
  }

  return '存在多种单位，数量以各行显示为准';
}

export function buildQuantityComposition(items: { qty?: number | null; uom?: string | null; uomDisplay?: string | null }[]) {
  if (!items.length) {
    return '暂无商品明细';
  }

  const totals = new Map<string, number>();
  items.forEach((item) => {
    const normalizedUom = normalizeUom(item.uom);
    if (!normalizedUom) {
      return;
    }
    totals.set(normalizedUom, (totals.get(normalizedUom) ?? 0) + (item.qty ?? 0));
  });

  if (!totals.size) {
    return '数量以各行显示为准';
  }

  return Array.from(totals.entries())
    .map(([uom, qty]) => {
      const display = items.find((item) => normalizeUom(item.uom) === uom)?.uomDisplay ?? null;
      return `${qty} ${resolveDisplayUom(uom, display)}`;
    })
    .join(' + ');
}
