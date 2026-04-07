import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MobilePageHeader } from '@/components/mobile-page-header';
import { SalesOrderItemEditor } from '@/components/sales-order-item-editor';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { normalizeAppError } from '@/lib/app-error';
import { isValidIsoDate } from '@/lib/date-value';
import { formatCurrencyValue } from '@/lib/display-currency';
import { resolveDisplayUom } from '@/lib/display-uom';
import { getPaymentResultHandoff, type PaymentResultHandoff } from '@/lib/payment-result-handoff';
import { buildModeDefaults, normalizeSalesMode, type SalesMode } from '@/lib/sales-mode';
import { type UomConversion } from '@/lib/uom-conversion';
import {
  buildLineUnitSummary,
  buildQuantityComposition,
  buildQuantitySummary,
  buildWarehouseStockDisplay,
} from '@/lib/uom-display';
import {
  clearSalesOrderDraftForm,
  clearSalesOrderDraft,
  getSalesOrderDraftForm,
  getSalesOrderDraft,
  hasSalesOrderDraftForm,
  replaceSalesOrderDraft,
  updateSalesOrderDraftForm,
  type SalesOrderDraftItem,
  type SalesOrderDraftForm,
} from '@/lib/sales-order-draft';
import { fetchProductDetail } from '@/services/products';
import {
  cancelSalesOrderV2,
  getSalesOrderDetailV2,
  quickCancelSalesOrderV2,
  updateSalesOrderItemsV2,
  updateSalesOrderV2,
  type SalesOrderDetailV2,
} from '@/services/sales';
import { useFeedback } from '@/providers/feedback-provider';
import { DateFieldInput } from '@/components/date-field-input';

type EditableOrderItem = {
  itemCode: string;
  itemName: string;
  nickname?: string | null;
  specification?: string | null;
  qty: number;
  rate: number | null;
  amount: number | null;
  warehouse: string;
  uom: string;
  uomDisplay?: string | null;
  salesMode: SalesMode;
  stockUom?: string | null;
  stockUomDisplay?: string | null;
  uomConversions?: UomConversion[];
  warehouseStockQty?: number | null;
  warehouseStockUom?: string | null;
  warehouseStockUomDisplay?: string | null;
  wholesaleDefaultUom?: string | null;
  wholesaleDefaultUomDisplay?: string | null;
  retailDefaultUom?: string | null;
  retailDefaultUomDisplay?: string | null;
  allUoms?: string[];
  allUomDisplays?: Record<string, string>;
  salesProfiles?: { modeCode: SalesMode; priceList?: string | null; defaultUom?: string | null }[];
  priceSummary?: {
    currentPriceList?: string | null;
    currentRate?: number | null;
    standardSellingRate?: number | null;
    wholesaleRate?: number | null;
    retailRate?: number | null;
    standardBuyingRate?: number | null;
    valuationRate?: number | null;
  } | null;
  imageUrl: string;
};

type CenterDialogState = {
  title: string;
  message: string;
  confirmLabel?: string;
  confirmTone?: 'danger' | 'primary';
  tone?: 'danger' | 'warning' | 'info';
  onConfirm?: (() => void) | null;
} | null;

type EditEntryMode = 'all' | 'contact' | 'items' | 'remarks';

function HighlightedDialogMessage({
  message,
  tone,
}: {
  message: string;
  tone: 'danger' | 'warning' | 'info';
}) {
  const emphasisColor =
    tone === 'danger' ? '#DC2626' : tone === 'warning' ? '#D97706' : '#2563EB';
  const parts = message.split(
    /(已开票|已出货|已作废|不可编辑|不可直接作废|不能直接修改|不能直接作废|高风险操作|收款回退|销售发票|发货单|库存会自动回退|确认作废|作废订单|结算阶段|收款或结算阶段|已生成新订单|已作废。|[A-Z]{2,}(?:-[A-Z]+)?-\d{4}-\d{5})/g,
  );

  return (
    <ThemedText style={styles.dialogMessage}>
      {parts.filter(Boolean).map((part, index) => {
        const isEmphasis =
          /(已开票|已出货|已作废|不可编辑|不可直接作废|不能直接修改|不能直接作废|高风险操作|收款回退|销售发票|发货单|库存会自动回退|确认作废|作废订单|结算阶段|收款或结算阶段|已生成新订单|[A-Z]{2,}(?:-[A-Z]+)?-\d{4}-\d{5})/.test(
            part,
          );

        return (
          <ThemedText
            key={`${part}-${index}`}
            style={isEmphasis ? [styles.dialogMessageEmphasis, { color: emphasisColor }] : undefined}
            type={isEmphasis ? 'defaultSemiBold' : 'default'}
          >
            {part}
          </ThemedText>
        );
      })}
    </ThemedText>
  );
}

function formatModeReference(
  label: string,
  rate: number | null | undefined,
  uom: string | null | undefined,
  uomDisplay: string | null | undefined,
  currency: string,
) {
  return `${label} ${formatCurrencyValue(rate ?? null, currency)} / ${uom ? resolveDisplayUom(uom, uomDisplay) : '未设置单位'}`;
}

function buildOrderQuantitySummary(items: { qty?: number | null; uom?: string | null }[]) {
  if (!items.length) {
    return '暂无商品明细';
  }

  return `共 ${items.length} 行，${buildQuantitySummary(items)}`;
}

function getBusinessStatusLabel(detail: SalesOrderDetailV2 | null) {
  if (!detail) {
    return '未加载';
  }

  if (detail.documentStatus === 'cancelled') {
    return '已作废';
  }
  if (detail.completionStatus === 'completed') {
    return '已完成';
  }
  if (detail.paymentStatus === 'paid') {
    return '已结清';
  }
  if (detail.latestSalesInvoice) {
    return '已开票';
  }
  if (detail.fulfillmentStatus === 'shipped') {
    return '已出货';
  }
  if (detail.fulfillmentStatus === 'partial') {
    return '部分出货';
  }
  if (detail.documentStatus === 'submitted') {
    return '待出货';
  }
  return '草稿';
}

