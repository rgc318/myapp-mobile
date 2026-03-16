import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { ThemedText } from '@/components/themed-text';
import { recordSalesPayment } from '@/services/gateway';

export default function SalesPaymentCreateScreen() {
  const [referenceName, setReferenceName] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [modeOfPayment, setModeOfPayment] = useState('现金');
  const [referenceNo, setReferenceNo] = useState('');
  const [referenceDate, setReferenceDate] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    const trimmedReference = referenceName.trim();
    const amount = Number(paidAmount);

    if (!trimmedReference) {
      setMessage('请输入销售发票号。');
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage('请输入有效的实收金额。');
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await recordSalesPayment({
        reference_doctype: 'Sales Invoice',
        reference_name: trimmedReference,
        paid_amount: amount,
        mode_of_payment: modeOfPayment.trim() || undefined,
        reference_no: referenceNo.trim() || undefined,
        reference_date: referenceDate.trim() || undefined,
      });
      const paymentName = String(result?.payment_entry || result?.name || '');
      setMessage(paymentName ? `收款已登记：${paymentName}` : '收款已登记。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '销售收款登记失败。');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppShell title="销售收款" description="根据销售发票登记客户实收金额，作为后续对账和结算依据。">
      <View style={styles.formCard}>
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

        <View style={styles.fieldBlock}>
          <ThemedText style={styles.label} type="defaultSemiBold">本次实收金额</ThemedText>
          <TextInput
            keyboardType="decimal-pad"
            onChangeText={setPaidAmount}
            placeholder="输入金额"
            placeholderTextColor="#9CA3AF"
            style={styles.input}
            value={paidAmount}
          />
        </View>

        <View style={styles.fieldBlock}>
          <ThemedText style={styles.label} type="defaultSemiBold">付款方式</ThemedText>
          <TextInput
            onChangeText={setModeOfPayment}
            placeholder="例如 现金 / 转账 / 微信"
            placeholderTextColor="#9CA3AF"
            style={styles.input}
            value={modeOfPayment}
          />
        </View>

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

        <Pressable onPress={() => void handleSubmit()} style={styles.primaryButton}>
          <ThemedText style={styles.primaryButtonText} type="defaultSemiBold">
            {isSubmitting ? '登记中...' : '登记收款'}
          </ThemedText>
        </Pressable>

        {message ? <ThemedText style={styles.messageText}>{message}</ThemedText> : null}
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  formCard: {
    gap: 16,
  },
  fieldBlock: {
    gap: 8,
  },
  label: {
    fontSize: 14,
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
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 16,
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryButtonText: {
    color: '#FFFFFF',
  },
  messageText: {
    color: '#475569',
    fontSize: 13,
  },
});
