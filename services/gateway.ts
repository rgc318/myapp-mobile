import { callGatewayMethod } from '@/lib/api-client';
import { compactAddressText } from '@/lib/form-utils';
import type { PriceSummary, SalesMode, SalesProfile } from '@/lib/sales-mode';
import type { UomConversion } from '@/lib/uom-conversion';

export type ProductSearchItem = {
  itemCode: string;
  itemName: string;
  stockQty: number | null;
  warehouseStockQty?: number | null;
  totalQty?: number | null;
  globalTotalQty?: number | null;
  price: number | null;
  uom: string | null;
  uomDisplay?: string | null;
  stockUom?: string | null;
  stockUomDisplay?: string | null;
  warehouseStockUom?: string | null;
  allUoms?: string[];
  allUomDisplays?: Record<string, string>;
  uomConversions?: UomConversion[];
  wholesaleDefaultUom?: string | null;
  wholesaleDefaultUomDisplay?: string | null;
  retailDefaultUom?: string | null;
  retailDefaultUomDisplay?: string | null;
  salesProfiles?: SalesProfile[];
  priceSummary?: PriceSummary | null;
  warehouse: string | null;
  warehouseStockDetails?: {
    warehouse: string;
    company: string | null;
    qty: number;
  }[];
  globalWarehouseStockDetails?: {
    warehouse: string;
    company: string | null;
    qty: number;
  }[];
  imageUrl?: string | null;
  description?: string | null;
  nickname?: string | null;
  specification?: string | null;
};

export type SalesOrderItemInput = {
  item_code: string;
  qty: number;
  price?: number;
  warehouse?: string;
  uom?: string;
  sales_mode?: SalesMode;
};

export type CustomerSalesContext = {
  customer: {
    name: string;
    displayName: string;
    customerGroup: string | null;
    territory: string | null;
    defaultCurrency: string | null;
  };
  defaultContact: {
    name: string;
    displayName: string;
    phone: string | null;
    email: string | null;
  } | null;
  defaultAddress: {
    name: string;
    addressTitle: string | null;
    addressDisplay: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    county: string | null;
    state: string | null;
    country: string | null;
    pincode: string | null;
  } | null;
  recentAddresses: {
    name: string | null;
    addressDisplay: string | null;
  }[];
  suggestions: {
    company: string | null;
    warehouse: string | null;
  };
};

export type SalesOrderV2Input = {
  customer: string;
  company: string;
  items: SalesOrderItemInput[];
  immediate?: boolean;
  force_delivery?: boolean;
  default_sales_mode?: SalesMode;
  delivery_date?: string;
  transaction_date?: string;
  remarks?: string;
  customer_info?: {
    contact_person?: string;
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
  settlement_mode?: 'partial' | 'writeoff';
  writeoff_reason?: string;
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

function mapUomNames(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .map((entry) => {
      if (typeof entry === 'string') {
        return entry.trim();
      }
      if (entry && typeof entry === 'object') {
        const row = entry as Record<string, unknown>;
        return typeof row.uom === 'string' ? row.uom.trim() : '';
      }
      return '';
    })
    .filter(Boolean);
}

function mapUomDisplays(value: unknown) {
  if (!Array.isArray(value)) {
    return {} as Record<string, string>;
  }

  return value.reduce<Record<string, string>>((acc, entry) => {
    if (!entry || typeof entry !== 'object') {
      return acc;
    }
    const row = entry as Record<string, unknown>;
    const uom = typeof row.uom === 'string' ? row.uom.trim() : '';
    const display = typeof row.uom_display === 'string' ? row.uom_display.trim() : '';
    if (uom && display) {
      acc[uom] = display;
    }
    return acc;
  }, {});
}

function mapUomConversions(value: unknown): UomConversion[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const row = entry as Record<string, unknown>;
      const uom = typeof row.uom === 'string' ? row.uom.trim() : '';
      if (!uom) {
        return null;
      }
      return {
        uom,
        conversionFactor: toOptionalNumber(row.conversion_factor),
      } satisfies UomConversion;
    })
    .filter((entry): entry is UomConversion => Boolean(entry));
}

function mapPriceSummary(value: unknown): PriceSummary | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const row = value as Record<string, unknown>;
  return {
    currentPriceList: typeof row.current_price_list === 'string' ? row.current_price_list : null,
    currentRate: toOptionalNumber(row.current_rate),
    standardSellingRate: toOptionalNumber(row.standard_selling_rate),
    wholesaleRate: toOptionalNumber(row.wholesale_rate),
    retailRate: toOptionalNumber(row.retail_rate),
    standardBuyingRate: toOptionalNumber(row.standard_buying_rate),
    valuationRate: toOptionalNumber(row.valuation_rate),
  };
}

