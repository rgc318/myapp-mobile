import { callFrappeMethod, callGatewayMethod } from '@/lib/api-client';
import { searchProducts } from '@/services/gateway';
import { checkLinkOptionExists, searchLinkOptions, type LinkOption } from '@/services/master-data';

export type SupplierContact = {
  name: string | null;
  displayName: string | null;
  phone: string | null;
  email: string | null;
};

export type SupplierAddress = {
  name: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  county: string | null;
  state: string | null;
  country: string | null;
  pincode: string | null;
  email: string | null;
  phone: string | null;
  addressDisplay: string | null;
  addressType: string | null;
};

export type SupplierSummary = {
  name: string;
  displayName: string;
  supplierName: string;
  supplierType: string | null;
  supplierGroup: string | null;
  defaultCurrency: string | null;
  disabled: number;
  defaultContact: SupplierContact | null;
  defaultAddress: SupplierAddress | null;
  recentAddresses: { name: string | null; addressDisplay: string | null }[];
  modified: string | null;
  creation: string | null;
};

export type SupplierPurchaseContext = {
  supplier: {
    name: string;
    displayName: string;
    supplierGroup: string | null;
    supplierType: string | null;
    defaultCurrency: string | null;
  };
  defaultContact: SupplierContact | null;
  defaultAddress: SupplierAddress | null;
  recentAddresses: { name: string | null; addressDisplay: string | null }[];
  suggestions: {
    company: string | null;
    warehouse: string | null;
    currency: string | null;
  };
};

export type PurchaseCompanyContext = {
  company: string | null;
  warehouse: string | null;
  currency: string | null;
};

export type PurchaseOrderItemInput = {
  itemCode: string;
  qty: number;
  warehouse?: string | null;
  uom?: string | null;
  price?: number | null;
};

export type CreatePurchaseOrderPayload = {
  supplier: string;
  company: string;
  items: PurchaseOrderItemInput[];
  transactionDate?: string;
  scheduleDate?: string;
  defaultWarehouse?: string | null;
  currency?: string | null;
  buyingPriceList?: string | null;
  supplierRef?: string | null;
  remarks?: string | null;
};

export type QuickCreatePurchaseOrderPayload = CreatePurchaseOrderPayload & {
  immediateReceive?: boolean;
  immediateInvoice?: boolean;
  immediatePayment?: boolean;
  paidAmount?: number | null;
  modeOfPayment?: string | null;
  referenceNo?: string | null;
  referenceDate?: string | null;
};

export type UpdatePurchaseOrderPayload = {
  orderName: string;
  transactionDate?: string | null;
  scheduleDate?: string | null;
  supplierRef?: string | null;
  remarks?: string | null;
};

export type UpdatePurchaseOrderItemsPayload = {
  orderName: string;
  company?: string | null;
  scheduleDate?: string | null;
  defaultWarehouse?: string | null;
  items: PurchaseOrderItemInput[];
};

export type PurchaseOrderDetail = {
  name: string;
  documentStatus: string;
  supplierName: string;
  supplier: string;
  supplierGroup: string | null;
  supplierType: string | null;
  supplierContactDisplay: string;
  supplierContactPhone: string;
  supplierContactEmail: string;
  supplierAddressName: string;
  supplierAddressDisplay: string;
  company: string;
  currency: string;
  transactionDate: string;
  scheduleDate: string;
  remarks: string;
  supplierRef: string;
  orderAmountEstimate: number | null;
  receivableAmount: number | null;
  paidAmount: number | null;
  outstandingAmount: number | null;
  actualPaidAmount: number | null;
  receivingStatus: string;
  receivedQty: number | null;
  totalQty: number | null;
  paymentStatus: string;
  completionStatus: string;
  canReceive: boolean;
  canCreateInvoice: boolean;
  canRecordPayment: boolean;
  canProcessReturn: boolean;
  canUpdate: boolean;
  canCancel: boolean;
  cancelHint: string;
  latestPaymentEntry: string;
  latestPaymentInvoice: string;
  latestUnallocatedAmount: number | null;
  latestWriteoffAmount: number | null;
  latestActualPaidAmount: number | null;
  purchaseReceipts: string[];
  purchaseInvoices: string[];
  defaultAddressDisplay: string;
  items: {
    purchaseOrderItem: string;
    itemCode: string;
    itemName: string;
    nickname?: string | null;
    specification?: string | null;
    qty: number | null;
    receivedQty: number | null;
    rate: number | null;
    amount: number | null;
    warehouse: string;
    uom: string;
    uomDisplay?: string | null;
    stockUom?: string | null;
    stockUomDisplay?: string | null;
    allUoms?: string[];
    allUomDisplays?: Record<string, string>;
  }[];
};

export type PurchaseReceiptDetail = {
  name: string;
  documentStatus: string;
  supplierName: string;
  supplier: string;
  company: string;
  currency: string;
  postingDate: string;
  postingTime: string;
  remarks: string;
  receiptAmountEstimate: number | null;
  totalQty: number | null;
  receivingStatus: string;
  canCancel: boolean;
  cancelHint: string;
  canCreateInvoice: boolean;
  purchaseOrders: string[];
  purchaseInvoices: string[];
  addressDisplay: string;
  items: {
    itemCode: string;
    itemName: string;
    nickname?: string | null;
    specification?: string | null;
    qty: number | null;
    rate: number | null;
    amount: number | null;
    warehouse: string;
    uom: string;
    uomDisplay?: string | null;
  }[];
};

export type PurchaseInvoiceDetail = {
  name: string;
  documentStatus: string;
  supplierName: string;
  supplier: string;
  company: string;
  currency: string;
  postingDate: string;
  dueDate: string;
  remarks: string;
  invoiceAmountEstimate: number | null;
  paidAmount: number | null;
  outstandingAmount: number | null;
  paymentStatus: string;
  canCancel: boolean;
  latestPaymentEntry: string;
  purchaseOrders: string[];
  purchaseReceipts: string[];
  addressDisplay: string;
  items: {
    itemCode: string;
    itemName: string;
    nickname?: string | null;
    specification?: string | null;
    qty: number | null;
    rate: number | null;
    amount: number | null;
    warehouse: string;
    uom: string;
    uomDisplay?: string | null;
  }[];
};

export type PurchaseOrderSummaryItem = {
  name: string;
  supplierName: string;
  supplier: string;
  company: string;
  transactionDate: string;
  documentStatus: string;
  orderAmountEstimate: number | null;
  outstandingAmount: number | null;
  receivingStatus: string;
  paymentStatus: string;
  completionStatus: string;
  modified: string;
};

