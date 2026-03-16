import { getApiBaseUrl } from '@/lib/config';

export type ProductSearchItem = {
  itemCode: string;
  itemName: string;
  stockQty: number | null;
  price: number | null;
  uom: string | null;
  warehouse: string | null;
  imageUrl?: string | null;
};

export type SalesOrderItemInput = {
  item_code: string;
  qty: number;
  price?: number;
  warehouse?: string;
  uom?: string;
};


export type SalesInvoiceItemInput = {
  item_code?: string;
  qty?: number;
  price?: number;
  sales_order_item?: string;
  so_detail?: string;
};

export type SalesPaymentInput = {
  reference_doctype: string;
  reference_name: string;
  paid_amount: number;
  mode_of_payment?: string;
  reference_no?: string;
  reference_date?: string;
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

function toOptionalNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
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
      stockQty:
        toOptionalNumber(row.stock_qty) ??
        toOptionalNumber(row.actual_qty) ??
        toOptionalNumber(row.qty) ??
        null,
      price: toOptionalNumber(row.price) ?? toOptionalNumber(row.rate) ?? null,
      uom: typeof row.uom === 'string' ? row.uom : null,
      warehouse:
        typeof row.warehouse === 'string' && row.warehouse.trim()
          ? row.warehouse
          : options?.warehouse ?? null,
      imageUrl:
        typeof row.image === 'string'
          ? row.image
          : typeof row.image_url === 'string'
            ? row.image_url
            : typeof row.item_image === 'string'
              ? row.item_image
              : null,
    }))
    .filter((row: ProductSearchItem) => row.itemCode);
}

export async function createSalesOrder(payload: {
  customer: string;
  company: string;
  items: SalesOrderItemInput[];
  immediate?: boolean;
  transaction_date?: string;
  remarks?: string;
}) {
  return postGateway<any>('myapp.api.gateway.create_order', {
    customer: payload.customer,
    company: payload.company,
    items: payload.items,
    immediate: payload.immediate ?? false,
    transaction_date: payload.transaction_date,
    remarks: payload.remarks,
    request_id: randomRequestId('mobile-sales-order'),
  });
}


export async function createSalesInvoice(payload: {
  source_name: string;
  invoice_items?: SalesInvoiceItemInput[];
  due_date?: string;
  remarks?: string;
  update_stock?: boolean;
}) {
  return postGateway<any>('myapp.api.gateway.create_sales_invoice', {
    source_name: payload.source_name,
    invoice_items: payload.invoice_items,
    due_date: payload.due_date,
    remarks: payload.remarks,
    update_stock: payload.update_stock ?? false,
    request_id: randomRequestId('mobile-sales-invoice'),
  });
}

export async function recordSalesPayment(payload: SalesPaymentInput) {
  return postGateway<any>('myapp.api.gateway.update_payment_status', {
    reference_doctype: payload.reference_doctype,
    reference_name: payload.reference_name,
    paid_amount: payload.paid_amount,
    mode_of_payment: payload.mode_of_payment,
    reference_no: payload.reference_no,
    reference_date: payload.reference_date,
    request_id: randomRequestId('mobile-sales-payment'),
  });
}
