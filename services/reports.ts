import { callGatewayMethod } from '@/lib/api-client';

export type BusinessReportOverview = {
  salesAmountTotal: number;
  purchaseAmountTotal: number;
  receivedAmountTotal: number;
  paidAmountTotal: number;
  netCashflowTotal: number;
  receivableOutstandingTotal: number;
  payableOutstandingTotal: number;
};

export type BusinessPartySummaryRow = {
  name: string;
  count: number;
  amount?: number;
  totalAmount?: number;
  paidAmount?: number;
  outstandingAmount?: number;
};

export type BusinessCashflowRow = {
  name: string | null;
  postingDate: string | null;
  direction: 'in' | 'out' | 'transfer';
  partyType: string | null;
  party: string | null;
  modeOfPayment: string | null;
  amount: number;
  referenceNo: string | null;
};

export type BusinessReport = {
  overview: BusinessReportOverview;
  tables: {
    salesSummary: BusinessPartySummaryRow[];
    purchaseSummary: BusinessPartySummaryRow[];
    receivableSummary: BusinessPartySummaryRow[];
    payableSummary: BusinessPartySummaryRow[];
    cashflowSummary: BusinessCashflowRow[];
  };
  meta: {
    company: string | null;
    dateFrom: string;
    dateTo: string;
    limit: number;
  };
};

function toNumber(value: unknown) {
  return typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : 0;
}

function mapPartyRow(entry: unknown): BusinessPartySummaryRow | null {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const row = entry as Record<string, unknown>;
  const name = typeof row.name === 'string' ? row.name : '';
  if (!name) {
    return null;
  }
  return {
    name,
    count: toNumber(row.count),
    amount: row.amount == null ? undefined : toNumber(row.amount),
    totalAmount: row.total_amount == null ? undefined : toNumber(row.total_amount),
    paidAmount: row.paid_amount == null ? undefined : toNumber(row.paid_amount),
    outstandingAmount: row.outstanding_amount == null ? undefined : toNumber(row.outstanding_amount),
  };
}

function mapCashflowRow(entry: unknown): BusinessCashflowRow | null {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const row = entry as Record<string, unknown>;
  return {
    name: typeof row.name === 'string' ? row.name : null,
    postingDate: typeof row.posting_date === 'string' ? row.posting_date : null,
    direction: row.direction === 'out' || row.direction === 'transfer' ? row.direction : 'in',
    partyType: typeof row.party_type === 'string' ? row.party_type : null,
    party: typeof row.party === 'string' ? row.party : null,
    modeOfPayment: typeof row.mode_of_payment === 'string' ? row.mode_of_payment : null,
    amount: toNumber(row.amount),
    referenceNo: typeof row.reference_no === 'string' ? row.reference_no : null,
  };
}

export async function fetchBusinessReport(options?: {
  company?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  limit?: number;
}): Promise<BusinessReport> {
  const data = await callGatewayMethod<Record<string, any>>('myapp.api.gateway.get_business_report_v1', {
    company: options?.company?.trim() || undefined,
    date_from: options?.dateFrom?.trim() || undefined,
    date_to: options?.dateTo?.trim() || undefined,
    limit: options?.limit ?? 8,
  });

  const overview = data?.overview && typeof data.overview === 'object' ? data.overview : {};
  const tables = data?.tables && typeof data.tables === 'object' ? data.tables : {};
  const meta = data?.meta && typeof data.meta === 'object' ? data.meta : {};

  return {
    overview: {
      salesAmountTotal: toNumber(overview.sales_amount_total),
      purchaseAmountTotal: toNumber(overview.purchase_amount_total),
      receivedAmountTotal: toNumber(overview.received_amount_total),
      paidAmountTotal: toNumber(overview.paid_amount_total),
      netCashflowTotal: toNumber(overview.net_cashflow_total),
      receivableOutstandingTotal: toNumber(overview.receivable_outstanding_total),
      payableOutstandingTotal: toNumber(overview.payable_outstanding_total),
    },
    tables: {
      salesSummary: (Array.isArray(tables.sales_summary) ? tables.sales_summary : [])
        .map(mapPartyRow)
        .filter((row): row is BusinessPartySummaryRow => Boolean(row)),
      purchaseSummary: (Array.isArray(tables.purchase_summary) ? tables.purchase_summary : [])
        .map(mapPartyRow)
        .filter((row): row is BusinessPartySummaryRow => Boolean(row)),
      receivableSummary: (Array.isArray(tables.receivable_summary) ? tables.receivable_summary : [])
        .map(mapPartyRow)
        .filter((row): row is BusinessPartySummaryRow => Boolean(row)),
      payableSummary: (Array.isArray(tables.payable_summary) ? tables.payable_summary : [])
        .map(mapPartyRow)
        .filter((row): row is BusinessPartySummaryRow => Boolean(row)),
      cashflowSummary: (Array.isArray(tables.cashflow_summary) ? tables.cashflow_summary : [])
        .map(mapCashflowRow)
        .filter((row): row is BusinessCashflowRow => Boolean(row)),
    },
    meta: {
      company: typeof meta.company === 'string' ? meta.company : null,
      dateFrom: typeof meta.date_from === 'string' ? meta.date_from : '',
      dateTo: typeof meta.date_to === 'string' ? meta.date_to : '',
      limit: toNumber(meta.limit),
    },
  };
}