export type PurchaseDeskSearchSummary = {
  totalCount: number;
  visibleCount: number;
  unfinishedCount: number;
  receivingCount: number;
  paymentCount: number;
  completedCount: number;
  cancelledCount: number;
};

export type QuickCancelPurchaseOrderResult = {
  orderName: string;
  cancelledPaymentEntries: string[];
  cancelledPurchaseInvoice: string;
  cancelledPurchaseReceipt: string;
  completedSteps: string[];
  detail: PurchaseOrderDetail | null;
  detailLoadedFromFetch: boolean;
};

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

function normalizeOptionalText(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function randomRequestId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value != null;
}

function mapContact(value: unknown): SupplierContact | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const row = value as Record<string, unknown>;
  return {
    name: typeof row.name === 'string' ? row.name : null,
    displayName:
      typeof row.display_name === 'string'
        ? row.display_name
        : typeof row.full_name === 'string'
          ? row.full_name
          : null,
    phone: typeof row.phone === 'string' ? row.phone : null,
    email: typeof row.email === 'string' ? row.email : null,
  };
}

function mapAddress(value: unknown): SupplierAddress | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const row = value as Record<string, unknown>;
  return {
    name: typeof row.name === 'string' ? row.name : null,
    addressLine1: typeof row.address_line1 === 'string' ? row.address_line1 : null,
    addressLine2: typeof row.address_line2 === 'string' ? row.address_line2 : null,
    city: typeof row.city === 'string' ? row.city : null,
    county: typeof row.county === 'string' ? row.county : null,
    state: typeof row.state === 'string' ? row.state : null,
    country: typeof row.country === 'string' ? row.country : null,
    pincode: typeof row.pincode === 'string' ? row.pincode : null,
    email: typeof row.email === 'string' ? row.email : null,
    phone: typeof row.phone === 'string' ? row.phone : null,
    addressDisplay: typeof row.address_display === 'string' ? row.address_display : null,
    addressType: typeof row.address_type === 'string' ? row.address_type : null,
  };
}

function mapSupplierRow(data: Record<string, unknown>): SupplierSummary {
  const recentAddresses = Array.isArray(data.recent_addresses)
    ? data.recent_addresses
        .map((entry) => {
          if (!entry || typeof entry !== 'object') {
            return null;
          }
          const row = entry as Record<string, unknown>;
          return {
            name: typeof row.name === 'string' ? row.name : null,
            addressDisplay: typeof row.address_display === 'string' ? row.address_display : null,
          };
        })
        .filter(
          (
            entry,
          ): entry is {
            name: string | null;
            addressDisplay: string | null;
          } => Boolean(entry),
        )
    : [];

  return {
    name: typeof data.name === 'string' ? data.name : '',
    displayName:
      typeof data.display_name === 'string'
        ? data.display_name
        : typeof data.supplier_name === 'string'
          ? data.supplier_name
          : typeof data.name === 'string'
            ? data.name
            : '',
    supplierName:
      typeof data.supplier_name === 'string'
        ? data.supplier_name
        : typeof data.display_name === 'string'
          ? data.display_name
          : typeof data.name === 'string'
            ? data.name
            : '',
    supplierType: typeof data.supplier_type === 'string' ? data.supplier_type : null,
    supplierGroup: typeof data.supplier_group === 'string' ? data.supplier_group : null,
    defaultCurrency: typeof data.default_currency === 'string' ? data.default_currency : null,
    disabled: toOptionalNumber(data.disabled) ?? 0,
    defaultContact: mapContact(data.default_contact),
    defaultAddress: mapAddress(data.default_address),
    recentAddresses,
    modified: typeof data.modified === 'string' ? data.modified : null,
    creation: typeof data.creation === 'string' ? data.creation : null,
  };
}

export function searchSuppliers(query: string) {
  return searchLinkOptions('Supplier', query, ['supplier_name']);
}

export function supplierExists(supplier: string) {
  return checkLinkOptionExists('Supplier', supplier);
}

export function searchCompanies(query: string) {
  return searchLinkOptions('Company', query);
}

export function companyExists(company: string) {
  return checkLinkOptionExists('Company', company);
}

export async function searchWarehouses(query: string, company?: string) {
  const trimmedQuery = query.trim();
  const trimmedCompany = company?.trim();
  const filters: unknown[] = [];

  filters.push(['is_group', '=', 0]);

  if (trimmedQuery) {
    filters.push(['name', 'like', `%${trimmedQuery}%`]);
  }

  if (trimmedCompany) {
    filters.push(['company', '=', trimmedCompany]);
  }

  try {
    const rows = await callFrappeMethod<Record<string, unknown>[]>(
      'frappe.client.get_list',
      {
        doctype: 'Warehouse',
        fields: ['name', 'warehouse_name', 'company'],
        filters,
        limit_page_length: 12,
        order_by: 'modified desc',
      },
    );

    return (Array.isArray(rows) ? rows : [])
      .map((row) => {
        const value = typeof row.name === 'string' ? row.name : '';
        if (!value) {
          return null;
        }

        const warehouseName = typeof row.warehouse_name === 'string' ? row.warehouse_name : '';
        const warehouseCompany = typeof row.company === 'string' ? row.company : null;

        return {
          label: value,
          value,
          description: warehouseCompany || (warehouseName && warehouseName !== value ? warehouseName : null),
        } satisfies LinkOption;
      })
      .filter((option): option is LinkOption => Boolean(option));
  } catch {
    return [] as LinkOption[];
  }
}

export function warehouseExists(warehouse: string) {
  return checkLinkOptionExists('Warehouse', warehouse);
}

export async function getWarehouseCompany(warehouse: string) {
  const trimmedWarehouse = warehouse.trim();

  if (!trimmedWarehouse) {
    return null;
  }

  try {
    const message = await callFrappeMethod<Record<string, unknown>>(
      'frappe.client.get_value',
      {
        doctype: 'Warehouse',
        filters: { name: trimmedWarehouse },
        fieldname: ['company'],
      },
    );

    return typeof message?.company === 'string' ? message.company : null;
  } catch {
    return null;
  }
}

export function searchPurchaseOrders(query: string) {
  return searchLinkOptions('Purchase Order', query, ['supplier', 'company']);
}

export function searchPurchaseReceipts(query: string) {
  return searchLinkOptions('Purchase Receipt', query, ['supplier', 'company']);
}

