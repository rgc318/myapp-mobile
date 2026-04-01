import { callGatewayMethod } from '@/lib/api-client';
import { type LinkOption } from '@/services/master-data';
import {
  searchPurchaseInvoices,
  searchPurchaseReceipts,
  submitPurchaseReturn,
} from '@/services/purchases';
import {
  searchDeliveryNotes,
  searchSalesInvoices,
  submitSalesReturn,
} from '@/services/sales';

export type ReturnBusinessType = 'sales' | 'purchase';
export type ReturnSourceDoctype =
  | 'Delivery Note'
  | 'Sales Invoice'
  | 'Purchase Receipt'
  | 'Purchase Invoice';

export type ReturnSourceContextItem = {
  detailId: string;
  detailSubmitKey: string;
  itemCode: string;
  itemName: string;
  uom: string;
  warehouse: string;
  rate: number | null;
  amount: number | null;
  sourceQty: number | null;
  returnedQty: number | null;
  maxReturnableQty: number | null;
  defaultReturnQty: number | null;
};

export type ReturnSourceContext = {
  businessType: ReturnBusinessType;
  sourceDoctype: ReturnSourceDoctype;
  sourceName: string;
  sourceLabel: string;
  documentStatus: string;
  partyType: string;
  partyName: string;
  partyDisplayName: string;
  contactDisplayName: string;
  contactPhone: string;
  company: string;
  currency: string;
  postingDate: string;
  dueDate: string;
  primaryAmount: number | null;
  outstandingAmount: number | null;
  canProcessReturn: boolean;
  supportsPartialReturn: boolean;
  references: Record<string, string[]>;
  items: ReturnSourceContextItem[];
};

export type ReturnSubmissionResult = {
  returnDocument: string;
  returnDoctype: ReturnSourceDoctype;
  documentStatus: string;
  sourceDoctype: ReturnSourceDoctype;
  sourceName: string;
  businessType: ReturnBusinessType;
  message: string;
  summary: {
    itemCount: number;
    totalQty: number | null;
    returnAmountEstimate: number | null;
    isPartialReturn: boolean;
  };
  references: Record<string, string[]>;
  nextActions: {
    canViewReturnDocument: boolean;
    canBackToSource: boolean;
    suggestedNextAction: string;
  };
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

function toStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((entry) => String(entry ?? '')).filter(Boolean) : [];
}

export function getReturnSourceOptions(businessType: ReturnBusinessType): ReturnSourceDoctype[] {
  return businessType === 'sales'
    ? ['Delivery Note', 'Sales Invoice']
    : ['Purchase Receipt', 'Purchase Invoice'];
}

export async function searchReturnSourceOptions(
  businessType: ReturnBusinessType,
  sourceDoctype: ReturnSourceDoctype,
  query: string,
): Promise<LinkOption[]> {
  if (businessType === 'sales') {
    return sourceDoctype === 'Sales Invoice' ? searchSalesInvoices(query) : searchDeliveryNotes(query);
  }

  return sourceDoctype === 'Purchase Invoice' ? searchPurchaseInvoices(query) : searchPurchaseReceipts(query);
}

