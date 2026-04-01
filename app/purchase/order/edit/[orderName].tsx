import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { DateFieldInput } from '@/components/date-field-input';
import { LinkOptionInput } from '@/components/link-option-input';
import { PurchaseOrderItemGroups } from '@/components/purchase-order-item-groups';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { normalizeAppError } from '@/lib/app-error';
import { isValidIsoDate } from '@/lib/date-value';
import { formatDisplayUom } from '@/lib/display-uom';
import {
  clearPurchaseOrderDraft,
  getPurchaseOrderDraft,
  getPurchaseOrderDraftForm,
  hasPurchaseOrderDraft,
  hasPurchaseOrderDraftForm,
  replacePurchaseOrderDraft,
  updatePurchaseOrderDraftForm,
} from '@/lib/purchase-order-draft';
import { sanitizeDecimalInput } from '@/lib/numeric-input';
import { formatConvertedQty, type UomConversion } from '@/lib/uom-conversion';
import { useFeedback } from '@/providers/feedback-provider';
import { fetchProductDetail } from '@/services/products';
import {
  fetchPurchaseCompanyContext,
  fetchPurchaseOrderDetail,
  getWarehouseCompany,
  quickCancelPurchaseOrderV2,
  searchWarehouses,
  updatePurchaseOrder,
  updatePurchaseOrderItems,
  type PurchaseOrderDetail,
} from '@/services/purchases';

type EditablePurchaseOrderItem = {
  id: string;
  itemCode: string;
  itemName: string;
  qty: string;
  price: string;
  warehouse: string;
  uom: string;
  imageUrl?: string | null;
  stockUom?: string | null;
  totalQty?: number | null;
  allUoms?: string[];
  uomConversions?: UomConversion[];
  warehouseStockDetails?: { warehouse: string; company: string | null; qty: number }[];
};

type EditSection = 'meta' | 'items' | 'all';
type EditMode = 'view' | 'meta' | 'items' | 'all';

function buildEditableId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizePositiveNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formatQty(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }

  return formatConvertedQty(value);
}

function formatMoney(value: number | null | undefined, currency = 'CNY') {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }

  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function getOrderSummaryUom(detail: PurchaseOrderDetail | null) {
  if (!detail?.items?.length) {
    return '';
  }

  const uoms = Array.from(new Set(detail.items.map((item) => item.uom).filter(Boolean)));
  return uoms.length === 1 ? formatDisplayUom(uoms[0]) : '';
}

function getPrimaryPurchaseInvoice(detail: PurchaseOrderDetail | null) {
  if (!detail) {
    return '';
  }

  return detail.latestPaymentInvoice || detail.purchaseInvoices[0] || '';
}

function getPurchaseBusinessStatusLabel(detail: PurchaseOrderDetail | null) {
  if (!detail) {
    return '未加载';
  }

  if (detail.documentStatus === 'cancelled') {
    return '已作废';
  }

  if (detail.completionStatus === 'completed') {
    return '已完成';
  }

  if (detail.purchaseInvoices.length) {
    return '已开票';
  }

  if (detail.receivingStatus === 'partial') {
    return '部分收货';
  }

  if (detail.receivingStatus === 'received') {
    return '已收货';
  }

  if (detail.documentStatus === 'submitted') {
    return '待收货';
  }

  return '草稿';
}

function getPurchaseStatusTone(detail: PurchaseOrderDetail | null) {
  if (!detail) {
    return { backgroundColor: '#E2E8F0', color: '#475569' };
  }

  if (detail.documentStatus === 'cancelled') {
    return { backgroundColor: '#FEE2E2', color: '#B91C1C' };
  }

  if (detail.completionStatus === 'completed') {
    return { backgroundColor: '#DCFCE7', color: '#15803D' };
  }

  if (detail.purchaseInvoices.length) {
    return { backgroundColor: '#DBEAFE', color: '#1D4ED8' };
  }

  if (detail.receivingStatus === 'partial') {
    return { backgroundColor: '#FEF3C7', color: '#B45309' };
  }

  if (detail.receivingStatus === 'received') {
    return { backgroundColor: '#FEF3C7', color: '#B45309' };
  }

  return { backgroundColor: '#DBEAFE', color: '#1D4ED8' };
}

function getDocumentStatusLabel(value: string) {
  switch (value) {
    case 'draft':
      return '草稿';
    case 'submitted':
      return '已提交';
    case 'cancelled':
      return '已作废';
    default:
      return value || '—';
  }
}

function getReceivingStatusLabel(value: string) {
  switch (value) {
    case 'pending':
      return '待收货';
    case 'partial':
      return '部分收货';
    case 'received':
      return '已收货';
    default:
      return value || '—';
  }
}

function getPaymentStatusLabel(value: string) {
  switch (value) {
    case 'unpaid':
      return '未付款';
    case 'partial':
      return '部分付款';
    case 'paid':
      return '已付款';
    default:
      return value || '—';
  }
}

function getCompletionStatusLabel(value: string) {
  switch (value) {
    case 'pending':
      return '处理中';
    case 'completed':
      return '已完成';
    default:
      return value || '—';
  }
}

function getStatusValueColor(value: string, type: 'document' | 'receiving' | 'payment' | 'completion') {
  if (!value) {
    return '#0F172A';
  }

  if (type === 'document') {
    if (value === 'cancelled') return '#DC2626';
    if (value === 'submitted') return '#2563EB';
    return '#475569';
  }

  if (type === 'payment') {
    if (value === 'paid') return '#15803D';
    if (value === 'partial') return '#D97706';
    return '#DC2626';
  }

  if (type === 'receiving') {
    if (value === 'received') return '#15803D';
    if (value === 'partial') return '#D97706';
    return '#2563EB';
  }

  if (type === 'completion') {
    if (value === 'completed') return '#15803D';
    return '#2563EB';
  }

  return '#0F172A';
}

function getPaymentStatusTone(value: string) {
  if (value === 'paid') {
    return { backgroundColor: '#DCFCE7', textColor: '#166534' };
  }
  if (value === 'partial') {
    return { backgroundColor: '#FFEDD5', textColor: '#C2410C' };
  }
  if (value === 'unpaid') {
    return { backgroundColor: '#FEE2E2', textColor: '#B91C1C' };
  }
  return { backgroundColor: '#DBEAFE', textColor: '#1D4ED8' };
}

function canEditPurchaseItems(detail: PurchaseOrderDetail | null) {
  if (!detail) {
    return false;
  }
  if (detail.documentStatus === 'cancelled') {
    return false;
  }
  if (detail.purchaseReceipts.length || detail.purchaseInvoices.length) {
    return false;
  }
  if ((detail.receivedQty ?? 0) > 0) {
    return false;
  }
  return true;
}

function getPurchaseItemsLockHint(detail: PurchaseOrderDetail | null) {
  if (!detail) {
    return '当前订单已有收货或开票记录，商品明细已锁定，仅保留查看。';
  }
  if (detail.documentStatus === 'cancelled') {
    return '订单已作废，商品明细不可修改。';
  }
  if (detail.purchaseInvoices.length) {
    return `当前订单已关联采购发票 ${detail.purchaseInvoices[0]}，商品明细已锁定。`;
  }
  if (detail.purchaseReceipts.length) {
    return `当前订单已关联采购收货单 ${detail.purchaseReceipts[0]}，商品明细已锁定。`;
  }
  if ((detail.receivedQty ?? 0) > 0) {
    return `当前订单已发生收货（已收 ${formatQty(detail.receivedQty)}），商品明细已锁定。`;
  }
  return '当前订单已有收货或开票记录，商品明细已锁定，仅保留查看。';
}

function getPurchaseItemsLockAction(detail: PurchaseOrderDetail | null) {
  if (!detail) {
    return null;
  }
  if (detail.purchaseInvoices.length) {
    return { type: 'invoice' as const, name: detail.purchaseInvoices[0] };
  }
  if (detail.purchaseReceipts.length) {
    return { type: 'receipt' as const, name: detail.purchaseReceipts[0] };
  }
  return null;
}

function getPurchaseQuickRollbackPlan(detail: PurchaseOrderDetail | null) {
  if (!detail || detail.documentStatus === 'cancelled') {
    return null;
  }

  const hasPayment = detail.paymentStatus === 'paid' || (detail.paidAmount ?? 0) > 0;
  const hasInvoice = detail.purchaseInvoices.length > 0;
  const hasReceipt = detail.purchaseReceipts.length > 0 || (detail.receivedQty ?? 0) > 0;

  if (!hasPayment && !hasInvoice && !hasReceipt) {
    return null;
  }

  const steps: string[] = [];
  if (hasPayment) {
    steps.push('先回退付款');
  }
  if (hasInvoice) {
    steps.push(`再作废采购发票 ${detail.purchaseInvoices[0]}`);
  }
  if (hasReceipt) {
    steps.push(`最后作废采购收货单 ${detail.purchaseReceipts[0] || '当前收货单'}`);
  }

  return {
    title: '需先回退下游单据',
    message: hasPayment
      ? `当前采购订单已经进入付款阶段，不能直接修改。系统将按顺序${steps.join('、')}，完成后回到可编辑状态。`
      : hasInvoice
        ? `当前采购订单已开票，不能直接修改。系统将按顺序${steps.join('、')}，完成后回到可编辑状态。`
        : `当前采购订单已收货，不能直接修改。系统将${steps.join('、')}，完成后回到可编辑状态。`,
    confirmLabel: hasPayment ? '一键回退并修改' : '回退并修改',
  };
}

function getAvailableUoms(item: EditablePurchaseOrderItem) {
  const values = new Set<string>();
  if (item.uom) {
    values.add(item.uom);
  }
  if (item.stockUom) {
    values.add(item.stockUom);
  }
  item.allUoms?.forEach((uom) => {
    if (uom) {
      values.add(uom);
    }
  });
  return Array.from(values);
}

function buildItemsSignature(
  items: {
    itemCode: string;
    qty: string;
    price: string;
    warehouse: string;
    uom: string;
  }[],
) {
  return JSON.stringify(
    items.map((item) => ({
      itemCode: item.itemCode,
      qty: item.qty.trim(),
      price: item.price.trim(),
      warehouse: item.warehouse.trim(),
      uom: item.uom.trim(),
    })),
  );
}