export function searchPurchaseInvoices(query: string) {
  return searchLinkOptions('Purchase Invoice', query, ['supplier', 'company']);
}

export function searchModeOfPayments(query: string) {
  return searchLinkOptions('Mode of Payment', query);
}

export async function searchPurchaseItems(
  query: string,
  options?: { company?: string; warehouse?: string; limit?: number },
): Promise<LinkOption[]> {
  const rows = await searchProducts(query, {
    company: options?.company,
    warehouse: options?.warehouse,
    limit: options?.limit ?? 8,
  });

  return rows.map((row) => ({
    label: row.itemName ? `${row.itemName} (${row.itemCode})` : row.itemCode,
    value: row.itemCode,
    description: row.warehouse ? `仓库 ${row.warehouse}` : row.nickname || row.description || null,
  }));
}

export async function fetchSuppliers(options?: {
  searchKey?: string;
  supplierGroup?: string;
  disabled?: number | null;
  limit?: number;
  start?: number;
}) {
  const data = await callGatewayMethod<any>('myapp.api.gateway.list_suppliers_v2', {
    search_key: normalizeOptionalText(options?.searchKey),
    supplier_group: normalizeOptionalText(options?.supplierGroup),
    disabled: options?.disabled ?? undefined,
    limit: options?.limit ?? 20,
    start: options?.start ?? 0,
  });

  const rows = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
  return rows
    .map((row: unknown) => (row && typeof row === 'object' ? mapSupplierRow(row as Record<string, unknown>) : null))
    .filter((row): row is SupplierSummary => Boolean(row));
}

export async function fetchPurchaseOrderStatusSummary(options?: {
  supplier?: string;
  company?: string;
  limit?: number;
}) {
  const data = await callGatewayMethod<any>('myapp.api.gateway.get_purchase_order_status_summary', {
    supplier: normalizeOptionalText(options?.supplier),
    company: normalizeOptionalText(options?.company),
    limit: options?.limit ?? 20,
  });

  const rows = Array.isArray(data) ? data : [];
  return rows
    .map((entry: unknown) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const row = entry as Record<string, unknown>;
      return {
        name:
          typeof row.purchase_order_name === 'string'
            ? row.purchase_order_name
            : typeof row.name === 'string'
              ? row.name
              : '',
        supplierName:
          typeof row.supplier_name === 'string'
            ? row.supplier_name
            : typeof row.supplier === 'string'
              ? row.supplier
              : '',
        supplier: typeof row.supplier === 'string' ? row.supplier : '',
        company: typeof row.company === 'string' ? row.company : '',
        transactionDate: typeof row.transaction_date === 'string' ? row.transaction_date : '',
        documentStatus: typeof row.document_status === 'string' ? row.document_status : '',
        orderAmountEstimate: toOptionalNumber(row.order_amount_estimate),
        outstandingAmount: toOptionalNumber(row.outstanding_amount),
        receivingStatus:
          row.receiving && typeof row.receiving === 'object' && typeof (row.receiving as Record<string, unknown>).status === 'string'
            ? String((row.receiving as Record<string, unknown>).status)
            : '',
        paymentStatus:
          row.payment && typeof row.payment === 'object' && typeof (row.payment as Record<string, unknown>).status === 'string'
            ? String((row.payment as Record<string, unknown>).status)
            : '',
        completionStatus:
          row.completion && typeof row.completion === 'object' && typeof (row.completion as Record<string, unknown>).status === 'string'
            ? String((row.completion as Record<string, unknown>).status)
            : '',
        modified: typeof row.modified === 'string' ? row.modified : '',
      } satisfies PurchaseOrderSummaryItem;
    })
    .filter((row): row is PurchaseOrderSummaryItem => Boolean(row?.name));
}

export async function searchPurchaseOrdersV2(options?: {
  searchKey?: string;
  supplier?: string;
  company?: string;
  statusFilter?: 'all' | 'unfinished' | 'receiving' | 'paying' | 'completed' | 'cancelled';
  excludeCancelled?: boolean;
  sortBy?: 'unfinished_first' | 'latest' | 'oldest' | 'amount_desc' | 'amount_asc';
  limit?: number;
  start?: number;
}): Promise<{ items: PurchaseOrderSummaryItem[]; summary: PurchaseDeskSearchSummary }> {
  const data = await callGatewayMethod<any>('myapp.api.gateway.search_purchase_orders_v2', {
    search_key: normalizeOptionalText(options?.searchKey),
    supplier: normalizeOptionalText(options?.supplier),
    company: normalizeOptionalText(options?.company),
    status_filter: normalizeOptionalText(options?.statusFilter),
    exclude_cancelled: options?.excludeCancelled ?? undefined,
    sort_by: normalizeOptionalText(options?.sortBy),
    limit: options?.limit ?? 20,
    start: options?.start ?? 0,
  });

  const payload = data && typeof data === 'object' ? data : {};
  const rows = Array.isArray(payload.items) ? payload.items : [];
  const summary = payload.summary && typeof payload.summary === 'object' ? payload.summary : {};

  return {
    items: rows
      .map((entry: unknown) => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }
        const row = entry as Record<string, unknown>;
        return {
          name:
            typeof row.purchase_order_name === 'string'
              ? row.purchase_order_name
              : typeof row.name === 'string'
                ? row.name
                : '',
          supplierName:
            typeof row.supplier_name === 'string'
              ? row.supplier_name
              : typeof row.supplier === 'string'
                ? row.supplier
                : '',
          supplier: typeof row.supplier === 'string' ? row.supplier : '',
          company: typeof row.company === 'string' ? row.company : '',
          transactionDate: typeof row.transaction_date === 'string' ? row.transaction_date : '',
          documentStatus: typeof row.document_status === 'string' ? row.document_status : '',
          orderAmountEstimate: toOptionalNumber(row.order_amount_estimate),
          outstandingAmount: toOptionalNumber(row.outstanding_amount),
          receivingStatus:
            row.receiving && typeof row.receiving === 'object' && typeof (row.receiving as Record<string, unknown>).status === 'string'
              ? String((row.receiving as Record<string, unknown>).status)
              : '',
          paymentStatus:
            row.payment && typeof row.payment === 'object' && typeof (row.payment as Record<string, unknown>).status === 'string'
              ? String((row.payment as Record<string, unknown>).status)
              : '',
          completionStatus:
            row.completion && typeof row.completion === 'object' && typeof (row.completion as Record<string, unknown>).status === 'string'
              ? String((row.completion as Record<string, unknown>).status)
              : '',
          modified: typeof row.modified === 'string' ? row.modified : '',
        } satisfies PurchaseOrderSummaryItem;
      })
      .filter((row): row is PurchaseOrderSummaryItem => Boolean(row?.name)),
    summary: {
      totalCount: toOptionalNumber(summary.total_count) ?? 0,
      visibleCount: toOptionalNumber(summary.visible_count) ?? 0,
      unfinishedCount: toOptionalNumber(summary.unfinished_count) ?? 0,
      receivingCount: toOptionalNumber(summary.receiving_count) ?? 0,
      paymentCount: toOptionalNumber(summary.payment_count) ?? 0,
      completedCount: toOptionalNumber(summary.completed_count) ?? 0,
      cancelledCount: toOptionalNumber(summary.cancelled_count) ?? 0,
    },
  };
}

