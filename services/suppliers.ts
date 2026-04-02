import { callGatewayMethod } from '@/lib/api-client';
import { checkLinkOptionExists, searchLinkOptions } from '@/services/master-data';

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

export type SupplierDetail = {
  name: string;
  displayName: string;
  supplierName: string;
  supplierType: string | null;
  supplierGroup: string | null;
  defaultCurrency: string | null;
  disabled: number;
  remarks: string | null;
  mobileNo: string | null;
  emailId: string | null;
  defaultContact: SupplierContact | null;
  defaultAddress: SupplierAddress | null;
  recentAddresses?: SupplierAddress[];
  modified: string | null;
  creation: string | null;
};

type ListSuppliersOptions = {
  searchKey?: string;
  supplierGroup?: string;
  disabled?: number | null;
  limit?: number;
  start?: number;
};

type SaveSupplierPayload = {
  supplierName: string;
  supplierType?: string | null;
  supplierGroup?: string | null;
  defaultCurrency?: string | null;
  remarks?: string | null;
  mobileNo?: string | null;
  emailId?: string | null;
  defaultContact?: {
    displayName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  defaultAddress?: {
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    county?: string | null;
    state?: string | null;
    country?: string | null;
    pincode?: string | null;
    email?: string | null;
    phone?: string | null;
    addressType?: string | null;
  } | null;
  disabled?: boolean;
};

function normalizeOptionalText(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function buildDefaultContactPayload(payload: SaveSupplierPayload['defaultContact']) {
  if (!payload) {
    return undefined;
  }

  const displayName = normalizeOptionalText(payload.displayName);
  const firstName = normalizeOptionalText(payload.firstName);
  const lastName = normalizeOptionalText(payload.lastName);
  const phone = normalizeOptionalText(payload.phone);
  const email = normalizeOptionalText(payload.email);

  if (!displayName && !firstName && !lastName && !phone && !email) {
    return undefined;
  }

  return {
    display_name: displayName,
    first_name: firstName,
    last_name: lastName,
    phone,
    email,
  };
}

function buildDefaultAddressPayload(payload: SaveSupplierPayload['defaultAddress']) {
  if (!payload) {
    return undefined;
  }

  const addressLine1 = normalizeOptionalText(payload.addressLine1);
  const addressLine2 = normalizeOptionalText(payload.addressLine2);
  const city = normalizeOptionalText(payload.city);
  const county = normalizeOptionalText(payload.county);
  const state = normalizeOptionalText(payload.state);
  const country = normalizeOptionalText(payload.country);
  const pincode = normalizeOptionalText(payload.pincode);
  const email = normalizeOptionalText(payload.email);
  const phone = normalizeOptionalText(payload.phone);
  const addressType = normalizeOptionalText(payload.addressType);

  const hasMeaningfulAddressInput = Boolean(
    addressLine1 || addressLine2 || city || county || state || pincode || email || phone,
  );

  if (!hasMeaningfulAddressInput) {
    return undefined;
  }

  if (!addressLine1 || !city || !country) {
    throw new Error('填写默认地址时，请至少补全地址行 1、城市和国家。');
  }

  return {
    address_line1: addressLine1,
    address_line2: addressLine2,
    city,
    county,
    state,
    country,
    pincode,
    email,
    phone,
    address_type: addressType ?? 'Billing',
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

function mapSupplierRow(data: Record<string, unknown>): SupplierDetail {
  const recentAddresses = Array.isArray(data.recent_addresses)
    ? data.recent_addresses.map((row) => mapAddress(row)).filter((row): row is SupplierAddress => Boolean(row))
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
    remarks: typeof data.remarks === 'string' ? data.remarks : null,
    mobileNo: typeof data.mobile_no === 'string' ? data.mobile_no : null,
    emailId: typeof data.email_id === 'string' ? data.email_id : null,
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

export async function fetchSupplierList(options?: ListSuppliersOptions): Promise<{ items: SupplierDetail[]; total: number; hasMore: boolean }> {
  const result = await callGatewayMethod<{ data?: Record<string, unknown>[]; meta?: Record<string, unknown> }>(
    'myapp.api.gateway.list_suppliers_v2',
    {
      search_key: options?.searchKey,
      supplier_group: options?.supplierGroup,
      disabled: options?.disabled,
      limit: options?.limit ?? 40,
      start: options?.start ?? 0,
    },
  );

  const rows = Array.isArray(result?.data) ? result.data : Array.isArray(result) ? (result as Record<string, unknown>[]) : [];
  const meta = result?.meta ?? {};

  return {
    items: rows.map((row) => mapSupplierRow(row)),
    total: toOptionalNumber(meta.total) ?? rows.length,
    hasMore: Boolean(meta.has_more),
  };
}

export async function fetchSupplierDetail(supplier: string): Promise<SupplierDetail | null> {
  const data = await callGatewayMethod<Record<string, unknown>>('myapp.api.gateway.get_supplier_detail_v2', {
    supplier,
  });

  if (!data || typeof data !== 'object') {
    return null;
  }

  return mapSupplierRow(data);
}

export async function createSupplier(payload: SaveSupplierPayload): Promise<SupplierDetail | null> {
  const data = await callGatewayMethod<Record<string, unknown>>('myapp.api.gateway.create_supplier_v2', {
    supplier_name: payload.supplierName,
    supplier_type: payload.supplierType,
    supplier_group: payload.supplierGroup,
    default_currency: payload.defaultCurrency,
    remarks: payload.remarks,
    mobile_no: payload.mobileNo,
    email_id: payload.emailId,
    default_contact: buildDefaultContactPayload(payload.defaultContact),
    default_address: buildDefaultAddressPayload(payload.defaultAddress),
    disabled: payload.disabled ? 1 : 0,
  });

  if (!data || typeof data !== 'object') {
    return null;
  }

  return mapSupplierRow(data);
}

export async function saveSupplier(
  supplier: string,
  payload: Omit<SaveSupplierPayload, 'supplierName'> & { supplierName?: string | null },
): Promise<SupplierDetail | null> {
  const data = await callGatewayMethod<Record<string, unknown>>('myapp.api.gateway.update_supplier_v2', {
    supplier,
    supplier_name: payload.supplierName,
    supplier_type: payload.supplierType,
    supplier_group: payload.supplierGroup,
    default_currency: payload.defaultCurrency,
    remarks: payload.remarks,
    mobile_no: payload.mobileNo,
    email_id: payload.emailId,
    default_contact: buildDefaultContactPayload(payload.defaultContact),
    default_address: buildDefaultAddressPayload(payload.defaultAddress),
    disabled: payload.disabled == null ? undefined : payload.disabled ? 1 : 0,
  });

  if (!data || typeof data !== 'object') {
    return null;
  }

  return mapSupplierRow(data);
}

export async function setSupplierDisabled(supplier: string, disabled: boolean): Promise<SupplierDetail | null> {
  const data = await callGatewayMethod<Record<string, unknown>>('myapp.api.gateway.disable_supplier_v2', {
    supplier,
    disabled: disabled ? 1 : 0,
  });

  if (!data || typeof data !== 'object') {
    return null;
  }

  return mapSupplierRow(data);
}
