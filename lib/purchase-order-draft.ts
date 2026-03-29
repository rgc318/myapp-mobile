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
  imageUrl?: string | null;
  standardBuyingRate?: number | null;
  qty: string;
  price: string;
  warehouse: string;
  uom: string;
  stockUom?: string | null;
  totalQty?: number | null;
  allUoms?: string[];
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
};

const STORAGE_KEY = 'myapp-mobile.purchase-order-draft';
const FORM_STORAGE_KEY = 'myapp-mobile.purchase-order-draft-form';

let purchaseOrderDraft: PurchaseOrderDraftItem[] = [];
let purchaseOrderDraftForm: PurchaseOrderDraftForm | null = null;

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
    imageUrl: typeof item.imageUrl === 'string' ? item.imageUrl : null,
    standardBuyingRate: normalizeOptionalNumber(item.standardBuyingRate),
    qty: typeof item.qty === 'string' ? item.qty : '1',
    price: typeof item.price === 'string' ? item.price : '',
    warehouse: typeof item.warehouse === 'string' ? item.warehouse : '',
    uom: typeof item.uom === 'string' ? item.uom : '',
    stockUom: typeof item.stockUom === 'string' ? item.stockUom : null,
    totalQty: normalizeOptionalNumber(item.totalQty),
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
  };
}

function persistDraft(nextDraft: PurchaseOrderDraftItem[]) {
  purchaseOrderDraft = nextDraft;
  if (canUseWebStorage()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextDraft));
  }
}

function persistDraftForm(nextDraftForm: PurchaseOrderDraftForm) {
  purchaseOrderDraftForm = nextDraftForm;
  if (canUseWebStorage()) {
    window.localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(nextDraftForm));
  }
}

export function getPurchaseOrderDraft() {
  if (!purchaseOrderDraft.length && canUseWebStorage()) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      purchaseOrderDraft = raw
        ? (JSON.parse(raw) as Partial<PurchaseOrderDraftItem>[]).map((item) => normalizeDraftItem(item)).filter((item) => item.itemCode)
        : [];
    } catch {
      purchaseOrderDraft = [];
    }
  }

  purchaseOrderDraft = purchaseOrderDraft.map((item) => normalizeDraftItem(item)).filter((item) => item.itemCode);
  return purchaseOrderDraft.map((item) => ({ ...item }));
}

export function getPurchaseOrderDraftForm() {
  if (!purchaseOrderDraftForm && canUseWebStorage()) {
    try {
      const raw = window.localStorage.getItem(FORM_STORAGE_KEY);
      purchaseOrderDraftForm = raw ? normalizeDraftForm(JSON.parse(raw)) : normalizeDraftForm(null);
    } catch {
      purchaseOrderDraftForm = normalizeDraftForm(null);
    }
  }

  return purchaseOrderDraftForm ?? normalizeDraftForm(null);
}

export function updatePurchaseOrderDraftForm(patch: Partial<PurchaseOrderDraftForm>) {
  const current = getPurchaseOrderDraftForm();
  const nextDraftForm = normalizeDraftForm({
    ...current,
    ...patch,
  });
  persistDraftForm(nextDraftForm);
  return nextDraftForm;
}

export function replacePurchaseOrderDraft(items: PurchaseOrderDraftItem[]) {
  const nextDraft = items.map((item) => normalizeDraftItem(item)).filter((item) => item.itemCode);
  persistDraft(nextDraft);
}

export function clearPurchaseOrderDraft() {
  purchaseOrderDraft = [];
  purchaseOrderDraftForm = normalizeDraftForm(null);

  if (canUseWebStorage()) {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(FORM_STORAGE_KEY);
  }
}

export function upsertPurchaseOrderDraftItem(item: PurchaseOrderDraftItem) {
  const normalizedItem = normalizeDraftItem(item);
  const existingIndex = purchaseOrderDraft.findIndex((entry) => entry.id === normalizedItem.id);

  if (existingIndex >= 0) {
    const nextDraft = [...purchaseOrderDraft];
    nextDraft[existingIndex] = normalizedItem;
    persistDraft(nextDraft);
    return;
  }

  persistDraft([...purchaseOrderDraft, normalizedItem]);
}

export function removePurchaseOrderDraftItem(itemId: string) {
  persistDraft(purchaseOrderDraft.filter((item) => item.id !== itemId));
}
