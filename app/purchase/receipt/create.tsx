import { useEffect, useState } from 'react';
import type { Href } from 'expo-router';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { DateFieldInput } from '@/components/date-field-input';
import { LinkOptionInput } from '@/components/link-option-input';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { normalizeAppError } from '@/lib/app-error';
import { getTodayIsoDate, isValidIsoDate } from '@/lib/date-value';
import { sanitizeDecimalInput } from '@/lib/numeric-input';
import { useFeedback } from '@/providers/feedback-provider';
import {
  cancelPurchaseReceipt,
  fetchPurchaseOrderDetail,
  fetchPurchaseReceiptDetail,
  searchPurchaseOrders,
  submitPurchaseReceipt,
  type PurchaseOrderDetail,
  type PurchaseReceiptDetail,
} from '@/services/purchases';

type EditableReceiptItem = {
  key: string;
  purchaseOrderItem: string;
  itemCode: string;
  itemName: string;
  warehouse: string;
  uom: string;
  orderedQty: number;
  receivedQty: number;
  pendingQty: number;
  qtyInput: string;
  priceInput: string;
  rate: number | null;
};

type ReceiptItemGroup = {
  key: string;
  itemCode: string;
  itemName: string;
  uom: string;
  totalQty: number;
  totalAmount: number;
  lines: PurchaseReceiptDetail['items'];
};

