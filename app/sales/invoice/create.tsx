import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { PreferenceSummary } from '@/components/preference-summary';
import { SalesInvoiceSheet } from '@/components/sales-invoice-sheet';
import { ThemedText } from '@/components/themed-text';
import { getAppPreferences } from '@/lib/app-preferences';
import { getPaymentResultHandoff } from '@/lib/payment-result-handoff';
import { useFeedback } from '@/providers/feedback-provider';
import { createSalesInvoice } from '@/services/gateway';
import { cancelSalesInvoiceV2, getSalesInvoiceDetailV2, type SalesInvoiceDetailV2 } from '@/services/sales';

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
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [paymentNotice, setPaymentNotice] = useState<{
    unallocatedAmount?: number;
    writeoffAmount?: number;
  } | null>(null);

  useEffect(() => {
    if (lockedSourceName) {
      setSourceName(lockedSourceName);
    }
    if (params.notice === 'created' && typeof params.salesInvoice === 'string' && params.salesInvoice.trim()) {
      showSuccess(`已生成销售发票：${params.salesInvoice.trim()}`);
    }
    if (typeof params.salesInvoice === 'string' && params.salesInvoice.trim()) {
      const handoff = getPaymentResultHandoff(params.salesInvoice.trim());
      setPaymentNotice(
        handoff
          ? {
              unallocatedAmount: handoff.unallocatedAmount,
              writeoffAmount: handoff.writeoffAmount,
            }
          : null,
      );
    }
  }, [lockedSourceName, params.notice, params.salesInvoice, showSuccess]);

  useEffect(() => {
    let isMounted = true;

    async function loadDetail() {
      const salesInvoiceName =
        typeof params.salesInvoice === 'string' ? params.salesInvoice.trim() : '';
      if (!salesInvoiceName) {
        setDetail(null);
        return;
      }

      try {
        setIsLoadingDetail(true);
        const nextDetail = await getSalesInvoiceDetailV2(salesInvoiceName);
        if (isMounted) {
          setDetail(nextDetail);
        }
      } catch (error) {
        if (isMounted) {
          setDetail(null);
        }
        showError(error instanceof Error ? error.message : '销售发票详情加载失败。');
      } finally {
        if (isMounted) {
          setIsLoadingDetail(false);
        }
      }
    }

    void loadDetail();
    return () => {
      isMounted = false;
    };
  }, [params.salesInvoice, showError]);

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
      showSuccess(`销售发票 ${detail.name} 已作废。`);
    } catch (error) {
      showError(error instanceof Error ? error.message : '销售发票作废失败。');
    } finally {
      setIsCancelling(false);
    }
  }

  if (!params.salesInvoice) {
    return (
      <AppShell
        title="销售开票"
        description="根据已存在的销售订单生成销售发票，适合作为后续结算与收款依据。"
        footer={
          <View style={styles.footerRow}>
            <Pressable
              onPress={() => router.push('/(tabs)/sales')}
              style={[styles.footerButton, styles.footerGhostButton]}>
              <ThemedText style={styles.footerGhostText} type="defaultSemiBold">
                返回销售
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
        detail ? (
          <View style={styles.detailFooterWrap}>
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
                <Pressable onPress={openPrintPreview} style={[styles.footerButton, styles.primaryButton]}>
                  <ThemedText style={styles.primaryButtonText} type="defaultSemiBold">
                    预览并打印
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
            <ThemedText style={styles.statusStripLabel}>单据状态</ThemedText>
            <View style={styles.badge}>
              <ThemedText style={styles.badgeText} type="defaultSemiBold">
                {formatStatusLabel(detail.documentStatus)}
              </ThemedText>
            </View>
          </View>

          <View style={styles.printHintCard}>
            <ThemedText style={styles.printHintTitle} type="defaultSemiBold">
              打印与交付
            </ThemedText>
            <ThemedText style={styles.printHintText}>
              先核对客户、金额和开票商品，再使用打印预览确认版式；后续这里会承接打印、分享 PDF 和补打。
            </ThemedText>
          </View>

          {detail.canCancelSalesInvoice || detail.cancelSalesInvoiceHint ? (
            <View style={styles.rollbackCard}>
              <ThemedText style={styles.rollbackTitle} type="defaultSemiBold">
                回退处理
              </ThemedText>
              <ThemedText style={styles.rollbackText}>
                {detail.cancelSalesInvoiceHint ||
                  '如需修改订单或重走开票流程，可以先作废当前销售发票，再回到发货或订单页面继续处理。'}
              </ThemedText>
              {detail.canCancelSalesInvoice ? (
                <Pressable
                  onPress={() => setShowCancelDialog(true)}
                  style={[styles.rollbackButton, styles.rollbackDangerButton]}>
                  <ThemedText style={styles.rollbackDangerText} type="defaultSemiBold">
                    作废销售发票
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>
          ) : null}

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
              <ThemedText style={styles.rowValue}>待接入</ThemedText>
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
              </View>
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
  statusStripLabel: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 8,
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
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
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
  dialogGhostText: {
    color: '#1D4ED8',
    fontSize: 15,
  },
  dialogDangerButton: {
    backgroundColor: '#DC2626',
  },
  dialogDangerText: {
    color: '#FFFFFF',
    fontSize: 15,
  },
});
