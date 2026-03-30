import { useEffect, useMemo, useState } from 'react';
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
  fetchPurchaseInvoiceDetail,
  searchModeOfPayments,
  searchPurchaseInvoices,
  submitSupplierPayment,
  type PurchaseInvoiceDetail,
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

export default function PurchasePaymentCreateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ referenceName?: string }>();
  const { showError, showSuccess } = useFeedback();
  const [referenceName, setReferenceName] = useState(
    typeof params.referenceName === 'string' ? params.referenceName.trim() : '',
  );
  const [paidAmount, setPaidAmount] = useState('');
  const [modeOfPayment, setModeOfPayment] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [referenceDate, setReferenceDate] = useState(getTodayIsoDate());
  const [invoiceDetail, setInvoiceDetail] = useState<PurchaseInvoiceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const surface = useThemeColor({}, 'surface');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');

  useEffect(() => {
    if (typeof params.referenceName === 'string' && params.referenceName.trim()) {
      setReferenceName(params.referenceName.trim());
    }
  }, [params.referenceName]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const trimmedReferenceName = referenceName.trim();
      if (!trimmedReferenceName) {
        setInvoiceDetail(null);
        return;
      }

      setIsLoading(true);
      try {
        const detail = await fetchPurchaseInvoiceDetail(trimmedReferenceName);
        if (!cancelled) {
          setInvoiceDetail(detail);
          if (detail?.outstandingAmount && !paidAmount.trim()) {
            setPaidAmount(String(detail.outstandingAmount));
          }
        }
      } catch (error) {
        if (!cancelled) {
          showError(normalizeAppError(error).message);
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
  }, [paidAmount, referenceName, showError]);

  const expectedAmount = useMemo(() => invoiceDetail?.outstandingAmount ?? null, [invoiceDetail]);

  const handleSubmit = async () => {
    const trimmedReference = referenceName.trim();
    const amount = Number(paidAmount);
    if (!trimmedReference) {
      showError('请先填写采购发票号。');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      showError('请输入有效的付款金额。');
      return;
    }
    if (!isValidIsoDate(referenceDate)) {
      showError('请先选择有效付款日期。');
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await submitSupplierPayment({
        referenceName: trimmedReference,
        paidAmount: amount,
        modeOfPayment: modeOfPayment.trim() || undefined,
        referenceNo: referenceNo.trim() || undefined,
        referenceDate: referenceDate.trim() || undefined,
      });
      const paymentEntry = typeof result?.payment_entry === 'string' ? result.payment_entry : '';
      showSuccess(paymentEntry ? `供应商付款已登记：${paymentEntry}` : '供应商付款已登记。');
      router.replace({
        pathname: '/purchase/invoice/create',
        params: { purchaseInvoice: trimmedReference },
      });
    } catch (error) {
      showError(normalizeAppError(error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell
      title="供应商付款"
      description="这里登记的是我们向供应商付款的事实，用于冲减采购发票应付金额。"
      compactHeader
      contentCard={false}
      footer={
        <Pressable
          disabled={isSubmitting}
          onPress={handleSubmit}
          style={[styles.footerButton, { backgroundColor: isSubmitting ? surfaceMuted : tintColor }]}>
          <ThemedText style={styles.footerButtonText} type="defaultSemiBold">
            {isSubmitting ? '正在登记付款...' : '提交供应商付款'}
          </ThemedText>
        </Pressable>
      }>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
          <LinkOptionInput
            label="采购发票号"
            loadOptions={searchPurchaseInvoices}
            onChangeText={setReferenceName}
            placeholder="搜索采购发票"
            value={referenceName}
          />
          <View style={styles.field}>
            <ThemedText style={styles.label} type="defaultSemiBold">
              付款金额
            </ThemedText>
            <TextInput
              keyboardType="numeric"
              onChangeText={(value) => setPaidAmount(sanitizeDecimalInput(value))}
              placeholder="输入本次付款金额"
              style={[styles.input, { backgroundColor: surfaceMuted, borderColor }]}
              value={paidAmount}
            />
            {expectedAmount !== null ? (
              <ThemedText style={styles.helperText}>
                当前建议按未付金额登记：{formatMoney(expectedAmount, invoiceDetail?.currency || 'CNY')}
              </ThemedText>
            ) : null}
          </View>
          <LinkOptionInput
            label="付款方式"
            loadOptions={searchModeOfPayments}
            onChangeText={setModeOfPayment}
            placeholder="例如 Cash / Wire Transfer"
            value={modeOfPayment}
          />
          <View style={styles.row}>
            <View style={styles.field}>
              <ThemedText style={styles.label} type="defaultSemiBold">
                凭证号
              </ThemedText>
              <TextInput
                onChangeText={setReferenceNo}
                placeholder="可选"
                style={[styles.input, { backgroundColor: surfaceMuted, borderColor }]}
                value={referenceNo}
              />
            </View>
            <View style={styles.field}>
              <DateFieldInput
                errorText={!isValidIsoDate(referenceDate) ? '请选择有效付款日期。' : undefined}
                helperText="默认今天，用于登记本次实际付款日期。"
                label="付款日期"
                onChange={setReferenceDate}
                value={referenceDate}
              />
            </View>
          </View>
        </View>

        {isLoading ? (
          <View style={[styles.loadingCard, { backgroundColor: surface, borderColor }]}>
            <ActivityIndicator color={tintColor} />
            <ThemedText>正在读取采购发票详情...</ThemedText>
          </View>
        ) : null}

        {!isLoading && invoiceDetail ? (
          <>
            <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
              <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
                应付摘要
              </ThemedText>
              <DetailRow label="采购发票" value={invoiceDetail.name} />
              <DetailRow label="供应商" value={invoiceDetail.supplierName || invoiceDetail.supplier} />
              <DetailRow
                label="发票金额"
                value={formatMoney(invoiceDetail.invoiceAmountEstimate, invoiceDetail.currency || 'CNY')}
              />
              <DetailRow
                label="已付金额"
                value={formatMoney(invoiceDetail.paidAmount, invoiceDetail.currency || 'CNY')}
              />
              <DetailRow
                label="未付金额"
                value={formatMoney(invoiceDetail.outstandingAmount, invoiceDetail.currency || 'CNY')}
              />
              <DetailRow label="付款状态" value={invoiceDetail.paymentStatus || 'unknown'} />
            </View>

            <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
              <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
                付款前提示
              </ThemedText>
              <ThemedText>
                采购付款是对供应商应付账款的登记，不是对外收款。若这张采购发票来自收货单，建议先确认到票和对账金额都无误，再登记付款。
              </ThemedText>
            </View>
          </>
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
  field: {
    gap: 8,
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
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
  helperText: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
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