function mapSalesProfiles(value: unknown): SalesProfile[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const row = entry as Record<string, unknown>;
      const modeCode = row.mode_code === 'retail' ? 'retail' : row.mode_code === 'wholesale' ? 'wholesale' : null;
      if (!modeCode) {
        return null;
      }
      return {
        modeCode,
        priceList: typeof row.price_list === 'string' ? row.price_list : null,
        defaultUom: typeof row.default_uom === 'string' ? row.default_uom : null,
        defaultUomDisplay:
          typeof row.default_uom_display === 'string' ? row.default_uom_display : null,
      } satisfies SalesProfile;
    })
    .filter((entry): entry is SalesProfile => Boolean(entry));
}

async function postGateway<T>(method: string, payload: Record<string, unknown>) {
  return callGatewayMethod<T>(method, payload);
}

export async function searchProducts(
  query: string,
  options?: {
    warehouse?: string;
    company?: string;
    limit?: number;
    inStockOnly?: boolean;
    disabled?: number | null;
  },
) {
  const data = await postGateway<any>('myapp.api.gateway.search_product_v2', {
    search_key: query,
    warehouse: options?.warehouse,
    company: options?.company,
    limit: options?.limit ?? 20,
    disabled: options?.disabled ?? 0,
    in_stock_only: options?.inStockOnly ? 1 : 0,
    search_fields: ['item_code', 'item_name', 'barcode', 'nickname', 'description', 'specification'],
    sort_by: 'relevance',
    sort_order: 'asc',
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
      totalQty: toOptionalNumber(row.total_qty) ?? null,
      globalTotalQty: toOptionalNumber(row.global_total_qty) ?? null,
      price: toOptionalNumber(row.price) ?? toOptionalNumber(row.rate) ?? null,
      uom: typeof row.uom === 'string' ? row.uom : null,
      uomDisplay: typeof row.uom_display === 'string' ? row.uom_display : null,
      stockUom: typeof row.stock_uom === 'string' ? row.stock_uom : null,
      stockUomDisplay: typeof row.stock_uom_display === 'string' ? row.stock_uom_display : null,
      allUoms: mapUomNames(row.all_uoms),
      allUomDisplays: mapUomDisplays(row.all_uoms),
      uomConversions: mapUomConversions(row.all_uoms),
      wholesaleDefaultUom:
        typeof row.wholesale_default_uom === 'string' ? row.wholesale_default_uom : null,
      wholesaleDefaultUomDisplay:
        typeof row.wholesale_default_uom_display === 'string' ? row.wholesale_default_uom_display : null,
      retailDefaultUom:
        typeof row.retail_default_uom === 'string' ? row.retail_default_uom : null,
      retailDefaultUomDisplay:
        typeof row.retail_default_uom_display === 'string' ? row.retail_default_uom_display : null,
      salesProfiles: mapSalesProfiles(row.sales_profiles),
      priceSummary: mapPriceSummary(row.price_summary),
      warehouse:
        typeof row.warehouse === 'string' && row.warehouse.trim()
          ? row.warehouse
          : options?.warehouse ?? null,
      warehouseStockDetails: Array.isArray(row.warehouse_stock_details)
        ? row.warehouse_stock_details
            .map((entry) => {
              if (!entry || typeof entry !== 'object') {
                return null;
              }
              const stockRow = entry as Record<string, unknown>;
              const warehouse =
                typeof stockRow.warehouse === 'string' ? stockRow.warehouse.trim() : '';
              if (!warehouse) {
                return null;
              }
              return {
                warehouse,
                company: typeof stockRow.company === 'string' ? stockRow.company : null,
                qty: toOptionalNumber(stockRow.qty) ?? 0,
              };
            })
            .filter(
              (
                entry,
              ): entry is { warehouse: string; company: string | null; qty: number } => Boolean(entry),
            )
        : [],
      globalWarehouseStockDetails: Array.isArray(row.global_warehouse_stock_details)
        ? row.global_warehouse_stock_details
            .map((entry) => {
              if (!entry || typeof entry !== 'object') {
                return null;
              }
              const stockRow = entry as Record<string, unknown>;
              const warehouse =
                typeof stockRow.warehouse === 'string' ? stockRow.warehouse.trim() : '';
              if (!warehouse) {
                return null;
              }
              return {
                warehouse,
                company: typeof stockRow.company === 'string' ? stockRow.company : null,
                qty: toOptionalNumber(stockRow.qty) ?? 0,
              };
            })
            .filter(
              (
                entry,
              ): entry is { warehouse: string; company: string | null; qty: number } => Boolean(entry),
            )
        : [],
      imageUrl:
        typeof row.image === 'string'
          ? row.image
          : typeof row.image_url === 'string'
            ? row.image_url
            : typeof row.item_image === 'string'
              ? row.item_image
              : null,
      description: typeof row.description === 'string' ? row.description : null,
      nickname: typeof row.nickname === 'string' ? row.nickname : null,
      specification: typeof row.specification === 'string' ? row.specification : null,
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

export async function createSalesOrderV2(payload: SalesOrderV2Input) {
  return postGateway<any>('myapp.api.gateway.create_order_v2', {
    customer: payload.customer,
    company: payload.company,
    items: payload.items,
    immediate: payload.immediate ?? false,
    force_delivery: payload.force_delivery ? 1 : 0,
    default_sales_mode: payload.default_sales_mode,
    delivery_date: payload.delivery_date,
    transaction_date: payload.transaction_date,
    remarks: payload.remarks,
    customer_info: payload.customer_info,
    shipping_info: payload.shipping_info,
    request_id: randomRequestId('mobile-sales-order-v2'),
  });
}

export async function quickCreateSalesOrderV2(payload: SalesOrderV2Input) {
  return postGateway<any>('myapp.api.gateway.quick_create_order_v2', {
    customer: payload.customer,
    company: payload.company,
    items: payload.items,
    force_delivery: payload.force_delivery ? 1 : 0,
    default_sales_mode: payload.default_sales_mode,
    delivery_date: payload.delivery_date,
    transaction_date: payload.transaction_date,
    remarks: payload.remarks,
    customer_info: payload.customer_info,
    shipping_info: payload.shipping_info,
    request_id: randomRequestId('mobile-sales-order-quick-v2'),
  });
}

function mapCustomerSalesContext(data: Record<string, any>): CustomerSalesContext {
  const customer = data?.customer ?? {};
  const defaultContact = data?.default_contact;
  const defaultAddress = data?.default_address;
  const recentAddresses = Array.isArray(data?.recent_addresses) ? data.recent_addresses : [];
  const suggestions = data?.suggestions ?? {};

  return {
    customer: {
      name: String(customer.name ?? ''),
      displayName: String(customer.display_name ?? customer.name ?? ''),
      customerGroup: typeof customer.customer_group === 'string' ? customer.customer_group : null,
      territory: typeof customer.territory === 'string' ? customer.territory : null,
      defaultCurrency:
        typeof customer.default_currency === 'string' ? customer.default_currency : null,
    },
    defaultContact: defaultContact
      ? {
          name: String(defaultContact.name ?? ''),
          displayName: String(
            defaultContact.display_name ?? defaultContact.full_name ?? defaultContact.name ?? '',
          ),
          phone:
            typeof defaultContact.phone === 'string'
              ? defaultContact.phone
              : typeof defaultContact.mobile_no === 'string'
                ? defaultContact.mobile_no
                : null,
          email: typeof defaultContact.email === 'string' ? defaultContact.email : null,
        }
      : null,
    defaultAddress: defaultAddress
      ? {
          name: String(defaultAddress.name ?? ''),
          addressTitle:
            typeof defaultAddress.address_title === 'string' ? defaultAddress.address_title : null,
          addressDisplay:
            typeof defaultAddress.address_display === 'string'
              ? compactAddressText(defaultAddress.address_display)
              : null,
          addressLine1:
            typeof defaultAddress.address_line1 === 'string'
              ? defaultAddress.address_line1
              : null,
          addressLine2:
            typeof defaultAddress.address_line2 === 'string'
              ? defaultAddress.address_line2
              : null,
          city: typeof defaultAddress.city === 'string' ? defaultAddress.city : null,
          county: typeof defaultAddress.county === 'string' ? defaultAddress.county : null,
          state: typeof defaultAddress.state === 'string' ? defaultAddress.state : null,
          country: typeof defaultAddress.country === 'string' ? defaultAddress.country : null,
          pincode: typeof defaultAddress.pincode === 'string' ? defaultAddress.pincode : null,
        }
      : null,
    recentAddresses: recentAddresses.map((row: Record<string, unknown>) => ({
      name: typeof row.name === 'string' ? row.name : null,
      addressDisplay:
        typeof row.address_display === 'string'
          ? compactAddressText(row.address_display)
          : null,
    })),
    suggestions: {
      company: typeof suggestions.company === 'string' ? suggestions.company : null,
      warehouse: typeof suggestions.warehouse === 'string' ? suggestions.warehouse : null,
    },
  };
}

export async function getCustomerSalesContext(customer: string) {
  const data = await postGateway<Record<string, any>>('myapp.api.gateway.get_customer_sales_context', {
    customer,
  });

  return mapCustomerSalesContext(data ?? {});
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
    settlement_mode: payload.settlement_mode,
    writeoff_reason: payload.writeoff_reason,
    request_id: randomRequestId('mobile-sales-payment'),
  });
}