function buildPurchaseEditDraftScope(orderName: string) {
  return `purchase-order-edit:${orderName}`;
}

function buildEditableItemsFromDetail(detail: PurchaseOrderDetail | null) {
  if (!detail) {
    return [] as EditablePurchaseOrderItem[];
  }

  return detail.items.map((item, index) => ({
    id: `${item.purchaseOrderItem || item.itemCode}-${index}`,
    itemCode: item.itemCode,
    itemName: item.itemName || item.itemCode,
    qty: typeof item.qty === 'number' ? String(item.qty) : '',
    price: typeof item.rate === 'number' ? String(item.rate) : '',
    warehouse: item.warehouse || '',
    uom: item.uom || '',
    imageUrl: null,
    stockUom: item.uom || null,
    totalQty: null,
    allUoms: item.uom ? [item.uom] : [],
    uomConversions: [],
    warehouseStockDetails: [],
  }));
}

function getDefaultWarehouseFromItems(items: EditablePurchaseOrderItem[]) {
  return items.find((item) => item.warehouse.trim())?.warehouse?.trim() || '';
}

function InfoRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.infoRow}>
      <ThemedText style={styles.infoLabel}>{label}</ThemedText>
      <ThemedText style={[styles.infoValue, valueColor ? { color: valueColor } : null]} type="defaultSemiBold">
        {value}
      </ThemedText>
    </View>
  );
}

