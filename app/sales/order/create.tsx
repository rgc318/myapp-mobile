import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LinkOptionInput } from '@/components/link-option-input';
import { MobilePageHeader } from '@/components/mobile-page-header';
import { SalesOrderItemEditor } from '@/components/sales-order-item-editor';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { normalizeAppError } from '@/lib/app-error';
import { getAppPreferences } from '@/lib/app-preferences';
import { formatDisplayUom } from '@/lib/display-uom';
import {
  compactAddressText,
  composeStructuredAddressText,
  normalizeText,
  requireText,
  toOptionalText,
} from '@/lib/form-utils';
import {
  buildModeDefaults,
  getSalesModeLabel,
  normalizeSalesMode,
  type SalesMode,
} from '@/lib/sales-mode';
import {
  buildEntryToStockSummary,
  buildQuantityComposition,
  buildQuantitySummary,
  buildStockReferenceSummary,
  buildWarehouseStockDisplay,
} from '@/lib/uom-display';
import {
  clearSalesOrderDraft,
  getSalesOrderDraft,
  getSalesOrderDraftForm,
  removeSalesOrderDraftItem,
  restoreSalesOrderDraftItem,
  updateSalesOrderDraftForm,
  updateSalesOrderDraftField,
  updateSalesOrderDraftQty,
  type SalesOrderDraftItem,
} from '@/lib/sales-order-draft';
import { useAuth } from '@/providers/auth-provider';
import { useFeedback } from '@/providers/feedback-provider';
import { fetchCustomerSalesContext, customerExists, searchCustomers } from '@/services/customers';
import { type LinkOption } from '@/services/master-data';
import {
  companyExists,
  searchCompanies,
  submitQuickSalesOrderV2,
  submitSalesOrderV2,
} from '@/services/sales';
import { fetchProductDetail } from '@/services/products';

