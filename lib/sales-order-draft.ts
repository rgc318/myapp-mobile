import { Platform } from 'react-native';

import type { UomConversion } from '@/lib/uom-conversion';
import type { PriceSummary, SalesMode, SalesProfile } from '@/lib/sales-mode';
import { buildModeDefaults, normalizeSalesMode } from '@/lib/sales-mode';
import type { ProductSearchItem } from '@/services/gateway';

export type SalesOrderDraftItem = {
  draftKey: string;
  itemCode: string;
  itemName: string;
  imageUrl?: string | null;
  qty: number;
  price: number | null;
  uom: string | null;
  salesMode?: SalesMode;
  allUoms?: string[];
  uomConversions?: UomConversion[];
  stockUom?: string | null;
  stockQty?: number | null;
  warehouseStockQty?: number | null;
  warehouseStockUom?: string | null;
  wholesaleDefaultUom?: string | null;
  retailDefaultUom?: string | null;
  salesProfiles?: SalesProfile[];
  priceSummary?: PriceSummary | null;
  warehouse: string | null;
};

export type SalesOrderDraftForm = {
  customer: string;
  company: string;
  defaultSalesMode: SalesMode;
  deliveryDate: string;
  remarks: string;
  shippingAddress: string;
  shippingContact: string;
  shippingPhone: string;
};

const STORAGE_KEY = 'myapp-mobile.sales-order-draft';
const FORM_STORAGE_KEY = 'myapp-mobile.sales-order-draft-form';
const DEFAULT_SCOPE = 'default';

let memoryDraftByScope: Record<string, SalesOrderDraftItem[]> = {};
let memoryDraftFormByScope: Record<string, SalesOrderDraftForm> = {};

function buildDraftKey(item: {
  itemCode: string;
  warehouse: string | null;
}) {
  return [item.itemCode, item.warehouse ?? ''].join('::');
}

function normalizeDraftItem(item: Partial<SalesOrderDraftItem>) {
  const itemCode = typeof item.itemCode === 'string' ? item.itemCode : '';
  const warehouse = typeof item.warehouse === 'string' ? item.warehouse : null;
  const uom = typeof item.uom === 'string' ? item.uom : null;
  const canonicalDraftKey = buildDraftKey({ itemCode, warehouse });

  return {
    draftKey: canonicalDraftKey,
    itemCode,
    itemName: typeof item.itemName === 'string' ? item.itemName : itemCode,
    imageUrl: typeof item.imageUrl === 'string' ? item.imageUrl : null,
    qty: typeof item.qty === 'number' && Number.isFinite(item.qty) ? item.qty : 1,
    price: typeof item.price === 'number' && Number.isFinite(item.price) ? item.price : null,
    uom,
    salesMode: normalizeSalesMode(item.salesMode),
    allUoms: Array.isArray(item.allUoms)
      ? item.allUoms.map((value) => (typeof value === 'string' ? value : '')).filter(Boolean)
      : [],
    uomConversions: Array.isArray(item.uomConversions)
      ? item.uomConversions
          .map((entry) =>
            entry && typeof entry === 'object' && typeof entry.uom === 'string'
              ? {
                  uom: entry.uom,
                  conversionFactor:
                    typeof entry.conversionFactor === 'number' && Number.isFinite(entry.conversionFactor)
                      ? entry.conversionFactor
                      : null,
                }
              : null,
          )
          .filter((entry): entry is UomConversion => Boolean(entry))
      : [],
    stockUom: typeof item.stockUom === 'string' ? item.stockUom : null,
    stockQty: typeof item.stockQty === 'number' && Number.isFinite(item.stockQty) ? item.stockQty : null,
    warehouseStockQty:
      typeof item.warehouseStockQty === 'number' && Number.isFinite(item.warehouseStockQty)
        ? item.warehouseStockQty
        : null,
    warehouseStockUom: typeof item.warehouseStockUom === 'string' ? item.warehouseStockUom : null,
    wholesaleDefaultUom:
      typeof item.wholesaleDefaultUom === 'string' ? item.wholesaleDefaultUom : null,
    retailDefaultUom:
      typeof item.retailDefaultUom === 'string' ? item.retailDefaultUom : null,
    salesProfiles: Array.isArray(item.salesProfiles) ? item.salesProfiles : [],
    priceSummary:
      item.priceSummary && typeof item.priceSummary === 'object'
        ? (item.priceSummary as PriceSummary)
        : null,
    warehouse,
  } satisfies SalesOrderDraftItem;
}

function canUseWebStorage() {
  return Platform.OS === 'web' && typeof window !== 'undefined' && !!window.localStorage;
}

