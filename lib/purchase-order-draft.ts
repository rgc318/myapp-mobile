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

let purchaseOrderDraft: PurchaseOrderDraftItem[] = [];

export function getPurchaseOrderDraft() {
  return purchaseOrderDraft.map((item) => ({ ...item }));
}

export function replacePurchaseOrderDraft(items: PurchaseOrderDraftItem[]) {
  purchaseOrderDraft = items.map((item) => ({ ...item }));
}

export function clearPurchaseOrderDraft() {
  purchaseOrderDraft = [];
}

export function upsertPurchaseOrderDraftItem(item: PurchaseOrderDraftItem) {
  const existingIndex = purchaseOrderDraft.findIndex((entry) => entry.id === item.id);
  if (existingIndex >= 0) {
    const next = [...purchaseOrderDraft];
    next[existingIndex] = { ...item };
    purchaseOrderDraft = next;
    return;
  }

  purchaseOrderDraft = [...purchaseOrderDraft, { ...item }];
}

export function removePurchaseOrderDraftItem(itemId: string) {
  purchaseOrderDraft = purchaseOrderDraft.filter((item) => item.id !== itemId);
}