const MONEY = new Intl.NumberFormat('zh-CN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type MessageTone = 'info' | 'success' | 'error';
type SubmitMode = 'save' | 'quick';

const ITEM_REQUIRED_MESSAGE = '还没有销售商品，请先选择商品。';

function isQuickCreateForceDeliveryCandidate(message: string) {
  const normalized = normalizeText(message);
  return normalized.includes('库存不足') || normalized.includes('可用库存不足');
}

type TopFieldRowProps = {
  label: string;
  value: string;
  errorText?: string;
  helperText?: string;
  placeholder: string;
  loadOptions: (query: string) => Promise<LinkOption[]>;
  onChangeText: (value: string) => void;
};

function formatMoney(value: number) {
  return MONEY.format(value);
}

function formatModeReference(
  label: string,
  rate: number | null | undefined,
  uom: string | null | undefined,
) {
  const formattedRate = typeof rate === 'number' ? `¥ ${formatMoney(rate)}` : '未配置';
  const formattedUom = uom ? formatDisplayUom(uom) : '未设置单位';
  return `${label} ${formattedRate} / ${formattedUom}`;
}

function groupDraftItemsByProduct(items: SalesOrderDraftItem[]) {
  const grouped = new Map<
    string,
    {
      itemCode: string;
      itemName: string;
      totalQty: number;
      totalAmount: number;
      rows: SalesOrderDraftItem[];
    }
  >();

  items.forEach((item) => {
    const existing = grouped.get(item.itemCode);
    if (existing) {
      existing.rows.push(item);
      existing.totalQty += item.qty;
      existing.totalAmount += (item.price ?? 0) * item.qty;
      return;
    }

    grouped.set(item.itemCode, {
      itemCode: item.itemCode,
      itemName: item.itemName || item.itemCode,
      totalQty: item.qty,
      totalAmount: (item.price ?? 0) * item.qty,
      rows: [item],
    });
  });

  return Array.from(grouped.values());
}

function SalesModeSwitch({
  value,
  onChange,
}: {
  value: SalesMode;
  onChange: (nextMode: SalesMode) => void;
}) {
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const tintColor = useThemeColor({}, 'tint');

  return (
    <View style={[styles.salesModeSwitch, { backgroundColor: surfaceMuted }]}>
      {(['wholesale', 'retail'] as SalesMode[]).map((mode) => {
        const active = value === mode;
        return (
          <Pressable
            key={mode}
            onPress={() => onChange(mode)}
            style={[
              styles.salesModeSwitchOption,
              active && { backgroundColor: '#FFFFFF', borderColor: tintColor },
            ]}>
            <ThemedText
              style={[styles.salesModeSwitchText, active && { color: tintColor }]}
              type="defaultSemiBold">
              {getSalesModeLabel(mode)}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

function composeAddressDisplay(address: {
  addressDisplay?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  county?: string | null;
  state?: string | null;
  country?: string | null;
  pincode?: string | null;
} | null | undefined) {
  if (!address) {
    return '';
  }

  const structuredDisplay = composeStructuredAddressText({
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2,
  });
  if (structuredDisplay) {
    return structuredDisplay;
  }

  return compactAddressText(address.addressDisplay ?? '');
}

function TopFieldRow({
                       label,
                       value,
                       errorText,
                       helperText,
                       placeholder,
                       loadOptions,
                       onChangeText,
                     }: TopFieldRowProps) {
  return (
    <View style={styles.infoFieldBlock}>
      <ThemedText style={styles.infoFieldLabel} type="defaultSemiBold">
        {label}
      </ThemedText>
      <LinkOptionInput
        errorText={errorText}
        helperText={helperText}
        label=""
        loadOptions={loadOptions}
        onChangeText={onChangeText}
        placeholder={placeholder}
        value={value}
      />
    </View>
  );
}

function SummaryMetric({
                         label,
                         value,
                         valueStyle,
                       }: {
  label: string;
  value: string;
  valueStyle?: any;
}) {
  return (
    <View style={styles.summaryMetric}>
      <ThemedText style={styles.summaryMetricLabel}>{label}</ThemedText>
      <ThemedText style={valueStyle} type="defaultSemiBold">
        {value}
      </ThemedText>
    </View>
  );
}

function SummaryRow({
                      label,
                      value,
                      strong,
                    }: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.amountRow}>
      <ThemedText style={strong ? styles.amountLabelStrong : styles.amountLabel}>
        {label}
      </ThemedText>
      <ThemedText
        style={strong ? styles.amountValueStrong : styles.amountValue}
        type="defaultSemiBold">
        {value}
      </ThemedText>
    </View>
  );
}

export default function SalesOrderCreateScreen() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const navigation = useNavigation();
  const preferences = getAppPreferences();
  const { profile } = useAuth();
  const { showError, showSuccess } = useFeedback();
  const isFocused = useIsFocused();
  const initialDraftForm = getSalesOrderDraftForm();

  const [customer, setCustomer] = useState(initialDraftForm.customer);
  const [company, setCompany] = useState(initialDraftForm.company || preferences.defaultCompany);
  const [defaultSalesMode, setDefaultSalesMode] = useState<SalesMode>(
    normalizeSalesMode(initialDraftForm.defaultSalesMode),
  );
  const [remarks, setRemarks] = useState(initialDraftForm.remarks);
  const [shippingAddress, setShippingAddress] = useState(initialDraftForm.shippingAddress);
  const [shippingContact, setShippingContact] = useState(initialDraftForm.shippingContact);
  const [shippingPhone, setShippingPhone] = useState(initialDraftForm.shippingPhone);
  const [recentAddresses, setRecentAddresses] = useState<{ name: string | null; addressDisplay: string | null }[]>([]);
  const [customerContextNote, setCustomerContextNote] = useState('');
  const [isLoadingShippingInfo, setIsLoadingShippingInfo] = useState(false);
  const [draftItems, setDraftItems] = useState(getSalesOrderDraft());
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<MessageTone>('info');
  const [customerError, setCustomerError] = useState('');
  const [companyError, setCompanyError] = useState('');
  const [showOrderMeta, setShowOrderMeta] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMode, setSubmitMode] = useState<SubmitMode>('save');
  const [showQuickCreateConfirm, setShowQuickCreateConfirm] = useState(false);
  const [showQuickForceConfirm, setShowQuickForceConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [quickForceMessage, setQuickForceMessage] = useState('');
  const [pendingRemovedItem, setPendingRemovedItem] = useState<SalesOrderDraftItem | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const removeUndoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCustomerRef = useRef('');
  const customerSectionYRef = useRef(0);
  const itemsSectionYRef = useRef(0);
  const shippingSectionYRef = useRef(0);
  const hydratedDraftItemCodesRef = useRef<Record<string, true>>({});
  const shippingAddressTouchedRef = useRef(false);
  const shippingContactTouchedRef = useRef(false);
  const shippingPhoneTouchedRef = useRef(false);
  const allowLeaveRef = useRef(false);
  const pendingNavigationActionRef = useRef<any>(null);

  const postingDate = new Date().toISOString().slice(0, 10);

  const surface = useThemeColor({}, 'surface');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');
  const background = useThemeColor({}, 'background');
  const accentSoft = useThemeColor({}, 'accentSoft');
  const dangerColor = useThemeColor({}, 'danger');

  const syncDraft = () => {
    setDraftItems([...getSalesOrderDraft()]);
  };

  const handleCustomerChange = (value: string) => {
    setCustomer(value);
    if (customerError) {
      setCustomerError('');
    }
  };

  const handleCompanyChange = (value: string) => {
    setCompany(value);
    if (companyError) {
      setCompanyError('');
    }
  };

  const handleShippingAddressChange = (value: string) => {
    shippingAddressTouchedRef.current = true;
    setShippingAddress(value);
  };

  const handleShippingContactChange = (value: string) => {
    shippingContactTouchedRef.current = true;
    setShippingContact(value);
  };

  const handleShippingPhoneChange = (value: string) => {
    shippingPhoneTouchedRef.current = true;
    setShippingPhone(value);
  };

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    setDraftItems([...getSalesOrderDraft()]);
    const nextDraftForm = getSalesOrderDraftForm();
    setCustomer(nextDraftForm.customer);
    setCompany(nextDraftForm.company || preferences.defaultCompany);
    setDefaultSalesMode(normalizeSalesMode(nextDraftForm.defaultSalesMode));
    setRemarks(nextDraftForm.remarks);
    setShippingAddress(nextDraftForm.shippingAddress);
    setShippingContact(nextDraftForm.shippingContact);
    setShippingPhone(nextDraftForm.shippingPhone);
    lastCustomerRef.current = normalizeText(nextDraftForm.customer);
    shippingAddressTouchedRef.current = Boolean(normalizeText(nextDraftForm.shippingAddress));
    shippingContactTouchedRef.current = Boolean(normalizeText(nextDraftForm.shippingContact));
    shippingPhoneTouchedRef.current = Boolean(normalizeText(nextDraftForm.shippingPhone));
  }, [isFocused, preferences.defaultCompany]);

  useEffect(() => {
    updateSalesOrderDraftForm({
      customer,
      company,
      defaultSalesMode,
      remarks,
      shippingAddress,
      shippingContact,
      shippingPhone,
    });
  }, [company, customer, defaultSalesMode, remarks, shippingAddress, shippingContact, shippingPhone]);

  useEffect(() => () => {
    if (removeUndoTimerRef.current) {
      clearTimeout(removeUndoTimerRef.current);
    }
  }, []);

  const hasDraftContent = useMemo(
    () =>
      Boolean(
        normalizeText(customer) ||
          (normalizeText(company) && normalizeText(company) !== normalizeText(preferences.defaultCompany)) ||
          normalizeText(remarks) ||
          normalizeText(shippingAddress) ||
          normalizeText(shippingContact) ||
          normalizeText(shippingPhone) ||
          draftItems.length,
      ),
    [company, customer, draftItems.length, preferences.defaultCompany, remarks, shippingAddress, shippingContact, shippingPhone],
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (allowLeaveRef.current || !hasDraftContent || isSubmitting) {
        return;
      }

      event.preventDefault();
      pendingNavigationActionRef.current = event.data.action;
      setShowLeaveConfirm(true);
    });

    return unsubscribe;
  }, [hasDraftContent, isSubmitting, navigation]);
  useEffect(() => {
    const activeItemCodes = new Set(draftItems.map((item) => item.itemCode).filter(Boolean));
    Object.keys(hydratedDraftItemCodesRef.current).forEach((itemCode) => {
      if (!activeItemCodes.has(itemCode)) {
        delete hydratedDraftItemCodesRef.current[itemCode];
      }
    });

    const itemsNeedingRefresh = draftItems.filter(
      (item) =>
        item.itemCode &&
        !hydratedDraftItemCodesRef.current[item.itemCode] &&
        (!item.imageUrl ||
          !item.priceSummary ||
          !item.wholesaleDefaultUom ||
          !item.retailDefaultUom ||
          !item.allUoms?.length ||
          item.warehouseStockQty == null ||
          !item.warehouseStockUom),
    );

    if (!itemsNeedingRefresh.length) {
      return;
    }

    let active = true;

    void Promise.all(
      itemsNeedingRefresh.map(async (item) => {
        const detail = await fetchProductDetail(item.itemCode);
        if (!active || !detail) {
          return;
        }

        hydratedDraftItemCodesRef.current[item.itemCode] = true;

        const effectiveMode = normalizeSalesMode(item.salesMode ?? defaultSalesMode);
        const defaults = buildModeDefaults(
          {
            salesProfiles: detail.salesProfiles,
            wholesaleDefaultUom: detail.wholesaleDefaultUom,
            retailDefaultUom: detail.retailDefaultUom,
            allUoms: detail.allUoms,
            stockUom: detail.stockUom,
            uom: detail.stockUom,
            priceSummary: detail.priceSummary,
            price: detail.price,
          },
          effectiveMode,
        );

        restoreSalesOrderDraftItem({
          ...item,
          imageUrl: item.imageUrl || detail.imageUrl,
          salesMode: effectiveMode,
          uom: item.uom || defaults.uom || detail.stockUom,
          price: item.price ?? defaults.price ?? detail.price ?? null,
          allUoms: detail.allUoms,
          uomConversions: detail.uomConversions,
          stockUom: detail.stockUom,
          stockQty: detail.stockQty,
          warehouseStockQty:
            detail.warehouseStockDetails.find((row) => row.warehouse === item.warehouse)?.qty ??
            item.warehouseStockQty ??
            null,
          warehouseStockUom: item.warehouseStockUom ?? detail.stockUom,
          wholesaleDefaultUom: detail.wholesaleDefaultUom,
          retailDefaultUom: detail.retailDefaultUom,
          salesProfiles: detail.salesProfiles,
          priceSummary: detail.priceSummary,
        });
      }),
    ).then(() => {
      if (active) {
        syncDraft();
      }
    });

    return () => {
      active = false;
    };
  }, [defaultSalesMode, draftItems]);

  useEffect(() => {
    if (draftItems.length > 0 && messageTone === 'error' && message === ITEM_REQUIRED_MESSAGE) {
      setMessage('');
      setMessageTone('info');
    }
  }, [draftItems, message, messageTone]);



  useEffect(() => {
    const trimmedCustomer = normalizeText(customer);
    const customerChanged = trimmedCustomer !== lastCustomerRef.current;

    if (customerChanged) {
      lastCustomerRef.current = trimmedCustomer;
      shippingAddressTouchedRef.current = false;
      shippingContactTouchedRef.current = false;
      shippingPhoneTouchedRef.current = false;
    }

    if (!trimmedCustomer) {
      setShippingAddress('');
      setShippingContact('');
      setShippingPhone('');
      setRecentAddresses([]);
      setCustomerContextNote('');
      setIsLoadingShippingInfo(false);
      return;
    }

    let active = true;
    setIsLoadingShippingInfo(true);
    const timer = setTimeout(() => {
      void customerExists(trimmedCustomer)
        .then((exists) => {
          if (!active) {
            return;
          }

          if (!exists) {
            setRecentAddresses([]);
            setCustomerContextNote('请输入或选择精确客户名称后，再自动带入默认联系人和地址。');
            setIsLoadingShippingInfo(false);
            return;
          }

          void fetchCustomerSalesContext(trimmedCustomer)
            .then((details) => {
              if (!active) {
                return;
              }

              if (customerChanged) {
                setShippingAddress(
                  composeAddressDisplay(details.defaultAddress) ||
                    compactAddressText(details.recentAddresses[0]?.addressDisplay) ||
                    '',
                );
                setShippingContact(details.defaultContact?.displayName || '');
                setShippingPhone(details.defaultContact?.phone || '');
              }
              setRecentAddresses(
                details.recentAddresses.map((address) => ({
                  ...address,
                  addressDisplay: compactAddressText(address.addressDisplay),
                })),
              );
              setCustomerContextNote(
                details.defaultContact?.displayName
                  ? `默认联系人：${details.defaultContact.displayName}${details.defaultContact.phone ? ` / ${details.defaultContact.phone}` : ''}`
                  : '已载入客户销售上下文，可按本单需要临时调整收货信息。',
              );

              if (!normalizeText(company) && details.suggestions.company) {
                setCompany(details.suggestions.company);
              }
            })
            .catch(() => {
              if (!active) {
                return;
              }

              setRecentAddresses([]);
              setCustomerContextNote('客户上下文暂时无法加载，请继续选择客户或稍后重试。');
            })
            .finally(() => {
              if (active) {
                setIsLoadingShippingInfo(false);
              }
            });
        })
        .catch(() => {
          if (!active) {
            return;
          }

          setRecentAddresses([]);
          setCustomerContextNote('客户信息校验失败，请重新选择客户。');
          setIsLoadingShippingInfo(false);
        });
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [company, customer]);

  const clearPendingRemovedItem = () => {
    if (removeUndoTimerRef.current) {
      clearTimeout(removeUndoTimerRef.current);
      removeUndoTimerRef.current = null;
    }

    setPendingRemovedItem(null);
  };

  const queueUndoForRemovedItem = (item: SalesOrderDraftItem) => {
    if (removeUndoTimerRef.current) {
      clearTimeout(removeUndoTimerRef.current);
    }

    setPendingRemovedItem(item);
    removeUndoTimerRef.current = setTimeout(() => {
      setPendingRemovedItem(null);
      removeUndoTimerRef.current = null;
    }, 4000);
  };

  const setStatusMessage = (text: string, tone: MessageTone) => {
    setMessage(text);
    setMessageTone(tone);
  };

  const scrollToSection = (y: number) => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: Math.max(y - 16, 0), animated: true });
    });
  };

  const totalQty = useMemo(
    () => draftItems.reduce((sum, item) => sum + item.qty, 0),
    [draftItems],
  );
  const totalLineCount = draftItems.length;
  const draftQuantitySummary = useMemo(
    () => buildQuantitySummary(draftItems),
    [draftItems],
  );
  const bottomQuantitySummary = useMemo(() => {
    if (!draftItems.length) {
      return '暂无商品明细';
    }

    const normalizedUoms = Array.from(
      new Set(
        draftItems
          .map((item) => (typeof item.uom === 'string' ? item.uom.trim() : ''))
          .filter(Boolean),
      ),
    );

    if (normalizedUoms.length <= 1) {
      const totalQty = draftItems.reduce((sum, item) => sum + item.qty, 0);
      const onlyUom = normalizedUoms[0];
      return onlyUom
        ? `共 ${totalLineCount} 项 · ${totalQty} ${formatDisplayUom(onlyUom)}`
        : `共 ${totalLineCount} 项`;
    }

    return `共 ${totalLineCount} 项 · ${normalizedUoms.length} 种单位`;
  }, [draftItems, totalLineCount]);
  const groupedDraftItems = useMemo(
    () => groupDraftItemsByProduct(draftItems),
    [draftItems],
  );

  const goodsAmount = useMemo(
    () => draftItems.reduce((sum, item) => sum + (item.price ?? 0) * item.qty, 0),
    [draftItems],
  );

  const discountAmount = 0;
  const freightAmount = 0;
  const receivableAmount = goodsAmount - discountAmount + freightAmount;

  const loadCustomers = (query: string) => searchCustomers(query);
  const loadCompanies = (query: string) => searchCompanies(query);

  const validateLinks = async () => {
    let valid = true;
    let firstInvalidSection: 'customer' | 'items' | 'shipping' | null = null;

    setCustomerError('');
    setCompanyError('');

    const customerRequiredError = requireText(customer, '请先选择客户。');
    const companyRequiredError = requireText(company, '请先选择公司。');

    if (customerRequiredError) {
      setCustomerError(customerRequiredError);
      valid = false;
      firstInvalidSection ??= 'customer';
    }

    if (companyRequiredError) {
      setCompanyError(companyRequiredError);
      valid = false;
      firstInvalidSection ??= 'shipping';
    }

    if (!draftItems.length) {
      setStatusMessage(ITEM_REQUIRED_MESSAGE, 'error');
      valid = false;
      firstInvalidSection ??= 'items';
    }

    if (!valid) {
      showError(
        firstInvalidSection === 'customer'
          ? '请先选择客户。'
          : firstInvalidSection === 'items'
            ? '请先添加销售商品。'
            : '请先完善发货信息。',
      );
      if (firstInvalidSection === 'customer') {
        scrollToSection(customerSectionYRef.current);
      } else if (firstInvalidSection === 'items') {
        scrollToSection(itemsSectionYRef.current);
      } else if (firstInvalidSection === 'shipping') {
        setShowOrderMeta(true);
        scrollToSection(shippingSectionYRef.current);
      }
      return false;
    }

    const [customerOk, companyOk] = await Promise.all([
      customerExists(customer),
      companyExists(company),
    ]);

    if (!customerOk) {
      setCustomerError('客户不存在，请重新选择。');
      valid = false;
      firstInvalidSection ??= 'customer';
    }

    if (!companyOk) {
      setCompanyError('公司不存在，请重新选择。');
      valid = false;
      firstInvalidSection ??= 'shipping';
    }

    if (!valid) {
      showError(
        firstInvalidSection === 'customer' ? '客户不存在，请重新选择。' : '公司不存在，请重新选择。',
      );
      if (firstInvalidSection === 'customer') {
        scrollToSection(customerSectionYRef.current);
      } else if (firstInvalidSection === 'shipping') {
        setShowOrderMeta(true);
        scrollToSection(shippingSectionYRef.current);
      }
    }

    return valid;
  };

  const handleUndoRemove = () => {
    if (!pendingRemovedItem) {
      return;
    }

    restoreSalesOrderDraftItem(pendingRemovedItem);
    syncDraft();
    setStatusMessage(`\u5df2\u6062\u590d ${pendingRemovedItem.itemName || pendingRemovedItem.itemCode}`, 'success');
    clearPendingRemovedItem();
  };

  const handleRemoveItem = (item: SalesOrderDraftItem) => {
    removeSalesOrderDraftItem(item.draftKey);
    syncDraft();
    setStatusMessage(`\u5df2\u5220\u9664 ${item.itemName || item.itemCode}`, 'info');
    queueUndoForRemovedItem(item);
  };

  const buildOrderPayload = (options?: { forceDelivery?: boolean }) => ({
    customer,
    company,
    defaultSalesMode,
    force_delivery: options?.forceDelivery,
    transaction_date: postingDate,
    remarks: toOptionalText(remarks),
    customer_info: {
      contact_display_name: toOptionalText(shippingContact),
      contact_phone: toOptionalText(shippingPhone),
    },
    shipping_info: {
      receiver_name: toOptionalText(shippingContact),
      receiver_phone: toOptionalText(shippingPhone),
      shipping_address_text: toOptionalText(compactAddressText(shippingAddress)),
    },
    items: draftItems.map((item) => ({
      item_code: item.itemCode,
      qty: item.qty,
      price: item.price ?? undefined,
      warehouse: item.warehouse || preferences.defaultWarehouse || undefined,
      uom: item.uom || undefined,
      sales_mode: item.salesMode,
    })),
  });

  const handleSubmit = async (mode: SubmitMode = 'save', options?: { forceDelivery?: boolean }) => {
    setStatusMessage('', 'info');

    const valid = await validateLinks();
    if (!valid) {
      return;
    }

    setSubmitMode(mode);
    setIsSubmitting(true);

    try {
      const result =
        mode === 'quick'
          ? await submitQuickSalesOrderV2(buildOrderPayload(options))
          : await submitSalesOrderV2(buildOrderPayload(options));

      const orderName =
        typeof result?.order === 'string' && result.order.trim()
          ? result.order.trim()
          : typeof result?.order_name === 'string' && result.order_name.trim()
            ? result.order_name.trim()
            : '';
      const salesInvoiceName =
        typeof result?.sales_invoice === 'string' && result.sales_invoice.trim()
          ? result.sales_invoice.trim()
          : '';

      clearSalesOrderDraft();
      allowLeaveRef.current = true;
      syncDraft();
      setStatusMessage(
        mode === 'quick'
          ? orderName
            ? `销售单 ${orderName} 已快速开单，并自动完成发货与开票。`
            : '销售单已快速开单。'
          : orderName
            ? `销售单 ${orderName} 已保存。`
            : '销售单已保存。',
        'success',
      );
      showSuccess(
        mode === 'quick'
          ? salesInvoiceName
            ? `已快速开单，销售发票 ${salesInvoiceName} 已生成。`
            : '已快速开单。'
          : orderName
            ? `销售单 ${orderName} 已保存。`
            : '销售单已保存。',
      );

      if (mode === 'quick' && salesInvoiceName) {
        router.replace({
          pathname: '/sales/invoice/create',
          params: { salesInvoice: salesInvoiceName, notice: 'created' },
        });
      } else if (orderName) {
        router.replace({
          pathname: '/sales/order/[orderName]',
          params: { orderName },
        });
      }
    } catch (error) {
      const appError = normalizeAppError(error, '提交失败，请稍后重试。');
      if (
        mode === 'quick' &&
        !options?.forceDelivery &&
        isQuickCreateForceDeliveryCandidate(appError.message)
      ) {
        setQuickForceMessage(appError.message);
        setShowQuickForceConfirm(true);
        setStatusMessage(appError.message, 'error');
        return;
      }
      setStatusMessage(
        appError.message,
        'error',
      );
      showError(appError.message);
    } finally {
      setIsSubmitting(false);
      setSubmitMode('save');
    }
  };

  const messageColor =
    messageTone === 'success'
      ? tintColor
      : messageTone === 'error'
        ? dangerColor
        : '#6B7280';
  const returnToSalesHome = () => {
    const target = typeof returnTo === 'string' && returnTo.trim() ? returnTo : '/(tabs)/sales';
    router.replace(target as never);
  };

  return (
    <SafeAreaView edges={[]} style={[styles.page, { backgroundColor: background }]}>
      <MobilePageHeader
        onBack={() => {
          if (hasDraftContent && !allowLeaveRef.current && !isSubmitting) {
            setShowLeaveConfirm(true);
            return;
          }
          returnToSalesHome();
        }}
        rightAction={
          <Pressable
            onPress={() => setStatusMessage('AI 开单功能开发中。', 'info')}
            style={styles.headerAction}>
            <ThemedText style={{ color: tintColor }} type="defaultSemiBold">
              AI开单
            </ThemedText>
          </Pressable>
        }
        showBack
        title="销售单"
      />

      <ScrollView contentContainerStyle={styles.scrollContent} ref={scrollRef}>
        <View
          onLayout={(event) => {
            customerSectionYRef.current = event.nativeEvent.layout.y;
          }}
          style={[styles.heroCard, { backgroundColor: surface, borderColor }]}>
          <View style={styles.heroHeader}>
            <View style={styles.heroHeaderCopy}>
              <ThemedText style={styles.heroSubtitle}>录入客户、模式和商品后即可保存或快速开单。</ThemedText>
            </View>
            <View style={[styles.statusPill, { backgroundColor: accentSoft }]}>
              <ThemedText
                style={[styles.statusPillText, { color: tintColor }]}
                type="defaultSemiBold">
                Draft
              </ThemedText>
            </View>
          </View>

          <TopFieldRow
            errorText={customerError}
            helperText="选择当前订单的往来客户"
            label="客户"
            loadOptions={loadCustomers}
            onChangeText={handleCustomerChange}
            placeholder="请选择客户"
            value={customer}
          />

          <View style={styles.heroMetaGrid}>
            <SummaryMetric
              label="时间"
              value={postingDate}
              valueStyle={styles.heroMetaValue}
            />
            <SummaryMetric
              label="业务员"
              value={profile?.fullName || profile?.name || 'admin'}
              valueStyle={styles.heroMetaValue}
            />
          </View>

          <View style={styles.defaultModeBlock}>
            <View style={styles.defaultModeHeader}>
              <ThemedText style={styles.defaultModeLabel} type="defaultSemiBold">
                默认销售模式
              </ThemedText>
              <ThemedText style={styles.defaultModeHint}>
                只影响新加入商品的默认单位和价格
              </ThemedText>
            </View>
            <SalesModeSwitch onChange={setDefaultSalesMode} value={defaultSalesMode} />
          </View>

          <View style={styles.heroStatGrid}>
            <SummaryMetric
              label="已选商品"
              value={`${totalQty}项`}
              valueStyle={styles.heroStatValue}
            />
            <SummaryMetric
              label="当前应收"
              value={`¥ ${formatMoney(receivableAmount)}`}
              valueStyle={styles.heroReceivableValue}
            />
          </View>
        </View>

        <View
          style={[styles.quickActionsCard, { backgroundColor: surface, borderColor }]}>
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/common/product-search',
                params: { mode: 'order', defaultSalesMode },
              })
            }
            style={styles.quickActionButton}>
            <View style={[styles.quickActionIcon, { backgroundColor: accentSoft }]}>
              <IconSymbol color={tintColor} name="cart.fill.badge.plus" size={18} />
            </View>
            <View style={styles.quickActionCopy}>
              <ThemedText style={styles.quickActionLabel} type="defaultSemiBold">
                选择商品
              </ThemedText>
              <ThemedText style={styles.quickActionHint}>进入商品搜索页选择，也可在页内扫码添加</ThemedText>
            </View>
          </Pressable>
        </View>

        <View
          onLayout={(event) => {
            itemsSectionYRef.current = event.nativeEvent.layout.y;
          }}
          style={[styles.sectionCard, { backgroundColor: surface, borderColor }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionAccent, { backgroundColor: tintColor }]} />
            <View>
              <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
                销售商品
              </ThemedText>
              <ThemedText style={styles.sectionHint}>商品明细决定订单金额</ThemedText>
            </View>
          </View>

          {!!message && (
            <ThemedText style={[styles.bannerText, { color: messageColor }]}>
              {message}
            </ThemedText>
          )}

          {pendingRemovedItem ? (
            <View style={[styles.undoBanner, { backgroundColor: accentSoft }]}> 
              <ThemedText style={styles.undoBannerText}>
                {'商品已从当前订单移除'}
              </ThemedText>
              <Pressable onPress={handleUndoRemove} style={styles.undoButton}>
                <ThemedText style={[styles.undoButtonText, { color: tintColor }]} type="defaultSemiBold">
                  {'撤销'}
                </ThemedText>
              </Pressable>
            </View>
          ) : null}

          {!!draftItems.length && (
            <>
              <ThemedText style={styles.draftHint}>
                商品的仓库信息跟随明细项携带，无需在订单头单独维护。
              </ThemedText>

              <View style={styles.itemList}>
                {groupedDraftItems.map((group) => (
                  <SalesOrderItemEditor
                    imageUrl={group.rows[0]?.imageUrl}
                    itemCode={group.itemCode}
                    itemName={group.itemName}
                    key={group.itemCode}
                    groupedSummaryLabel={`共 ${group.rows.length} 个仓库条目，合计 ${buildQuantityComposition(group.rows)}`}
                    groupedLines={group.rows.map((item) => {
                      const warehouseStockDisplay = buildWarehouseStockDisplay({
                        warehouseStockQty: item.warehouseStockQty,
                        warehouseStockUom: item.warehouseStockUom ?? item.stockUom,
                        qty: item.qty,
                        uom: item.uom,
                        stockUom: item.stockUom,
                        uomConversions: item.uomConversions,
                      });

                      return {
                      key: item.draftKey,
                      warehouse: item.warehouse || preferences.defaultWarehouse,
                      salesMode: normalizeSalesMode(item.salesMode),
                      uom: item.uom,
                      wholesaleReferenceLabel: formatModeReference(
                        '批发',
                        item.priceSummary?.wholesaleRate ?? null,
                        item.wholesaleDefaultUom,
                      ),
                      retailReferenceLabel: formatModeReference(
                        '零售',
                        item.priceSummary?.retailRate ?? null,
                        item.retailDefaultUom,
                      ),
                      warehouseStockLabel: warehouseStockDisplay?.label ?? null,
                      warehouseStockTone: warehouseStockDisplay?.tone ?? 'default',
                      conversionSummary: buildEntryToStockSummary(item),
                      stockReferenceSummary: buildStockReferenceSummary(item),
                      onChangeSalesMode: (nextMode) => {
                        const defaults = buildModeDefaults(item, nextMode);
                        restoreSalesOrderDraftItem({
                          ...item,
                          salesMode: defaults.salesMode,
                          uom: defaults.uom || item.uom,
                          price: defaults.price ?? item.price ?? null,
                        });
                        syncDraft();
                      },
                      onChangePrice: (value) => {
                        updateSalesOrderDraftField(
                          item.draftKey,
                          'price',
                          value === '' ? null : Number(value) || 0,
                        );
                        syncDraft();
                      },
                      onChangeQty: (value) => {
                        updateSalesOrderDraftQty(item.draftKey, Number(value) || 0);
                        syncDraft();
                      },
                      onRemove: () => {
                        handleRemoveItem(item);
                      },
                      lineAmountLabel: `¥ ${formatMoney((item.price ?? 0) * item.qty)}`,
                      priceText: item.price === null ? '' : String(item.price),
                      qty: item.qty,
                      onDecreaseQty: () => {
                        const nextQty = Math.max(1, item.qty - 1);
                        updateSalesOrderDraftQty(item.draftKey, nextQty);
                        syncDraft();
                      },
                      onIncreaseQty: () => {
                        updateSalesOrderDraftQty(item.draftKey, item.qty + 1);
                        syncDraft();
                      },
                    };
                    })}
                    lineAmountLabel={`¥ ${formatMoney(group.totalAmount)}`}
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
                    wholesaleReferenceLabel=""
                  />
                ))}
              </View>
            </>
          )}

          {!draftItems.length ? (
            <View style={styles.validationCard}>
              <ThemedText style={styles.validationTitle} type="defaultSemiBold">
                还没有销售商品
              </ThemedText>
              <ThemedText style={styles.validationText}>
                请先通过“选择商品”进入搜索页，把本单要卖的商品加入进来；需要时也可在搜索页内扫码添加。
              </ThemedText>
            </View>
          ) : null}

          <View style={[styles.sectionFooter, { borderTopColor: borderColor }]}>
            <ThemedText style={styles.sectionFooterText}>
              {`合计已选 ${totalLineCount} 项，${draftQuantitySummary}`}
            </ThemedText>
            <ThemedText style={styles.sectionFooterAmount} type="defaultSemiBold">
              ¥ {formatMoney(goodsAmount)}
            </ThemedText>
          </View>
        </View>

        <View
          onLayout={(event) => {
            shippingSectionYRef.current = event.nativeEvent.layout.y;
          }}
          style={[styles.sectionCard, { backgroundColor: surface, borderColor }]}>
          <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
            金额汇总
          </ThemedText>

          <SummaryRow label="商品合计" value={`¥ ${formatMoney(goodsAmount)}`} />
          <SummaryRow label="整单折扣" value={`¥ ${formatMoney(discountAmount)}`} />
          <SummaryRow
            label="折后金额"
            value={`¥ ${formatMoney(goodsAmount - discountAmount)}`}
          />
          <SummaryRow label="运费" value={`¥ ${formatMoney(freightAmount)}`} />

          <View style={[styles.amountStrongWrap, { backgroundColor: accentSoft }]}>
            <SummaryRow label="应收" strong value={`¥ ${formatMoney(receivableAmount)}`} />
          </View>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: surface, borderColor }]}>
          <Pressable
            onPress={() => setShowOrderMeta((current) => !current)}
            style={styles.foldHeader}>
            <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
              发货信息
            </ThemedText>
            <ThemedText style={styles.foldAction}>
              {showOrderMeta ? '收起' : '展开'}
            </ThemedText>
          </Pressable>

          {showOrderMeta && (
            <View style={styles.foldBody}>
              <TopFieldRow
                errorText={companyError}
                helperText={'\u9ed8\u8ba4\u53d1\u8d27\u516c\u53f8\uff0c\u901a\u5e38\u65e0\u9700\u9891\u7e41\u8c03\u6574'}
                label={'\u516c\u53f8'}
                loadOptions={loadCompanies}
              onChangeText={handleCompanyChange}
                placeholder={'\u8bf7\u9009\u62e9\u516c\u53f8'}
                value={company}
              />

              <View style={styles.shippingGrid}>
                <View style={styles.shippingFieldBlock}>
                  <ThemedText style={styles.shippingFieldLabel} type="defaultSemiBold">{'\u6536\u8d27\u8054\u7cfb\u4eba'}</ThemedText>
                  <TextInput
                    onChangeText={handleShippingContactChange}
                    placeholder={'\u4ece\u5ba2\u6237\u8d44\u6599\u5e26\u5165\uff0c\u53ef\u4e34\u65f6\u4fee\u6539'}
                    placeholderTextColor="#9CA3AF"
                    style={[styles.shippingInput, { backgroundColor: surfaceMuted, borderColor }]}
                    value={shippingContact}
                  />
                </View>

                <View style={styles.shippingFieldBlock}>
                  <ThemedText style={styles.shippingFieldLabel} type="defaultSemiBold">{'\u8054\u7cfb\u7535\u8bdd'}</ThemedText>
                  <TextInput
                    keyboardType="phone-pad"
                    onChangeText={handleShippingPhoneChange}
                    placeholder={'\u4ece\u5ba2\u6237\u8d44\u6599\u5e26\u5165\uff0c\u53ef\u4e34\u65f6\u4fee\u6539'}
                    placeholderTextColor="#9CA3AF"
                    style={[styles.shippingInput, { backgroundColor: surfaceMuted, borderColor }]}
                    value={shippingPhone}
                  />
                </View>
              </View>

              <View style={styles.shippingFieldBlock}>
                <ThemedText style={styles.shippingFieldLabel} type="defaultSemiBold">{'\u6536\u8d27\u5730\u5740'}</ThemedText>
                <TextInput
                  multiline
                  numberOfLines={4}
                  onChangeText={handleShippingAddressChange}
                  placeholder={'\u9009\u5b9a\u5ba2\u6237\u540e\u81ea\u52a8\u5e26\u51fa\uff0c\u672c\u5355\u53ef\u4ee5\u4e34\u65f6\u4fee\u6539'}
                  placeholderTextColor="#9CA3AF"
                  style={[styles.shippingTextarea, { backgroundColor: surfaceMuted, borderColor }]}
                  textAlignVertical="top"
                  value={shippingAddress}
                />
              </View>

              {recentAddresses.length ? (
                <View style={styles.recentAddressBlock}>
                  <ThemedText style={styles.shippingFieldLabel} type="defaultSemiBold">
                    {'最近使用地址'}
                  </ThemedText>
                  <View style={styles.recentAddressList}>
                    {recentAddresses.map((address, index) => (
                      <Pressable
                        key={`${address.name ?? 'text'}-${index}`}
                        onPress={() => handleShippingAddressChange(compactAddressText(address.addressDisplay))}
                        style={[styles.recentAddressChip, { backgroundColor: accentSoft, borderColor }]}>
                        <ThemedText numberOfLines={2} style={styles.recentAddressText}>
                          {compactAddressText(address.addressDisplay) || '未命名地址'}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}

              <View style={[styles.infoNotice, { backgroundColor: surfaceMuted }]}>
                <ThemedText style={styles.infoNoticeText}>
                  {isLoadingShippingInfo
                    ? '\u6b63\u5728\u8bfb\u53d6\u5ba2\u6237\u9ed8\u8ba4\u6536\u8d27\u4fe1\u606f...'
                    : customerContextNote || '\u6536\u8d27\u4fe1\u606f\u9ed8\u8ba4\u4ece\u5ba2\u6237\u8d44\u6599\u5e26\u51fa\uff0c\u4f60\u53ef\u4ee5\u6309\u672c\u6b21\u8ba2\u5355\u9700\u8981\u4e34\u65f6\u4fee\u6539\uff0c\u4e0d\u4f1a\u56de\u5199\u5ba2\u6237\u6863\u6848\u3002'}
                </ThemedText>
              </View>
            </View>
          )}
        </View>

        <View style={[styles.sectionCard, { backgroundColor: surface, borderColor }]}>
          <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
            备注
          </ThemedText>
          <TextInput
            multiline
            numberOfLines={5}
            onChangeText={setRemarks}
            placeholder="在这里输入备注..."
            placeholderTextColor="#9CA3AF"
            style={[styles.notesInput, { backgroundColor: surfaceMuted, borderColor }]}
            textAlignVertical="top"
            value={remarks}
          />
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <View style={[styles.bottomBar, { backgroundColor: surface, borderTopColor: borderColor }]}>
        <View style={styles.bottomInfoBlock}>
          <ThemedText style={styles.bottomAmountLabel} type="defaultSemiBold">
            订单总额
          </ThemedText>
          <ThemedText style={styles.bottomPrimaryAmount} type="defaultSemiBold">
            ¥ {formatMoney(receivableAmount)}
          </ThemedText>
          <ThemedText style={styles.bottomSummaryPrimary} type="defaultSemiBold">
            {bottomQuantitySummary}
          </ThemedText>
        </View>
        <View style={styles.bottomActions}>
          <Pressable
            disabled={isSubmitting}
            onPress={() => void handleSubmit('save')}
            style={[styles.secondaryButton, { borderColor }]}>
            <ThemedText style={styles.secondaryButtonText} type="defaultSemiBold">
              仅保存
            </ThemedText>
          </Pressable>

          <Pressable
            disabled={isSubmitting}
            onPress={() => setShowQuickCreateConfirm(true)}
            style={[
              styles.primaryButton,
              { backgroundColor: tintColor, opacity: isSubmitting ? 0.7 : 1 },
            ]}>
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <ThemedText style={styles.primaryButtonText} type="defaultSemiBold">
                快速开单
              </ThemedText>
            )}
          </Pressable>
        </View>
      </View>

      <Modal animationType="fade" onRequestClose={() => setShowQuickCreateConfirm(false)} transparent visible={showQuickCreateConfirm}>
        <View style={styles.dialogBackdrop}>
          <View style={[styles.dialogCard, { backgroundColor: surface, borderColor }]}>
            <ThemedText style={styles.dialogTitle} type="defaultSemiBold">
              确认快速开单？
            </ThemedText>
            <ThemedText style={styles.dialogText}>
              系统将自动保存订单、创建发货单并生成销售发票。若商品、地址或金额仍可能调整，建议先选择“仅保存”。
            </ThemedText>
            <View style={styles.dialogTipCard}>
              <ThemedText style={styles.dialogTipTitle} type="defaultSemiBold">
                执行后会发生什么
              </ThemedText>
              <ThemedText style={styles.dialogTipText}>
                下单成功后会直接进入发票详情页，后续如需修改，应走快捷回退或分步回退流程。
              </ThemedText>
            </View>
            <View style={styles.dialogActions}>
              <Pressable
                onPress={() => setShowQuickCreateConfirm(false)}
                style={[styles.dialogButton, styles.dialogGhostButton, { borderColor }]}>
                <ThemedText style={styles.dialogGhostText} type="defaultSemiBold">
                  先不处理
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowQuickCreateConfirm(false);
                  void handleSubmit('quick');
                }}
                style={[styles.dialogButton, styles.dialogPrimaryButton, { backgroundColor: tintColor }]}>
                <ThemedText style={styles.dialogPrimaryText} type="defaultSemiBold">
                  {isSubmitting && submitMode === 'quick' ? '开单中...' : '确认快速开单'}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => setShowQuickForceConfirm(false)}
        transparent
        visible={showQuickForceConfirm}>
        <View style={styles.dialogBackdrop}>
          <View style={[styles.dialogCard, { backgroundColor: surface, borderColor }]}>
            <ThemedText style={styles.dialogTitle} type="defaultSemiBold">
              库存不足，是否继续快速开单？
            </ThemedText>
            <ThemedText style={styles.dialogText}>
              正常快速开单已被库存校验拦截。如果你确认按实物先出货，可以继续强制出货并完成开票。
            </ThemedText>
            <View style={styles.dialogTipCard}>
              <ThemedText style={styles.dialogTipTitle} type="defaultSemiBold">
                当前拦截原因
              </ThemedText>
              <ThemedText style={styles.dialogTipText}>
                {quickForceMessage || '库存不足，请先核对库存和订单数量。'}
              </ThemedText>
            </View>
            <View style={styles.dialogActions}>
              <Pressable
                onPress={() => setShowQuickForceConfirm(false)}
                style={[styles.dialogButton, styles.dialogGhostButton, { borderColor }]}>
                <ThemedText style={styles.dialogGhostText} type="defaultSemiBold">
                  返回检查
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowQuickForceConfirm(false);
                  void handleSubmit('quick', { forceDelivery: true });
                }}
                style={[styles.dialogButton, styles.dialogDangerButton]}>
                <ThemedText style={styles.dialogPrimaryText} type="defaultSemiBold">
                  强制出货并开票
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => setShowLeaveConfirm(false)}
        transparent
        visible={showLeaveConfirm}>
        <View style={styles.dialogBackdrop}>
          <View style={[styles.dialogCard, { backgroundColor: surface, borderColor }]}>
            <ThemedText style={styles.dialogTitle} type="defaultSemiBold">
              离开当前开单页？
            </ThemedText>
            <ThemedText style={styles.dialogText}>
              当前填写内容已经暂存为草稿。离开后可以稍后继续编辑，但本次内容还没有正式提交为销售订单。
            </ThemedText>
            <View style={styles.dialogActions}>
              <Pressable
                onPress={() => {
                  pendingNavigationActionRef.current = null;
                  setShowLeaveConfirm(false);
                }}
                style={[styles.dialogButton, styles.dialogGhostButton, { borderColor }]}>
                <ThemedText style={styles.dialogGhostText} type="defaultSemiBold">
                  继续填写
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowLeaveConfirm(false);
                  const pendingAction = pendingNavigationActionRef.current;
                  pendingNavigationActionRef.current = null;
                  allowLeaveRef.current = true;
                  if (pendingAction) {
                    navigation.dispatch(pendingAction);
                  } else {
                    returnToSalesHome();
                  }
                }}
                style={[styles.dialogButton, styles.dialogPrimaryButton, { backgroundColor: tintColor }]}>
                <ThemedText style={styles.dialogPrimaryText} type="defaultSemiBold">
                  离开页面
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
  page: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  headerAction: {
    alignItems: 'flex-end',
    minWidth: 56,
  },
  heroCard: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 14,
    padding: 16,
  },
  heroHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroHeaderCopy: {
    flex: 1,
    paddingRight: 12,
  },
  heroSubtitle: {
    color: '#5F6B7A',
    fontSize: 13,
    marginTop: 4,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusPillText: {
    fontSize: 12,
  },
  infoFieldBlock: {
    gap: 8,
    position: 'relative',
    zIndex: 40,
  },
  infoFieldLabel: {
    fontSize: 14,
  },
  heroMetaGrid: {
    flexDirection: 'row',
    gap: 12,
    zIndex: 1,
  },
  defaultModeBlock: {
    gap: 8,
    zIndex: 1,
  },
  defaultModeHeader: {
    gap: 4,
  },
  defaultModeLabel: {
    fontSize: 14,
  },
  defaultModeHint: {
    color: '#6B7280',
    fontSize: 12,
  },
  salesModeSwitch: {
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    padding: 4,
  },
  salesModeSwitchOption: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 12,
  },
  salesModeSwitchText: {
    color: '#6B7280',
    fontSize: 13,
  },
  heroStatGrid: {
    flexDirection: 'row',
    gap: 12,
    zIndex: 1,
  },
  heroMetaValue: {
    fontSize: 18,
  },
  heroStatValue: {
    fontSize: 18,
  },
  heroReceivableValue: {
    color: '#C97A1E',
    fontSize: 20,
    fontWeight: '700',
  },
  summaryMetric: {
    backgroundColor: '#F5F7FA',
    borderRadius: 18,
    flex: 1,
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  summaryMetricLabel: {
    color: '#6B7280',
    fontSize: 12,
  },
  quickActionsCard: {
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  quickActionButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-start',
    minHeight: 76,
    paddingHorizontal: 12,
  },
  quickActionCopy: {
    flex: 1,
    minWidth: 0,
  },
  quickActionIcon: {
    alignItems: 'center',
    borderRadius: 14,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  quickActionDivider: {
    width: 1,
  },
  quickActionLabel: {
    fontSize: 16,
  },
  quickActionHint: {
    color: '#8B95A7',
    fontSize: 12,
    marginTop: 2,
  },
  sectionCard: {
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  sectionAccent: {
    borderRadius: 999,
    height: 18,
    width: 4,
  },
  sectionTitle: {
    fontSize: 18,
  },
  sectionHint: {
    color: '#8B95A7',
    fontSize: 12,
    marginTop: 2,
  },




  bannerText: {
    fontSize: 13,
  },
  undoBanner: {
    alignItems: 'center',
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  undoBannerText: {
    color: '#4B5563',
    flex: 1,
    fontSize: 13,
    marginRight: 12,
  },
  undoButton: {
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  undoButtonText: {
    fontSize: 13,
  },







  textActionButton: {
    paddingVertical: 2,
  },
  textAction: {
    fontSize: 13,
  },
  emptyText: {
    color: '#374151',
    fontSize: 15,
    paddingVertical: 8,
  },

  draftHint: {
    color: '#6B7280',
    fontSize: 13,
  },
  validationCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  validationTitle: {
    color: '#991B1B',
    fontSize: 14,
  },
  validationText: {
    color: '#7F1D1D',
    fontSize: 13,
    lineHeight: 20,
  },
  itemList: {
    gap: 10,
  },
  groupedItemCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    gap: 12,
    padding: 12,
  },
  groupedItemHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  groupedItemCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  groupedItemTitle: {
    fontSize: 16,
  },
  groupedItemMeta: {
    color: '#64748B',
    fontSize: 12,
  },
  groupedItemSummary: {
    color: '#2563EB',
    fontSize: 13,
  },
  groupedItemAmount: {
    color: '#A86518',
    fontSize: 18,
  },
  groupedItemRows: {
    gap: 10,
  },
  sectionFooter: {
    alignItems: 'center',
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  sectionFooterText: {
    fontSize: 16,
  },
  sectionFooterAmount: {
    color: '#A86518',
    fontSize: 20,
  },
  amountRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 28,
  },
  amountLabel: {
    color: '#6B7280',
    fontSize: 14,
  },
  amountValue: {
    color: '#1F2937',
    fontSize: 16,
  },
  amountStrongWrap: {
    borderRadius: 16,
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  amountLabelStrong: {
    color: '#7C4A10',
    fontSize: 15,
  },
  amountValueStrong: {
    color: '#C97A1E',
    fontSize: 26,
  },
  foldHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  foldAction: {
    color: '#6B7280',
    fontSize: 14,
  },
  foldBody: {
    gap: 12,
  },
  shippingGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  shippingFieldBlock: {
    flex: 1,
    gap: 6,
  },
  shippingFieldLabel: {
    fontSize: 13,
  },
  shippingInput: {
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 14,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  shippingTextarea: {
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 14,
    minHeight: 92,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  recentAddressBlock: {
    gap: 8,
  },
  recentAddressList: {
    gap: 8,
  },
  recentAddressChip: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  recentAddressText: {
    color: '#425466',
    fontSize: 13,
    lineHeight: 18,
  },
  infoNotice: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  infoNoticeText: {
    color: '#6B7280',
    fontSize: 13,
    lineHeight: 20,
  },
  notesInput: {
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 128,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bottomSpacer: {
    height: 124,
  },
  bottomBar: {
    borderTopWidth: 1,
    gap: 12,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
  },
  bottomInfoBlock: {
    gap: 2,
  },
  bottomSummaryPrimary: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 18,
  },
  bottomAmountLabel: {
    color: '#9A3412',
    fontSize: 13,
    fontWeight: '700',
  },
  bottomPrimaryAmount: {
    color: '#C97A1E',
    fontSize: 28,
    fontWeight: '700',
  },
  bottomActions: {
    flexDirection: 'row',
    gap: 10,
  },
  dialogBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.22)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  dialogCard: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    maxWidth: 420,
    padding: 20,
    width: '100%',
  },
  dialogTitle: {
    color: '#0F172A',
    fontSize: 18,
  },
  dialogText: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 22,
  },
  dialogTipCard: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dialogTipTitle: {
    color: '#9A3412',
    fontSize: 14,
  },
  dialogTipText: {
    color: '#7C2D12',
    fontSize: 13,
    lineHeight: 20,
  },
  dialogActions: {
    flexDirection: 'row',
    gap: 12,
  },
  dialogButton: {
    alignItems: 'center',
    borderRadius: 16,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
  dialogGhostButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
  },
  dialogGhostText: {
    color: '#1D4ED8',
  },
  dialogPrimaryButton: {
    backgroundColor: '#2563EB',
  },
  dialogDangerButton: {
    backgroundColor: '#DC2626',
  },
  dialogPrimaryText: {
    color: '#FFFFFF',
  },
  secondaryButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: '#1D4ED8',
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 16,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: '#FFFFFF',
  },
});
