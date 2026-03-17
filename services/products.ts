import { callGatewayMethod } from '@/lib/api-client';
import { searchProducts, type ProductSearchItem } from '@/services/gateway';
import {
  getProductDetail,
  updateProductBasicInfo,
  type ProductDetail,
} from '@/services/master-data';

export type { ProductSearchItem, ProductDetail };

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

export function fetchProductDetail(itemCode: string) {
  return getProductDetail(itemCode);
}

export function saveProductBasicInfo(payload: {
  itemCode: string;
  itemName: string;
  description: string;
}) {
  return updateProductBasicInfo(payload);
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
    nickname: null,
  } satisfies ProductSearchItem;
}