function getStorageKey(scope: string) {
  return `${STORAGE_KEY}.${scope || DEFAULT_SCOPE}`;
}

function getFormStorageKey(scope: string) {
  return `${FORM_STORAGE_KEY}.${scope || DEFAULT_SCOPE}`;
}

function getScope(scope?: string) {
  return scope?.trim() || DEFAULT_SCOPE;
}

export function getSalesOrderDraft(scope?: string) {
  const normalizedScope = getScope(scope);

  if (memoryDraftByScope[normalizedScope]?.length) {
    memoryDraftByScope[normalizedScope] = memoryDraftByScope[normalizedScope]
      .map((item) => normalizeDraftItem(item))
      .filter((item) => item.itemCode);
    return memoryDraftByScope[normalizedScope];
  }

  if (canUseWebStorage()) {
    try {
      const raw = window.localStorage.getItem(getStorageKey(normalizedScope));
      if (raw) {
        const parsed = JSON.parse(raw);
        memoryDraftByScope[normalizedScope] = Array.isArray(parsed)
          ? parsed.map((item) => normalizeDraftItem(item)).filter((item) => item.itemCode)
          : [];
      } else {
        memoryDraftByScope[normalizedScope] = [];
      }
    } catch {
      memoryDraftByScope[normalizedScope] = [];
    }
  }

  memoryDraftByScope[normalizedScope] = (memoryDraftByScope[normalizedScope] ?? [])
    .map((item) => normalizeDraftItem(item))
    .filter((item) => item.itemCode);

  return memoryDraftByScope[normalizedScope];
}

function normalizeDraftForm(value: Partial<SalesOrderDraftForm> | null | undefined): SalesOrderDraftForm {
  return {
    customer: typeof value?.customer === 'string' ? value.customer : '',
    company: typeof value?.company === 'string' ? value.company : '',
    defaultSalesMode: normalizeSalesMode(value?.defaultSalesMode),
    deliveryDate: typeof value?.deliveryDate === 'string' ? value.deliveryDate : '',
    remarks: typeof value?.remarks === 'string' ? value.remarks : '',
    shippingAddress: typeof value?.shippingAddress === 'string' ? value.shippingAddress : '',
    shippingContact: typeof value?.shippingContact === 'string' ? value.shippingContact : '',
    shippingPhone: typeof value?.shippingPhone === 'string' ? value.shippingPhone : '',
  };
}

export function hasSalesOrderDraftForm(scope?: string) {
  const normalizedScope = getScope(scope);

  if (Object.prototype.hasOwnProperty.call(memoryDraftFormByScope, normalizedScope)) {
    return true;
  }

  if (canUseWebStorage()) {
    return window.localStorage.getItem(getFormStorageKey(normalizedScope)) !== null;
  }

  return false;
}

export function getSalesOrderDraftForm(scope?: string) {
  const normalizedScope = getScope(scope);

  if (memoryDraftFormByScope[normalizedScope]) {
    return memoryDraftFormByScope[normalizedScope];
  }

  if (canUseWebStorage()) {
    try {
      const raw = window.localStorage.getItem(getFormStorageKey(normalizedScope));
      memoryDraftFormByScope[normalizedScope] = raw
        ? normalizeDraftForm(JSON.parse(raw))
        : normalizeDraftForm(null);
    } catch {
      memoryDraftFormByScope[normalizedScope] = normalizeDraftForm(null);
    }
  }

  return memoryDraftFormByScope[normalizedScope] ?? normalizeDraftForm(null);
}

function persistDraft(nextDraft: SalesOrderDraftItem[], scope?: string) {
  const normalizedScope = getScope(scope);
  memoryDraftByScope[normalizedScope] = nextDraft;

  if (canUseWebStorage()) {
    window.localStorage.setItem(getStorageKey(normalizedScope), JSON.stringify(nextDraft));
  }
}

function persistDraftForm(nextDraftForm: SalesOrderDraftForm, scope?: string) {
  const normalizedScope = getScope(scope);
  memoryDraftFormByScope[normalizedScope] = nextDraftForm;

  if (canUseWebStorage()) {
    window.localStorage.setItem(getFormStorageKey(normalizedScope), JSON.stringify(nextDraftForm));
  }
}

export function replaceSalesOrderDraft(items: Partial<SalesOrderDraftItem>[], scope?: string) {
  const normalizedItems = items.map((item) => normalizeDraftItem(item)).filter((item) => item.itemCode);
  persistDraft(normalizedItems, scope);
  return normalizedItems;
}

