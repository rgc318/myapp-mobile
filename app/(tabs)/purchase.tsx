import type { Href } from 'expo-router';
import { Link } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { normalizeAppError } from '@/lib/app-error';
import { getAppPreferences } from '@/lib/app-preferences';
import { useFeedback } from '@/providers/feedback-provider';
import { fetchPurchaseOrderStatusSummary, type PurchaseOrderSummaryItem } from '@/services/purchases';

function formatMoney(value: number | null) {
  if (typeof value !== 'number') {
    return '—';
  }

  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 2,
  }).format(value);
}

function summarizeCount(rows: PurchaseOrderSummaryItem[], predicate: (row: PurchaseOrderSummaryItem) => boolean) {
  return rows.filter(predicate).length;
}

function getWorkflowStatusLabel(row: PurchaseOrderSummaryItem) {
  if (row.documentStatus === 'cancelled') {
    return '已作废';
  }
  if (row.completionStatus === 'completed') {
    return '已完成';
  }
  if (row.paymentStatus === 'paid') {
    return '已结清';
  }
  if (row.receivingStatus === 'partial') {
    return '部分收货';
  }
  if (row.receivingStatus === 'completed') {
    return '待到票';
  }
  return '待收货';
}

function getStatusTone(row: PurchaseOrderSummaryItem) {
  if (row.documentStatus === 'cancelled') {
    return { backgroundColor: '#FEE2E2', color: '#B91C1C' };
  }
  if (row.completionStatus === 'completed' || row.paymentStatus === 'paid') {
    return { backgroundColor: '#DCFCE7', color: '#15803D' };
  }
  if (row.receivingStatus === 'partial') {
    return { backgroundColor: '#FEF3C7', color: '#B45309' };
  }
  return { backgroundColor: '#DBEAFE', color: '#1D4ED8' };
}