export async function fetchPurchaseCompanyContext(company?: string): Promise<PurchaseCompanyContext | null> {
  const trimmedCompany = company?.trim();

  const data = await callGatewayMethod<Record<string, any>>(
    'myapp.api.gateway.get_purchase_company_context',
    { company: normalizeOptionalText(trimmedCompany) },
  );

  if (!data || typeof data !== 'object') {
    return null;
  }

  return {
    company: typeof data.company === 'string' ? data.company : null,
    warehouse: typeof data.warehouse === 'string' ? data.warehouse : null,
    currency: typeof data.currency === 'string' ? data.currency : null,
  };
}

export async function fetchSupplierPurchaseContext(supplier: string, company?: string): Promise<SupplierPurchaseContext | null> {
  const trimmedSupplier = supplier.trim();
  if (!trimmedSupplier) {
    return null;
  }

  const data = await callGatewayMethod<Record<string, any>>(
    'myapp.api.gateway.get_supplier_purchase_context',
    {
      supplier: trimmedSupplier,
      company: normalizeOptionalText(company),
    },
  );

  if (!data || typeof data !== 'object' || !data.supplier || typeof data.supplier !== 'object') {
    return null;
  }

  const supplierRow = data.supplier as Record<string, unknown>;
  const recentAddresses = Array.isArray(data.recent_addresses)
    ? data.recent_addresses
        .map((entry) => {
          if (!entry || typeof entry !== 'object') {
            return null;
          }
          const row = entry as Record<string, unknown>;
          return {
            name: typeof row.name === 'string' ? row.name : null,
            addressDisplay: typeof row.address_display === 'string' ? row.address_display : null,
          };
        })
        .filter(
          (
            entry,
          ): entry is {
            name: string | null;
            addressDisplay: string | null;
          } => Boolean(entry),
        )
    : [];

  return {
    supplier: {
      name: typeof supplierRow.name === 'string' ? supplierRow.name : trimmedSupplier,
      displayName:
        typeof supplierRow.display_name === 'string'
          ? supplierRow.display_name
          : typeof supplierRow.name === 'string'
            ? supplierRow.name
            : trimmedSupplier,
      supplierGroup: typeof supplierRow.supplier_group === 'string' ? supplierRow.supplier_group : null,
      supplierType: typeof supplierRow.supplier_type === 'string' ? supplierRow.supplier_type : null,
      defaultCurrency: typeof supplierRow.default_currency === 'string' ? supplierRow.default_currency : null,
    },
    defaultContact: mapContact(data.default_contact),
    defaultAddress: mapAddress(data.default_address),
    recentAddresses,
    suggestions: {
      company: typeof data.suggestions?.company === 'string' ? data.suggestions.company : null,
      warehouse: typeof data.suggestions?.warehouse === 'string' ? data.suggestions.warehouse : null,
      currency: typeof data.suggestions?.currency === 'string' ? data.suggestions.currency : null,
    },
  };
}

export async function submitPurchaseOrder(payload: CreatePurchaseOrderPayload) {
  const items = payload.items
    .map((item) => ({
      item_code: item.itemCode.trim(),
      qty: item.qty,
      warehouse: normalizeOptionalText(item.warehouse),
      uom: normalizeOptionalText(item.uom),
      price: typeof item.price === 'number' ? item.price : undefined,
    }))
    .filter((item) => item.item_code && item.qty > 0);

  const data = await callGatewayMethod<Record<string, unknown>>('myapp.api.gateway.create_purchase_order', {
    supplier: payload.supplier.trim(),
    company: payload.company.trim(),
    items,
    transaction_date: normalizeOptionalText(payload.transactionDate),
    schedule_date: normalizeOptionalText(payload.scheduleDate),
    default_warehouse: normalizeOptionalText(payload.defaultWarehouse),
    currency: normalizeOptionalText(payload.currency),
    buying_price_list: normalizeOptionalText(payload.buyingPriceList),
    supplier_ref: normalizeOptionalText(payload.supplierRef),
    remarks: normalizeOptionalText(payload.remarks),
  });

  return typeof data?.purchase_order === 'string' ? data.purchase_order : '';
}

export async function submitQuickPurchaseOrder(payload: QuickCreatePurchaseOrderPayload) {
  const items = payload.items
    .map((item) => ({
      item_code: item.itemCode.trim(),
      qty: item.qty,
      warehouse: normalizeOptionalText(item.warehouse),
      uom: normalizeOptionalText(item.uom),
      price: typeof item.price === 'number' ? item.price : undefined,
    }))
    .filter((item) => item.item_code && item.qty > 0);

  const data = await callGatewayMethod<Record<string, unknown>>(
    'myapp.api.gateway.quick_create_purchase_order_v2',
    {
      supplier: payload.supplier.trim(),
      company: payload.company.trim(),
      items,
      transaction_date: normalizeOptionalText(payload.transactionDate),
      schedule_date: normalizeOptionalText(payload.scheduleDate),
      default_warehouse: normalizeOptionalText(payload.defaultWarehouse),
      currency: normalizeOptionalText(payload.currency),
      buying_price_list: normalizeOptionalText(payload.buyingPriceList),
      supplier_ref: normalizeOptionalText(payload.supplierRef),
      remarks: normalizeOptionalText(payload.remarks),
      immediate_receive: payload.immediateReceive === false ? 0 : 1,
      immediate_invoice: payload.immediateInvoice === false ? 0 : 1,
      immediate_payment: payload.immediatePayment ? 1 : 0,
      paid_amount: typeof payload.paidAmount === 'number' ? payload.paidAmount : undefined,
      mode_of_payment: normalizeOptionalText(payload.modeOfPayment),
      reference_no: normalizeOptionalText(payload.referenceNo),
      reference_date: normalizeOptionalText(payload.referenceDate),
      request_id: randomRequestId('mobile-purchase-order-quick'),
    },
  );

  return {
    orderName: typeof data?.purchase_order === 'string' ? data.purchase_order : '',
    receiptName: typeof data?.purchase_receipt === 'string' ? data.purchase_receipt : '',
    invoiceName: typeof data?.purchase_invoice === 'string' ? data.purchase_invoice : '',
    paymentEntry: typeof data?.payment_entry === 'string' ? data.payment_entry : '',
    completedSteps: Array.isArray(data?.completed_steps)
      ? data.completed_steps.map((value: unknown) => String(value ?? '')).filter(Boolean)
      : [],
  };
}

