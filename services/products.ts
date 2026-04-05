import { callGatewayMethod } from '@/lib/api-client';
import type { UomConversion } from '@/lib/uom-conversion';
import { searchProducts, type ProductSearchItem } from '@/services/gateway';
import type { PriceSummary, SalesProfile } from '@/lib/sales-mode';

type WarehouseStockDetail = {
  warehouse: string;
  company: string | null;
  qty: number;
};

export type ProductUomConversion = UomConversion;

export type ProductDetail = {
  itemCode: string;
  itemName: string;
  itemGroup: string;
  brand: string;
  stockUom: string;
  specification: string;
  description: string;
  imageUrl: string;
  disabled: boolean;
  nickname: string;
  barcode: string;
  stockQty: number | null;
  totalQty: number | null;
  globalTotalQty?: number | null;
  warehouseStockDetails: WarehouseStockDetail[];
  globalWarehouseStockDetails?: WarehouseStockDetail[];
  price: number | null;
  warehouse: string;
  allUoms: string[];
  uomConversions: ProductUomConversion[];
  wholesaleDefaultUom?: string | null;
  retailDefaultUom?: string | null;
  salesProfiles?: SalesProfile[];
  priceSummary?: PriceSummary | null;
};

export type ProductListItem = ProductDetail & {
  creation?: string | null;
  modified?: string | null;
};

export type CreateProductPayload = {
  itemName: string;
  itemCode?: string;
  itemGroup?: string;
  brand?: string;
  barcode?: string;
  stockUom?: string;
  uomConversions?: {
    uom: string;
    conversionFactor: number;
  }[];
  nickname?: string;
  specification?: string;
  description?: string;
  imageUrl?: string;
  standardRate?: number | null;
  wholesaleRate?: number | null;
  retailRate?: number | null;
  standardBuyingRate?: number | null;
  wholesaleDefaultUom?: string | null;
  retailDefaultUom?: string | null;
  openingUom?: string | null;
};

export type SaveProductPayload = {
  itemCode: string;
  itemName?: string;
  itemGroup?: string;
  brand?: string;
  barcode?: string;
  stockUom?: string;
  uomConversions?: {
    uom: string;
    conversionFactor: number;
  }[];
  description?: string;
  nickname?: string;
  specification?: string;
  imageUrl?: string;
  standardRate?: number | null;
  wholesaleRate?: number | null;
  retailRate?: number | null;
  standardBuyingRate?: number | null;
  wholesaleDefaultUom?: string | null;
  retailDefaultUom?: string | null;
  disabled?: boolean;
  warehouse?: string;
  warehouseStockQty?: number | null;
  warehouseStockUom?: string | null;
};

export type { ProductSearchItem };

export function searchCatalogProducts(
  query: string,
  options?: {
    warehouse?: string;
    company?: string;
    limit?: number;
    inStockOnly?: boolean;
  },
) {
  return searchProducts(query, options);
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

function mapUomConversions(value: unknown): ProductUomConversion[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (typeof entry === 'string') {
        const uom = entry.trim();
        return uom ? ({ uom, conversionFactor: null } satisfies ProductUomConversion) : null;
      }

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
      } satisfies ProductUomConversion;
    })
    .filter((entry): entry is ProductUomConversion => Boolean(entry));
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
      } satisfies SalesProfile;
    })
    .filter((entry): entry is SalesProfile => Boolean(entry));
}

function mapWarehouseStockDetails(value: unknown): WarehouseStockDetail[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const row = entry as Record<string, unknown>;
      const warehouse = typeof row.warehouse === 'string' ? row.warehouse : '';
      if (!warehouse) {
        return null;
      }
      return {
        warehouse,
        company: typeof row.company === 'string' ? row.company : null,
        qty: toOptionalNumber(row.qty) ?? 0,
      } satisfies WarehouseStockDetail;
    })
    .filter((entry): entry is WarehouseStockDetail => Boolean(entry));
}

