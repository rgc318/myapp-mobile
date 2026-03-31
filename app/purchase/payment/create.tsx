import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

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

type ResultDialogState = {
  tone: 'success' | 'error';
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
} | null;

export default function PurchasePaymentCreateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ referenceName?: string; purchaseInvoice?: string }>();
  const { showError } = useFeedback();
  const [referenceName, setReferenceName] = useState(
    typeof params.referenceName === 'string' && params.referenceName.trim()
      ? params.referenceName.trim()
      : typeof params.purchaseInvoice === 'string' && params.purchaseInvoice.trim()
        ? params.purchaseInvoice.trim()
        : '',
  );
  const [paidAmount, setPaidAmount] = useState('');
  const [modeOfPayment, setModeOfPayment] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [referenceDate, setReferenceDate] = useState(getTodayIsoDate());
  const [invoiceDetail, setInvoiceDetail] = useState<PurchaseInvoiceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmMismatchOpen, setConfirmMismatchOpen] = useState(false);
  const [resultDialog, setResultDialog] = useState<ResultDialogState>(null);

  const surface = useThemeColor({}, 'surface');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');
  const paymentSourceName = referenceName.trim();
  const expectedAmount = useMemo(() => invoiceDetail?.outstandingAmount ?? null, [invoiceDetail]);

  const currentAmount = Number(paidAmount);
  const normalizedAmount = Number.isFinite(currentAmount) && currentAmount > 0 ? currentAmount : 0;
  const isAmountDifferent =
    expectedAmount !== null &&
    Number.isFinite(currentAmount) &&
    currentAmount > 0 &&
    Math.abs(currentAmount - expectedAmount) > 0.0001;

  const returnToInvoicePage = () => {
    if (paymentSourceName) {
      router.replace({
        pathname: '/purchase/invoice/create',
        params: { purchaseInvoice: paymentSourceName },
      });
      return;
    }

    router.replace('/(tabs)/purchase');
  };

  useEffect(() => {
    const nextReference =
      typeof params.referenceName === 'string' && params.referenceName.trim()
        ? params.referenceName.trim()
        : typeof params.purchaseInvoice === 'string' && params.purchaseInvoice.trim()
          ? params.purchaseInvoice.trim()
          : '';

    if (nextReference) {
      setReferenceName(nextReference);
    }
  }, [params.purchaseInvoice, params.referenceName]);

  useEffect(() => {
    let cancelled = false;

    async function loadInvoiceDetail() {
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
      } catch {
        if (!cancelled) {
          setInvoiceDetail(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadInvoiceDetail();
    return () => {
      cancelled = true;
    };
  }, [paidAmount, referenceName]);

  const submitPayment = async () => {
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
      setResultDialog({
        tone: 'success',
        title: '供应商付款登记成功',
        message: paymentEntry
          ? `本次付款已登记成功，付款单号为 ${paymentEntry}。`
          : '本次付款已登记成功。',
        confirmLabel: '返回发票页',
        onConfirm: () => {
          setResultDialog(null);
          returnToInvoicePage();
        },
      });
    } catch (error) {
      setResultDialog({
        tone: 'error',
        title: '付款登记失败',
        message: normalizeAppError(error).message || '供应商付款登记失败。',
        confirmLabel: '继续处理',
        onConfirm: () => {
          setResultDialog(null);
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (isAmountDifferent) {
      setConfirmMismatchOpen(true);
      return;
    }

    void submitPayment();
  };

  return (
    <AppShell
      title="供应商付款"
      description="登记我们向供应商支付的款项，用于冲减采购发票应付金额。"
      compactHeader
      contentCard={false}
      showWorkflowQuickNav={false}
      footer={
        <View style={styles.footerRow}>
          <Pressable onPress={returnToInvoicePage} style={[styles.footerButton, styles.footerGhostButton]}>
            <ThemedText style={styles.footerGhostText} type="defaultSemiBold">
              返回来源页
            </ThemedText>
          </Pressable>
          <Pressable
            disabled={isSubmitting}
            onPress={handleSubmit}
            style={[styles.footerButton, styles.primaryFooterButton, { backgroundColor: isSubmitting ? surfaceMuted : tintColor }]}>
            <ThemedText style={styles.footerButtonText} type="defaultSemiBold">
              {isSubmitting ? '登记中...' : '提交供应商付款'}
            </ThemedText>
          </Pressable>
        </View>
      }>
      <ScrollView contentContainerStyle={styles.container}>
        {isLoading ? (
          <View style={[styles.loadingCard, { backgroundColor: surface, borderColor }]}>
            <ActivityIndicator color={tintColor} />
            <ThemedText>正在读取采购发票付款摘要...</ThemedText>
          </View>
        ) : null}

        {!isLoading && invoiceDetail ? (
          <View style={[styles.card, { backgroundColor: surface, borderColor }]}> 
            <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
              付款确认
            </ThemedText>
            <ThemedText style={styles.metaLine}>来源发票 {invoiceDetail.name}</ThemedText>
            <View style={[styles.customerCard, { backgroundColor: surfaceMuted }]}> 
              <ThemedText style={styles.metaLabel}>供应商</ThemedText>
              <ThemedText style={styles.customerValue} type="defaultSemiBold">
                {invoiceDetail.supplierName || invoiceDetail.supplier || '未配置'}
              </ThemedText>
            </View>

            <View style={styles.summaryGrid}>
              <View style={[styles.summaryCell, { backgroundColor: surfaceMuted }]}> 
                <ThemedText style={styles.metaLabel}>发票金额</ThemedText>
                <ThemedText style={styles.summaryValue} type="defaultSemiBold">
                  {formatMoney(invoiceDetail.invoiceAmountEstimate, invoiceDetail.currency || 'CNY')}
                </ThemedText>
              </View>
              <View style={[styles.summaryCell, { backgroundColor: surfaceMuted }]}> 
                <ThemedText style={styles.metaLabel}>已付金额</ThemedText>
                <ThemedText style={[styles.summaryValue, styles.positiveText]} type="defaultSemiBold">
                  {formatMoney(invoiceDetail.paidAmount, invoiceDetail.currency || 'CNY')}
                </ThemedText>
              </View>
              <View style={[styles.summaryCell, { backgroundColor: surfaceMuted }]}> 
                <ThemedText style={styles.metaLabel}>当前未付</ThemedText>
                <ThemedText
                  style={[
                    styles.summaryValue,
                    (invoiceDetail.outstandingAmount ?? 0) > 0 ? styles.warningTextStrong : styles.mutedText,
                  ]}
                  type="defaultSemiBold">
                  {formatMoney(invoiceDetail.outstandingAmount, invoiceDetail.currency || 'CNY')}
                </ThemedText>
              </View>
            </View>
          </View>
        ) : null}

        <View style={[styles.card, { backgroundColor: surface, borderColor }]}> 
          <LinkOptionInput
            label="采购发票号"
            loadOptions={searchPurchaseInvoices}
            onChangeText={setReferenceName}
            placeholder="搜索采购发票"
            value={referenceName}
          />

          {expectedAmount !== null ? (
            <View style={[styles.helperCard, { backgroundColor: surfaceMuted }]}> 
              <ThemedText style={styles.helperTitle} type="defaultSemiBold">
                建议付款金额
              </ThemedText>
              <ThemedText style={styles.helperAmount} type="defaultSemiBold">
                {formatMoney(expectedAmount, invoiceDetail?.currency || 'CNY')}
              </ThemedText>
              <ThemedText style={styles.helperText}>
                系统已按当前未付金额带入。若本次付款与建议金额不一致，提交前会再次让你确认。
              </ThemedText>
            </View>
          ) : null}

          <View style={styles.field}>
            <ThemedText style={styles.label} type="defaultSemiBold">
              本次付款金额
            </ThemedText>
            <TextInput
              keyboardType="decimal-pad"
              onChangeText={(value) => setPaidAmount(sanitizeDecimalInput(value))}
              placeholder="输入本次付款金额"
              style={[styles.input, { backgroundColor: surfaceMuted, borderColor }]}
              value={paidAmount}
            />
            {isAmountDifferent && expectedAmount !== null ? (
              <View style={styles.warningCard}>
                <ThemedText style={styles.warningTitle} type="defaultSemiBold">
                  付款金额与建议值不一致
                </ThemedText>
                <ThemedText style={styles.warningText}>
                  当前建议付款为 {formatMoney(expectedAmount, invoiceDetail?.currency || 'CNY')}，
                  你填写的是 {formatMoney(normalizedAmount, invoiceDetail?.currency || 'CNY')}。
                </ThemedText>
              </View>
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

          {(paymentSourceName || modeOfPayment.trim()) ? (
            <View style={[styles.submitHintCard, { backgroundColor: surfaceMuted }]}> 
              <ThemedText style={styles.submitHintTitle} type="defaultSemiBold">
                提交前确认
              </ThemedText>
              <ThemedText style={styles.submitHintText}>
                即将为发票 {paymentSourceName || '未指定发票'} 登记 {formatMoney(normalizedAmount || null, invoiceDetail?.currency || 'CNY')}，
                付款方式为 {modeOfPayment.trim() || '未指定'}。
              </ThemedText>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <Modal
        animationType="fade"
        onRequestClose={() => setConfirmMismatchOpen(false)}
        transparent
        visible={confirmMismatchOpen}>
        <View style={styles.dialogBackdrop}>
          <View style={styles.dialogCard}>
            <ThemedText style={styles.dialogTitle} type="defaultSemiBold">
              确认本次付款金额？
            </ThemedText>
            <ThemedText style={styles.dialogMessage}>
              当前建议金额为{' '}
              <ThemedText style={styles.dialogEmphasis} type="defaultSemiBold">
                {formatMoney(expectedAmount, invoiceDetail?.currency || 'CNY')}
              </ThemedText>
              ，你填写的是{' '}
              <ThemedText style={styles.dialogEmphasis} type="defaultSemiBold">
                {formatMoney(Number(paidAmount) || 0, invoiceDetail?.currency || 'CNY')}
              </ThemedText>
              。如果这是部分付款或特殊对账场景，请确认后继续。
            </ThemedText>
            <View style={styles.dialogActions}>
              <Pressable onPress={() => setConfirmMismatchOpen(false)} style={styles.dialogGhostButton}>
                <ThemedText style={styles.dialogGhostText} type="defaultSemiBold">
                  返回修改
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => {
                  setConfirmMismatchOpen(false);
                  void submitPayment();
                }}
                style={styles.dialogPrimaryButton}>
                <ThemedText style={styles.dialogPrimaryText} type="defaultSemiBold">
                  确认付款
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => setResultDialog(null)}
        transparent
        visible={!!resultDialog}>
        <View style={styles.dialogBackdrop}>
          <View style={styles.dialogCard}>
            <ThemedText
              style={[
                styles.dialogTitle,
                resultDialog?.tone === 'success' ? styles.resultSuccessTitle : styles.resultErrorTitle,
              ]}
              type="defaultSemiBold">
              {resultDialog?.title}
            </ThemedText>
            <ThemedText style={styles.dialogMessage}>{resultDialog?.message}</ThemedText>
            <View style={styles.dialogActions}>
              <Pressable
                onPress={() => resultDialog?.onConfirm()}
                style={[
                  styles.dialogPrimaryButton,
                  resultDialog?.tone === 'success' ? styles.resultSuccessButton : styles.resultErrorButton,
                ]}>
                <ThemedText style={styles.dialogPrimaryText} type="defaultSemiBold">
                  {resultDialog?.confirmLabel}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </AppShell>
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
  loadingCard: {
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    gap: 10,
    justifyContent: 'center',
    minHeight: 140,
    padding: 18,
  },
  sectionTitle: {
    fontSize: 17,
  },
  metaLine: {
    color: '#64748B',
    fontSize: 13,
  },
  customerCard: {
    borderRadius: 16,
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  customerValue: {
    fontSize: 17,
  },
  summaryGrid: {
    gap: 10,
  },
  summaryCell: {
    borderRadius: 14,
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  metaLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  summaryValue: {
    color: '#0F172A',
    fontSize: 18,
  },
  positiveText: {
    color: '#15803D',
  },
  mutedText: {
    color: '#64748B',
  },
  warningTextStrong: {
    color: '#C2410C',
  },
  field: {
    flex: 1,
    gap: 8,
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
  helperCard: {
    borderRadius: 16,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  helperTitle: {
    fontSize: 13,
  },
  helperAmount: {
    color: '#C2410C',
    fontSize: 20,
  },
  helperText: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
  },
  warningCard: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  warningTitle: {
    color: '#B45309',
    fontSize: 13,
  },
  warningText: {
    color: '#9A3412',
    fontSize: 12,
    lineHeight: 18,
  },
  submitHintCard: {
    borderRadius: 16,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  submitHintTitle: {
    fontSize: 13,
  },
  submitHintText: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 19,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  footerButton: {
    alignItems: 'center',
    borderRadius: 16,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
  },
  footerGhostButton: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
  },
  footerGhostText: {
    color: '#2563EB',
    fontSize: 15,
  },
  primaryFooterButton: {
    backgroundColor: '#2563EB',
  },
  footerButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
  },
  dialogBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  dialogCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    gap: 14,
    padding: 18,
    width: '100%',
  },
  dialogTitle: {
    color: '#0F172A',
    fontSize: 18,
  },
  dialogMessage: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 22,
  },
  dialogEmphasis: {
    color: '#C2410C',
    fontSize: 14,
  },
  dialogActions: {
    flexDirection: 'row',
    gap: 10,
  },
  dialogGhostButton: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
  },
  dialogGhostText: {
    color: '#334155',
    fontSize: 14,
  },
  dialogPrimaryButton: {
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 14,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
  },
  dialogPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  resultSuccessTitle: {
    color: '#166534',
  },
  resultErrorTitle: {
    color: '#B91C1C',
  },
  resultSuccessButton: {
    backgroundColor: '#16A34A',
  },
  resultErrorButton: {
    backgroundColor: '#DC2626',
  },
});
