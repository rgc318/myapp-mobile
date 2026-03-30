import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { ThemedText } from '@/components/themed-text';
import { useFeedback } from '@/providers/feedback-provider';
import { formatCurrencyValue } from '@/lib/display-currency';
import { sanitizeDecimalInput } from '@/lib/numeric-input';
import { rememberPaymentResultHandoff } from '@/lib/payment-result-handoff';
import { recordSalesPayment } from '@/services/gateway';
import { getSalesInvoiceDetailV2, type SalesInvoiceDetailV2 } from '@/services/sales';
import { checkLinkOptionExists, searchLinkOptions, type LinkOption } from '@/services/master-data';

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

export default function SalesPaymentCreateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    referenceName?: string;
    salesInvoice?: string;
    defaultPaidAmount?: string;
    amount?: string;
    currency?: string;
  }>();
  const { showError } = useFeedback();
  const [referenceName, setReferenceName] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [modeOfPayment, setModeOfPayment] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [referenceDate, setReferenceDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suggestedAmount, setSuggestedAmount] = useState<number | null>(null);
  const [confirmMismatchOpen, setConfirmMismatchOpen] = useState(false);
  const [modePickerOpen, setModePickerOpen] = useState(false);
  const [modeQuery, setModeQuery] = useState('');
  const [modeOptions, setModeOptions] = useState<LinkOption[]>([]);
  const [amountAutoCorrectHint, setAmountAutoCorrectHint] = useState('');
  const [resultDialog, setResultDialog] = useState<ResultDialogState>(null);
  const [settlementMode, setSettlementMode] = useState<'partial' | 'writeoff'>('partial');
  const [invoiceDetail, setInvoiceDetail] = useState<SalesInvoiceDetailV2 | null>(null);
  const [isLoadingInvoiceDetail, setIsLoadingInvoiceDetail] = useState(false);
  const currency = typeof params.currency === 'string' && params.currency.trim() ? params.currency.trim() : 'CNY';
  const featuredModeOptions = modeOptions.filter((option, index, array) => {
    if (!isFeaturedMode(option.value)) {
      return false;
    }

    return array.findIndex((candidate) => getModeOfPaymentLabel(candidate.value) === getModeOfPaymentLabel(option.value)) === index;
  });
  const extraModeOptions = modeOptions.filter((option) => !isFeaturedMode(option.value));
  const currentPaidAmount = Number(paidAmount);
  const isAmountDifferent =
    suggestedAmount !== null &&
    Number.isFinite(currentPaidAmount) &&
    currentPaidAmount > 0 &&
    Math.abs(currentPaidAmount - suggestedAmount) > 0.0001;
  const isUnderpaidAgainstReceivable =
    suggestedAmount !== null &&
    Number.isFinite(currentPaidAmount) &&
    currentPaidAmount > 0 &&
    currentPaidAmount < suggestedAmount;
  const isOverpaidAgainstReceivable =
    suggestedAmount !== null &&
    Number.isFinite(currentPaidAmount) &&
    currentPaidAmount > 0 &&
    currentPaidAmount > suggestedAmount;
  const paymentSourceName =
    typeof params.salesInvoice === 'string' && params.salesInvoice.trim()
      ? params.salesInvoice.trim()
      : typeof params.referenceName === 'string' && params.referenceName.trim()
        ? params.referenceName.trim()
        : '';
  const normalizedPaidAmount =
    Number.isFinite(currentPaidAmount) && currentPaidAmount > 0 ? currentPaidAmount : 0;
  const returnToSourcePage = () => {
    if (paymentSourceName) {
      router.replace({
        pathname: '/sales/invoice/create',
        params: { salesInvoice: paymentSourceName },
      });
      return;
    }

    router.replace('/(tabs)/sales');
  };

  useEffect(() => {
    const nextReferenceName =
      typeof params.referenceName === 'string' && params.referenceName.trim()
        ? params.referenceName.trim()
        : typeof params.salesInvoice === 'string' && params.salesInvoice.trim()
          ? params.salesInvoice.trim()
          : '';
    if (nextReferenceName) {
      setReferenceName(nextReferenceName);
    }
    const nextDefaultAmount =
      typeof params.defaultPaidAmount === 'string' && params.defaultPaidAmount.trim()
        ? params.defaultPaidAmount
        : typeof params.amount === 'string' && params.amount.trim()
          ? params.amount
          : '';
    if (nextDefaultAmount) {
      const amount = Number(nextDefaultAmount);
      if (Number.isFinite(amount) && amount > 0) {
        setSuggestedAmount(amount);
        setPaidAmount(String(amount));
      }
    }
  }, [params.amount, params.defaultPaidAmount, params.referenceName, params.salesInvoice]);

  useEffect(() => {
    let cancelled = false;

    async function loadInvoiceDetail() {
      if (!paymentSourceName) {
        setInvoiceDetail(null);
        return;
      }

      try {
        setIsLoadingInvoiceDetail(true);
        const detail = await getSalesInvoiceDetailV2(paymentSourceName);
        if (!cancelled) {
          setInvoiceDetail(detail);
        }
      } catch {
        if (!cancelled) {
          setInvoiceDetail(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingInvoiceDetail(false);
        }
      }
    }

    void loadInvoiceDetail();

    return () => {
      cancelled = true;
    };
  }, [paymentSourceName]);

  useEffect(() => {
    let cancelled = false;

    void searchLinkOptions('Mode of Payment', '').then((options) => {
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

    void searchLinkOptions('Mode of Payment', modeQuery).then((options) => {
      if (!cancelled) {
        setModeOptions(options);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [modePickerOpen, modeQuery]);

  async function submitPayment() {
    const trimmedReference = referenceName.trim();
    const amount = Number(paidAmount);
    const trimmedModeOfPayment = modeOfPayment.trim();

    if (!trimmedReference) {
      showError('请输入销售发票号。');
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      showError('请输入有效的实收金额。');
      return;
    }

    if (!trimmedModeOfPayment) {
      showError('请选择付款方式。');
      return;
    }

    const modeExists = await checkLinkOptionExists('Mode of Payment', trimmedModeOfPayment);
    if (!modeExists) {
      showError(`找不到付款方式：${trimmedModeOfPayment}`);
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await recordSalesPayment({
        reference_doctype: 'Sales Invoice',
        reference_name: trimmedReference,
        paid_amount: amount,
        mode_of_payment: trimmedModeOfPayment,
        reference_no: referenceNo.trim() || undefined,
        reference_date: referenceDate.trim() || undefined,
        settlement_mode: suggestedAmount !== null && amount < suggestedAmount ? settlementMode : 'partial',
        writeoff_reason:
          suggestedAmount !== null && amount < suggestedAmount && settlementMode === 'writeoff'
            ? '移动端优惠/抹零结清'
            : undefined,
      });
      const paymentName = String(result?.payment_entry || result?.name || '');
      const writeoffAmount = Number(result?.writeoff_amount);
      const unallocatedAmount = Number(result?.unallocated_amount);
      rememberPaymentResultHandoff({
        invoiceName: trimmedReference,
        paymentEntry: paymentName || undefined,
        writeoffAmount: Number.isFinite(writeoffAmount) ? writeoffAmount : undefined,
        unallocatedAmount: Number.isFinite(unallocatedAmount) ? unallocatedAmount : undefined,
        paidAmount: amount,
        currency,
      });
      setResultDialog({
        tone: 'success',
        title: '收款登记成功',
        message:
          settlementMode === 'writeoff' && Number.isFinite(writeoffAmount) && writeoffAmount > 0
            ? `本次收款已登记成功，收款单号为 ${paymentName || '已生成'}，并已按差额核销 ${formatCurrencyValue(writeoffAmount, currency)}。`
            : Number.isFinite(unallocatedAmount) && unallocatedAmount > 0
              ? `本次收款已登记成功，收款单号为 ${paymentName || '已生成'}，超出应收的 ${formatCurrencyValue(unallocatedAmount, currency)} 已按未分配金额保留。`
            : paymentName
              ? `本次收款已登记成功，收款单号为 ${paymentName}。`
              : '本次收款已登记成功。',
        confirmLabel: '返回来源页',
        onConfirm: () => {
          setResultDialog(null);
          returnToSourcePage();
        },
      });
    } catch (error) {
      setResultDialog({
        tone: 'error',
        title: '收款登记失败',
        message: error instanceof Error ? error.message : '销售收款登记失败。',
        confirmLabel: '继续处理',
        onConfirm: () => {
          setResultDialog(null);
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSubmit() {
    const amount = Number(paidAmount);

    if (
      suggestedAmount !== null &&
      Number.isFinite(amount) &&
      amount > 0 &&
      Math.abs(amount - suggestedAmount) > 0.0001
    ) {
      setConfirmMismatchOpen(true);
      return;
    }

    void submitPayment();
  }

  return (
    <AppShell
      title="销售收款"
      description="根据销售发票登记客户实收金额，作为后续对账和结算依据。"
      footer={
        <View style={styles.footerRow}>
          <Pressable
            onPress={returnToSourcePage}
            style={[styles.footerButton, styles.footerGhostButton]}>
            <ThemedText style={styles.footerGhostText} type="defaultSemiBold">
              返回来源页
            </ThemedText>
          </Pressable>
          <Pressable onPress={handleSubmit} style={[styles.footerButton, styles.primaryFooterButton]}>
            <ThemedText style={styles.primaryButtonText} type="defaultSemiBold">
              {isSubmitting ? '登记中...' : '登记收款'}
            </ThemedText>
          </Pressable>
        </View>
      }>
      <View style={styles.formCard}>
        {isLoadingInvoiceDetail ? (
          <View style={styles.confirmationLoadingCard}>
            <ActivityIndicator color="#2563EB" />
            <ThemedText style={styles.confirmationLoadingText}>正在加载发票收款摘要...</ThemedText>
          </View>
        ) : invoiceDetail ? (
          <View style={styles.confirmationCard}>
            <ThemedText style={styles.confirmationTitle} type="subtitle">
              收款确认
            </ThemedText>

            <ThemedText style={styles.confirmationMetaLine}>
              {`来源发票 ${invoiceDetail.name}`}
            </ThemedText>
            <View style={styles.confirmationCustomerCard}>
              <ThemedText style={styles.confirmationLabel}>客户</ThemedText>
              <ThemedText style={styles.confirmationCustomerValue} type="defaultSemiBold">
                {invoiceDetail.customer || '未配置'}
              </ThemedText>
            </View>

            <View style={styles.paymentSummaryGrid}>
              <View style={styles.paymentSummaryCell}>
                <ThemedText style={styles.confirmationLabel}>发票金额</ThemedText>
                <ThemedText style={styles.paymentSummaryValue} type="defaultSemiBold">
                  {formatCurrencyValue(invoiceDetail.receivableAmount ?? invoiceDetail.grandTotal, invoiceDetail.currency)}
                </ThemedText>
              </View>
              <View style={styles.paymentSummaryCell}>
                <ThemedText style={styles.confirmationLabel}>已收金额</ThemedText>
                <ThemedText style={[styles.paymentSummaryValue, styles.positiveText]} type="defaultSemiBold">
                  {formatCurrencyValue(invoiceDetail.actualPaidAmount, invoiceDetail.currency)}
                </ThemedText>
              </View>
              <View style={styles.paymentSummaryCell}>
                <ThemedText style={styles.confirmationLabel}>当前未收</ThemedText>
                <ThemedText
                  style={[
                    styles.paymentSummaryValue,
                    (invoiceDetail.outstandingAmount ?? 0) > 0 ? styles.warningTextStrong : styles.mutedText,
                  ]}
                  type="defaultSemiBold">
                  {formatCurrencyValue(invoiceDetail.outstandingAmount, invoiceDetail.currency)}
                </ThemedText>
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.fieldBlock}>
          <ThemedText style={styles.label} type="defaultSemiBold">销售发票号</ThemedText>
          <TextInput
            onChangeText={setReferenceName}
            placeholder="例如 ACC-SINV-2026-00006"
            placeholderTextColor="#9CA3AF"
            style={styles.input}
            value={referenceName}
          />
        </View>

        {suggestedAmount !== null ? (
          <View style={styles.helperCard}>
            <ThemedText style={styles.helperTitle} type="defaultSemiBold">
              应收金额
            </ThemedText>
            <ThemedText style={styles.helperAmount} type="defaultSemiBold">
              {formatCurrencyValue(suggestedAmount, currency)}
            </ThemedText>
            <ThemedText style={styles.helperText}>
              大部分情况下实收金额和订单未收金额一致，系统已带入当前未收金额；如果实际到账不一致，再手动修改下面的实收金额。
            </ThemedText>
          </View>
        ) : null}

        <View style={styles.fieldBlock}>
          <ThemedText style={styles.label} type="defaultSemiBold">本次实收金额</ThemedText>
          <TextInput
            keyboardType="decimal-pad"
            onChangeText={(value) => {
              const sanitized = sanitizeDecimalInput(value);
              setAmountAutoCorrectHint('');
              if (!sanitized) {
                setPaidAmount('');
                return;
              }

              const amount = Number(sanitized);
              if (!Number.isFinite(amount)) {
                setPaidAmount(sanitized);
                return;
              }

              setPaidAmount(sanitized);
            }}
            placeholder={suggestedAmount !== null ? '已带入当前未收金额' : '输入金额'}
            placeholderTextColor="#9CA3AF"
            style={styles.input}
            value={paidAmount}
          />
          {amountAutoCorrectHint ? (
            <View style={styles.autoCorrectHintCard}>
              <ThemedText style={styles.autoCorrectHintTitle} type="defaultSemiBold">
                已自动修正金额
              </ThemedText>
              <ThemedText style={styles.autoCorrectHintText}>
                {amountAutoCorrectHint}
              </ThemedText>
            </View>
          ) : null}
          {isAmountDifferent ? (
            <View style={styles.warningCard}>
              <ThemedText style={styles.warningTitle} type="defaultSemiBold">
                修改实收金额会影响结算结果
              </ThemedText>
              <ThemedText style={styles.warningText}>
                当前应收金额为 {formatCurrencyValue(suggestedAmount, currency)}，你当前填写的是 {formatCurrencyValue(currentPaidAmount, currency)}。
                {isOverpaidAgainstReceivable
                  ? ' 超出应收金额的部分会作为未分配金额保留，适用于客户预收或多付场景。'
                  : ' 实收金额少于应收金额时，可选择保留未收金额，或按优惠/抹零直接结清。'}
              </ThemedText>
            </View>
          ) : suggestedAmount !== null ? (
            <View style={styles.ruleHintCard}>
              <ThemedText style={styles.ruleHintTitle} type="defaultSemiBold">
                金额填写规则
              </ThemedText>
              <ThemedText style={styles.ruleHintText}>
                本次实收金额可以少于、等于或大于应收金额 {formatCurrencyValue(suggestedAmount, currency)}；少收时可保留未收或直接核销结清，多收时超出部分会作为未分配金额保留。
              </ThemedText>
            </View>
          ) : null}
        </View>

        {isUnderpaidAgainstReceivable ? (
          <View style={styles.fieldBlock}>
            <ThemedText style={styles.label} type="defaultSemiBold">差额处理方式</ThemedText>
            <View style={styles.settlementModeGrid}>
              <Pressable
                onPress={() => setSettlementMode('partial')}
                style={[
                  styles.settlementModeCard,
                  settlementMode === 'partial' ? styles.settlementModeCardActive : null,
                ]}>
                <ThemedText
                  style={settlementMode === 'partial' ? styles.settlementModeTitleActive : styles.settlementModeTitle}
                  type="defaultSemiBold">
                  作为部分收款
                </ThemedText>
                <ThemedText style={styles.settlementModeText}>
                  保留剩余未收金额，后续继续收款。
                </ThemedText>
              </Pressable>

              <Pressable
                onPress={() => setSettlementMode('writeoff')}
                style={[
                  styles.settlementModeCard,
                  settlementMode === 'writeoff' ? styles.settlementModeCardActiveDanger : null,
                ]}>
                <ThemedText
                  style={settlementMode === 'writeoff' ? styles.settlementModeTitleDanger : styles.settlementModeTitle}
                  type="defaultSemiBold">
                  优惠/抹零后结清
                </ThemedText>
                <ThemedText style={styles.settlementModeText}>
                  将剩余差额按核销处理，本次直接结清发票。
                </ThemedText>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.fieldBlock}>
          <ThemedText style={styles.label} type="defaultSemiBold">付款方式</ThemedText>
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
          <Pressable onPress={() => setModePickerOpen(true)} style={styles.selectorInput}>
            <ThemedText style={modeOfPayment ? styles.selectorValue : styles.selectorPlaceholder} type={modeOfPayment ? 'defaultSemiBold' : 'default'}>
              {modeOfPayment ? getModeOfPaymentLabel(modeOfPayment) : '选择付款方式'}
            </ThemedText>
            <ThemedText style={styles.selectorAction} type="defaultSemiBold">
              选择
            </ThemedText>
          </Pressable>
          <ThemedText style={styles.selectorHelper}>
            常用方式可直接点选；如需其他方式，请从额外支付方式中选择 ERPNext 已配置项。
          </ThemedText>
        </View>

        {modeOfPayment ? (
          <View style={styles.submitHintCard}>
            <ThemedText style={styles.submitHintTitle} type="defaultSemiBold">
              提交前确认
            </ThemedText>
            <ThemedText style={styles.submitHintText}>
              即将为发票 {paymentSourceName || '未指定发票'} 登记 {formatCurrencyValue(normalizedPaidAmount || null, currency)}，
              付款方式为 {getModeOfPaymentLabel(modeOfPayment)}。
            </ThemedText>
          </View>
        ) : null}

        {invoiceDetail ? (
          <View style={styles.contactCard}>
            <ThemedText style={styles.contactCardTitle} type="defaultSemiBold">
              客户与收款补充
            </ThemedText>
            <View style={styles.confirmationRow}>
              <ThemedText style={styles.confirmationMetaLabel}>收货联系人</ThemedText>
              <ThemedText style={styles.confirmationMetaValue}>
                {invoiceDetail.contactDisplay || '未配置'}
              </ThemedText>
            </View>
            <View style={styles.confirmationRowBlock}>
              <ThemedText style={styles.confirmationMetaLabel}>收货地址</ThemedText>
              <ThemedText style={styles.confirmationMetaValue}>
                {invoiceDetail.addressDisplay || '未配置收货地址'}
              </ThemedText>
            </View>
          </View>
        ) : null}

        <View style={styles.fieldBlock}>
          <ThemedText style={styles.label} type="defaultSemiBold">参考单号</ThemedText>
          <TextInput
            onChangeText={setReferenceNo}
            placeholder="可选"
            placeholderTextColor="#9CA3AF"
            style={styles.input}
            value={referenceNo}
          />
        </View>

        <View style={styles.fieldBlock}>
          <ThemedText style={styles.label} type="defaultSemiBold">参考日期</ThemedText>
          <TextInput
            onChangeText={setReferenceDate}
            placeholder="YYYY-MM-DD，可选"
            placeholderTextColor="#9CA3AF"
            style={styles.input}
            value={referenceDate}
          />
        </View>

      </View>

      <Modal
        animationType="fade"
        onRequestClose={() => setConfirmMismatchOpen(false)}
        transparent
        visible={confirmMismatchOpen}>
        <View style={styles.dialogBackdrop}>
          <View style={styles.dialogCard}>
            <ThemedText style={styles.dialogTitle} type="defaultSemiBold">
              确认本次实收金额？
            </ThemedText>
            <ThemedText style={styles.dialogMessage}>
              当前默认应收金额为{' '}
              <ThemedText style={styles.dialogEmphasis} type="defaultSemiBold">
                {formatCurrencyValue(suggestedAmount, currency)}
              </ThemedText>
              ，你填写的本次实收金额为{' '}
              <ThemedText style={styles.dialogEmphasis} type="defaultSemiBold">
                {formatCurrencyValue(Number(paidAmount) || 0, currency)}
              </ThemedText>
              。
              {isOverpaidAgainstReceivable
                ? ' 如果继续登记，超出应收金额的部分将作为未分配金额保留。'
                : ' 如果这是部分收款、折让或其他特殊情况，请确认后继续。'}
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
                  确认收款
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
            <ThemedText style={styles.dialogMessage}>
              {resultDialog?.message}
            </ThemedText>
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
              style={styles.input}
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
                  style={[
                    styles.pickerOption,
                    modeOfPayment === option.value ? styles.pickerOptionActive : null,
                  ]}>
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
  formCard: {
    gap: 16,
  },
  confirmationLoadingCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D7DEE7',
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  confirmationLoadingText: {
    color: '#64748B',
    fontSize: 14,
  },
  confirmationCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D7DEE7',
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
    padding: 16,
  },
  confirmationTitle: {
    color: '#0F172A',
    fontSize: 18,
  },
  confirmationLabel: {
    color: '#64748B',
    fontSize: 13,
  },
  confirmationValue: {
    color: '#0F172A',
    fontSize: 16,
  },
  confirmationMetaLine: {
    color: '#64748B',
    fontSize: 13,
  },
  confirmationCustomerCard: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  confirmationCustomerValue: {
    color: '#0F172A',
    fontSize: 18,
  },
  confirmationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  confirmationRowBlock: {
    gap: 8,
  },
  confirmationMetaLabel: {
    color: '#64748B',
    fontSize: 14,
  },
  confirmationMetaValue: {
    color: '#0F172A',
    flex: 1,
    fontSize: 15,
    textAlign: 'right',
  },
  paymentSummaryGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  paymentSummaryCell: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  paymentSummaryValue: {
    color: '#0F172A',
    fontSize: 18,
  },
  fieldBlock: {
    gap: 8,
  },
  label: {
    fontSize: 14,
  },
  helperCard: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  helperTitle: {
    color: '#1D4ED8',
    fontSize: 14,
  },
  helperAmount: {
    color: '#0F172A',
    fontSize: 20,
  },
  helperText: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 20,
  },
  autoCorrectHintCard: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  autoCorrectHintTitle: {
    color: '#B45309',
    fontSize: 14,
  },
  autoCorrectHintText: {
    color: '#78350F',
    fontSize: 13,
    lineHeight: 20,
  },
  warningCard: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FDBA74',
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  warningTitle: {
    color: '#C2410C',
    fontSize: 14,
  },
  warningText: {
    color: '#7C2D12',
    fontSize: 13,
    lineHeight: 20,
  },
  ruleHintCard: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  ruleHintTitle: {
    color: '#334155',
    fontSize: 14,
  },
  ruleHintText: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 20,
  },
  settlementModeGrid: {
    gap: 10,
  },
  settlementModeCard: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  settlementModeCardActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  settlementModeCardActiveDanger: {
    backgroundColor: '#FFF7ED',
    borderColor: '#EA580C',
  },
  settlementModeTitle: {
    color: '#0F172A',
    fontSize: 14,
  },
  settlementModeTitleActive: {
    color: '#1D4ED8',
    fontSize: 14,
  },
  settlementModeTitleDanger: {
    color: '#C2410C',
    fontSize: 14,
  },
  settlementModeText: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 20,
  },
  input: {
    borderColor: '#D7DEE7',
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  primaryButtonText: {
    color: '#FFFFFF',
  },
  footerRow: {
    flexDirection: 'row',
    gap: 12,
  },
  footerButton: {
    flex: 1,
  },
  footerGhostButton: {
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
  footerGhostText: {
    color: '#1D4ED8',
  },
  primaryFooterButton: {
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 16,
    justifyContent: 'center',
    minHeight: 48,
  },
  selectorInput: {
    alignItems: 'center',
    borderColor: '#D7DEE7',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  featuredModeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  featuredModeChip: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 92,
    paddingHorizontal: 14,
  },
  featuredModeChipActive: {
    backgroundColor: '#DBEAFE',
    borderColor: '#2563EB',
  },
  featuredModeChipText: {
    color: '#334155',
    fontSize: 14,
  },
  featuredModeChipTextActive: {
    color: '#1D4ED8',
    fontSize: 14,
  },
  extraModeLabel: {
    color: '#334155',
    fontSize: 13,
    marginTop: 4,
  },
  selectorValue: {
    color: '#0F172A',
  },
  selectorPlaceholder: {
    color: '#9CA3AF',
  },
  selectorAction: {
    color: '#2563EB',
    fontSize: 13,
  },
  selectorHelper: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 18,
    paddingLeft: 4,
  },
  contactCard: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  contactCardTitle: {
    color: '#334155',
    fontSize: 14,
  },
  submitHintCard: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  submitHintTitle: {
    color: '#334155',
    fontSize: 14,
  },
  submitHintText: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 20,
  },
  positiveText: {
    color: '#15803D',
  },
  warningTextStrong: {
    color: '#B45309',
  },
  infoTextStrong: {
    color: '#1D4ED8',
  },
  mutedText: {
    color: '#64748B',
  },
  dialogBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.36)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  dialogCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    gap: 14,
    maxWidth: 420,
    paddingHorizontal: 20,
    paddingVertical: 20,
    width: '100%',
  },
  dialogTitle: {
    color: '#B45309',
    fontSize: 18,
    lineHeight: 24,
  },
  resultSuccessTitle: {
    color: '#15803D',
  },
  resultErrorTitle: {
    color: '#DC2626',
  },
  dialogMessage: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 22,
  },
  dialogEmphasis: {
    color: '#C2410C',
  },
  dialogActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  dialogGhostButton: {
    alignItems: 'center',
    borderColor: '#D7DEE7',
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
  },
  dialogPrimaryButton: {
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 16,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
  },
  resultSuccessButton: {
    backgroundColor: '#16A34A',
  },
  resultErrorButton: {
    backgroundColor: '#DC2626',
  },
  dialogGhostText: {
    color: '#0F172A',
  },
  dialogPrimaryText: {
    color: '#FFFFFF',
  },
  pickerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    gap: 14,
    maxHeight: '70%',
    maxWidth: 420,
    paddingHorizontal: 20,
    paddingVertical: 20,
    width: '100%',
  },
  pickerTitle: {
    color: '#0F172A',
    fontSize: 18,
  },
  pickerScroll: {
    maxHeight: 280,
  },
  pickerList: {
    gap: 8,
  },
  pickerOption: {
    alignItems: 'center',
    borderColor: '#E2E8F0',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 14,
  },
  pickerOptionActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
  },
  pickerOptionText: {
    color: '#0F172A',
  },
  pickerOptionAction: {
    color: '#2563EB',
    fontSize: 13,
  },
  emptyPickerText: {
    color: '#64748B',
    fontSize: 13,
    paddingVertical: 8,
    textAlign: 'center',
  },
});
