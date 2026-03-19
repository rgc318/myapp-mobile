import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { PreferenceSummary } from '@/components/preference-summary';
import { ThemedText } from '@/components/themed-text';
import { getAppPreferences } from '@/lib/app-preferences';
import { getPaymentResultHandoff } from '@/lib/payment-result-handoff';
import { useFeedback } from '@/providers/feedback-provider';
import { createSalesInvoice } from '@/services/gateway';
import { getSalesInvoiceDetailV2, type SalesInvoiceDetailV2 } from '@/services/sales';

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
  const preferences = getAppPreferences();
  const { showError, showSuccess } = useFeedback();
  const [sourceName, setSourceName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [detail, setDetail] = useState<SalesInvoiceDetailV2 | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [paymentNotice, setPaymentNotice] = useState<{
    unallocatedAmount?: number;
    writeoffAmount?: number;
  } | null>(null);

  useEffect(() => {
    if (typeof params.sourceName === 'string' && params.sourceName.trim()) {
      setSourceName(params.sourceName.trim());
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
  }, [params.notice, params.salesInvoice, params.sourceName, showSuccess]);

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

  if (!params.salesInvoice) {
    return (
      <AppShell
        title="销售开票"
        description="根据已存在的销售订单生成销售发票，适合作为后续结算与收款依据。">
        <PreferenceSummary title="当前销售模式" modeLabel={preferences.salesFlowMode === 'quick' ? '快捷结算' : '分步处理'} />

        <View style={styles.formCard}>
          <View style={styles.fieldBlock}>
            <ThemedText style={styles.label} type="defaultSemiBold">销售订单号</ThemedText>
            <TextInput
              onChangeText={setSourceName}
              placeholder="例如 SAL-ORD-2026-00089"
              placeholderTextColor="#9CA3AF"
              style={styles.input}
              value={sourceName}
            />
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

          <Pressable onPress={() => void handleSubmit()} style={styles.primaryButton}>
            <ThemedText style={styles.primaryButtonText} type="defaultSemiBold">
              {isSubmitting ? '开票中...' : '创建销售发票'}
            </ThemedText>
          </Pressable>
        </View>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="销售发票详情"
      description="查看销售发票的金额结算、来源订单、发货关联与最新收款结果。">
      {isLoadingDetail ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#2563EB" />
          <ThemedText style={styles.loadingText}>正在加载销售发票详情...</ThemedText>
        </View>
      ) : detail ? (
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.heroCard}>
            <View style={styles.heroHeader}>
              <View style={styles.heroMain}>
                <ThemedText style={styles.heroTitle} type="title">
                  {detail.customer || detail.name}
                </ThemedText>
                <ThemedText style={styles.heroSubtitle}>{detail.name}</ThemedText>
              </View>
              <View style={styles.badge}>
                <ThemedText style={styles.badgeText} type="defaultSemiBold">
                  {formatStatusLabel(detail.documentStatus)}
                </ThemedText>
              </View>
            </View>

            <View style={styles.heroStats}>
              <View style={styles.statCard}>
                <ThemedText style={styles.statLabel}>发票金额</ThemedText>
                <ThemedText style={styles.statValue} type="defaultSemiBold">
                  {formatCurrency(detail.grandTotal, detail.currency)}
                </ThemedText>
              </View>
              <View style={styles.statCard}>
                <ThemedText style={styles.statLabel}>未收金额</ThemedText>
                <ThemedText style={styles.statValue} type="defaultSemiBold">
                  {formatCurrency(detail.outstandingAmount, detail.currency)}
                </ThemedText>
              </View>
              <View style={styles.statCard}>
                <ThemedText style={styles.statLabel}>到期日期</ThemedText>
                <ThemedText style={styles.statValue} type="defaultSemiBold">
                  {detail.dueDate || '—'}
                </ThemedText>
              </View>
            </View>
          </View>

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
              单据概览
            </ThemedText>
            <View style={styles.row}>
              <ThemedText style={styles.rowLabel}>公司</ThemedText>
              <ThemedText style={styles.rowValue}>{detail.company || '未配置'}</ThemedText>
            </View>
            <View style={styles.row}>
              <ThemedText style={styles.rowLabel}>单据状态</ThemedText>
              <ThemedText style={styles.rowValue}>{formatStatusLabel(detail.documentStatus)}</ThemedText>
            </View>
            <View style={styles.row}>
              <ThemedText style={styles.rowLabel}>开票日期</ThemedText>
              <ThemedText style={styles.rowValue}>{detail.postingDate || '—'}</ThemedText>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <ThemedText style={styles.sectionTitle} type="subtitle">
              关联单据
            </ThemedText>
            <View style={styles.row}>
              <ThemedText style={styles.rowLabel}>来源订单</ThemedText>
              <ThemedText style={styles.rowValue}>{detail.salesOrders.join('、') || '未关联'}</ThemedText>
            </View>
            <View style={styles.row}>
              <ThemedText style={styles.rowLabel}>来源发货单</ThemedText>
              <ThemedText style={styles.rowValue}>{detail.deliveryNotes.join('、') || '未关联'}</ThemedText>
            </View>
            <View style={styles.row}>
              <ThemedText style={styles.rowLabel}>最新收款单</ThemedText>
              <ThemedText style={styles.rowValue}>{detail.latestPaymentEntry || '暂未收款'}</ThemedText>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <ThemedText style={styles.sectionTitle} type="subtitle">
              后续操作
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
                  style={styles.actionButton}>
                  <ThemedText style={styles.actionButtonText} type="defaultSemiBold">
                    前往收款
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>
          </View>

          <View style={styles.sectionCard}>
            <ThemedText style={styles.sectionTitle} type="subtitle">
              收货与联系人
            </ThemedText>
            <View style={styles.row}>
              <ThemedText style={styles.rowLabel}>收货联系人</ThemedText>
              <ThemedText style={styles.rowValue}>{detail.contactDisplay || '未配置'}</ThemedText>
            </View>
            <View style={styles.row}>
              <ThemedText style={styles.rowLabel}>联系电话</ThemedText>
              <ThemedText style={styles.rowValue}>{detail.contactPhone || '未配置'}</ThemedText>
            </View>
            <View style={styles.rowBlock}>
              <ThemedText style={styles.rowLabel}>收货地址</ThemedText>
              <ThemedText style={styles.rowValue}>{detail.addressDisplay || '未配置收货地址'}</ThemedText>
            </View>
          </View>

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

          <View style={styles.sectionCard}>
            <ThemedText style={styles.sectionTitle} type="subtitle">
              开票商品
            </ThemedText>
            {detail.items.map((item, index) => (
              <View key={`${item.itemCode}-${index}`} style={[styles.itemRow, index > 0 ? styles.itemDivider : null]}>
                <View style={styles.itemMain}>
                  <ThemedText style={styles.itemTitle} type="defaultSemiBold">
                    {item.itemName}
                  </ThemedText>
                  <ThemedText style={styles.itemMeta}>
                    {item.warehouse || '未配置仓库'}
                  </ThemedText>
                  <ThemedText style={styles.itemFormula}>
                    {formatCurrency(item.rate, detail.currency)} x {item.qty ?? '—'} {item.uom || ''}
                  </ThemedText>
                </View>
                <ThemedText style={styles.itemAmount} type="defaultSemiBold">
                  {formatCurrency(item.amount, detail.currency)}
                </ThemedText>
              </View>
            ))}
          </View>

          {detail.remarks ? (
            <View style={styles.sectionCard}>
              <ThemedText style={styles.sectionTitle} type="subtitle">
                发票备注
              </ThemedText>
              <ThemedText style={styles.noteText}>{detail.remarks}</ThemedText>
            </View>
          ) : null}
        </ScrollView>
      ) : (
        <View style={styles.emptyCard}>
          <ThemedText style={styles.hint}>未能加载销售发票详情，请返回订单页后重试。</ThemedText>
        </View>
      )}
    </AppShell>
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
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D7DEE7',
    borderRadius: 22,
    borderWidth: 1,
    gap: 16,
    padding: 18,
  },
  heroHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  heroMain: {
    flex: 1,
    gap: 6,
  },
  heroTitle: {
    color: '#1E293B',
    fontSize: 18,
  },
  heroSubtitle: {
    color: '#64748B',
    fontSize: 14,
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
  heroStats: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    flex: 1,
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  statLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  statValue: {
    color: '#0F172A',
    fontSize: 16,
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
  rowBlock: {
    gap: 8,
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
  itemRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  itemDivider: {
    borderTopColor: '#E2E8F0',
    borderTopWidth: 1,
    paddingTop: 14,
  },
  itemMain: {
    flex: 1,
    gap: 6,
  },
  itemTitle: {
    color: '#1E293B',
    fontSize: 16,
  },
  itemMeta: {
    color: '#64748B',
    fontSize: 13,
  },
  itemFormula: {
    color: '#B45309',
    fontSize: 14,
  },
  itemAmount: {
    color: '#B45309',
    fontSize: 16,
  },
  noteText: {
    color: '#334155',
    fontSize: 15,
    lineHeight: 24,
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
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 16,
    justifyContent: 'center',
    minHeight: 48,
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
});
