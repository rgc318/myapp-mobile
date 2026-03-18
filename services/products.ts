import { callGatewayMethod } from '@/lib/api-client';
import { searchProducts, type ProductSearchItem } from '@/services/gateway';

export type ProductDetail = {
  itemCode: string;
  itemName: string;
  itemGroup: string;
  stockUom: string;
  description: string;
  imageUrl: string;
  disabled: boolean;
  nickname: string;
  barcode: string;
  stockQty: number | null;
  price: number | null;
  warehouse: string;
  allUoms: string[];
};

export type { ProductSearchItem };

export function searchCatalogProducts(
  query: string,
  options?: {
    warehouse?: string;
    company?: string;
    limit?: number;
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

  return {
    itemCode: String(data.item_code ?? itemCode),
    itemName: String(data.item_name ?? data.item_code ?? itemCode),
    itemGroup: String(data.item_group ?? ''),
    stockUom: String(data.stock_uom ?? data.uom ?? ''),
    description: String(data.description ?? ''),
    imageUrl: String(data.image ?? data.image_url ?? ''),
    disabled: Boolean(data.disabled),
    nickname: String(data.nickname ?? ''),
    barcode: String(data.barcode ?? ''),
    stockQty: toOptionalNumber(data.qty),
    price: toOptionalNumber(data.price),
    warehouse: String(data.warehouse ?? ''),
    allUoms: Array.isArray(data.all_uoms)
      ? data.all_uoms.map((value) => String(value)).filter(Boolean)
      : [],
  };
}

export async function saveProductBasicInfo(payload: {
  itemCode: string;
  itemName: string;
  description: string;
  nickname?: string;
  imageUrl?: string;
  standardRate?: number | null;
  warehouse?: string;
}) {
  const data = await callGatewayMethod<Record<string, unknown>>(
    'myapp.api.gateway.update_product_v2',
    {
      item_code: payload.itemCode,
      item_name: payload.itemName,
      description: payload.description,
      nickname: payload.nickname,
      image: payload.imageUrl,
      standard_rate: payload.standardRate,
      warehouse: payload.warehouse,
    },
  );

  if (!data || typeof data !== 'object') {
    return null;
  }

  return {
    itemCode: String(data.item_code ?? payload.itemCode),
    itemName: String(data.item_name ?? payload.itemCode),
    itemGroup: '',
    stockUom: String(data.uom ?? ''),
    description: String(data.description ?? ''),
    imageUrl: String(data.image ?? ''),
    disabled: Boolean(data.disabled),
    nickname: String(data.nickname ?? ''),
    barcode: '',
    stockQty: toOptionalNumber(data.qty),
    price: toOptionalNumber(data.price),
    warehouse: String(data.warehouse ?? payload.warehouse ?? ''),
    allUoms: [],
  } satisfies ProductDetail;
}

export async function createProductAndStock(payload: {
  itemName: string;
  defaultWarehouse?: string;
  openingQty?: number;
  standardRate?: number;
  description?: string;
  image?: string;
}) {
  const data = await callGatewayMethod<Record<string, unknown>>(
    'myapp.api.gateway.create_product_and_stock',
    {
      item_name: payload.itemName,
      default_warehouse: payload.defaultWarehouse,
      opening_qty: payload.openingQty ?? 0,
      standard_rate: payload.standardRate,
      description: payload.description,
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
    warehouse: typeof data?.warehouse === 'string' ? data.warehouse : null,
    imageUrl: typeof data?.image === 'string' ? data.image : null,
    description: typeof payload.description === 'string' ? payload.description : null,
    nickname: typeof data?.nickname === 'string' ? data.nickname : null,
  } satisfies ProductSearchItem;
}
