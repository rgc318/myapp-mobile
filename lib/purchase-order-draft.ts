import { Platform } from 'react-native';

import type { UomConversion } from '@/lib/uom-conversion';

export type PurchaseOrderWarehouseStockDetail = {
  warehouse: string;
  company: string | null;
  qty: number;
};

export type PurchaseOrderDraftItem = {
  id: string;
  itemCode: string;
  itemName: string;
  nickname?: string | null;
  specification?: string | null;
  imageUrl?: string | null;
  standardBuyingRate?: number | null;
  qty: string;
  price: string;
  warehouse: string;
  uom: string;
  uomDisplay?: string | null;
  stockUom?: string | null;
  stockUomDisplay?: string | null;
  totalQty?: number | null;
  allUoms?: string[];
  allUomDisplays?: Record<string, string>;
  uomConversions?: UomConversion[];
  warehouseStockDetails?: PurchaseOrderWarehouseStockDetail[];
};

export type PurchaseOrderDraftForm = {
  supplier: string;
  company: string;
  remarks: string;
  supplierRef: string;
  transactionDate: string;
  scheduleDate: string;
  defaultWarehouse: string;
  defaultWarehouseTouched: boolean;
};

const STORAGE_KEY = 'myapp-mobile.purchase-order-draft';
const FORM_STORAGE_KEY = 'myapp-mobile.purchase-order-draft-form';

let purchaseOrderDraft: PurchaseOrderDraftItem[] = [];
let purchaseOrderDraftForm: PurchaseOrderDraftForm | null = null;
const scopedPurchaseOrderDrafts: Record<string, PurchaseOrderDraftItem[] | undefined> = {};
const scopedPurchaseOrderDraftForms: Record<string, PurchaseOrderDraftForm | undefined> = {};

function canUseWebStorage() {
  return Platform.OS === 'web' && typeof window !== 'undefined' && !!window.localStorage;
}

function normalizeOptionalNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeDraftItem(item: Partial<PurchaseOrderDraftItem>) {
  return {
    id: typeof item.id === 'string' ? item.id : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    itemCode: typeof item.itemCode === 'string' ? item.itemCode : '',
    itemName: typeof item.itemName === 'string' ? item.itemName : typeof item.itemCode === 'string' ? item.itemCode : '',
    nickname: typeof item.nickname === 'string' ? item.nickname : null,
    specification: typeof item.specification === 'string' ? item.specification : null,
    imageUrl: typeof item.imageUrl === 'string' ? item.imageUrl : null,
    standardBuyingRate: normalizeOptionalNumber(item.standardBuyingRate),
    qty: typeof item.qty === 'string' ? item.qty : '1',
    price: typeof item.price === 'string' ? item.price : '',
    warehouse: typeof item.warehouse === 'string' ? item.warehouse : '',
    uom: typeof item.uom === 'string' ? item.uom : '',
    uomDisplay: typeof item.uomDisplay === 'string' ? item.uomDisplay : null,
    stockUom: typeof item.stockUom === 'string' ? item.stockUom : null,
    stockUomDisplay: typeof item.stockUomDisplay === 'string' ? item.stockUomDisplay : null,
    totalQty: normalizeOptionalNumber(item.totalQty),
    allUoms: Array.isArray(item.allUoms)
      ? item.allUoms.map((value) => (typeof value === 'string' ? value : '')).filter(Boolean)
      : [],
    allUomDisplays:
      item.allUomDisplays && typeof item.allUomDisplays === 'object'
        ? Object.fromEntries(
            Object.entries(item.allUomDisplays).filter(
              ([key, value]) => typeof key === 'string' && typeof value === 'string' && key.trim() && value.trim(),
            ),
          )
        : {},
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
    warehouseStockDetails: Array.isArray(item.warehouseStockDetails)
      ? item.warehouseStockDetails
          .map((entry) =>
            entry &&
            typeof entry === 'object' &&
            typeof entry.warehouse === 'string' &&
            typeof entry.qty === 'number' &&
            Number.isFinite(entry.qty)
              ? {
                  warehouse: entry.warehouse,
                  company: typeof entry.company === 'string' ? entry.company : null,
                  qty: entry.qty,
                }
              : null,
          )
          .filter((entry): entry is PurchaseOrderWarehouseStockDetail => Boolean(entry))
      : [],
  } satisfies PurchaseOrderDraftItem;
}

