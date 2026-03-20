import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { LinkOptionInput } from '@/components/link-option-input';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { WorkflowQuickNav } from '@/components/workflow-quick-nav';
import { useThemeColor } from '@/hooks/use-theme-color';
import { normalizeAppError } from '@/lib/app-error';
import { getAppPreferences } from '@/lib/app-preferences';
import {
  compactAddressText,
  composeStructuredAddressText,
  normalizeText,
  requireText,
  toOptionalText,
} from '@/lib/form-utils';
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
import {
  getProductDetail,
  type LinkOption,
} from '@/services/master-data';
import {
  companyExists,
  searchCompanies,
  submitQuickSalesOrderV2,
  submitSalesOrderV2,
} from '@/services/sales';

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

function SalesItemRow({
  itemCode,
  itemName,
  imageUrl,
  price,
  qty,
  warehouse,
  onChangePrice,
  onChangeQty,
  onRemove,
}: {
  itemCode: string;
  itemName: string;
  imageUrl?: string | null;
  price: number | null;
  qty: number;
  warehouse?: string | null;
  onChangePrice: (value: string) => void;
  onChangeQty: (value: string) => void;
  onRemove: () => void;
}) {
  const [qtyText, setQtyText] = useState(String(qty));
  const surface = useThemeColor({}, 'surface');
  const borderColor = useThemeColor({}, 'border');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const dangerColor = useThemeColor({}, 'danger');
  const tintColor = useThemeColor({}, 'tint');
  const lineAmount = (price ?? 0) * qty;

  useEffect(() => {
    setQtyText(String(qty));
  }, [qty]);

  const commitQty = (rawValue: string) => {
    const normalized = rawValue.replace(/[^0-9]/g, '');

    if (!normalized) {
      setQtyText(String(qty));
      return;
    }

    const nextQty = Math.max(1, Number(normalized) || qty);
    setQtyText(String(nextQty));
    onChangeQty(String(nextQty));
  };

  const handleDecrease = () => {
    if (qty <= 1) {
      setQtyText('1');
      return;
    }

    const nextQty = Math.max(1, qty - 1);
    setQtyText(String(nextQty));
    onChangeQty(String(nextQty));
  };

  const handleIncrease = () => {
    const nextQty = qty + 1;
    setQtyText(String(nextQty));
    onChangeQty(String(nextQty));
  };

  return (
    <View style={[styles.itemRow, { backgroundColor: surface, borderColor }]}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.itemThumbImage} />
      ) : (
        <View style={[styles.itemThumb, { backgroundColor: surfaceMuted }]}>
          <IconSymbol color="#28B7D7" name="shippingbox.fill" size={20} />
        </View>
      )}

      <View style={styles.itemMain}>
        <View style={styles.itemHeaderRow}>
          <View style={styles.itemHeaderCopy}>
            <ThemedText numberOfLines={1} style={styles.itemTitle} type="defaultSemiBold">
              {itemName || itemCode}
            </ThemedText>
            <ThemedText style={styles.itemSubline}>{'\u7f16\u7801 '} {itemCode}</ThemedText>
            <ThemedText style={styles.itemSubline}>{'\u4ed3\u5e93 '} {warehouse || '\u672a\u6307\u5b9a\u4ed3\u5e93'}</ThemedText>
          </View>

          <View style={styles.itemHeaderAside}>
            <ThemedText style={styles.itemAmountInline} type="defaultSemiBold">
              {'\u00A5'} {formatMoney(lineAmount)}
            </ThemedText>
            <Pressable onPress={onRemove} style={[styles.removeButton, { borderColor }]}> 
              <ThemedText style={[styles.textAction, { color: dangerColor }]}>{'\u5220\u9664'}</ThemedText>
            </Pressable>
          </View>
        </View>

        <View style={styles.itemEditRow}>
          <View style={styles.itemEditBlockCompact}>
            <ThemedText style={styles.itemEditLabel}>{'\u6570\u91cf'}</ThemedText>
            <View style={[styles.qtyStepper, { backgroundColor: surfaceMuted, borderColor }]}> 
              <Pressable
                disabled={qty <= 1}
                onPress={handleDecrease}
                style={[styles.qtyActionButton, qty <= 1 && styles.qtyActionButtonDisabled]}>
                <ThemedText style={[styles.qtyActionText, { color: tintColor }]} type="defaultSemiBold">
                  -
                </ThemedText>
              </Pressable>
              <TextInput
                keyboardType="number-pad"
                onBlur={() => commitQty(qtyText)}
                onChangeText={(value) => setQtyText(value.replace(/[^0-9]/g, ''))}
                onSubmitEditing={() => commitQty(qtyText)}
                returnKeyType="done"
                selectTextOnFocus
                style={styles.qtyInput}
                value={qtyText}
              />
              <Pressable onPress={handleIncrease} style={styles.qtyActionButton}>
                <ThemedText style={[styles.qtyActionText, { color: tintColor }]} type="defaultSemiBold">
                  +
                </ThemedText>
              </Pressable>
            </View>
          </View>

          <View style={styles.itemEditBlockPrice}>
            <ThemedText style={styles.itemEditLabel}>{'\u5355\u4ef7'}</ThemedText>
            <View style={[styles.priceInputWrap, { backgroundColor: surfaceMuted, borderColor }]}>
              <ThemedText style={styles.pricePrefix}>{'\u00A5'}</ThemedText>
              <TextInput
                keyboardType="numeric"
                onChangeText={onChangePrice}
                style={styles.priceInput}
                value={price === null ? '' : String(price)}
              />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function SalesOrderCreateScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const preferences = getAppPreferences();
  const { profile } = useAuth();
  const { showError, showSuccess } = useFeedback();
  const isFocused = useIsFocused();
  const initialDraftForm = getSalesOrderDraftForm();

  const [customer, setCustomer] = useState(initialDraftForm.customer);
  const [company, setCompany] = useState(initialDraftForm.company || preferences.defaultCompany);
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
      remarks,
      shippingAddress,
      shippingContact,
      shippingPhone,
    });
  }, [company, customer, remarks, shippingAddress, shippingContact, shippingPhone]);

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
    const missingImageItems = draftItems.filter((item) => !item.imageUrl && item.itemCode);

    if (!missingImageItems.length) {
      return;
    }

    let active = true;

    void Promise.all(
      missingImageItems.map(async (item) => {
        const detail = await getProductDetail(item.itemCode);
        if (!active || !detail?.imageUrl) {
          return;
        }

        restoreSalesOrderDraftItem({ ...item, imageUrl: detail.imageUrl });
      }),
    ).then(() => {
      if (active) {
        syncDraft();
      }
    });

    return () => {
      active = false;
    };
  }, [draftItems]);

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

  return (
    <View style={[styles.page, { backgroundColor: background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} ref={scrollRef}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => {
              if (hasDraftContent && !allowLeaveRef.current && !isSubmitting) {
                setShowLeaveConfirm(true);
                return;
              }
              router.back();
            }}
            style={styles.iconCircle}>
            <IconSymbol color="#111827" name="chevron.left" size={20} />
          </Pressable>

          <ThemedText style={styles.topTitle} type="title">
            销售单
          </ThemedText>

          <Pressable
            onPress={() => setStatusMessage('AI 开单功能开发中。', 'info')}
            style={styles.aiTrigger}>
            <ThemedText style={{ color: tintColor }} type="defaultSemiBold">
              AI开单
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.quickNavWrap}>
          <WorkflowQuickNav compact />
        </View>

        <View
          onLayout={(event) => {
            customerSectionYRef.current = event.nativeEvent.layout.y;
          }}
          style={[styles.heroCard, { backgroundColor: surface, borderColor }]}>
          <View style={styles.heroHeader}>
            <View>
              <ThemedText type="title">销售单</ThemedText>
              <ThemedText style={styles.heroSubtitle}>销售单工作台</ThemedText>
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
            onPress={() => router.push('/common/product-search?mode=order')}
            style={styles.quickActionButton}>
            <View style={[styles.quickActionIcon, { backgroundColor: accentSoft }]}>
              <IconSymbol color={tintColor} name="cart.fill.badge.plus" size={18} />
            </View>
            <View>
              <ThemedText style={styles.quickActionLabel} type="defaultSemiBold">
                选择商品
              </ThemedText>
                <ThemedText style={styles.quickActionHint}>进入商品搜索页选择</ThemedText>
            </View>
          </Pressable>

          <View style={[styles.quickActionDivider, { backgroundColor: borderColor }]} />

          <Pressable
            onPress={() => setStatusMessage('扫码添加功能开发中。', 'info')}
            style={styles.quickActionButton}>
            <View style={[styles.quickActionIcon, { backgroundColor: accentSoft }]}>
              <IconSymbol color={tintColor} name="barcode.viewfinder" size={18} />
            </View>
            <View>
              <ThemedText style={styles.quickActionLabel} type="defaultSemiBold">
                扫码添加
              </ThemedText>
              <ThemedText style={styles.quickActionHint}>预留扫码入口</ThemedText>
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
                {draftItems.map((item) => (
                  <SalesItemRow
                    itemCode={item.itemCode}
                    itemName={item.itemName}
                    imageUrl={item.imageUrl}
                    key={item.draftKey}
                    onChangePrice={(value) => {
                      updateSalesOrderDraftField(
                        item.draftKey,
                        'price',
                        value === '' ? null : Number(value) || 0,
                      );
                      syncDraft();
                    }}
                    onChangeQty={(value) => {
                      updateSalesOrderDraftQty(item.draftKey, Number(value) || 0);
                      syncDraft();
                    }}
                    onRemove={() => {
                      handleRemoveItem(item);
                    }}
                    price={item.price}
                    qty={item.qty}
                    warehouse={item.warehouse || preferences.defaultWarehouse}
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
                请先通过“选择商品”或“扫码添加”把本单要卖的商品加入进来，再继续保存或快速开单。
              </ThemedText>
            </View>
          ) : null}

          <View style={[styles.sectionFooter, { borderTopColor: borderColor }]}>
            <ThemedText style={styles.sectionFooterText}>
              合计 已选 {totalQty} 项
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
        <View>
          <ThemedText style={styles.bottomPrimaryAmount} type="defaultSemiBold">
            应收: ¥ {formatMoney(receivableAmount)}
          </ThemedText>
          <ThemedText style={styles.bottomSecondaryAmount}>
            快速开单会自动生成发货单和销售发票
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
                    router.back();
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
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 12,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  iconCircle: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  topTitle: {
    fontSize: 18,
  },
  aiTrigger: {
    alignItems: 'flex-end',
    minWidth: 56,
  },
  quickNavWrap: {
    marginBottom: 2,
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
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 76,
    paddingHorizontal: 12,
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
    gap: 12,
  },
  itemRow: {
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 14,
  },
  itemThumb: {
    alignItems: 'center',
    borderRadius: 18,
    height: 60,
    justifyContent: 'center',
    width: 60,
  },
  itemThumbImage: {
    borderRadius: 18,
    height: 60,
    width: 60,
  },
  itemMain: {
    flex: 1,
    gap: 6,
  },
  itemHeaderRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    minHeight: 60,
  },
  itemHeaderCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  itemHeaderAside: {
    alignItems: 'flex-end',
    gap: 10,
  },
  itemTitle: {
    flex: 1,
    fontSize: 16,
    marginRight: 12,
  },
  itemAmountInline: {
    color: '#2D3748',
    fontSize: 18,
  },
  itemSubline: {
    color: '#6B7280',
    fontSize: 12,
  },
  itemEditRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  itemEditBlockCompact: {
    flexShrink: 0,
    gap: 4,
    width: 110,
  },
  itemEditBlockPrice: {
    flex: 1,
    gap: 4,
  },
  itemEditLabel: {
    color: '#6B7280',
    fontSize: 11,
  },
  qtyStepper: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    height: 36,
    overflow: 'hidden',
  },
  qtyActionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    width: 30,
  },
  qtyActionButtonDisabled: {
    opacity: 0.35,
  },
  qtyActionText: {
    fontSize: 18,
    lineHeight: 18,
  },
  qtyInput: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '600',
    height: 36,
    minWidth: 34,
    paddingHorizontal: 2,
    textAlign: 'center',
    width: 42,
  },
  priceInputWrap: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    height: 36,
    paddingHorizontal: 10,
  },
  pricePrefix: {
    color: '#6B7280',
    fontSize: 13,
  },
  priceInput: {
    color: '#111827',
    flex: 1,
    fontSize: 15,
    height: 36,
    paddingVertical: 0,
  },
  removeButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 30,
    paddingHorizontal: 10,
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
    height: 92,
  },
  bottomBar: {
    alignItems: 'center',
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  bottomPrimaryAmount: {
    color: '#C97A1E',
    fontSize: 22,
  },
  bottomSecondaryAmount: {
    color: '#6B7280',
    fontSize: 14,
    marginTop: 4,
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
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 72,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: '#1D4ED8',
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 16,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 78,
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: '#FFFFFF',
  },
});
