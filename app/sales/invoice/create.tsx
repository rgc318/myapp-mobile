import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { PreferenceSummary } from '@/components/preference-summary';
import { SalesInvoiceSheet } from '@/components/sales-invoice-sheet';
import { ThemedText } from '@/components/themed-text';
import { getAppPreferences } from '@/lib/app-preferences';
import { getPaymentResultHandoff } from '@/lib/payment-result-handoff';
import { resolveDisplayUom } from '@/lib/display-uom';
import { buildQuantityComposition } from '@/lib/uom-display';
import { useFeedback } from '@/providers/feedback-provider';
import { createSalesInvoice } from '@/services/gateway';
import {
  cancelPaymentEntryV2,
  cancelSalesInvoiceV2,
  getSalesOrderDetailV2,
  type SalesOrderDetailV2,
  getSalesInvoiceDetailV2,
  type SalesInvoiceDetailV2,
} from '@/services/sales';

function formatCurrency(value: number | null | undefined, currency = 'CNY') {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }

  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatStatusLabel(status: string) {
  switch (status) {
    case 'submitted':
      return '已提交';
    case 'draft':
      return '草稿';
    case 'cancelled':
      return '已作废';
    default:
      return status || '未确认';
  }
}

function buildSettlementLabel(detail: SalesInvoiceDetailV2) {
  if (detail.documentStatus === 'cancelled') {
    return '已作废';
  }

  if ((detail.outstandingAmount ?? 0) > 0) {
    return '待收款';
  }

  return '已结清';
}

function buildSettlementTone(detail: SalesInvoiceDetailV2) {
  if (detail.documentStatus === 'cancelled') {
    return 'danger';
  }

  if ((detail.outstandingAmount ?? 0) > 0) {
    return 'warning';
  }

  return 'success';
}

function buildInvoiceStatusHint(detail: SalesInvoiceDetailV2) {
  if (detail.documentStatus === 'cancelled') {
    return '这张销售发票已经作废，当前页面仅作为历史单据查看页使用。若还需要继续业务处理，请返回订单或发货单查看最新状态。';
  }

  if ((detail.outstandingAmount ?? 0) > 0) {
    return '当前发票仍有未收金额，可继续登记收款；如果需要回改单据，请先确认是否要同步回退收款登记。';
  }

  return '当前发票已经结清，若仍需回退单据，请先确认是否需要回退对应收款，再处理发票作废。';
}

function groupOrderItems(items: SalesOrderDetailV2['items']) {
  const grouped = new Map<
    string,
    {
      itemCode: string;
      itemName: string;
      specification?: string | null;
      totalAmount: number;
      rows: SalesOrderDetailV2['items'];
    }
  >();

  items.forEach((item) => {
    const existing = grouped.get(item.itemCode);
    if (existing) {
      existing.rows.push(item);
      existing.totalAmount += item.amount ?? 0;
      return;
    }

    grouped.set(item.itemCode, {
      itemCode: item.itemCode,
      itemName: item.itemName || item.itemCode,
      specification: item.specification ?? null,
      totalAmount: item.amount ?? 0,
      rows: [item],
    });
  });

  return Array.from(grouped.values());
}

function buildGroupedInvoiceRateSummary(
  items: SalesOrderDetailV2['items'],
  currency: string,
) {
  const uniqueRates = Array.from(
    new Set(
      items
        .map((item) => (typeof item.rate === 'number' && Number.isFinite(item.rate) ? item.rate : null))
        .filter((value): value is number => value !== null),
    ),
  );
  const uniqueUoms = Array.from(
    new Set(items.map((item) => (typeof item.uom === 'string' ? item.uom.trim() : '')).filter(Boolean)),
  );

  if (uniqueRates.length === 1 && uniqueUoms.length === 1) {
    const display = items.find((item) => (typeof item.uom === 'string' ? item.uom.trim() : '') === uniqueUoms[0])?.uomDisplay ?? null;
    return `${formatCurrency(uniqueRates[0], currency)} / ${resolveDisplayUom(uniqueUoms[0], display)}`;
  }

  return '多单价/单位';
}

