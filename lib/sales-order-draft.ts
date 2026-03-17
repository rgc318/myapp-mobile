import { Platform } from 'react-native';

import type { ProductSearchItem } from '@/services/gateway';

export type SalesOrderDraftItem = {
  draftKey: string;
  itemCode: string;
  itemName: string;
  imageUrl?: string | null;
  qty: number;
  price: number | null;
  uom: string | null;
  warehouse: string | null;
};

const STORAGE_KEY = 'myapp-mobile.sales-order-draft';

let memoryDraft: SalesOrderDraftItem[] = [];

function buildDraftKey(item: {
  itemCode: string;
  warehouse: string | null;
  uom: string | null;
}) {
  return [item.itemCode, item.warehouse ?? '', item.uom ?? ''].join('::');
}

function normalizeDraftItem(item: Partial<SalesOrderDraftItem>) {
  const itemCode = typeof item.itemCode === 'string' ? item.itemCode : '';
  const warehouse = typeof item.warehouse === 'string' ? item.warehouse : null;
  const uom = typeof item.uom === 'string' ? item.uom : null;

  return {
    draftKey: typeof item.draftKey === 'string' && item.draftKey ? item.draftKey : buildDraftKey({ itemCode, warehouse, uom }),
    itemCode,
    itemName: typeof item.itemName === 'string' ? item.itemName : itemCode,
    imageUrl: typeof item.imageUrl === 'string' ? item.imageUrl : null,
    qty: typeof item.qty === 'number' && Number.isFinite(item.qty) ? item.qty : 1,
    price: typeof item.price === 'number' && Number.isFinite(item.price) ? item.price : null,
    uom,
    warehouse,
  } satisfies SalesOrderDraftItem;
}

function canUseWebStorage() {
  return Platform.OS === 'web' && typeof window !== 'undefined' && !!window.localStorage;
}

export function getSalesOrderDraft() {
  if (memoryDraft.length) {
    return memoryDraft;
  }

  if (canUseWebStorage()) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        memoryDraft = Array.isArray(parsed)
          ? parsed.map((item) => normalizeDraftItem(item)).filter((item) => item.itemCode)
          : [];
      }
    } catch {
      memoryDraft = [];
    }
  }

  return memoryDraft;
}

function persistDraft(nextDraft: SalesOrderDraftItem[]) {
  memoryDraft = nextDraft;

  if (canUseWebStorage()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextDraft));
  }
}

export function addItemToSalesOrderDraft(item: ProductSearchItem) {
  const current = [...getSalesOrderDraft()];
  const draftKey = buildDraftKey({
    itemCode: item.itemCode,
    warehouse: item.warehouse,
    uom: item.uom,
  });
  const existing = current.find((entry) => entry.draftKey === draftKey);

  if (existing) {
    existing.qty += 1;
    if (!existing.imageUrl && item.imageUrl) {
      existing.imageUrl = item.imageUrl;
    }
    persistDraft(current);
    return current;
  }

  current.push({
    draftKey,
    itemCode: item.itemCode,
    itemName: item.itemName,
    imageUrl: item.imageUrl ?? null,
    qty: 1,
    price: item.price,
    uom: item.uom,
    warehouse: item.warehouse,
  });
  persistDraft(current);
  return current;
}

export function restoreSalesOrderDraftItem(item: SalesOrderDraftItem) {
  const current = [...getSalesOrderDraft()];
  const normalized = normalizeDraftItem(item);
  const existingIndex = current.findIndex((entry) => entry.draftKey === normalized.draftKey);

  if (existingIndex >= 0) {
    current[existingIndex] = normalized;
  } else {
    current.push(normalized);
  }

  persistDraft(current);
  return current;
}

export function updateSalesOrderDraftQty(draftKey: string, qty: number) {
  const current = getSalesOrderDraft()
    .map((item) => (item.draftKey === draftKey ? { ...item, qty } : item))
    .filter((item) => item.qty > 0);
  persistDraft(current);
  return current;
}

export function updateSalesOrderDraftField(
  draftKey: string,
  field: 'price' | 'warehouse',
  value: number | string | null,
) {
  const current = getSalesOrderDraft().map((item) => {
    if (item.draftKey !== draftKey) {
      return item;
    }

    if (field === 'price') {
      return { ...item, price: typeof value === 'number' ? value : value === null ? null : Number(value) || 0 };
    }

    return { ...item, warehouse: typeof value === 'string' ? value : null };
  });
  persistDraft(current);
  return current;
}

export function removeSalesOrderDraftItem(draftKey: string) {
  const current = getSalesOrderDraft().filter((item) => item.draftKey !== draftKey);
  persistDraft(current);
  return current;
}

export function clearSalesOrderDraft() {
  persistDraft([]);
}