function normalizeDraftForm(value: Partial<PurchaseOrderDraftForm> | null | undefined): PurchaseOrderDraftForm {
  return {
    supplier: typeof value?.supplier === 'string' ? value.supplier : '',
    company: typeof value?.company === 'string' ? value.company : '',
    remarks: typeof value?.remarks === 'string' ? value.remarks : '',
    supplierRef: typeof value?.supplierRef === 'string' ? value.supplierRef : '',
    transactionDate: typeof value?.transactionDate === 'string' ? value.transactionDate : '',
    scheduleDate: typeof value?.scheduleDate === 'string' ? value.scheduleDate : '',
    defaultWarehouse: typeof value?.defaultWarehouse === 'string' ? value.defaultWarehouse : '',
    defaultWarehouseTouched: value?.defaultWarehouseTouched === true,
  };
}

function buildScopedStorageKey(baseKey: string, scopeKey?: string) {
  return scopeKey ? `${baseKey}::${scopeKey}` : baseKey;
}

function getDraftStore(scopeKey?: string) {
  if (!scopeKey) {
    return {
      get current() {
        return purchaseOrderDraft;
      },
      set current(value: PurchaseOrderDraftItem[]) {
        purchaseOrderDraft = value;
      },
    };
  }

  return {
    get current() {
      return scopedPurchaseOrderDrafts[scopeKey] ?? [];
    },
    set current(value: PurchaseOrderDraftItem[]) {
      scopedPurchaseOrderDrafts[scopeKey] = value;
    },
  };
}

function getDraftFormStore(scopeKey?: string) {
  if (!scopeKey) {
    return {
      get current() {
        return purchaseOrderDraftForm;
      },
      set current(value: PurchaseOrderDraftForm | null) {
        purchaseOrderDraftForm = value;
      },
    };
  }

  return {
    get current() {
      return scopedPurchaseOrderDraftForms[scopeKey];
    },
    set current(value: PurchaseOrderDraftForm | null) {
      if (value) {
        scopedPurchaseOrderDraftForms[scopeKey] = value;
      } else {
        delete scopedPurchaseOrderDraftForms[scopeKey];
      }
    },
  };
}

function persistScopedDraft(nextDraft: PurchaseOrderDraftItem[], scopeKey?: string) {
  const store = getDraftStore(scopeKey);
  store.current = nextDraft;
  if (canUseWebStorage()) {
    window.localStorage.setItem(buildScopedStorageKey(STORAGE_KEY, scopeKey), JSON.stringify(nextDraft));
  }
}

function persistScopedDraftForm(nextDraftForm: PurchaseOrderDraftForm, scopeKey?: string) {
  const store = getDraftFormStore(scopeKey);
  store.current = nextDraftForm;
  if (canUseWebStorage()) {
    window.localStorage.setItem(buildScopedStorageKey(FORM_STORAGE_KEY, scopeKey), JSON.stringify(nextDraftForm));
  }
}

export function hasPurchaseOrderDraft(scopeKey?: string) {
  const store = getDraftStore(scopeKey);
  if (store.current.length > 0) {
    return true;
  }

  if (canUseWebStorage()) {
    try {
      const raw = window.localStorage.getItem(buildScopedStorageKey(STORAGE_KEY, scopeKey));
      if (!raw) {
        return false;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return false;
      }
      return parsed.some(
        (item) => item && typeof item === 'object' && typeof (item as Partial<PurchaseOrderDraftItem>).itemCode === 'string' && (item as Partial<PurchaseOrderDraftItem>).itemCode?.trim(),
      );
    } catch {
      return false;
    }
  }

  return false;
}