export async function updatePurchaseOrder(payload: UpdatePurchaseOrderPayload) {
  const data = await callGatewayMethod<Record<string, unknown>>('myapp.api.gateway.update_purchase_order_v2', {
    order_name: payload.orderName.trim(),
    transaction_date: normalizeOptionalText(payload.transactionDate ?? undefined),
    schedule_date: normalizeOptionalText(payload.scheduleDate ?? undefined),
    supplier_ref: normalizeOptionalText(payload.supplierRef ?? undefined),
    remarks: normalizeOptionalText(payload.remarks ?? undefined),
  });

  return typeof data?.purchase_order === 'string' ? data.purchase_order : payload.orderName.trim();
}

export async function updatePurchaseOrderItems(payload: UpdatePurchaseOrderItemsPayload) {
  const data = await callGatewayMethod<Record<string, any>>('myapp.api.gateway.update_purchase_order_items_v2', {
    order_name: payload.orderName.trim(),
    company: normalizeOptionalText(payload.company ?? undefined),
    schedule_date: normalizeOptionalText(payload.scheduleDate ?? undefined),
    default_warehouse: normalizeOptionalText(payload.defaultWarehouse ?? undefined),
    items: payload.items
      .map((item) => ({
        item_code: item.itemCode.trim(),
        qty: item.qty,
        warehouse: normalizeOptionalText(item.warehouse),
        uom: normalizeOptionalText(item.uom),
        price: typeof item.price === 'number' ? item.price : undefined,
      }))
      .filter((item) => item.item_code && item.qty > 0),
  });

  return {
    orderName: typeof data?.purchase_order === 'string' ? data.purchase_order : payload.orderName.trim(),
    sourceOrderName:
      typeof data?.source_purchase_order === 'string' ? data.source_purchase_order : payload.orderName.trim(),
  };
}

export async function submitPurchaseReceipt(payload: {
  orderName: string;
  postingDate?: string;
  postingTime?: string;
  remarks?: string;
  receiptItems?: {
    purchaseOrderItem?: string;
    itemCode?: string;
    qty: number;
    price?: number;
  }[];
}) {
  const receiptItems = (payload.receiptItems ?? [])
    .map((item) => ({
      purchase_order_item: normalizeOptionalText(item.purchaseOrderItem),
      item_code: normalizeOptionalText(item.itemCode),
      qty: item.qty,
      price: typeof item.price === 'number' ? item.price : undefined,
    }))
    .filter((item) => (item.purchase_order_item || item.item_code) && item.qty > 0);

  const data = await callGatewayMethod<Record<string, unknown>>('myapp.api.gateway.receive_purchase_order', {
    order_name: payload.orderName.trim(),
    posting_date: normalizeOptionalText(payload.postingDate),
    posting_time: normalizeOptionalText(payload.postingTime),
    remarks: normalizeOptionalText(payload.remarks),
    receipt_items: receiptItems.length > 0 ? receiptItems : undefined,
    request_id: randomRequestId('mobile-purchase-receipt'),
  });

  return typeof data?.purchase_receipt === 'string' ? data.purchase_receipt : '';
}

export async function cancelPurchaseReceipt(receiptName: string) {
  const trimmedReceiptName = receiptName.trim();
  if (!trimmedReceiptName) {
    throw new Error('缺少采购收货单号。');
  }

  const data = await callGatewayMethod<Record<string, unknown>>('myapp.api.gateway.cancel_purchase_receipt_v2', {
    receipt_name: trimmedReceiptName,
    request_id: randomRequestId('mobile-purchase-receipt-cancel'),
  });

  return {
    receiptName:
      typeof data?.purchase_receipt === 'string'
        ? data.purchase_receipt
        : trimmedReceiptName,
    status: typeof data?.document_status === 'string' ? data.document_status : '',
    message: typeof data?.message === 'string' ? data.message : '',
  };
}

export async function submitPurchaseInvoiceFromReceipt(payload: {
  receiptName: string;
  dueDate?: string;
  remarks?: string;
}) {
  const data = await callGatewayMethod<Record<string, unknown>>(
    'myapp.api.gateway.create_purchase_invoice_from_receipt',
    {
      receipt_name: payload.receiptName.trim(),
      due_date: normalizeOptionalText(payload.dueDate),
      remarks: normalizeOptionalText(payload.remarks),
      request_id: randomRequestId('mobile-purchase-invoice'),
    },
  );

  return typeof data?.purchase_invoice === 'string' ? data.purchase_invoice : '';
}

export async function cancelPurchaseInvoice(invoiceName: string) {
  const trimmedInvoiceName = invoiceName.trim();
  if (!trimmedInvoiceName) {
    throw new Error('缺少采购发票号。');
  }

  const data = await callGatewayMethod<Record<string, unknown>>('myapp.api.gateway.cancel_purchase_invoice_v2', {
    invoice_name: trimmedInvoiceName,
    request_id: randomRequestId('mobile-purchase-invoice-cancel'),
  });

  return {
    invoiceName: typeof data?.purchase_invoice === 'string' ? data.purchase_invoice : trimmedInvoiceName,
    status: typeof data?.document_status === 'string' ? data.document_status : '',
    message: typeof data?.message === 'string' ? data.message : '',
  };
}

export async function cancelSupplierPayment(paymentEntryName: string) {
  const trimmedPaymentEntryName = paymentEntryName.trim();
  if (!trimmedPaymentEntryName) {
    throw new Error('缺少供应商付款单号。');
  }

  const data = await callGatewayMethod<Record<string, unknown>>('myapp.api.gateway.cancel_supplier_payment', {
    payment_entry_name: trimmedPaymentEntryName,
    request_id: randomRequestId('mobile-supplier-payment-cancel'),
  });

  return {
    paymentEntry:
      typeof data?.payment_entry === 'string' ? data.payment_entry : trimmedPaymentEntryName,
    status: typeof data?.document_status === 'string' ? data.document_status : '',
    message: typeof data?.message === 'string' ? data.message : '',
  };
}

