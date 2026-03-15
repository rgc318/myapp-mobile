import { getApiBaseUrl } from '@/lib/config';

export type LinkOption = {
  label: string;
  value: string;
  description?: string | null;
};

export async function searchLinkOptions(doctype: string, query: string, extraFields: string[] = []) {
  const apiBaseUrl = getApiBaseUrl();
  const trimmedQuery = query.trim();
  const fields = ['name', ...extraFields];

  const filters = trimmedQuery
    ? [['name', 'like', `%${trimmedQuery}%`]]
    : [];

  try {
    const response = await fetch(`${apiBaseUrl}/api/method/frappe.client.get_list`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        doctype,
        fields,
        filters,
        limit_page_length: 8,
        order_by: 'modified desc',
      }),
    });

    const payload = await response.json().catch(() => ({}));
    const message = Array.isArray(payload?.message) ? payload.message : [];

    return message
      .map((row: Record<string, unknown>) => {
        const value = typeof row.name === 'string' ? row.name : '';
        if (!value) {
          return null;
        }

        const descriptionField = extraFields.find((field) => typeof row[field] === 'string' && row[field] !== value);

        return {
          label: value,
          value,
          description: descriptionField ? String(row[descriptionField]) : null,
        } satisfies LinkOption;
      })
      .filter((option: LinkOption | null): option is LinkOption => Boolean(option));
  } catch {
    return [] as LinkOption[];
  }
}

export async function checkLinkOptionExists(doctype: string, value: string) {
  const apiBaseUrl = getApiBaseUrl();
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return false;
  }

  try {
    const response = await fetch(`${apiBaseUrl}/api/method/frappe.client.get_value`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        doctype,
        filters: { name: trimmedValue },
        fieldname: ['name'],
      }),
    });

    const payload = await response.json().catch(() => ({}));
    return response.ok && typeof payload?.message?.name === 'string' && payload.message.name === trimmedValue;
  } catch {
    return false;
  }
}

export type CustomerShippingDetails = {
  shippingAddress: string;
  contactPerson: string;
  contactPhone: string;
};

async function postFrappe(method: string, payload: Record<string, unknown>) {
  const apiBaseUrl = getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/method/${method}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  return response.json().catch(() => ({}));
}

async function getDocFields(doctype: string, name: string, fields: string[]) {
  if (!name.trim()) {
    return null;
  }

  try {
    const payload = await postFrappe('frappe.client.get', {
      doctype,
      name,
    });
    const doc = payload?.message;

    if (!doc || typeof doc !== 'object') {
      return null;
    }

    return fields.reduce<Record<string, unknown>>((acc, field) => {
      acc[field] = (doc as Record<string, unknown>)[field];
      return acc;
    }, {});
  } catch {
    return null;
  }
}

function joinAddressParts(parts: unknown[]) {
  return parts
    .filter((part): part is string => typeof part === 'string' && Boolean(part.trim()))
    .map((part) => part.trim())
    .join(' ');
}

export async function getCustomerShippingDetails(customer: string): Promise<CustomerShippingDetails> {
  const customerDoc = await getDocFields('Customer', customer, [
    'customer_primary_address',
    'primary_address',
    'customer_primary_contact',
    'mobile_no',
    'phone',
  ]);

  if (!customerDoc) {
    return {
      shippingAddress: '',
      contactPerson: '',
      contactPhone: '',
    };
  }

  const addressName =
    typeof customerDoc.customer_primary_address === 'string' && customerDoc.customer_primary_address
      ? customerDoc.customer_primary_address
      : typeof customerDoc.primary_address === 'string'
        ? customerDoc.primary_address
        : '';
  const contactName =
    typeof customerDoc.customer_primary_contact === 'string' ? customerDoc.customer_primary_contact : '';

  const [addressDoc, contactDoc] = await Promise.all([
    addressName
      ? getDocFields('Address', addressName, [
          'address_display',
          'address_line1',
          'address_line2',
          'city',
          'county',
          'state',
          'country',
        ])
      : Promise.resolve(null),
    contactName
      ? getDocFields('Contact', contactName, ['full_name', 'first_name', 'last_name', 'mobile_no', 'phone'])
      : Promise.resolve(null),
  ]);

  const shippingAddress =
    typeof addressDoc?.address_display === 'string' && addressDoc.address_display.trim()
      ? addressDoc.address_display.trim()
      : joinAddressParts([
          addressDoc?.address_line1,
          addressDoc?.address_line2,
          addressDoc?.city,
          addressDoc?.county,
          addressDoc?.state,
          addressDoc?.country,
        ]);

  const contactPerson =
    typeof contactDoc?.full_name === 'string' && contactDoc.full_name.trim()
      ? contactDoc.full_name.trim()
      : joinAddressParts([contactDoc?.first_name, contactDoc?.last_name]);

  const contactPhone =
    typeof contactDoc?.mobile_no === 'string' && contactDoc.mobile_no.trim()
      ? contactDoc.mobile_no.trim()
      : typeof contactDoc?.phone === 'string' && contactDoc.phone.trim()
        ? contactDoc.phone.trim()
        : typeof customerDoc.mobile_no === 'string' && customerDoc.mobile_no.trim()
          ? customerDoc.mobile_no.trim()
          : typeof customerDoc.phone === 'string' && customerDoc.phone.trim()
            ? customerDoc.phone.trim()
            : '';

  return {
    shippingAddress,
    contactPerson,
    contactPhone,
  };
}
