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
import { isValidIsoDate } from '@/lib/date-value';
import { useFeedback } from '@/providers/feedback-provider';
import {
  fetchPurchaseInvoiceDetail,
  fetchPurchaseOrderDetail,
  fetchPurchaseReceiptDetail,
  searchPurchaseReceipts,
  submitPurchaseInvoiceFromReceipt,
  type PurchaseInvoiceDetail,
  type PurchaseReceiptDetail,
} from '@/services/purchases';

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

  const purchaseInvoiceName =
    typeof params.purchaseInvoice === 'string' ? params.purchaseInvoice.trim() : '';
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

  const actions = invoiceDetail?.name
    ? [
        {
          href: `/purchase/payment/create?referenceName=${encodeURIComponent(invoiceDetail.name)}` as Href,
          label: '登记供应商付款',
          description: '基于这张采购发票继续登记付款',
        },
        ...(invoiceDetail.purchaseReceipts[0]
          ? [
              {
                href: `/purchase/receipt/create?receiptName=${encodeURIComponent(invoiceDetail.purchaseReceipts[0])}` as Href,
                label: '查看收货单',
                description: '回到本发票关联的采购收货单',
              },
            ]
          : []),
        ...(invoiceDetail.purchaseOrders[0]
          ? [
              {
                href: `/purchase/order/${encodeURIComponent(invoiceDetail.purchaseOrders[0])}` as Href,
                label: '返回采购订单',
                description: '回到采购订单详情继续处理',
              },
            ]
          : []),
      ]
    : [];

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

  return (
    <AppShell
      actions={actions}
      title="登记供应商发票"
      description="采购发票代表供应商向我们开具的应付票据。这里不是我们去开票，而是把到票事实登记进系统。"
      compactHeader
      contentCard={false}
      footer={
        invoiceDetail ? null : (
          <Pressable
            disabled={isSubmitting}
            onPress={handleSubmit}
            style={[styles.footerButton, { backgroundColor: isSubmitting ? surfaceMuted : tintColor }]}>
            <ThemedText style={styles.footerButtonText} type="defaultSemiBold">
              {isSubmitting ? '正在登记采购发票...' : '提交采购发票'}
            </ThemedText>
          </Pressable>
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
              <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
                待登记发票的收货单
              </ThemedText>
              <DetailRow label="采购收货单" value={receiptDetail.name} />
              <DetailRow label="供应商" value={receiptDetail.supplierName || receiptDetail.supplier} />
              <DetailRow label="关联订单" value={receiptDetail.purchaseOrders.join('、') || '暂无'} multiline />
              <DetailRow
                label="收货金额"
                value={formatMoney(receiptDetail.receiptAmountEstimate, receiptDetail.currency || 'CNY')}
              />
              <DetailRow label="总数量" value={String(receiptDetail.totalQty ?? '—')} />
            </View>

            <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
              <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
                商品明细
              </ThemedText>
              <View style={styles.itemList}>
                {receiptDetail.items.map((item, index) => (
                  <View key={`${item.itemCode}-${index}`} style={[styles.itemCard, { backgroundColor: surfaceMuted }]}>
                    <ThemedText type="defaultSemiBold">{item.itemName || item.itemCode}</ThemedText>
                    <ThemedText style={styles.itemMeta}>
                      数量 {item.qty ?? '—'} · 单价 {formatMoney(item.rate, receiptDetail.currency || 'CNY')}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
              <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
                后续操作
              </ThemedText>
              <View style={styles.nextActionRow}>
                {receiptDetail.purchaseOrders[0] ? (
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: '/purchase/order/[orderName]',
                        params: { orderName: receiptDetail.purchaseOrders[0] },
                      })
                    }
                    style={[styles.nextActionButton, { backgroundColor: surfaceMuted, borderColor }]}>
                    <ThemedText style={[styles.nextActionText, { color: tintColor }]} type="defaultSemiBold">
                      返回采购订单
                    </ThemedText>
                  </Pressable>
                ) : null}
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
              <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
                采购发票已登记
              </ThemedText>
              <DetailRow label="采购发票" value={invoiceDetail.name} />
              <DetailRow label="供应商" value={invoiceDetail.supplierName || invoiceDetail.supplier} />
              <DetailRow label="状态" value={invoiceDetail.documentStatus || 'unknown'} />
              <DetailRow
                label="发票金额"
                value={formatMoney(invoiceDetail.invoiceAmountEstimate, invoiceDetail.currency || 'CNY')}
              />
              <DetailRow
                label="未付金额"
                value={formatMoney(invoiceDetail.outstandingAmount, invoiceDetail.currency || 'CNY')}
              />
              <DetailRow label="付款状态" value={invoiceDetail.paymentStatus || 'unknown'} />
              <DetailRow label="关联收货单" value={invoiceDetail.purchaseReceipts.join('、') || '暂无'} multiline />
            </View>

            <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
              <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
                商品明细
              </ThemedText>
              <View style={styles.itemList}>
                {invoiceDetail.items.map((item, index) => (
                  <View key={`${item.itemCode}-${index}`} style={[styles.itemCard, { backgroundColor: surfaceMuted }]}>
                    <ThemedText type="defaultSemiBold">{item.itemName || item.itemCode}</ThemedText>
                    <ThemedText style={styles.itemMeta}>
                      数量 {item.qty ?? '—'} · 金额 {formatMoney(item.amount, invoiceDetail.currency || 'CNY')}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
              <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
                后续操作
              </ThemedText>
              <View style={styles.nextActionRow}>
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/purchase/payment/create',
                      params: { referenceName: invoiceDetail.name },
                    })
                  }
                  style={[styles.nextActionButton, { backgroundColor: surfaceMuted, borderColor }]}>
                  <ThemedText style={[styles.nextActionText, { color: tintColor }]} type="defaultSemiBold">
                    去登记付款
                  </ThemedText>
                </Pressable>
                {invoiceDetail.purchaseReceipts[0] ? (
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: '/purchase/receipt/create',
                        params: { receiptName: invoiceDetail.purchaseReceipts[0] },
                      })
                    }
                    style={[styles.nextActionButton, { backgroundColor: surfaceMuted, borderColor }]}>
                    <ThemedText style={[styles.nextActionText, { color: tintColor }]} type="defaultSemiBold">
                      查看收货单
                    </ThemedText>
                  </Pressable>
                ) : null}
                {invoiceDetail.purchaseOrders[0] ? (
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: '/purchase/order/[orderName]',
                        params: { orderName: invoiceDetail.purchaseOrders[0] },
                      })
                    }
                    style={[styles.nextActionButton, { backgroundColor: surfaceMuted, borderColor }]}>
                    <ThemedText style={[styles.nextActionText, { color: tintColor }]} type="defaultSemiBold">
                      返回采购订单
                    </ThemedText>
                  </Pressable>
                ) : null}
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
  itemMeta: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 18,
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
