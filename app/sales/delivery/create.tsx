import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { ThemedText } from '@/components/themed-text';
import { useFeedback } from '@/providers/feedback-provider';
import { getDeliveryNoteDetailV2, type DeliveryNoteDetailV2 } from '@/services/sales';

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

export default function SalesDeliveryCreateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderName?: string; deliveryNote?: string; notice?: string }>();
  const { showSuccess, showError } = useFeedback();
  const [detail, setDetail] = useState<DeliveryNoteDetailV2 | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (params.notice === 'created' && typeof params.deliveryNote === 'string' && params.deliveryNote.trim()) {
      showSuccess(`已生成发货单：${params.deliveryNote.trim()}`);
    }
  }, [params.deliveryNote, params.notice, showSuccess]);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const deliveryNoteName =
        typeof params.deliveryNote === 'string' ? params.deliveryNote.trim() : '';
      if (!deliveryNoteName) {
        setDetail(null);
        return;
      }

      try {
        setIsLoading(true);
        const nextDetail = await getDeliveryNoteDetailV2(deliveryNoteName);
        if (isMounted) {
          setDetail(nextDetail);
        }
      } catch (error) {
        if (isMounted) {
          setDetail(null);
        }
        showError(error instanceof Error ? error.message : '发货单详情加载失败。');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void load();
    return () => {
      isMounted = false;
    };
  }, [params.deliveryNote, showError]);

  if (!params.deliveryNote) {
    return (
      <AppShell title="销售发货" description="当前已支持从订单页直接发货，发货成功后会带着生成的发货单号跳转到这里。">
        <View style={styles.emptyCard}>
          <ThemedText style={styles.label} type="defaultSemiBold">
            来源订单
          </ThemedText>
          <ThemedText style={styles.value}>{params.orderName || '未传入'}</ThemedText>
          <ThemedText style={styles.hint}>当前未检测到发货单号，请从订单详情页发起出货或查看已有发货单。</ThemedText>
        </View>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="发货单详情"
      description="查看发货单对应的客户、商品明细、来源订单与关联销售发票。">
      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#2563EB" />
          <ThemedText style={styles.loadingText}>正在加载发货单详情...</ThemedText>
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
                <ThemedText style={styles.statLabel}>发货金额</ThemedText>
                <ThemedText style={styles.statValue} type="defaultSemiBold">
                  {formatCurrency(detail.grandTotal, detail.currency)}
                </ThemedText>
              </View>
              <View style={styles.statCard}>
                <ThemedText style={styles.statLabel}>发货数量</ThemedText>
                <ThemedText style={styles.statValue} type="defaultSemiBold">
                  {detail.totalQty ?? '—'}
                </ThemedText>
              </View>
              <View style={styles.statCard}>
                <ThemedText style={styles.statLabel}>发货日期</ThemedText>
                <ThemedText style={styles.statValue} type="defaultSemiBold">
                  {detail.postingDate || '—'}
                </ThemedText>
              </View>
            </View>
          </View>

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
              <ThemedText style={styles.rowLabel}>发货时间</ThemedText>
              <ThemedText style={styles.rowValue}>
                {detail.postingDate ? `${detail.postingDate} ${detail.postingTime || ''}`.trim() : '—'}
              </ThemedText>
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
              <ThemedText style={styles.rowLabel}>销售发票</ThemedText>
              <ThemedText style={styles.rowValue}>{detail.salesInvoices.join('、') || '暂未开票'}</ThemedText>
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

              {detail.salesInvoices[0] ? (
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/sales/invoice/create',
                      params: { salesInvoice: detail.salesInvoices[0] },
                    })
                  }
                  style={styles.actionButton}>
                  <ThemedText style={styles.actionButtonText} type="defaultSemiBold">
                    查看发票
                  </ThemedText>
                </Pressable>
              ) : detail.salesOrders[0] ? (
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/sales/invoice/create',
                      params: { sourceName: detail.salesOrders[0] },
                    })
                  }
                  style={styles.actionButton}>
                  <ThemedText style={styles.actionButtonText} type="defaultSemiBold">
                    前往开票
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>
            {!detail.salesInvoices.length && detail.salesOrders[0] ? (
              <ThemedText style={styles.actionHint}>
                当前移动端仍以销售订单作为开票来源，这里会带你回到订单链路继续开票。
              </ThemedText>
            ) : null}
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
              发货商品
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
                发货备注
              </ThemedText>
              <ThemedText style={styles.noteText}>{detail.remarks}</ThemedText>
            </View>
          ) : null}
        </ScrollView>
      ) : (
        <View style={styles.emptyCard}>
          <ThemedText style={styles.hint}>未能加载发货单详情，请返回订单页后重试。</ThemedText>
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
  actionHint: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 20,
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
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D7DEE7',
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    padding: 18,
  },
  label: {
    fontSize: 14,
  },
  value: {
    color: '#0F172A',
    fontSize: 16,
  },
  hint: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 22,
  },
});
