import { callGatewayMethod } from '@/lib/api-client';
import { createSalesOrderV2, type SalesOrderItemInput } from '@/services/gateway';
import { checkLinkOptionExists, searchLinkOptions } from '@/services/master-data';

export type CreateSalesOrderPayload = {
  customer: string;
  company: string;
  items: SalesOrderItemInput[];
  transaction_date?: string;
  remarks?: string;
  customer_info?: {
    contact_display_name?: string;
    contact_phone?: string;
    contact_email?: string;
  };
  shipping_info?: {
    receiver_name?: string;
    receiver_phone?: string;
    shipping_address_name?: string;
    shipping_address_text?: string;
  };
};

export type SalesOrderDetailV2 = {
  name: string;
  customer: string;
  company: string;
  currency: string;
  transactionDate: string;
  grandTotal: number | null;
  status: string;
  docstatus: number;
  documentStatus: string;
  fulfillmentStatus: string;
  paymentStatus: string;
  completionStatus: string;
  deliveryDate: string;
  remarks: string;
  contactPerson: string;
  contactDisplay: string;
  contactPhone: string;
  addressDisplay: string;
  customerAddress: string;
  paidAmount: number | null;
  outstandingAmount: number | null;
  items: {
    itemCode: string;
    itemName: string;
    qty: number | null;
    rate: number | null;
    amount: number | null;
    warehouse: string;
    uom: string;
    imageUrl: string;
  }[];
};

export type SalesOrderSummaryItem = {
  name: string;
  customer: string;
  company: string;
  transactionDate: string;
  grandTotal: number | null;
  status: string;
  docstatus: number;
  outstandingAmount: number | null;
  fulfillmentStatus: string;
  paymentStatus: string;
  completionStatus: string;
  modified: string;
};

export type UpdateSalesOrderPayload = {
  orderName: string;
  deliveryDate?: string;
  remarks?: string;
  contactPerson?: string;
  contactDisplay?: string;
  contactPhone?: string;
  contactEmail?: string;
  shippingAddressName?: string;
  shippingAddressText?: string;
};

export type UpdateSalesOrderItemsPayload = {
  orderName: string;
  items: {
    itemCode: string;
    qty: number;
    price?: number | null;
    warehouse?: string;
    uom?: string;
  }[];
};

export async function cancelSalesOrderV2(orderName: string) {
  const data = await callGatewayMethod<Record<string, any>>('myapp.api.gateway.cancel_order_v2', {
    order_name: orderName,
  });

  if (data?.detail && typeof data.detail === 'object') {
    return getSalesOrderDetailV2(String(data.detail.order_name ?? orderName));
  }

  return getSalesOrderDetailV2(orderName);
}

export function searchCompanies(query: string) {
  return searchLinkOptions('Company', query);
}

export function companyExists(company: string) {
  return checkLinkOptionExists('Company', company);
}

export function submitSalesOrderV2(payload: CreateSalesOrderPayload) {
  return createSalesOrderV2(payload);
}

export async function getSalesOrderDetailV2(orderName: string): Promise<SalesOrderDetailV2 | null> {
  const data = await callGatewayMethod<Record<string, any>>(
    'myapp.api.gateway.get_sales_order_detail',
    { order_name: orderName },
  );

  if (!data || typeof data !== 'object') {
    return null;
  }

  const customer = data.customer ?? {};
  const shipping = data.shipping ?? {};
  const meta = data.meta ?? {};
  const items = Array.isArray(data.items) ? data.items : [];
  const fulfillment = data.fulfillment ?? {};
  const payment = data.payment ?? {};

  const status =
    typeof fulfillment.status === 'string'
      ? fulfillment.status
      : typeof payment.status === 'string'
        ? payment.status
        : typeof data.document_status === 'string'
          ? data.document_status
          : '';

  return {
    name: String(data.order_name ?? orderName),
    customer: String(customer.display_name ?? customer.name ?? ''),
    company: String(meta.company ?? ''),
    currency: String(meta.currency ?? 'CNY'),
    transactionDate: String(meta.transaction_date ?? ''),
    grandTotal:
      typeof data.amounts?.order_amount_estimate === 'number'
        ? data.amounts.order_amount_estimate
        : data.amounts?.order_amount_estimate
          ? Number(data.amounts.order_amount_estimate) || null
          : null,
    status,
    docstatus: data.document_status === 'submitted' ? 1 : 0,
    documentStatus: String(data.document_status ?? ''),
    fulfillmentStatus: String(fulfillment.status ?? ''),
    paymentStatus: String(payment.status ?? ''),
    completionStatus: String(data.completion?.status ?? ''),
    deliveryDate: String(meta.delivery_date ?? ''),
    remarks: String(meta.remarks ?? ''),
    contactPerson: String(shipping.contact_person ?? customer.contact_person ?? ''),
    contactDisplay: String(
      shipping.contact_display ?? customer.contact_display_name ?? '',
    ),
    contactPhone: String(shipping.contact_phone ?? customer.contact_phone ?? ''),
    addressDisplay: String(
      shipping.shipping_address_text ?? customer.shipping_address_text ?? '',
    ),
    customerAddress: String(shipping.shipping_address_name ?? customer.shipping_address_name ?? ''),
    paidAmount: toOptionalNumber(data.amounts?.paid_amount),
    outstandingAmount: toOptionalNumber(data.amounts?.outstanding_amount),
    items: items.map((item: Record<string, unknown>) => ({
      itemCode: String(item.item_code ?? ''),
      itemName: String(item.item_name ?? item.item_code ?? ''),
      qty:
        typeof item.qty === 'number' ? item.qty : item.qty ? Number(item.qty) || null : null,
      rate:
        typeof item.rate === 'number' ? item.rate : item.rate ? Number(item.rate) || null : null,
      amount:
        typeof item.amount === 'number'
          ? item.amount
          : item.amount
            ? Number(item.amount) || null
            : null,
      warehouse: String(item.warehouse ?? ''),
      uom: String(item.uom ?? ''),
      imageUrl: String(item.image ?? item.image_url ?? item.item_image ?? ''),
    })),
  };
}