function sanitizeTimeInput(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 6);
  if (!digits) {
    return '';
  }
  if (digits.length <= 2) {
    return digits;
  }
  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  }
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}:${digits.slice(4)}`;
}

function normalizeTimeOnBlur(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 6);
  if (!digits) {
    return '';
  }
  const hh = digits.slice(0, 2).padEnd(2, '0');
  const mm = digits.slice(2, 4).padEnd(2, '0');
  const ss = digits.slice(4, 6).padEnd(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function isValidTimeValue(raw: string) {
  const normalized = raw.trim();
  const match = normalized.match(/^(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) {
    return false;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 && second >= 0 && second <= 59;
}

function normalizeDecimalOnBlur(raw: string) {
  const value = raw.trim();
  if (!value) {
    return '';
  }
  const normalized = value.endsWith('.') ? value.slice(0, -1) : value;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return '';
  }
  return parsed.toString();
}

function getCurrentTimeHms() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function formatMoney(value: number | null, currency = 'CNY') {
  if (typeof value !== 'number') {
    return '—';
  }

  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatReceiptStatusLabel(status: string) {
  switch (status) {
    case 'draft':
      return '草稿';
    case 'submitted':
      return '已提交';
    case 'cancelled':
      return '已作废';
    default:
      return status || '未确认';
  }
}

function formatReceivingStatusLabel(status: string) {
  switch (status) {
    case 'pending':
      return '待收货';
    case 'partial':
      return '部分收货';
    case 'received':
      return '已收货';
    default:
      return status || '未确认';
  }
}

function formatQty(value: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(2);
}

export default function PurchaseReceiptCreateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderName?: string; receiptName?: string; notice?: string }>();
  const { showError, showSuccess, showInfo } = useFeedback();
  const [orderName, setOrderName] = useState(typeof params.orderName === 'string' ? params.orderName.trim() : '');
  const [postingDate, setPostingDate] = useState(getTodayIsoDate());
  const [postingTime, setPostingTime] = useState(getCurrentTimeHms());
  const [remarks, setRemarks] = useState('');
  const [orderDetail, setOrderDetail] = useState<PurchaseOrderDetail | null>(null);
  const [receiptDetail, setReceiptDetail] = useState<PurchaseReceiptDetail | null>(null);
  const [editableItems, setEditableItems] = useState<EditableReceiptItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelResultOpen, setCancelResultOpen] = useState(false);
  const [expandedReceiptGroups, setExpandedReceiptGroups] = useState<Record<string, boolean>>({});

  const receiptName = typeof params.receiptName === 'string' ? params.receiptName.trim() : '';
  const surface = useThemeColor({}, 'surface');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');

  useEffect(() => {
    if (params.notice === 'created' && receiptName) {
      showSuccess(`已登记采购收货：${receiptName}`);
    }
  }, [params.notice, receiptName, showSuccess]);

  useEffect(() => {
    if (typeof params.orderName === 'string' && params.orderName.trim()) {
      setOrderName(params.orderName.trim());
    }
  }, [params.orderName]);

  useEffect(() => {
    setPostingTime((current) => current.trim() || getCurrentTimeHms());
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (receiptName) {
        setIsLoading(true);
        try {
          const detail = await fetchPurchaseReceiptDetail(receiptName);
          if (!cancelled) {
            setReceiptDetail(detail);
            setOrderDetail(null);
          }
        } catch (error) {
          if (!cancelled) {
            showError(normalizeAppError(error).message);
          }
        } finally {
          if (!cancelled) {
            setIsLoading(false);
          }
        }
        return;
      }

      if (!orderName.trim()) {
        setOrderDetail(null);
        setReceiptDetail(null);
        return;
      }

      setIsLoading(true);
      try {
        const detail = await fetchPurchaseOrderDetail(orderName);
        if (!cancelled) {
          setOrderDetail(detail);
          setReceiptDetail(null);
        }
      } catch (error) {
        if (!cancelled) {
          showError(normalizeAppError(error).message);
          setOrderDetail(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [orderName, receiptName, showError]);

  useEffect(() => {
    if (!orderDetail || receiptDetail) {
      setEditableItems([]);
      return;
    }

    setEditableItems(
      orderDetail.items.map((item, index) => {
        const orderedQty = item.qty ?? 0;
        const receivedQty = item.receivedQty ?? 0;
        const pendingQty = Math.max(orderedQty - receivedQty, 0);
        return {
          key: item.purchaseOrderItem || `${item.itemCode}-${index}`,
          purchaseOrderItem: item.purchaseOrderItem,
          itemCode: item.itemCode,
          itemName: item.itemName,
          warehouse: item.warehouse,
          uom: item.uom,
          orderedQty,
          receivedQty,
          pendingQty,
          qtyInput: pendingQty > 0 ? String(pendingQty) : '0',
          priceInput: '',
          rate: item.rate,
        };
      }),
    );
  }, [orderDetail, receiptDetail]);

  const canCreateInvoiceForReceipt = Boolean(
    receiptDetail &&
      (receiptDetail.canCreateInvoice ||
        (receiptDetail.documentStatus === 'submitted' && receiptDetail.purchaseInvoices.length === 0)),
  );
  const primaryOrderNameFromReceipt = receiptDetail?.purchaseOrders[0]?.trim() || '';
  const actions: { href: Href; label: string; description?: string }[] = [];

  const handleSubmit = async () => {
    const trimmedOrderName = orderName.trim();
    if (!trimmedOrderName) {
      showError('请先填写采购订单号。');
      return;
    }

    if (!isValidIsoDate(postingDate)) {
      showError('请先选择有效收货日期。');
      return;
    }

    if (postingTime.trim() && !isValidTimeValue(postingTime)) {
      showError('收货时间格式不正确，请使用 24 小时制 HH:mm:ss。');
      return;
    }

    if (!orderDetail) {
      showError('当前采购订单详情尚未加载完成。');
      return;
    }

    if (!orderDetail.canReceive) {
      showInfo('这张采购订单当前不能继续收货，请先刷新状态或查看是否已经全部收货。');
      return;
    }

    const receiptItems = [];
    for (const item of editableItems) {
      const qtyValue = Number(item.qtyInput.trim());
      if (!Number.isFinite(qtyValue) || qtyValue < 0) {
        showError(`商品 ${item.itemName || item.itemCode} 的本次收货数量不合法。`);
        return;
      }

      if (qtyValue === 0) {
        continue;
      }

      const priceText = item.priceInput.trim();
      if (priceText) {
        const priceValue = Number(priceText);
        if (!Number.isFinite(priceValue) || priceValue < 0) {
          showError(`商品 ${item.itemName || item.itemCode} 的实际单价不合法。`);
          return;
        }
        receiptItems.push({
          purchaseOrderItem: item.purchaseOrderItem,
          itemCode: item.itemCode,
          qty: qtyValue,
          price: priceValue,
        });
        continue;
      }

      receiptItems.push({
        purchaseOrderItem: item.purchaseOrderItem,
        itemCode: item.itemCode,
        qty: qtyValue,
      });
    }

    if (receiptItems.length === 0) {
      showError('请至少选择一行商品，并填写大于 0 的本次收货数量。');
      return;
    }

    try {
      setIsSubmitting(true);
      const nextReceiptName = await submitPurchaseReceipt({
        orderName: trimmedOrderName,
        postingDate,
        postingTime,
        remarks,
        receiptItems,
      });
      if (!nextReceiptName) {
        throw new Error('采购收货提交成功，但未返回收货单号。');
      }

      router.replace({
        pathname: '/purchase/receipt/create',
        params: {
          receiptName: nextReceiptName,
          orderName: trimmedOrderName,
          notice: 'created',
        },
      });
    } catch (error) {
      showError(normalizeAppError(error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelReceipt = async () => {
    if (!receiptDetail?.name) {
      showError('缺少采购收货单号。');
      return;
    }

    try {
      setIsCancelling(true);
      const result = await cancelPurchaseReceipt(receiptDetail.name);
      const refreshedDetail = await fetchPurchaseReceiptDetail(result.receiptName);
      if (refreshedDetail) {
        setReceiptDetail(refreshedDetail);
      }
      setShowCancelDialog(false);
      setCancelResultOpen(true);
      showSuccess(result.message || `采购收货单 ${result.receiptName} 已作废。`);
    } catch (error) {
      showError(normalizeAppError(error).message);
    } finally {
      setIsCancelling(false);
    }
  };

  const updateEditableItem = (key: string, updater: (item: EditableReceiptItem) => EditableReceiptItem) => {
    setEditableItems((current) => current.map((item) => (item.key === key ? updater(item) : item)));
  };

  const selectedLineCount = editableItems.filter((item) => Number(item.qtyInput.trim()) > 0).length;
  const selectedQty = editableItems.reduce((sum, item) => {
    const qty = Number(item.qtyInput.trim());
    return sum + (Number.isFinite(qty) && qty > 0 ? qty : 0);
  }, 0);
  const canSubmitReceipt =
    !isSubmitting &&
    Boolean(orderDetail) &&
    Boolean(orderDetail?.canReceive) &&
    selectedLineCount > 0 &&
    isValidIsoDate(postingDate) &&
    (!postingTime.trim() || isValidTimeValue(postingTime));
  const isReceiptCancelled = receiptDetail?.documentStatus === 'cancelled';
  const receiptItemGroups: ReceiptItemGroup[] = receiptDetail
    ? Object.values(
        receiptDetail.items.reduce<Record<string, ReceiptItemGroup>>((groups, item, index) => {
          const groupKey = item.itemCode?.trim() || `${item.itemName || '未命名商品'}-${index}`;
          const existing = groups[groupKey];
          const qtyValue = typeof item.qty === 'number' && Number.isFinite(item.qty) ? item.qty : 0;
          const amountValue = typeof item.amount === 'number' && Number.isFinite(item.amount) ? item.amount : qtyValue * (item.rate || 0);
          if (!existing) {
            groups[groupKey] = {
              key: groupKey,
              itemCode: item.itemCode || '未编码',
              itemName: item.itemName || item.itemCode || '未命名商品',
              uom: item.uom || '',
              totalQty: qtyValue,
              totalAmount: amountValue,
              lines: [item],
            };
            return groups;
          }
          existing.totalQty += qtyValue;
          existing.totalAmount += amountValue;
          existing.lines.push(item);
          return groups;
        }, {})
      )
    : [];

  useEffect(() => {
    if (!receiptDetail) {
      setExpandedReceiptGroups({});
      return;
    }
    const groupKeys = Array.from(
      new Set(
        receiptDetail.items.map((item, index) => item.itemCode?.trim() || `${item.itemName || '未命名商品'}-${index}`)
      )
    );
    setExpandedReceiptGroups((current) => {
      const next: Record<string, boolean> = {};
      groupKeys.forEach((key) => {
        next[key] = current[key] ?? false;
      });
      return next;
    });
  }, [receiptDetail]);

  return (
    <AppShell
      actions={actions}
      title="采购收货"
      description="先确认采购订单，再登记本次实际到货。采购收货记录的是库存入库事实，不等于供应商已经开票。"
      compactHeader
      contentCard={false}
      footer={
        receiptDetail ? (
          <View style={styles.footerWrap}>
            <ThemedText style={styles.footerHint}>
              {isReceiptCancelled
                ? '当前收货单已作废，建议返回采购订单确认最新状态。'
                : '收货单提交后明细锁定，如需调整请先处理下游发票，再执行回退。'}
            </ThemedText>
            <View style={styles.footerActionRow}>
              {primaryOrderNameFromReceipt ? (
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/purchase/order/[orderName]',
                      params: { orderName: primaryOrderNameFromReceipt },
                    })
                  }
                  style={[styles.footerActionButton, styles.secondaryActionButton, { borderColor }]}>
                  <ThemedText style={[styles.secondaryActionText, { color: tintColor }]} type="defaultSemiBold">
                    返回订单
                  </ThemedText>
                </Pressable>
              ) : null}
              {!isReceiptCancelled ? (
                canCreateInvoiceForReceipt ? (
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: '/purchase/invoice/create',
                        params: { receiptName: receiptDetail.name },
                      })
                    }
                    style={[styles.footerActionButton, styles.footerButton, { backgroundColor: tintColor }]}>
                    <ThemedText style={styles.footerButtonText} type="defaultSemiBold">
                      去登记发票
                    </ThemedText>
                  </Pressable>
                ) : receiptDetail.purchaseInvoices[0] ? (
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: '/purchase/invoice/create',
                        params: { purchaseInvoice: receiptDetail.purchaseInvoices[0] },
                      })
                    }
                    style={[styles.footerActionButton, styles.footerButton, { backgroundColor: tintColor }]}>
                    <ThemedText style={styles.footerButtonText} type="defaultSemiBold">
                      查看发票
                    </ThemedText>
                  </Pressable>
                ) : (
                  <Pressable
                    disabled
                    style={[styles.footerActionButton, styles.footerButton, { backgroundColor: surfaceMuted }]}>
                    <ThemedText style={styles.footerButtonText} type="defaultSemiBold">
                      当前不可开票
                    </ThemedText>
                  </Pressable>
                )
              ) : null}
            </View>
          </View>
        ) : (
          <View style={styles.footerWrap}>
            <ThemedText style={styles.footerHint}>提交前可随时返回采购订单继续核对明细或调整后再收货。</ThemedText>
            <View style={styles.footerActionRow}>
              <Pressable
                disabled={!orderName.trim()}
                onPress={() =>
                  router.push({
                    pathname: '/purchase/order/[orderName]',
                    params: { orderName: orderName.trim() },
                  })
                }
                style={[
                  styles.footerActionButton,
                  styles.secondaryActionButton,
                  { borderColor: orderName.trim() ? borderColor : surfaceMuted, opacity: orderName.trim() ? 1 : 0.6 },
                ]}>
                <ThemedText style={[styles.secondaryActionText, { color: tintColor }]} type="defaultSemiBold">
                  返回订单
                </ThemedText>
              </Pressable>
              <Pressable
                disabled={!canSubmitReceipt}
                onPress={handleSubmit}
                style={[styles.footerActionButton, styles.footerButton, { backgroundColor: canSubmitReceipt ? tintColor : surfaceMuted }]}>
                <ThemedText style={styles.footerButtonText} type="defaultSemiBold">
                  {isSubmitting ? '正在登记采购收货...' : canSubmitReceipt ? '提交采购收货' : '当前不可提交'}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        )
      }>
      <ScrollView contentContainerStyle={styles.container}>
        {!receiptDetail ? (
          <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
            <LinkOptionInput
              label="采购订单号"
              loadOptions={searchPurchaseOrders}
              onChangeText={setOrderName}
              placeholder="搜索采购订单"
              value={orderName}
            />
            <View style={styles.row}>
              <View style={styles.field}>
                <DateFieldInput
                  errorText={!isValidIsoDate(postingDate) ? '请选择有效收货日期。' : undefined}
                  helperText="用于记录本次实际到货入库日期。"
                  label="收货日期"
                  onChange={setPostingDate}
                  value={postingDate}
                />
              </View>
              <View style={styles.field}>
                <ThemedText style={styles.label} type="defaultSemiBold">
                  收货时间
                </ThemedText>
                <View style={styles.timeFieldWrap}>
                  <TextInput
                    keyboardType="number-pad"
                    onBlur={() => setPostingTime((current) => normalizeTimeOnBlur(current))}
                    onChangeText={(value) => setPostingTime(sanitizeTimeInput(value))}
                    placeholder="HH:mm:ss"
                    style={[styles.input, styles.timeInput, { backgroundColor: surfaceMuted, borderColor }]}
                    value={postingTime}
                  />
                  <View style={styles.timeActionRow}>
                    <Pressable
                      onPress={() => setPostingTime(getCurrentTimeHms())}
                      style={[styles.timeActionButton, { backgroundColor: surface, borderColor }]}>
                      <ThemedText style={[styles.timeActionText, { color: tintColor }]} type="defaultSemiBold">
                        现在
                      </ThemedText>
                    </Pressable>
                    <Pressable
                      onPress={() => setPostingTime('')}
                      style={[styles.timeActionButton, { backgroundColor: surface, borderColor }]}>
                      <ThemedText style={styles.timeActionText} type="defaultSemiBold">
                        清空
                      </ThemedText>
                    </Pressable>
                  </View>
                </View>
                <ThemedText style={styles.inputHint}>支持输入 6 位数字自动格式化，例如 093015。</ThemedText>
              </View>
            </View>
            <View style={styles.field}>
              <ThemedText style={styles.label} type="defaultSemiBold">
                备注
              </ThemedText>
              <TextInput
                multiline
                onChangeText={setRemarks}
                placeholder="可选，记录本次到货说明"
                style={[styles.input, styles.textarea, { backgroundColor: surfaceMuted, borderColor }]}
                value={remarks}
              />
            </View>
          </View>
        ) : null}

        {isLoading ? (
          <View style={[styles.loadingCard, { backgroundColor: surface, borderColor }]}>
            <ActivityIndicator color={tintColor} />
            <ThemedText>正在读取采购信息...</ThemedText>
          </View>
        ) : null}

        {!isLoading && orderDetail && !receiptDetail ? (
          <>
            <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
              <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
                待收货订单
              </ThemedText>
              <DetailRow label="采购订单" value={orderDetail.name} />
              <DetailRow label="供应商" value={orderDetail.supplierName || orderDetail.supplier} />
              <DetailRow label="公司" value={orderDetail.company} />
              <DetailRow label="收货状态" value={formatReceivingStatusLabel(orderDetail.receivingStatus || '')} />
              <DetailRow
                label="订单金额"
                value={formatMoney(orderDetail.orderAmountEstimate, orderDetail.currency || 'CNY')}
              />
              <DetailRow
                label="已收 / 总量"
                value={`${orderDetail.receivedQty ?? '—'} / ${orderDetail.totalQty ?? '—'}`}
              />
              <DetailRow label="默认地址" value={orderDetail.defaultAddressDisplay || '未设置'} multiline />
              {!orderDetail.canReceive ? (
                <ThemedText style={styles.noticeText}>
                  这张采购订单当前不能继续收货。通常是已全部收货，或存在后续单据导致锁定。
                </ThemedText>
              ) : null}
            </View>

            <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
              <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
                本次收货摘要
              </ThemedText>
              <DetailRow label="本次收货行数" value={`${selectedLineCount} 行`} />
              <DetailRow label="本次收货数量" value={`${selectedQty || 0}`} />
              <ThemedText style={styles.summaryHint}>
                这次已经支持逐行收货。数量填 0 会跳过该行；如果实际到货价变了，可以只对需要调整的行填写“实际单价”。
              </ThemedText>
            </View>

            <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
              <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
                逐行收货
              </ThemedText>
              <View style={styles.itemList}>
                {editableItems.map((item) => (
                  <View key={item.key} style={[styles.itemCard, { backgroundColor: surfaceMuted }]}>
                    <View style={styles.itemHeader}>
                      <View style={styles.itemHeaderText}>
                        <ThemedText type="defaultSemiBold">{item.itemName || item.itemCode}</ThemedText>
                        <ThemedText style={styles.itemMeta}>编码 {item.itemCode}</ThemedText>
                      </View>
                      <Pressable
                        onPress={() =>
                          updateEditableItem(item.key, (current) => ({
                            ...current,
                            qtyInput: current.pendingQty > 0 ? String(current.pendingQty) : '0',
                          }))
                        }
                        style={[styles.inlineAction, { borderColor }]}>
                        <ThemedText style={styles.inlineActionText} type="defaultSemiBold">
                          收剩余量
                        </ThemedText>
                      </Pressable>
                    </View>

                    <ThemedText style={styles.itemMeta}>
                      订单 {item.orderedQty} · 已收 {item.receivedQty} · 待收 {item.pendingQty} · 仓库{' '}
                      {item.warehouse || '未设置'} · {item.uom || '库存单位'}
                    </ThemedText>
                    <ThemedText style={styles.itemMeta}>
                      当前订单单价 {formatMoney(item.rate, orderDetail.currency || 'CNY')}
                    </ThemedText>

                    <View style={styles.row}>
                      <View style={styles.field}>
                        <ThemedText style={styles.label} type="defaultSemiBold">
                          本次收货数量
                        </ThemedText>
                        <TextInput
                          keyboardType="decimal-pad"
                          onChangeText={(value) =>
                            updateEditableItem(item.key, (current) => ({
                              ...current,
                              qtyInput: sanitizeDecimalInput(value),
                            }))
                          }
                          onBlur={() =>
                            updateEditableItem(item.key, (current) => ({
                              ...current,
                              qtyInput: normalizeDecimalOnBlur(current.qtyInput),
                            }))
                          }
                          placeholder="填 0 可跳过"
                          style={[styles.input, { backgroundColor: surface, borderColor }]}
                          value={item.qtyInput}
                        />
                      </View>
                      <View style={styles.field}>
                        <ThemedText style={styles.label} type="defaultSemiBold">
                          实际单价
                        </ThemedText>
                        <TextInput
                          keyboardType="decimal-pad"
                          onChangeText={(value) =>
                            updateEditableItem(item.key, (current) => ({
                              ...current,
                              priceInput: sanitizeDecimalInput(value),
                            }))
                          }
                          placeholder="留空则沿用订单价"
                          style={[styles.input, { backgroundColor: surface, borderColor }]}
                          value={item.priceInput}
                        />
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </>
        ) : null}

        {!isLoading && receiptDetail ? (
          <>
            <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
              <View style={styles.receiptSummaryHeader}>
                <View style={styles.receiptSummaryTitleWrap}>
                  <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
                    收货已登记
                  </ThemedText>
                  <ThemedText style={styles.itemMeta}>收货单 {receiptDetail.name}</ThemedText>
                </View>
                <View style={styles.receiptStatusPill}>
                  <ThemedText style={styles.receiptStatusText} type="defaultSemiBold">
                    {formatReceiptStatusLabel(receiptDetail.documentStatus || '')}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.receiptMetricGrid}>
                <View style={[styles.receiptMetricCard, { backgroundColor: surfaceMuted }]}>
                  <ThemedText style={styles.receiptMetricLabel}>收货金额</ThemedText>
                  <ThemedText style={[styles.receiptMetricValue, styles.receiptMetricAmountValue]} type="defaultSemiBold">
                    {formatMoney(receiptDetail.receiptAmountEstimate, receiptDetail.currency || 'CNY')}
                  </ThemedText>
                </View>
                <View style={[styles.receiptMetricCard, { backgroundColor: surfaceMuted }]}>
                  <ThemedText style={styles.receiptMetricLabel}>总数量</ThemedText>
                  <ThemedText style={styles.receiptMetricValue} type="defaultSemiBold">
                    {formatQty(receiptDetail.totalQty)}
                  </ThemedText>
                </View>
                <View style={[styles.receiptMetricCard, { backgroundColor: surfaceMuted }]}>
                  <ThemedText style={styles.receiptMetricLabel}>供应商</ThemedText>
                  <ThemedText style={styles.receiptMetricValue} numberOfLines={1} type="defaultSemiBold">
                    {receiptDetail.supplierName || receiptDetail.supplier || '—'}
                  </ThemedText>
                </View>
                <View style={[styles.receiptMetricCard, { backgroundColor: surfaceMuted }]}>
                  <ThemedText style={styles.receiptMetricLabel}>关联订单</ThemedText>
                  <ThemedText style={styles.receiptMetricValue} numberOfLines={1} type="defaultSemiBold">
                    {receiptDetail.purchaseOrders.join('、') || '暂无'}
                  </ThemedText>
                </View>
              </View>
            </View>

            <View style={[styles.card, styles.itemsSectionCard, { backgroundColor: surface, borderColor }]}>
              <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
                商品明细
              </ThemedText>
              <View style={styles.itemList}>
                {receiptItemGroups.map((group) => {
                  const isExpanded = expandedReceiptGroups[group.key] ?? false;
                  return (
                    <View key={group.key} style={[styles.compactGroupCard, { backgroundColor: surfaceMuted }]}>
                      <View style={styles.compactGroupHeader}>
                        <View style={styles.compactGroupTitleWrap}>
                          <ThemedText style={styles.compactGroupTitle} type="defaultSemiBold">
                            {group.itemName}
                          </ThemedText>
                          <ThemedText style={styles.itemMeta}>
                            编码 {group.itemCode}
                            {group.lines.length > 1 ? ` · ${group.lines.length} 条仓库行` : ''}
                          </ThemedText>
                        </View>
                        <View style={styles.compactAmountWrap}>
                          <ThemedText style={styles.compactAmountLabel}>小计</ThemedText>
                          <ThemedText style={styles.compactAmountValue} type="defaultSemiBold">
                            {formatMoney(group.totalAmount, receiptDetail.currency || 'CNY')}
                          </ThemedText>
                        </View>
                      </View>

                      <View style={styles.compactMetaRow}>
                        <ThemedText style={styles.itemMeta}>
                          数量 {formatQty(group.totalQty)}
                          {group.uom ? ` ${group.uom}` : ''}
                        </ThemedText>
                        <ThemedText style={styles.itemMeta}>
                          均价 {formatMoney(group.totalQty > 0 ? group.totalAmount / group.totalQty : null, receiptDetail.currency || 'CNY')}
                        </ThemedText>
                      </View>

                      <ThemedText style={styles.itemMeta}>
                        仓库 {Array.from(new Set(group.lines.map((line) => line.warehouse || '未设置'))).join('、')}
                      </ThemedText>

                      {group.lines.length > 1 ? (
                        <>
                          <Pressable
                            onPress={() =>
                              setExpandedReceiptGroups((current) => ({
                                ...current,
                                [group.key]: !(current[group.key] ?? false),
                              }))
                            }
                            style={[styles.inlineAction, { borderColor }]}>
                            <ThemedText style={styles.inlineActionText} type="defaultSemiBold">
                              {isExpanded ? '收起明细' : '展开明细'}
                            </ThemedText>
                          </Pressable>
                          {isExpanded ? (
                            <View style={styles.compactLineList}>
                              {group.lines.map((line, index) => (
                                <View key={`${group.key}-${line.warehouse || 'warehouse'}-${index}`} style={styles.compactLineRow}>
                                  <View style={styles.compactLineLeft}>
                                    <ThemedText style={styles.compactLineWarehouse} type="defaultSemiBold">
                                      {line.warehouse || '未设置仓库'}
                                    </ThemedText>
                                    <ThemedText style={styles.itemMeta}>
                                      {formatQty(line.qty)} {line.uom || group.uom || ''} x{' '}
                                      {formatMoney(line.rate, receiptDetail.currency || 'CNY')}
                                    </ThemedText>
                                  </View>
                                  <ThemedText style={styles.compactLineAmount} type="defaultSemiBold">
                                    {formatMoney(line.amount, receiptDetail.currency || 'CNY')}
                                  </ThemedText>
                                </View>
                              ))}
                            </View>
                          ) : null}
                        </>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={[styles.card, styles.rollbackCard]}>
              <ThemedText style={styles.rollbackTitle} type="defaultSemiBold">
                回退处理
              </ThemedText>
              <ThemedText style={styles.rollbackText}>
                {receiptDetail.cancelHint ||
                  '收货单提交后不建议直接修改明细。若实际到货需要调整，建议按链路回退：先处理下游发票，再作废收货单，回到采购订单调整后重新收货。'}
              </ThemedText>
              {receiptDetail.canCancel ? (
                <Pressable
                  onPress={() => setShowCancelDialog(true)}
                  style={[styles.nextActionButton, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                  <ThemedText style={styles.rollbackActionText} type="defaultSemiBold">
                    作废收货单
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>
          </>
        ) : null}
      </ScrollView>

      <ConfirmDialog
        confirmLabel={isCancelling ? '作废中...' : '确认作废'}
        description="作废后会回退库存和采购订单收货状态。如果这张收货单已关联采购发票，请先作废发票。"
        onClose={() => {
          if (!isCancelling) {
            setShowCancelDialog(false);
          }
        }}
        onConfirm={() => void handleCancelReceipt()}
        title="作废采购收货单？"
        visible={showCancelDialog}
      />

      <ResultDialog
        confirmLabel="返回订单"
        description="这张收货单已经作废，库存和采购订单收货状态已回退。建议回到订单确认最新状态后再决定是否重新收货。"
        onClose={() => setCancelResultOpen(false)}
        onConfirm={() => {
          setCancelResultOpen(false);
          if (primaryOrderNameFromReceipt) {
            router.replace({
              pathname: '/purchase/order/[orderName]',
              params: { orderName: primaryOrderNameFromReceipt },
            });
          }
        }}
        title="收货单已作废"
        visible={cancelResultOpen}
      />
    </AppShell>
  );
}

function ConfirmDialog({
  visible,
  title,
  description,
  confirmLabel,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.dialogBackdrop}>
        <View style={styles.dialogCard}>
          <ThemedText style={styles.dialogTitle} type="defaultSemiBold">
            {title}
          </ThemedText>
          <ThemedText style={styles.dialogMessage}>{description}</ThemedText>
          <View style={styles.dialogActions}>
            <Pressable onPress={onClose} style={[styles.dialogButton, styles.dialogGhostButton]}>
              <ThemedText style={styles.dialogGhostText} type="defaultSemiBold">
                先不处理
              </ThemedText>
            </Pressable>
            <Pressable onPress={onConfirm} style={[styles.dialogButton, styles.dialogDangerButton]}>
              <ThemedText style={styles.dialogPrimaryText} type="defaultSemiBold">
                {confirmLabel}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ResultDialog({
  visible,
  title,
  description,
  confirmLabel,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.dialogBackdrop}>
        <View style={styles.dialogCard}>
          <ThemedText style={styles.dialogTitle} type="defaultSemiBold">
            {title}
          </ThemedText>
          <ThemedText style={styles.dialogMessage}>{description}</ThemedText>
          <View style={styles.dialogActions}>
            <Pressable onPress={onClose} style={[styles.dialogButton, styles.dialogGhostButton]}>
              <ThemedText style={styles.dialogGhostText} type="defaultSemiBold">
                留在本页
              </ThemedText>
            </Pressable>
            <Pressable onPress={onConfirm} style={[styles.dialogButton, styles.dialogPrimaryButton]}>
              <ThemedText style={styles.dialogPrimaryText} type="defaultSemiBold">
                {confirmLabel}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function DetailRow({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <ThemedText style={styles.detailLabel}>{label}</ThemedText>
      <ThemedText style={multiline ? styles.detailValueMultiline : styles.detailValue} type="defaultSemiBold">
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    paddingHorizontal: 8,
    paddingBottom: 84,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  field: {
    flex: 1,
    gap: 8,
  },
  label: {
    fontSize: 14,
  },
  inputHint: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
  },
  timeFieldWrap: {
    gap: 8,
  },
  timeInput: {
    minHeight: 52,
  },
  timeActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  timeActionButton: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: 12,
  },
  timeActionText: {
    fontSize: 12,
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 52,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  textarea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  loadingCard: {
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    gap: 10,
    justifyContent: 'center',
    minHeight: 160,
    padding: 18,
  },
  sectionTitle: {
    fontSize: 17,
  },
  detailRow: {
    gap: 4,
  },
  detailLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  detailValue: {
    fontSize: 15,
    lineHeight: 21,
  },
  detailValueMultiline: {
    fontSize: 15,
    lineHeight: 22,
  },
  receiptSummaryHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  receiptSummaryTitleWrap: {
    flex: 1,
    gap: 4,
  },
  receiptStatusPill: {
    backgroundColor: '#DBEAFE',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  receiptStatusText: {
    color: '#1D4ED8',
    fontSize: 12,
  },
  receiptMetricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  receiptMetricCard: {
    borderRadius: 14,
    flexBasis: '48%',
    flexGrow: 1,
    gap: 6,
    minHeight: 72,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  receiptMetricLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  receiptMetricValue: {
    color: '#0F172A',
    fontSize: 20,
    lineHeight: 24,
  },
  receiptMetricAmountValue: {
    color: '#C2410C',
    fontSize: 26,
    lineHeight: 30,
  },
  itemList: {
    gap: 8,
  },
  itemsSectionCard: {
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  itemCard: {
    borderRadius: 18,
    gap: 6,
    padding: 14,
  },
  compactGroupCard: {
    borderRadius: 18,
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  compactGroupHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  compactGroupTitleWrap: {
    flex: 1,
    gap: 4,
  },
  compactGroupTitle: {
    fontSize: 17,
    lineHeight: 23,
  },
  compactAmountWrap: {
    alignItems: 'flex-end',
    gap: 2,
    minWidth: 104,
  },
  compactAmountLabel: {
    color: '#64748B',
    fontSize: 11,
  },
  compactAmountValue: {
    color: '#C2410C',
    fontSize: 20,
    lineHeight: 24,
  },
  compactMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  compactLineList: {
    borderTopColor: '#CBD5E1',
    borderTopWidth: 1,
    gap: 8,
    marginTop: 2,
    paddingTop: 8,
  },
  compactLineRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  compactLineLeft: {
    flex: 1,
    gap: 2,
  },
  compactLineWarehouse: {
    fontSize: 13,
    lineHeight: 18,
  },
  compactLineAmount: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'right',
  },
  itemHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  itemHeaderText: {
    flex: 1,
    gap: 4,
  },
  itemMeta: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 18,
  },
  inlineAction: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inlineActionText: {
    color: '#2563EB',
    fontSize: 12,
  },
  summaryHint: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 19,
  },
  noticeText: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 19,
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
  nextActionText: {
    fontSize: 13,
  },
  rollbackCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    gap: 12,
  },
  rollbackTitle: {
    color: '#991B1B',
    fontSize: 16,
  },
  rollbackText: {
    color: '#7F1D1D',
    fontSize: 13,
    lineHeight: 20,
  },
  rollbackActionText: {
    color: '#B91C1C',
    fontSize: 13,
  },
  footerWrap: {
    gap: 10,
  },
  footerHint: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
  },
  footerActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  footerActionButton: {
    flex: 1,
  },
  secondaryActionButton: {
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
  },
  secondaryActionText: {
    fontSize: 15,
  },
  dialogBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.22)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  dialogCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FECACA',
    borderRadius: 22,
    borderWidth: 1,
    gap: 14,
    maxWidth: 420,
    padding: 20,
    width: '100%',
  },
  dialogTitle: {
    color: '#991B1B',
    fontSize: 17,
  },
  dialogMessage: {
    color: '#7F1D1D',
    fontSize: 14,
    lineHeight: 21,
  },
  dialogActions: {
    flexDirection: 'row',
    gap: 10,
  },
  dialogButton: {
    alignItems: 'center',
    borderRadius: 14,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
  },
  dialogGhostButton: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
    borderWidth: 1,
  },
  dialogPrimaryButton: {
    backgroundColor: '#2563EB',
  },
  dialogDangerButton: {
    backgroundColor: '#DC2626',
  },
  dialogGhostText: {
    color: '#9A3412',
    fontSize: 14,
  },
  dialogPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  footerButton: {
    alignItems: 'center',
    borderRadius: 16,
    justifyContent: 'center',
    minHeight: 52,
  },
  footerButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
  },
});