export default function SalesInvoiceCreateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sourceName?: string; salesInvoice?: string; notice?: string }>();
  const lockedSourceName = typeof params.sourceName === 'string' ? params.sourceName.trim() : '';
  const preferences = getAppPreferences();
  const { showError, showInfo, showSuccess } = useFeedback();
  const [sourceName, setSourceName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [detail, setDetail] = useState<SalesInvoiceDetailV2 | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [sourceOrderDetail, setSourceOrderDetail] = useState<SalesOrderDetailV2 | null>(null);
  const [isLoadingSourceOrder, setIsLoadingSourceOrder] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showPaymentRollbackDialog, setShowPaymentRollbackDialog] = useState(false);
  const [showCancelPaymentDialog, setShowCancelPaymentDialog] = useState(false);
  const [cancelResultOpen, setCancelResultOpen] = useState(false);
  const [paymentNotice, setPaymentNotice] = useState<{
    unallocatedAmount?: number;
    writeoffAmount?: number;
  } | null>(null);
  const isCancelledDetail = detail?.documentStatus === 'cancelled';
  const settlementTone = detail ? buildSettlementTone(detail) : 'warning';
  const salesInvoiceName =
    typeof params.salesInvoice === 'string' ? params.salesInvoice.trim() : '';
  const sourceOrderName = lockedSourceName || sourceName.trim();

  useEffect(() => {
    if (lockedSourceName) {
      setSourceName(lockedSourceName);
    }
    if (params.notice === 'created' && typeof params.salesInvoice === 'string' && params.salesInvoice.trim()) {
      showSuccess(`已生成销售发票：${params.salesInvoice.trim()}`);
    }
  }, [lockedSourceName, params.notice, params.salesInvoice, showSuccess]);

  useEffect(() => {
    let isMounted = true;

    async function loadSourceOrderDetail() {
      if (salesInvoiceName) {
        setSourceOrderDetail(null);
        return;
      }

      const trimmedSource = sourceName.trim();
      if (!trimmedSource) {
        setSourceOrderDetail(null);
        return;
      }

      try {
        setIsLoadingSourceOrder(true);
        const nextDetail = await getSalesOrderDetailV2(trimmedSource);
        if (isMounted) {
          setSourceOrderDetail(nextDetail);
        }
      } catch {
        if (isMounted) {
          setSourceOrderDetail(null);
        }
      } finally {
        if (isMounted) {
          setIsLoadingSourceOrder(false);
        }
      }
    }

    void loadSourceOrderDetail();

    return () => {
      isMounted = false;
    };
  }, [salesInvoiceName, sourceName]);

  const refreshPaymentNotice = useCallback(() => {
    if (!salesInvoiceName) {
      setPaymentNotice(null);
      return;
    }

    const handoff = getPaymentResultHandoff(salesInvoiceName);
    setPaymentNotice(
      handoff
        ? {
            unallocatedAmount: handoff.unallocatedAmount,
            writeoffAmount: handoff.writeoffAmount,
          }
        : null,
    );
  }, [salesInvoiceName]);

  const loadDetail = useCallback(
    async (silently = false) => {
      if (!salesInvoiceName) {
        setDetail(null);
        return;
      }

      try {
        if (!silently) {
          setIsLoadingDetail(true);
        }
        const nextDetail = await getSalesInvoiceDetailV2(salesInvoiceName);
        setDetail(nextDetail);
      } catch (error) {
        setDetail(null);
        showError(error instanceof Error ? error.message : '销售发票详情加载失败。');
      } finally {
        if (!silently) {
          setIsLoadingDetail(false);
        }
      }
    },
    [salesInvoiceName, showError],
  );

  useEffect(() => {
    refreshPaymentNotice();
    void loadDetail();
  }, [loadDetail, refreshPaymentNotice]);

  useFocusEffect(
    useCallback(() => {
      refreshPaymentNotice();
      void loadDetail(true);
    }, [loadDetail, refreshPaymentNotice]),
  );

  function returnToInvoiceSource() {
    if (sourceOrderName) {
      router.replace({
        pathname: '/sales/order/[orderName]',
        params: { orderName: sourceOrderName },
      });
      return;
    }

    router.replace('/(tabs)/sales');
  }

  async function handleSubmit() {
    const trimmedSource = sourceName.trim();
    if (!trimmedSource) {
      showError('请输入销售订单号。');
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await createSalesInvoice({
        source_name: trimmedSource,
        due_date: dueDate.trim() || undefined,
        remarks: remarks.trim() || undefined,
      });
      const invoiceName = String(result?.sales_invoice || result?.name || '');
      showSuccess(invoiceName ? `销售发票已创建：${invoiceName}` : '销售发票已创建。');
      if (invoiceName) {
        router.replace({
          pathname: '/sales/invoice/create',
          params: {
            sourceName: trimmedSource,
            salesInvoice: invoiceName,
            notice: 'created',
          },
        });
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : '销售发票创建失败。');
    } finally {
      setIsSubmitting(false);
    }
  }

  function openPrintPreview() {
    if (!detail?.name) {
      showInfo('当前发票详情尚未加载完成。');
      return;
    }

    router.push({
      pathname: '/sales/invoice/preview',
      params: { salesInvoice: detail.name },
    });
  }

  async function handleCancelSalesInvoice() {
    if (!detail?.name) {
      showError('缺少销售发票号。');
      return;
    }

    try {
      setIsCancelling(true);
      const nextDetail = await cancelSalesInvoiceV2(detail.name);
      if (nextDetail) {
        setDetail(nextDetail);
      }
      setShowCancelDialog(false);
      setCancelResultOpen(true);
      showSuccess(`销售发票 ${detail.name} 已作废。`);
    } catch (error) {
      showError(error instanceof Error ? error.message : '销售发票作废失败。');
    } finally {
      setIsCancelling(false);
    }
  }

  async function handleCancelPaymentThenInvoice() {
    if (!detail?.name) {
      showError('缺少销售发票号。');
      return;
    }

    if (!detail.latestPaymentEntry) {
      showError('当前发票已存在收款结果，但未找到可回退的收款单，请先联系管理员核对后再处理发票作废。');
      return;
    }

    try {
      setIsCancelling(true);
      await cancelPaymentEntryV2(detail.latestPaymentEntry);
      const nextDetail = await cancelSalesInvoiceV2(detail.name);
      if (nextDetail) {
        setDetail(nextDetail);
      }
      setShowPaymentRollbackDialog(false);
      setShowCancelDialog(false);
      setCancelResultOpen(true);
      showSuccess(`已先回退收款单 ${detail.latestPaymentEntry}，再作废销售发票 ${detail.name}。`);
    } catch (error) {
      showError(error instanceof Error ? error.message : '收款回退或发票作废失败。');
    } finally {
      setIsCancelling(false);
    }
  }

  async function handleCancelPaymentOnly() {
    if (!detail?.latestPaymentEntry) {
      showError('当前没有可回退的收款单。');
      return;
    }

    try {
      setIsCancelling(true);
      await cancelPaymentEntryV2(detail.latestPaymentEntry);
      await loadDetail(true);
      refreshPaymentNotice();
      setShowCancelPaymentDialog(false);
      showSuccess(`收款单 ${detail.latestPaymentEntry} 已回退，当前发票已恢复为待收款状态。`);
    } catch (error) {
      showError(error instanceof Error ? error.message : '收款回退失败。');
    } finally {
      setIsCancelling(false);
    }
  }

  function requestInvoiceCancellation() {
    const hasPayment =
      Boolean(detail?.latestPaymentEntry) ||
      (detail?.actualPaidAmount ?? 0) > 0 ||
      (detail?.paidAmount ?? 0) > 0;

    if (hasPayment) {
      setShowPaymentRollbackDialog(true);
      return;
    }

    setShowCancelDialog(true);
  }

  if (!params.salesInvoice) {
    return (
      <AppShell
        title="销售开票"
        description="根据已存在的销售订单生成销售发票，适合作为后续结算与收款依据。"
        footer={
          <View style={styles.footerRow}>
            <Pressable
              onPress={returnToInvoiceSource}
              style={[styles.footerButton, styles.footerGhostButton]}>
              <ThemedText style={styles.footerGhostText} type="defaultSemiBold">
                {sourceOrderName ? '返回订单' : '返回销售'}
              </ThemedText>
            </Pressable>
            <Pressable onPress={() => void handleSubmit()} style={[styles.footerButton, styles.primaryButton]}>
              <ThemedText style={styles.primaryButtonText} type="defaultSemiBold">
                {isSubmitting ? '开票中...' : '创建销售发票'}
              </ThemedText>
            </Pressable>
          </View>
        }>
        <PreferenceSummary title="当前销售模式" modeLabel={preferences.salesFlowMode === 'quick' ? '快捷结算' : '分步处理'} />

        {isLoadingSourceOrder ? (
          <View style={styles.previewLoadingCard}>
            <ActivityIndicator color="#2563EB" />
            <ThemedText style={styles.previewLoadingText}>正在加载来源订单摘要...</ThemedText>
          </View>
        ) : sourceOrderDetail ? (
          <InvoiceSourceSummary detail={sourceOrderDetail} />
        ) : null}

        <View style={styles.formCard}>
          <View style={styles.fieldBlock}>
            <ThemedText style={styles.label} type="defaultSemiBold">销售订单号</ThemedText>
            <TextInput
              editable={!lockedSourceName}
              onChangeText={setSourceName}
              placeholder="例如 SAL-ORD-2026-00089"
              placeholderTextColor="#9CA3AF"
              style={[styles.input, lockedSourceName ? styles.inputLocked : null]}
              value={sourceName}
            />
            {lockedSourceName ? (
              <ThemedText style={styles.helperText}>
                当前开票来源已由上一页确定，如需更换来源，请先返回对应订单或从销售模块重新进入。
              </ThemedText>
            ) : null}
          </View>

          <View style={styles.fieldBlock}>
            <ThemedText style={styles.label} type="defaultSemiBold">到期日期</ThemedText>
            <TextInput
              onChangeText={setDueDate}
              placeholder="YYYY-MM-DD，可留空"
              placeholderTextColor="#9CA3AF"
              style={styles.input}
              value={dueDate}
            />
          </View>

          <View style={styles.fieldBlock}>
            <ThemedText style={styles.label} type="defaultSemiBold">备注</ThemedText>
            <TextInput
              multiline
              numberOfLines={4}
              onChangeText={setRemarks}
              placeholder="可补充开票说明"
              placeholderTextColor="#9CA3AF"
              style={styles.textarea}
              textAlignVertical="top"
              value={remarks}
            />
          </View>
        </View>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="销售发票详情"
      description="查看销售发票的金额结算、来源订单、发货关联与最新收款结果。"
      footer={
        detail && !isCancelledDetail ? (
          <View style={styles.detailFooterWrap}>
            <ThemedText style={styles.footerHint}>
              {(detail.outstandingAmount ?? 0) > 0
                ? '当前发票仍有效，可继续收款或打印留档。'
                : '当前发票已结清，可继续打印留档；若要回退，请先确认是否需要同步回退收款。'}
            </ThemedText>
            <View style={styles.footerRow}>
              <Pressable
                onPress={openPrintPreview}
                style={[styles.footerButton, styles.footerGhostButton]}>
                <ThemedText style={styles.footerGhostText} type="defaultSemiBold">
                  打印预览
                </ThemedText>
              </Pressable>

              {(detail.outstandingAmount ?? 0) > 0 ? (
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/sales/payment/create',
                      params: {
                        salesInvoice: detail.name,
                        amount: String(detail.outstandingAmount ?? ''),
                        currency: detail.currency,
                      },
                    })
                  }
                  style={[styles.footerButton, styles.primaryButton]}>
                  <ThemedText style={styles.primaryButtonText} type="defaultSemiBold">
                    前往收款
                  </ThemedText>
                </Pressable>
              ) : (
                <Pressable disabled style={[styles.footerButton, styles.primaryButton, styles.footerDisabledButton]}>
                  <ThemedText style={styles.primaryButtonText} type="defaultSemiBold">
                    已收款
                  </ThemedText>
                </Pressable>
              )}
            </View>
          </View>
        ) : null
      }>
      {isLoadingDetail ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#2563EB" />
          <ThemedText style={styles.loadingText}>正在加载销售发票详情...</ThemedText>
        </View>
      ) : detail ? (
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.statusStrip}>
            <View style={styles.statusStripMeta}>
              <ThemedText style={styles.statusStripLabel}>单据状态</ThemedText>
              <ThemedText style={styles.statusStripTitle} type="defaultSemiBold">
                {isCancelledDetail ? '已作废历史发票' : '有效销售发票'}
              </ThemedText>
            </View>
            <View style={styles.statusBadgeGroup}>
              <View style={[styles.badge, isCancelledDetail ? styles.cancelledBadge : null]}>
                <ThemedText
                  style={[styles.badgeText, isCancelledDetail ? styles.cancelledBadgeText : null]}
                  type="defaultSemiBold">
                  {formatStatusLabel(detail.documentStatus)}
                </ThemedText>
              </View>
              <View
                style={[
                  styles.badge,
                  styles.settlementBadge,
                  settlementTone === 'success'
                    ? styles.successBadge
                    : settlementTone === 'danger'
                      ? styles.cancelledBadge
                      : styles.warningBadge,
                ]}>
                <ThemedText
                  style={[
                    styles.badgeText,
                    settlementTone === 'success'
                      ? styles.successBadgeText
                      : settlementTone === 'danger'
                        ? styles.cancelledBadgeText
                        : styles.warningBadgeText,
                  ]}
                  type="defaultSemiBold">
                  {buildSettlementLabel(detail)}
                </ThemedText>
              </View>
            </View>
          </View>

          <View style={styles.summaryGrid}>
            <View style={styles.summaryCell}>
              <ThemedText style={styles.summaryLabel}>发票号</ThemedText>
              <ThemedText style={styles.summaryValue} type="defaultSemiBold">
                {detail.name}
              </ThemedText>
            </View>
            <View style={styles.summaryCell}>
              <ThemedText style={styles.summaryLabel}>最新收款单</ThemedText>
              <ThemedText style={styles.summaryValue} type="defaultSemiBold">
                {detail.latestPaymentEntry || '暂未收款'}
              </ThemedText>
            </View>
          </View>

          <View style={[styles.statusHintCard, isCancelledDetail ? styles.cancelledStatusHintCard : null]}>
            <ThemedText
              style={[styles.statusHintTitle, isCancelledDetail ? styles.cancelledStatusHintTitle : null]}
              type="defaultSemiBold">
              {isCancelledDetail ? '历史发票' : '当前状态'}
            </ThemedText>
            <ThemedText
              style={[styles.statusHintText, isCancelledDetail ? styles.cancelledStatusHintText : null]}>
              {buildInvoiceStatusHint(detail)}
            </ThemedText>
          </View>

          <View style={styles.printHintCard}>
            <ThemedText style={styles.printHintTitle} type="defaultSemiBold">
              打印与交付
            </ThemedText>
            <ThemedText style={styles.printHintText}>
              {isCancelledDetail
                ? '当前页面保留这张历史发票的可视版式，便于核对和留档；如需继续业务处理，请回到仍然有效的订单或发货单。'
                : '先核对客户、金额和开票商品，再使用打印预览确认版式；后续这里会承接打印、分享 PDF 和补打。'}
            </ThemedText>
          </View>

          <SalesInvoiceSheet detail={detail} />

          {paymentNotice && ((paymentNotice.unallocatedAmount ?? 0) > 0 || (paymentNotice.writeoffAmount ?? 0) > 0) ? (
            <View style={styles.noticeCard}>
              <ThemedText style={styles.noticeTitle} type="defaultSemiBold">
                最新收款结果
              </ThemedText>
              {(paymentNotice.unallocatedAmount ?? 0) > 0 ? (
                <ThemedText style={styles.noticeText}>
                  当前发票已结清，另有{' '}
                  <ThemedText style={styles.noticeEmphasis} type="defaultSemiBold">
                    {paymentNotice.unallocatedAmount?.toFixed(2)}
                  </ThemedText>{' '}
                  元作为未分配金额保留。
                </ThemedText>
              ) : (
                <ThemedText style={styles.noticeText}>
                  当前发票已按差额核销结清，已处理差额{' '}
                  <ThemedText style={styles.noticeEmphasis} type="defaultSemiBold">
                    {paymentNotice.writeoffAmount?.toFixed(2)}
                  </ThemedText>{' '}
                  元。
                </ThemedText>
              )}
            </View>
          ) : null}

          <View style={styles.sectionCard}>
            <ThemedText style={styles.sectionTitle} type="subtitle">
              单据摘要
            </ThemedText>
            <View style={styles.row}>
              <ThemedText style={styles.rowLabel}>公司</ThemedText>
              <ThemedText style={styles.rowValue}>{detail.company || '未配置'}</ThemedText>
            </View>
            <View style={styles.row}>
              <ThemedText style={styles.rowLabel}>最新收款单</ThemedText>
              <ThemedText style={styles.rowValue}>{detail.latestPaymentEntry || '暂未收款'}</ThemedText>
            </View>
            <View style={styles.row}>
              <ThemedText style={styles.rowLabel}>打印状态</ThemedText>
              <ThemedText style={styles.rowValue}>{isCancelledDetail ? '历史留档' : '待接入'}</ThemedText>
            </View>
          </View>

          {(detail.salesOrders[0] || detail.deliveryNotes[0]) ? (
            <View style={styles.sectionCard}>
              <ThemedText style={styles.sectionTitle} type="subtitle">
                单据跳转
              </ThemedText>
              <View style={styles.actionRow}>
                {detail.salesOrders[0] ? (
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: '/sales/order/[orderName]',
                        params: { orderName: detail.salesOrders[0] },
                      })
                    }
                    style={[styles.actionButton, styles.secondaryActionButton]}>
                    <ThemedText style={styles.secondaryActionText} type="defaultSemiBold">
                      返回订单
                    </ThemedText>
                  </Pressable>
                ) : null}

                {detail.deliveryNotes[0] ? (
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: '/sales/delivery/create',
                        params: { deliveryNote: detail.deliveryNotes[0] },
                      })
                    }
                    style={[styles.actionButton, styles.secondaryActionButton]}>
                    <ThemedText style={styles.secondaryActionText} type="defaultSemiBold">
                      查看发货单
                    </ThemedText>
                  </Pressable>
                ) : null}

                {!isCancelledDetail && (detail.outstandingAmount ?? 0) > 0 ? (
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: '/sales/payment/create',
                        params: {
                          salesInvoice: detail.name,
                          amount: String(detail.outstandingAmount ?? ''),
                          currency: detail.currency,
                        },
                      })
                    }
                    style={styles.actionButton}>
                    <ThemedText style={styles.actionButtonText} type="defaultSemiBold">
                      前往收款
                    </ThemedText>
                  </Pressable>
                ) : null}
              </View>
              {isCancelledDetail ? (
                <ThemedText style={styles.helperText}>
                  当前发票已经作废，这里只保留返回上游单据的入口，不再继续暴露收款或发票回退类动作。
                </ThemedText>
              ) : (detail.outstandingAmount ?? 0) > 0 ? (
                <ThemedText style={styles.helperText}>
                  这张发票目前仍有效且存在未收金额，可以从这里继续进入收款流程。
                </ThemedText>
              ) : null}
            </View>
          ) : null}

          <View style={styles.sectionCard}>
            <ThemedText style={styles.sectionTitle} type="subtitle">
              金额结算
            </ThemedText>
            <View style={styles.row}>
              <ThemedText style={styles.rowLabel}>发票金额</ThemedText>
              <ThemedText style={styles.rowValue}>{formatCurrency(detail.receivableAmount, detail.currency)}</ThemedText>
            </View>
            <View style={styles.row}>
              <ThemedText style={styles.rowLabel}>实收金额</ThemedText>
              <ThemedText style={[styles.rowValue, styles.positiveValue]}>
                {formatCurrency(detail.actualPaidAmount, detail.currency)}
              </ThemedText>
            </View>
            {(detail.totalWriteoffAmount ?? 0) > 0 ? (
              <View style={styles.row}>
                <ThemedText style={styles.rowLabel}>核销金额</ThemedText>
                <ThemedText style={[styles.rowValue, styles.writeoffValue]}>
                  {formatCurrency(detail.totalWriteoffAmount, detail.currency)}
                </ThemedText>
              </View>
            ) : null}
            {(detail.latestUnallocatedAmount ?? 0) > 0 ? (
              <View style={styles.row}>
                <ThemedText style={styles.rowLabel}>额外收款</ThemedText>
                <ThemedText style={[styles.rowValue, styles.extraValue]}>
                  {formatCurrency(detail.latestUnallocatedAmount, detail.currency)}
                </ThemedText>
              </View>
            ) : null}
            <View style={styles.row}>
              <ThemedText style={styles.rowLabel}>未收金额</ThemedText>
              <ThemedText style={[styles.rowValue, (detail.outstandingAmount ?? 0) > 0 ? styles.warningValue : styles.mutedValue]}>
                {formatCurrency(detail.outstandingAmount, detail.currency)}
              </ThemedText>
            </View>
          </View>

          {!isCancelledDetail &&
          (detail.canCancelSalesInvoice || detail.cancelSalesInvoiceHint || detail.latestPaymentEntry) ? (
            <View style={styles.rollbackCard}>
              <ThemedText style={styles.rollbackTitle} type="defaultSemiBold">
                回退处理
              </ThemedText>
              <ThemedText style={styles.rollbackText}>
                {detail.latestPaymentEntry
                  ? '这张发票已经有关联收款。若只是收款登记有误，可先单独回退收款；若订单金额或开票结果有问题，应先回退收款，再作废发票。'
                  : detail.cancelSalesInvoiceHint ||
                    '如需修改订单或重走开票流程，可以先作废当前销售发票，再回到发货或订单页面继续处理。'}
              </ThemedText>
              <View style={styles.rollbackActionRow}>
                {detail.latestPaymentEntry ? (
                  <Pressable
                    onPress={() => setShowCancelPaymentDialog(true)}
                    style={[styles.rollbackButton, styles.rollbackSecondaryButton]}>
                    <ThemedText style={styles.rollbackSecondaryText} type="defaultSemiBold">
                      回退收款
                    </ThemedText>
                  </Pressable>
                ) : null}
                {detail.canCancelSalesInvoice ? (
                  <Pressable
                    onPress={requestInvoiceCancellation}
                    style={[styles.rollbackButton, styles.rollbackDangerButton]}>
                    <ThemedText style={styles.rollbackDangerText} type="defaultSemiBold">
                      {detail.latestPaymentEntry ? '回退收款并作废发票' : '作废销售发票'}
                    </ThemedText>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}

        </ScrollView>
      ) : (
        <View style={styles.emptyCard}>
          <ThemedText style={styles.hint}>未能加载销售发票详情，请返回订单页后重试。</ThemedText>
        </View>
      )}

      <ConfirmDialog
        confirmLabel={isCancelling ? '作废中...' : '确认作废'}
        description="作废后，这张发票将从订单结算链路中移除。如果已经登记收款，系统可能要求先处理收款或解除引用。"
        onClose={() => {
          if (!isCancelling) {
            setShowCancelDialog(false);
          }
        }}
        onConfirm={() => void handleCancelSalesInvoice()}
        title="作废销售发票？"
        visible={showCancelDialog}
      />

      <ConfirmDialog
        confirmLabel={isCancelling ? '回退中...' : '确认回退收款'}
        description="回退后，这张发票上的收款登记会被撤销，未收金额会恢复。发票本身不会作废，可继续重新收款或再决定是否回退整张发票。"
        onClose={() => {
          if (!isCancelling) {
            setShowCancelPaymentDialog(false);
          }
        }}
        onConfirm={() => void handleCancelPaymentOnly()}
        title="回退这张发票的收款？"
        visible={showCancelPaymentDialog}
      />

      <PaymentRollbackDialog
        confirmLabel={isCancelling ? '处理中...' : '先回退收款再作废发票'}
        invoiceName={detail?.name ?? ''}
        paymentEntryName={detail?.latestPaymentEntry ?? ''}
        onClose={() => {
          if (!isCancelling) {
            setShowPaymentRollbackDialog(false);
          }
        }}
        onConfirm={() => void handleCancelPaymentThenInvoice()}
        visible={showPaymentRollbackDialog}
      />

      <InvoiceCancelResultDialog
        deliveryNoteName={detail?.deliveryNotes[0] ?? ''}
        onClose={() => setCancelResultOpen(false)}
        onViewDelivery={() => {
          if (!detail?.deliveryNotes[0]) {
            return;
          }
          setCancelResultOpen(false);
          router.replace({
            pathname: '/sales/delivery/create',
            params: { deliveryNote: detail.deliveryNotes[0] },
          });
        }}
        onViewOrder={() => {
          if (!detail?.salesOrders[0]) {
            return;
          }
          setCancelResultOpen(false);
          router.replace({
            pathname: '/sales/order/[orderName]',
            params: { orderName: detail.salesOrders[0] },
          });
        }}
        orderName={detail?.salesOrders[0] ?? ''}
        visible={cancelResultOpen}
      />
    </AppShell>
  );
}

