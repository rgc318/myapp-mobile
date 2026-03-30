import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { DateFieldInput } from '@/components/date-field-input';
import { LinkOptionInput } from '@/components/link-option-input';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { normalizeAppError } from '@/lib/app-error';
import { getTodayIsoDate, isValidIsoDate } from '@/lib/date-value';
import { useFeedback } from '@/providers/feedback-provider';
import {
  fetchPurchaseInvoiceDetail,
  fetchPurchaseReceiptDetail,
  searchPurchaseInvoices,
  searchPurchaseReceipts,
  submitPurchaseReturn,
  type PurchaseInvoiceDetail,
  type PurchaseReceiptDetail,
} from '@/services/purchases';

type PurchaseReturnSource = 'Purchase Receipt' | 'Purchase Invoice';

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

export default function PurchaseReturnCreateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sourceDoctype?: string; sourceName?: string }>();
  const { showError, showSuccess } = useFeedback();
  const [sourceDoctype, setSourceDoctype] = useState<PurchaseReturnSource>(
    params.sourceDoctype === 'Purchase Invoice' ? 'Purchase Invoice' : 'Purchase Receipt',
  );
  const [sourceName, setSourceName] = useState(
    typeof params.sourceName === 'string' ? params.sourceName.trim() : '',
  );
  const [remarks, setRemarks] = useState('');
  const [postingDate, setPostingDate] = useState(getTodayIsoDate());
  const [receiptDetail, setReceiptDetail] = useState<PurchaseReceiptDetail | null>(null);
  const [invoiceDetail, setInvoiceDetail] = useState<PurchaseInvoiceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const surface = useThemeColor({}, 'surface');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');

  useEffect(() => {
    if (typeof params.sourceName === 'string' && params.sourceName.trim()) {
      setSourceName(params.sourceName.trim());
    }
    if (params.sourceDoctype === 'Purchase Invoice' || params.sourceDoctype === 'Purchase Receipt') {
      setSourceDoctype(params.sourceDoctype);
    }
  }, [params.sourceDoctype, params.sourceName]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const trimmedSourceName = sourceName.trim();
      if (!trimmedSourceName) {
        setReceiptDetail(null);
        setInvoiceDetail(null);
        return;
      }

      setIsLoading(true);
      try {
        if (sourceDoctype === 'Purchase Receipt') {
          const detail = await fetchPurchaseReceiptDetail(trimmedSourceName);
          if (!cancelled) {
            setReceiptDetail(detail);
            setInvoiceDetail(null);
          }
        } else {
          const detail = await fetchPurchaseInvoiceDetail(trimmedSourceName);
          if (!cancelled) {
            setInvoiceDetail(detail);
            setReceiptDetail(null);
          }
        }
      } catch (error) {
        if (!cancelled) {
          showError(normalizeAppError(error).message);
          setReceiptDetail(null);
          setInvoiceDetail(null);
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
  }, [showError, sourceDoctype, sourceName]);

  const handleSubmit = async () => {
    const trimmedSourceName = sourceName.trim();
    if (!trimmedSourceName) {
      showError('请先选择退货来源单据。');
      return;
    }
    if (!isValidIsoDate(postingDate)) {
      showError('请先选择有效退货日期。');
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await submitPurchaseReturn({
        sourceDoctype,
        sourceName: trimmedSourceName,
        remarks,
        postingDate,
      });

      const returnDocument = typeof result?.return_document === 'string' ? result.return_document : '';
      const returnDoctype =
        typeof result?.return_doctype === 'string' ? result.return_doctype : sourceDoctype;

      showSuccess(returnDocument ? `采购退货已创建：${returnDocument}` : '采购退货已创建。');
      router.replace('/(tabs)/purchase');
      if (!returnDocument) {
        return;
      }
      router.push({
        pathname:
          returnDoctype === 'Purchase Invoice'
            ? '/purchase/invoice/create'
            : '/purchase/receipt/create',
        params:
          returnDoctype === 'Purchase Invoice'
            ? { purchaseInvoice: returnDocument }
            : { receiptName: returnDocument },
      });
    } catch (error) {
      showError(normalizeAppError(error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell
      title="采购退货"
      description="采购退货是对供应商退货或红字冲减事实的登记。第一版先支持整单退货，后续再补部分退货和逐行选择。"
      compactHeader
      contentCard={false}
      footer={
        <Pressable
          disabled={isSubmitting}
          onPress={handleSubmit}
          style={[styles.footerButton, { backgroundColor: isSubmitting ? surfaceMuted : tintColor }]}>
          <ThemedText style={styles.footerButtonText} type="defaultSemiBold">
            {isSubmitting ? '正在创建采购退货...' : '提交采购退货'}
          </ThemedText>
        </Pressable>
      }>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
          <View style={styles.switchWrap}>
            {(['Purchase Receipt', 'Purchase Invoice'] as PurchaseReturnSource[]).map((value) => {
              const active = sourceDoctype === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setSourceDoctype(value)}
                  style={[
                    styles.switchOption,
                    { backgroundColor: active ? '#FFFFFF' : surfaceMuted, borderColor: active ? tintColor : borderColor },
                  ]}>
                  <ThemedText style={styles.switchText} type="defaultSemiBold">
                    {value === 'Purchase Receipt' ? '基于收货单退货' : '基于采购发票退货'}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <LinkOptionInput
            label={sourceDoctype === 'Purchase Receipt' ? '采购收货单号' : '采购发票号'}
            loadOptions={sourceDoctype === 'Purchase Receipt' ? searchPurchaseReceipts : searchPurchaseInvoices}
            onChangeText={setSourceName}
            placeholder={sourceDoctype === 'Purchase Receipt' ? '搜索采购收货单' : '搜索采购发票'}
            value={sourceName}
          />

          <View style={styles.field}>
            <DateFieldInput
              errorText={!isValidIsoDate(postingDate) ? '请选择有效退货日期。' : undefined}
              helperText="默认今天，用于记录本次退货过账日期。"
              label="退货日期"
              onChange={setPostingDate}
              value={postingDate}
            />
          </View>

          <View style={styles.field}>
            <ThemedText style={styles.label} type="defaultSemiBold">
              备注
            </ThemedText>
            <TextInput
              multiline
              onChangeText={setRemarks}
              placeholder="可选，记录退货原因"
              style={[styles.input, styles.textarea, { backgroundColor: surfaceMuted, borderColor }]}
              value={remarks}
            />
          </View>
        </View>

        {isLoading ? (
          <View style={[styles.loadingCard, { backgroundColor: surface, borderColor }]}>
            <ActivityIndicator color={tintColor} />
            <ThemedText>正在读取退货来源单据...</ThemedText>
          </View>
        ) : null}

        {!isLoading && receiptDetail ? (
          <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
            <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
              收货单退货预览
            </ThemedText>
            <DetailRow label="采购收货单" value={receiptDetail.name} />
            <DetailRow label="供应商" value={receiptDetail.supplierName || receiptDetail.supplier} />
            <DetailRow
              label="收货金额"
              value={formatMoney(receiptDetail.receiptAmountEstimate, receiptDetail.currency || 'CNY')}
            />
            <DetailRow label="总数量" value={String(receiptDetail.totalQty ?? '—')} />
          </View>
        ) : null}

        {!isLoading && invoiceDetail ? (
          <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
            <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
              采购发票退货预览
            </ThemedText>
            <DetailRow label="采购发票" value={invoiceDetail.name} />
            <DetailRow label="供应商" value={invoiceDetail.supplierName || invoiceDetail.supplier} />
            <DetailRow
              label="发票金额"
              value={formatMoney(invoiceDetail.invoiceAmountEstimate, invoiceDetail.currency || 'CNY')}
            />
            <DetailRow
              label="未付金额"
              value={formatMoney(invoiceDetail.outstandingAmount, invoiceDetail.currency || 'CNY')}
            />
          </View>
        ) : null}
      </ScrollView>
    </AppShell>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <ThemedText style={styles.detailLabel}>{label}</ThemedText>
      <ThemedText style={styles.detailValue} type="defaultSemiBold">
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
  switchWrap: {
    gap: 10,
  },
  switchOption: {
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  switchText: {
    fontSize: 14,
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
