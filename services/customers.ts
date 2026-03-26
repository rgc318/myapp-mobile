import { callGatewayMethod } from '@/lib/api-client';
import { getCustomerSalesContext } from '@/services/gateway';
import { checkLinkOptionExists, searchLinkOptions } from '@/services/master-data';

export type CustomerContact = {
  name: string | null;
  displayName: string | null;
  phone: string | null;
  email: string | null;
};

export type CustomerAddress = {
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

export type CustomerDetail = {
  name: string;
  displayName: string;
  customerName: string;
  customerType: string | null;
  customerGroup: string | null;
  territory: string | null;
  defaultCurrency: string | null;
  defaultPriceList: string | null;
  disabled: number;
  remarks: string | null;
  mobileNo: string | null;
  emailId: string | null;
  defaultContact: CustomerContact | null;
  defaultAddress: CustomerAddress | null;
  recentAddresses?: CustomerAddress[];
  modified: string | null;
  creation: string | null;
};

type ListCustomersOptions = {
  searchKey?: string;
  customerGroup?: string;
  disabled?: number | null;
  limit?: number;
  start?: number;
};

type SaveCustomerPayload = {
  customerName: string;
  customerType?: string | null;
  customerGroup?: string | null;
  territory?: string | null;
  defaultCurrency?: string | null;
  defaultPriceList?: string | null;
  remarks?: string | null;
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

function mapAddress(value: unknown): CustomerAddress | null {
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

function mapContact(value: unknown): CustomerContact | null {
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

function mapCustomerRow(data: Record<string, unknown>): CustomerDetail {
  const recentAddresses = Array.isArray(data.recent_addresses)
    ? data.recent_addresses.map((row) => mapAddress(row)).filter((row): row is CustomerAddress => Boolean(row))
    : [];

  return {
    name: typeof data.name === 'string' ? data.name : '',
    displayName:
      typeof data.display_name === 'string'
        ? data.display_name
        : typeof data.customer_name === 'string'
          ? data.customer_name
          : typeof data.name === 'string'
            ? data.name
            : '',
    customerName:
      typeof data.customer_name === 'string'
        ? data.customer_name
        : typeof data.display_name === 'string'
          ? data.display_name
          : typeof data.name === 'string'
            ? data.name
            : '',
    customerType: typeof data.customer_type === 'string' ? data.customer_type : null,
    customerGroup: typeof data.customer_group === 'string' ? data.customer_group : null,
    territory: typeof data.territory === 'string' ? data.territory : null,
    defaultCurrency: typeof data.default_currency === 'string' ? data.default_currency : null,
    defaultPriceList: typeof data.default_price_list === 'string' ? data.default_price_list : null,
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

export function searchCustomers(query: string) {
  return searchLinkOptions('Customer', query);
}

export function customerExists(customer: string) {
  return checkLinkOptionExists('Customer', customer);
}

export function fetchCustomerSalesContext(customer: string) {
  return getCustomerSalesContext(customer);
}

export async function fetchCustomers(options?: ListCustomersOptions): Promise<{ items: CustomerDetail[]; total: number; hasMore: boolean }> {
  const result = await callGatewayMethod<{ data?: Record<string, unknown>[]; meta?: Record<string, unknown> }>(
    'myapp.api.gateway.list_customers_v2',
    {
      search_key: options?.searchKey,
      customer_group: options?.customerGroup,
      disabled: options?.disabled,
      limit: options?.limit ?? 40,
      start: options?.start ?? 0,
    },
  );

  const rows = Array.isArray(result?.data) ? result.data : Array.isArray(result) ? (result as Record<string, unknown>[]) : [];
  const meta = result?.meta ?? {};

  return {
    items: rows.map((row) => mapCustomerRow(row)),
    total: toOptionalNumber(meta.total) ?? rows.length,
    hasMore: Boolean(meta.has_more),
  };
}

export async function fetchCustomerDetail(customer: string): Promise<CustomerDetail | null> {
  const data = await callGatewayMethod<Record<string, unknown>>('myapp.api.gateway.get_customer_detail_v2', {
    customer,
  });

  if (!data || typeof data !== 'object') {
    return null;
  }

  return mapCustomerRow(data);
}

export async function createCustomer(payload: SaveCustomerPayload): Promise<CustomerDetail | null> {
  const data = await callGatewayMethod<Record<string, unknown>>('myapp.api.gateway.create_customer_v2', {
    customer_name: payload.customerName,
    customer_type: payload.customerType,
    customer_group: payload.customerGroup,
    territory: payload.territory,
    default_currency: payload.defaultCurrency,
    default_price_list: payload.defaultPriceList,
    remarks: payload.remarks,
    default_contact: payload.defaultContact
      ? {
          display_name: payload.defaultContact.displayName,
          first_name: payload.defaultContact.firstName,
          last_name: payload.defaultContact.lastName,
          phone: payload.defaultContact.phone,
          email: payload.defaultContact.email,
        }
      : undefined,
    default_address: payload.defaultAddress
      ? {
          address_line1: payload.defaultAddress.addressLine1,
          address_line2: payload.defaultAddress.addressLine2,
          city: payload.defaultAddress.city,
          county: payload.defaultAddress.county,
          state: payload.defaultAddress.state,
          country: payload.defaultAddress.country,
          pincode: payload.defaultAddress.pincode,
          email: payload.defaultAddress.email,
          phone: payload.defaultAddress.phone,
          address_type: payload.defaultAddress.addressType,
        }
      : undefined,
    disabled: payload.disabled ? 1 : 0,
  });

  if (!data || typeof data !== 'object') {
    return null;
  }

  return mapCustomerRow(data);
}

export async function saveCustomer(customer: string, payload: Omit<SaveCustomerPayload, 'customerName'> & { customerName?: string | null }): Promise<CustomerDetail | null> {
  const data = await callGatewayMethod<Record<string, unknown>>('myapp.api.gateway.update_customer_v2', {
    customer,
    customer_name: payload.customerName,
    customer_type: payload.customerType,
    customer_group: payload.customerGroup,
    territory: payload.territory,
    default_currency: payload.defaultCurrency,
    default_price_list: payload.defaultPriceList,
    remarks: payload.remarks,
    default_contact: payload.defaultContact
      ? {
          display_name: payload.defaultContact.displayName,
          first_name: payload.defaultContact.firstName,
          last_name: payload.defaultContact.lastName,
          phone: payload.defaultContact.phone,
          email: payload.defaultContact.email,
        }
      : undefined,
    default_address: payload.defaultAddress
      ? {
          address_line1: payload.defaultAddress.addressLine1,
          address_line2: payload.defaultAddress.addressLine2,
          city: payload.defaultAddress.city,
          county: payload.defaultAddress.county,
          state: payload.defaultAddress.state,
          country: payload.defaultAddress.country,
          pincode: payload.defaultAddress.pincode,
          email: payload.defaultAddress.email,
          phone: payload.defaultAddress.phone,
          address_type: payload.defaultAddress.addressType,
        }
      : undefined,
    disabled: payload.disabled == null ? undefined : payload.disabled ? 1 : 0,
  });

  if (!data || typeof data !== 'object') {
    return null;
  }

  return mapCustomerRow(data);
}

export async function setCustomerDisabled(customer: string, disabled: boolean): Promise<CustomerDetail | null> {
  const data = await callGatewayMethod<Record<string, unknown>>('myapp.api.gateway.disable_customer_v2', {
    customer,
    disabled: disabled ? 1 : 0,
  });

  if (!data || typeof data !== 'object') {
    return null;
  }

  return mapCustomerRow(data);
}