export async function quickCancelPurchaseOrderV2(
  orderName: string,
  options?: { rollbackPayment?: boolean },
): Promise<QuickCancelPurchaseOrderResult> {
  const trimmedOrderName = orderName.trim();
  if (!trimmedOrderName) {
    throw new Error('缺少采购订单号。');
  }

  const data = await callGatewayMethod<Record<string, any>>('myapp.api.gateway.quick_cancel_purchase_order_v2', {
    order_name: trimmedOrderName,
    rollback_payment: options?.rollbackPayment ?? true,
    request_id: randomRequestId('mobile-purchase-order-quick-cancel'),
  });

  // Keep the gateway call lightweight and always refresh the latest order detail explicitly.
  const refreshedDetail = await fetchPurchaseOrderDetail(trimmedOrderName);

  return {
    orderName: typeof data?.purchase_order === 'string' ? data.purchase_order : trimmedOrderName,
    cancelledPaymentEntries: Array.isArray(data?.cancelled_payment_entries)
      ? data.cancelled_payment_entries.map((value: unknown) => String(value ?? '')).filter(Boolean)
      : [],
    cancelledPurchaseInvoice:
      typeof data?.cancelled_purchase_invoice === 'string' ? data.cancelled_purchase_invoice : '',
    cancelledPurchaseReceipt:
      typeof data?.cancelled_purchase_receipt === 'string' ? data.cancelled_purchase_receipt : '',
    completedSteps: Array.isArray(data?.completed_steps)
      ? data.completed_steps.map((value: unknown) => String(value ?? '')).filter(Boolean)
      : [],
    detail: refreshedDetail,
    detailLoadedFromFetch: true,
  };
}

export async function cancelPurchaseOrderV2(orderName: string): Promise<PurchaseOrderDetail | null> {
  const trimmedOrderName = orderName.trim();
  if (!trimmedOrderName) {
    throw new Error('缺少采购订单号。');
  }

  await callGatewayMethod<Record<string, unknown>>('myapp.api.gateway.cancel_purchase_order_v2', {
    order_name: trimmedOrderName,
    request_id: randomRequestId('mobile-purchase-order-cancel'),
  });

  return fetchPurchaseOrderDetail(trimmedOrderName);
}

export async function submitSupplierPayment(payload: {
  referenceName: string;
  paidAmount: number;
  modeOfPayment?: string;
  referenceNo?: string;
  referenceDate?: string;
}) {
  return callGatewayMethod<Record<string, unknown>>('myapp.api.gateway.record_supplier_payment', {
    reference_name: payload.referenceName.trim(),
    paid_amount: payload.paidAmount,
    mode_of_payment: normalizeOptionalText(payload.modeOfPayment),
    reference_no: normalizeOptionalText(payload.referenceNo),
    reference_date: normalizeOptionalText(payload.referenceDate),
    request_id: randomRequestId('mobile-supplier-payment'),
  });
}

export async function submitPurchaseReturn(payload: {
  sourceDoctype: 'Purchase Receipt' | 'Purchase Invoice';
  sourceName: string;
  remarks?: string;
  postingDate?: string;
  returnItems?: Record<string, unknown>[];
}) {
  return callGatewayMethod<Record<string, unknown>>('myapp.api.gateway.process_purchase_return', {
    source_doctype: payload.sourceDoctype,
    source_name: payload.sourceName.trim(),
    remarks: normalizeOptionalText(payload.remarks),
    posting_date: normalizeOptionalText(payload.postingDate),
    return_items: Array.isArray(payload.returnItems) && payload.returnItems.length ? payload.returnItems : undefined,
    request_id: randomRequestId('mobile-purchase-return'),
  });
}

