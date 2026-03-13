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
