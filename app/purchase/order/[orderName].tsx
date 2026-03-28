import { useEffect, useMemo, useState } from 'react';
import type { Href } from 'expo-router';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { normalizeAppError } from '@/lib/app-error';
import { useFeedback } from '@/providers/feedback-provider';
import { fetchPurchaseOrderDetail, type PurchaseOrderDetail } from '@/services/purchases';

const MONEY = new Intl.NumberFormat('zh-CN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatMoney(value: number | null) {
  return typeof value === 'number' ? `¥ ${MONEY.format(value)}` : '—';
}

function getBusinessStatusLabel(detail: PurchaseOrderDetail | null) {
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
  if (detail.receivingStatus === 'completed') {
    return '待到票';
  }
  if (detail.receivingStatus === 'partial') {
    return '部分收货';
  }
  return '待收货';
}

function getStatusTone(detail: PurchaseOrderDetail | null) {
  if (!detail) {
    return { backgroundColor: '#E2E8F0', color: '#475569' };
  }
  if (detail.documentStatus === 'cancelled') {
    return { backgroundColor: '#FEE2E2', color: '#B91C1C' };
  }
  if (detail.completionStatus === 'completed' || detail.paymentStatus === 'paid') {
    return { backgroundColor: '#DCFCE7', color: '#15803D' };
  }
  if (detail.receivingStatus === 'partial') {
    return { backgroundColor: '#FEF3C7', color: '#B45309' };
  }
  return { backgroundColor: '#DBEAFE', color: '#1D4ED8' };
}

function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: 'default' | 'success' | 'warning';
}) {
  const tintColor = useThemeColor({}, 'tint');
  const successColor = useThemeColor({}, 'success');
  const warningColor = useThemeColor({}, 'warning');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');

  const color = tone === 'success' ? successColor : tone === 'warning' ? warningColor : tintColor;

  return (
    <View style={[styles.badge, { backgroundColor: surfaceMuted }]}>
      <ThemedText style={[styles.badgeText, { color }]} type="defaultSemiBold">
        {label}
      </ThemedText>
    </View>
  );
}