export async function fetchPurchaseOrderDetail(orderName: string): Promise<PurchaseOrderDetail | null> {
  const trimmedOrderName = orderName.trim();
  if (!trimmedOrderName) {
    return null;
  }

  const data = await callGatewayMethod<Record<string, any>>(
    'myapp.api.gateway.get_purchase_order_detail_v2',
    { order_name: trimmedOrderName },
  );

  if (!data || typeof data !== 'object') {
    return null;
  }

  const supplier = data.supplier && typeof data.supplier === 'object' ? data.supplier : {};
  const address = data.address && typeof data.address === 'object' ? data.address : {};
  const amounts = data.amounts && typeof data.amounts === 'object' ? data.amounts : {};
  const receiving = data.receiving && typeof data.receiving === 'object' ? data.receiving : {};
  const payment = data.payment && typeof data.payment === 'object' ? data.payment : {};
  const completion = data.completion && typeof data.completion === 'object' ? data.completion : {};
  const actions = data.actions && typeof data.actions === 'object' ? data.actions : {};
  const references = data.references && typeof data.references === 'object' ? data.references : {};
  const meta = data.meta && typeof data.meta === 'object' ? data.meta : {};
  const items = Array.isArray(data.items) ? data.items : [];

  return {
    name: typeof data.purchase_order_name === 'string' ? data.purchase_order_name : trimmedOrderName,
    documentStatus: typeof data.document_status === 'string' ? data.document_status : '',
    supplierName:
      typeof supplier.display_name === 'string'
        ? supplier.display_name
        : typeof supplier.name === 'string'
          ? supplier.name
          : '',
    supplier: typeof supplier.name === 'string' ? supplier.name : '',
    supplierGroup: typeof supplier.supplier_group === 'string' ? supplier.supplier_group : null,
    supplierType: typeof supplier.supplier_type === 'string' ? supplier.supplier_type : null,
    supplierContactDisplay:
      typeof supplier.contact_display_name === 'string'
        ? supplier.contact_display_name
        : typeof supplier.contact_person === 'string'
          ? supplier.contact_person
          : '',
    supplierContactPhone: typeof supplier.contact_phone === 'string' ? supplier.contact_phone : '',
    supplierContactEmail: typeof supplier.contact_email === 'string' ? supplier.contact_email : '',
    supplierAddressName:
      typeof address.supplier_address_name === 'string' ? address.supplier_address_name : '',
    supplierAddressDisplay:
      typeof address.supplier_address_text === 'string'
        ? address.supplier_address_text
        : typeof address.address_line1 === 'string'
          ? address.address_line1
          : '',
    company: typeof meta.company === 'string' ? meta.company : '',
    currency: typeof meta.currency === 'string' ? meta.currency : '',
    transactionDate: typeof meta.transaction_date === 'string' ? meta.transaction_date : '',
    scheduleDate: typeof meta.schedule_date === 'string' ? meta.schedule_date : '',
    remarks: typeof meta.remarks === 'string' ? meta.remarks : '',
    supplierRef: typeof meta.supplier_ref === 'string' ? meta.supplier_ref : '',
    orderAmountEstimate: toOptionalNumber(amounts.order_amount_estimate),
    receivableAmount: toOptionalNumber(amounts.receivable_amount),
    paidAmount: toOptionalNumber(amounts.paid_amount),
    outstandingAmount: toOptionalNumber(amounts.outstanding_amount),
    actualPaidAmount: toOptionalNumber(payment.actual_paid_amount),
    receivingStatus: typeof receiving.status === 'string' ? receiving.status : '',
    receivedQty: toOptionalNumber(receiving.received_qty),
    totalQty: toOptionalNumber(receiving.total_qty),
    paymentStatus: typeof payment.status === 'string' ? payment.status : '',
    completionStatus: typeof completion.status === 'string' ? completion.status : '',
    canReceive: Boolean(actions.can_receive_purchase_order),
    canCreateInvoice: Boolean(actions.can_create_purchase_invoice),
    canRecordPayment: Boolean(actions.can_record_supplier_payment),
    canProcessReturn: Boolean(actions.can_process_purchase_return),
    canUpdate:
      (typeof data.document_status === 'string' ? data.document_status : '') !== 'cancelled',
    canCancel: Boolean(actions.can_cancel_purchase_order),
    cancelHint: typeof actions.cancel_purchase_order_hint === 'string' ? actions.cancel_purchase_order_hint : '',
    latestPaymentEntry: typeof references.latest_payment_entry === 'string' ? references.latest_payment_entry : '',
    latestPaymentInvoice: typeof payment.latest_payment_invoice === 'string' ? payment.latest_payment_invoice : '',
    latestUnallocatedAmount: toOptionalNumber(payment.latest_unallocated_amount),
    latestWriteoffAmount: toOptionalNumber(payment.latest_writeoff_amount),
    latestActualPaidAmount: toOptionalNumber(payment.latest_actual_paid_amount),
    purchaseReceipts: Array.isArray(references.purchase_receipts)
      ? references.purchase_receipts.map((value: unknown) => String(value ?? '')).filter(Boolean)
      : [],
    purchaseInvoices: Array.isArray(references.purchase_invoices)
      ? references.purchase_invoices.map((value: unknown) => String(value ?? '')).filter(Boolean)
      : [],
    defaultAddressDisplay:
      typeof address.address_display === 'string'
        ? address.address_display
        : typeof address.address_line1 === 'string'
          ? address.address_line1
          : '',
    items: items
      .map((entry: unknown) => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }
        const row = entry as Record<string, unknown>;
        const allUomRows = Array.isArray(row.all_uoms) ? row.all_uoms : [];
        const allUoms = allUomRows
          .map((value) => {
            if (!value || typeof value !== 'object') {
              return null;
            }
            const uomRow = value as Record<string, unknown>;
            return typeof uomRow.uom === 'string' ? uomRow.uom : null;
          })
          .filter((value): value is string => Boolean(value));
        const allUomDisplays = Object.fromEntries(
          allUomRows
            .map((value) => {
              if (!value || typeof value !== 'object') {
                return null;
              }
              const uomRow = value as Record<string, unknown>;
              const uom = typeof uomRow.uom === 'string' ? uomRow.uom : '';
              const display = typeof uomRow.uom_display === 'string' ? uomRow.uom_display : '';
              return uom && display ? [uom, display] : null;
            })
            .filter((value): value is [string, string] => Boolean(value)),
        );
        return {
          purchaseOrderItem:
            typeof row.purchase_order_item === 'string'
              ? row.purchase_order_item
              : typeof row.po_detail === 'string'
                ? row.po_detail
                : '',
          itemCode: typeof row.item_code === 'string' ? row.item_code : '',
          itemName: typeof row.item_name === 'string' ? row.item_name : '',
          nickname:
            typeof row.nickname === 'string'
              ? row.nickname
              : typeof row.custom_nickname === 'string'
                ? row.custom_nickname
                : null,
          specification:
            typeof row.specification === 'string'
              ? row.specification
              : typeof row.custom_specification === 'string'
                ? row.custom_specification
                : null,
          qty: toOptionalNumber(row.qty),
          receivedQty: toOptionalNumber(row.received_qty),
          rate: toOptionalNumber(row.rate),
          amount: toOptionalNumber(row.amount),
          warehouse: typeof row.warehouse === 'string' ? row.warehouse : '',
          uom: typeof row.uom === 'string' ? row.uom : '',
          uomDisplay: typeof row.uom_display === 'string' ? row.uom_display : null,
          stockUom: typeof row.stock_uom === 'string' ? row.stock_uom : null,
          stockUomDisplay: typeof row.stock_uom_display === 'string' ? row.stock_uom_display : null,
          allUoms,
          allUomDisplays,
        };
      })
      .filter(isPresent),
  };
}