export function updateSalesOrderDraftForm(
  patch: Partial<SalesOrderDraftForm>,
  scope?: string,
) {
  const current = getSalesOrderDraftForm(scope);
  const nextDraftForm = normalizeDraftForm({
    ...current,
    ...patch,
  });
  persistDraftForm(nextDraftForm, scope);
  return nextDraftForm;
}

export function addItemToSalesOrderDraft(
  item: ProductSearchItem,
  scope?: string,
  options?: { defaultSalesMode?: SalesMode },
) {
  const current = [...getSalesOrderDraft(scope)];
  const defaultSalesMode = options?.defaultSalesMode ?? getSalesOrderDraftForm(scope).defaultSalesMode;
  const defaults = buildModeDefaults(
    {
      salesProfiles: item.salesProfiles,
      wholesaleDefaultUom: item.wholesaleDefaultUom,
      retailDefaultUom: item.retailDefaultUom,
      allUoms: item.allUoms,
      stockUom: item.stockUom,
      uom: item.uom,
      priceSummary: item.priceSummary,
      price: item.price,
    },
    defaultSalesMode,
  );
  const draftKey = buildDraftKey({
    itemCode: item.itemCode,
    warehouse: item.warehouse,
  });
  const existing = current.find((entry) => entry.draftKey === draftKey);

  if (existing) {
    existing.qty += 1;
    if (!existing.imageUrl && item.imageUrl) {
      existing.imageUrl = item.imageUrl;
    }
    persistDraft(current, scope);
    return current;
  }

  current.push({
    draftKey,
    itemCode: item.itemCode,
    itemName: item.itemName,
    imageUrl: item.imageUrl ?? null,
    qty: 1,
    price: defaults.price,
    uom: defaults.uom || item.uom,
    salesMode: defaults.salesMode,
    allUoms: item.allUoms ?? [],
    uomConversions: item.uomConversions ?? [],
    stockUom: item.stockUom ?? null,
    stockQty: item.stockQty ?? null,
    warehouseStockQty: item.warehouseStockQty ?? item.stockQty ?? null,
    warehouseStockUom: item.warehouseStockUom ?? item.stockUom ?? null,
    wholesaleDefaultUom: item.wholesaleDefaultUom ?? null,
    retailDefaultUom: item.retailDefaultUom ?? null,
    salesProfiles: item.salesProfiles ?? [],
    priceSummary: item.priceSummary ?? null,
    warehouse: item.warehouse,
  });
  persistDraft(current, scope);
  return current;
}

export function restoreSalesOrderDraftItem(item: SalesOrderDraftItem, scope?: string) {
  const current = [...getSalesOrderDraft(scope)];
  const normalized = normalizeDraftItem(item);
  const existingIndex = current.findIndex((entry) => entry.draftKey === normalized.draftKey);

  if (existingIndex >= 0) {
    current[existingIndex] = normalized;
  } else {
    const legacyIndex = current.findIndex(
      (entry) =>
        entry.itemCode === normalized.itemCode &&
        (entry.warehouse ?? '') === (normalized.warehouse ?? ''),
    );

    if (legacyIndex >= 0) {
      current[legacyIndex] = normalized;
    } else {
      current.push(normalized);
    }
  }

  persistDraft(current, scope);
  return current;
}

export function updateSalesOrderDraftQty(draftKey: string, qty: number, scope?: string) {
  const current = getSalesOrderDraft(scope)
    .map((item) => (item.draftKey === draftKey ? { ...item, qty } : item))
    .filter((item) => item.qty > 0);
  persistDraft(current, scope);
  return current;
}

export function updateSalesOrderDraftField(
  draftKey: string,
  field: 'price' | 'warehouse',
  value: number | string | null,
  scope?: string,
) {
  const current = getSalesOrderDraft(scope).map((item) => {
    if (item.draftKey !== draftKey) {
      return item;
    }

    if (field === 'price') {
      return normalizeDraftItem({
        ...item,
        price: typeof value === 'number' ? value : value === null ? null : Number(value) || 0,
      });
    }

    return normalizeDraftItem({
      ...item,
      warehouse: typeof value === 'string' ? value : null,
    });
  });
  persistDraft(current, scope);
  return current;
}

export function removeSalesOrderDraftItem(draftKey: string, scope?: string) {
  const current = getSalesOrderDraft(scope).filter((item) => item.draftKey !== draftKey);
  persistDraft(current, scope);
  return current;
}

export function clearSalesOrderDraft(scope?: string) {
  persistDraft([], scope);
  persistDraftForm(normalizeDraftForm(null), scope);
}

export function clearSalesOrderDraftForm(scope?: string) {
  persistDraftForm(normalizeDraftForm(null), scope);
}
