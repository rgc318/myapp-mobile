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


export type ProductDetail = {
  itemCode: string;
  itemName: string;
  itemGroup: string;
  stockUom: string;
  description: string;
  imageUrl: string;
  disabled: boolean;
};

export async function getProductDetail(itemCode: string): Promise<ProductDetail | null> {
  const doc = await getDocFields('Item', itemCode, [
    'item_code',
    'item_name',
    'item_group',
    'stock_uom',
    'description',
    'image',
    'disabled',
  ]);

  if (!doc) {
    return null;
  }

  return {
    itemCode:
      typeof doc.item_code === 'string' && doc.item_code.trim()
        ? doc.item_code.trim()
        : itemCode,
    itemName:
      typeof doc.item_name === 'string' && doc.item_name.trim()
        ? doc.item_name.trim()
        : itemCode,
    itemGroup: typeof doc.item_group === 'string' ? doc.item_group.trim() : '',
    stockUom: typeof doc.stock_uom === 'string' ? doc.stock_uom.trim() : '',
    description: typeof doc.description === 'string' ? doc.description.trim() : '',
    imageUrl: typeof doc.image === 'string' ? doc.image.trim() : '',
    disabled: doc.disabled === 1 || doc.disabled === '1' || doc.disabled === true,
  };
}

export async function updateProductBasicInfo(payload: {
  itemCode: string;
  itemName: string;
  description: string;
}) {
  const trimmedCode = payload.itemCode.trim();

  if (!trimmedCode) {
    throw new Error('Missing item code');
  }

  await Promise.all([
    postFrappe('frappe.client.set_value', {
      doctype: 'Item',
      name: trimmedCode,
      fieldname: 'item_name',
      value: payload.itemName.trim(),
    }),
    postFrappe('frappe.client.set_value', {
      doctype: 'Item',
      name: trimmedCode,
      fieldname: 'description',
      value: payload.description.trim(),
    }),
  ]);

  return getProductDetail(trimmedCode);
}


export type SalesOrderListItem = {
  name: string;
  customer: string;
  company: string;
  transactionDate: string;
  grandTotal: number | null;
  status: string;
  docstatus: number;
};

export type SalesOrderDetail = SalesOrderListItem & {
  currency: string;
  deliveryDate: string;
  remarks: string;
  contactPerson: string;
  contactDisplay: string;
  addressDisplay: string;
  customerAddress: string;
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

export async function listSalesOrders(query: string): Promise<SalesOrderListItem[]> {
  const apiBaseUrl = getApiBaseUrl();
  const trimmedQuery = query.trim();

  const requestBody = (filters: unknown[]) => ({
    doctype: 'Sales Order',
    fields: ['name', 'customer', 'company', 'transaction_date', 'grand_total', 'status', 'docstatus'],
    filters,
    limit_page_length: 20,
    order_by: 'modified desc',
  });

  try {
    const responses = await Promise.all([
      fetch(`${apiBaseUrl}/api/method/frappe.client.get_list`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(requestBody(trimmedQuery ? [['name', 'like', `%${trimmedQuery}%`]] : [])),
      }),
      trimmedQuery
        ? fetch(`${apiBaseUrl}/api/method/frappe.client.get_list`, {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(requestBody([['customer', 'like', `%${trimmedQuery}%`]])),
          })
        : Promise.resolve(null),
    ]);

    const payloads = await Promise.all(
      responses.map((response) => response?.json().catch(() => ({})) ?? Promise.resolve({})),
    );

    const rowMap = new Map<string, SalesOrderListItem>();

    payloads.forEach((payload) => {
      const rows = Array.isArray(payload?.message) ? payload.message : [];
      rows.forEach((row: Record<string, unknown>) => {
        const name = typeof row.name === 'string' ? row.name : '';
        if (!name) {
          return;
        }

        rowMap.set(name, {
          name,
          customer: typeof row.customer === 'string' ? row.customer : '',
          company: typeof row.company === 'string' ? row.company : '',
          transactionDate: typeof row.transaction_date === 'string' ? row.transaction_date : '',
          grandTotal:
            typeof row.grand_total === 'number'
              ? row.grand_total
              : typeof row.grand_total === 'string'
                ? Number(row.grand_total) || null
                : null,
          status: typeof row.status === 'string' ? row.status : '',
          docstatus: typeof row.docstatus === 'number' ? row.docstatus : Number(row.docstatus) || 0,
        });
      });
    });

    return [...rowMap.values()];
  } catch {
    return [];
  }
}

export async function getDefaultCurrency(company?: string): Promise<string> {
  if (company?.trim()) {
    const companyDoc = await getDocFields('Company', company.trim(), ['default_currency']);
    if (typeof companyDoc?.default_currency === 'string' && companyDoc.default_currency.trim()) {
      return companyDoc.default_currency.trim();
    }
  }

  const systemSettings = await getDocFields('System Settings', 'System Settings', ['currency']);
  if (typeof systemSettings?.currency === 'string' && systemSettings.currency.trim()) {
    return systemSettings.currency.trim();
  }

  return 'CNY';
}