function InvoiceSourceSummary({ detail }: { detail: SalesOrderDetailV2 }) {
  const groupedItems = groupOrderItems(detail.items);

  return (
    <View style={styles.sectionCard}>
      <ThemedText style={styles.sectionTitle} type="subtitle">
        开票确认
      </ThemedText>

      <View style={styles.summaryGrid}>
        <View style={styles.summaryCell}>
          <ThemedText style={styles.summaryLabel}>来源订单</ThemedText>
          <ThemedText style={styles.summaryValue} type="defaultSemiBold">
            {detail.name}
          </ThemedText>
        </View>
        <View style={styles.summaryCell}>
          <ThemedText style={styles.summaryLabel}>客户</ThemedText>
          <ThemedText style={styles.summaryValue} type="defaultSemiBold">
            {detail.customer || '未配置'}
          </ThemedText>
        </View>
      </View>

      <View style={styles.summaryGrid}>
        <View style={[styles.summaryCell, styles.primaryAmountCell]}>
          <ThemedText style={[styles.summaryLabel, styles.primaryAmountLabel]}>订单总价</ThemedText>
          <ThemedText style={[styles.summaryValue, styles.primaryAmountValue]} type="defaultSemiBold">
            {formatCurrency(detail.grandTotal, detail.currency)}
          </ThemedText>
        </View>
        <View style={[styles.summaryCell, styles.secondaryAmountCell]}>
          <ThemedText style={[styles.summaryLabel, styles.secondaryAmountLabel]}>未开票金额参考</ThemedText>
          <ThemedText style={[styles.summaryValue, styles.secondaryAmountValue]} type="defaultSemiBold">
            {formatCurrency(detail.grandTotal, detail.currency)}
          </ThemedText>
        </View>
      </View>

      <View style={styles.previewMetaCard}>
        <View style={styles.row}>
          <ThemedText style={styles.rowLabel}>公司</ThemedText>
          <ThemedText style={styles.rowValue}>{detail.company || '未配置'}</ThemedText>
        </View>
        <View style={styles.row}>
          <ThemedText style={styles.rowLabel}>收货联系人</ThemedText>
          <ThemedText style={styles.rowValue}>{detail.contactDisplay || '未配置'}</ThemedText>
        </View>
        <View style={styles.rowBlock}>
          <ThemedText style={styles.rowLabel}>收货地址</ThemedText>
          <ThemedText style={styles.rowValue}>{detail.addressDisplay || '未配置收货地址'}</ThemedText>
        </View>
      </View>

      <View style={styles.previewGoodsCard}>
        <View style={styles.previewGoodsHeader}>
          <ThemedText style={styles.previewGoodsTitle} type="defaultSemiBold">
            开票商品摘要
          </ThemedText>
          <ThemedText style={styles.previewGoodsHint}>按商品聚合展示，仓库信息不作为发票主视图展示。</ThemedText>
        </View>

        <View style={styles.previewTableHeader}>
          <ThemedText style={[styles.previewTableCell, styles.previewTableCellName]} type="defaultSemiBold">
            商品
          </ThemedText>
          <ThemedText style={[styles.previewTableCell, styles.previewTableCellSpec]} type="defaultSemiBold">
            规格
          </ThemedText>
          <ThemedText style={[styles.previewTableCell, styles.previewTableCellQty]} type="defaultSemiBold">
            数量
          </ThemedText>
          <ThemedText style={[styles.previewTableCell, styles.previewTableCellRate]} type="defaultSemiBold">
            单价
          </ThemedText>
          <ThemedText style={[styles.previewTableCell, styles.previewTableCellAmount]} type="defaultSemiBold">
            金额
          </ThemedText>
        </View>

        {groupedItems.map((item, index) => (
          <View
            key={`${item.itemCode}-${index}`}
            style={[styles.previewItemRow, index > 0 ? styles.previewItemDivider : null]}>
            <View style={[styles.previewTableCell, styles.previewTableCellName]}>
              <ThemedText style={styles.previewItemName} type="defaultSemiBold">
                {item.itemName}
              </ThemedText>
            </View>
            <View style={[styles.previewTableCell, styles.previewTableCellSpec]}>
              <ThemedText style={styles.previewItemSpec}>{item.specification || '—'}</ThemedText>
            </View>
            <ThemedText style={[styles.previewTableCell, styles.previewTableCellQty]} type="defaultSemiBold">
              {`合计 ${buildQuantityComposition(item.rows)}`}
            </ThemedText>
            <ThemedText style={[styles.previewTableCell, styles.previewTableCellRate]}>
              {buildGroupedInvoiceRateSummary(item.rows, detail.currency)}
            </ThemedText>
            <ThemedText style={[styles.previewTableCell, styles.previewTableCellAmount, styles.previewItemAmount]} type="defaultSemiBold">
              {formatCurrency(item.totalAmount, detail.currency)}
            </ThemedText>
          </View>
        ))}
      </View>
    </View>
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
          <ThemedText style={styles.dialogDescription}>{description}</ThemedText>
          <View style={styles.dialogActionRow}>
            <Pressable onPress={onClose} style={[styles.dialogButton, styles.dialogGhostButton]}>
              <ThemedText style={styles.dialogGhostText} type="defaultSemiBold">
                先不处理
              </ThemedText>
            </Pressable>
            <Pressable onPress={onConfirm} style={[styles.dialogButton, styles.dialogDangerButton]}>
              <ThemedText style={styles.dialogDangerText} type="defaultSemiBold">
                {confirmLabel}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function PaymentRollbackDialog({
  visible,
  invoiceName,
  paymentEntryName,
  confirmLabel,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  invoiceName: string;
  paymentEntryName: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.dialogBackdrop}>
        <View style={[styles.dialogCard, styles.paymentRollbackDialogCard]}>
          <ThemedText style={styles.dialogTitle} type="defaultSemiBold">
            这张发票已有收款记录
          </ThemedText>
          <ThemedText style={styles.dialogDescription}>
            当前发票 {invoiceName || '未命名发票'} 已关联收款单 {paymentEntryName || '未命名收款单'}。
            为避免留下未分配金额并影响后续结算，这里只保留“先回退收款，再作废发票”的处理方式。
          </ThemedText>
          <View style={styles.paymentRollbackTipCard}>
            <ThemedText style={styles.paymentRollbackTipTitle} type="defaultSemiBold">
              推荐处理顺序
            </ThemedText>
            <ThemedText style={styles.paymentRollbackTipText}>
              先作废收款单，资金会从这张发票上回退；再作废发票，避免留下“发票已作废但资金仍作为未分配金额保留”的状态。
            </ThemedText>
          </View>
          <View style={styles.paymentRollbackActionStack}>
            <Pressable onPress={onConfirm} style={[styles.dialogButton, styles.dialogDangerButton]}>
              <ThemedText style={styles.dialogDangerText} type="defaultSemiBold">
                {confirmLabel}
              </ThemedText>
            </Pressable>
            <Pressable onPress={onClose} style={[styles.dialogButton, styles.dialogSoftButton]}>
              <ThemedText style={styles.dialogSoftText} type="defaultSemiBold">
                先不处理
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function InvoiceCancelResultDialog({
  visible,
  orderName,
  deliveryNoteName,
  onClose,
  onViewOrder,
  onViewDelivery,
}: {
  visible: boolean;
  orderName: string;
  deliveryNoteName: string;
  onClose: () => void;
  onViewOrder: () => void;
  onViewDelivery: () => void;
}) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.dialogBackdrop}>
        <View style={[styles.dialogCard, styles.paymentRollbackDialogCard]}>
          <ThemedText style={styles.dialogTitle} type="defaultSemiBold">
            销售发票已作废
          </ThemedText>
          <ThemedText style={styles.dialogDescription}>
            这张发票已经从订单结算链路中移除。建议先返回订单查看最新状态；如果你想继续沿发货链路核对，也可以直接查看对应发货单。
          </ThemedText>
          <View style={styles.paymentRollbackActionStack}>
            {orderName ? (
              <Pressable onPress={onViewOrder} style={[styles.dialogButton, styles.dialogDangerButton]}>
                <ThemedText style={styles.dialogDangerText} type="defaultSemiBold">
                  返回订单
                </ThemedText>
              </Pressable>
            ) : null}
            {deliveryNoteName ? (
              <Pressable onPress={onViewDelivery} style={[styles.dialogButton, styles.dialogGhostButton]}>
                <ThemedText style={styles.dialogGhostText} type="defaultSemiBold">
                  查看发货单
                </ThemedText>
              </Pressable>
            ) : null}
            <Pressable onPress={onClose} style={[styles.dialogButton, styles.dialogSoftButton]}>
              <ThemedText style={styles.dialogSoftText} type="defaultSemiBold">
                留在本页
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
    gap: 16,
    paddingBottom: 28,
  },
  loadingWrap: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 40,
  },
  loadingText: {
    color: '#64748B',
    fontSize: 14,
  },
  statusStrip: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  statusStripMeta: {
    flex: 1,
    gap: 4,
  },
  statusStripLabel: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 8,
  },
  statusStripTitle: {
    color: '#0F172A',
    fontSize: 20,
    lineHeight: 28,
  },
  statusBadgeGroup: {
    alignItems: 'flex-end',
    gap: 8,
  },
  badge: {
    backgroundColor: '#DBEAFE',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  badgeText: {
    color: '#2563EB',
    fontSize: 13,
  },
  cancelledBadge: {
    backgroundColor: '#FEE2E2',
  },
  cancelledBadgeText: {
    color: '#DC2626',
  },
  settlementBadge: {
    minWidth: 78,
  },
  successBadge: {
    backgroundColor: '#DCFCE7',
  },
  successBadgeText: {
    color: '#15803D',
  },
  warningBadge: {
    backgroundColor: '#FEF3C7',
  },
  warningBadgeText: {
    color: '#B45309',
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryCell: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D7DEE7',
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  summaryLabel: {
    color: '#64748B',
    fontSize: 13,
  },
  summaryValue: {
    color: '#0F172A',
    fontSize: 15,
  },
  primaryAmountCell: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FDBA74',
  },
  primaryAmountLabel: {
    color: '#9A3412',
  },
  primaryAmountValue: {
    color: '#B45309',
    fontSize: 24,
    lineHeight: 30,
  },
  secondaryAmountCell: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  secondaryAmountLabel: {
    color: '#1D4ED8',
  },
  secondaryAmountValue: {
    color: '#1D4ED8',
    fontSize: 20,
    lineHeight: 26,
  },
  statusHintCard: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cancelledStatusHintCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  statusHintTitle: {
    color: '#1D4ED8',
    fontSize: 14,
  },
  cancelledStatusHintTitle: {
    color: '#991B1B',
  },
  statusHintText: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 20,
  },
  cancelledStatusHintText: {
    color: '#7F1D1D',
  },
  noticeCard: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  noticeTitle: {
    color: '#1D4ED8',
    fontSize: 14,
  },
  noticeText: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 20,
  },
  noticeEmphasis: {
    color: '#1D4ED8',
  },
  printHintCard: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  printHintTitle: {
    color: '#9A3412',
    fontSize: 14,
  },
  printHintText: {
    color: '#7C2D12',
    fontSize: 13,
    lineHeight: 20,
  },
  rollbackCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rollbackTitle: {
    color: '#991B1B',
    fontSize: 14,
  },
  rollbackText: {
    color: '#7F1D1D',
    fontSize: 13,
    lineHeight: 20,
  },
  rollbackButton: {
    alignItems: 'center',
    borderRadius: 14,
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  rollbackActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  rollbackDangerButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FCA5A5',
    borderWidth: 1,
  },
  rollbackDangerText: {
    color: '#DC2626',
    fontSize: 14,
  },
  rollbackSecondaryButton: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
    borderWidth: 1,
  },
  rollbackSecondaryText: {
    color: '#C2410C',
    fontSize: 14,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D7DEE7',
    borderRadius: 22,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  sectionTitle: {
    color: '#0F172A',
    fontSize: 16,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 16,
    minWidth: 132,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  secondaryActionButton: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
  },
  secondaryActionText: {
    color: '#1D4ED8',
    fontSize: 15,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  rowLabel: {
    color: '#64748B',
    fontSize: 14,
  },
  rowValue: {
    color: '#0F172A',
    flex: 1,
    fontSize: 15,
    textAlign: 'right',
  },
  previewLoadingCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D7DEE7',
    borderRadius: 22,
    borderWidth: 1,
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  previewLoadingText: {
    color: '#64748B',
    fontSize: 14,
  },
  previewMetaCard: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  previewGoodsCard: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 18,
    borderWidth: 1,
    gap: 0,
    overflow: 'hidden',
  },
  previewGoodsHeader: {
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  previewGoodsTitle: {
    color: '#0F172A',
    fontSize: 16,
  },
  previewGoodsHint: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
  },
  previewTableHeader: {
    backgroundColor: '#F1F5F9',
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  previewItemRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  previewItemDivider: {
    borderTopColor: '#E2E8F0',
    borderTopWidth: 1,
  },
  previewTableCell: {
    color: '#334155',
    flex: 1,
    fontSize: 12,
  },
  previewTableCellName: {
    flex: 1.9,
  },
  previewTableCellSpec: {
    flex: 1.2,
  },
  previewTableCellQty: {
    flex: 1.2,
  },
  previewTableCellRate: {
    flex: 1.1,
  },
  previewTableCellAmount: {
    flex: 1.2,
    textAlign: 'right',
  },
  previewItemName: {
    color: '#0F172A',
    fontSize: 14,
  },
  previewItemSpec: {
    color: '#475569',
    fontSize: 12,
    lineHeight: 18,
  },
  previewItemAmount: {
    color: '#B45309',
    fontSize: 14,
    textAlign: 'right',
  },
  positiveValue: {
    color: '#15803D',
  },
  extraValue: {
    color: '#2563EB',
  },
  writeoffValue: {
    color: '#C2410C',
  },
  warningValue: {
    color: '#DC2626',
  },
  mutedValue: {
    color: '#64748B',
  },
  formCard: {
    gap: 16,
  },
  fieldBlock: {
    gap: 8,
  },
  label: {
    fontSize: 14,
  },
  input: {
    borderColor: '#D7DEE7',
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  textarea: {
    borderColor: '#D7DEE7',
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 100,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputLocked: {
    backgroundColor: '#F8FAFC',
    color: '#475569',
  },
  helperText: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 16,
    justifyContent: 'center',
    minHeight: 48,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 12,
  },
  detailFooterWrap: {
    gap: 8,
  },
  footerHint: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
  },
  footerButton: {
    flex: 1,
  },
  footerGhostButton: {
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
  footerGhostText: {
    color: '#1D4ED8',
  },
  primaryButtonText: {
    color: '#FFFFFF',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D7DEE7',
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    padding: 18,
  },
  hint: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 22,
  },
  dialogBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  dialogCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 20,
    width: '100%',
  },
  paymentRollbackDialogCard: {
    borderColor: '#FECACA',
    borderWidth: 1,
  },
  dialogTitle: {
    color: '#991B1B',
    fontSize: 18,
  },
  dialogDescription: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 22,
  },
  dialogActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  dialogButton: {
    alignItems: 'center',
    borderRadius: 16,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 14,
  },
  dialogGhostButton: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
  },
  dialogSoftButton: {
    backgroundColor: '#F8FAFC',
    borderColor: '#D7DEE7',
    borderWidth: 1,
  },
  dialogGhostText: {
    color: '#1D4ED8',
    fontSize: 15,
  },
  dialogSoftText: {
    color: '#475569',
    fontSize: 15,
  },
  dialogDangerButton: {
    backgroundColor: '#DC2626',
  },
  dialogDangerText: {
    color: '#FFFFFF',
    fontSize: 15,
  },
  paymentRollbackTipCard: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  paymentRollbackTipTitle: {
    color: '#9A3412',
    fontSize: 14,
  },
  paymentRollbackTipText: {
    color: '#7C2D12',
    fontSize: 13,
    lineHeight: 20,
  },
  paymentRollbackActionStack: {
    gap: 10,
    marginTop: 4,
  },
});