export default function PurchaseOrderDetailScreen() {
  const { orderName } = useLocalSearchParams<{ orderName: string }>();
  const { showError } = useFeedback();
  const [detail, setDetail] = useState<PurchaseOrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const surface = useThemeColor({}, 'surface');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetchPurchaseOrderDetail(orderName || '')
      .then((nextDetail) => {
        if (!cancelled) {
          setDetail(nextDetail);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          showError(normalizeAppError(error).message);
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
  }, [orderName, showError]);

  const actions = useMemo(() => {
    if (!detail?.name) {
      return [] as { href: Href; label: string; description?: string }[];
    }

    const nextActions = [] as { href: Href; label: string; description?: string }[];
    if (detail.canReceive) {
      nextActions.push({
        href: `/purchase/receipt/create?orderName=${encodeURIComponent(detail.name)}` as Href,
        label: '继续收货',
        description: '基于这张采购订单继续做实际收货',
      });
    }
    if (detail.canCreateInvoice) {
      nextActions.push({
        href: `/purchase/invoice/create?orderName=${encodeURIComponent(detail.name)}` as Href,
        label: '继续开票',
        description: '进入采购开票流程',
      });
    }
    return nextActions;
  }, [detail]);

  return (
    <AppShell
      actions={actions}
      title="采购订单详情"
      description="这里优先展示采购订单的聚合信息，包括收货、付款和后续动作状态。"
      contentCard={false}>
      <ScrollView contentContainerStyle={styles.container}>
        {isLoading ? (
          <View style={[styles.loadingCard, { backgroundColor: surface, borderColor }]}>
            <ActivityIndicator />
            <ThemedText>正在读取采购订单详情...</ThemedText>
          </View>
        ) : detail ? (
          <>
            <View style={[styles.heroCard, { backgroundColor: surface, borderColor }]}>
              <View style={styles.heroHeader}>
                <View style={styles.heroCopy}>
                  <ThemedText style={styles.heroTitle} type="defaultSemiBold">
                    {detail.supplierName || detail.supplier}
                  </ThemedText>
                  <ThemedText style={styles.heroSubline}>{detail.name}</ThemedText>
                </View>
                <View
                  style={[
                    styles.businessBadge,
                    { backgroundColor: getStatusTone(detail).backgroundColor },
                  ]}>
                  <ThemedText
                    style={[styles.businessBadgeText, { color: getStatusTone(detail).color }]}
                    type="defaultSemiBold">
                    {getBusinessStatusLabel(detail)}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.heroMetaGrid}>
                <MetaBlock label="公司" value={detail.company || '未设置'} />
                <MetaBlock label="下单日期" value={detail.transactionDate || '未设置'} />
                <MetaBlock label="计划到货" value={detail.scheduleDate || '未设置'} />
                <MetaBlock label="供应商单号" value={detail.supplierRef || '未设置'} />
              </View>

              <View style={styles.heroMetrics}>
                <View style={[styles.metricCard, { backgroundColor: surfaceMuted }]}>
                  <ThemedText style={styles.metricLabel}>订单金额</ThemedText>
                  <ThemedText style={styles.metricValue} type="defaultSemiBold">
                    {formatMoney(detail.orderAmountEstimate)}
                  </ThemedText>
                </View>
                <View style={[styles.metricCard, { backgroundColor: surfaceMuted }]}>
                  <ThemedText style={styles.metricLabel}>未付金额</ThemedText>
                  <ThemedText style={styles.metricValue} type="defaultSemiBold">
                    {formatMoney(detail.outstandingAmount)}
                  </ThemedText>
                </View>
                <View style={[styles.metricCard, { backgroundColor: surfaceMuted }]}>
                  <ThemedText style={styles.metricLabel}>已收 / 总量</ThemedText>
                  <ThemedText style={styles.metricValueSmall} type="defaultSemiBold">
                    {detail.receivedQty ?? '—'} / {detail.totalQty ?? '—'}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.statusRow}>
                <StatusBadge label={`单据 ${detail.documentStatus || 'unknown'}`} tone="default" />
                <StatusBadge
                  label={`收货 ${detail.receivingStatus || 'unknown'}`}
                  tone={detail.receivingStatus === 'completed' ? 'success' : 'warning'}
                />
                <StatusBadge
                  label={`付款 ${detail.paymentStatus || 'unknown'}`}
                  tone={detail.paymentStatus === 'paid' ? 'success' : 'warning'}
                />
                <StatusBadge
                  label={`完成 ${detail.completionStatus || 'unknown'}`}
                  tone={detail.completionStatus === 'completed' ? 'success' : 'default'}
                />
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
              <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
                订单信息
              </ThemedText>
              <View style={styles.detailList}>
                <DetailRow label="供应商编码" value={detail.supplier} />
                <DetailRow label="币种" value={detail.currency || '未设置'} />
                <DetailRow label="最新付款单" value={detail.latestPaymentEntry || '暂无'} />
                <DetailRow label="默认地址" value={detail.defaultAddressDisplay || '未设置'} />
                <DetailRow label="备注" value={detail.remarks || '无'} multiline />
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
              <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
                关联单据
              </ThemedText>
              <DetailRow
                label="采购收货单"
                value={detail.purchaseReceipts.length ? detail.purchaseReceipts.join('、') : '暂无'}
                multiline
              />
              <DetailRow
                label="采购发票"
                value={detail.purchaseInvoices.length ? detail.purchaseInvoices.join('、') : '暂无'}
                multiline
              />
            </View>

            <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
              <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
                商品明细
              </ThemedText>
              <View style={styles.itemList}>
                {detail.items.map((item, index) => (
                  <View key={`${item.itemCode}-${index}`} style={[styles.itemCard, { backgroundColor: surfaceMuted }]}>
                    <View style={styles.itemHeader}>
                      <ThemedText type="defaultSemiBold">{item.itemName || item.itemCode}</ThemedText>
                      <ThemedText>{formatMoney(item.amount)}</ThemedText>
                    </View>
                    <ThemedText style={styles.itemCode}>编码 {item.itemCode}</ThemedText>
                    <ThemedText style={styles.itemMeta}>
                      数量 {item.qty ?? '—'} · 已收 {item.receivedQty ?? '—'} · 单价 {formatMoney(item.rate)}
                    </ThemedText>
                    <ThemedText style={styles.itemMeta}>
                      仓库 {item.warehouse || '未设置'} · 单位 {item.uom || '未设置'}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </View>
          </>
        ) : (
          <View style={[styles.loadingCard, { backgroundColor: surface, borderColor }]}>
            <ThemedText type="defaultSemiBold">没有读取到采购订单详情</ThemedText>
            <ThemedText>请确认订单号是否存在，或者稍后重试。</ThemedText>
          </View>
        )}
      </ScrollView>
    </AppShell>
  );
}

function DetailRow({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.detailRow}>
      <ThemedText style={styles.detailLabel}>{label}</ThemedText>
      <ThemedText style={multiline ? styles.detailValueMultiline : styles.detailValue} type="defaultSemiBold">
        {value}
      </ThemedText>
    </View>
  );
}

function MetaBlock({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaBlock}>
      <ThemedText style={styles.metaLabel}>{label}</ThemedText>
      <ThemedText style={styles.metaValue} numberOfLines={1} type="defaultSemiBold">
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
    paddingHorizontal: 18,
    paddingBottom: 40,
  },
  loadingCard: {
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    gap: 10,
    justifyContent: 'center',
    minHeight: 180,
    padding: 18,
  },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    gap: 16,
  },
  card: {
    borderRadius: 24,
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
    fontSize: 24,
    lineHeight: 30,
  },
  heroSubline: {
    color: '#64748B',
    fontSize: 14,
  },
  businessBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  businessBadgeText: {
    fontSize: 12,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 12,
  },
  heroMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metaBlock: {
    gap: 4,
    minWidth: '45%',
  },
  metaLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  metaValue: {
    color: '#0F172A',
    fontSize: 14,
  },
  heroMetrics: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    borderRadius: 18,
    flex: 1,
    gap: 6,
    padding: 14,
  },
  metricLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  metricValue: {
    fontSize: 16,
  },
  metricValueSmall: {
    fontSize: 15,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 17,
  },
  detailList: {
    gap: 10,
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
  itemList: {
    gap: 10,
  },
  itemCard: {
    borderRadius: 18,
    gap: 6,
    padding: 14,
  },
  itemHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemCode: {
    color: '#64748B',
    fontSize: 13,
  },
  itemMeta: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 18,
  },
});
