import { useEffect, useState } from 'react';
import type { Href } from 'expo-router';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

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

export default function PurchaseReceiptCreateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderName?: string; receiptName?: string; notice?: string }>();
  const { showError, showSuccess, showInfo } = useFeedback();
  const [orderName, setOrderName] = useState(typeof params.orderName === 'string' ? params.orderName.trim() : '');
  const [postingDate, setPostingDate] = useState(getTodayIsoDate());
  const [postingTime, setPostingTime] = useState('');
  const [remarks, setRemarks] = useState('');
  const [orderDetail, setOrderDetail] = useState<PurchaseOrderDetail | null>(null);
  const [receiptDetail, setReceiptDetail] = useState<PurchaseReceiptDetail | null>(null);
  const [editableItems, setEditableItems] = useState<EditableReceiptItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const actions = receiptDetail?.name
    ? [
        {
          href: `/purchase/invoice/create?receiptName=${encodeURIComponent(receiptDetail.name)}` as Href,
          label: '登记供应商发票',
          description: '基于这张收货单继续登记采购发票',
        },
      ]
    : [];

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

  const updateEditableItem = (key: string, updater: (item: EditableReceiptItem) => EditableReceiptItem) => {
    setEditableItems((current) => current.map((item) => (item.key === key ? updater(item) : item)));
  };

  const selectedLineCount = editableItems.filter((item) => Number(item.qtyInput.trim()) > 0).length;
  const selectedQty = editableItems.reduce((sum, item) => {
    const qty = Number(item.qtyInput.trim());
    return sum + (Number.isFinite(qty) && qty > 0 ? qty : 0);
  }, 0);

  return (
    <AppShell
      actions={actions}
      title="采购收货"
      description="先确认采购订单，再登记本次实际到货。采购收货记录的是库存入库事实，不等于供应商已经开票。"
      compactHeader
      contentCard={false}
      footer={
        receiptDetail ? null : (
          <Pressable
            disabled={isSubmitting}
            onPress={handleSubmit}
            style={[styles.footerButton, { backgroundColor: isSubmitting ? surfaceMuted : tintColor }]}>
            <ThemedText style={styles.footerButtonText} type="defaultSemiBold">
              {isSubmitting ? '正在登记采购收货...' : '提交采购收货'}
            </ThemedText>
          </Pressable>
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
                <TextInput
                  onChangeText={setPostingTime}
                  placeholder="HH:mm:ss"
                  style={[styles.input, { backgroundColor: surfaceMuted, borderColor }]}
                  value={postingTime}
                />
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
              <DetailRow label="收货状态" value={orderDetail.receivingStatus || 'unknown'} />
              <DetailRow
                label="订单金额"
                value={formatMoney(orderDetail.orderAmountEstimate, orderDetail.currency || 'CNY')}
              />
              <DetailRow
                label="已收 / 总量"
                value={`${orderDetail.receivedQty ?? '—'} / ${orderDetail.totalQty ?? '—'}`}
              />
              <DetailRow label="默认地址" value={orderDetail.defaultAddressDisplay || '未设置'} multiline />
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
              <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
                收货已登记
              </ThemedText>
              <DetailRow label="采购收货单" value={receiptDetail.name} />
              <DetailRow label="供应商" value={receiptDetail.supplierName || receiptDetail.supplier} />
              <DetailRow label="状态" value={receiptDetail.documentStatus || 'unknown'} />
              <DetailRow
                label="收货金额"
                value={formatMoney(receiptDetail.receiptAmountEstimate, receiptDetail.currency || 'CNY')}
              />
              <DetailRow label="总数量" value={String(receiptDetail.totalQty ?? '—')} />
              <DetailRow label="关联订单" value={receiptDetail.purchaseOrders.join('、') || '暂无'} multiline />
            </View>

            <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
              <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
                商品明细
              </ThemedText>
              <View style={styles.itemList}>
                {receiptDetail.items.map((item, index) => (
                  <View key={`${item.itemCode}-${index}`} style={[styles.itemCard, { backgroundColor: surfaceMuted }]}>
                    <ThemedText type="defaultSemiBold">{item.itemName || item.itemCode}</ThemedText>
                    <ThemedText style={styles.itemMeta}>编码 {item.itemCode}</ThemedText>
                    <ThemedText style={styles.itemMeta}>
                      数量 {item.qty ?? '—'} · 单价 {formatMoney(item.rate, receiptDetail.currency || 'CNY')}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>
    </AppShell>
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
    gap: 16,
    paddingHorizontal: 18,
    paddingBottom: 92,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    padding: 18,
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
