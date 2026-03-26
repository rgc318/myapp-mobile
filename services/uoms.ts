import { callGatewayMethod } from '@/lib/api-client';

export type UomUsageRow = {
  doctype: string;
  fieldname: string;
  count: number;
  examples: string[];
};

export type UomUsageSummary = {
  totalReferences: number;
  doctypes: UomUsageRow[];
};

export type UomDetail = {
  name: string;
  uomName: string;
  symbol: string | null;
  description: string | null;
  enabled: number;
  mustBeWholeNumber: number;
  modified: string | null;
  creation: string | null;
  usageSummary?: UomUsageSummary | null;
};

type ListUomsOptions = {
  searchKey?: string;
  enabled?: number | null;
  mustBeWholeNumber?: number | null;
  limit?: number;
  start?: number;
};

type SaveUomPayload = {
  uomName: string;
  symbol?: string | null;
  description?: string | null;
  enabled?: boolean;
  mustBeWholeNumber?: boolean;
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

function mapUsageSummary(value: unknown): UomUsageSummary | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const row = value as Record<string, unknown>;
  const doctypes = Array.isArray(row.doctypes)
    ? row.doctypes
        .map((entry) => {
          if (!entry || typeof entry !== 'object') {
            return null;
          }
          const docRow = entry as Record<string, unknown>;
          const doctype = typeof docRow.doctype === 'string' ? docRow.doctype : '';
          const fieldname = typeof docRow.fieldname === 'string' ? docRow.fieldname : '';
          if (!doctype || !fieldname) {
            return null;
          }
          return {
            doctype,
            fieldname,
            count: toOptionalNumber(docRow.count) ?? 0,
            examples: Array.isArray(docRow.examples)
              ? docRow.examples.filter((item): item is string => typeof item === 'string')
              : [],
          } satisfies UomUsageRow;
        })
        .filter((entry): entry is UomUsageRow => Boolean(entry))
    : [];

  return {
    totalReferences: toOptionalNumber(row.total_references) ?? 0,
    doctypes,
  };
}

function mapUomRow(data: Record<string, unknown>): UomDetail {
  return {
    name: typeof data.name === 'string' ? data.name : '',
    uomName:
      typeof data.uom_name === 'string'
        ? data.uom_name
        : typeof data.name === 'string'
          ? data.name
          : '',
    symbol: typeof data.symbol === 'string' ? data.symbol : null,
    description: typeof data.description === 'string' ? data.description : null,
    enabled: toOptionalNumber(data.enabled) ?? 0,
    mustBeWholeNumber: toOptionalNumber(data.must_be_whole_number) ?? 0,
    modified: typeof data.modified === 'string' ? data.modified : null,
    creation: typeof data.creation === 'string' ? data.creation : null,
    usageSummary: mapUsageSummary(data.usage_summary),
  };
}

export async function fetchUoms(options?: ListUomsOptions): Promise<{ items: UomDetail[]; total: number; hasMore: boolean }> {
  const result = await callGatewayMethod<{ data?: Record<string, unknown>[]; meta?: Record<string, unknown> }>(
    'myapp.api.gateway.list_uoms_v2',
    {
      search_key: options?.searchKey,
      enabled: options?.enabled,
      must_be_whole_number: options?.mustBeWholeNumber,
      limit: options?.limit ?? 40,
      start: options?.start ?? 0,
    },
  );

  const rows = Array.isArray(result?.data) ? result.data : Array.isArray(result) ? (result as Record<string, unknown>[]) : [];
  const meta = result?.meta ?? {};

  return {
    items: rows.map((row) => mapUomRow(row)),
    total: toOptionalNumber(meta.total) ?? rows.length,
    hasMore: Boolean(meta.has_more),
  };
}

export async function fetchUomDetail(uom: string): Promise<UomDetail | null> {
  const data = await callGatewayMethod<Record<string, unknown>>('myapp.api.gateway.get_uom_detail_v2', {
    uom,
  });

  if (!data || typeof data !== 'object') {
    return null;
  }

  return mapUomRow(data);
}

export async function createUom(payload: SaveUomPayload): Promise<UomDetail | null> {
  const data = await callGatewayMethod<Record<string, unknown>>('myapp.api.gateway.create_uom_v2', {
    uom_name: payload.uomName,
    symbol: payload.symbol,
    description: payload.description,
    enabled: payload.enabled == null ? 1 : payload.enabled ? 1 : 0,
    must_be_whole_number: payload.mustBeWholeNumber ? 1 : 0,
  });

  if (!data || typeof data !== 'object') {
    return null;
  }

  return mapUomRow(data);
}

export async function saveUom(uom: string, payload: Omit<SaveUomPayload, 'uomName'>): Promise<UomDetail | null> {
  const data = await callGatewayMethod<Record<string, unknown>>('myapp.api.gateway.update_uom_v2', {
    uom,
    symbol: payload.symbol,
    description: payload.description,
    enabled: payload.enabled == null ? undefined : payload.enabled ? 1 : 0,
    must_be_whole_number: payload.mustBeWholeNumber == null ? undefined : payload.mustBeWholeNumber ? 1 : 0,
  });

  if (!data || typeof data !== 'object') {
    return null;
  }

  return mapUomRow(data);
}

export async function setUomDisabled(uom: string, disabled: boolean): Promise<UomDetail | null> {
  const data = await callGatewayMethod<Record<string, unknown>>('myapp.api.gateway.disable_uom_v2', {
    uom,
    disabled: disabled ? 1 : 0,
  });

  if (!data || typeof data !== 'object') {
    return null;
  }

  return mapUomRow(data);
}

export async function deleteUom(uom: string): Promise<{ name: string; uomName: string } | null> {
  const data = await callGatewayMethod<Record<string, unknown>>('myapp.api.gateway.delete_uom_v2', {
    uom,
  });

  if (!data || typeof data !== 'object') {
    return null;
  }

  return {
    name: typeof data.name === 'string' ? data.name : '',
    uomName:
      typeof data.uom_name === 'string'
        ? data.uom_name
        : typeof data.name === 'string'
          ? data.name
          : '',
  };
}