export function hasPurchaseOrderDraftForm(scopeKey?: string) {
  const store = getDraftFormStore(scopeKey);
  if (store.current) {
    return true;
  }

  if (canUseWebStorage()) {
    return Boolean(window.localStorage.getItem(buildScopedStorageKey(FORM_STORAGE_KEY, scopeKey)));
  }

  return false;
}

export function getPurchaseOrderDraft(scopeKey?: string) {
  const store = getDraftStore(scopeKey);

  if (!store.current.length && canUseWebStorage()) {
    try {
      const raw = window.localStorage.getItem(buildScopedStorageKey(STORAGE_KEY, scopeKey));
      store.current = raw
        ? (JSON.parse(raw) as Partial<PurchaseOrderDraftItem>[]).map((item) => normalizeDraftItem(item)).filter((item) => item.itemCode)
        : [];
    } catch {
      store.current = [];
    }
  }

  store.current = store.current.map((item) => normalizeDraftItem(item)).filter((item) => item.itemCode);
  return store.current.map((item) => ({ ...item }));
}

export function getPurchaseOrderDraftForm(scopeKey?: string) {
  const store = getDraftFormStore(scopeKey);

  if (!store.current && canUseWebStorage()) {
    try {
      const raw = window.localStorage.getItem(buildScopedStorageKey(FORM_STORAGE_KEY, scopeKey));
      store.current = raw ? normalizeDraftForm(JSON.parse(raw)) : normalizeDraftForm(null);
    } catch {
      store.current = normalizeDraftForm(null);
    }
  }

  return store.current ?? normalizeDraftForm(null);
}

export function updatePurchaseOrderDraftForm(patch: Partial<PurchaseOrderDraftForm>, scopeKey?: string) {
  const current = getPurchaseOrderDraftForm(scopeKey);
  const nextDraftForm = normalizeDraftForm({
    ...current,
    ...patch,
  });
  persistScopedDraftForm(nextDraftForm, scopeKey);
  return nextDraftForm;
}

export function replacePurchaseOrderDraft(items: PurchaseOrderDraftItem[], scopeKey?: string) {
  const nextDraft = items.map((item) => normalizeDraftItem(item)).filter((item) => item.itemCode);
  persistScopedDraft(nextDraft, scopeKey);
}

export function clearPurchaseOrderDraft(scopeKey?: string) {
  const draftStore = getDraftStore(scopeKey);
  const formStore = getDraftFormStore(scopeKey);
  draftStore.current = [];
  formStore.current = scopeKey ? null : normalizeDraftForm(null);

  if (canUseWebStorage()) {
    window.localStorage.removeItem(buildScopedStorageKey(STORAGE_KEY, scopeKey));
    window.localStorage.removeItem(buildScopedStorageKey(FORM_STORAGE_KEY, scopeKey));
  }
}

export function upsertPurchaseOrderDraftItem(item: PurchaseOrderDraftItem, scopeKey?: string) {
  const currentDraft = getPurchaseOrderDraft(scopeKey);
  const normalizedItem = normalizeDraftItem(item);
  const existingIndex = currentDraft.findIndex((entry) => entry.id === normalizedItem.id);

  if (existingIndex >= 0) {
    const nextDraft = [...currentDraft];
    nextDraft[existingIndex] = normalizedItem;
    persistScopedDraft(nextDraft, scopeKey);
    return;
  }

  persistScopedDraft([...currentDraft, normalizedItem], scopeKey);
}

export function removePurchaseOrderDraftItem(itemId: string, scopeKey?: string) {
  const currentDraft = getPurchaseOrderDraft(scopeKey);
  persistScopedDraft(currentDraft.filter((item) => item.id !== itemId), scopeKey);
}
