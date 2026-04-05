import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { ThemedText } from '@/components/themed-text';
import { normalizeAppError } from '@/lib/app-error';
import { formatDisplayUom } from '@/lib/display-uom';
import { buildQuantityComposition } from '@/lib/uom-display';
import { useFeedback } from '@/providers/feedback-provider';
import {
  cancelDeliveryNoteV2,
  getDeliveryNoteDetailV2,
  getSalesOrderDetailV2,
  submitSalesOrderDeliveryV2,
  type DeliveryNoteDetailV2,
  type SalesOrderDetailV2,
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

function buildDeliveryErrorMessage(message: string) {
  if (!message.trim()) {
    return '当前订单出货失败，请稍后重试。';
  }

  if (message.includes('可用库存不足')) {
    return `${message} 请先补录库存、释放其他订单预留，或改用其他可发货仓库后再重试。`;
  }

  if (message.includes('没有可发货的商品明细')) {
    return '当前订单已经没有可继续发货的商品明细。请先刷新订单状态；如果系统已经生成发货单，请直接查看已有发货单。';
  }

  return message;
}

function groupItemsByProduct<T extends {
  itemCode: string;
  itemName: string;
  nickname?: string | null;
  specification?: string | null;
  imageUrl?: string | null;
  qty: number | null;
  amount: number | null;
  warehouse: string;
  uom: string;
  rate: number | null;
}>(items: T[]) {
  const grouped = new Map<
    string,
    {
      itemCode: string;
      itemName: string;
      nickname?: string | null;
      specification?: string | null;
      imageUrl?: string | null;
      totalAmount: number;
      rows: T[];
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
      nickname: item.nickname ?? null,
      specification: item.specification ?? null,
      imageUrl: item.imageUrl ?? null,
      totalAmount: item.amount ?? 0,
      rows: [item],
    });
  });

  return Array.from(grouped.values());
}