export async function getSalesOrderDetail(orderName: string): Promise<SalesOrderDetail | null> {
  const doc = await postFrappe('frappe.client.get', {
    doctype: 'Sales Order',
    name: orderName,
  });

  const order = doc?.message;
  if (!order || typeof order !== 'object') {
    return null;
  }

  const items = Array.isArray((order as Record<string, unknown>).items)
    ? (order as Record<string, unknown>).items as Record<string, unknown>[]
    : [];

  const imageMap = new Map<string, string>();
  await Promise.all(
    items
      .map((item) => (typeof item.item_code === 'string' ? item.item_code : ''))
      .filter(Boolean)
      .filter((code, index, list) => list.indexOf(code) === index)
      .map(async (code) => {
        const detail = await getProductDetail(code);
        if (detail?.imageUrl) {
          imageMap.set(code, detail.imageUrl);
        }
      }),
  );

  const currency =
    typeof order.currency === 'string' && order.currency.trim()
      ? order.currency.trim()
      : await getDefaultCurrency(typeof order.company === 'string' ? order.company : '');

  return {
    name: typeof order.name === 'string' ? order.name : orderName,
    customer: typeof order.customer === 'string' ? order.customer : '',
    company: typeof order.company === 'string' ? order.company : '',
    currency,
    transactionDate: typeof order.transaction_date === 'string' ? order.transaction_date : '',
    grandTotal:
      typeof order.grand_total === 'number'
        ? order.grand_total
        : typeof order.grand_total === 'string'
          ? Number(order.grand_total) || null
          : null,
    status: typeof order.status === 'string' ? order.status : '',
    docstatus: typeof order.docstatus === 'number' ? order.docstatus : Number(order.docstatus) || 0,
    deliveryDate: typeof order.delivery_date === 'string' ? order.delivery_date : '',
    remarks: typeof order.remarks === 'string' ? order.remarks : '',
    contactPerson: typeof order.contact_person === 'string' ? order.contact_person : '',
    contactDisplay: typeof order.contact_display === 'string' ? order.contact_display : '',
    addressDisplay: typeof order.address_display === 'string' ? order.address_display : '',
    customerAddress: typeof order.customer_address === 'string' ? order.customer_address : '',
    items: items.map((item) => ({
      itemCode: typeof item.item_code === 'string' ? item.item_code : '',
      itemName: typeof item.item_name === 'string' ? item.item_name : '',
      qty:
        typeof item.qty === 'number'
          ? item.qty
          : typeof item.qty === 'string'
            ? Number(item.qty) || null
            : null,
      rate:
        typeof item.rate === 'number'
          ? item.rate
          : typeof item.rate === 'string'
            ? Number(item.rate) || null
            : null,
      amount:
        typeof item.amount === 'number'
          ? item.amount
          : typeof item.amount === 'string'
            ? Number(item.amount) || null
            : null,
      warehouse: typeof item.warehouse === 'string' ? item.warehouse : '',
      uom: typeof item.uom === 'string' ? item.uom : '',
      imageUrl: imageMap.get(typeof item.item_code === 'string' ? item.item_code : '') || '',
    })),
  };
}


export async function updateSalesOrderDetail(payload: {
  orderName: string;
  deliveryDate: string;
  remarks: string;
  contactPerson: string;
}) {
  const updates = [
    ['delivery_date', payload.deliveryDate.trim()],
    ['remarks', payload.remarks.trim()],
    ['contact_person', payload.contactPerson.trim()],
  ] as const;

  for (const [fieldname, value] of updates) {
    await postFrappe('frappe.client.set_value', {
      doctype: 'Sales Order',
      name: payload.orderName,
      fieldname,
      value,
    });
  }

  return getSalesOrderDetail(payload.orderName);
}


export type SalesInvoiceListItem = {
  name: string;
  customer: string;
  company: string;
  postingDate: string;
  grandTotal: number | null;
  outstandingAmount: number | null;
  status: string;
  docstatus: number;
  currency: string;
};

export async function listSalesInvoices(query: string): Promise<SalesInvoiceListItem[]> {
  const apiBaseUrl = getApiBaseUrl();
  const trimmedQuery = query.trim();

  const requestBody = (filters: unknown[]) => ({
    doctype: 'Sales Invoice',
    fields: ['name', 'customer', 'company', 'posting_date', 'grand_total', 'outstanding_amount', 'status', 'docstatus', 'currency'],
    filters,
    limit_page_length: 20,
    order_by: 'modified desc',
  });

  try {
    const responses = await Promise.all([
      fetch(`${apiBaseUrl}/api/method/frappe.client.get_list`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(requestBody(trimmedQuery ? [['name', 'like', `%${trimmedQuery}%`]] : [])),
      }),
      trimmedQuery
        ? fetch(`${apiBaseUrl}/api/method/frappe.client.get_list`, {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(requestBody([['customer', 'like', `%${trimmedQuery}%`]])),
          })
        : Promise.resolve(null),
    ]);

    const payloads = await Promise.all(
      responses.map((response) => response?.json().catch(() => ({})) ?? Promise.resolve({})),
    );

    const rowMap = new Map<string, SalesInvoiceListItem>();

    payloads.forEach((payload) => {
      const rows = Array.isArray(payload?.message) ? payload.message : [];
      rows.forEach((row: Record<string, unknown>) => {
        const name = typeof row.name === 'string' ? row.name : '';
        if (!name) {
          return;
        }

        rowMap.set(name, {
          name,
          customer: typeof row.customer === 'string' ? row.customer : '',
          company: typeof row.company === 'string' ? row.company : '',
          postingDate: typeof row.posting_date === 'string' ? row.posting_date : '',
          grandTotal:
            typeof row.grand_total === 'number'
              ? row.grand_total
              : typeof row.grand_total === 'string'
                ? Number(row.grand_total) || null
                : null,
          outstandingAmount:
            typeof row.outstanding_amount === 'number'
              ? row.outstanding_amount
              : typeof row.outstanding_amount === 'string'
                ? Number(row.outstanding_amount) || null
                : null,
          status: typeof row.status === 'string' ? row.status : '',
          docstatus: typeof row.docstatus === 'number' ? row.docstatus : Number(row.docstatus) || 0,
          currency: typeof row.currency === 'string' ? row.currency : 'CNY',
        });
      });
    });

    return [...rowMap.values()];
  } catch {
    return [];
  }
}