export default function PurchaseOrderEditScreen() {
  const { orderName, resumeEdit } = useLocalSearchParams<{ orderName: string; resumeEdit?: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { showError, showSuccess } = useFeedback();
  const draftScope = buildPurchaseEditDraftScope(orderName || '');

  const [detail, setDetail] = useState<PurchaseOrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isQuickRollingBack, setIsQuickRollingBack] = useState(false);
  const [transactionDate, setTransactionDate] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [supplierRef, setSupplierRef] = useState('');
  const [remarks, setRemarks] = useState('');
  const [companyDefaultWarehouse, setCompanyDefaultWarehouse] = useState('');
  const [defaultWarehouse, setDefaultWarehouse] = useState('');
  const [defaultWarehouseTouched, setDefaultWarehouseTouched] = useState(false);
  const [editableItems, setEditableItems] = useState<EditablePurchaseOrderItem[]>([]);
  const [editMode, setEditMode] = useState<EditMode>('view');
  const [expandedItemRows, setExpandedItemRows] = useState<Record<string, boolean>>({});
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<{ itemId: string; field: 'warehouse' | 'uom' } | null>(null);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerOptions, setPickerOptions] = useState<{ label: string; value: string; description?: string }[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showQuickRollbackConfirm, setShowQuickRollbackConfirm] = useState(false);
  const [isBusinessDocsExpanded, setIsBusinessDocsExpanded] = useState(true);
  const scrollRef = useRef<ScrollView | null>(null);
  const showErrorRef = useRef(showError);
  const pendingNavigationActionRef = useRef<any>(null);
  const pendingLeaveCallbackRef = useRef<(() => void) | null>(null);
  const allowLeaveRef = useRef(false);
  const metaSectionYRef = useRef(0);
  const itemsSectionYRef = useRef(0);
  const hydratedKeysRef = useRef<Record<string, true>>({});
  const warehouseCompanyCacheRef = useRef<Record<string, string | null>>({});
  const originalMetaRef = useRef('');
  const originalItemsRef = useRef('');

  const surface = useThemeColor({}, 'surface');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');
  const statusTone = getPurchaseStatusTone(detail);
  const businessStatus = getPurchaseBusinessStatusLabel(detail);
  const isEditingMeta = editMode === 'meta' || editMode === 'all';
  const isEditingItemsSection = editMode === 'items' || editMode === 'all';

  useEffect(() => {
    showErrorRef.current = showError;
  }, [showError]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    fetchPurchaseOrderDetail(orderName || '')
      .then((nextDetail) => {
        if (cancelled || !nextDetail) {
          return;
        }

        setDetail(nextDetail);
        const detailItems = buildEditableItemsFromDetail(nextDetail);
        const nextDefaultWarehouse = getDefaultWarehouseFromItems(detailItems);

        const shouldResumeMeta = resumeEdit === 'all' || resumeEdit === 'meta';
        const shouldResumeItems = resumeEdit === 'all' || resumeEdit === 'items';
        const shouldResumeFromRoute = shouldResumeMeta || shouldResumeItems;

        if (!shouldResumeFromRoute) {
          clearPurchaseOrderDraft(draftScope);
        }

        const hasScopedItems = shouldResumeFromRoute && hasPurchaseOrderDraft(draftScope);
        const hasScopedForm = shouldResumeFromRoute && hasPurchaseOrderDraftForm(draftScope);
        const scopedForm = hasScopedForm ? getPurchaseOrderDraftForm(draftScope) : null;
        const scopedItems = hasScopedItems ? getPurchaseOrderDraft(draftScope) : [];

        const nextCanEditItems = canEditPurchaseItems(nextDetail);

        const restoredItems =
          hasScopedItems
            ? scopedItems.map((item) => ({
                id: item.id,
                itemCode: item.itemCode,
                itemName: item.itemName || item.itemCode,
                qty: item.qty,
                price: item.price,
                warehouse: item.warehouse || '',
                uom: item.uom || '',
                imageUrl: item.imageUrl || null,
                stockUom: item.stockUom || null,
                totalQty: item.totalQty ?? null,
                allUoms: item.allUoms ?? [],
                uomConversions: item.uomConversions ?? [],
                warehouseStockDetails: item.warehouseStockDetails ?? [],
              }))
            : detailItems;

        if (!nextCanEditItems && hasScopedItems) {
          replacePurchaseOrderDraft([], draftScope);
        }

        setTransactionDate(hasScopedForm ? scopedForm?.transactionDate || '' : nextDetail.transactionDate || '');
        setScheduleDate(hasScopedForm ? scopedForm?.scheduleDate || '' : nextDetail.scheduleDate || '');
        setSupplierRef(hasScopedForm ? scopedForm?.supplierRef || '' : nextDetail.supplierRef || '');
        setRemarks(hasScopedForm ? scopedForm?.remarks || '' : nextDetail.remarks || '');
        setDefaultWarehouse(hasScopedForm ? scopedForm?.defaultWarehouse || '' : nextDefaultWarehouse);
        setDefaultWarehouseTouched(hasScopedForm ? scopedForm?.defaultWarehouseTouched === true : false);
        setEditableItems(restoredItems);
        const hasDraftMetaChanges =
          Boolean(scopedForm) &&
          (
            (scopedForm?.transactionDate || '') !== (nextDetail.transactionDate || '') ||
            (scopedForm?.scheduleDate || '') !== (nextDetail.scheduleDate || '') ||
            (scopedForm?.supplierRef || '') !== (nextDetail.supplierRef || '') ||
            (scopedForm?.remarks || '') !== (nextDetail.remarks || '')
          );
        const shouldOpenMeta = shouldResumeMeta || (shouldResumeFromRoute && hasDraftMetaChanges);
        const shouldOpenItems =
          nextCanEditItems && (shouldResumeItems || (shouldResumeFromRoute && hasScopedItems));
        setEditMode(
          shouldOpenMeta && shouldOpenItems ? 'all' : shouldOpenMeta ? 'meta' : shouldOpenItems ? 'items' : 'view',
        );
        originalMetaRef.current = JSON.stringify({
          transactionDate: nextDetail.transactionDate || '',
          scheduleDate: nextDetail.scheduleDate || '',
          supplierRef: nextDetail.supplierRef || '',
          remarks: nextDetail.remarks || '',
        });
        originalItemsRef.current = buildItemsSignature(detailItems);
      })
      .catch((error) => {
        if (!cancelled) {
          showErrorRef.current(normalizeAppError(error).message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [draftScope, orderName, resumeEdit]);

  useEffect(() => {
    const trimmedCompany = detail?.company?.trim();
    if (!trimmedCompany) {
      setCompanyDefaultWarehouse('');
      return;
    }

    let cancelled = false;

    fetchPurchaseCompanyContext(trimmedCompany)
      .then((context) => {
        if (!cancelled) {
          const nextWarehouse = context?.warehouse?.trim() || '';
          setCompanyDefaultWarehouse(nextWarehouse);
          setDefaultWarehouse((current) => (defaultWarehouseTouched ? current : current.trim() || nextWarehouse));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCompanyDefaultWarehouse('');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [defaultWarehouseTouched, detail?.company]);

  useEffect(() => {
    const trimmedDefaultWarehouse = defaultWarehouse.trim() || companyDefaultWarehouse.trim();
    if (!trimmedDefaultWarehouse || !editableItems.some((item) => !item.warehouse.trim())) {
      return;
    }

    setEditableItems((currentItems) =>
      currentItems.map((item) => (item.warehouse.trim() ? item : { ...item, warehouse: trimmedDefaultWarehouse })),
    );
  }, [companyDefaultWarehouse, defaultWarehouse, editableItems]);

  useEffect(() => {
    if (!detail || (!isEditingMeta && !isEditingItemsSection)) {
      return;
    }

    updatePurchaseOrderDraftForm(
      {
        supplier: detail.supplier,
        company: detail.company,
        supplierRef,
        remarks,
        transactionDate,
        scheduleDate,
        defaultWarehouse,
        defaultWarehouseTouched,
      },
      draftScope,
    );
  }, [defaultWarehouse, defaultWarehouseTouched, detail, draftScope, isEditingItemsSection, isEditingMeta, remarks, scheduleDate, supplierRef, transactionDate]);

  useEffect(() => {
    if (!detail || !isEditingItemsSection) {
      return;
    }

    replacePurchaseOrderDraft(
      editableItems.map((item) => ({
        id: item.id,
        itemCode: item.itemCode,
        itemName: item.itemName,
        imageUrl: item.imageUrl || null,
        qty: item.qty,
        price: item.price,
        warehouse: item.warehouse || '',
        uom: item.uom || '',
        stockUom: item.stockUom || null,
        totalQty: item.totalQty ?? null,
        allUoms: item.allUoms ?? [],
        uomConversions: item.uomConversions ?? [],
        warehouseStockDetails: item.warehouseStockDetails ?? [],
      })),
      draftScope,
    );
  }, [detail, draftScope, editableItems, isEditingItemsSection]);

  useEffect(() => {
    if (!detail?.company) {
      return;
    }

    const activeWarehouses = Array.from(new Set(editableItems.map((item) => item.warehouse.trim()).filter(Boolean)));

    Object.keys(warehouseCompanyCacheRef.current).forEach((warehouse) => {
      if (!activeWarehouses.includes(warehouse)) {
        delete warehouseCompanyCacheRef.current[warehouse];
      }
    });

    if (!activeWarehouses.length) {
      return;
    }

    let active = true;
    const unresolved = activeWarehouses.filter((warehouse) => typeof warehouseCompanyCacheRef.current[warehouse] === 'undefined');

    const validateRows = () => {
      const invalid = activeWarehouses.filter((warehouse) => {
        const warehouseCompany = warehouseCompanyCacheRef.current[warehouse];
        return Boolean(warehouseCompany && warehouseCompany !== detail.company);
      });

      if (!invalid.length) {
        return;
      }

      setEditableItems((currentItems) =>
        currentItems.map((item) =>
          invalid.includes(item.warehouse.trim()) ? { ...item, warehouse: '' } : item,
        ),
      );
      showError(`已清除不属于当前公司 ${detail.company} 的仓库，请重新选择。`);
    };

    if (!unresolved.length) {
      validateRows();
      return;
    }

    void Promise.all(
      unresolved.map(async (warehouse) => ({
        warehouse,
        company: await getWarehouseCompany(warehouse),
      })),
    ).then((rows) => {
      if (!active) {
        return;
      }

      rows.forEach(({ warehouse, company }) => {
        warehouseCompanyCacheRef.current[warehouse] = company;
      });
      validateRows();
    });

    return () => {
      active = false;
    };
  }, [detail?.company, editableItems, showError]);

  useEffect(() => {
    if (!detail?.company) {
      return;
    }

    const keys = new Set(
      editableItems
        .filter((item) => item.itemCode)
        .map((item) => `${item.id}::${detail.company}::${item.warehouse.trim()}`),
    );

    Object.keys(hydratedKeysRef.current).forEach((key) => {
      if (!keys.has(key)) {
        delete hydratedKeysRef.current[key];
      }
    });

    const missing = editableItems.filter(
      (item) =>
        item.itemCode &&
        !hydratedKeysRef.current[`${item.id}::${detail.company}::${item.warehouse.trim()}`] &&
        (!item.stockUom ||
          !item.allUoms?.length ||
          typeof item.totalQty !== 'number' ||
          !item.warehouseStockDetails?.length ||
          !item.imageUrl),
    );

    if (!missing.length) {
      return;
    }

    let active = true;
    missing.forEach((item) => {
      hydratedKeysRef.current[`${item.id}::${detail.company}::${item.warehouse.trim()}`] = true;
    });

    void Promise.all(
      missing.map(async (item) => {
        const product = await fetchProductDetail(item.itemCode, {
          warehouse: item.warehouse || undefined,
          company: item.warehouse ? undefined : detail.company,
        });

        return product ? { id: item.id, product } : null;
      }),
    ).then((results) => {
      if (!active) {
        return;
      }

      const mapped = new Map(results.filter(Boolean).map((entry) => [entry.id, entry.product]));
      if (!mapped.size) {
        return;
      }

      setEditableItems((currentItems) =>
        currentItems.map((item) => {
          const product = mapped.get(item.id);
          if (!product) {
            return item;
          }

          return {
            ...item,
            imageUrl: item.imageUrl || product.imageUrl || null,
            stockUom: item.stockUom || product.stockUom || null,
            totalQty: typeof product.totalQty === 'number' ? product.totalQty : item.totalQty ?? null,
            allUoms: item.allUoms?.length ? item.allUoms : product.allUoms,
            uomConversions: item.uomConversions?.length ? item.uomConversions : product.uomConversions,
            warehouseStockDetails: item.warehouseStockDetails?.length ? item.warehouseStockDetails : product.warehouseStockDetails,
          };
        }),
      );
    });

    return () => {
      active = false;
    };
  }, [detail?.company, editableItems]);

  const pickerItem = useMemo(
    () => (pickerTarget ? editableItems.find((item) => item.id === pickerTarget.itemId) ?? null : null),
    [editableItems, pickerTarget],
  );

  useEffect(() => {
    if (!pickerVisible || !pickerTarget || !pickerItem || !detail?.company) {
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setPickerLoading(true);
      try {
        let nextOptions: { label: string; value: string; description?: string }[] = [];

        if (pickerTarget.field === 'warehouse') {
          nextOptions = await searchWarehouses(pickerQuery, detail.company);
        } else {
          const keyword = pickerQuery.trim().toLowerCase();
          const localOptions = getAvailableUoms(pickerItem)
            .filter((uom) => (keyword ? uom.toLowerCase().includes(keyword) : true))
            .map((uom) => ({
              label: formatDisplayUom(uom),
              value: uom,
              description:
                pickerItem.stockUom && uom === pickerItem.stockUom ? `${uom} · 库存单位` : `${uom} · 商品单位`,
            }));
          nextOptions = localOptions;
        }

        if (active) {
          setPickerOptions(nextOptions);
        }
      } finally {
        if (active) {
          setPickerLoading(false);
        }
      }
    }, 180);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [detail?.company, pickerItem, pickerQuery, pickerTarget, pickerVisible]);

  const validItems = useMemo(
    () =>
      editableItems
        .map((item) => {
          const qty = normalizePositiveNumber(item.qty);
          if (!item.itemCode.trim() || qty === null) {
            return null;
          }
          const price = item.price.trim() && Number.isFinite(Number(item.price)) ? Number(item.price) : null;

          return {
            itemCode: item.itemCode.trim(),
            qty,
            warehouse: item.warehouse.trim() || undefined,
            uom: item.uom.trim() || undefined,
            price,
          };
        })
        .filter((item): item is { itemCode: string; qty: number; warehouse?: string; uom?: string; price: number | null } => Boolean(item)),
    [editableItems],
  );

  const canEditItems = useMemo(() => canEditPurchaseItems(detail), [detail]);
  const canEditOrder = useMemo(
    () => Boolean(detail && detail.documentStatus !== 'cancelled' && canEditItems),
    [canEditItems, detail],
  );
  const paymentProgressRatio = useMemo(() => {
    if (!detail) {
      return 0;
    }

    const total = detail.receivableAmount ?? detail.orderAmountEstimate ?? 0;
    const paid = detail.paidAmount ?? 0;
    if (!Number.isFinite(total) || total <= 0) {
      return 0;
    }
    if (!Number.isFinite(paid) || paid <= 0) {
      return 0;
    }
    return Math.max(0, Math.min(1, paid / total));
  }, [detail]);
  const summaryUom = useMemo(() => getOrderSummaryUom(detail), [detail]);
  const primaryInvoiceName = useMemo(() => getPrimaryPurchaseInvoice(detail), [detail]);
  const quickRollbackPlan = useMemo(() => getPurchaseQuickRollbackPlan(detail), [detail]);

  const headerChanged = useMemo(
    () =>
      originalMetaRef.current !==
      JSON.stringify({
        transactionDate,
        scheduleDate,
        supplierRef,
        remarks,
      }),
    [remarks, scheduleDate, supplierRef, transactionDate],
  );

  const itemsChanged = useMemo(
    () => originalItemsRef.current !== buildItemsSignature(editableItems),
    [editableItems],
  );
  const totalPurchaseAmount = useMemo(
    () =>
      editableItems.reduce((sum, item) => {
        const qty = Number(item.qty);
        const price = Number(item.price);
        if (!Number.isFinite(qty) || !Number.isFinite(price)) {
          return sum;
        }
        return sum + qty * price;
      }, 0),
    [editableItems],
  );
  const isEditingAnySection = editMode !== 'view';
  const hasUnsavedEdits = isEditingAnySection && (headerChanged || itemsChanged);

  const requestLeaveConfirmation = (onProceed?: () => void) => {
    if (allowLeaveRef.current || !hasUnsavedEdits || isSaving) {
      onProceed?.();
      return true;
    }
    pendingLeaveCallbackRef.current = onProceed ?? null;
    setShowLeaveConfirm(true);
    return false;
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event: any) => {
      if (allowLeaveRef.current || !hasUnsavedEdits || isSaving) {
        return;
      }
      event.preventDefault();
      pendingNavigationActionRef.current = event.data.action;
      pendingLeaveCallbackRef.current = null;
      setShowLeaveConfirm(true);
    });
    return unsubscribe;
  }, [hasUnsavedEdits, isSaving, navigation]);

  useEffect(() => {
    if (isFocused) {
      allowLeaveRef.current = false;
    }
  }, [isFocused]);

  const scrollToSection = (y: number) => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: Math.max(y - 16, 0), animated: true });
    });
  };

  const openLatestReceipt = (receiptName: string) => {
    router.push({
      pathname: '/purchase/receipt/create',
      params: { receiptName },
    });
  };

  const openLatestInvoice = (purchaseInvoice: string) => {
    router.push({
      pathname: '/purchase/invoice/create',
      params: { purchaseInvoice },
    });
  };

  const openReceiptCreate = () => {
    if (!detail?.canReceive) {
      return;
    }

    router.push({
      pathname: '/purchase/receipt/create',
      params: { orderName: detail.name },
    });
  };

  const openInvoiceCreate = () => {
    if (!detail?.canCreateInvoice) {
      return;
    }

    const sourceReceipt = detail.purchaseReceipts[0]?.trim() || '';
    if (!sourceReceipt) {
      showError('当前订单还没有可开票的收货单，请先完成收货。');
      return;
    }

    router.push({
      pathname: '/purchase/invoice/create',
      params: { receiptName: sourceReceipt },
    });
  };

  const openPaymentCreate = () => {
    if (!primaryInvoiceName) {
      return;
    }

    router.push({
      pathname: '/purchase/payment/create',
      params: { referenceName: primaryInvoiceName },
    });
  };

  const openReturnCreate = () => {
    if (!detail?.canProcessReturn) {
      return;
    }

    if (primaryInvoiceName) {
      router.push({
        pathname: '/purchase/return/create',
        params: {
          sourceDoctype: 'Purchase Invoice',
          sourceName: primaryInvoiceName,
        },
      });
      return;
    }

    const sourceReceipt = detail.purchaseReceipts[0] || '';
    if (!sourceReceipt) {
      return;
    }

    router.push({
      pathname: '/purchase/return/create',
      params: {
        sourceDoctype: 'Purchase Receipt',
        sourceName: sourceReceipt,
      },
    });
  };

  const canCreateInvoiceFromReceipt = Boolean(detail?.canCreateInvoice && detail?.purchaseReceipts.length);
  const hasPendingBusinessAction = Boolean(
    detail &&
      (detail.canReceive || canCreateInvoiceFromReceipt || (detail.canRecordPayment && primaryInvoiceName) || detail.canProcessReturn),
  );
  const showBusinessDocsSection = Boolean(
    detail &&
      (detail.purchaseReceipts.length ||
        detail.purchaseInvoices.length ||
        detail.latestPaymentEntry ||
        detail.canReceive ||
        canCreateInvoiceFromReceipt ||
        detail.canRecordPayment ||
        detail.canProcessReturn),
  );

  useEffect(() => {
    if (!showBusinessDocsSection) {
      setIsBusinessDocsExpanded(false);
      return;
    }
    setIsBusinessDocsExpanded(hasPendingBusinessAction);
  }, [detail?.name, hasPendingBusinessAction, showBusinessDocsSection]);

  const workflowAction = !detail
    ? null
    : detail.purchaseInvoices.length
        ? {
            label: detail.canRecordPayment && primaryInvoiceName ? '去付款' : '发票',
            onPress:
              detail.canRecordPayment && primaryInvoiceName
                ? openPaymentCreate
                : () => openLatestInvoice(detail.purchaseInvoices[0]),
            tone: detail.canRecordPayment && primaryInvoiceName ? ('primary' as const) : ('ghost' as const),
          }
        : canCreateInvoiceFromReceipt
          ? {
              label: '开票',
              onPress: openInvoiceCreate,
              tone: 'primary' as const,
            }
          : detail.purchaseReceipts.length
            ? {
                label: '收货单',
                onPress: () => openLatestReceipt(detail.purchaseReceipts[0]),
                tone: 'ghost' as const,
              }
            : detail.canReceive
              ? {
                  label: '收货',
                  onPress: openReceiptCreate,
                  tone: 'primary' as const,
                }
            : null;

  const primaryBusinessAction = !detail
    ? null
    : detail.purchaseInvoices.length
      ? detail.canRecordPayment && primaryInvoiceName
        ? { key: 'payment', label: '去付款', onPress: openPaymentCreate }
        : { key: 'view-invoice', label: '查看发票', onPress: () => openLatestInvoice(detail.purchaseInvoices[0]) }
      : canCreateInvoiceFromReceipt
        ? { key: 'invoice', label: '去开票', onPress: openInvoiceCreate }
        : detail.purchaseReceipts.length
          ? { key: 'view-receipt', label: '查看收货单', onPress: () => openLatestReceipt(detail.purchaseReceipts[0]) }
          : detail.canReceive
            ? { key: 'receive', label: '去收货', onPress: openReceiptCreate }
            : null;

  const secondaryBusinessActions = detail
    ? [
        detail.purchaseReceipts[0] && primaryBusinessAction?.key !== 'view-receipt'
          ? { key: 'view-receipt', label: '查看收货单', onPress: () => openLatestReceipt(detail.purchaseReceipts[0]) }
          : null,
        detail.purchaseInvoices[0] && primaryBusinessAction?.key !== 'view-invoice'
          ? { key: 'view-invoice', label: '查看发票', onPress: () => openLatestInvoice(detail.purchaseInvoices[0]) }
          : null,
        detail.canProcessReturn ? { key: 'return', label: '退货', onPress: openReturnCreate } : null,
      ].filter((item): item is { key: string; label: string; onPress: () => void } => Boolean(item))
    : [];

  const businessDocsSection = showBusinessDocsSection && detail ? (
    <View style={[styles.card, styles.compactCard, { backgroundColor: surface, borderColor }]}>
      <View style={styles.sectionHeader}>
        <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
          业务单据
        </ThemedText>
        <Pressable onPress={() => setIsBusinessDocsExpanded((current) => !current)} style={styles.linkButton}>
          <ThemedText style={[styles.linkButtonText, { color: tintColor }]} type="defaultSemiBold">
            {isBusinessDocsExpanded ? '收起' : '展开'}
          </ThemedText>
        </Pressable>
      </View>
      {isBusinessDocsExpanded ? (
        <>
          <View style={styles.businessMetricsRow}>
            <View style={styles.businessMetricCard}>
              <ThemedText style={styles.businessMetricLabel}>收货单</ThemedText>
              <ThemedText style={styles.businessMetricValue} type="defaultSemiBold">
                {detail.purchaseReceipts.length ? `${detail.purchaseReceipts.length} 张` : '暂无'}
              </ThemedText>
            </View>
            <View style={styles.businessMetricCard}>
              <ThemedText style={styles.businessMetricLabel}>采购发票</ThemedText>
              <ThemedText style={styles.businessMetricValue} type="defaultSemiBold">
                {detail.purchaseInvoices.length ? `${detail.purchaseInvoices.length} 张` : '暂无'}
              </ThemedText>
            </View>
            <View style={styles.businessMetricCard}>
              <ThemedText style={styles.businessMetricLabel}>供应商付款</ThemedText>
              <ThemedText style={styles.businessMetricValue} type="defaultSemiBold">
                {detail.latestPaymentEntry ? '已有记录' : '暂无'}
              </ThemedText>
            </View>
          </View>

          {hasPendingBusinessAction ? (
            <View style={styles.businessPrimaryActions}>
              {primaryBusinessAction ? (
                <Pressable
                  onPress={primaryBusinessAction.onPress}
                  style={[styles.businessPrimaryButton, { backgroundColor: tintColor }]}>
                  <ThemedText style={styles.businessPrimaryButtonText} type="defaultSemiBold">
                    {primaryBusinessAction.label}
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <ThemedText style={styles.sectionSubtleText}>
              当前暂无可执行动作。
            </ThemedText>
          )}

          {secondaryBusinessActions.length ? (
            <View style={styles.businessSecondaryActions}>
              {secondaryBusinessActions.map((action) => (
                <Pressable key={action.key} onPress={action.onPress} style={[styles.businessLinkButton, { borderColor }]}>
                  <ThemedText style={[styles.businessLinkText, { color: tintColor }]} type="defaultSemiBold">
                    {action.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          ) : null}
        </>
      ) : (
        <ThemedText style={styles.sectionHintText}>
          已折叠。展开后可查看收货单、发票、付款等链路入口。
        </ThemedText>
      )}
    </View>
  ) : null;

  const handleItemChange = (itemId: string, field: keyof EditablePurchaseOrderItem, value: string) => {
    if (!isEditingItemsSection) {
      return;
    }
    const nextValue = field === 'qty' || field === 'price' ? sanitizeDecimalInput(value) : value;
    setEditableItems((current) => current.map((item) => (item.id === itemId ? { ...item, [field]: nextValue } : item)));
  };

  const openPicker = (itemId: string, field: 'warehouse' | 'uom') => {
    if (!canEditItems || !isEditingItemsSection) {
      return;
    }
    setPickerTarget({ itemId, field });
    setPickerVisible(true);
    setPickerQuery('');
  };

  const closePicker = () => {
    setPickerVisible(false);
    setPickerTarget(null);
    setPickerQuery('');
    setPickerOptions([]);
    setPickerLoading(false);
  };

  const handleSelectPickerValue = (value: string) => {
    if (!pickerTarget) {
      return;
    }
    handleItemChange(pickerTarget.itemId, pickerTarget.field, value);
    closePicker();
  };

  const handleRemoveItem = (itemId: string) => {
    if (!canEditItems || !isEditingItemsSection) {
      return;
    }

    setEditableItems((current) => current.filter((item) => item.id !== itemId));
    setExpandedItemRows((current) => {
      const next = { ...current };
      delete next[itemId];
      return next;
    });
  };

  const handleDefaultWarehouseChange = (value: string) => {
    if (!isEditingItemsSection) {
      return;
    }
    setDefaultWarehouseTouched(true);
    setDefaultWarehouse(value);
  };

  const handleAddItem = () => {
    if (!detail || !isEditingItemsSection) {
      return;
    }

    router.push({
      pathname: '/purchase/order/item-search',
      params: {
        company: detail.company,
        defaultWarehouse: defaultWarehouse.trim() || companyDefaultWarehouse || '',
        draftScope,
        returnTo: `/purchase/order/edit/${encodeURIComponent(detail.name)}?resumeEdit=items`,
      },
    });
  };

  const handleAddWarehouseRow = (rows: EditablePurchaseOrderItem[]) => {
    if (!canEditItems || !isEditingItemsSection) {
      return;
    }

    const baseRow = rows[0];
    const nextId = buildEditableId();
    setEditableItems((current) => [
      ...current,
      {
        ...baseRow,
        id: nextId,
        qty: '1',
        warehouse: baseRow.warehouse || companyDefaultWarehouse || '',
      },
    ]);
    setExpandedItemRows((current) => ({ ...current, [nextId]: true }));
  };

  const resetMetaSection = () => {
    if (!detail) {
      return;
    }
    const keepItemsEditing = isEditingItemsSection;
    setTransactionDate(detail.transactionDate || '');
    setScheduleDate(detail.scheduleDate || '');
    setSupplierRef(detail.supplierRef || '');
    setRemarks(detail.remarks || '');
    setEditMode(keepItemsEditing ? 'items' : 'view');
    if (!keepItemsEditing) {
      clearPurchaseOrderDraft(draftScope);
    } else {
      updatePurchaseOrderDraftForm(
        {
          supplier: detail.supplier,
          company: detail.company,
          supplierRef: detail.supplierRef || '',
          remarks: detail.remarks || '',
          transactionDate: detail.transactionDate || '',
          scheduleDate: detail.scheduleDate || '',
          defaultWarehouse,
          defaultWarehouseTouched,
        },
        draftScope,
      );
    }
  };

  const resetItemsSection = () => {
    if (!detail) {
      return;
    }
    const keepMetaEditing = isEditingMeta;
    const detailItems = buildEditableItemsFromDetail(detail);
    setEditableItems(detailItems);
    setExpandedItemRows({});
    setDefaultWarehouse(getDefaultWarehouseFromItems(detailItems));
    setDefaultWarehouseTouched(false);
    setEditMode(keepMetaEditing ? 'meta' : 'view');
    if (!keepMetaEditing) {
      clearPurchaseOrderDraft(draftScope);
    } else {
      replacePurchaseOrderDraft(detailItems, draftScope);
      updatePurchaseOrderDraftForm(
        {
          supplier: detail.supplier,
          company: detail.company,
          supplierRef,
          remarks,
          transactionDate,
          scheduleDate,
          defaultWarehouse: getDefaultWarehouseFromItems(detailItems),
          defaultWarehouseTouched: false,
        },
        draftScope,
      );
    }
  };

  const cancelEditing = () => {
    if (editMode === 'all') {
      if (!detail) {
        return;
      }
      const detailItems = buildEditableItemsFromDetail(detail);
      setEditableItems(detailItems);
      setExpandedItemRows({});
      setDefaultWarehouse(getDefaultWarehouseFromItems(detailItems));
      setDefaultWarehouseTouched(false);
      setTransactionDate(detail.transactionDate || '');
      setScheduleDate(detail.scheduleDate || '');
      setSupplierRef(detail.supplierRef || '');
      setRemarks(detail.remarks || '');
      setEditMode('view');
      clearPurchaseOrderDraft(draftScope);
      return;
    }

    if (isEditingItemsSection) {
      resetItemsSection();
    }
    if (isEditingMeta) {
      resetMetaSection();
      return;
    }
    clearPurchaseOrderDraft(draftScope);
  };

  const enterEditMode = (section: EditSection) => {
    if (!detail) {
      return;
    }
    if (!canEditOrder) {
      if (quickRollbackPlan) {
        setShowQuickRollbackConfirm(true);
        return;
      }
      showError('当前采购订单已有收货或开票记录，订单已锁定，不可直接编辑。');
      return;
    }
    if (section === 'all') {
      setEditMode(canEditItems ? 'all' : 'meta');
      return;
    }
    if (section === 'meta') {
      setEditMode(isEditingItemsSection ? 'all' : 'meta');
      return;
    }
    if (!canEditItems) {
      showError('当前采购订单已有收货或开票记录，暂不允许修改商品明细。');
      return;
    }
    setEditMode(isEditingMeta ? 'all' : 'items');
  };

  const handleQuickRollbackAndEdit = async () => {
    if (!orderName) {
      return;
    }

    try {
      setIsQuickRollingBack(true);
      const rollbackResult = await quickCancelPurchaseOrderV2(orderName, { rollbackPayment: true });
      if (rollbackResult.detail) {
        setDetail(rollbackResult.detail);
      }
      setEditMode('all');

      const rollbackSummary = [
        rollbackResult.cancelledPaymentEntries.length
          ? `已回退付款 ${rollbackResult.cancelledPaymentEntries.join('、')}`
          : '',
        rollbackResult.cancelledPurchaseInvoice
          ? `已作废发票 ${rollbackResult.cancelledPurchaseInvoice}`
          : '',
        rollbackResult.cancelledPurchaseReceipt
          ? `已作废收货单 ${rollbackResult.cancelledPurchaseReceipt}`
          : '',
      ]
        .filter(Boolean)
        .join('，');

      showSuccess(
        rollbackSummary
          ? `${rollbackSummary}，现在可以继续修改采购订单。`
          : '下游单据已回退，现在可以继续修改采购订单。',
      );
    } catch (error) {
      showError(normalizeAppError(error, '快捷回退失败。').message);
    } finally {
      setIsQuickRollingBack(false);
    }
  };

  const handleSave = async () => {
    if (!detail) {
      return;
    }

    if (!isValidIsoDate(transactionDate)) {
      showError('请先选择有效下单日期。');
      scrollToSection(metaSectionYRef.current);
      return;
    }

    if (!isValidIsoDate(scheduleDate)) {
      showError('请先选择有效计划到货日期。');
      scrollToSection(metaSectionYRef.current);
      return;
    }

    if (!headerChanged && !itemsChanged) {
      showError('当前没有可保存的修改。');
      return;
    }

    if (!validItems.length) {
      showError('请至少保留一条有效采购明细。');
      scrollToSection(itemsSectionYRef.current);
      return;
    }

    if (itemsChanged && !canEditItems) {
      showError('当前采购订单已有收货或开票记录，暂不允许修改商品明细。');
      scrollToSection(itemsSectionYRef.current);
      return;
    }

    try {
      setIsSaving(true);

      let nextOrderName = detail.name;
      let sourceOrderName = detail.name;

      if (itemsChanged) {
        const itemResult = await updatePurchaseOrderItems({
          orderName: detail.name,
          company: detail.company,
          scheduleDate,
          defaultWarehouse: defaultWarehouse.trim() || companyDefaultWarehouse || undefined,
          items: validItems,
        });

        nextOrderName = itemResult.orderName;
        sourceOrderName = itemResult.sourceOrderName;
      }

      if (headerChanged) {
        nextOrderName = await updatePurchaseOrder({
          orderName: nextOrderName,
          transactionDate,
          scheduleDate,
          supplierRef,
          remarks,
        });
      }

      showSuccess(
        itemsChanged && nextOrderName !== sourceOrderName
          ? `采购订单已更新，新单号为 ${nextOrderName}。`
          : `采购订单 ${nextOrderName} 已更新。`,
      );

      clearPurchaseOrderDraft(draftScope);
      allowLeaveRef.current = true;
      router.replace({
        pathname: '/purchase/order/[orderName]',
        params: { orderName: nextOrderName },
      });
    } catch (error) {
      showError(normalizeAppError(error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const itemsSection = detail ? (
    <View
      onLayout={(event) => {
        itemsSectionYRef.current = event.nativeEvent.layout.y;
      }}
      style={[styles.card, { backgroundColor: surface, borderColor }]}>
            <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderCopy}>
                  <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
                    商品明细
                  </ThemedText>
                  <ThemedText style={styles.sectionHintText}>
                    {canEditItems
                      ? '默认先查看采购商品；进入编辑后再调整默认仓、加商品和修改采购行。'
                      : getPurchaseItemsLockHint(detail)}
                  </ThemedText>
                </View>
                {(() => {
                  const lockAction = getPurchaseItemsLockAction(detail);
                  if (canEditItems) {
                    return (
                      <Pressable onPress={() => (isEditingItemsSection ? resetItemsSection() : enterEditMode('items'))} style={styles.linkButton}>
                        <ThemedText style={[styles.linkButtonText, { color: tintColor }]} type="defaultSemiBold">
                          {isEditingItemsSection ? '取消' : '修改商品'}
                        </ThemedText>
                      </Pressable>
                    );
                  }
                  return (
                    <View style={styles.lockedHeaderActions}>
                      {lockAction?.type === 'invoice' ? (
                        <Pressable onPress={() => openLatestInvoice(lockAction.name)} style={styles.linkButton}>
                          <ThemedText style={[styles.linkButtonText, { color: tintColor }]} type="defaultSemiBold">
                            查看发票
                          </ThemedText>
                        </Pressable>
                      ) : null}
                      {lockAction?.type === 'receipt' ? (
                        <Pressable onPress={() => openLatestReceipt(lockAction.name)} style={styles.linkButton}>
                          <ThemedText style={[styles.linkButtonText, { color: tintColor }]} type="defaultSemiBold">
                            查看收货单
                          </ThemedText>
                        </Pressable>
                      ) : null}
                      <ThemedText style={[styles.sectionHint, { color: '#D97706' }]} type="defaultSemiBold">
                        已锁定
                      </ThemedText>
                    </View>
                  );
                })()}
              </View>

      <View style={[styles.itemsSummaryBar, { backgroundColor: surfaceMuted }]}>
        <ThemedText style={styles.itemsSummaryText}>
          当前明细 {editableItems.length} 条
        </ThemedText>
        <ThemedText style={styles.itemsSummaryDivider}>·</ThemedText>
        <ThemedText style={styles.itemsSummaryText}>
          预计采购金额 <ThemedText style={styles.amountHighlightText} type="defaultSemiBold">{formatMoney(totalPurchaseAmount, detail.currency || 'CNY')}</ThemedText>
        </ThemedText>
      </View>

      <View style={styles.groupList}>
        <PurchaseOrderItemGroups
          borderColor={borderColor}
          editable={isEditingItemsSection && canEditItems}
          expandedRows={expandedItemRows}
          items={editableItems}
          onAddWarehouseRow={isEditingItemsSection && canEditItems ? handleAddWarehouseRow : undefined}
          onAdjustItemQty={isEditingItemsSection && canEditItems ? ((itemId, delta) => {
            const currentItem = editableItems.find((item) => item.id === itemId);
            if (!currentItem) {
              return;
            }
            const currentQty = Number(currentItem.qty);
            const safeQty = Number.isFinite(currentQty) ? currentQty : 0;
            handleItemChange(itemId, 'qty', String(Math.max(safeQty + delta, 1)));
          }) : undefined}
          onChangeItem={isEditingItemsSection && canEditItems ? ((itemId, field, value) => handleItemChange(itemId, field, value)) : undefined}
          onEmptyAction={isEditingItemsSection && canEditItems ? handleAddItem : undefined}
          onOpenPicker={isEditingItemsSection && canEditItems ? openPicker : undefined}
          onRemoveItem={isEditingItemsSection && canEditItems ? handleRemoveItem : undefined}
          onToggleRow={isEditingItemsSection && canEditItems ? ((itemId, nextExpanded) =>
            setExpandedItemRows((current) => ({ ...current, [itemId]: nextExpanded }))
          ) : undefined}
          surface={surface}
          surfaceMuted={surfaceMuted}
          tintColor={tintColor}
        />
      </View>
    </View>
  ) : null;

  const itemControlSection = detail && isEditingItemsSection && canEditItems ? (
    <View style={[styles.card, styles.compactCard, { backgroundColor: surface, borderColor }]}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderCopy}>
          <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
            选择商品
          </ThemedText>
          <ThemedText style={styles.sectionHintText}>
            先确认新增商品默认带入哪个仓，再进入采购商品搜索页继续添加；后续明细仍可单独调整。
          </ThemedText>
        </View>
      </View>

      <LinkOptionInput
        helperText="未手动指定时优先带当前公司的默认仓；后续每条采购明细仍可单独改仓。"
        inputActionText="切换"
        label="默认入库仓（新增商品默认带入）"
        loadOptions={(text) => searchWarehouses(text, detail.company || undefined)}
        onChangeText={handleDefaultWarehouseChange}
        onOptionSelect={handleDefaultWarehouseChange}
        placeholder={companyDefaultWarehouse || '未设置'}
        value={defaultWarehouse}
      />

      <Pressable
        onPress={handleAddItem}
        style={[styles.quickPickerCard, { backgroundColor: surfaceMuted, borderColor }]}>
        <View style={[styles.quickPickerIconWrap, { backgroundColor: surface }]}>
          <IconSymbol color={tintColor} name="shippingbox.fill" size={18} />
        </View>
        <View style={styles.quickPickerCopy}>
          <ThemedText style={styles.quickPickerLabel} type="defaultSemiBold">
            选择商品
          </ThemedText>
          <ThemedText style={styles.quickPickerHint}>
            进入采购商品搜索页选择，也可在页内扫码添加。
          </ThemedText>
        </View>
        <ThemedText style={{ color: tintColor }} type="defaultSemiBold">
          去选择
        </ThemedText>
      </Pressable>
    </View>
  ) : null;

  return (
    <AppShell
      compactHeader
      contentCard={false}
      description="查看采购订单详情，并按区块进入头信息或商品明细编辑。"
      headerRightAction={
        isEditingAnySection || !workflowAction ? (
          <View style={styles.headerActionPlaceholder} />
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => requestLeaveConfirmation(workflowAction.onPress)}
            style={[
              styles.headerActionButton,
              workflowAction.tone === 'primary' ? styles.headerActionPrimaryButton : styles.headerActionGhostButton,
            ]}>
            <ThemedText
              numberOfLines={1}
              style={workflowAction.tone === 'primary' ? styles.headerActionPrimaryText : styles.headerActionGhostText}
              type="defaultSemiBold">
              {workflowAction.label}
            </ThemedText>
          </Pressable>
        )
      }
      headerSideWidth={96}
      showWorkflowQuickNav={false}
      footerNoShadow
      footer={
        <View style={styles.footerWrap}>
          <View style={[styles.footerSummaryCard, { backgroundColor: surfaceMuted }]}>
            <View style={styles.footerSummaryTopRow}>
              <View style={styles.footerSummaryLeftWrap}>
                <ThemedText style={styles.footerSummaryCount} type="defaultSemiBold">
                  当前明细 {editableItems.length} 条
                </ThemedText>
                <ThemedText style={styles.footerSummaryHint}>
                  计划入库 {formatQty(validItems.reduce((sum, item) => sum + item.qty, 0))} · 到货 {scheduleDate || '未设置'}
                </ThemedText>
              </View>
              <View style={styles.footerSummaryAmountWrap}>
                <ThemedText style={styles.footerSummaryAmountLabel}>预计采购金额</ThemedText>
                <ThemedText style={styles.footerSummaryAmount} type="defaultSemiBold">
                  {formatMoney(totalPurchaseAmount, detail?.currency || 'CNY')}
                </ThemedText>
              </View>
            </View>
          </View>

          {isEditingAnySection ? (
            <View style={styles.footerActionsRow}>
              <Pressable
                disabled={isSaving}
                onPress={cancelEditing}
                style={[styles.footerGhostButton, { borderColor }]}>
                <ThemedText style={styles.footerGhostButtonText} type="defaultSemiBold">
                  取消修改
                </ThemedText>
              </Pressable>
              <Pressable
                disabled={isSaving || (!headerChanged && !itemsChanged)}
                onPress={() => void handleSave()}
                style={[
                  styles.footerButton,
                  { backgroundColor: isSaving || (!headerChanged && !itemsChanged) ? surfaceMuted : tintColor },
                ]}>
                <ThemedText style={styles.footerButtonText} type="defaultSemiBold">
                  {isSaving ? '正在保存采购订单...' : headerChanged || itemsChanged ? '保存采购订单' : '暂无修改'}
                </ThemedText>
              </Pressable>
            </View>
          ) : (
            quickRollbackPlan ? (
              <Pressable
                disabled={isQuickRollingBack}
                onPress={() => setShowQuickRollbackConfirm(true)}
                style={[
                  styles.footerButton,
                  { backgroundColor: isQuickRollingBack ? surfaceMuted : tintColor },
                ]}>
                <ThemedText style={styles.footerButtonText} type="defaultSemiBold">
                  {isQuickRollingBack ? '回退中...' : '回退并修改'}
                </ThemedText>
              </Pressable>
            ) : (
              <Pressable
                disabled={!canEditOrder}
                onPress={() => {
                  if (!canEditOrder) {
                    return;
                  }
                  enterEditMode('all');
                }}
                style={[
                  styles.footerButton,
                  { backgroundColor: canEditOrder ? tintColor : surfaceMuted },
                ]}>
                <ThemedText style={styles.footerButtonText} type="defaultSemiBold">
                  {canEditOrder ? '编辑采购订单' : '订单已锁定'}
                </ThemedText>
              </Pressable>
            )
          )}
        </View>
      }
      title="采购订单详情">
      <ScrollView contentContainerStyle={styles.container} ref={scrollRef}>
        {isLoading ? (
          <View style={[styles.loadingCard, { backgroundColor: surface, borderColor }]}>
            <ActivityIndicator />
            <ThemedText>正在读取采购订单...</ThemedText>
          </View>
        ) : detail ? (
          <>
            <View
              onLayout={(event) => {
                metaSectionYRef.current = event.nativeEvent.layout.y;
              }}
              style={[styles.heroCard, { backgroundColor: surface, borderColor }]}>
              <View style={styles.heroHeader}>
                <View style={styles.heroCopy}>
                  <ThemedText style={styles.heroTitle} type="defaultSemiBold">
                    {detail.supplierName || detail.supplier}
                  </ThemedText>
                  <ThemedText style={styles.heroSubline}>{detail.name}</ThemedText>
                </View>
                <View style={[styles.statusChip, { backgroundColor: statusTone.backgroundColor }]}>
                  <ThemedText
                    style={{ color: statusTone.color }}
                    type="defaultSemiBold">
                    {businessStatus}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.metaGrid}>
                <MetaBlock label="订单金额" value={formatMoney(detail.orderAmountEstimate, detail.currency || 'CNY')} />
                <MetaBlock
                  label="待收数量"
                  value={`${formatQty(detail.totalQty != null && detail.receivedQty != null ? detail.totalQty - detail.receivedQty : detail.totalQty)} ${summaryUom}`.trim()}
                />
                <MetaBlock
                  label="已收数量"
                  value={`${formatQty(detail.receivedQty)} ${summaryUom}`.trim()}
                />
                <MetaBlock label="计划到货" value={detail.scheduleDate || '未设置'} />
              </View>
              <View style={[styles.paymentProgressCard, { borderColor }]}>
                <View style={styles.paymentProgressHeader}>
                  <ThemedText style={styles.paymentProgressLabel} type="defaultSemiBold">
                    付款进度
                  </ThemedText>
                  <View
                    style={[
                      styles.paymentProgressStatusBadge,
                      { backgroundColor: getPaymentStatusTone(detail.paymentStatus || '').backgroundColor },
                    ]}>
                    <ThemedText
                      style={[
                        styles.paymentProgressStatus,
                        { color: getPaymentStatusTone(detail.paymentStatus || '').textColor },
                      ]}
                      type="defaultSemiBold">
                      {getPaymentStatusLabel(detail.paymentStatus || '')}
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.paymentProgressBarTrack}>
                  <View
                    style={[
                      styles.paymentProgressBarFill,
                      {
                        width: `${Math.round(paymentProgressRatio * 100)}%`,
                        backgroundColor: getPaymentStatusTone(detail.paymentStatus || '').textColor,
                      },
                    ]}
                  />
                </View>
                <ThemedText style={styles.paymentProgressHint}>
                  已付 {Math.round(paymentProgressRatio * 100)}%
                </ThemedText>
                <View style={styles.paymentProgressAmounts}>
                  <View style={[styles.paymentProgressAmountBlock, styles.paymentProgressAmountCard]}>
                    <ThemedText style={styles.paymentProgressAmountLabel}>已付款</ThemedText>
                    <ThemedText style={styles.paymentProgressAmountValue} type="defaultSemiBold">
                      {formatMoney(detail.paidAmount, detail.currency || 'CNY')}
                    </ThemedText>
                  </View>
                  <View style={[styles.paymentProgressAmountBlock, styles.paymentProgressAmountCard]}>
                    <ThemedText style={styles.paymentProgressAmountLabel}>待付款</ThemedText>
                    <ThemedText style={[styles.paymentProgressAmountValue, styles.paymentProgressOutstanding]} type="defaultSemiBold">
                      {formatMoney(detail.outstandingAmount, detail.currency || 'CNY')}
                    </ThemedText>
                  </View>
                </View>
              </View>
              <View style={[styles.compactDivider, { borderColor }]} />
              <View style={styles.sectionHeader}>
                <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
                  头部信息
                </ThemedText>
                {canEditOrder ? (
                  <Pressable onPress={() => (isEditingMeta ? resetMetaSection() : enterEditMode('meta'))} style={styles.linkButton}>
                    <ThemedText style={[styles.linkButtonText, { color: tintColor }]} type="defaultSemiBold">
                      {isEditingMeta ? '取消' : '修改'}
                    </ThemedText>
                  </Pressable>
                ) : (
                  <ThemedText style={[styles.sectionHint, { color: '#D97706' }]} type="defaultSemiBold">
                    已锁定
                  </ThemedText>
                )}
              </View>
              {isEditingMeta ? (
                <>
                  <View style={styles.inlineGrid}>
                    <View style={styles.inlineField}>
                      <DateFieldInput
                        errorText={!isValidIsoDate(transactionDate) ? '请选择有效下单日期。' : undefined}
                        helperText="采购单头部日期。"
                        label="下单日期"
                        onChange={setTransactionDate}
                        value={transactionDate}
                      />
                    </View>
                    <View style={styles.inlineField}>
                      <DateFieldInput
                        errorText={!isValidIsoDate(scheduleDate) ? '请选择有效计划到货日期。' : undefined}
                        helperText="用于收货计划安排。"
                        label="计划到货"
                        onChange={setScheduleDate}
                        value={scheduleDate}
                      />
                    </View>
                  </View>

                  <View style={styles.fieldBlock}>
                    <ThemedText style={styles.fieldLabel} type="defaultSemiBold">
                      供应商单号
                    </ThemedText>
                    <TextInput
                      onChangeText={setSupplierRef}
                      placeholder="可选，记录对方单号"
                      style={[styles.input, { backgroundColor: surfaceMuted, borderColor }]}
                      value={supplierRef}
                    />
                  </View>

                  <View style={styles.fieldBlock}>
                    <ThemedText style={styles.fieldLabel} type="defaultSemiBold">
                      备注
                    </ThemedText>
                    <TextInput
                      multiline
                      onChangeText={setRemarks}
                      placeholder="可选，记录本次采购补充说明"
                      style={[styles.input, styles.textarea, { backgroundColor: surfaceMuted, borderColor }]}
                      value={remarks}
                    />
                  </View>
                </>
              ) : (
                <View style={styles.infoStack}>
                  <InfoRow label="下单日期" value={detail.transactionDate || '未设置'} />
                  <InfoRow label="计划到货" value={detail.scheduleDate || '未设置'} />
                  <InfoRow label="我方公司" value={detail.company || '—'} />
                  <InfoRow label="供应商单号" value={detail.supplierRef || '未填写'} />
                  <InfoRow label="备注" value={detail.remarks || '暂无备注'} />
                </View>
              )}
            </View>

            {businessDocsSection}

            {itemControlSection}

            {itemsSection}

            <View style={[styles.card, styles.compactCard, { backgroundColor: surface, borderColor }]}>
              <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
                订单与付款
              </ThemedText>
              <View style={styles.compactInfoGrid}>
                <InfoRow label="我方公司" value={detail.company || '—'} />
                <InfoRow label="下单日期" value={detail.transactionDate || '—'} />
                <InfoRow
                  label="单据状态"
                  value={getDocumentStatusLabel(detail.documentStatus || '')}
                  valueColor={getStatusValueColor(detail.documentStatus || '', 'document')}
                />
                <InfoRow
                  label="收货状态"
                  value={getReceivingStatusLabel(detail.receivingStatus || '')}
                  valueColor={getStatusValueColor(detail.receivingStatus || '', 'receiving')}
                />
                <InfoRow
                  label="付款状态"
                  value={getPaymentStatusLabel(detail.paymentStatus || '')}
                  valueColor={getStatusValueColor(detail.paymentStatus || '', 'payment')}
                />
                <InfoRow
                  label="完成状态"
                  value={getCompletionStatusLabel(detail.completionStatus || '')}
                  valueColor={getStatusValueColor(detail.completionStatus || '', 'completion')}
                />
              </View>
              <View style={[styles.compactDivider, { borderColor }]} />
              <View style={styles.compactInfoGrid}>
                <InfoRow
                  label="已开票应付"
                  value={formatMoney(detail.receivableAmount, detail.currency || 'CNY')}
                />
                <InfoRow
                  label="已付款"
                  value={formatMoney(detail.paidAmount, detail.currency || 'CNY')}
                />
                <InfoRow
                  label="待付款"
                  value={formatMoney(detail.outstandingAmount, detail.currency || 'CNY')}
                  valueColor={detail.outstandingAmount && detail.outstandingAmount > 0 ? '#C2410C' : undefined}
                />
                <InfoRow label="最近付款单" value={detail.latestPaymentEntry || '暂无'} />
              </View>
            </View>

            {!isEditingAnySection ? (
              <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionHeaderCopy}>
                    <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
                      供应商与地址
                    </ThemedText>
                    <ThemedText style={styles.sectionHintText}>
                      这里展示的是当前采购订单保存下来的供应商和地址快照。
                    </ThemedText>
                  </View>
                </View>
                <InfoRow label="联系人" value={detail.supplierContactDisplay || '未配置'} />
                <InfoRow label="联系电话" value={detail.supplierContactPhone || '未配置'} />
                <InfoRow label="联系邮箱" value={detail.supplierContactEmail || '未配置'} />
                <InfoRow label="地址" value={detail.supplierAddressDisplay || detail.defaultAddressDisplay || '未配置'} />
              </View>
            ) : null}

          </>
        ) : (
          <View style={[styles.loadingCard, { backgroundColor: surface, borderColor }]}>
            <ThemedText type="defaultSemiBold">没有读取到采购订单</ThemedText>
            <ThemedText>请确认采购订单是否存在，或稍后重试。</ThemedText>
          </View>
        )}
      </ScrollView>

      <Modal animationType="slide" onRequestClose={closePicker} transparent visible={pickerVisible}>
        <View style={styles.modalBackdrop}>
          <Pressable onPress={closePicker} style={StyleSheet.absoluteFill} />
          <View style={[styles.modalSheet, { backgroundColor: surface }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle} type="title">
                {pickerTarget?.field === 'warehouse' ? '选择入库仓库' : '选择录入单位'}
              </ThemedText>
              <ThemedText style={styles.modalHint}>
                {pickerTarget?.field === 'warehouse'
                  ? `仅显示公司 ${detail?.company || ''} 下的仓库。`
                  : '优先显示商品已配置单位。'}
              </ThemedText>
            </View>
            <View style={[styles.modalSearchWrap, { backgroundColor: surfaceMuted, borderColor }]}>
              <TextInput
                onChangeText={setPickerQuery}
                placeholder={pickerTarget?.field === 'warehouse' ? '搜索仓库名称' : '搜索单位名称'}
                placeholderTextColor="rgba(31,42,55,0.38)"
                style={styles.modalSearchInput}
                value={pickerQuery}
              />
            </View>
            <ScrollView contentContainerStyle={styles.modalList} showsVerticalScrollIndicator={false}>
              {pickerLoading ? (
                <View style={[styles.emptyState, { backgroundColor: surfaceMuted }]}>
                  <ThemedText type="defaultSemiBold">正在读取候选项...</ThemedText>
                </View>
              ) : pickerOptions.length ? (
                <View style={styles.modalSection}>
                  {pickerOptions.map((option) => {
                    const active =
                      pickerTarget && pickerItem
                        ? (pickerTarget.field === 'warehouse' ? pickerItem.warehouse : pickerItem.uom) === option.value
                        : false;

                    return (
                      <Pressable
                        key={`${option.value}-${option.label}`}
                        onPress={() => handleSelectPickerValue(option.value)}
                        style={[
                          styles.modalOption,
                          { backgroundColor: active ? 'rgba(59,130,246,0.08)' : surfaceMuted, borderColor },
                        ]}>
                        <View style={styles.modalOptionCopy}>
                          <ThemedText numberOfLines={1} type="defaultSemiBold">
                            {option.label}
                          </ThemedText>
                          {option.description ? (
                            <ThemedText style={styles.modalOptionMeta}>{option.description}</ThemedText>
                          ) : null}
                        </View>
                        <ThemedText style={{ color: tintColor }} type="defaultSemiBold">
                          {active ? '当前' : '选择'}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <View style={[styles.emptyState, { backgroundColor: surfaceMuted }]}>
                  <ThemedText type="defaultSemiBold">没有找到匹配项</ThemedText>
                  <ThemedText>换个关键词试试。</ThemedText>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal animationType="fade" onRequestClose={() => setShowLeaveConfirm(false)} transparent visible={showLeaveConfirm}>
        <View style={styles.dialogBackdrop}>
          <View style={[styles.dialogCard, { backgroundColor: surface, borderColor }]}>
            <ThemedText style={[styles.dialogTitle, styles.dialogTitleWarning]} type="defaultSemiBold">
              当前修改尚未保存
            </ThemedText>
            <ThemedText style={styles.dialogMessage}>
              你正在编辑采购订单，离开后将丢失本次修改。
            </ThemedText>
            <View style={styles.dialogActions}>
              <Pressable
                onPress={() => {
                  pendingNavigationActionRef.current = null;
                  pendingLeaveCallbackRef.current = null;
                  setShowLeaveConfirm(false);
                }}
                style={[styles.dialogButton, styles.dialogGhostButton, { borderColor }]}>
                <ThemedText style={styles.dialogGhostText} type="defaultSemiBold">
                  继续编辑
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowLeaveConfirm(false);
                  const pendingAction = pendingNavigationActionRef.current;
                  pendingNavigationActionRef.current = null;
                  const pendingCallback = pendingLeaveCallbackRef.current;
                  pendingLeaveCallbackRef.current = null;
                  allowLeaveRef.current = true;
                  if (pendingAction) {
                    (navigation as any).dispatch(pendingAction);
                  } else if (pendingCallback) {
                    pendingCallback();
                  } else {
                    router.back();
                  }
                }}
                style={[styles.dialogButton, styles.dialogDangerButton]}>
                <ThemedText style={styles.dialogPrimaryText} type="defaultSemiBold">
                  放弃修改
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => setShowQuickRollbackConfirm(false)}
        transparent
        visible={showQuickRollbackConfirm}>
        <View style={styles.dialogBackdrop}>
          <View style={[styles.dialogCard, { backgroundColor: surface, borderColor }]}>
            <ThemedText style={[styles.dialogTitle, styles.dialogTitleWarning]} type="defaultSemiBold">
              {quickRollbackPlan?.title || '确认回退'}
            </ThemedText>
            <ThemedText style={styles.dialogMessage}>
              {quickRollbackPlan?.message || '系统将先回退下游单据，再回到可编辑状态。'}
            </ThemedText>
            <View style={styles.dialogActions}>
              <Pressable
                onPress={() => setShowQuickRollbackConfirm(false)}
                style={[styles.dialogButton, styles.dialogGhostButton, { borderColor }]}>
                <ThemedText style={styles.dialogGhostText} type="defaultSemiBold">
                  先不处理
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowQuickRollbackConfirm(false);
                  void handleQuickRollbackAndEdit();
                }}
                style={[styles.dialogButton, styles.dialogDangerButton]}>
                <ThemedText style={styles.dialogPrimaryText} type="defaultSemiBold">
                  {isQuickRollingBack ? '回退中...' : quickRollbackPlan?.confirmLabel || '确认回退'}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </AppShell>
  );
}

function MetaBlock({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaBlock}>
      <ThemedText style={styles.metaLabel}>{label}</ThemedText>
      <ThemedText style={styles.metaValue} type="defaultSemiBold">
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    paddingBottom: 28,
  },
  headerActionButton: {
    alignItems: 'center',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 34,
    minWidth: 74,
    paddingHorizontal: 14,
  },
  headerActionPrimaryButton: {
    backgroundColor: '#2563EB',
  },
  headerActionGhostButton: {
    backgroundColor: '#EEF2FF',
  },
  headerActionPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13,
  },
  headerActionGhostText: {
    color: '#1D4ED8',
    fontSize: 13,
  },
  headerActionPlaceholder: {
    height: 34,
    width: 74,
  },
  loadingCard: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    gap: 10,
    padding: 20,
  },
  heroCard: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  heroHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  heroCopy: {
    flex: 1,
    gap: 4,
  },
  heroTitle: {
    fontSize: 22,
  },
  heroSubline: {
    color: '#64748B',
  },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metaBlock: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    flexBasis: '48%',
    gap: 4,
    padding: 12,
  },
  paymentProgressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  paymentProgressHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  paymentProgressLabel: {
    color: '#334155',
    fontSize: 13,
  },
  paymentProgressStatusBadge: {
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  paymentProgressStatus: {
    fontSize: 13,
  },
  paymentProgressBarTrack: {
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    height: 8,
    overflow: 'hidden',
  },
  paymentProgressBarFill: {
    borderRadius: 999,
    height: '100%',
    minWidth: 0,
  },
  paymentProgressHint: {
    color: '#64748B',
    fontSize: 13,
  },
  paymentProgressAmounts: {
    flexDirection: 'row',
    gap: 10,
  },
  paymentProgressAmountBlock: {
    flex: 1,
    gap: 3,
  },
  paymentProgressAmountCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  paymentProgressAmountLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  paymentProgressAmountValue: {
    color: '#0F172A',
    fontSize: 18,
  },
  paymentProgressOutstanding: {
    color: '#C2410C',
  },
  metaLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  metaValue: {
    fontSize: 15,
  },
  infoRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  infoLabel: {
    color: '#475569',
    fontSize: 14,
  },
  infoValue: {
    color: '#0F172A',
    flex: 1,
    fontSize: 15,
    textAlign: 'right',
  },
  infoStack: {
    gap: 10,
  },
  noticeCard: {
    borderRadius: 16,
    gap: 6,
    padding: 14,
  },
  noticeTitle: {
    fontSize: 14,
  },
  noticeText: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 19,
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  compactCard: {
    gap: 10,
    paddingVertical: 16,
  },
  compactInfoGrid: {
    gap: 8,
  },
  compactDivider: {
    borderTopWidth: 1,
  },
  sectionHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  sectionHintText: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 19,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  lockedHeaderActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
  },
  sectionHint: {
    fontSize: 13,
  },
  sectionSubtleText: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 18,
  },
  linkButton: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  linkButtonText: {
    fontSize: 14,
  },
  businessMetricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  businessMetricCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    flex: 1,
    gap: 4,
    minHeight: 70,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  businessMetricLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  businessMetricValue: {
    color: '#0F172A',
    fontSize: 16,
  },
  businessPrimaryActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  businessPrimaryButton: {
    alignItems: 'center',
    borderRadius: 14,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 110,
    paddingHorizontal: 14,
  },
  businessPrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  businessSecondaryActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  businessLinkButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  businessLinkText: {
    fontSize: 13,
  },
  nextActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  nextActionButton: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 14,
  },
  compactActionButton: {
    minHeight: 36,
    paddingHorizontal: 12,
  },
  nextActionText: {
    fontSize: 13,
  },
  itemsSummaryBar: {
    alignItems: 'center',
    borderRadius: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  itemsSummaryText: {
    color: '#475569',
    fontSize: 13,
  },
  amountHighlightText: {
    color: '#C2410C',
    fontSize: 15,
  },
  itemsSummaryDivider: {
    color: '#94A3B8',
    fontSize: 13,
  },
  fieldBlock: {
    gap: 8,
  },
  inlineGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  inlineField: {
    flex: 1,
    gap: 8,
  },
  fieldLabel: {
    fontSize: 14,
  },
  quickPickerCard: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 88,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  quickPickerIconWrap: {
    alignItems: 'center',
    borderRadius: 16,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  quickPickerCopy: {
    flex: 1,
    gap: 4,
  },
  quickPickerLabel: {
    fontSize: 16,
  },
  quickPickerHint: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  textarea: {
    minHeight: 94,
    textAlignVertical: 'top',
  },
  readonlyField: {
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 14,
  },
  groupList: {
    gap: 12,
  },
  groupCard: {
    borderRadius: 20,
    gap: 12,
    padding: 14,
  },
  groupHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  groupLead: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  thumbWrap: {
    alignItems: 'center',
    borderRadius: 18,
    height: 52,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 52,
  },
  thumbImage: {
    height: '100%',
    width: '100%',
  },
  groupCopy: {
    flex: 1,
    gap: 2,
  },
  groupLabel: {
    color: '#2563EB',
    fontSize: 12,
  },
  groupTitle: {
    fontSize: 17,
  },
  groupMeta: {
    color: '#64748B',
    fontSize: 12,
  },
  actionButton: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    borderRadius: 16,
    flex: 1,
    gap: 4,
    padding: 12,
  },
  metricLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  metricValue: {
    fontSize: 15,
  },
  rowList: {
    gap: 10,
  },
  rowCard: {
    borderRadius: 18,
    gap: 12,
    padding: 14,
  },
  rowDivider: {
    borderTopWidth: 1,
  },
  rowHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  rowHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  rowBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  rowBadgeText: {
    color: '#2563EB',
    fontSize: 12,
  },
  rowMeta: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
  },
  removeButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  removeButtonText: {
    color: '#DC2626',
    fontSize: 12,
  },
  inventoryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inventoryCard: {
    borderRadius: 14,
    flex: 1,
    gap: 4,
    padding: 12,
  },
  inventoryLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  inventoryValue: {
    fontSize: 14,
  },
  selectorButton: {
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  selectorButtonText: {
    fontSize: 15,
  },
  selectorHint: {
    color: '#71859D',
    fontSize: 13,
    lineHeight: 18,
    paddingLeft: 4,
  },
  footerWrap: {
    gap: 10,
  },
  footerActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  footerGhostButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
  },
  footerGhostButtonText: {
    color: '#475569',
    fontSize: 15,
  },
  footerSummaryCard: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  footerSummaryTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  footerSummaryLeftWrap: {
    flex: 1,
    gap: 4,
  },
  footerSummaryCount: {
    color: '#0F172A',
    fontSize: 20,
    lineHeight: 24,
  },
  footerSummaryAmountWrap: {
    alignItems: 'flex-end',
    flex: 1,
    gap: 2,
  },
  footerSummaryAmountLabel: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'right',
  },
  footerSummaryAmount: {
    color: '#C2410C',
    fontSize: 24,
    lineHeight: 28,
    textAlign: 'right',
  },
  footerSummaryTitle: {
    color: '#0F172A',
    fontSize: 14,
  },
  footerSummaryHint: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 18,
  },
  footerButton: {
    alignItems: 'center',
    borderRadius: 16,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
  },
  footerButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
  },
  modalBackdrop: {
    backgroundColor: 'rgba(15,23,42,0.22)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 14,
    maxHeight: '72%',
    paddingBottom: 24,
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  modalHandle: {
    alignSelf: 'center',
    backgroundColor: '#CBD5E1',
    borderRadius: 999,
    height: 5,
    width: 44,
  },
  modalHeader: {
    gap: 6,
  },
  modalTitle: {
    fontSize: 20,
  },
  modalHint: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 19,
  },
  modalSearchWrap: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  modalSearchInput: {
    fontSize: 15,
    minHeight: 48,
  },
  modalList: {
    gap: 12,
    paddingBottom: 8,
  },
  modalSection: {
    gap: 10,
  },
  modalOption: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  modalOptionCopy: {
    flex: 1,
    gap: 2,
  },
  modalOptionMeta: {
    color: '#71859D',
    fontSize: 13,
    lineHeight: 18,
  },
  emptyState: {
    borderRadius: 18,
    gap: 6,
    padding: 16,
  },
  dialogBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(15,23,42,0.36)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  dialogCard: {
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    maxWidth: 420,
    paddingHorizontal: 16,
    paddingVertical: 16,
    width: '100%',
  },
  dialogTitle: {
    fontSize: 18,
  },
  dialogTitleWarning: {
    color: '#D97706',
  },
  dialogMessage: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 22,
  },
  dialogActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  dialogButton: {
    alignItems: 'center',
    borderRadius: 12,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
  },
  dialogGhostButton: {
    borderWidth: 1,
  },
  dialogGhostText: {
    color: '#475569',
    fontSize: 14,
  },
  dialogDangerButton: {
    backgroundColor: '#DC2626',
  },
  dialogPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
});
