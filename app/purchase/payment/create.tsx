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
import { type LinkOption } from '@/services/master-data';
import {
  cancelSupplierPayment,
  fetchPurchaseInvoiceDetail,
  searchModeOfPayments,
  searchPurchaseInvoices,
  submitSupplierPayment,
  type PurchaseInvoiceDetail,
} from '@/services/purchases';

const MODE_OF_PAYMENT_LABELS: Record<string, string> = {
  Cash: '现金',
  'Bank Draft': '银行汇票',
  'Wire Transfer': '银行转账',
  'Credit Card': '信用卡',
  Cheque: '支票',
  'WeChat Pay': '微信支付',
  Alipay: '支付宝',
  微信支付: '微信支付',
  支付宝支付: '支付宝支付',
};

const FEATURED_MODE_KEYS = ['微信支付', 'WeChat Pay', 'Cash', '现金', '支付宝支付', 'Alipay'] as const;

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

function getModeOfPaymentLabel(value: string) {
  return MODE_OF_PAYMENT_LABELS[value] ?? value;
}

function isFeaturedMode(value: string) {
  return FEATURED_MODE_KEYS.includes(value as (typeof FEATURED_MODE_KEYS)[number]);
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
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [confirmMismatchOpen, setConfirmMismatchOpen] = useState(false);
  const [confirmRollbackOpen, setConfirmRollbackOpen] = useState(false);
  const [resultDialog, setResultDialog] = useState<ResultDialogState>(null);
  const [modePickerOpen, setModePickerOpen] = useState(false);
  const [modeQuery, setModeQuery] = useState('');
  const [modeOptions, setModeOptions] = useState<LinkOption[]>([]);

  const surface = useThemeColor({}, 'surface');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');
  const paymentSourceName = referenceName.trim();
  const expectedAmount = useMemo(() => invoiceDetail?.outstandingAmount ?? null, [invoiceDetail]);

  const featuredModeOptions = modeOptions.filter((option, index, array) => {
    if (!isFeaturedMode(option.value)) {
      return false;
    }

    return (
      array.findIndex(
        (candidate) => getModeOfPaymentLabel(candidate.value) === getModeOfPaymentLabel(option.value),
      ) === index
    );
  });
  const extraModeOptions = modeOptions.filter((option) => !isFeaturedMode(option.value));

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
          if (typeof detail?.outstandingAmount === 'number') {
            setPaidAmount((current) => (current.trim() ? current : String(detail.outstandingAmount)));
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
  }, [referenceName]);

  useEffect(() => {
    let cancelled = false;

    void searchModeOfPayments('').then((options) => {
      if (cancelled) {
        return;
      }

      setModeOptions(options);
      if (!modeOfPayment && options.length) {
        const preferred =
          options.find((option) => option.value === '微信支付') ??
          options.find((option) => option.value === 'WeChat Pay') ??
          options.find((option) => option.value === 'Cash') ??
          options.find((option) => option.value === '现金') ??
          options.find((option) => option.value === '支付宝支付') ??
          options.find((option) => option.value === 'Alipay') ??
          options[0];
        setModeOfPayment(preferred?.value ?? '');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [modeOfPayment]);

  useEffect(() => {
    if (!modePickerOpen) {
      return;
    }

    let cancelled = false;
    void searchModeOfPayments(modeQuery).then((options) => {
      if (!cancelled) {
        setModeOptions(options);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [modePickerOpen, modeQuery]);

  const submitPayment = async () => {
    const trimmedReference = referenceName.trim();
    const amount = Number(paidAmount);
    const trimmedModeOfPayment = modeOfPayment.trim();

    if (!trimmedReference) {
      showError('请先填写采购发票号。');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      showError('请输入有效的付款金额。');
      return;
    }
    if (!trimmedModeOfPayment) {
      showError('请选择付款方式。');
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
        modeOfPayment: trimmedModeOfPayment,
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

  const rollbackLatestPayment = async () => {
    const latestPaymentEntry = invoiceDetail?.latestPaymentEntry?.trim();
    if (!latestPaymentEntry) {
      showError('当前没有可回退的付款单。');
      return;
    }

    try {
      setIsRollingBack(true);
      await cancelSupplierPayment(latestPaymentEntry);
      const refreshed = await fetchPurchaseInvoiceDetail(referenceName.trim());
      setInvoiceDetail(refreshed);
      setResultDialog({
        tone: 'success',
        title: '付款回退成功',
        message: `已回退付款单 ${latestPaymentEntry}。如需更正，可重新登记供应商付款。`,
        confirmLabel: '继续',
        onConfirm: () => {
          setResultDialog(null);
        },
      });
    } catch (error) {
      setResultDialog({
        tone: 'error',
        title: '付款回退失败',
        message: normalizeAppError(error).message || '回退供应商付款失败。',
        confirmLabel: '继续处理',
        onConfirm: () => {
          setResultDialog(null);
        },
      });
    } finally {
      setIsRollingBack(false);
      setConfirmRollbackOpen(false);
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
      footer={
        <View style={styles.footerRow}>
          <Pressable onPress={returnToInvoicePage} style={[styles.footerButton, styles.footerGhostButton]}>
            <ThemedText style={styles.footerGhostText} type="defaultSemiBold">
              返回来源页
            </ThemedText>
          </Pressable>
          <Pressable
            disabled={isSubmitting || isRollingBack}
            onPress={handleSubmit}
            style={[
              styles.footerButton,
              styles.primaryFooterButton,
              { backgroundColor: isSubmitting || isRollingBack ? surfaceMuted : tintColor },
            ]}>
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

            {invoiceDetail.latestPaymentEntry ? (
              <View style={styles.rollbackCard}>
                <ThemedText style={styles.rollbackTitle} type="defaultSemiBold">
                  回退最近付款
                </ThemedText>
                <ThemedText style={styles.rollbackText}>
                  最近付款单：{invoiceDetail.latestPaymentEntry}。若本次付款登记有误，可先回退再重新登记。
                </ThemedText>
                <Pressable
                  disabled={isRollingBack}
                  onPress={() => setConfirmRollbackOpen(true)}
                  style={[styles.rollbackButton, { opacity: isRollingBack ? 0.6 : 1 }]}>
                  <ThemedText style={styles.rollbackButtonText} type="defaultSemiBold">
                    {isRollingBack ? '回退中...' : '回退最近付款'}
                  </ThemedText>
                </Pressable>
              </View>
            ) : null}
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
                  当前建议付款为 {formatMoney(expectedAmount, invoiceDetail?.currency || 'CNY')}，你填写的是{' '}
                  {formatMoney(normalizedAmount, invoiceDetail?.currency || 'CNY')}。
                </ThemedText>
              </View>
            ) : null}
          </View>

          <View style={styles.field}>
            <ThemedText style={styles.label} type="defaultSemiBold">
              付款方式
            </ThemedText>
            <View style={styles.featuredModeGrid}>
              {featuredModeOptions.map((option) => {
                const selected = modeOfPayment === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setModeOfPayment(option.value)}
                    style={[styles.featuredModeChip, selected ? styles.featuredModeChipActive : null]}>
                    <ThemedText
                      style={selected ? styles.featuredModeChipTextActive : styles.featuredModeChipText}
                      type="defaultSemiBold">
                      {getModeOfPaymentLabel(option.value)}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
            <ThemedText style={styles.extraModeLabel} type="defaultSemiBold">
              额外支付方式
            </ThemedText>
            <Pressable onPress={() => setModePickerOpen(true)} style={[styles.selectorInput, { borderColor }]}> 
              <ThemedText
                style={modeOfPayment ? styles.selectorValue : styles.selectorPlaceholder}
                type={modeOfPayment ? 'defaultSemiBold' : 'default'}>
                {modeOfPayment ? getModeOfPaymentLabel(modeOfPayment) : '选择付款方式'}
              </ThemedText>
              <ThemedText style={styles.selectorAction} type="defaultSemiBold">
                选择
              </ThemedText>
            </Pressable>
            <ThemedText style={styles.selectorHelper}>
              常用方式可直接点选；其他方式请从“额外支付方式”中选择。
            </ThemedText>
          </View>

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
                付款方式为 {modeOfPayment.trim() ? getModeOfPaymentLabel(modeOfPayment.trim()) : '未指定'}。
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
        onRequestClose={() => setConfirmRollbackOpen(false)}
        transparent
        visible={confirmRollbackOpen}>
        <View style={styles.dialogBackdrop}>
          <View style={styles.dialogCard}>
            <ThemedText style={styles.dialogTitle} type="defaultSemiBold">
              回退最近付款？
            </ThemedText>
            <ThemedText style={styles.dialogMessage}>
              将回退付款单 {invoiceDetail?.latestPaymentEntry || '未知'}。回退后可重新登记正确付款。
            </ThemedText>
            <View style={styles.dialogActions}>
              <Pressable onPress={() => setConfirmRollbackOpen(false)} style={styles.dialogGhostButton}>
                <ThemedText style={styles.dialogGhostText} type="defaultSemiBold">
                  先不回退
                </ThemedText>
              </Pressable>
              <Pressable onPress={() => void rollbackLatestPayment()} style={styles.dialogDangerButton}>
                <ThemedText style={styles.dialogPrimaryText} type="defaultSemiBold">
                  确认回退
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

      <Modal
        animationType="slide"
        onRequestClose={() => setModePickerOpen(false)}
        transparent
        visible={modePickerOpen}>
        <View style={styles.dialogBackdrop}>
          <View style={styles.pickerCard}>
            <ThemedText style={styles.pickerTitle} type="defaultSemiBold">
              选择付款方式
            </ThemedText>
            <TextInput
              onChangeText={setModeQuery}
              placeholder="搜索付款方式"
              placeholderTextColor="#9CA3AF"
              style={[styles.input, styles.pickerSearchInput]}
              value={modeQuery}
            />
            <ScrollView contentContainerStyle={styles.pickerList} style={styles.pickerScroll}>
              {(extraModeOptions.length ? extraModeOptions : modeOptions).map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    setModeOfPayment(option.value);
                    setModePickerOpen(false);
                    setModeQuery('');
                  }}
                  style={[styles.pickerOption, modeOfPayment === option.value ? styles.pickerOptionActive : null]}>
                  <ThemedText style={styles.pickerOptionText} type="defaultSemiBold">
                    {getModeOfPaymentLabel(option.label)}
                  </ThemedText>
                  <ThemedText style={styles.pickerOptionAction} type="defaultSemiBold">
                    {modeOfPayment === option.value ? '已选' : '选择'}
                  </ThemedText>
                </Pressable>
              ))}
              {!modeOptions.length ? (
                <ThemedText style={styles.emptyPickerText}>未找到可用付款方式</ThemedText>
              ) : null}
            </ScrollView>
            <Pressable onPress={() => setModePickerOpen(false)} style={styles.dialogGhostButton}>
              <ThemedText style={styles.dialogGhostText} type="defaultSemiBold">
                关闭
              </ThemedText>
            </Pressable>
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
  rollbackCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rollbackTitle: {
    color: '#991B1B',
    fontSize: 14,
  },
  rollbackText: {
    color: '#7F1D1D',
    fontSize: 12,
    lineHeight: 18,
  },
  rollbackButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: 12,
  },
  rollbackButtonText: {
    color: '#B91C1C',
    fontSize: 13,
  },
  field: {
    flex: 1,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
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
  featuredModeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  featuredModeChip: {
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  featuredModeChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  featuredModeChipText: {
    color: '#1D4ED8',
    fontSize: 13,
  },
  featuredModeChipTextActive: {
    color: '#FFFFFF',
    fontSize: 13,
  },
  extraModeLabel: {
    fontSize: 13,
  },
  selectorInput: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 14,
  },
  selectorPlaceholder: {
    color: '#94A3B8',
    fontSize: 15,
  },
  selectorValue: {
    color: '#0F172A',
    fontSize: 15,
  },
  selectorAction: {
    color: '#2563EB',
    fontSize: 14,
  },
  selectorHelper: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
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
  dialogDangerButton: {
    alignItems: 'center',
    backgroundColor: '#DC2626',
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
  pickerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    gap: 12,
    maxHeight: '70%',
    padding: 18,
    width: '100%',
  },
  pickerTitle: {
    fontSize: 17,
  },
  pickerSearchInput: {
    backgroundColor: '#F8FAFC',
    borderColor: '#D7DEE7',
  },
  pickerScroll: {
    maxHeight: 320,
  },
  pickerList: {
    gap: 8,
    paddingBottom: 4,
  },
  pickerOption: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderColor: '#D7DEE7',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  pickerOptionActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
  },
  pickerOptionText: {
    color: '#0F172A',
    fontSize: 14,
  },
  pickerOptionAction: {
    color: '#2563EB',
    fontSize: 13,
  },
  emptyPickerText: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
  },
});
