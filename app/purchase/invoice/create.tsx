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
import { isValidIsoDate } from '@/lib/date-value';
import { useFeedback } from '@/providers/feedback-provider';
import {
  cancelPurchaseInvoice,
  cancelSupplierPayment,
  fetchPurchaseInvoiceDetail,
  fetchPurchaseOrderDetail,
  fetchPurchaseReceiptDetail,
  searchPurchaseReceipts,
  submitPurchaseInvoiceFromReceipt,
  type PurchaseInvoiceDetail,
  type PurchaseReceiptDetail,
} from '@/services/purchases';

type InvoiceItemLine = {
  itemCode: string;
  itemName: string;
  qty: number | null;
  rate: number | null;
  amount: number | null;
  warehouse: string;
  uom: string;
};

type InvoiceItemGroup = {
  key: string;
  itemCode: string;
  itemName: string;
  uom: string;
  totalQty: number;
  totalAmount: number;
  lines: InvoiceItemLine[];
};

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

function formatQty(value: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(2);
}

function formatInvoiceDocumentStatus(status: string) {
  switch (status) {
    case 'draft':
      return '草稿';
    case 'submitted':
      return '已提交';
    case 'cancelled':
      return '已作废';
    default:
      return status || '未知状态';
  }
}

function formatInvoicePaymentStatus(status: string) {
  switch (status) {
    case 'unpaid':
      return '未付款';
    case 'partly_paid':
    case 'partial':
      return '部分付款';
    case 'paid':
      return '已付款';
    case 'overdue':
      return '已逾期';
    default:
      return status || '未知状态';
  }
}

function groupInvoiceItems(items: InvoiceItemLine[]) {
  return Object.values(
    items.reduce<Record<string, InvoiceItemGroup>>((groups, item, index) => {
      const groupKey = item.itemCode?.trim() || `${item.itemName || '未命名商品'}-${index}`;
      const qtyValue = typeof item.qty === 'number' && Number.isFinite(item.qty) ? item.qty : 0;
      const amountValue =
        typeof item.amount === 'number' && Number.isFinite(item.amount) ? item.amount : qtyValue * (item.rate || 0);
      const existing = groups[groupKey];
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
    }, {}),
  );
}

export default function PurchaseInvoiceCreateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ receiptName?: string; orderName?: string; purchaseInvoice?: string; notice?: string }>();
  const { showError, showSuccess, showInfo } = useFeedback();
  const [receiptName, setReceiptName] = useState(
    typeof params.receiptName === 'string' ? params.receiptName.trim() : '',
  );
  const [dueDate, setDueDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [receiptDetail, setReceiptDetail] = useState<PurchaseReceiptDetail | null>(null);
  const [invoiceDetail, setInvoiceDetail] = useState<PurchaseInvoiceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelMode, setCancelMode] = useState<'invoice_only' | 'rollback_and_cancel'>('invoice_only');
  const [isCancelling, setIsCancelling] = useState(false);
  const [expandedReceiptGroups, setExpandedReceiptGroups] = useState<Record<string, boolean>>({});
  const [expandedInvoiceGroups, setExpandedInvoiceGroups] = useState<Record<string, boolean>>({});

  const purchaseInvoiceName =
    typeof params.purchaseInvoice === 'string' ? params.purchaseInvoice.trim() : '';
  const primaryOrderNameFromInvoice = invoiceDetail?.purchaseOrders[0]?.trim() || '';
  const primaryReceiptNameFromInvoice = invoiceDetail?.purchaseReceipts[0]?.trim() || '';
  const surface = useThemeColor({}, 'surface');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');

  useEffect(() => {
    if (params.notice === 'created' && purchaseInvoiceName) {
      showSuccess(`已登记采购发票：${purchaseInvoiceName}`);
    }
  }, [params.notice, purchaseInvoiceName, showSuccess]);

  useEffect(() => {
    if (typeof params.receiptName === 'string' && params.receiptName.trim()) {
      setReceiptName(params.receiptName.trim());
    }
  }, [params.receiptName]);

  useEffect(() => {
    const incomingOrderName = typeof params.orderName === 'string' ? params.orderName.trim() : '';
    if (!incomingOrderName || purchaseInvoiceName || receiptName.trim()) {
      return;
    }

    let cancelled = false;
    void fetchPurchaseOrderDetail(incomingOrderName)
      .then((orderDetail) => {
        if (cancelled || !orderDetail) {
          return;
        }
        const candidateReceipt = orderDetail.purchaseReceipts[0]?.trim() || '';
        if (!candidateReceipt) {
          showInfo('当前采购订单还没有收货单，请先收货后再登记发票。');
          return;
        }
        setReceiptName((current) => current.trim() || candidateReceipt);
      })
      .catch((error) => {
        if (!cancelled) {
          showError(normalizeAppError(error).message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [params.orderName, purchaseInvoiceName, receiptName, showError, showInfo]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (purchaseInvoiceName) {
        setIsLoading(true);
        try {
          const detail = await fetchPurchaseInvoiceDetail(purchaseInvoiceName);
          if (!cancelled) {
            setInvoiceDetail(detail);
            setReceiptDetail(null);
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

      if (!receiptName.trim()) {
        setReceiptDetail(null);
        setInvoiceDetail(null);
        return;
      }

      setIsLoading(true);
      try {
        const detail = await fetchPurchaseReceiptDetail(receiptName);
        if (!cancelled) {
          setReceiptDetail(detail);
          setInvoiceDetail(null);
        }
      } catch (error) {
        if (!cancelled) {
          showError(normalizeAppError(error).message);
          setReceiptDetail(null);
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
  }, [purchaseInvoiceName, receiptName, showError]);

  const actions: { href: Href; label: string; description?: string }[] = [];
  const canSubmitInvoice =
    !isSubmitting &&
    Boolean(receiptDetail) &&
    Boolean(receiptDetail?.canCreateInvoice) &&
    (!dueDate.trim() || isValidIsoDate(dueDate));
  const receiptItemGroups = receiptDetail ? groupInvoiceItems(receiptDetail.items) : [];
  const invoiceItemGroups = invoiceDetail ? groupInvoiceItems(invoiceDetail.items) : [];

  useEffect(() => {
    if (!receiptDetail) {
      setExpandedReceiptGroups({});
      return;
    }
    const keys = Array.from(
      new Set(receiptDetail.items.map((item, index) => item.itemCode?.trim() || `${item.itemName || '未命名商品'}-${index}`)),
    );
    setExpandedReceiptGroups((current) => {
      const next: Record<string, boolean> = {};
      keys.forEach((key) => {
        next[key] = current[key] ?? false;
      });
      return next;
    });
  }, [receiptDetail]);

  useEffect(() => {
    if (!invoiceDetail) {
      setExpandedInvoiceGroups({});
      return;
    }
    const keys = Array.from(
      new Set(invoiceDetail.items.map((item, index) => item.itemCode?.trim() || `${item.itemName || '未命名商品'}-${index}`)),
    );
    setExpandedInvoiceGroups((current) => {
      const next: Record<string, boolean> = {};
      keys.forEach((key) => {
        next[key] = current[key] ?? false;
      });
      return next;
    });
  }, [invoiceDetail]);

  const handleSubmit = async () => {
    const trimmedReceiptName = receiptName.trim();
    if (!trimmedReceiptName) {
      showError('请先填写采购收货单号。');
      return;
    }

    if (!receiptDetail) {
      showError('当前采购收货详情尚未加载完成。');
      return;
    }

    if (dueDate.trim() && !isValidIsoDate(dueDate)) {
      showError('请先选择有效到期日期。');
      return;
    }

    if (!receiptDetail.canCreateInvoice) {
      showInfo('这张采购收货单当前不能继续登记发票，可能已经开票。');
      return;
    }

    try {
      setIsSubmitting(true);
      const nextInvoiceName = await submitPurchaseInvoiceFromReceipt({
        receiptName: trimmedReceiptName,
        dueDate,
        remarks,
      });
      if (!nextInvoiceName) {
        throw new Error('采购发票创建成功，但未返回发票号。');
      }

      router.replace({
        pathname: '/purchase/invoice/create',
        params: {
          receiptName: trimmedReceiptName,
          purchaseInvoice: nextInvoiceName,
          notice: 'created',
        },
      });
    } catch (error) {
      showError(normalizeAppError(error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelInvoice = async () => {
    if (!invoiceDetail) {
      showError('当前发票详情尚未加载完成。');
      return;
    }
    try {
      setIsCancelling(true);
      const latestPaymentEntry = invoiceDetail.latestPaymentEntry.trim();
      if (cancelMode === 'rollback_and_cancel' && latestPaymentEntry) {
        await cancelSupplierPayment(latestPaymentEntry);
      }
      const result = await cancelPurchaseInvoice(invoiceDetail.name);
      const refreshed = await fetchPurchaseInvoiceDetail(invoiceDetail.name);
      setInvoiceDetail(refreshed);
      showSuccess(
        cancelMode === 'rollback_and_cancel' && latestPaymentEntry
          ? `${result.message || `采购发票 ${result.invoiceName} 已作废。`} 已同步回退付款单 ${latestPaymentEntry}。`
          : result.message || `采购发票 ${result.invoiceName} 已作废。`,
      );
      setShowCancelDialog(false);
    } catch (error) {
      showError(normalizeAppError(error).message);
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <AppShell
      actions={actions}
      title="登记供应商发票"
      description="采购发票代表供应商向我们开具的应付票据。这里不是我们去开票，而是把到票事实登记进系统。"
      compactHeader
      contentCard={false}
      showWorkflowQuickNav={false}
      footer={
        invoiceDetail ? (
          <View style={styles.footerWrap}>
            <ThemedText style={styles.footerHint}>
              {invoiceDetail.documentStatus === 'cancelled'
                ? '当前发票已作废，建议返回上游单据确认最新链路状态。'
                : '发票提交后建议优先在这里继续付款或回到上游单据，不必反复滚动查找操作入口。'}
            </ThemedText>
            {primaryOrderNameFromInvoice || primaryReceiptNameFromInvoice ? (
              <View style={styles.footerQuickLinkRow}>
                {primaryOrderNameFromInvoice ? (
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: '/purchase/order/[orderName]',
                        params: { orderName: primaryOrderNameFromInvoice },
                      })
                    }
                    style={[styles.footerQuickLinkButton, { borderColor }]}>
                    <ThemedText style={[styles.footerQuickLinkText, { color: tintColor }]} type="defaultSemiBold">
                      查看采购订单
                    </ThemedText>
                  </Pressable>
                ) : null}
                {primaryReceiptNameFromInvoice ? (
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: '/purchase/receipt/create',
                        params: { receiptName: primaryReceiptNameFromInvoice },
                      })
                    }
                    style={[styles.footerQuickLinkButton, { borderColor }]}>
                    <ThemedText style={[styles.footerQuickLinkText, { color: tintColor }]} type="defaultSemiBold">
                      查看收货单
                    </ThemedText>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            <View style={styles.footerActionRow}>
              <Pressable
                disabled={!primaryOrderNameFromInvoice && !primaryReceiptNameFromInvoice}
                onPress={() => {
                  if (primaryOrderNameFromInvoice) {
                    router.push({
                      pathname: '/purchase/order/[orderName]',
                      params: { orderName: primaryOrderNameFromInvoice },
                    });
                    return;
                  }
                  if (primaryReceiptNameFromInvoice) {
                    router.push({
                      pathname: '/purchase/receipt/create',
                      params: { receiptName: primaryReceiptNameFromInvoice },
                    });
                  }
                }}
                style={[
                  styles.footerActionButton,
                  styles.secondaryActionButton,
                  {
                    borderColor:
                      primaryOrderNameFromInvoice || primaryReceiptNameFromInvoice
                        ? borderColor
                        : surfaceMuted,
                    opacity: primaryOrderNameFromInvoice || primaryReceiptNameFromInvoice ? 1 : 0.6,
                  },
                ]}>
                <ThemedText style={[styles.secondaryActionText, { color: tintColor }]} type="defaultSemiBold">
                  {primaryOrderNameFromInvoice
                    ? '返回采购订单'
                    : primaryReceiptNameFromInvoice
                      ? '返回收货单'
                      : '暂无上游单据'}
                </ThemedText>
              </Pressable>

              {invoiceDetail.documentStatus !== 'cancelled' ? (
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/purchase/payment/create',
                      params: { referenceName: invoiceDetail.name },
                    })
                  }
                  style={[styles.footerActionButton, styles.footerButton, { backgroundColor: tintColor }]}>
                  <ThemedText style={styles.footerButtonText} type="defaultSemiBold">
                    去登记付款
                  </ThemedText>
                </Pressable>
              ) : (
                <Pressable
                  disabled
                  style={[styles.footerActionButton, styles.footerButton, { backgroundColor: surfaceMuted }]}>
                  <ThemedText style={styles.footerButtonText} type="defaultSemiBold">
                    发票已作废
                  </ThemedText>
                </Pressable>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.footerActionRow}>
            <Pressable
              disabled={!receiptName.trim()}
              onPress={() =>
                router.push({
                  pathname: '/purchase/receipt/create',
                  params: { receiptName: receiptName.trim() },
                })
              }
              style={[
                styles.footerActionButton,
                styles.secondaryActionButton,
                { borderColor: receiptName.trim() ? borderColor : surfaceMuted, opacity: receiptName.trim() ? 1 : 0.6 },
              ]}>
              <ThemedText style={[styles.secondaryActionText, { color: tintColor }]} type="defaultSemiBold">
                返回收货单
              </ThemedText>
            </Pressable>
            <Pressable
              disabled={!canSubmitInvoice}
              onPress={handleSubmit}
              style={[styles.footerActionButton, styles.footerButton, { backgroundColor: canSubmitInvoice ? tintColor : surfaceMuted }]}>
              <ThemedText style={styles.footerButtonText} type="defaultSemiBold">
                {isSubmitting ? '正在登记采购发票...' : canSubmitInvoice ? '提交采购发票' : '当前不可提交'}
              </ThemedText>
            </Pressable>
          </View>
        )
      }>
      <ScrollView contentContainerStyle={styles.container}>
        {!invoiceDetail ? (
          <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
            <LinkOptionInput
              label="采购收货单号"
              loadOptions={searchPurchaseReceipts}
              onChangeText={setReceiptName}
              placeholder="搜索采购收货单"
              value={receiptName}
            />
            <View style={styles.field}>
              <DateFieldInput
                allowClear
                errorText={dueDate.trim() && !isValidIsoDate(dueDate) ? '请选择有效到期日期。' : undefined}
                helperText="可选，用于记录供应商发票应付到期日。"
                label="到期日期"
                onChange={setDueDate}
                value={dueDate}
              />
            </View>
            <View style={styles.field}>
              <ThemedText style={styles.label} type="defaultSemiBold">
                备注
              </ThemedText>
              <TextInput
                multiline
                onChangeText={setRemarks}
                placeholder="可选，记录发票说明"
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

        {!isLoading && receiptDetail && !invoiceDetail ? (
          <>
            <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
              <View style={styles.summaryHeader}>
                <View style={styles.summaryTitleWrap}>
                  <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
                    待登记发票的收货单
                  </ThemedText>
                  <ThemedText style={styles.itemMeta}>收货单 {receiptDetail.name}</ThemedText>
                </View>
              </View>
              <View style={styles.metricGrid}>
                <View style={[styles.metricCard, { backgroundColor: surfaceMuted }]}>
                  <ThemedText style={styles.metricLabel}>收货金额</ThemedText>
                  <ThemedText style={[styles.metricValue, styles.metricAmountValue]} type="defaultSemiBold">
                    {formatMoney(receiptDetail.receiptAmountEstimate, receiptDetail.currency || 'CNY')}
                  </ThemedText>
                </View>
                <View style={[styles.metricCard, { backgroundColor: surfaceMuted }]}>
                  <ThemedText style={styles.metricLabel}>总数量</ThemedText>
                  <ThemedText style={styles.metricValue} type="defaultSemiBold">
                    {formatQty(receiptDetail.totalQty)}
                  </ThemedText>
                </View>
                <View style={[styles.metricCard, { backgroundColor: surfaceMuted }]}>
                  <ThemedText style={styles.metricLabel}>供应商</ThemedText>
                  <ThemedText style={styles.metricValue} numberOfLines={1} type="defaultSemiBold">
                    {receiptDetail.supplierName || receiptDetail.supplier || '—'}
                  </ThemedText>
                </View>
                <View style={[styles.metricCard, { backgroundColor: surfaceMuted }]}>
                  <ThemedText style={styles.metricLabel}>关联订单</ThemedText>
                  <ThemedText style={styles.metricValue} numberOfLines={1} type="defaultSemiBold">
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
                  const expanded = expandedReceiptGroups[group.key] ?? false;
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
                              {expanded ? '收起明细' : '展开明细'}
                            </ThemedText>
                          </Pressable>
                          {expanded ? (
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
              {!receiptDetail.canCreateInvoice ? (
                <ThemedText style={styles.noticeText}>
                  这张收货单当前不能继续开票，可能已经完成开票。
                </ThemedText>
              ) : null}
            </View>
          </>
        ) : null}

        {!isLoading && invoiceDetail ? (
          <>
            <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
              <View style={styles.summaryHeader}>
                <View style={styles.summaryTitleWrap}>
                  <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
                    采购发票已登记
                  </ThemedText>
                  <ThemedText style={styles.itemMeta}>发票 {invoiceDetail.name}</ThemedText>
                </View>
                <View style={styles.statusPill}>
                  <ThemedText style={styles.statusPillText} type="defaultSemiBold">
                    {formatInvoiceDocumentStatus(invoiceDetail.documentStatus)}
                  </ThemedText>
                </View>
              </View>
              <View style={styles.metricGrid}>
                <View style={[styles.metricCard, { backgroundColor: surfaceMuted }]}>
                  <ThemedText style={styles.metricLabel}>发票金额</ThemedText>
                  <ThemedText style={[styles.metricValue, styles.metricAmountValue]} type="defaultSemiBold">
                    {formatMoney(invoiceDetail.invoiceAmountEstimate, invoiceDetail.currency || 'CNY')}
                  </ThemedText>
                </View>
                <View style={[styles.metricCard, { backgroundColor: surfaceMuted }]}>
                  <ThemedText style={styles.metricLabel}>未付金额</ThemedText>
                  <ThemedText style={styles.metricValue} type="defaultSemiBold">
                    {formatMoney(invoiceDetail.outstandingAmount, invoiceDetail.currency || 'CNY')}
                  </ThemedText>
                </View>
                <View style={[styles.metricCard, { backgroundColor: surfaceMuted }]}>
                  <ThemedText style={styles.metricLabel}>付款状态</ThemedText>
                  <ThemedText style={styles.metricValue} type="defaultSemiBold">
                    {formatInvoicePaymentStatus(invoiceDetail.paymentStatus)}
                  </ThemedText>
                </View>
                <View style={[styles.metricCard, { backgroundColor: surfaceMuted }]}>
                  <ThemedText style={styles.metricLabel}>供应商</ThemedText>
                  <ThemedText style={styles.metricValue} numberOfLines={1} type="defaultSemiBold">
                    {invoiceDetail.supplierName || invoiceDetail.supplier || '—'}
                  </ThemedText>
                </View>
              </View>
            </View>

            <View style={[styles.card, styles.itemsSectionCard, { backgroundColor: surface, borderColor }]}>
              <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
                商品明细
              </ThemedText>
              <View style={styles.itemList}>
                {invoiceItemGroups.map((group) => {
                  const expanded = expandedInvoiceGroups[group.key] ?? false;
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
                            {formatMoney(group.totalAmount, invoiceDetail.currency || 'CNY')}
                          </ThemedText>
                        </View>
                      </View>
                      <View style={styles.compactMetaRow}>
                        <ThemedText style={styles.itemMeta}>
                          数量 {formatQty(group.totalQty)}
                          {group.uom ? ` ${group.uom}` : ''}
                        </ThemedText>
                        <ThemedText style={styles.itemMeta}>
                          均价 {formatMoney(group.totalQty > 0 ? group.totalAmount / group.totalQty : null, invoiceDetail.currency || 'CNY')}
                        </ThemedText>
                      </View>
                      <ThemedText style={styles.itemMeta}>
                        仓库 {Array.from(new Set(group.lines.map((line) => line.warehouse || '未设置'))).join('、')}
                      </ThemedText>
                      {group.lines.length > 1 ? (
                        <>
                          <Pressable
                            onPress={() =>
                              setExpandedInvoiceGroups((current) => ({
                                ...current,
                                [group.key]: !(current[group.key] ?? false),
                              }))
                            }
                            style={[styles.inlineAction, { borderColor }]}>
                            <ThemedText style={styles.inlineActionText} type="defaultSemiBold">
                              {expanded ? '收起明细' : '展开明细'}
                            </ThemedText>
                          </Pressable>
                          {expanded ? (
                            <View style={styles.compactLineList}>
                              {group.lines.map((line, index) => (
                                <View key={`${group.key}-${line.warehouse || 'warehouse'}-${index}`} style={styles.compactLineRow}>
                                  <View style={styles.compactLineLeft}>
                                    <ThemedText style={styles.compactLineWarehouse} type="defaultSemiBold">
                                      {line.warehouse || '未设置仓库'}
                                    </ThemedText>
                                    <ThemedText style={styles.itemMeta}>
                                      {formatQty(line.qty)} {line.uom || group.uom || ''} x{' '}
                                      {formatMoney(line.rate, invoiceDetail.currency || 'CNY')}
                                    </ThemedText>
                                  </View>
                                  <ThemedText style={styles.compactLineAmount} type="defaultSemiBold">
                                    {formatMoney(line.amount, invoiceDetail.currency || 'CNY')}
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

            {invoiceDetail.canCancel ? (
              <View style={[styles.card, styles.rollbackCard]}>
                <ThemedText style={styles.rollbackTitle} type="defaultSemiBold">
                  回退处理
                </ThemedText>
                <ThemedText style={styles.rollbackText}>
                  发票作废会回退应付状态。若这张发票已有付款记录，建议优先使用“回退付款并作废发票”，避免账务不一致。
                </ThemedText>
                <View style={styles.nextActionRow}>
                  <Pressable
                    onPress={() => {
                      setCancelMode('invoice_only');
                      setShowCancelDialog(true);
                    }}
                    style={[styles.nextActionButton, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                    <ThemedText style={styles.rollbackActionText} type="defaultSemiBold">
                      仅作废发票
                    </ThemedText>
                  </Pressable>
                  {invoiceDetail.latestPaymentEntry.trim() ? (
                    <Pressable
                      onPress={() => {
                        setCancelMode('rollback_and_cancel');
                        setShowCancelDialog(true);
                      }}
                      style={[styles.nextActionButton, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}>
                      <ThemedText style={styles.rollbackActionText} type="defaultSemiBold">
                        回退付款并作废发票
                      </ThemedText>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      <ConfirmDialog
        confirmLabel={isCancelling ? '处理中...' : '确认执行'}
        description={
          cancelMode === 'rollback_and_cancel'
            ? '将先作废关联供应商付款，再作废采购发票。这个操作会影响应付账状态，请确认后继续。'
            : '将仅作废采购发票。若这张发票已经存在付款记录，建议改用“回退付款并作废发票”。'
        }
        onClose={() => {
          if (!isCancelling) {
            setShowCancelDialog(false);
          }
        }}
        onConfirm={() => void handleCancelInvoice()}
        title={cancelMode === 'rollback_and_cancel' ? '回退付款并作废发票？' : '仅作废采购发票？'}
        visible={showCancelDialog}
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
  field: {
    gap: 8,
  },
  label: {
    fontSize: 14,
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
  summaryHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  summaryTitleWrap: {
    flex: 1,
    gap: 4,
  },
  statusPill: {
    backgroundColor: '#DBEAFE',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusPillText: {
    color: '#1D4ED8',
    fontSize: 12,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricCard: {
    borderRadius: 14,
    flexBasis: '48%',
    flexGrow: 1,
    gap: 6,
    minHeight: 72,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  metricLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  metricValue: {
    color: '#0F172A',
    fontSize: 20,
    lineHeight: 24,
  },
  metricAmountValue: {
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
  noticeText: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 19,
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
  footerWrap: {
    gap: 10,
  },
  footerHint: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
  },
  footerQuickLinkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  footerQuickLinkButton: {
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 32,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  footerQuickLinkText: {
    fontSize: 12,
    lineHeight: 16,
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