function GroupedDeliveryItems({
  items,
  currency,
}: {
  items: {
    itemCode: string;
    itemName: string;
    qty: number | null;
    rate: number | null;
    amount: number | null;
    warehouse: string;
    uom: string;
    imageUrl?: string | null;
  }[];
  currency: string;
}) {
  const groupedItems = groupItemsByProduct(items);

  return (
    <>
      {groupedItems.map((group, index) => (
        <View
          key={group.itemCode}
          style={[styles.deliveryGroupCard, index > 0 ? styles.deliveryGroupDivider : null]}>
          <View style={styles.deliveryGroupHeader}>
            <View style={styles.deliveryGroupMain}>
              <View style={styles.deliveryGroupHeaderTop}>
                <View style={styles.deliveryGroupTitleBlock}>
                  <View style={styles.deliveryGroupTag}>
                    <ThemedText style={styles.deliveryGroupTagText} type="defaultSemiBold">
                      商品名称
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.deliveryGroupTitle} type="defaultSemiBold">
                    {group.itemName}
                  </ThemedText>
                  {group.nickname && group.itemName && group.nickname !== group.itemName ? (
                    <ThemedText style={styles.deliveryGroupAlias}>{`内部简称 ${group.nickname}`}</ThemedText>
                  ) : null}
                  {group.specification ? (
                    <ThemedText style={styles.deliveryGroupSpec} type="defaultSemiBold">
                      规格 {group.specification}
                    </ThemedText>
                  ) : null}
                </View>
                <View style={styles.deliveryGroupAmountBlock}>
                  <ThemedText style={styles.deliveryGroupAmountLabel} type="defaultSemiBold">
                    商品总价
                  </ThemedText>
                  <ThemedText style={styles.deliveryGroupAmount} type="defaultSemiBold">
                    {formatCurrency(group.totalAmount, currency)}
                  </ThemedText>
                </View>
              </View>
              <ThemedText style={styles.deliveryGroupMeta}>{`编码 ${group.itemCode}`}</ThemedText>
              <ThemedText style={styles.deliveryGroupSummary} type="defaultSemiBold">
                {`共 ${group.rows.length} 个仓库条目，合计 ${buildQuantityComposition(group.rows)}`}
              </ThemedText>
            </View>
          </View>

          <View style={styles.deliveryGroupRows}>
            {group.rows.map((item, index) => (
              <View
                key={`${group.itemCode}-${item.warehouse}-${index}`}
                style={[styles.deliveryWarehouseRow, index > 0 ? styles.deliveryWarehouseDivider : null]}>
                <View style={styles.deliveryWarehouseMain}>
                  <ThemedText style={styles.deliveryWarehouseTitle} type="defaultSemiBold">
                    {`仓库 ${item.warehouse || '未配置仓库'}`}
                  </ThemedText>
                  <View style={styles.deliveryWarehouseSummaryRow}>
                    <ThemedText style={styles.deliveryWarehouseFormula}>
                      {formatCurrency(item.rate, currency)} x {item.qty ?? '—'}{' '}
                      {item.uom ? formatDisplayUom(item.uom) : ''}
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.deliveryWarehouseAmountBlock}>
                  <ThemedText style={styles.deliveryWarehouseAmountLabel} type="defaultSemiBold">
                    仓库小计
                  </ThemedText>
                  <ThemedText style={styles.deliveryWarehouseAmount} type="defaultSemiBold">
                    {formatCurrency(item.amount, currency)}
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>
        </View>
      ))}
    </>
  );
}

export default function SalesDeliveryCreateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderName?: string; deliveryNote?: string; notice?: string }>();
  const orderName = typeof params.orderName === 'string' ? params.orderName.trim() : '';
  const deliveryNote = typeof params.deliveryNote === 'string' ? params.deliveryNote.trim() : '';
  const { showSuccess, showError, showInfo } = useFeedback();
  const [detail, setDetail] = useState<DeliveryNoteDetailV2 | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [orderDetail, setOrderDetail] = useState<SalesOrderDetailV2 | null>(null);
  const [isLoadingOrder, setIsLoadingOrder] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [canForceDelivery, setCanForceDelivery] = useState(false);
  const [submitHint, setSubmitHint] = useState('');
  const [showRiskDialog, setShowRiskDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelResultOpen, setCancelResultOpen] = useState(false);

  useEffect(() => {
    if (params.notice === 'created' && deliveryNote) {
      showSuccess(`已生成发货单：${deliveryNote}`);
    }
  }, [deliveryNote, params.notice, showSuccess]);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (!deliveryNote) {
        setDetail(null);
        return;
      }

      try {
        setIsLoading(true);
        const nextDetail = await getDeliveryNoteDetailV2(deliveryNote);
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
  }, [deliveryNote, showError]);

  useEffect(() => {
    let isMounted = true;

    async function loadOrderDetail() {
      if (deliveryNote || !orderName) {
        setOrderDetail(null);
        setSubmitHint('');
        setCanForceDelivery(false);
        return;
      }

      try {
        setIsLoadingOrder(true);
        const nextOrderDetail = await getSalesOrderDetailV2(orderName);
        if (isMounted) {
          setOrderDetail(nextOrderDetail);
          setSubmitHint('');
          setCanForceDelivery(false);
        }
      } catch (error) {
        if (isMounted) {
          setOrderDetail(null);
        }
        showError(error instanceof Error ? error.message : '订单详情加载失败。');
      } finally {
        if (isMounted) {
          setIsLoadingOrder(false);
        }
      }
    }

    void loadOrderDetail();
    return () => {
      isMounted = false;
    };
  }, [deliveryNote, orderName, showError]);

  async function handleSubmit(forceDelivery = false) {
    if (!orderName) {
      showError('缺少销售订单号。');
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await submitSalesOrderDeliveryV2(orderName, { forceDelivery });
      setCanForceDelivery(false);
      setSubmitHint('');
      showSuccess(
        result.deliveryNote
          ? `${result.forceDelivery ? '已强制出货' : '发货成功'}，已创建发货单 ${result.deliveryNote}。`
          : result.forceDelivery
            ? '已强制出货。'
            : '发货成功。',
      );

      if (result.deliveryNote) {
        router.replace({
          pathname: '/sales/delivery/create',
          params: {
            orderName,
            deliveryNote: result.deliveryNote,
            notice: 'created',
          },
        });
        return;
      }

      const refreshedOrder = await getSalesOrderDetailV2(orderName);
      setOrderDetail(refreshedOrder);
    } catch (error) {
      const appError = normalizeAppError(error, '发货失败。');
      const deliveryMessage = buildDeliveryErrorMessage(appError.message);
      let refreshedOrder: SalesOrderDetailV2 | null = null;

      try {
        refreshedOrder = await getSalesOrderDetailV2(orderName);
        setOrderDetail(refreshedOrder);
      } catch {}

      if (refreshedOrder?.latestDeliveryNote) {
        showInfo(`订单已存在发货单 ${refreshedOrder.latestDeliveryNote}。`);
        router.replace({
          pathname: '/sales/delivery/create',
          params: {
            orderName,
            deliveryNote: refreshedOrder.latestDeliveryNote,
          },
        });
        return;
      }

      if (!forceDelivery && appError.message.includes('可用库存不足')) {
        setCanForceDelivery(true);
        setSubmitHint(`${deliveryMessage} 如仓库实物已确认出货，可使用强制出货。`);
        setShowRiskDialog(true);
        return;
      }

      setCanForceDelivery(false);
      setSubmitHint(deliveryMessage);
      setShowRiskDialog(false);
      showError(deliveryMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCancelDeliveryNote() {
    if (!detail?.name) {
      showError('缺少发货单号。');
      return;
    }

    try {
      setIsCancelling(true);
      const nextDetail = await cancelDeliveryNoteV2(detail.name);
      if (nextDetail) {
        setDetail(nextDetail);
      }
      setShowCancelDialog(false);
      setCancelResultOpen(true);
      showSuccess(`发货单 ${detail.name} 已作废，库存与订单履约状态已自动回退。`);
    } catch (error) {
      showError(error instanceof Error ? error.message : '发货单作废失败。');
    } finally {
      setIsCancelling(false);
    }
  }

  function openPrintPreview() {
    if (!detail?.name) {
      showInfo('当前发货单详情尚未加载完成。');
      return;
    }

    router.push({
      pathname: '/sales/delivery/preview',
      params: { deliveryNote: detail.name },
    });
  }

  const isCancelledDetail = detail?.documentStatus === 'cancelled';

  if (!deliveryNote) {
    return (
      <>
        <AppShell
          title="销售发货"
          description="先确认订单状态与发货信息，再由本页执行正式出货。"
          footer={
            orderDetail ? (
              <View style={styles.footerWrap}>
                {submitHint ? (
                  <View style={[styles.noticeCard, styles.footerNoticeCard]}>
                    <ThemedText style={styles.noticeText}>{submitHint}</ThemedText>
                  </View>
                ) : null}

                <View style={styles.footerActionRow}>
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: '/sales/order/[orderName]',
                        params: { orderName },
                      })
                    }
                    style={[styles.footerActionButton, styles.actionButton, styles.secondaryActionButton]}>
                    <ThemedText style={styles.secondaryActionText} type="defaultSemiBold">
                      返回订单
                    </ThemedText>
                  </Pressable>

                  <Pressable
                    disabled={isSubmitting || (!orderDetail.canSubmitDelivery && !canForceDelivery)}
                    onPress={() => void handleSubmit(canForceDelivery)}
                    style={[
                      styles.footerActionButton,
                      styles.actionButton,
                      canForceDelivery ? styles.dangerActionButton : null,
                      (isSubmitting || (!orderDetail.canSubmitDelivery && !canForceDelivery)) &&
                        styles.disabledActionButton,
                    ]}>
                    <ThemedText style={styles.actionButtonText} type="defaultSemiBold">
                      {isSubmitting
                        ? '提交中...'
                        : canForceDelivery
                          ? '强制出货'
                          : '确认出货'}
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            ) : null
          }>
          {isLoadingOrder ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color="#2563EB" />
              <ThemedText style={styles.loadingText}>正在加载订单信息...</ThemedText>
            </View>
          ) : orderDetail ? (
            <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
              <View style={styles.heroCard}>
                <View style={styles.heroHeader}>
                  <View style={styles.heroMain}>
                    <ThemedText style={styles.heroTitle} type="title">
                      {orderDetail.customer || orderDetail.name}
                    </ThemedText>
                    <ThemedText style={styles.heroSubtitle}>{orderDetail.name}</ThemedText>
                  </View>
                  <View style={styles.badge}>
                    <ThemedText style={styles.badgeText} type="defaultSemiBold">
                      待发货确认
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.heroStats}>
                  <View style={[styles.statCard, styles.primaryStatCard]}>
                    <ThemedText style={[styles.statLabel, styles.primaryStatLabel]}>订单总价</ThemedText>
                    <ThemedText style={[styles.statValue, styles.primaryStatValue]} type="defaultSemiBold">
                      {formatCurrency(orderDetail.grandTotal, orderDetail.currency)}
                    </ThemedText>
                  </View>
                  <View style={styles.statCard}>
                    <ThemedText style={styles.statLabel}>履约状态</ThemedText>
                    <ThemedText style={styles.statValue} type="defaultSemiBold">
                      {orderDetail.fulfillmentStatus || '未确认'}
                    </ThemedText>
                  </View>
                  <View style={styles.statCard}>
                    <ThemedText style={styles.statLabel}>交货日期</ThemedText>
                    <ThemedText style={styles.statValue} type="defaultSemiBold">
                      {orderDetail.deliveryDate || '未设置'}
                    </ThemedText>
                  </View>
                </View>
              </View>

              <View style={styles.sectionCard}>
                <ThemedText style={styles.sectionTitle} type="subtitle">
                  发货前确认
                </ThemedText>
                <View style={styles.row}>
                  <ThemedText style={styles.rowLabel}>来源订单</ThemedText>
                  <ThemedText style={styles.rowValue}>{orderDetail.name}</ThemedText>
                </View>
                <View style={styles.row}>
                  <ThemedText style={styles.rowLabel}>客户</ThemedText>
                  <ThemedText style={styles.rowValue}>{orderDetail.customer || '未配置'}</ThemedText>
                </View>
                <View style={styles.row}>
                  <ThemedText style={styles.rowLabel}>公司</ThemedText>
                  <ThemedText style={styles.rowValue}>{orderDetail.company || '未配置'}</ThemedText>
                </View>
                <View style={styles.row}>
                  <ThemedText style={styles.rowLabel}>收货联系人</ThemedText>
                  <ThemedText style={styles.rowValue}>{orderDetail.contactDisplay || '未配置'}</ThemedText>
                </View>
                <View style={styles.rowBlock}>
                  <ThemedText style={styles.rowLabel}>收货地址</ThemedText>
                  <ThemedText style={styles.rowValue}>{orderDetail.addressDisplay || '未配置收货地址'}</ThemedText>
                </View>
              </View>

              <View style={styles.sectionCard}>
                <ThemedText style={styles.sectionTitle} type="subtitle">
                  待发货商品
                </ThemedText>
                <GroupedDeliveryItems currency={orderDetail.currency} items={orderDetail.items} />
              </View>

              {!orderDetail.canSubmitDelivery ? (
                <ThemedText style={styles.actionHint}>
                  当前订单暂无可继续发货的明细；如果系统已生成发货单，请返回订单后查看已有单据。
                </ThemedText>
              ) : null}
            </ScrollView>
          ) : (
            <View style={styles.emptyCard}>
              <ThemedText style={styles.label} type="defaultSemiBold">
                来源订单
              </ThemedText>
              <ThemedText style={styles.value}>{orderName || '未传入'}</ThemedText>
              <ThemedText style={styles.hint}>当前未能加载订单信息，请返回订单页后重试。</ThemedText>
            </View>
          )}
        </AppShell>

        <RiskDialog
          visible={showRiskDialog}
          message={submitHint}
          onClose={() => setShowRiskDialog(false)}
          onCheckOrder={() => {
            setShowRiskDialog(false);
            router.push({
              pathname: '/sales/order/[orderName]',
              params: { orderName },
            });
          }}
        />
      </>
    );
  }

  return (
    <AppShell
      title="发货单详情"
      description="查看发货单对应的客户、商品明细、来源订单与关联销售发票。"
      footer={
        detail ? (
          <View style={styles.footerWrap}>
            {(!detail.salesInvoices.length && detail.salesOrders[0] && !isCancelledDetail) || isCancelledDetail ? (
              <ThemedText style={styles.footerHint}>
                {isCancelledDetail
                  ? '当前发货单已经作废，建议返回订单查看最新履约状态；如需继续开票，应基于仍然有效的订单或发票链路重新处理。'
                  : '当前移动端仍以销售订单作为开票来源，可返回订单继续处理，或直接前往开票。'}
              </ThemedText>
            ) : null}
            <View style={styles.footerActionRow}>
              <Pressable
                onPress={openPrintPreview}
                style={[styles.footerActionButton, styles.actionButton, styles.secondaryActionButton]}>
                <ThemedText style={styles.secondaryActionText} type="defaultSemiBold">
                  打印预览
                </ThemedText>
              </Pressable>
              {detail.salesOrders[0] ? (
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/sales/order/[orderName]',
                      params: { orderName: detail.salesOrders[0] },
                    })
                  }
                  style={[styles.footerActionButton, styles.actionButton, styles.secondaryActionButton]}>
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
                  style={[styles.footerActionButton, styles.actionButton]}>
                  <ThemedText style={styles.actionButtonText} type="defaultSemiBold">
                    查看发票
                  </ThemedText>
                </Pressable>
              ) : detail.salesOrders[0] && !isCancelledDetail ? (
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/sales/invoice/create',
                      params: { sourceName: detail.salesOrders[0] },
                    })
                  }
                  style={[styles.footerActionButton, styles.actionButton]}>
                  <ThemedText style={styles.actionButtonText} type="defaultSemiBold">
                    前往开票
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null
      }>
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
              <View style={[styles.badge, isCancelledDetail ? styles.cancelledBadge : null]}>
                <ThemedText
                  style={[styles.badgeText, isCancelledDetail ? styles.cancelledBadgeText : null]}
                  type="defaultSemiBold">
                  {formatStatusLabel(detail.documentStatus)}
                </ThemedText>
              </View>
            </View>

            <View style={styles.heroStats}>
              <View style={[styles.statCard, styles.primaryStatCard]}>
                <ThemedText style={[styles.statLabel, styles.primaryStatLabel]}>发货单总价</ThemedText>
                <ThemedText style={[styles.statValue, styles.primaryStatValue]} type="defaultSemiBold">
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
              {isCancelledDetail ? '历史单据说明' : '后续处理说明'}
            </ThemedText>
            {!detail.salesInvoices.length && detail.salesOrders[0] && !isCancelledDetail ? (
              <ThemedText style={styles.actionHint}>
                当前移动端仍以销售订单作为开票来源，这里会带你回到订单链路继续开票。
              </ThemedText>
            ) : null}
            {isCancelledDetail ? (
              <ThemedText style={styles.actionHint}>
                当前发货单已经作废，建议返回订单查看最新履约状态；如需继续开票，应基于仍然有效的订单或发票链路重新处理，不应从这张历史发货单继续发起。
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
            <GroupedDeliveryItems currency={detail.currency} items={detail.items} />
          </View>

          {detail.remarks ? (
            <View style={styles.sectionCard}>
              <ThemedText style={styles.sectionTitle} type="subtitle">
                发货备注
              </ThemedText>
              <ThemedText style={styles.noteText}>{detail.remarks}</ThemedText>
            </View>
          ) : null}

          {!isCancelledDetail && (detail.canCancelDeliveryNote || detail.cancelDeliveryNoteHint) ? (
            <View style={styles.rollbackCard}>
              <ThemedText style={styles.rollbackTitle} type="subtitle">
                回退处理
              </ThemedText>
              <ThemedText style={styles.rollbackText}>
                {detail.cancelDeliveryNoteHint ||
                  '如需回退这张发货单，系统会自动恢复库存并把订单履约状态退回到待发货。请确认当前没有仍在生效的下游发票。'}
              </ThemedText>
              {detail.canCancelDeliveryNote ? (
                <Pressable
                  onPress={() => setShowCancelDialog(true)}
                  style={[styles.actionButton, styles.dangerGhostActionButton]}>
                  <ThemedText style={styles.dangerGhostActionText} type="defaultSemiBold">
                    作废发货单
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      ) : (
        <View style={styles.emptyCard}>
          <ThemedText style={styles.hint}>未能加载发货单详情，请返回订单页后重试。</ThemedText>
        </View>
      )}

      <ConfirmDialog
        confirmLabel={isCancelling ? '作废中...' : '确认作废'}
        description="作废后会自动回退库存与订单发货状态。如果这张发货单已经开票，请先返回发票页作废销售发票。"
        onClose={() => {
          if (!isCancelling) {
            setShowCancelDialog(false);
          }
        }}
        onConfirm={() => void handleCancelDeliveryNote()}
        title="作废发货单？"
        visible={showCancelDialog}
      />

      <ResultDialog
        onClose={() => setCancelResultOpen(false)}
        onConfirm={() => {
          setCancelResultOpen(false);
          if (detail?.salesOrders[0]) {
            router.replace({
              pathname: '/sales/order/[orderName]',
              params: { orderName: detail.salesOrders[0] },
            });
          }
        }}
        confirmLabel="返回订单"
        description="这张发货单已经作废，库存和订单履约状态已回退。建议回到订单查看最新状态并决定是否重新发货。"
        title="发货单已作废"
        visible={cancelResultOpen}
      />
    </AppShell>
  );
}

function RiskDialog({
  visible,
  message,
  onClose,
  onCheckOrder,
}: {
  visible: boolean;
  message: string;
  onClose: () => void;
  onCheckOrder: () => void;
}) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.dialogBackdrop}>
        <View style={styles.dialogCard}>
          <ThemedText style={styles.dialogTitle} type="defaultSemiBold">
            库存不足，是否改为强制出货？
          </ThemedText>
          <ThemedText style={styles.dialogMessage}>{message}</ThemedText>
          <View style={styles.dialogActions}>
            <Pressable onPress={onCheckOrder} style={[styles.dialogButton, styles.dialogGhostButton]}>
              <ThemedText style={styles.dialogGhostText} type="defaultSemiBold">
                返回订单核对
              </ThemedText>
            </Pressable>
            <Pressable onPress={onClose} style={[styles.dialogButton, styles.dialogPrimaryButton]}>
              <ThemedText style={styles.dialogPrimaryText} type="defaultSemiBold">
                留在本页
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
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
        <View style={[styles.dialogCard, styles.confirmDialogCard]}>
          <ThemedText style={styles.confirmDialogTitle} type="defaultSemiBold">
            {title}
          </ThemedText>
          <ThemedText style={styles.confirmDialogMessage}>{description}</ThemedText>
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
        <View style={[styles.dialogCard, styles.confirmDialogCard]}>
          <ThemedText style={styles.confirmDialogTitle} type="defaultSemiBold">
            {title}
          </ThemedText>
          <ThemedText style={styles.confirmDialogMessage}>{description}</ThemedText>
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
  cancelledBadge: {
    backgroundColor: '#FEE2E2',
  },
  cancelledBadgeText: {
    color: '#DC2626',
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
  primaryStatCard: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FDBA74',
    borderWidth: 1,
  },
  primaryStatLabel: {
    color: '#9A3412',
  },
  primaryStatValue: {
    color: '#B45309',
    fontSize: 22,
    lineHeight: 28,
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
  footerWrap: {
    gap: 10,
  },
  footerActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  footerActionButton: {
    flex: 1,
  },
  disabledActionButton: {
    backgroundColor: '#93C5FD',
  },
  dangerActionButton: {
    backgroundColor: '#DC2626',
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
  rollbackCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    padding: 18,
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
  rollbackHint: {
    color: '#B45309',
    fontSize: 13,
    lineHeight: 20,
  },
  dangerGhostActionButton: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
  },
  dangerGhostActionText: {
    color: '#DC2626',
    fontSize: 15,
  },
  noticeCard: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  footerNoticeCard: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  noticeText: {
    color: '#9A3412',
    fontSize: 14,
    lineHeight: 22,
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
    borderColor: '#FED7AA',
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    maxWidth: 420,
    padding: 20,
    width: '100%',
  },
  dialogTitle: {
    color: '#9A3412',
    fontSize: 18,
  },
  dialogMessage: {
    color: '#7C2D12',
    fontSize: 14,
    lineHeight: 22,
  },
  dialogActions: {
    flexDirection: 'row',
    gap: 10,
  },
  dialogButton: {
    alignItems: 'center',
    borderRadius: 16,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
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
  confirmDialogCard: {
    borderColor: '#FECACA',
  },
  confirmDialogTitle: {
    color: '#991B1B',
    fontSize: 18,
  },
  confirmDialogMessage: {
    color: '#7F1D1D',
    fontSize: 14,
    lineHeight: 22,
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
  deliveryGroupCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    overflow: 'hidden',
    padding: 14,
  },
  deliveryGroupDivider: {
    marginTop: 18,
  },
  deliveryGroupHeader: {
    backgroundColor: '#F8FAFC',
    borderColor: '#DBEAFE',
    borderLeftWidth: 4,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  deliveryGroupMain: {
    gap: 6,
  },
  deliveryGroupHeaderTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  deliveryGroupTitleBlock: {
    flex: 1,
    gap: 8,
    minWidth: 0,
  },
  deliveryGroupAmountBlock: {
    alignItems: 'flex-end',
    gap: 4,
  },
  deliveryGroupTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#DBEAFE',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  deliveryGroupTagText: {
    color: '#1D4ED8',
    fontSize: 12,
  },
  deliveryGroupTitle: {
    color: '#0F172A',
    flex: 1,
    fontSize: 20,
    lineHeight: 26,
  },
  deliveryGroupMeta: {
    color: '#64748B',
    fontSize: 14,
  },
  deliveryGroupAlias: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 18,
    marginTop: -2,
  },
  deliveryGroupSpec: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 18,
    marginTop: -4,
  },
  deliveryGroupSummary: {
    color: '#2563EB',
    fontSize: 17,
    lineHeight: 24,
  },
  deliveryGroupAmountLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  deliveryGroupAmount: {
    color: '#B45309',
    fontSize: 24,
    lineHeight: 30,
    paddingTop: 2,
    textAlign: 'right',
  },
  deliveryGroupRows: {
    gap: 0,
    paddingHorizontal: 2,
  },
  deliveryWarehouseRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 14,
  },
  deliveryWarehouseDivider: {
    borderTopColor: '#CBD5E1',
    borderTopWidth: 1,
  },
  deliveryWarehouseMain: {
    flex: 1,
    gap: 6,
  },
  deliveryWarehouseTitle: {
    color: '#1E293B',
    fontSize: 17,
  },
  deliveryWarehouseAmountBlock: {
    alignItems: 'flex-end',
    gap: 4,
    paddingTop: 1,
  },
  deliveryWarehouseAmountLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  deliveryWarehouseSummaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  deliveryWarehouseFormula: {
    color: '#B45309',
    fontSize: 19,
  },
  deliveryWarehouseAmount: {
    color: '#B45309',
    fontSize: 19,
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