export default function PurchaseTabScreen() {
  const preferences = getAppPreferences();
  const { showError } = useFeedback();
  const [searchKey, setSearchKey] = useState('');
  const [summaries, setSummaries] = useState<PurchaseOrderSummaryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const surface = useThemeColor({}, 'surface');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');
  const successColor = useThemeColor({}, 'success');
  const warningColor = useThemeColor({}, 'warning');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetchPurchaseOrderStatusSummary({ company: preferences.defaultCompany, limit: 40 })
      .then((rows) => {
        if (!cancelled) {
          setSummaries(rows);
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
  }, [preferences.defaultCompany, showError]);

  const filteredSummaries = useMemo(() => {
    const normalized = searchKey.trim().toLowerCase();
    if (!normalized) {
      return summaries;
    }

    return summaries.filter((row) =>
      [row.name, row.supplierName, row.supplier, row.company]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [searchKey, summaries]);

  const openCount = summarizeCount(filteredSummaries, (row) => row.completionStatus !== 'completed');
  const receivingCount = summarizeCount(
    filteredSummaries,
    (row) => row.receivingStatus !== 'completed' && row.documentStatus === 'submitted',
  );
  const paymentCount = summarizeCount(
    filteredSummaries,
    (row) => row.paymentStatus !== 'paid' && row.documentStatus === 'submitted',
  );

  return (
    <AppShell
      title="采购"
      description="这里作为采购工作台使用，优先处理待收货、待到票和待付款的订单。"
      compactHeader
      contentCard={false}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={[styles.heroCard, { backgroundColor: surface, borderColor }]}>
          <View style={styles.heroHeader}>
            <View style={styles.heroCopy}>
              <ThemedText style={styles.heroEyebrow}>PURCHASE WORKBENCH</ThemedText>
              <ThemedText style={styles.heroTitle} type="title">
                采购工作台
              </ThemedText>
              <ThemedText style={styles.heroSubtitle}>
                统一查看待收货、待到票和待付款采购单，优先处理还没有完成闭环的订单。
              </ThemedText>
            </View>
            <View style={[styles.heroBadge, { backgroundColor: surfaceMuted }]}>
              <ThemedText style={[styles.heroBadgeText, { color: tintColor }]} type="defaultSemiBold">
                {filteredSummaries.length} 单
              </ThemedText>
            </View>
          </View>

          <View style={styles.heroMetaGrid}>
            <View style={[styles.heroMetaCard, { backgroundColor: surfaceMuted }]}>
              <ThemedText style={styles.heroMetaLabel}>当前公司</ThemedText>
              <ThemedText style={styles.heroMetaValue} numberOfLines={1} type="defaultSemiBold">
                {preferences.defaultCompany}
              </ThemedText>
            </View>
            <View style={[styles.heroMetaCard, { backgroundColor: surfaceMuted }]}>
              <ThemedText style={styles.heroMetaLabel}>当前检索</ThemedText>
              <ThemedText style={styles.heroMetaValue} type="defaultSemiBold">
                {searchKey.trim() ? '按关键词筛选中' : '最近采购订单'}
              </ThemedText>
            </View>
          </View>

          <View style={styles.heroStatGrid}>
            <View style={[styles.metricCard, { backgroundColor: surfaceMuted }]}>
              <ThemedText style={styles.metricLabel}>待处理订单</ThemedText>
              <ThemedText style={[styles.metricValue, { color: warningColor }]} type="defaultSemiBold">
                {openCount}
              </ThemedText>
            </View>
            <View style={[styles.metricCard, { backgroundColor: surfaceMuted }]}>
              <ThemedText style={styles.metricLabel}>待收货</ThemedText>
              <ThemedText style={[styles.metricValue, { color: tintColor }]} type="defaultSemiBold">
                {receivingCount}
              </ThemedText>
            </View>
            <View style={[styles.metricCard, { backgroundColor: surfaceMuted }]}>
              <ThemedText style={styles.metricLabel}>待付款</ThemedText>
              <ThemedText style={[styles.metricValue, { color: successColor }]} type="defaultSemiBold">
                {paymentCount}
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={[styles.quickActionsCard, { backgroundColor: surface, borderColor }]}>
          {[
            { href: '/purchase/order/create' as Href, label: '采购下单', description: '创建采购订单' },
            { href: '/purchase/receipt/create' as Href, label: '采购收货', description: '登记到货入库' },
            { href: '/purchase/invoice/create' as Href, label: '登记发票', description: '登记供应商发票' },
            { href: '/purchase/payment/create' as Href, label: '供应商付款', description: '登记实际付款' },
          ].map((action, index, rows) => (
            <View key={action.label}>
              <Link href={action.href} style={styles.quickActionButton}>
                <View style={[styles.quickActionIcon, { backgroundColor: surfaceMuted }]}>
                  <ThemedText style={[styles.quickActionIconText, { color: tintColor }]} type="defaultSemiBold">
                    {index + 1}
                  </ThemedText>
                </View>
                <View style={styles.quickActionCopy}>
                  <ThemedText style={styles.quickActionLabel} type="defaultSemiBold">
                    {action.label}
                  </ThemedText>
                  <ThemedText style={styles.quickActionHint}>{action.description}</ThemedText>
                </View>
              </Link>
              {index < rows.length - 1 ? (
                <View style={[styles.quickActionDivider, { backgroundColor: borderColor }]} />
              ) : null}
            </View>
          ))}
        </View>

        <View style={[styles.panel, { backgroundColor: surface, borderColor }]}>
          <View style={styles.panelHeader}>
            <ThemedText style={styles.panelTitle} type="defaultSemiBold">
              采购总览
            </ThemedText>
          </View>
          <ThemedText style={styles.panelCopy}>
            默认按公司 {preferences.defaultCompany} 查看最近采购订单，可按供应商名称或订单号快速搜索。
          </ThemedText>

          <TextInput
            autoCorrect={false}
            onChangeText={setSearchKey}
            placeholder="搜索采购订单号、供应商、公司"
            style={[styles.searchInput, { backgroundColor: surfaceMuted, borderColor }]}
            value={searchKey}
          />
        </View>

        <View style={[styles.panel, { backgroundColor: surface, borderColor }]}>
          <View style={styles.panelHeader}>
            <ThemedText style={styles.panelTitle} type="defaultSemiBold">
              采购订单列表
            </ThemedText>
          </View>

          {isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={tintColor} />
              <ThemedText>正在读取采购订单摘要...</ThemedText>
            </View>
          ) : filteredSummaries.length ? (
            <View style={styles.list}>
              {filteredSummaries.map((row) => (
                <Link
                  key={row.name}
                  href={{
                    pathname: '/purchase/order/[orderName]',
                    params: { orderName: row.name },
                  }}
                  style={[styles.orderCard, { backgroundColor: surfaceMuted, borderColor }]}>
                  <View style={styles.orderHeader}>
                    <View style={styles.orderHeaderCopy}>
                      <ThemedText style={styles.orderName} type="defaultSemiBold">
                        {row.supplierName || row.supplier}
                      </ThemedText>
                      <ThemedText style={styles.orderCode}>订单 {row.name}</ThemedText>
                    </View>
                    <View
                      style={[
                        styles.workflowBadge,
                        { backgroundColor: getStatusTone(row).backgroundColor },
                      ]}>
                      <ThemedText
                        style={[styles.workflowBadgeText, { color: getStatusTone(row).color }]}
                        type="defaultSemiBold">
                        {getWorkflowStatusLabel(row)}
                      </ThemedText>
                    </View>
                  </View>

                  <View style={styles.orderMetaGrid}>
                    <MetaBlock label="公司" value={row.company || '未设置'} />
                    <MetaBlock label="下单日期" value={row.transactionDate || '未设置'} />
                    <MetaBlock label="收货状态" value={row.receivingStatus || 'unknown'} />
                    <MetaBlock label="付款状态" value={row.paymentStatus || 'unknown'} />
                  </View>

                  <View style={styles.orderAmountGrid}>
                    <View style={[styles.orderAmountCard, { backgroundColor: surface }]}>
                      <ThemedText style={styles.orderAmountLabel}>订单金额</ThemedText>
                      <ThemedText style={styles.orderAmountValue} type="defaultSemiBold">
                        {formatMoney(row.orderAmountEstimate)}
                      </ThemedText>
                    </View>
                    <View style={[styles.orderAmountCard, { backgroundColor: surface }]}>
                      <ThemedText style={styles.orderAmountLabel}>未付金额</ThemedText>
                      <ThemedText style={styles.orderAmountValue} type="defaultSemiBold">
                        {formatMoney(row.outstandingAmount)}
                      </ThemedText>
                    </View>
                  </View>
                </Link>
              ))}
            </View>
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: surfaceMuted }]}>
              <ThemedText type="defaultSemiBold">当前没有匹配的采购订单</ThemedText>
              <ThemedText>你可以先创建采购订单，或者换个关键词再试。</ThemedText>
            </View>
          )}
        </View>

        <View style={styles.moreActions}>
          <Pressable style={[styles.inlineAction, { borderColor }]}>
            <Link href={'/purchase/return/create' as Href} style={styles.inlineActionLink}>
              <ThemedText type="defaultSemiBold">进入采购退货</ThemedText>
            </Link>
          </Pressable>
        </View>
      </ScrollView>
    </AppShell>
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
  heroCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    gap: 16,
  },
  heroHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  heroCopy: {
    flex: 1,
    gap: 6,
  },
  heroEyebrow: {
    color: '#2563EB',
    fontSize: 12,
    letterSpacing: 1.2,
  },
  heroTitle: {
    fontSize: 30,
    lineHeight: 36,
  },
  heroSubtitle: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 21,
  },
  heroBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroBadgeText: {
    fontSize: 13,
  },
  heroMetaGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  heroMetaCard: {
    borderRadius: 18,
    flex: 1,
    gap: 6,
    padding: 14,
  },
  heroMetaLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  heroMetaValue: {
    fontSize: 15,
  },
  heroStatGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  quickActionsCard: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  quickActionButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
    textDecorationLine: 'none',
  },
  quickActionIcon: {
    alignItems: 'center',
    borderRadius: 14,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  quickActionIconText: {
    fontSize: 13,
  },
  quickActionCopy: {
    flex: 1,
    gap: 4,
  },
  quickActionLabel: {
    fontSize: 15,
  },
  quickActionHint: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 18,
  },
  quickActionDivider: {
    height: 1,
    marginHorizontal: 18,
  },
  panel: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  panelHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  panelTitle: {
    fontSize: 18,
  },
  panelCopy: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 20,
  },
  searchInput: {
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 52,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  metricGrid: {
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
    fontSize: 24,
    lineHeight: 28,
  },
  loadingWrap: {
    alignItems: 'center',
    gap: 10,
    minHeight: 140,
    justifyContent: 'center',
  },
  list: {
    gap: 10,
  },
  orderCard: {
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    padding: 14,
    textDecorationLine: 'none',
  },
  orderHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  orderHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  orderName: {
    fontSize: 18,
    lineHeight: 24,
  },
  orderCode: {
    color: '#64748B',
    fontSize: 13,
  },
  workflowBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  workflowBadgeText: {
    fontSize: 12,
  },
  orderMetaGrid: {
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
  orderAmountGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  orderAmountCard: {
    borderRadius: 16,
    flex: 1,
    gap: 6,
    padding: 14,
  },
  orderAmountLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  orderAmountValue: {
    fontSize: 15,
  },
  emptyCard: {
    borderRadius: 18,
    gap: 8,
    minHeight: 120,
    justifyContent: 'center',
    padding: 16,
  },
  moreActions: {
    paddingBottom: 8,
  },
  inlineAction: {
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  inlineActionLink: {
    textDecorationLine: 'none',
  },
});
