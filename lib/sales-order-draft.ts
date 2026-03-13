import { Platform } from 'react-native';

import type { ProductSearchItem } from '@/services/gateway';

export type SalesOrderDraftItem = {
  itemCode: string;
  itemName: string;
  qty: number;
  price: number | null;
  uom: string | null;
  warehouse: string | null;
};

const STORAGE_KEY = 'myapp-mobile.sales-order-draft';

let memoryDraft: SalesOrderDraftItem[] = [];

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
        memoryDraft = JSON.parse(raw);
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
  const existing = current.find((entry) => entry.itemCode === item.itemCode);

  if (existing) {
    existing.qty += 1;
    persistDraft(current);
    return current;
  }

  current.push({
    itemCode: item.itemCode,
    itemName: item.itemName,
    qty: 1,
    price: item.price,
    uom: item.uom,
    warehouse: item.warehouse,
  });
  persistDraft(current);
  return current;
}

export function updateSalesOrderDraftQty(itemCode: string, qty: number) {
  const current = getSalesOrderDraft()
    .map((item) => (item.itemCode === itemCode ? { ...item, qty } : item))
    .filter((item) => item.qty > 0);
  persistDraft(current);
  return current;
}

export function updateSalesOrderDraftField(
  itemCode: string,
  field: 'price' | 'warehouse',
  value: number | string | null,
) {
  const current = getSalesOrderDraft().map((item) => {
    if (item.itemCode !== itemCode) {
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

export function removeSalesOrderDraftItem(itemCode: string) {
  const current = getSalesOrderDraft().filter((item) => item.itemCode !== itemCode);
  persistDraft(current);
  return current;
}

export function clearSalesOrderDraft() {
  persistDraft([]);
}