export async function updateSalesOrderV2(
  payload: UpdateSalesOrderPayload,
): Promise<SalesOrderDetailV2 | null> {
  await callGatewayMethod<Record<string, unknown>>('myapp.api.gateway.update_order_v2', {
    order_name: payload.orderName,
    delivery_date: payload.deliveryDate,
    remarks: payload.remarks,
    customer_info: {
      contact_person: payload.contactPerson,
      contact_display_name: payload.contactDisplay,
      contact_phone: payload.contactPhone,
      contact_email: payload.contactEmail,
    },
    shipping_info: {
      shipping_address_name: payload.shippingAddressName,
      shipping_address_text: payload.shippingAddressText,
      receiver_name: payload.contactDisplay,
      receiver_phone: payload.contactPhone,
    },
  });

  return getSalesOrderDetailV2(payload.orderName);
}

export async function updateSalesOrderItemsV2(payload: UpdateSalesOrderItemsPayload) {
  const data = await callGatewayMethod<Record<string, any>>('myapp.api.gateway.update_order_items_v2', {
    order_name: payload.orderName,
    items: payload.items.map((item) => ({
      item_code: item.itemCode,
      qty: item.qty,
      price: item.price,
      warehouse: item.warehouse,
      uom: item.uom,
    })),
  });

  const nextOrderName = String(data?.order ?? payload.orderName);
  const detail = await getSalesOrderDetailV2(nextOrderName);

  return {
    orderName: nextOrderName,
    sourceOrderName: typeof data?.source_order === 'string' ? data.source_order : payload.orderName,
    detail,
  };
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

export async function listSalesOrderSummaries(query: string): Promise<SalesOrderSummaryItem[]> {
  const trimmedQuery = query.trim();
  const data = await callGatewayMethod<Record<string, any>[]>(
    'myapp.api.gateway.get_sales_order_status_summary',
    {
      limit: 20,
    },
  );

  const rows = Array.isArray(data) ? data : [];
  const normalized = rows.map((row: Record<string, unknown>) => {
    const fulfillment = (row.fulfillment ?? {}) as Record<string, unknown>;
    const payment = (row.payment ?? {}) as Record<string, unknown>;
    const completion = (row.completion ?? {}) as Record<string, unknown>;

    return {
      name: String(row.order_name ?? ''),
      customer: String(row.customer_name ?? row.customer ?? ''),
      company: String(row.company ?? ''),
      transactionDate: String(row.transaction_date ?? ''),
      grandTotal: toOptionalNumber(row.order_amount_estimate),
      status: String(row.document_status ?? ''),
      docstatus: row.document_status === 'submitted' ? 1 : 0,
      outstandingAmount: toOptionalNumber(row.outstanding_amount),
      fulfillmentStatus: String(fulfillment.status ?? ''),
      paymentStatus: String(payment.status ?? ''),
      completionStatus: String(completion.status ?? ''),
      modified: String(row.modified ?? ''),
    } satisfies SalesOrderSummaryItem;
  });

  if (!trimmedQuery) {
    return normalized.filter((item) => item.status !== 'cancelled');
  }

  const keyword = trimmedQuery.toLowerCase();
  return normalized.filter(
    (item) =>
      item.status !== 'cancelled' &&
      [item.name, item.customer, item.company].some((value) => value.toLowerCase().includes(keyword)),
  );
}
