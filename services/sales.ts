import { callGatewayMethod } from '@/lib/api-client';
import { compactAddressText } from '@/lib/form-utils';
import type { PriceSummary, SalesMode, SalesProfile } from '@/lib/sales-mode';
import {
  createSalesOrderV2,
  quickCreateSalesOrderV2,
  type SalesOrderItemInput,
} from '@/services/gateway';
import { checkLinkOptionExists, searchLinkOptions, type LinkOption } from '@/services/master-data';

export type CreateSalesOrderPayload = {
  customer: string;
  company: string;
  items: SalesOrderItemInput[];
  defaultSalesMode?: SalesMode;
  force_delivery?: boolean;
  delivery_date?: string;
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
  deliveryStatus: string;
  paymentStatus: string;
  completionStatus: string;
  deliveryDate: string;
  defaultSalesMode: SalesMode;
  remarks: string;
  contactPerson: string;
  contactDisplay: string;
  contactPhone: string;
  addressDisplay: string;
  customerAddress: string;
  paidAmount: number | null;
  actualPaidAmount: number | null;
  outstandingAmount: number | null;
  totalWriteoffAmount: number | null;
  latestPaymentEntry: string;
  latestPaymentInvoice: string;
  latestUnallocatedAmount: number | null;
  latestWriteoffAmount: number | null;
  latestActualPaidAmount: number | null;
  canSubmitDelivery: boolean;
  canCreateSalesInvoice: boolean;
  canRecordPayment: boolean;
  deliveryNotes: string[];
  salesInvoices: string[];
  latestDeliveryNote: string;
  latestSalesInvoice: string;
  items: {
    itemCode: string;
    itemName: string;
    qty: number | null;
    rate: number | null;
    amount: number | null;
    warehouse: string;
    uom: string;
    salesMode: SalesMode;
    allUoms?: string[];
    stockUom?: string | null;
    wholesaleDefaultUom?: string | null;
    retailDefaultUom?: string | null;
    salesProfiles?: SalesProfile[];
    priceSummary?: PriceSummary | null;
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

export type SalesDeskSearchSummary = {
  totalCount: number;
  visibleCount: number;
  unfinishedCount: number;
  deliveryCount: number;
  paymentCount: number;
  completedCount: number;
  cancelledCount: number;
};

export type QuickCancelSalesOrderResult = {
  orderName: string;
  cancelledPaymentEntries: string[];
  cancelledSalesInvoice: string;
  cancelledDeliveryNote: string;
  completedSteps: string[];
  detail: SalesOrderDetailV2 | null;
  detailLoadedFromFetch: boolean;
};

export type DeliveryNoteDetailV2 = {
  name: string;
  customer: string;
  company: string;
  currency: string;
  postingDate: string;
  postingTime: string;
  remarks: string;
  documentStatus: string;
  totalQty: number | null;
  grandTotal: number | null;
  salesOrders: string[];
  salesInvoices: string[];
  canCancelDeliveryNote: boolean;
  cancelDeliveryNoteHint: string;
  contactDisplay: string;
  contactPhone: string;
  addressDisplay: string;
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

export type SalesInvoiceDetailV2 = {
  name: string;
  customer: string;
  company: string;
  currency: string;
  postingDate: string;
  dueDate: string;
  remarks: string;
  documentStatus: string;
  grandTotal: number | null;
  receivableAmount: number | null;
  paidAmount: number | null;
  actualPaidAmount: number | null;
  outstandingAmount: number | null;
  totalWriteoffAmount: number | null;
  latestUnallocatedAmount: number | null;
  latestPaymentEntry: string;
  salesOrders: string[];
  deliveryNotes: string[];
  canCancelSalesInvoice: boolean;
  cancelSalesInvoiceHint: string;
  contactDisplay: string;
  contactPhone: string;
  addressDisplay: string;
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

export type UpdateSalesOrderPayload = {
  orderName: string;
  defaultSalesMode?: SalesMode;
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
    salesMode?: SalesMode;
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

export async function quickCancelSalesOrderV2(
  orderName: string,
  options?: { rollbackPayment?: boolean },
): Promise<QuickCancelSalesOrderResult> {
  const data = await callGatewayMethod<Record<string, any>>('myapp.api.gateway.quick_cancel_order_v2', {
    order_name: orderName,
    rollback_payment: options?.rollbackPayment ?? true,
  });

  // Keep the gateway call lightweight and always refresh the latest order detail explicitly.
  const refreshedDetail = await getSalesOrderDetailV2(orderName);

  return {
    orderName: typeof data?.order === 'string' ? data.order : orderName,
    cancelledPaymentEntries: Array.isArray(data?.cancelled_payment_entries)
      ? data.cancelled_payment_entries.map((value: unknown) => String(value ?? '')).filter(Boolean)
      : [],
    cancelledSalesInvoice:
      typeof data?.cancelled_sales_invoice === 'string' ? data.cancelled_sales_invoice : '',
    cancelledDeliveryNote:
      typeof data?.cancelled_delivery_note === 'string' ? data.cancelled_delivery_note : '',
    completedSteps: Array.isArray(data?.completed_steps)
      ? data.completed_steps.map((value: unknown) => String(value ?? '')).filter(Boolean)
      : [],
    detail: refreshedDetail,
    detailLoadedFromFetch: true,
  };
}

export function searchCompanies(query: string) {
  return searchLinkOptions('Company', query);
}

export function companyExists(company: string) {
  return checkLinkOptionExists('Company', company);
}

export function submitSalesOrderV2(payload: CreateSalesOrderPayload) {
  return createSalesOrderV2({
    ...payload,
    default_sales_mode: payload.defaultSalesMode,
  });
}

export function submitQuickSalesOrderV2(payload: CreateSalesOrderPayload) {
  return quickCreateSalesOrderV2({
    ...payload,
    default_sales_mode: payload.defaultSalesMode,
  });
}

function normalizeShippingText(value: unknown) {
  return compactAddressText(typeof value === 'string' ? value : String(value ?? ''));
}

function normalizeShippingField(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildShippingSnapshotFromOrderData(data: Record<string, any>) {
  const shipping = data.shipping ?? {};

  return {
    contactPerson: normalizeShippingField(shipping.contact_person),
    contactDisplay:
      normalizeShippingField(shipping.contact_display) || normalizeShippingField(shipping.contact_person),
    contactPhone: normalizeShippingField(shipping.contact_phone),
    addressDisplay: normalizeShippingText(shipping.shipping_address_text),
    customerAddress: normalizeShippingField(shipping.shipping_address_name),
  };
}

async function resolveSourceOrderShippingSnapshot(sourceOrderName: string) {
  const trimmedSourceOrderName = sourceOrderName.trim();
  if (!trimmedSourceOrderName) {
    return null;
  }

  const data = await callGatewayMethod<Record<string, any>>(
    'myapp.api.gateway.get_sales_order_detail',
    { order_name: trimmedSourceOrderName },
  );

  if (!data || typeof data !== 'object') {
    return null;
  }

  return buildShippingSnapshotFromOrderData(data);
}

async function resolveDocumentShippingSnapshot(
  shipping: Record<string, unknown>,
  sourceOrders: string[],
) {
  const directSnapshot = {
    contactDisplay: normalizeShippingField(shipping.contact_display),
    contactPhone: normalizeShippingField(shipping.contact_phone),
    addressDisplay: normalizeShippingText(shipping.shipping_address_text),
  };

  if (directSnapshot.contactDisplay || directSnapshot.contactPhone || directSnapshot.addressDisplay) {
    return directSnapshot;
  }

  const sourceOrderSnapshot = await resolveSourceOrderShippingSnapshot(sourceOrders[0] ?? '');
  if (!sourceOrderSnapshot) {
    return directSnapshot;
  }

  return {
    contactDisplay: sourceOrderSnapshot.contactDisplay || sourceOrderSnapshot.contactPerson,
    contactPhone: sourceOrderSnapshot.contactPhone,
    addressDisplay: sourceOrderSnapshot.addressDisplay,
  };
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
  const meta = data.meta ?? {};
  const items = Array.isArray(data.items) ? data.items : [];
  const fulfillment = data.fulfillment ?? {};
  const delivery = data.delivery ?? {};
  const payment = data.payment ?? {};
  const references = data.references ?? {};
  const deliveryNotes = Array.isArray(references.delivery_notes)
    ? references.delivery_notes.map((value: unknown) => String(value ?? '')).filter(Boolean)
    : [];
  const salesInvoices = Array.isArray(references.sales_invoices)
    ? references.sales_invoices.map((value: unknown) => String(value ?? '')).filter(Boolean)
    : [];
  const settledAmount = toOptionalNumber(data.amounts?.paid_amount);
  const latestWriteoffAmount = toOptionalNumber(payment.latest_writeoff_amount);
  const totalWriteoffAmount =
    toOptionalNumber(payment.total_writeoff_amount) ?? latestWriteoffAmount ?? null;
  const actualPaidAmount =
    toOptionalNumber(payment.actual_paid_amount) ??
    (settledAmount !== null
      ? Math.max(settledAmount - (totalWriteoffAmount ?? 0), 0)
      : null);
  const shippingSnapshot = buildShippingSnapshotFromOrderData(data);

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
    deliveryStatus: String(delivery.status ?? ''),
    paymentStatus: String(payment.status ?? ''),
    completionStatus: String(data.completion?.status ?? ''),
    deliveryDate: String(meta.delivery_date ?? ''),
    defaultSalesMode: meta.default_sales_mode === 'retail' ? 'retail' : 'wholesale',
    remarks: String(meta.remarks ?? ''),
    contactPerson: shippingSnapshot.contactPerson,
    contactDisplay: shippingSnapshot.contactDisplay,
    contactPhone: shippingSnapshot.contactPhone,
    addressDisplay: shippingSnapshot.addressDisplay,
    customerAddress: shippingSnapshot.customerAddress,
    paidAmount: settledAmount,
    actualPaidAmount,
    outstandingAmount: toOptionalNumber(data.amounts?.outstanding_amount),
    totalWriteoffAmount,
    latestPaymentEntry: String(payment.latest_payment_entry ?? references.latest_payment_entry ?? ''),
    latestPaymentInvoice: String(payment.latest_payment_invoice ?? ''),
    latestUnallocatedAmount: toOptionalNumber(payment.latest_unallocated_amount),
    latestWriteoffAmount,
    latestActualPaidAmount:
      toOptionalNumber(payment.latest_actual_paid_amount) ??
      (settledAmount !== null
        ? Math.max(settledAmount - (latestWriteoffAmount ?? 0), 0)
        : null),
    canSubmitDelivery: Boolean(data.actions?.can_submit_delivery),
    canCreateSalesInvoice: Boolean(data.actions?.can_create_sales_invoice),
    canRecordPayment: Boolean(data.actions?.can_record_payment),
    deliveryNotes,
    salesInvoices,
    latestDeliveryNote: deliveryNotes[0] ?? '',
    latestSalesInvoice: salesInvoices[0] ?? '',
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
      salesMode: item.sales_mode === 'retail' ? 'retail' : 'wholesale',
      allUoms: Array.isArray(item.all_uoms)
        ? item.all_uoms
            .map((value: unknown) => {
              if (typeof value === 'string') {
                return value;
              }
              if (value && typeof value === 'object') {
                return typeof (value as Record<string, unknown>).uom === 'string'
                  ? String((value as Record<string, unknown>).uom)
                  : '';
              }
              return '';
            })
            .filter(Boolean)
        : [],
      stockUom: typeof item.stock_uom === 'string' ? item.stock_uom : null,
      wholesaleDefaultUom:
        typeof item.wholesale_default_uom === 'string' ? item.wholesale_default_uom : null,
      retailDefaultUom:
        typeof item.retail_default_uom === 'string' ? item.retail_default_uom : null,
      salesProfiles: Array.isArray(item.sales_profiles)
        ? item.sales_profiles
            .map((value: unknown) => {
              if (!value || typeof value !== 'object') {
                return null;
              }
              const row = value as Record<string, unknown>;
              const modeCode =
                row.mode_code === 'retail'
                  ? 'retail'
                  : row.mode_code === 'wholesale'
                    ? 'wholesale'
                    : null;
              if (!modeCode) {
                return null;
              }
              return {
                modeCode,
                priceList: typeof row.price_list === 'string' ? row.price_list : null,
                defaultUom: typeof row.default_uom === 'string' ? row.default_uom : null,
              } satisfies SalesProfile;
            })
            .filter((entry: SalesProfile | null): entry is SalesProfile => Boolean(entry))
        : [],
      priceSummary:
        item.price_summary && typeof item.price_summary === 'object'
          ? {
              currentPriceList:
                typeof (item.price_summary as Record<string, unknown>).current_price_list === 'string'
                  ? String((item.price_summary as Record<string, unknown>).current_price_list)
                  : null,
              currentRate: toOptionalNumber((item.price_summary as Record<string, unknown>).current_rate),
              standardSellingRate: toOptionalNumber((item.price_summary as Record<string, unknown>).standard_selling_rate),
              wholesaleRate: toOptionalNumber((item.price_summary as Record<string, unknown>).wholesale_rate),
              retailRate: toOptionalNumber((item.price_summary as Record<string, unknown>).retail_rate),
              standardBuyingRate: toOptionalNumber((item.price_summary as Record<string, unknown>).standard_buying_rate),
              valuationRate: toOptionalNumber((item.price_summary as Record<string, unknown>).valuation_rate),
            }
          : null,
      imageUrl: String(item.image ?? item.image_url ?? item.item_image ?? ''),
    })),
  };
}

export async function updateSalesOrderV2(
  payload: UpdateSalesOrderPayload,
): Promise<SalesOrderDetailV2 | null> {
  await callGatewayMethod<Record<string, unknown>>('myapp.api.gateway.update_order_v2', {
    order_name: payload.orderName,
    default_sales_mode: payload.defaultSalesMode,
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
      sales_mode: item.salesMode,
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

export async function submitSalesOrderDeliveryV2(
  orderName: string,
  options?: { forceDelivery?: boolean },
) {
  const data = await callGatewayMethod<Record<string, any>>('myapp.api.gateway.submit_delivery', {
    order_name: orderName,
    kwargs: {
      force_delivery: options?.forceDelivery ? 1 : 0,
    },
  });

  return {
    deliveryNote: typeof data?.delivery_note === 'string' ? data.delivery_note : '',
    forceDelivery: Boolean(data?.force_delivery),
    detail: await getSalesOrderDetailV2(orderName),
  };
}

export async function createSalesInvoiceForOrderV2(orderName: string) {
  const data = await callGatewayMethod<Record<string, any>>('myapp.api.gateway.create_sales_invoice', {
    source_name: orderName,
    kwargs: {},
  });

  return {
    salesInvoice: typeof data?.sales_invoice === 'string' ? data.sales_invoice : '',
    detail: await getSalesOrderDetailV2(orderName),
  };
}

export async function getDeliveryNoteDetailV2(
  deliveryNoteName: string,
): Promise<DeliveryNoteDetailV2 | null> {
  const data = await callGatewayMethod<Record<string, any>>(
    'myapp.api.gateway.get_delivery_note_detail_v2',
    { delivery_note_name: deliveryNoteName },
  );

  if (!data || typeof data !== 'object') {
    return null;
  }

  const shipping = data.shipping ?? {};
  const meta = data.meta ?? {};
  const items = Array.isArray(data.items) ? data.items : [];
  const references = data.references ?? {};
  const salesOrders = Array.isArray(references.sales_orders)
    ? references.sales_orders.map((value: unknown) => String(value ?? '')).filter(Boolean)
    : [];
  const shippingSnapshot = await resolveDocumentShippingSnapshot(shipping, salesOrders);

  return {
    name: String(data.delivery_note_name ?? deliveryNoteName),
    customer: String((data.customer ?? {}).display_name ?? (data.customer ?? {}).name ?? ''),
    company: String(meta.company ?? ''),
    currency: String(meta.currency ?? 'CNY'),
    postingDate: String(meta.posting_date ?? ''),
    postingTime: String(meta.posting_time ?? ''),
    remarks: String(meta.remarks ?? ''),
    documentStatus: String(data.document_status ?? ''),
    totalQty: toOptionalNumber(data.fulfillment?.total_qty),
    grandTotal: toOptionalNumber(data.amounts?.delivery_amount_estimate),
    salesOrders,
    salesInvoices: Array.isArray(references.sales_invoices)
      ? references.sales_invoices.map((value: unknown) => String(value ?? '')).filter(Boolean)
      : [],
    canCancelDeliveryNote: Boolean(data.actions?.can_cancel_delivery_note),
    cancelDeliveryNoteHint: String(data.actions?.cancel_delivery_note_hint ?? ''),
    contactDisplay: shippingSnapshot.contactDisplay,
    contactPhone: shippingSnapshot.contactPhone,
    addressDisplay: shippingSnapshot.addressDisplay,
    items: items.map((item: Record<string, unknown>) => ({
      itemCode: String(item.item_code ?? ''),
      itemName: String(item.item_name ?? item.item_code ?? ''),
      qty: toOptionalNumber(item.qty),
      rate: toOptionalNumber(item.rate),
      amount: toOptionalNumber(item.amount),
      warehouse: String(item.warehouse ?? ''),
      uom: String(item.uom ?? ''),
      imageUrl: String(item.image ?? item.image_url ?? item.item_image ?? ''),
    })),
  };
}

export async function getSalesInvoiceDetailV2(
  salesInvoiceName: string,
): Promise<SalesInvoiceDetailV2 | null> {
  const data = await callGatewayMethod<Record<string, any>>(
    'myapp.api.gateway.get_sales_invoice_detail_v2',
    { sales_invoice_name: salesInvoiceName },
  );

  if (!data || typeof data !== 'object') {
    return null;
  }

  const shipping = data.shipping ?? {};
  const meta = data.meta ?? {};
  const payment = data.payment ?? {};
  const references = data.references ?? {};
  const items = Array.isArray(data.items) ? data.items : [];
  const salesOrders = Array.isArray(references.sales_orders)
    ? references.sales_orders.map((value: unknown) => String(value ?? '')).filter(Boolean)
    : [];
  const totalWriteoffAmount = toOptionalNumber(payment.total_writeoff_amount);
  const paidAmount = toOptionalNumber(payment.paid_amount);
  const shippingSnapshot = await resolveDocumentShippingSnapshot(shipping, salesOrders);

  return {
    name: String(data.sales_invoice_name ?? salesInvoiceName),
    customer: String((data.customer ?? {}).display_name ?? (data.customer ?? {}).name ?? ''),
    company: String(meta.company ?? ''),
    currency: String(meta.currency ?? 'CNY'),
    postingDate: String(meta.posting_date ?? ''),
    dueDate: String(meta.due_date ?? ''),
    remarks: String(meta.remarks ?? ''),
    documentStatus: String(data.document_status ?? ''),
    grandTotal: toOptionalNumber(data.amounts?.invoice_amount_estimate),
    receivableAmount: toOptionalNumber(data.amounts?.receivable_amount),
    paidAmount,
    actualPaidAmount:
      toOptionalNumber(payment.actual_paid_amount) ??
      (paidAmount !== null ? Math.max(paidAmount - (totalWriteoffAmount ?? 0), 0) : null),
    outstandingAmount: toOptionalNumber(data.amounts?.outstanding_amount),
    totalWriteoffAmount,
    latestUnallocatedAmount: toOptionalNumber(payment.latest_unallocated_amount),
    latestPaymentEntry: String(payment.latest_payment_entry ?? references.latest_payment_entry ?? ''),
    salesOrders,
    deliveryNotes: Array.isArray(references.delivery_notes)
      ? references.delivery_notes.map((value: unknown) => String(value ?? '')).filter(Boolean)
      : [],
    canCancelSalesInvoice: Boolean(data.actions?.can_cancel_sales_invoice),
    cancelSalesInvoiceHint: String(data.actions?.cancel_sales_invoice_hint ?? ''),
    contactDisplay: shippingSnapshot.contactDisplay,
    contactPhone: shippingSnapshot.contactPhone,
    addressDisplay: shippingSnapshot.addressDisplay,
    items: items.map((item: Record<string, unknown>) => ({
      itemCode: String(item.item_code ?? ''),
      itemName: String(item.item_name ?? item.item_code ?? ''),
      qty: toOptionalNumber(item.qty),
      rate: toOptionalNumber(item.rate),
      amount: toOptionalNumber(item.amount),
      warehouse: String(item.warehouse ?? ''),
      uom: String(item.uom ?? ''),
      imageUrl: String(item.image ?? item.image_url ?? item.item_image ?? ''),
    })),
  };
}

export async function cancelDeliveryNoteV2(deliveryNoteName: string) {
  await callGatewayMethod<Record<string, any>>('myapp.api.gateway.cancel_delivery_note', {
    delivery_note_name: deliveryNoteName,
  });

  return getDeliveryNoteDetailV2(deliveryNoteName);
}

export async function cancelSalesInvoiceV2(salesInvoiceName: string) {
  await callGatewayMethod<Record<string, any>>('myapp.api.gateway.cancel_sales_invoice', {
    sales_invoice_name: salesInvoiceName,
  });

  return getSalesInvoiceDetailV2(salesInvoiceName);
}

export async function cancelPaymentEntryV2(paymentEntryName: string) {
  const data = await callGatewayMethod<Record<string, any>>('myapp.api.gateway.cancel_payment_entry', {
    payment_entry_name: paymentEntryName,
  });

  return {
    paymentEntry: String(data?.payment_entry ?? paymentEntryName),
    documentStatus: String(data?.document_status ?? ''),
    references: Array.isArray(data?.references) ? data.references : [],
  };
}

function randomRequestId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeOptionalText(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function searchDeliveryNotes(query: string): Promise<LinkOption[]> {
  return searchLinkOptions('Delivery Note', query, ['customer', 'company']);
}

export function searchSalesInvoices(query: string): Promise<LinkOption[]> {
  return searchLinkOptions('Sales Invoice', query, ['customer', 'company']);
}

export async function submitSalesReturn(payload: {
  sourceDoctype: 'Delivery Note' | 'Sales Invoice';
  sourceName: string;
  remarks?: string;
  postingDate?: string;
  returnItems?: Record<string, unknown>[];
}) {
  return callGatewayMethod<Record<string, unknown>>('myapp.api.gateway.process_sales_return', {
    source_doctype: payload.sourceDoctype,
    source_name: payload.sourceName.trim(),
    remarks: normalizeOptionalText(payload.remarks),
    posting_date: normalizeOptionalText(payload.postingDate),
    return_items: Array.isArray(payload.returnItems) && payload.returnItems.length ? payload.returnItems : undefined,
    request_id: randomRequestId('mobile-sales-return'),
  });
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
  const result = await searchSalesOrdersV2({
    searchKey: query,
    statusFilter: 'all',
    excludeCancelled: true,
    sortBy: 'unfinished_first',
    limit: 20,
    start: 0,
  });
  return result.items;
}

export async function searchSalesOrdersV2(options?: {
  searchKey?: string;
  customer?: string;
  company?: string;
  statusFilter?: 'all' | 'unfinished' | 'delivering' | 'paying' | 'completed' | 'cancelled';
  excludeCancelled?: boolean;
  sortBy?: 'unfinished_first' | 'latest' | 'oldest' | 'amount_desc';
  limit?: number;
  start?: number;
}): Promise<{ items: SalesOrderSummaryItem[]; summary: SalesDeskSearchSummary }> {
  const data = await callGatewayMethod<Record<string, any>>('myapp.api.gateway.search_sales_orders_v2', {
    search_key: normalizeOptionalText(options?.searchKey),
    customer: normalizeOptionalText(options?.customer),
    company: normalizeOptionalText(options?.company),
    status_filter: normalizeOptionalText(options?.statusFilter),
    exclude_cancelled:
      options?.excludeCancelled === undefined ? undefined : options.excludeCancelled ? 1 : 0,
    sort_by: normalizeOptionalText(options?.sortBy),
    limit: options?.limit,
    start: options?.start,
  });

  const rows = Array.isArray(data?.items) ? data.items : [];
  const summary = data?.summary && typeof data.summary === 'object' ? data.summary : {};
  const items = rows.map((row: Record<string, unknown>) => {
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

  return {
    items,
    summary: {
      totalCount: Number(summary.total_count ?? 0),
      visibleCount: Number(summary.visible_count ?? items.length),
      unfinishedCount: Number(summary.unfinished_count ?? 0),
      deliveryCount: Number(summary.delivery_count ?? 0),
      paymentCount: Number(summary.payment_count ?? 0),
      completedCount: Number(summary.completed_count ?? 0),
      cancelledCount: Number(summary.cancelled_count ?? 0),
    },
  };
}