function mapProductRow(
  data: Record<string, unknown>,
  options?: {
    warehouse?: string;
  },
): ProductListItem {
  const warehouseStockDetails = mapWarehouseStockDetails(data.warehouse_stock_details);
  const warehouse =
    (typeof data.warehouse === 'string' && data.warehouse.trim()) ||
    options?.warehouse?.trim() ||
    warehouseStockDetails[0]?.warehouse ||
    '';

  return {
    itemCode: String(data.item_code ?? data.itemCode ?? ''),
    itemName: String(data.item_name ?? data.itemName ?? data.item_code ?? ''),
    itemGroup: typeof data.item_group === 'string' ? data.item_group : '',
    brand: typeof data.brand === 'string' ? data.brand : '',
    stockUom: typeof data.stock_uom === 'string' ? data.stock_uom : typeof data.uom === 'string' ? data.uom : '',
    specification: typeof data.specification === 'string' ? data.specification : '',
    description: typeof data.description === 'string' ? data.description : '',
    imageUrl:
      typeof data.image === 'string'
        ? data.image
        : typeof data.image_url === 'string'
          ? data.image_url
          : '',
    disabled: Boolean(data.disabled),
    nickname: typeof data.nickname === 'string' ? data.nickname : '',
    barcode: typeof data.barcode === 'string' ? data.barcode : '',
    stockQty: toOptionalNumber(data.qty) ?? toOptionalNumber(data.stock_qty),
    totalQty: toOptionalNumber(data.total_qty),
    globalTotalQty: toOptionalNumber(data.global_total_qty),
    warehouseStockDetails,
    globalWarehouseStockDetails: mapWarehouseStockDetails(data.global_warehouse_stock_details),
    price: toOptionalNumber(data.price),
    warehouse,
    allUoms: mapUomNames(data.all_uoms),
    uomConversions: mapUomConversions(data.all_uoms),
    wholesaleDefaultUom:
      typeof data.wholesale_default_uom === 'string' ? data.wholesale_default_uom : null,
    retailDefaultUom:
      typeof data.retail_default_uom === 'string' ? data.retail_default_uom : null,
    salesProfiles: mapSalesProfiles(data.sales_profiles),
    priceSummary: mapPriceSummary(data.price_summary),
    creation: typeof data.creation === 'string' ? data.creation : null,
    modified: typeof data.modified === 'string' ? data.modified : null,
  };
}

async function postGateway<T>(method: string, payload: Record<string, unknown>) {
  return callGatewayMethod<T>(method, payload);
}

function buildPriceEntries(payload: {
  wholesaleRate?: number | null;
  retailRate?: number | null;
  standardBuyingRate?: number | null;
}) {
  const sellingPrices = [
    payload.wholesaleRate != null ? { price_list: 'Wholesale', rate: payload.wholesaleRate, currency: 'CNY' } : null,
    payload.retailRate != null ? { price_list: 'Retail', rate: payload.retailRate, currency: 'CNY' } : null,
  ].filter(Boolean);

  const buyingPrices = [
    payload.standardBuyingRate != null
      ? { price_list: 'Standard Buying', rate: payload.standardBuyingRate, currency: 'CNY' }
      : null,
  ].filter(Boolean);

  return {
    sellingPrices,
    buyingPrices,
  };
}

export async function fetchProducts(options?: {
  searchKey?: string;
  warehouse?: string;
  company?: string;
  disabled?: number | null;
  limit?: number;
}) {
  const data = await postGateway<Record<string, unknown>[]>(
    'myapp.api.gateway.list_products_v2',
    {
      search_key: options?.searchKey,
      warehouse: options?.warehouse,
      company: options?.company,
      disabled: options?.disabled,
      limit: options?.limit ?? 40,
      selling_price_lists: ['Standard Selling', 'Wholesale', 'Retail'],
      buying_price_lists: ['Standard Buying'],
    },
  );

  const rows = Array.isArray(data) ? data : [];
  return rows.map((row) => mapProductRow(row, { warehouse: options?.warehouse }));
}

export async function fetchProductDetail(
  itemCode: string,
  options?: {
    warehouse?: string;
    company?: string;
    priceList?: string;
    currency?: string;
  },
): Promise<ProductDetail | null> {
  const data = await callGatewayMethod<Record<string, unknown>>(
    'myapp.api.gateway.get_product_detail_v2',
    {
      item_code: itemCode,
      warehouse: options?.warehouse,
      company: options?.company,
      price_list: options?.priceList,
      currency: options?.currency,
    },
  );

  if (!data || typeof data !== 'object') {
    return null;
  }

  return mapProductRow(data, { warehouse: options?.warehouse });
}