function getStatusTone(detail: SalesOrderDetailV2 | null) {
  if (!detail) {
    return { backgroundColor: '#E2E8F0', color: '#475569' };
  }

  if (detail.documentStatus === 'cancelled') {
    return { backgroundColor: '#FEE2E2', color: '#B91C1C' };
  }
  if (detail.completionStatus === 'completed' || detail.paymentStatus === 'paid') {
    return { backgroundColor: '#DCFCE7', color: '#15803D' };
  }
  if (detail.fulfillmentStatus === 'partial') {
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

function getFulfillmentStatusLabel(value: string) {
  switch (value) {
    case 'pending':
      return '待出货';
    case 'partial':
      return '部分出货';
    case 'shipped':
      return '已出货';
    default:
      return value || '—';
  }
}

function getDeliveryStatusLabel(value: string) {
  switch (value) {
    case 'pending':
      return '待发货';
    case 'partial':
      return '部分发货';
    case 'shipped':
      return '已发货';
    case 'delivered':
      return '已送达';
    case 'unknown':
      return '状态待确认';
    default:
      return value || '—';
  }
}

function getPaymentStatusLabel(value: string) {
  switch (value) {
    case 'unpaid':
      return '未收款';
    case 'partial':
      return '部分收款';
    case 'paid':
      return '已收款';
    default:
      return value || '—';
  }
}

function getStatusValueColor(value: string, type: 'document' | 'fulfillment' | 'delivery' | 'payment') {
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

  if (type === 'fulfillment' || type === 'delivery') {
    if (value === 'shipped' || value === 'delivered') return '#15803D';
    if (value === 'partial') return '#D97706';
    if (value === 'unknown') return '#64748B';
    return '#2563EB';
  }

  return '#0F172A';
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

function normalizeEditableText(value: string | null | undefined) {
  return (value ?? '').trim();
}

function mapDraftItemToEditable(item: SalesOrderDraftItem): EditableOrderItem {
  return {
    itemCode: item.itemCode,
    itemName: item.itemName,
    nickname: item.nickname ?? null,
    specification: item.specification ?? null,
    qty: item.qty,
    rate: item.price,
    amount: (item.price ?? 0) * item.qty,
    warehouse: item.warehouse ?? '',
    uom: item.uom ?? '',
    uomDisplay: item.uomDisplay ?? null,
    salesMode: normalizeSalesMode(item.salesMode),
    stockUom: item.stockUom ?? null,
    stockUomDisplay: item.stockUomDisplay ?? null,
    uomConversions: item.uomConversions ?? [],
    warehouseStockQty: item.warehouseStockQty ?? null,
    warehouseStockUom: item.warehouseStockUom ?? item.stockUom ?? null,
    warehouseStockUomDisplay: item.warehouseStockUomDisplay ?? item.stockUomDisplay ?? null,
    wholesaleDefaultUom: item.wholesaleDefaultUom ?? null,
    wholesaleDefaultUomDisplay: item.wholesaleDefaultUomDisplay ?? null,
    retailDefaultUom: item.retailDefaultUom ?? null,
    retailDefaultUomDisplay: item.retailDefaultUomDisplay ?? null,
    allUomDisplays: item.allUomDisplays ?? {},
    salesProfiles: item.salesProfiles ?? [],
    priceSummary: item.priceSummary ?? null,
    imageUrl: item.imageUrl ?? '',
  };
}

function buildScopedDraftForm(
  detail: SalesOrderDetailV2 | null,
  values: {
    deliveryDate: string;
    remarks: string;
    shippingAddress: string;
    shippingContact: string;
    shippingPhone: string;
  },
): Partial<SalesOrderDraftForm> {
  return {
    customer: detail?.customer ?? '',
    company: detail?.company ?? '',
    defaultSalesMode: normalizeSalesMode(detail?.defaultSalesMode),
    deliveryDate: values.deliveryDate,
    remarks: values.remarks,
    shippingAddress: values.shippingAddress,
    shippingContact: values.shippingContact,
    shippingPhone: values.shippingPhone,
  };
}

function buildComparableItemSignature(items: {
  itemCode: string;
  qty: number | null;
  rate: number | null;
  warehouse: string;
  uom: string;
}[]) {
  return items.map((item) => ({
    itemCode: item.itemCode,
    qty: item.qty ?? 0,
    rate: item.rate ?? 0,
    warehouse: item.warehouse || '',
    uom: item.uom || '',
  }));
}

function groupOrderItemsByProduct<T extends {
  itemCode: string;
  itemName?: string | null;
  nickname?: string | null;
  specification?: string | null;
  imageUrl?: string | null;
  qty: number;
  amount?: number | null;
  rate?: number | null;
}>(items: T[]) {
  const grouped = new Map<
    string,
    {
      itemCode: string;
      itemName: string;
      nickname?: string | null;
      specification?: string | null;
      imageUrl?: string | null;
      totalQty: number;
      totalAmount: number;
      rows: { item: T; index: number }[];
    }
  >();

  items.forEach((item, index) => {
    const lineAmount =
      typeof item.amount === 'number'
        ? item.amount
        : (item.rate ?? 0) * item.qty;
    const existing = grouped.get(item.itemCode);
    if (existing) {
      existing.rows.push({ item, index });
      existing.totalQty += item.qty;
      existing.totalAmount += lineAmount;
      return;
    }

    grouped.set(item.itemCode, {
      itemCode: item.itemCode,
      itemName: item.itemName || item.itemCode,
      nickname: item.nickname ?? null,
      specification: item.specification ?? null,
      imageUrl: item.imageUrl ?? null,
      totalQty: item.qty,
      totalAmount: lineAmount,
      rows: [{ item, index }],
    });
  });

  return Array.from(grouped.values());
}

export default function SalesOrderDetailScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { orderName, resumeEdit } = useLocalSearchParams<{
    orderName: string;
    resumeEdit?: string;
  }>();
  const isFocused = useIsFocused();
  const orderDraftScope = orderName ? `order-edit:${orderName}` : 'order-edit';
  const resumeEditMode = resumeEdit === 'all' || resumeEdit === 'items' ? resumeEdit : undefined;

  const [detail, setDetail] = useState<SalesOrderDetailV2 | null>(null);
  const [message, setMessage] = useState('');
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [isEditingItems, setIsEditingItems] = useState(false);
  const [isEditingRemarks, setIsEditingRemarks] = useState(false);
  const [isSavingContact, setIsSavingContact] = useState(false);
  const [isSavingItems, setIsSavingItems] = useState(false);
  const [isSavingRemarks, setIsSavingRemarks] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isQuickRollingBack, setIsQuickRollingBack] = useState(false);
  const [deliveryDateInput, setDeliveryDateInput] = useState('');
  const [contactDisplayInput, setContactDisplayInput] = useState('');
  const [contactPhoneInput, setContactPhoneInput] = useState('');
  const [addressInput, setAddressInput] = useState('');
  const [remarksInput, setRemarksInput] = useState('');
  const [editableItems, setEditableItems] = useState<EditableOrderItem[]>([]);
  const [itemUomOptions, setItemUomOptions] = useState<Record<string, string[]>>({});
  const [itemModeDefaults, setItemModeDefaults] = useState<Record<string, Partial<EditableOrderItem>>>({});
  const [centerDialog, setCenterDialog] = useState<CenterDialogState>(null);
  const [recentPaymentNotice, setRecentPaymentNotice] = useState<PaymentResultHandoff | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const pendingNavigationActionRef = useRef<any>(null);
  const pendingLeaveCallbackRef = useRef<(() => void) | null>(null);
  const allowLeaveRef = useRef(false);

  const background = useThemeColor({}, 'background');
  const surface = useThemeColor({}, 'surface');
  const borderColor = useThemeColor({}, 'border');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const tintColor = useThemeColor({}, 'tint');
  const { showError, showInfo, showSuccess } = useFeedback();
  const returnToSalesHome = () => {
    router.replace('/(tabs)/sales');
  };

  useEffect(() => {
    if (!orderName || !isFocused) {
      return;
    }

    let active = true;

    void getSalesOrderDetailV2(orderName)
      .then((nextDetail) => {
        if (!active) {
          return;
        }

        const scopedDraft =
          isEditingItems || resumeEditMode === 'items' || resumeEditMode === 'all'
            ? getSalesOrderDraft(orderDraftScope)
            : [];
        const scopedDraftForm =
          isEditingContact || isEditingRemarks || resumeEditMode === 'all' || hasSalesOrderDraftForm(orderDraftScope)
            ? getSalesOrderDraftForm(orderDraftScope)
            : null;
        const detailItems =
          nextDetail?.items.map((item) => ({
            itemCode: item.itemCode,
            itemName: item.itemName,
            nickname: item.nickname ?? null,
            specification: item.specification ?? null,
            qty: item.qty ?? 1,
            rate: item.rate,
            amount: item.amount,
            warehouse: item.warehouse,
            uom: item.uom,
            uomDisplay: item.uomDisplay ?? null,
            salesMode: normalizeSalesMode(item.salesMode),
            stockUom: item.stockUom ?? null,
            stockUomDisplay: item.stockUomDisplay ?? null,
            uomConversions: [],
            wholesaleDefaultUom: item.wholesaleDefaultUom ?? null,
            wholesaleDefaultUomDisplay: item.wholesaleDefaultUomDisplay ?? null,
            retailDefaultUom: item.retailDefaultUom ?? null,
            retailDefaultUomDisplay: item.retailDefaultUomDisplay ?? null,
            allUomDisplays: item.allUomDisplays ?? {},
            salesProfiles: item.salesProfiles ?? [],
            priceSummary: item.priceSummary ?? null,
            imageUrl: item.imageUrl,
          })) ?? [];
        const nextEditableItems = scopedDraft.length ? scopedDraft.map(mapDraftItemToEditable) : detailItems;

        const shouldRestoreDraftItems =
          scopedDraft.length > 0 && (isEditingItems || resumeEditMode === 'items' || resumeEditMode === 'all');
        const shouldRestoreDraftForm =
          scopedDraftForm != null && (isEditingContact || isEditingRemarks || resumeEditMode === 'all');

        setDetail(nextDetail);
        if (shouldRestoreDraftForm) {
          setDeliveryDateInput(scopedDraftForm.deliveryDate);
          setContactDisplayInput(scopedDraftForm.shippingContact);
          setContactPhoneInput(scopedDraftForm.shippingPhone);
          setAddressInput(scopedDraftForm.shippingAddress);
        } else if (!isEditingContact) {
          setDeliveryDateInput(nextDetail?.deliveryDate ?? '');
          setContactDisplayInput(nextDetail?.contactDisplay ?? nextDetail?.contactPerson ?? '');
          setContactPhoneInput(nextDetail?.contactPhone ?? '');
          setAddressInput(nextDetail?.addressDisplay ?? '');
        }
        if (shouldRestoreDraftForm) {
          setRemarksInput(scopedDraftForm.remarks);
        } else if (!isEditingRemarks) {
          setRemarksInput(nextDetail?.remarks ?? '');
        }
        if (shouldRestoreDraftItems) {
          setEditableItems(nextEditableItems);
        } else if (!isEditingItems) {
          setEditableItems(detailItems);
        }
        if (nextDetail?.latestSalesInvoice) {
          const paymentNotice = getPaymentResultHandoff(nextDetail.latestSalesInvoice);
          setRecentPaymentNotice((previous) => paymentNotice ?? previous);
        } else {
          setRecentPaymentNotice(null);
        }
        if (resumeEditMode === 'all') {
          setIsEditingContact(true);
          setIsEditingItems(true);
          setIsEditingRemarks(true);
          (navigation as any).setParams?.({ resumeEdit: undefined });
        } else if (resumeEditMode === 'items' && scopedDraft.length) {
          setIsEditingContact(false);
          setIsEditingRemarks(false);
          setIsEditingItems(true);
          (navigation as any).setParams?.({ resumeEdit: undefined });
        }
        setMessage(nextDetail ? '' : '未找到对应销售订单。');
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        const appError = normalizeAppError(error, '订单详情读取失败。');
        setMessage(appError.message);
      });

    return () => {
      active = false;
    };
  }, [isFocused, isEditingContact, isEditingItems, isEditingRemarks, navigation, orderDraftScope, orderName, resumeEditMode]);

  useEffect(() => {
    if (!isFocused || !isEditingItems) {
      return;
    }

    const scopedDraft = getSalesOrderDraft(orderDraftScope);
    if (!scopedDraft.length) {
      return;
    }

    setEditableItems(
      scopedDraft.map(mapDraftItemToEditable),
    );
  }, [isEditingItems, isFocused, orderDraftScope]);

  useEffect(() => {
    if (!isEditingItems || !editableItems.length) {
      return;
    }

    const pendingItemCodes = Array.from(
      new Set(
        editableItems
          .map((item) => item.itemCode)
          .filter(
            (itemCode) =>
              itemCode &&
              (!(itemCode in itemUomOptions) ||
                !(itemCode in itemModeDefaults) ||
                !itemModeDefaults[itemCode]?.priceSummary),
          ),
      ),
    );

    if (!pendingItemCodes.length) {
      return;
    }

    let cancelled = false;

    void Promise.all(
      pendingItemCodes.map(async (itemCode) => {
        try {
          const productDetail = await fetchProductDetail(itemCode, {
            company: detail?.company || undefined,
          });
          const fallbackUoms = editableItems
            .filter((item) => item.itemCode === itemCode)
            .map((item) => item.uom)
            .filter(Boolean);
          const allUoms = productDetail?.allUoms?.length
            ? productDetail.allUoms
            : productDetail?.stockUom
              ? [productDetail.stockUom]
              : fallbackUoms;

          return [
            itemCode,
            {
              allUoms: Array.from(new Set(allUoms.filter(Boolean))),
              stockUom: productDetail?.stockUom ?? null,
              stockUomDisplay: productDetail?.stockUomDisplay ?? null,
              uomConversions: productDetail?.uomConversions ?? [],
              warehouseStockDetails: productDetail?.warehouseStockDetails ?? [],
              nickname: productDetail?.nickname ?? null,
              specification: productDetail?.specification ?? null,
              wholesaleDefaultUom: productDetail?.wholesaleDefaultUom ?? null,
              wholesaleDefaultUomDisplay: productDetail?.wholesaleDefaultUomDisplay ?? null,
              retailDefaultUom: productDetail?.retailDefaultUom ?? null,
              retailDefaultUomDisplay: productDetail?.retailDefaultUomDisplay ?? null,
              allUomDisplays: productDetail?.allUomDisplays ?? {},
              salesProfiles: productDetail?.salesProfiles ?? [],
              priceSummary: productDetail?.priceSummary ?? null,
            },
          ] as const;
        } catch {
          return [itemCode, { allUoms: [] }] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) {
        return;
      }

      setItemUomOptions((current) => {
        const next = { ...current };
        for (const [itemCode, config] of entries) {
          next[itemCode] = config.allUoms;
        }
        return next;
      });
      setItemModeDefaults((current) => {
        const next = { ...current };
        for (const [itemCode, config] of entries) {
          next[itemCode] = {
            stockUom: config.stockUom ?? null,
            wholesaleDefaultUom: config.wholesaleDefaultUom ?? null,
            retailDefaultUom: config.retailDefaultUom ?? null,
            salesProfiles: config.salesProfiles ?? [],
            priceSummary: config.priceSummary ?? null,
          };
        }
        return next;
      });
      setEditableItems((current) =>
        current.map((item) => {
          const config = entries.find(([itemCode]) => itemCode === item.itemCode)?.[1];
          if (!config) {
            return item;
          }

          const matchedWarehouseStock = config.warehouseStockDetails?.find(
            (row) => row.warehouse === item.warehouse,
          );

          return {
            ...item,
            allUoms: item.allUoms?.length ? item.allUoms : config.allUoms,
            allUomDisplays: item.allUomDisplays ?? config.allUomDisplays ?? {},
            stockUom: item.stockUom ?? config.stockUom ?? null,
            stockUomDisplay: item.stockUomDisplay ?? config.stockUomDisplay ?? null,
            uomConversions: item.uomConversions?.length ? item.uomConversions : config.uomConversions ?? [],
            warehouseStockQty: matchedWarehouseStock?.qty ?? item.warehouseStockQty ?? null,
            warehouseStockUom: item.warehouseStockUom ?? config.stockUom ?? null,
            warehouseStockUomDisplay: item.warehouseStockUomDisplay ?? config.stockUomDisplay ?? null,
            nickname: item.nickname ?? config.nickname ?? null,
            specification: item.specification ?? config.specification ?? null,
            wholesaleDefaultUom: item.wholesaleDefaultUom ?? config.wholesaleDefaultUom ?? null,
            wholesaleDefaultUomDisplay:
              item.wholesaleDefaultUomDisplay ?? config.wholesaleDefaultUomDisplay ?? null,
            retailDefaultUom: item.retailDefaultUom ?? config.retailDefaultUom ?? null,
            retailDefaultUomDisplay:
              item.retailDefaultUomDisplay ?? config.retailDefaultUomDisplay ?? null,
            salesProfiles: item.salesProfiles?.length ? item.salesProfiles : config.salesProfiles ?? [],
            priceSummary: item.priceSummary ?? config.priceSummary ?? null,
            uomDisplay:
              item.allUomDisplays?.[item.uom] ??
              config.allUomDisplays?.[item.uom] ??
              item.uomDisplay ??
              null,
          };
        }),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [detail?.company, editableItems, isEditingItems, itemModeDefaults, itemUomOptions]);

  const statusTone = getStatusTone(detail);
  const businessStatus = getBusinessStatusLabel(detail);
  const isEditingAnySection = isEditingContact || isEditingItems || isEditingRemarks;
  const isEditingAllSections = isEditingContact && isEditingItems && isEditingRemarks;
  const editingGrandTotal = useMemo(
    () => editableItems.reduce((sum, item) => sum + (item.rate ?? 0) * item.qty, 0),
    [editableItems],
  );
  const orderQuantitySummary = useMemo(
    () => buildOrderQuantitySummary(isEditingItems ? editableItems : detail?.items ?? []),
    [detail?.items, editableItems, isEditingItems],
  );
  const groupedDisplayItems = useMemo(
    () => groupOrderItemsByProduct(isEditingItems ? editableItems : detail?.items ?? []),
    [detail?.items, editableItems, isEditingItems],
  );
  const isSavingCurrentSection = isEditingAllSections
    ? isSavingContact || isSavingItems || isSavingRemarks
    : isEditingItems
      ? isSavingItems
      : isEditingRemarks
        ? isSavingRemarks
        : isSavingContact;
  const detailItemSignature = useMemo(
    () =>
      buildComparableItemSignature(
        detail?.items.map((item) => ({
          itemCode: item.itemCode,
          qty: item.qty,
          rate: item.rate,
          warehouse: item.warehouse,
          uom: item.uom,
        })) ?? [],
      ),
    [detail],
  );
  const editableItemSignature = useMemo(
    () => buildComparableItemSignature(editableItems),
    [editableItems],
  );
  const hasUnsavedContactChanges =
    isEditingContact &&
    (
      normalizeEditableText(deliveryDateInput) !== normalizeEditableText(detail?.deliveryDate) ||
      normalizeEditableText(contactDisplayInput) !== normalizeEditableText(detail?.contactDisplay ?? detail?.contactPerson) ||
      normalizeEditableText(contactPhoneInput) !== normalizeEditableText(detail?.contactPhone) ||
      normalizeEditableText(addressInput) !== normalizeEditableText(detail?.addressDisplay)
    );
  const hasUnsavedRemarkChanges =
    isEditingRemarks &&
    normalizeEditableText(remarksInput) !== normalizeEditableText(detail?.remarks);
  const hasUnsavedItemChanges =
    isEditingItems &&
    JSON.stringify(editableItemSignature) !== JSON.stringify(detailItemSignature);
  const hasUnsavedEdits = hasUnsavedContactChanges || hasUnsavedRemarkChanges || hasUnsavedItemChanges;

  function requestLeaveConfirmation(onProceed?: () => void) {
    if (allowLeaveRef.current || !hasUnsavedEdits || isSavingCurrentSection) {
      onProceed?.();
      return true;
    }

    pendingLeaveCallbackRef.current = onProceed ?? null;
    setShowLeaveConfirm(true);
    return false;
  }

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (allowLeaveRef.current || !hasUnsavedEdits || isSavingCurrentSection) {
        return;
      }

      event.preventDefault();
      pendingNavigationActionRef.current = event.data.action;
      pendingLeaveCallbackRef.current = null;
      setShowLeaveConfirm(true);
    });

    return unsubscribe;
  }, [allowLeaveRef, hasUnsavedEdits, isSavingCurrentSection, navigation, pendingNavigationActionRef]);

  useEffect(() => {
    if (isFocused) {
      allowLeaveRef.current = false;
    }
  }, [isFocused, allowLeaveRef]);

  useEffect(() => {
    if (!orderName || (!isEditingContact && !isEditingRemarks)) {
      return;
    }

    updateSalesOrderDraftForm(
      buildScopedDraftForm(detail, {
        deliveryDate: deliveryDateInput,
        remarks: remarksInput,
        shippingAddress: addressInput,
        shippingContact: contactDisplayInput,
        shippingPhone: contactPhoneInput,
      }),
      orderDraftScope,
    );
  }, [
    addressInput,
    contactDisplayInput,
    contactPhoneInput,
    detail,
    deliveryDateInput,
    isEditingContact,
    isEditingRemarks,
    orderName,
    orderDraftScope,
    remarksInput,
  ]);

  async function handleSaveContact() {
    if (!orderName) {
      return;
    }

    if (!isValidIsoDate(deliveryDateInput)) {
      showError('请先选择有效交货日期。');
      return;
    }

    try {
      setIsSavingContact(true);
      const nextDetail = await updateSalesOrderV2({
        orderName,
        deliveryDate: deliveryDateInput,
        remarks: remarksInput,
        contactDisplay: contactDisplayInput,
        contactPhone: contactPhoneInput,
        shippingAddressText: addressInput,
      });

      setDetail(nextDetail);
      clearSalesOrderDraftForm(orderDraftScope);
      setIsEditingContact(false);
      showSuccess('收货与联系人已更新。');
    } catch (error) {
      const appError = normalizeAppError(error, '订单保存失败。');
      showError(appError.message);
    } finally {
      setIsSavingContact(false);
    }
  }

  async function handleCancelOrder() {
    if (!orderName || !detail || detail.documentStatus === 'cancelled') {
      return;
    }

    try {
      setIsCancelling(true);
      const nextDetail = await cancelSalesOrderV2(orderName);
      setDetail(nextDetail);
      clearSalesOrderDraftForm(orderDraftScope);
      setIsEditingContact(false);
      setIsEditingItems(false);
      setIsEditingRemarks(false);
      showSuccess('订单已作废。');
    } catch (error) {
      const appError = normalizeAppError(error, '订单作废失败。');
      showError(appError.message);
    } finally {
      setIsCancelling(false);
    }
  }

  function confirmCancelOrder() {
    if (!orderName || !detail || detail.documentStatus === 'cancelled' || isCancelling) {
      return;
    }

    const cancelRestriction = getCancelRestrictionMessage();
    if (cancelRestriction) {
      setCenterDialog({
        title: '当前订单不可直接作废',
        message: cancelRestriction,
        tone: 'danger',
      });
      return;
    }

    setCenterDialog({
      title: '确认作废订单？',
      message: '作废订单属于高风险操作。作废后订单将不能继续正常流转；如果已经存在关联业务单据，系统也可能阻止作废。',
      confirmLabel: '确认作废',
      confirmTone: 'danger',
      tone: 'danger',
      onConfirm: () => {
        void handleCancelOrder();
      },
    });
  }

  function openDeliveryCreate() {
    if (!orderName || !detail?.canSubmitDelivery) {
      return;
    }

    requestLeaveConfirmation(() => {
      router.push({
        pathname: '/sales/delivery/create',
        params: {
          orderName,
        },
      });
    });
  }

  function openInvoiceCreate() {
    if (!orderName || !detail?.canCreateSalesInvoice) {
      return;
    }

    requestLeaveConfirmation(() => {
      router.push({
        pathname: '/sales/invoice/create',
        params: {
          sourceName: orderName,
        },
      });
    });
  }

  function resetContactForm() {
    setDeliveryDateInput(detail?.deliveryDate ?? '');
    setContactDisplayInput(detail?.contactDisplay ?? detail?.contactPerson ?? '');
    setContactPhoneInput(detail?.contactPhone ?? '');
    setAddressInput(detail?.addressDisplay ?? '');
    clearSalesOrderDraftForm(orderDraftScope);
    setIsEditingContact(false);
  }

  function prepareAllEditingInputs(sourceDetail?: SalesOrderDetailV2 | null) {
    const baseDetail = sourceDetail ?? detail;
    const nextItems =
      baseDetail?.items.map((item) => ({
        itemCode: item.itemCode,
        itemName: item.itemName,
        qty: item.qty ?? 1,
        rate: item.rate,
        amount: item.amount,
        warehouse: item.warehouse,
        uom: item.uom,
        imageUrl: item.imageUrl,
        salesMode: normalizeSalesMode(item.salesMode),
        allUoms: item.allUoms,
        stockUom: item.stockUom,
        warehouseStockQty: null,
        warehouseStockUom: item.stockUom ?? null,
        wholesaleDefaultUom: item.wholesaleDefaultUom,
        retailDefaultUom: item.retailDefaultUom,
        salesProfiles: item.salesProfiles,
        priceSummary: item.priceSummary,
      })) ?? [];

    setDeliveryDateInput(baseDetail?.deliveryDate ?? '');
    setContactDisplayInput(baseDetail?.contactDisplay ?? baseDetail?.contactPerson ?? '');
    setContactPhoneInput(baseDetail?.contactPhone ?? '');
    setAddressInput(baseDetail?.addressDisplay ?? '');
    setRemarksInput(baseDetail?.remarks ?? '');
    setEditableItems(nextItems);
    syncScopedDraft(nextItems);
    updateSalesOrderDraftForm(
      buildScopedDraftForm(baseDetail, {
        deliveryDate: baseDetail?.deliveryDate ?? '',
        remarks: baseDetail?.remarks ?? '',
        shippingAddress: baseDetail?.addressDisplay ?? '',
        shippingContact: baseDetail?.contactDisplay ?? baseDetail?.contactPerson ?? '',
        shippingPhone: baseDetail?.contactPhone ?? '',
      }),
      orderDraftScope,
    );
  }

  function updateEditableItem(index: number, patch: Partial<EditableOrderItem>) {
    setEditableItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              ...patch,
              amount: (patch.rate ?? item.rate ?? 0) * (patch.qty ?? item.qty),
            }
          : item,
      ),
    );
  }

  function applyEditableItemSalesMode(index: number, nextMode: SalesMode) {
    setEditableItems((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        const defaults = buildModeDefaults(
          {
            ...item,
            ...(itemModeDefaults[item.itemCode] ?? {}),
          },
          nextMode,
        );

        return {
          ...item,
          salesMode: defaults.salesMode,
          uom: defaults.uom,
          rate: defaults.price ?? item.rate ?? 0,
          amount: (defaults.price ?? item.rate ?? 0) * item.qty,
        };
      }),
    );
  }

  function removeEditableItem(index: number) {
    setEditableItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function syncScopedDraft(nextItems: EditableOrderItem[]) {
    replaceSalesOrderDraft(
      nextItems.map((item) => ({
        draftKey: [item.itemCode, item.warehouse ?? ''].join('::'),
        itemCode: item.itemCode,
        itemName: item.itemName,
        nickname: item.nickname ?? null,
        specification: item.specification ?? null,
        imageUrl: item.imageUrl,
        qty: item.qty,
        price: item.rate,
        uom: item.uom,
        warehouse: item.warehouse,
        salesMode: item.salesMode,
        allUoms: item.allUoms,
        stockUom: item.stockUom,
        uomConversions: item.uomConversions,
        warehouseStockQty: item.warehouseStockQty,
        warehouseStockUom: item.warehouseStockUom,
        wholesaleDefaultUom: item.wholesaleDefaultUom,
        retailDefaultUom: item.retailDefaultUom,
        salesProfiles: item.salesProfiles,
        priceSummary: item.priceSummary,
      })),
      orderDraftScope,
    );
  }

  function syncScopedFormDraft(
    nextValues?: Partial<{
      deliveryDate: string;
      remarks: string;
      shippingAddress: string;
      shippingContact: string;
      shippingPhone: string;
    }>,
  ) {
    updateSalesOrderDraftForm(
      buildScopedDraftForm(detail, {
        deliveryDate: nextValues?.deliveryDate ?? deliveryDateInput,
        remarks: nextValues?.remarks ?? remarksInput,
        shippingAddress: nextValues?.shippingAddress ?? addressInput,
        shippingContact: nextValues?.shippingContact ?? contactDisplayInput,
        shippingPhone: nextValues?.shippingPhone ?? contactPhoneInput,
      }),
      orderDraftScope,
    );
  }

  function startEditingContact() {
    if (!requestEditEntry('contact')) {
      return;
    }
    setIsEditingItems(false);
    setIsEditingRemarks(false);
    setDeliveryDateInput(detail?.deliveryDate ?? '');
    setContactDisplayInput(detail?.contactDisplay ?? detail?.contactPerson ?? '');
    setContactPhoneInput(detail?.contactPhone ?? '');
    setAddressInput(detail?.addressDisplay ?? '');
    syncScopedFormDraft({
      deliveryDate: detail?.deliveryDate ?? '',
      shippingContact: detail?.contactDisplay ?? detail?.contactPerson ?? '',
      shippingPhone: detail?.contactPhone ?? '',
      shippingAddress: detail?.addressDisplay ?? '',
    });
    setIsEditingContact(true);
  }

  function startEditingItems() {
    if (!requestEditEntry('items')) {
      return;
    }
    setIsEditingContact(false);
    setIsEditingRemarks(false);
    const nextItems =
      detail?.items.map((item) => ({
        itemCode: item.itemCode,
        itemName: item.itemName,
        nickname: item.nickname ?? null,
        specification: item.specification ?? null,
        qty: item.qty ?? 1,
        rate: item.rate,
        amount: item.amount,
        warehouse: item.warehouse,
        uom: item.uom,
        imageUrl: item.imageUrl,
        salesMode: normalizeSalesMode(item.salesMode),
        allUoms: item.allUoms,
        stockUom: item.stockUom,
        uomConversions: [],
        warehouseStockQty: null,
        warehouseStockUom: item.stockUom ?? null,
        wholesaleDefaultUom: item.wholesaleDefaultUom,
        retailDefaultUom: item.retailDefaultUom,
        salesProfiles: item.salesProfiles,
        priceSummary: item.priceSummary,
      })) ?? [];
    setEditableItems(nextItems);
    syncScopedDraft(nextItems);
    setIsEditingItems(true);
  }

  function resetItemsForm() {
    setEditableItems(
      detail?.items.map((item) => ({
        itemCode: item.itemCode,
        itemName: item.itemName,
        nickname: item.nickname ?? null,
        specification: item.specification ?? null,
        qty: item.qty ?? 1,
        rate: item.rate,
        amount: item.amount,
        warehouse: item.warehouse,
        uom: item.uom,
        imageUrl: item.imageUrl,
        salesMode: normalizeSalesMode(item.salesMode),
        allUoms: item.allUoms,
        stockUom: item.stockUom,
        uomConversions: [],
        warehouseStockQty: null,
        warehouseStockUom: item.stockUom ?? null,
        wholesaleDefaultUom: item.wholesaleDefaultUom,
        retailDefaultUom: item.retailDefaultUom,
        salesProfiles: item.salesProfiles,
        priceSummary: item.priceSummary,
      })) ?? [],
    );
    clearSalesOrderDraft(orderDraftScope);
    setIsEditingItems(false);
  }

  async function handleSaveItems() {
    if (!orderName) {
      return;
    }

    try {
      setIsSavingItems(true);
      const itemUpdateResult = await updateSalesOrderItemsV2({
        orderName,
        items: editableItems.map((item) => ({
          itemCode: item.itemCode,
          qty: item.qty,
          price: item.rate,
          warehouse: item.warehouse,
          uom: item.uom,
          salesMode: item.salesMode,
        })),
      });

      if (itemUpdateResult.detail) {
        setDetail(itemUpdateResult.detail);
      }
      setIsEditingItems(false);
      clearSalesOrderDraft(orderDraftScope);

      if (itemUpdateResult.orderName !== orderName) {
        allowLeaveRef.current = true;
        showInfo(
          `商品修改已生效，系统已生成新订单 ${itemUpdateResult.orderName}，原订单 ${itemUpdateResult.sourceOrderName || orderName} 已作废。`,
        );
        router.replace({
          pathname: '/sales/order/[orderName]',
          params: { orderName: itemUpdateResult.orderName },
        });
      } else {
        showSuccess('商品明细已更新。');
      }
    } catch (error) {
      const appError = normalizeAppError(error, '商品保存失败。');
      showError(appError.message);
    } finally {
      setIsSavingItems(false);
    }
  }

  function startEditingRemarks() {
    if (!requestEditEntry('remarks')) {
      return;
    }
    setIsEditingContact(false);
    setIsEditingItems(false);
    setRemarksInput(detail?.remarks ?? '');
    syncScopedFormDraft({
      remarks: detail?.remarks ?? '',
    });
    setIsEditingRemarks(true);
  }

  function resetRemarksForm() {
    setRemarksInput(detail?.remarks ?? '');
    clearSalesOrderDraftForm(orderDraftScope);
    setIsEditingRemarks(false);
  }

  async function handleSaveRemarks() {
    if (!orderName) {
      return;
    }

    try {
      setIsSavingRemarks(true);
      const nextDetail = await updateSalesOrderV2({
        orderName,
        remarks: remarksInput,
      });
      setDetail(nextDetail);
      clearSalesOrderDraftForm(orderDraftScope);
      setIsEditingRemarks(false);
      showSuccess('订单备注已更新。');
    } catch (error) {
      const appError = normalizeAppError(error, '备注保存失败。');
      showError(appError.message);
    } finally {
      setIsSavingRemarks(false);
    }
  }

  function openProductSearch() {
    if (!orderName) {
      return;
    }

    syncScopedDraft(editableItems);
    syncScopedFormDraft();
    allowLeaveRef.current = true;
    router.push({
      pathname: '/common/product-search',
      params: {
        mode: 'order',
        draftScope: orderDraftScope,
        returnOrderName: orderName,
        resumeEdit: isEditingContact || isEditingRemarks ? 'all' : 'items',
        defaultSalesMode: detail?.defaultSalesMode ?? 'wholesale',
      },
    });
  }

  function openLatestDeliveryNote() {
    if (!detail?.latestDeliveryNote) {
      return;
    }

    requestLeaveConfirmation(() => {
      router.push({
        pathname: '/sales/delivery/create',
        params: {
          orderName: detail.name,
          deliveryNote: detail.latestDeliveryNote,
        },
      });
    });
  }

  function openLatestSalesInvoice() {
    if (!detail?.latestSalesInvoice) {
      return;
    }

    requestLeaveConfirmation(() => {
      router.push({
        pathname: '/sales/invoice/create',
        params: {
          sourceName: detail.name,
          salesInvoice: detail.latestSalesInvoice,
        },
      });
    });
  }

  function openPaymentEntry() {
    if (!detail?.latestSalesInvoice) {
      return;
    }

    requestLeaveConfirmation(() => {
      router.push({
        pathname: '/sales/payment/create',
        params: {
          referenceName: detail.latestSalesInvoice,
          defaultPaidAmount:
            detail.outstandingAmount != null
              ? String(detail.outstandingAmount)
              : detail.grandTotal != null
                ? String(detail.grandTotal)
                : '',
          currency: detail.currency || 'CNY',
        },
      });
    });
  }

  function resetAllForms() {
    clearSalesOrderDraftForm(orderDraftScope);
    resetContactForm();
    resetItemsForm();
    resetRemarksForm();
  }

  function getEditRestrictionMessage() {
    if (!detail) {
      return '';
    }

    if (detail.documentStatus === 'cancelled') {
      return '当前订单已作废，不能继续修改。';
    }

    if (detail.paymentStatus === 'paid' || (detail.paidAmount ?? 0) > 0) {
      return '当前订单已经进入收款或结算阶段，不能直接修改。若需调整，请先处理收款回退，再按业务单据链回退销售发票和发货单。';
    }

    if (detail.latestSalesInvoice) {
      return `当前订单已开票，不能直接修改。若需调整，请先作废销售发票 ${detail.latestSalesInvoice}，如有需要再继续回退发货单。`;
    }

    if (detail.latestDeliveryNote) {
      return `当前订单已出货，不能直接修改。若需调整，请先作废发货单 ${detail.latestDeliveryNote}。作废后库存会自动回退，再返回订单修改。`;
    }

    return '';
  }

  function getQuickRollbackPlan() {
    if (!detail || detail.documentStatus === 'cancelled') {
      return null;
    }

    const hasPayment = detail.paymentStatus === 'paid' || (detail.paidAmount ?? 0) > 0;
    const hasInvoice = Boolean(detail.latestSalesInvoice);
    const hasDelivery = Boolean(detail.latestDeliveryNote);

    if (!hasPayment && !hasInvoice && !hasDelivery) {
      return null;
    }

    const steps: string[] = [];
    if (hasPayment) {
      steps.push('先回退收款');
    }
    if (hasInvoice) {
      steps.push(`再作废销售发票 ${detail.latestSalesInvoice}`);
    }
    if (hasDelivery) {
      steps.push(`最后作废发货单 ${detail.latestDeliveryNote}`);
    }

    return {
      title: '需先回退下游单据',
      message: hasPayment
        ? `当前订单已经进入收款或结算阶段，不能直接修改。系统将按顺序${steps.join('、')}，完成后直接回到订单编辑态。`
        : hasInvoice
          ? `当前订单已开票，不能直接修改。系统将按顺序${steps.join('、')}，完成后直接回到订单编辑态。`
          : `当前订单已出货，不能直接修改。系统将${steps.join('、')}，库存回退后直接回到订单编辑态。`,
      confirmLabel: hasPayment ? '一键回退并修改' : '回退并修改',
    };
  }

  function getCancelRestrictionMessage() {
    if (!detail) {
      return '';
    }

    if (detail.documentStatus === 'cancelled') {
      return '当前订单已作废，无需重复处理。';
    }

    if (detail.paymentStatus === 'paid' || (detail.paidAmount ?? 0) > 0) {
      return '当前订单已经进入收款或结算阶段，不能直接作废。请先处理收款回退，再按顺序回退销售发票和发货单。';
    }

    if (detail.latestSalesInvoice) {
      return `当前订单已开票，不能直接作废。请先作废销售发票 ${detail.latestSalesInvoice}，再根据需要处理发货单与订单。`;
    }

    if (detail.latestDeliveryNote) {
      return `当前订单已出货，不能直接作废。请先作废发货单 ${detail.latestDeliveryNote}，库存回退后再处理订单。`;
    }

    return '';
  }

  function ensureOrderEditable() {
    const editRestriction = getEditRestrictionMessage();
    if (!editRestriction) {
      return true;
    }

    setCenterDialog({
      title: '当前订单不可编辑',
      message: editRestriction,
      tone: 'warning',
    });
    return false;
  }

  function enterEditMode(mode: EditEntryMode, sourceDetail?: SalesOrderDetailV2 | null) {
    if (mode === 'all') {
      prepareAllEditingInputs(sourceDetail);
      setIsEditingContact(true);
      setIsEditingItems(true);
      setIsEditingRemarks(true);
      return;
    }

    if (mode === 'contact') {
      setIsEditingItems(false);
      setIsEditingRemarks(false);
      setDeliveryDateInput(sourceDetail?.deliveryDate ?? detail?.deliveryDate ?? '');
      setContactDisplayInput(sourceDetail?.contactDisplay ?? sourceDetail?.contactPerson ?? detail?.contactDisplay ?? detail?.contactPerson ?? '');
      setContactPhoneInput(sourceDetail?.contactPhone ?? detail?.contactPhone ?? '');
      setAddressInput(sourceDetail?.addressDisplay ?? detail?.addressDisplay ?? '');
      setIsEditingContact(true);
      return;
    }

    if (mode === 'items') {
      setIsEditingContact(false);
      setIsEditingRemarks(false);
      const nextItems =
        (sourceDetail ?? detail)?.items.map((item) => ({
          itemCode: item.itemCode,
          itemName: item.itemName,
          nickname: item.nickname ?? null,
          specification: item.specification ?? null,
          qty: item.qty ?? 1,
          rate: item.rate,
          amount: item.amount,
          warehouse: item.warehouse,
          uom: item.uom,
          imageUrl: item.imageUrl,
          salesMode: normalizeSalesMode(item.salesMode),
          allUoms: item.allUoms,
          stockUom: item.stockUom,
          wholesaleDefaultUom: item.wholesaleDefaultUom,
          retailDefaultUom: item.retailDefaultUom,
          salesProfiles: item.salesProfiles,
          priceSummary: item.priceSummary,
        })) ?? [];
      setEditableItems(nextItems);
      syncScopedDraft(nextItems);
      setIsEditingItems(true);
      return;
    }

    setIsEditingContact(false);
    setIsEditingItems(false);
    setRemarksInput(sourceDetail?.remarks ?? detail?.remarks ?? '');
    setIsEditingRemarks(true);
  }

  async function handleQuickRollbackAndEdit(mode: EditEntryMode) {
    if (!orderName) {
      return;
    }

    try {
      setIsQuickRollingBack(true);
      const rollbackResult = await quickCancelSalesOrderV2(orderName, { rollbackPayment: true });
      const nextDetail = rollbackResult.detail;
      if (nextDetail) {
        setDetail(nextDetail);
        enterEditMode(mode, nextDetail);
      } else {
        enterEditMode(mode);
      }

      const rollbackSummary = [
        rollbackResult.cancelledPaymentEntries.length
          ? `已回退收款 ${rollbackResult.cancelledPaymentEntries.join('、')}`
          : '',
        rollbackResult.cancelledSalesInvoice ? `已作废发票 ${rollbackResult.cancelledSalesInvoice}` : '',
        rollbackResult.cancelledDeliveryNote ? `已作废发货单 ${rollbackResult.cancelledDeliveryNote}` : '',
      ]
        .filter(Boolean)
        .join('，');

      showSuccess(rollbackSummary ? `${rollbackSummary}，现在可以继续修改订单。` : '下游单据已回退，现在可以继续修改订单。');
    } catch (error) {
      const appError = normalizeAppError(error, '快捷回退失败。');
      showError(appError.message);
    } finally {
      setIsQuickRollingBack(false);
    }
  }

  function requestEditEntry(mode: EditEntryMode) {
    const rollbackPlan = getQuickRollbackPlan();
    if (rollbackPlan) {
      setCenterDialog({
        title: rollbackPlan.title,
        message: rollbackPlan.message,
        tone: 'warning',
        confirmLabel: rollbackPlan.confirmLabel,
        confirmTone: 'primary',
        onConfirm: () => {
          void handleQuickRollbackAndEdit(mode);
        },
      });
      return false;
    }

    if (!ensureOrderEditable()) {
      return false;
    }

    return true;
  }

  function startEditingAll() {
    if (!requestEditEntry('all')) {
      return;
    }
    enterEditMode('all');
  }

  function openPrintPreview() {
    if (!detail?.name) {
      showError('缺少销售订单号。');
      return;
    }

    router.push({
      pathname: '/sales/order/preview',
      params: { salesOrder: detail.name },
    });
  }

  const workflowAction = detail?.canSubmitDelivery
    ? {
        label: '出货',
        onPress: openDeliveryCreate,
        disabled: isCancelling,
        tone: 'primary' as const,
      }
      : detail?.canCreateSalesInvoice
      ? {
          label: '开票',
          onPress: openInvoiceCreate,
          disabled: isCancelling,
          tone: 'primary' as const,
        }
      : detail?.canRecordPayment && detail?.latestSalesInvoice
      ? {
          label: '收款',
          onPress: openPaymentEntry,
          disabled: isCancelling,
          tone: 'primary' as const,
        }
      : detail?.latestSalesInvoice
      ? {
          label: '查看发票',
          onPress: openLatestSalesInvoice,
          disabled: false,
          tone: 'ghost' as const,
        }
      : detail?.latestDeliveryNote
      ? {
          label: '查看发货单',
          onPress: openLatestDeliveryNote,
          disabled: false,
          tone: 'ghost' as const,
        }
      : {
          label: '操作',
          onPress: startEditingContact,
          disabled: detail?.documentStatus === 'cancelled',
          tone: 'ghost' as const,
        };

  async function handleSaveAll() {
    if (!orderName) {
      return;
    }

    if (!isValidIsoDate(deliveryDateInput)) {
      showError('请先选择有效交货日期。');
      return;
    }

    try {
      setIsSavingContact(true);
      setIsSavingItems(true);
      setIsSavingRemarks(true);

      const nextDetail = await updateSalesOrderV2({
        orderName,
        deliveryDate: deliveryDateInput,
        remarks: remarksInput,
        contactDisplay: contactDisplayInput,
        contactPhone: contactPhoneInput,
        shippingAddressText: addressInput,
      });

      let finalDetail = nextDetail;
      const itemUpdateResult = await updateSalesOrderItemsV2({
        orderName,
        items: editableItems.map((item) => ({
          itemCode: item.itemCode,
          qty: item.qty,
          price: item.rate,
          warehouse: item.warehouse,
          uom: item.uom,
          salesMode: item.salesMode,
        })),
      });

      if (itemUpdateResult.detail) {
        finalDetail = itemUpdateResult.detail;
      }

      setDetail(finalDetail);
      setIsEditingContact(false);
      setIsEditingItems(false);
      setIsEditingRemarks(false);
      clearSalesOrderDraft(orderDraftScope);
      clearSalesOrderDraftForm(orderDraftScope);

      if (itemUpdateResult.orderName !== orderName) {
        allowLeaveRef.current = true;
        showInfo(
          `订单修改已生效，系统已生成新订单 ${itemUpdateResult.orderName}，原订单 ${itemUpdateResult.sourceOrderName || orderName} 已作废。`,
        );
        router.replace({
          pathname: '/sales/order/[orderName]',
          params: { orderName: itemUpdateResult.orderName },
        });
      } else {
        showSuccess('订单修改已保存。');
      }
    } catch (error) {
      const appError = normalizeAppError(error, '订单保存失败。');
      showError(appError.message);
    } finally {
      setIsSavingContact(false);
      setIsSavingItems(false);
      setIsSavingRemarks(false);
    }
  }

  const currentSaveHandler = isEditingAllSections
    ? handleSaveAll
    : isEditingItems
      ? handleSaveItems
      : isEditingRemarks
        ? handleSaveRemarks
        : handleSaveContact;
  const currentCancelHandler = isEditingAllSections
    ? resetAllForms
    : isEditingItems
      ? resetItemsForm
      : isEditingRemarks
        ? resetRemarksForm
        : resetContactForm;
  const currentSaveLabel = isEditingAllSections
    ? isSavingCurrentSection
      ? '保存订单中...'
      : '保存修改'
    : isEditingItems
      ? isSavingItems
        ? '保存商品中...'
        : '保存修改'
      : isEditingRemarks
        ? isSavingRemarks
          ? '保存备注中...'
          : '保存修改'
        : isSavingContact
          ? '保存信息中...'
          : '保存修改';

  function stepEditableItemQty(index: number, delta: number) {
    setEditableItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              qty: Math.max(1, item.qty + delta),
              amount: (item.rate ?? 0) * Math.max(1, item.qty + delta),
            }
          : item,
      ),
    );
  }

  return (
    <SafeAreaView edges={[]} style={[styles.screen, { backgroundColor: background }]}>
      <MobilePageHeader
        onBack={() => {
          requestLeaveConfirmation(() => returnToSalesHome());
        }}
        rightAction={
          isEditingAnySection ? (
            <View style={styles.headerActionPlaceholder} />
          ) : (
            <Pressable
              accessibilityRole="button"
              disabled={workflowAction.disabled}
              onPress={workflowAction.onPress}
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
        sideWidth={96}
        showBack
        title="销售单详情"
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator>
        <View style={[styles.heroCard, { backgroundColor: surface, borderColor }]}>
          <View style={styles.heroGlowBlue} />
          <View style={styles.heroGlowAmber} />
          <View style={styles.heroHeader}>
            <View style={styles.heroCopy}>
              <ThemedText style={styles.heroEyebrow}>SALES ORDER</ThemedText>
              <ThemedText style={styles.heroTitle} type="defaultSemiBold">
                {detail?.customer || '销售客户'}
              </ThemedText>
              <ThemedText style={styles.heroSubline}>{detail?.name || orderName || '—'}</ThemedText>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusTone.backgroundColor }]}>
              <ThemedText style={[styles.statusBadgeText, { color: statusTone.color }]} type="defaultSemiBold">
                {businessStatus}
              </ThemedText>
            </View>
          </View>

          <View style={styles.heroMetrics}>
            <View style={styles.metricCard}>
              <ThemedText style={styles.metricLabel}>订单金额</ThemedText>
              <ThemedText style={styles.metricValue} type="defaultSemiBold">
                {formatCurrencyValue(detail?.grandTotal ?? null, detail?.currency || 'CNY')}
              </ThemedText>
            </View>
            <View style={styles.metricCard}>
              <ThemedText style={styles.metricLabel}>未收金额</ThemedText>
              <ThemedText style={styles.metricValue} type="defaultSemiBold">
                {formatCurrencyValue(detail?.outstandingAmount ?? null, detail?.currency || 'CNY')}
              </ThemedText>
            </View>
            <View style={styles.metricCard}>
              <ThemedText style={styles.metricLabel}>下单日期</ThemedText>
              <ThemedText style={styles.metricValueSmall} type="defaultSemiBold">
                {detail?.transactionDate || '—'}
              </ThemedText>
            </View>
          </View>

          {!isEditingAnySection && detail ? (
            <View style={styles.heroUtilityRow}>
              <Pressable onPress={openPrintPreview} style={styles.heroUtilityButton}>
                <ThemedText style={styles.heroUtilityButtonText} type="defaultSemiBold">
                  打印预览
                </ThemedText>
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
          <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
            订单概览
          </ThemedText>
          <View style={styles.overviewGrid}>
            <View style={styles.overviewCard}>
              <ThemedText style={styles.overviewLabel}>公司</ThemedText>
              <ThemedText numberOfLines={1} style={styles.overviewValue} type="defaultSemiBold">
                {detail?.company || '—'}
              </ThemedText>
            </View>
            <View style={styles.overviewCard}>
              <ThemedText style={styles.overviewLabel}>交货日期</ThemedText>
              <ThemedText numberOfLines={1} style={styles.overviewValue} type="defaultSemiBold">
                {detail?.deliveryDate || '未设置'}
              </ThemedText>
            </View>
            <View style={styles.overviewCard}>
              <ThemedText style={styles.overviewLabel}>单据状态</ThemedText>
              <ThemedText
                numberOfLines={1}
                style={[styles.overviewValue, { color: getStatusValueColor(detail?.documentStatus || '', 'document') }]}
                type="defaultSemiBold">
                {getDocumentStatusLabel(detail?.documentStatus || '')}
              </ThemedText>
            </View>
            <View style={styles.overviewCard}>
              <ThemedText style={styles.overviewLabel}>履约状态</ThemedText>
              <ThemedText
                numberOfLines={1}
                style={[styles.overviewValue, { color: getStatusValueColor(detail?.fulfillmentStatus || '', 'fulfillment') }]}
                type="defaultSemiBold">
                {getFulfillmentStatusLabel(detail?.fulfillmentStatus || '')}
              </ThemedText>
            </View>
            <View style={styles.overviewCard}>
              <ThemedText style={styles.overviewLabel}>发货状态</ThemedText>
              <ThemedText
                numberOfLines={1}
                style={[styles.overviewValue, { color: getStatusValueColor(detail?.deliveryStatus || '', 'delivery') }]}
                type="defaultSemiBold">
                {getDeliveryStatusLabel(detail?.deliveryStatus || '')}
              </ThemedText>
            </View>
            <View style={styles.overviewCard}>
              <ThemedText style={styles.overviewLabel}>收款状态</ThemedText>
              <ThemedText
                numberOfLines={1}
                style={[styles.overviewValue, { color: getStatusValueColor(detail?.paymentStatus || '', 'payment') }]}
                type="defaultSemiBold">
                {getPaymentStatusLabel(detail?.paymentStatus || '')}
              </ThemedText>
            </View>
          </View>
        </View>

        {detail?.latestDeliveryNote || detail?.latestSalesInvoice ? (
          <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
            <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
              业务单据
            </ThemedText>

            {detail.latestDeliveryNote ? (
              <View style={[styles.referenceRow, { borderColor }]}>
                <View style={styles.referenceCopy}>
                  <ThemedText style={styles.referenceLabel}>发货单</ThemedText>
                  <ThemedText style={styles.referenceValue} type="defaultSemiBold">
                    {detail.latestDeliveryNote}
                  </ThemedText>
                </View>
                <Pressable onPress={openLatestDeliveryNote} style={styles.linkButton}>
                  <ThemedText style={[styles.linkButtonText, { color: tintColor }]} type="defaultSemiBold">
                    查看
                  </ThemedText>
                </Pressable>
              </View>
            ) : null}

            {detail.latestSalesInvoice ? (
              <View style={[styles.referenceRow, { borderColor }]}>
                <View style={styles.referenceCopy}>
                  <ThemedText style={styles.referenceLabel}>销售发票</ThemedText>
                  <ThemedText style={styles.referenceValue} type="defaultSemiBold">
                    {detail.latestSalesInvoice}
                  </ThemedText>
                </View>
                <Pressable onPress={openLatestSalesInvoice} style={styles.linkButton}>
                  <ThemedText style={[styles.linkButtonText, { color: tintColor }]} type="defaultSemiBold">
                    查看
                  </ThemedText>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}

        {(recentPaymentNotice && ((recentPaymentNotice.unallocatedAmount ?? 0) > 0 || (recentPaymentNotice.writeoffAmount ?? 0) > 0)) ||
        ((detail?.latestUnallocatedAmount ?? 0) > 0 || (detail?.latestWriteoffAmount ?? 0) > 0) ? (
          <View style={[styles.card, styles.paymentNoticeCard, { backgroundColor: surface, borderColor }]}>
            <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
              最新收款结果
            </ThemedText>
            {((recentPaymentNotice?.unallocatedAmount ?? 0) > 0 || (detail?.latestUnallocatedAmount ?? 0) > 0) ? (
              <ThemedText style={styles.paymentNoticeText}>
                本单已按应收金额结清，另有{' '}
                <ThemedText style={styles.paymentNoticeEmphasis} type="defaultSemiBold">
                  {formatCurrencyValue(
                    recentPaymentNotice?.unallocatedAmount ?? detail?.latestUnallocatedAmount ?? 0,
                    detail?.currency || 'CNY',
                  )}
                </ThemedText>{' '}
                作为未分配金额保留，可用于后续预收或其他单据核销。
              </ThemedText>
            ) : (
              <ThemedText style={styles.paymentNoticeText}>
                本单已按差额核销结清，已处理差额{' '}
                <ThemedText style={styles.paymentNoticeEmphasis} type="defaultSemiBold">
                  {formatCurrencyValue(
                    recentPaymentNotice?.writeoffAmount ?? detail?.latestWriteoffAmount ?? 0,
                    detail?.currency || 'CNY',
                  )}
                </ThemedText>
                。
              </ThemedText>
            )}
          </View>
        ) : null}

        <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
              收货与联系人
            </ThemedText>
            <Pressable onPress={isEditingContact ? resetContactForm : startEditingContact} style={styles.linkButton}>
              <ThemedText style={[styles.linkButtonText, { color: tintColor }]} type="defaultSemiBold">
                {isEditingContact ? '取消' : '修改'}
              </ThemedText>
            </Pressable>
          </View>

          {isEditingContact ? (
            <View style={styles.formBlock}>
              <View style={[styles.editField, { backgroundColor: surfaceMuted, borderColor }]}>
                <ThemedText style={styles.editFieldLabel}>收货人 / 联系展示名</ThemedText>
                <TextInput
                  onChangeText={setContactDisplayInput}
                  placeholder="输入收货人"
                  placeholderTextColor="#9AA3B2"
                  style={styles.editInput}
                  value={contactDisplayInput}
                />
              </View>

              <View style={[styles.editField, { backgroundColor: surfaceMuted, borderColor }]}>
                <ThemedText style={styles.editFieldLabel}>联系电话</ThemedText>
                <TextInput
                  onChangeText={setContactPhoneInput}
                  placeholder="输入联系电话"
                  placeholderTextColor="#9AA3B2"
                  style={styles.editInput}
                  value={contactPhoneInput}
                />
              </View>

              <View style={[styles.editField, { backgroundColor: surfaceMuted, borderColor }]}>
                <DateFieldInput
                  errorText={!isValidIsoDate(deliveryDateInput) ? '请选择有效交货日期。' : undefined}
                  helperText="交货日期会同步写回销售订单头部。"
                  label="交货日期"
                  onChange={setDeliveryDateInput}
                  value={deliveryDateInput}
                />
              </View>

              <View style={[styles.editField, styles.textareaField, { backgroundColor: surfaceMuted, borderColor }]}>
                <ThemedText style={styles.editFieldLabel}>收货地址快照</ThemedText>
                <TextInput
                  multiline
                  numberOfLines={4}
                  onChangeText={setAddressInput}
                  placeholder="输入本单收货地址"
                  placeholderTextColor="#9AA3B2"
                  style={[styles.editInput, styles.textareaInput]}
                  textAlignVertical="top"
                  value={addressInput}
                />
              </View>

            </View>
          ) : (
            <View style={styles.infoStack}>
              <InfoRow label="收货人" value={detail?.contactDisplay || detail?.contactPerson || '未配置'} />
              <InfoRow label="联系电话" value={detail?.contactPhone || '未配置'} />
              <InfoRow label="收货地址" value={detail?.addressDisplay || '未配置收货地址'} />
            </View>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
              销售商品
            </ThemedText>
            <Pressable onPress={isEditingItems ? resetItemsForm : startEditingItems} style={styles.linkButton}>
              <ThemedText style={[styles.linkButtonText, { color: tintColor }]} type="defaultSemiBold">
                {isEditingItems ? '取消' : '修改商品'}
              </ThemedText>
            </Pressable>
          </View>

          {isEditingItems ? (
            <View style={styles.quickActionsCard}>
              <Pressable
                onPress={openProductSearch}
                style={[styles.quickActionButton, { backgroundColor: surfaceMuted, borderColor }]}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: surfaceMuted }]}>
                  <IconSymbol color={tintColor} name="cart.fill.badge.plus" size={18} />
                </View>
                <View style={styles.quickActionCopy}>
                  <ThemedText style={styles.quickActionLabel} type="defaultSemiBold">
                    添加或替换商品
                  </ThemedText>
                  <ThemedText style={styles.quickActionHint}>和创建订单一样，从专门搜索页选择商品</ThemedText>
                </View>
                <IconSymbol color={tintColor} name="chevron.right" size={18} />
              </Pressable>
            </View>
          ) : null}
          <View style={styles.goodsList}>
            {detail?.items?.length ? (
              groupedDisplayItems.map((group) => (
                <SalesOrderItemEditor
                  imageUrl={group.rows[0]?.item.imageUrl}
                  itemCode={group.itemCode}
                  itemName={group.itemName}
                  nickname={group.nickname ?? null}
                  specification={group.specification ?? null}
                  key={group.itemCode}
                  groupedSummaryLabel={`共 ${group.rows.length} 个仓库条目，合计 ${buildQuantityComposition(group.rows.map(({ item }) => item))}`}
                  groupedLines={group.rows.map(({ item, index }) => {
                    if (isEditingItems) {
                      const editableItem = item as EditableOrderItem;
                      const itemDefaults = itemModeDefaults[editableItem.itemCode] ?? {};
                      const effectivePriceSummary = editableItem.priceSummary ?? itemDefaults.priceSummary ?? null;
                      const effectiveWholesaleDefaultUom =
                        editableItem.wholesaleDefaultUom ?? itemDefaults.wholesaleDefaultUom ?? null;
                      const effectiveRetailDefaultUom =
                        editableItem.retailDefaultUom ?? itemDefaults.retailDefaultUom ?? null;
                      const warehouseStockDisplay = buildWarehouseStockDisplay({
                        warehouseStockQty: editableItem.warehouseStockQty,
                        warehouseStockUom: editableItem.warehouseStockUom ?? editableItem.stockUom,
                        warehouseStockUomDisplay:
                          editableItem.warehouseStockUomDisplay ?? editableItem.stockUomDisplay,
                        qty: editableItem.qty,
                        uom: editableItem.uom,
                        stockUom: editableItem.stockUom,
                        uomConversions: editableItem.uomConversions,
                      });

                      return {
                        key: `${editableItem.itemCode}-${editableItem.warehouse}-${index}`,
                        warehouse: editableItem.warehouse,
                        salesMode: editableItem.salesMode,
                        uom: editableItem.uom,
                        uomDisplay: editableItem.uomDisplay,
                        wholesaleReferenceLabel: formatModeReference(
                          '批发',
                          effectivePriceSummary?.wholesaleRate ?? null,
                          effectiveWholesaleDefaultUom,
                          editableItem.wholesaleDefaultUomDisplay ?? null,
                          detail?.currency || 'CNY',
                        ),
                        retailReferenceLabel: formatModeReference(
                          '零售',
                          effectivePriceSummary?.retailRate ?? null,
                          effectiveRetailDefaultUom,
                          editableItem.retailDefaultUomDisplay ?? null,
                          detail?.currency || 'CNY',
                        ),
                        warehouseStockLabel: warehouseStockDisplay?.label ?? null,
                        warehouseStockTone: warehouseStockDisplay?.tone ?? 'default',
                        conversionSummary: buildLineUnitSummary({
                          salesMode: editableItem.salesMode,
                          uom: editableItem.uom,
                          uomDisplay: editableItem.uomDisplay,
                          stockUom: editableItem.stockUom,
                          stockUomDisplay: editableItem.stockUomDisplay,
                        }),
                        stockReferenceSummary:
                          editableItem.stockUom
                            ? `库存结算单位：${resolveDisplayUom(editableItem.stockUom, editableItem.stockUomDisplay)}`
                            : null,
                        lineAmountLabel: formatCurrencyValue(
                          ((editableItem.rate ?? 0) * editableItem.qty),
                          detail?.currency || 'CNY',
                        ),
                        priceText: editableItem.rate == null ? '' : String(editableItem.rate),
                        qty: editableItem.qty,
                        onChangePrice: (value: string) =>
                          updateEditableItem(index, {
                            rate: value.trim() ? Number(value) || 0 : null,
                          }),
                        onChangeQty: (value: string) =>
                          updateEditableItem(index, {
                            qty: Math.max(1, Number(value.replace(/[^0-9]/g, '')) || 1),
                          }),
                        onChangeSalesMode: (nextMode: SalesMode) => applyEditableItemSalesMode(index, nextMode),
                        onDecreaseQty: () => stepEditableItemQty(index, -1),
                        onIncreaseQty: () => stepEditableItemQty(index, 1),
                        onRemove: () => removeEditableItem(index),
                      };
                    }

                    return {
                      key: `${item.itemCode}-${item.warehouse}-${index}`,
                      readOnly: true,
                      warehouse: item.warehouse || '未指定仓库',
                      salesMode: normalizeSalesMode(item.salesMode),
                      uom: item.uom,
                      uomDisplay: item.uomDisplay ?? null,
                      wholesaleReferenceLabel: '',
                      retailReferenceLabel: '',
                      warehouseStockLabel: null,
                      conversionSummary: buildLineUnitSummary({
                        salesMode: normalizeSalesMode(item.salesMode),
                        uom: item.uom,
                        uomDisplay: item.uomDisplay ?? null,
                        stockUom: item.stockUom ?? null,
                        stockUomDisplay: item.stockUomDisplay ?? null,
                      }),
                      stockReferenceSummary: null,
                      lineAmountLabel: formatCurrencyValue(item.amount, detail?.currency || 'CNY'),
                      priceText: item.rate == null ? '' : String(item.rate),
                      qty: item.qty ?? 1,
                      onChangePrice: () => {},
                      onChangeQty: () => {},
                      onChangeSalesMode: () => {},
                      onDecreaseQty: () => {},
                      onIncreaseQty: () => {},
                      onRemove: () => {},
                    };
                  })}
                  lineAmountLabel={formatCurrencyValue(group.totalAmount, detail?.currency || 'CNY')}
                  onChangePrice={() => {}}
                  onChangeQty={() => {}}
                  onChangeSalesMode={() => {}}
                  onDecreaseQty={() => {}}
                  onIncreaseQty={() => {}}
                  onRemove={() => {}}
                  priceText=""
                  qty={group.totalQty}
                  retailReferenceLabel=""
                  salesMode="wholesale"
                  uom={null}
                  warehouse=""
                  wholesaleReferenceLabel=""
                />
              ))
            ) : (
              <ThemedText style={styles.emptyText}>暂无商品明细</ThemedText>
            )}
          </View>

          <View style={[styles.divider, { backgroundColor: borderColor }]} />
          <InfoRow label="商品概览" value={orderQuantitySummary} />
        </View>

        <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
          <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
            金额结算
          </ThemedText>
          <InfoRow
            label="订单金额"
            value={formatCurrencyValue(detail?.grandTotal ?? null, detail?.currency || 'CNY')}
            valueColor="#475569"
          />
          <InfoRow
            label="实收金额"
            value={formatCurrencyValue(detail?.actualPaidAmount ?? null, detail?.currency || 'CNY')}
            valueColor="#15803D"
          />
          {(detail?.latestUnallocatedAmount ?? 0) > 0 ? (
            <InfoRow
              label="额外收款"
              value={formatCurrencyValue(detail?.latestUnallocatedAmount ?? null, detail?.currency || 'CNY')}
              valueColor="#2563EB"
            />
          ) : null}
          {(detail?.totalWriteoffAmount ?? 0) > 0 ? (
            <InfoRow
              label="核销金额"
              value={formatCurrencyValue(detail?.totalWriteoffAmount ?? null, detail?.currency || 'CNY')}
              valueColor="#D97706"
            />
          ) : null}
          <InfoRow
            label="未收金额"
            value={formatCurrencyValue(detail?.outstandingAmount ?? null, detail?.currency || 'CNY')}
            valueColor={(detail?.outstandingAmount ?? 0) > 0 ? '#DC2626' : '#64748B'}
          />
          {isEditingItems ? (
            <InfoRow label="商品编辑后金额" value={formatCurrencyValue(editingGrandTotal, detail?.currency || 'CNY')} />
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
              订单备注
            </ThemedText>
            <Pressable onPress={isEditingRemarks ? resetRemarksForm : startEditingRemarks} style={styles.linkButton}>
              <ThemedText style={[styles.linkButtonText, { color: tintColor }]} type="defaultSemiBold">
                {isEditingRemarks ? '取消' : '修改'}
              </ThemedText>
            </Pressable>
          </View>
          {isEditingRemarks ? (
            <View>
              <View style={[styles.editField, styles.textareaField, { backgroundColor: surfaceMuted, borderColor }]}>
                <ThemedText style={styles.editFieldLabel}>本单备注</ThemedText>
                <TextInput
                  multiline
                  numberOfLines={5}
                  onChangeText={setRemarksInput}
                  placeholder="输入订单备注"
                  placeholderTextColor="#9AA3B2"
                  style={[styles.editInput, styles.textareaInput]}
                  textAlignVertical="top"
                  value={remarksInput}
                />
              </View>
            </View>
          ) : (
            <ThemedText style={styles.noteText}>{detail?.remarks || '暂无备注'}</ThemedText>
          )}
        </View>

        {message ? <ThemedText style={styles.messageText}>{message}</ThemedText> : null}
      </ScrollView>

      <View style={[styles.bottomBar, { backgroundColor: background, borderTopColor: borderColor }]}>
        <View style={styles.bottomSummaryStrip}>
          <View style={styles.bottomAmountRow}>
            <ThemedText style={styles.bottomSummaryAmountLabel} type="defaultSemiBold">
              {isEditingAnySection ? '修改后金额：' : '订单金额：'}
            </ThemedText>
            <ThemedText style={styles.bottomSummaryAmount} type="defaultSemiBold">
              {formatCurrencyValue(
                isEditingItems ? editingGrandTotal : detail?.grandTotal ?? null,
                detail?.currency || 'CNY',
              )}
            </ThemedText>
          </View>
          <ThemedText style={styles.bottomSummaryPrimary} type="defaultSemiBold">
            {orderQuantitySummary}
          </ThemedText>
        </View>

        <View style={styles.bottomActionsRow}>
          {isEditingAnySection ? (
            <>
              <Pressable
                accessibilityRole="button"
                disabled={isSavingCurrentSection}
                onPress={currentCancelHandler}
                style={[styles.bottomButton, styles.bottomGhostButton, { borderColor }]}
              >
                <ThemedText style={styles.bottomGhostText}>取消修改</ThemedText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={isSavingCurrentSection}
                onPress={currentSaveHandler}
                style={[styles.bottomButton, styles.bottomPrimaryButton]}
              >
                <ThemedText style={styles.bottomPrimaryText}>{currentSaveLabel}</ThemedText>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable
                accessibilityRole="button"
                disabled={isCancelling}
                onPress={confirmCancelOrder}
                style={[styles.bottomButton, styles.bottomDangerButton]}
              >
                <ThemedText style={styles.bottomDangerText}>
                  {isCancelling ? '作废中...' : detail?.documentStatus === 'cancelled' ? '已作废' : '作废订单'}
                </ThemedText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={isCancelling || isQuickRollingBack}
                onPress={startEditingAll}
                style={[styles.bottomButton, styles.bottomPrimaryButton]}
              >
                <ThemedText style={styles.bottomPrimaryText}>
                  {isQuickRollingBack
                    ? '回退中...'
                    : getQuickRollbackPlan()
                      ? '回退并修改'
                      : '编辑订单'}
                </ThemedText>
              </Pressable>
            </>
          )}
        </View>
      </View>

      <Modal animationType="fade" onRequestClose={() => setCenterDialog(null)} transparent visible={Boolean(centerDialog)}>
        <View style={styles.dialogBackdrop}>
          <View style={[styles.dialogCard, { backgroundColor: surface, borderColor }]}>
            <ThemedText
              style={[
                styles.dialogTitle,
                centerDialog?.tone === 'danger'
                  ? styles.dialogTitleDanger
                  : centerDialog?.tone === 'warning'
                    ? styles.dialogTitleWarning
                    : styles.dialogTitleInfo,
              ]}
              type="defaultSemiBold"
            >
              {centerDialog?.title}
            </ThemedText>
            <HighlightedDialogMessage message={centerDialog?.message || ''} tone={centerDialog?.tone || 'info'} />

            <View style={styles.dialogActions}>
              <Pressable
                onPress={() => setCenterDialog(null)}
                style={[styles.dialogButton, styles.dialogGhostButton, { borderColor }]}
              >
                <ThemedText style={styles.dialogGhostText} type="defaultSemiBold">
                  {centerDialog?.onConfirm ? '取消' : '知道了'}
                </ThemedText>
              </Pressable>

              {centerDialog?.onConfirm ? (
                <Pressable
                  onPress={() => {
                    const onConfirm = centerDialog.onConfirm;
                    setCenterDialog(null);
                    onConfirm?.();
                  }}
                  style={[
                    styles.dialogButton,
                    centerDialog.confirmTone === 'danger' ? styles.dialogDangerButton : styles.dialogPrimaryButton,
                  ]}
                >
                  <ThemedText style={styles.dialogPrimaryText} type="defaultSemiBold">
                    {centerDialog.confirmLabel || '确认'}
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>

      <Modal animationType="fade" onRequestClose={() => setShowLeaveConfirm(false)} transparent visible={showLeaveConfirm}>
        <View style={styles.dialogBackdrop}>
          <View style={[styles.dialogCard, { backgroundColor: surface, borderColor }]}>
            <ThemedText style={[styles.dialogTitle, styles.dialogTitleWarning]} type="defaultSemiBold">
              当前修改尚未保存
            </ThemedText>
            <HighlightedDialogMessage
              message="你正在编辑订单内容，当前修改还没有保存。现在离开会放弃本次修改。"
              tone="warning"
            />

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
                    navigation.dispatch(pendingAction);
                  } else if (pendingCallback) {
                    pendingCallback();
                  } else {
                    returnToSalesHome();
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    gap: 14,
    paddingBottom: 156,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  headerActionPlaceholder: {
    width: 96,
  },
  headerActionButton: {
    alignItems: 'center',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 32,
    minWidth: 64,
    paddingHorizontal: 10,
  },
  headerActionGhostButton: {
    backgroundColor: 'transparent',
  },
  headerActionPrimaryButton: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  headerActionGhostText: {
    color: '#2563EB',
    fontSize: 16,
  },
  headerActionPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13,
  },
  pageTitle: {
    flex: 1,
    fontSize: 20,
    textAlign: 'center',
  },
  heroCard: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 16,
    overflow: 'hidden',
    padding: 16,
    position: 'relative',
  },
  heroGlowBlue: {
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderRadius: 999,
    height: 180,
    position: 'absolute',
    right: -72,
    top: -64,
    width: 180,
  },
  heroGlowAmber: {
    backgroundColor: 'rgba(251,191,36,0.14)',
    borderRadius: 999,
    height: 108,
    left: -26,
    position: 'absolute',
    top: 112,
    width: 108,
  },
  heroHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroCopy: {
    flex: 1,
    gap: 4,
  },
  heroEyebrow: {
    color: '#2563EB',
    fontSize: 12,
    letterSpacing: 1.2,
  },
  heroTitle: {
    color: '#14213D',
    fontSize: 22,
    lineHeight: 27,
  },
  heroSubline: {
    color: '#64748B',
    fontSize: 13,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusBadgeText: {
    fontSize: 12,
  },
  heroMetrics: {
    flexDirection: 'row',
    gap: 8,
  },
  heroUtilityRow: {
    justifyContent: 'flex-start',
  },
  heroUtilityButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#C7D7F7',
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 40,
    minWidth: 112,
    paddingHorizontal: 16,
  },
  heroUtilityButtonText: {
    color: '#1D4ED8',
    fontSize: 14,
  },
  metricCard: {
    backgroundColor: 'rgba(248,250,252,0.9)',
    borderColor: '#D8E1EE',
    borderWidth: 1,
    borderRadius: 16,
    flex: 1,
    gap: 4,
    minHeight: 72,
    padding: 10,
  },
  metricLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  metricValue: {
    color: '#0F172A',
    fontSize: 16,
  },
  metricValueSmall: {
    color: '#0F172A',
    fontSize: 14,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  overviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  overviewCard: {
    backgroundColor: '#F8FAFC',
    borderColor: '#D8E1EE',
    borderRadius: 14,
    borderWidth: 1,
    flexBasis: '48%',
    gap: 4,
    minHeight: 68,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  overviewLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  overviewValue: {
    color: '#0F172A',
    fontSize: 14,
    lineHeight: 18,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 17,
  },
  linkButton: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  linkButtonText: {
    fontSize: 14,
  },
  infoStack: {
    gap: 10,
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
  referenceRow: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    minHeight: 62,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  referenceCopy: {
    flex: 1,
    gap: 4,
  },
  referenceLabel: {
    color: '#64748B',
    fontSize: 13,
  },
  referenceValue: {
    color: '#0F172A',
    fontSize: 15,
  },
  paymentNoticeCard: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    gap: 8,
  },
  paymentNoticeText: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 22,
  },
  paymentNoticeEmphasis: {
    color: '#1D4ED8',
  },
  goodsList: {
    gap: 12,
  },
  groupedGoodsCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    gap: 12,
    padding: 12,
  },
  groupedGoodsHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  groupedGoodsCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  groupedGoodsTitle: {
    fontSize: 16,
  },
  groupedGoodsMeta: {
    color: '#64748B',
    fontSize: 12,
  },
  groupedGoodsSummary: {
    color: '#2563EB',
    fontSize: 13,
  },
  groupedGoodsAmount: {
    color: '#A86518',
    fontSize: 18,
  },
  groupedGoodsRows: {
    gap: 10,
  },
  goodsListItem: {
    gap: 12,
  },
  goodsRow: {
    flexDirection: 'row',
    gap: 14,
  },
  goodsDivider: {
    height: 1,
    marginLeft: 74,
    opacity: 0.8,
  },
  editItemCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  editItemRow: {
    flexDirection: 'row',
    gap: 14,
  },
  goodsImage: {
    borderRadius: 12,
    height: 60,
    width: 60,
  },
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  goodsBody: {
    flex: 1,
    gap: 6,
    justifyContent: 'center',
  },
  editItemMain: {
    flex: 1,
    gap: 8,
    justifyContent: 'center',
  },
  editItemHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  editItemHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  editItemHeaderAside: {
    alignItems: 'flex-end',
    gap: 6,
    paddingLeft: 12,
  },
  editItemControls: {
    gap: 8,
  },
  editItemModeBlock: {
    gap: 6,
  },
  editItemModeReferences: {
    gap: 2,
  },
  editItemModeReferenceText: {
    color: '#475569',
    fontSize: 12,
  },
  editItemControlRow: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: 8,
  },
  goodsName: {
    fontSize: 15,
    lineHeight: 20,
  },
  goodsSubMeta: {
    color: '#64748B',
    fontSize: 13,
  },
  goodsUnitHint: {
    color: '#475569',
    fontSize: 12,
    lineHeight: 18,
  },
  goodsMetricsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  goodsPriceValue: {
    color: '#A86518',
    fontSize: 14,
  },
  metricMultiply: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  goodsQtyValue: {
    color: '#2563EB',
    fontSize: 15,
  },
  goodsUomValue: {
    color: '#0F172A',
    fontSize: 13,
  },
  goodsAmount: {
    alignSelf: 'center',
    color: '#A86518',
    fontSize: 16,
    paddingLeft: 12,
  },
  inlineField: {
    borderRadius: 12,
    gap: 4,
    minHeight: 50,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  qtyField: {
    flex: 1.05,
  },
  uomField: {
    flex: 0.62,
  },
  inlineFieldLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  inlineFieldInput: {
    color: '#0F172A',
    fontSize: 14,
    padding: 0,
  },
  qtyStepper: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  qtyStepperButton: {
    alignItems: 'center',
    borderRadius: 10,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  qtyStepperButtonText: {
    fontSize: 20,
    lineHeight: 20,
  },
  qtyStepperInput: {
    color: '#0F172A',
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    minWidth: 28,
    padding: 0,
    textAlign: 'center',
  },
  priceChipField: {
    borderRadius: 14,
    flex: 0.48,
    gap: 4,
    minHeight: 50,
    maxWidth: 136,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  priceChipContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  pricePrefix: {
    color: '#A86518',
    fontSize: 16,
  },
  priceChipInput: {
    color: '#0F172A',
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    padding: 0,
  },
  inlineStaticValue: {
    color: '#0F172A',
    fontSize: 16,
  },
  uomSwitcher: {
    alignItems: 'flex-start',
    gap: 2,
  },
  uomSwitcherDisabled: {
    opacity: 0.8,
  },
  salesModeSwitch: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    padding: 4,
  },
  salesModeSwitchOption: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 68,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  salesModeSwitchText: {
    color: '#64748B',
    fontSize: 12,
  },
  uomHint: {
    fontSize: 11,
  },
  removeInlineButton: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  removeInlineText: {
    color: '#B91C1C',
    fontSize: 13,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
  },
  addProductPanel: {
    gap: 10,
  },
  quickActionsCard: {
    marginBottom: 10,
  },
  quickActionButton: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  quickActionIcon: {
    alignItems: 'center',
    borderRadius: 14,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  quickActionCopy: {
    flex: 1,
  },
  quickActionLabel: {
    color: '#0F172A',
    fontSize: 15,
  },
  quickActionHint: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  addProductSearchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  addProductSearchInput: {
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    fontSize: 14,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addProductSearchButton: {
    alignItems: 'center',
    borderRadius: 14,
    justifyContent: 'center',
    minWidth: 76,
    paddingHorizontal: 12,
  },
  addProductSearchButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
  },
  addProductResult: {
    alignItems: 'center',
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addProductResultCopy: {
    flex: 1,
    gap: 4,
    paddingRight: 10,
  },
  addProductResultTitle: {
    fontSize: 14,
  },
  addProductResultMeta: {
    color: '#64748B',
    fontSize: 12,
  },
  addProductResultPrice: {
    fontSize: 13,
  },
  divider: {
    height: 1,
    width: '100%',
  },
  formBlock: {
    gap: 12,
  },
  editField: {
    borderColor: '#D8E1EE',
    borderWidth: 1,
    borderRadius: 14,
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  editFieldLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  editInput: {
    color: '#0F172A',
    fontSize: 15,
    padding: 0,
  },
  textareaField: {
    minHeight: 128,
  },
  textareaInput: {
    minHeight: 90,
  },
  noteText: {
    color: '#0F172A',
    fontSize: 15,
    lineHeight: 22,
    minHeight: 72,
  },
  messageText: {
    color: '#DC2626',
    fontSize: 13,
    paddingHorizontal: 4,
  },
  dialogBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.36)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  dialogCard: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    maxWidth: 420,
    paddingHorizontal: 20,
    paddingVertical: 20,
    width: '100%',
  },
  dialogTitle: {
    fontSize: 18,
    lineHeight: 24,
  },
  dialogTitleDanger: {
    color: '#B91C1C',
  },
  dialogTitleWarning: {
    color: '#B45309',
  },
  dialogTitleInfo: {
    color: '#1D4ED8',
  },
  dialogMessage: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 22,
  },
  dialogMessageEmphasis: {
    lineHeight: 22,
  },
  dialogActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  dialogButton: {
    alignItems: 'center',
    borderRadius: 16,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 12,
  },
  dialogGhostButton: {
    borderWidth: 1,
  },
  dialogPrimaryButton: {
    backgroundColor: '#2563EB',
  },
  dialogDangerButton: {
    backgroundColor: '#DC2626',
  },
  dialogGhostText: {
    color: '#0F172A',
  },
  dialogPrimaryText: {
    color: '#FFFFFF',
  },
  bottomBar: {
    borderTopWidth: 1,
    bottom: 0,
    left: 0,
    paddingBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 10,
    position: 'absolute',
    right: 0,
  },
  bottomSummaryStrip: {
    marginBottom: 8,
  },
  bottomAmountRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 6,
  },
  bottomSummaryPrimary: {
    color: '#0F172A',
    fontSize: 14,
    marginTop: 2,
  },
  bottomSummaryAmountLabel: {
    color: '#9A3412',
    fontSize: 14,
    fontWeight: '700',
  },
  bottomSummaryAmount: {
    color: '#C97A1E',
    fontSize: 20,
    fontWeight: '700',
  },
  bottomActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  bottomButton: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 50,
  },
  bottomSingleButton: {
    flex: 1,
  },
  bottomGhostButton: {
    backgroundColor: '#FFFFFF',
  },
  bottomPrimaryButton: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  bottomDangerButton: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FCA5A5',
  },
  bottomGhostText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
  },
  bottomPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  bottomDangerText: {
    color: '#B91C1C',
    fontSize: 14,
    fontWeight: '700',
  },
});