export async function fetchReturnSourceContext(
  sourceDoctype: ReturnSourceDoctype,
  sourceName: string,
): Promise<ReturnSourceContext | null> {
  const trimmedSourceName = sourceName.trim();
  if (!trimmedSourceName) {
    return null;
  }

  const data = await callGatewayMethod<Record<string, any>>('myapp.api.gateway.get_return_source_context_v2', {
    source_doctype: sourceDoctype,
    source_name: trimmedSourceName,
  });

  if (!data || typeof data !== 'object') {
    return null;
  }

  const party = data.party && typeof data.party === 'object' ? data.party : {};
  const amounts = data.amounts && typeof data.amounts === 'object' ? data.amounts : {};
  const actions = data.actions && typeof data.actions === 'object' ? data.actions : {};
  const meta = data.meta && typeof data.meta === 'object' ? data.meta : {};
  const references = data.references && typeof data.references === 'object' ? data.references : {};
  const items = Array.isArray(data.items) ? data.items : [];

  return {
    businessType: data.business_type === 'purchase' ? 'purchase' : 'sales',
    sourceDoctype: String(data.source_doctype ?? sourceDoctype) as ReturnSourceDoctype,
    sourceName: String(data.source_name ?? trimmedSourceName),
    sourceLabel: String(data.source_label ?? sourceDoctype),
    documentStatus: String(data.document_status ?? ''),
    partyType: String(party.party_type ?? ''),
    partyName: String(party.party_name ?? ''),
    partyDisplayName: String(party.display_name ?? party.party_name ?? ''),
    contactDisplayName: String(party.contact_display_name ?? party.contact_person ?? ''),
    contactPhone: String(party.contact_phone ?? ''),
    company: String(meta.company ?? ''),
    currency: String(meta.currency ?? 'CNY'),
    postingDate: String(meta.posting_date ?? meta.transaction_date ?? ''),
    dueDate: String(meta.due_date ?? meta.schedule_date ?? ''),
    primaryAmount: toOptionalNumber(amounts.primary_amount),
    outstandingAmount: toOptionalNumber(amounts.outstanding_amount),
    canProcessReturn: Boolean(actions.can_process_return),
    supportsPartialReturn: Boolean(actions.supports_partial_return),
    references: Object.entries(references).reduce<Record<string, string[]>>((acc, [key, value]) => {
      acc[key] = toStringArray(value);
      return acc;
    }, {}),
    items: items
      .map((item: Record<string, unknown>) => {
        const detailId = String(item.detail_id ?? '');
        const detailSubmitKey = String(item.detail_submit_key ?? '');
        if (!detailId || !detailSubmitKey) {
          return null;
        }

        return {
          detailId,
          detailSubmitKey,
          itemCode: String(item.item_code ?? ''),
          itemName: String(item.item_name ?? item.item_code ?? ''),
          uom: String(item.uom ?? ''),
          warehouse: String(item.warehouse ?? ''),
          rate: toOptionalNumber(item.rate),
          amount: toOptionalNumber(item.amount),
          sourceQty: toOptionalNumber(item.source_qty),
          returnedQty: toOptionalNumber(item.returned_qty),
          maxReturnableQty: toOptionalNumber(item.max_returnable_qty),
          defaultReturnQty: toOptionalNumber(item.default_return_qty),
        } satisfies ReturnSourceContextItem;
      })
      .filter((item: ReturnSourceContextItem | null): item is ReturnSourceContextItem => Boolean(item)),
  };
}

export async function submitReturnDocument(payload: {
  businessType: ReturnBusinessType;
  sourceDoctype: ReturnSourceDoctype;
  sourceName: string;
  remarks?: string;
  postingDate?: string;
  returnItems: Record<string, unknown>[];
}): Promise<ReturnSubmissionResult> {
  const raw =
    payload.businessType === 'sales'
      ? await submitSalesReturn({
          sourceDoctype: payload.sourceDoctype as 'Delivery Note' | 'Sales Invoice',
          sourceName: payload.sourceName,
          remarks: payload.remarks,
          postingDate: payload.postingDate,
          returnItems: payload.returnItems,
        })
      : await submitPurchaseReturn({
          sourceDoctype: payload.sourceDoctype as 'Purchase Receipt' | 'Purchase Invoice',
          sourceName: payload.sourceName,
          remarks: payload.remarks,
          postingDate: payload.postingDate,
          returnItems: payload.returnItems,
        });

  const summary = raw?.summary && typeof raw.summary === 'object' ? raw.summary : {};
  const references = raw?.references && typeof raw.references === 'object' ? raw.references : {};
  const nextActions = raw?.next_actions && typeof raw.next_actions === 'object' ? raw.next_actions : {};

  return {
    returnDocument: String(raw?.return_document ?? ''),
    returnDoctype: String(raw?.return_doctype ?? payload.sourceDoctype) as ReturnSourceDoctype,
    documentStatus: String(raw?.document_status ?? ''),
    sourceDoctype: String(raw?.source_doctype ?? payload.sourceDoctype) as ReturnSourceDoctype,
    sourceName: String(raw?.source_name ?? payload.sourceName),
    businessType: raw?.business_type === 'purchase' ? 'purchase' : 'sales',
    message: String(raw?.message ?? '退货单已创建。'),
    summary: {
      itemCount: Number(summary.item_count ?? 0),
      totalQty: toOptionalNumber(summary.total_qty),
      returnAmountEstimate: toOptionalNumber(summary.return_amount_estimate),
      isPartialReturn: Boolean(summary.is_partial_return),
    },
    references: Object.entries(references).reduce<Record<string, string[]>>((acc, [key, value]) => {
      acc[key] = toStringArray(value);
      return acc;
    }, {}),
    nextActions: {
      canViewReturnDocument: Boolean(nextActions.can_view_return_document),
      canBackToSource: Boolean(nextActions.can_back_to_source),
      suggestedNextAction: String(nextActions.suggested_next_action ?? ''),
    },
  };
}