export async function fetchPurchaseReceiptDetail(receiptName: string): Promise<PurchaseReceiptDetail | null> {
  const trimmedReceiptName = receiptName.trim();
  if (!trimmedReceiptName) {
    return null;
  }

  const data = await callGatewayMethod<Record<string, any>>(
    'myapp.api.gateway.get_purchase_receipt_detail_v2',
    { receipt_name: trimmedReceiptName },
  );

  if (!data || typeof data !== 'object') {
    return null;
  }

  const supplier = data.supplier && typeof data.supplier === 'object' ? data.supplier : {};
  const address = data.address && typeof data.address === 'object' ? data.address : {};
  const amounts = data.amounts && typeof data.amounts === 'object' ? data.amounts : {};
  const receiving = data.receiving && typeof data.receiving === 'object' ? data.receiving : {};
  const actions = data.actions && typeof data.actions === 'object' ? data.actions : {};
  const references = data.references && typeof data.references === 'object' ? data.references : {};
  const meta = data.meta && typeof data.meta === 'object' ? data.meta : {};
  const items = Array.isArray(data.items) ? data.items : [];

  return {
    name: typeof data.purchase_receipt_name === 'string' ? data.purchase_receipt_name : trimmedReceiptName,
    documentStatus: typeof data.document_status === 'string' ? data.document_status : '',
    supplierName:
      typeof supplier.display_name === 'string'
        ? supplier.display_name
        : typeof supplier.name === 'string'
          ? supplier.name
          : '',
    supplier: typeof supplier.name === 'string' ? supplier.name : '',
    company: typeof meta.company === 'string' ? meta.company : '',
    currency: typeof meta.currency === 'string' ? meta.currency : '',
    postingDate: typeof meta.posting_date === 'string' ? meta.posting_date : '',
    postingTime: typeof meta.posting_time === 'string' ? meta.posting_time : '',
    remarks: typeof meta.remarks === 'string' ? meta.remarks : '',
    receiptAmountEstimate: toOptionalNumber(amounts.receipt_amount_estimate),
    totalQty: toOptionalNumber(receiving.total_qty),
    receivingStatus: typeof receiving.status === 'string' ? receiving.status : '',
    canCancel: Boolean(actions.can_cancel_purchase_receipt),
    cancelHint: typeof actions.cancel_purchase_receipt_hint === 'string' ? actions.cancel_purchase_receipt_hint : '',
    canCreateInvoice: Boolean(actions.can_create_purchase_invoice),
    purchaseOrders: Array.isArray(references.purchase_orders)
      ? references.purchase_orders.map((value: unknown) => String(value ?? '')).filter(Boolean)
      : [],
    purchaseInvoices: Array.isArray(references.purchase_invoices)
      ? references.purchase_invoices.map((value: unknown) => String(value ?? '')).filter(Boolean)
      : [],
    addressDisplay:
      typeof address.address_display === 'string'
        ? address.address_display
        : typeof address.address_line1 === 'string'
          ? address.address_line1
          : '',
    items: items
      .map((entry: unknown) => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }
        const row = entry as Record<string, unknown>;
        return {
          itemCode: typeof row.item_code === 'string' ? row.item_code : '',
          itemName: typeof row.item_name === 'string' ? row.item_name : '',
          nickname:
            typeof row.nickname === 'string'
              ? row.nickname
              : typeof row.custom_nickname === 'string'
                ? row.custom_nickname
                : null,
          specification:
            typeof row.specification === 'string'
              ? row.specification
              : typeof row.custom_specification === 'string'
                ? row.custom_specification
                : null,
          qty: toOptionalNumber(row.qty),
          rate: toOptionalNumber(row.rate),
          amount: toOptionalNumber(row.amount),
          warehouse: typeof row.warehouse === 'string' ? row.warehouse : '',
          uom: typeof row.uom === 'string' ? row.uom : '',
          uomDisplay: typeof row.uom_display === 'string' ? row.uom_display : null,
        };
      })
      .filter(isPresent),
  };
}

export async function fetchPurchaseInvoiceDetail(invoiceName: string): Promise<PurchaseInvoiceDetail | null> {
  const trimmedInvoiceName = invoiceName.trim();
  if (!trimmedInvoiceName) {
    return null;
  }

  const data = await callGatewayMethod<Record<string, any>>(
    'myapp.api.gateway.get_purchase_invoice_detail_v2',
    { invoice_name: trimmedInvoiceName },
  );

  if (!data || typeof data !== 'object') {
    return null;
  }

  const supplier = data.supplier && typeof data.supplier === 'object' ? data.supplier : {};
  const address = data.address && typeof data.address === 'object' ? data.address : {};
  const amounts = data.amounts && typeof data.amounts === 'object' ? data.amounts : {};
  const payment = data.payment && typeof data.payment === 'object' ? data.payment : {};
  const actions = data.actions && typeof data.actions === 'object' ? data.actions : {};
  const references = data.references && typeof data.references === 'object' ? data.references : {};
  const meta = data.meta && typeof data.meta === 'object' ? data.meta : {};
  const items = Array.isArray(data.items) ? data.items : [];

  return {
    name: typeof data.purchase_invoice_name === 'string' ? data.purchase_invoice_name : trimmedInvoiceName,
    documentStatus: typeof data.document_status === 'string' ? data.document_status : '',
    supplierName:
      typeof supplier.display_name === 'string'
        ? supplier.display_name
        : typeof supplier.name === 'string'
          ? supplier.name
          : '',
    supplier: typeof supplier.name === 'string' ? supplier.name : '',
    company: typeof meta.company === 'string' ? meta.company : '',
    currency: typeof meta.currency === 'string' ? meta.currency : '',
    postingDate: typeof meta.posting_date === 'string' ? meta.posting_date : '',
    dueDate: typeof meta.due_date === 'string' ? meta.due_date : '',
    remarks: typeof meta.remarks === 'string' ? meta.remarks : '',
    invoiceAmountEstimate: toOptionalNumber(amounts.invoice_amount_estimate),
    paidAmount: toOptionalNumber(amounts.paid_amount),
    outstandingAmount: toOptionalNumber(amounts.outstanding_amount),
    paymentStatus: typeof payment.status === 'string' ? payment.status : '',
    canCancel: Boolean(actions.can_cancel_purchase_invoice),
    latestPaymentEntry:
      typeof references.latest_payment_entry === 'string' ? references.latest_payment_entry : '',
    purchaseOrders: Array.isArray(references.purchase_orders)
      ? references.purchase_orders.map((value: unknown) => String(value ?? '')).filter(Boolean)
      : [],
    purchaseReceipts: Array.isArray(references.purchase_receipts)
      ? references.purchase_receipts.map((value: unknown) => String(value ?? '')).filter(Boolean)
      : [],
    addressDisplay:
      typeof address.address_display === 'string'
        ? address.address_display
        : typeof address.address_line1 === 'string'
          ? address.address_line1
          : '',
    items: items
      .map((entry: unknown) => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }
        const row = entry as Record<string, unknown>;
        return {
          itemCode: typeof row.item_code === 'string' ? row.item_code : '',
          itemName: typeof row.item_name === 'string' ? row.item_name : '',
          nickname:
            typeof row.nickname === 'string'
              ? row.nickname
              : typeof row.custom_nickname === 'string'
                ? row.custom_nickname
                : null,
          specification:
            typeof row.specification === 'string'
              ? row.specification
              : typeof row.custom_specification === 'string'
                ? row.custom_specification
                : null,
          qty: toOptionalNumber(row.qty),
          rate: toOptionalNumber(row.rate),
          amount: toOptionalNumber(row.amount),
          warehouse: typeof row.warehouse === 'string' ? row.warehouse : '',
          uom: typeof row.uom === 'string' ? row.uom : '',
          uomDisplay: typeof row.uom_display === 'string' ? row.uom_display : null,
        };
      })
      .filter(isPresent),
  };
}