export async function saveProductBasicInfo(payload: SaveProductPayload) {
  const { sellingPrices, buyingPrices } = buildPriceEntries(payload);

  const data = await callGatewayMethod<Record<string, unknown>>(
    'myapp.api.gateway.update_product_v2',
    {
      item_code: payload.itemCode,
      item_name: payload.itemName,
      item_group: payload.itemGroup,
      brand: payload.brand,
      barcode: payload.barcode,
      stock_uom: payload.stockUom,
      uom_conversions: payload.uomConversions?.map((entry) => ({
        uom: entry.uom,
        conversion_factor: entry.conversionFactor,
      })),
      description: payload.description,
      nickname: payload.nickname,
      specification: payload.specification,
      image: payload.imageUrl,
      standard_rate: payload.standardRate,
      selling_prices: sellingPrices,
      buying_prices: buyingPrices,
      wholesale_default_uom: payload.wholesaleDefaultUom,
      retail_default_uom: payload.retailDefaultUom,
      disabled: typeof payload.disabled === 'boolean' ? (payload.disabled ? 1 : 0) : undefined,
      warehouse: payload.warehouse,
      warehouse_stock_qty: payload.warehouseStockQty,
      warehouse_stock_uom: payload.warehouseStockUom,
    },
  );

  if (!data || typeof data !== 'object') {
    return null;
  }

  return mapProductRow(data, { warehouse: payload.warehouse });
}

export async function createProduct(payload: CreateProductPayload) {
  const { sellingPrices, buyingPrices } = buildPriceEntries(payload);

  const data = await callGatewayMethod<Record<string, unknown>>(
    'myapp.api.gateway.create_product_v2',
    {
      item_name: payload.itemName,
      item_code: payload.itemCode,
      item_group: payload.itemGroup,
      brand: payload.brand,
      barcode: payload.barcode,
      stock_uom: payload.stockUom,
      uom_conversions: payload.uomConversions?.map((entry) => ({
        uom: entry.uom,
        conversion_factor: entry.conversionFactor,
      })),
      nickname: payload.nickname,
      specification: payload.specification,
      description: payload.description,
      image: payload.imageUrl,
      standard_rate: payload.standardRate,
      selling_prices: sellingPrices,
      buying_prices: buyingPrices,
      wholesale_default_uom: payload.wholesaleDefaultUom,
      retail_default_uom: payload.retailDefaultUom,
      opening_uom: payload.openingUom,
    },
  );

  if (!data || typeof data !== 'object') {
    return null;
  }

  return mapProductRow(data);
}

export async function toggleProductDisabled(itemCode: string, disabled: boolean) {
  const data = await callGatewayMethod<Record<string, unknown>>(
    'myapp.api.gateway.disable_product_v2',
    {
      item_code: itemCode,
      disabled: disabled ? 1 : 0,
    },
  );

  if (!data || typeof data !== 'object') {
    return null;
  }

  return mapProductRow(data);
}

export const setProductDisabled = toggleProductDisabled;

export async function createProductAndStock(payload: {
  itemName: string;
  defaultWarehouse?: string;
  openingQty?: number;
  openingUom?: string;
  standardRate?: number;
  description?: string;
  specification?: string;
  image?: string;
}) {
  const data = await callGatewayMethod<Record<string, unknown>>(
    'myapp.api.gateway.create_product_and_stock',
    {
      item_name: payload.itemName,
      default_warehouse: payload.defaultWarehouse,
      opening_qty: payload.openingQty ?? 0,
      opening_uom: payload.openingUom,
      standard_rate: payload.standardRate,
      description: payload.description,
      specification: payload.specification,
      image: payload.image,
    },
  );

  return {
    itemCode: String(data?.item_code ?? ''),
    itemName: String(data?.item_name ?? ''),
    stockQty: typeof data?.qty === 'number' ? data.qty : Number(data?.qty ?? 0) || 0,
    price:
      typeof data?.price === 'number' ? data.price : data?.price ? Number(data.price) || null : null,
    uom: typeof data?.uom === 'string' ? data.uom : null,
    stockUom: typeof data?.uom === 'string' ? data.uom : null,
    allUoms: typeof data?.uom === 'string' ? [data.uom] : [],
    warehouse: typeof data?.warehouse === 'string' ? data.warehouse : null,
    imageUrl: typeof data?.image === 'string' ? data.image : null,
    description: typeof payload.description === 'string' ? payload.description : null,
    specification: typeof data?.specification === 'string' ? data.specification : null,
    nickname: typeof data?.nickname === 'string' ? data.nickname : null,
    disabled: false,
    barcode: '',
    wholesaleDefaultUom: null,
    retailDefaultUom: null,
    salesProfiles: [],
    priceSummary: null,
  } satisfies ProductSearchItem;
}
