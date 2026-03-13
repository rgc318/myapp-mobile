import { getApiBaseUrl } from '@/lib/config';

export type ProductSearchItem = {
  itemCode: string;
  itemName: string;
  stockQty: number | null;
  price: number | null;
  uom: string | null;
  warehouse: string | null;
};

export type SalesOrderItemInput = {
  item_code: string;
  qty: number;
  price?: number;
  warehouse?: string;
  uom?: string;
};

type GatewayResponse<T> = {
  message?: {
    ok?: boolean;
    data?: T;
    message?: string;
  };
  exc?: string;
};

function randomRequestId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function postGateway<T>(method: string, payload: Record<string, unknown>) {
  const response = await fetch(`${getApiBaseUrl()}/api/method/${method}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  const body: GatewayResponse<T> = await response.json().catch(() => ({}));

  if (!response.ok || body?.message?.ok === false) {
    const message = body?.message?.message || body?.exc || '请求失败，请稍后重试。';
    throw new Error(String(message));
  }

  return body?.message?.data as T;
}

export async function searchProducts(
  query: string,
  options?: {
    warehouse?: string;
    company?: string;
    limit?: number;
  },
) {
  const data = await postGateway<any>('myapp.api.gateway.search_product', {
    search_key: query,
    warehouse: options?.warehouse,
    company: options?.company,
    limit: options?.limit ?? 20,
  });

  const rows = Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data)
      ? data
      : [];

  return rows
    .map((row: Record<string, unknown>) => ({
      itemCode: String(row.item_code ?? row.itemCode ?? ''),
      itemName: String(row.item_name ?? row.itemName ?? ''),
      stockQty: typeof row.stock_qty === 'number' ? row.stock_qty : typeof row.actual_qty === 'number' ? row.actual_qty : null,
      price: typeof row.price === 'number' ? row.price : typeof row.rate === 'number' ? row.rate : null,
      uom: typeof row.uom === 'string' ? row.uom : null,
      warehouse: typeof row.warehouse === 'string' ? row.warehouse : null,
    }))
    .filter((row: ProductSearchItem) => row.itemCode);
}

export async function createSalesOrder(payload: {
  customer: string;
  company: string;
  items: SalesOrderItemInput[];
  immediate?: boolean;
  posting_date?: string;
  remarks?: string;
}) {
  return postGateway<any>('myapp.api.gateway.create_order', {
    customer: payload.customer,
    company: payload.company,
    items: payload.items,
    immediate: payload.immediate ?? false,
    posting_date: payload.posting_date,
    remarks: payload.remarks,
    request_id: randomRequestId('mobile-sales-order'),
  });
}
