import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { PreferenceSummary } from '@/components/preference-summary';
import { ThemedText } from '@/components/themed-text';
import { createSalesInvoice } from '@/services/gateway';
import { getAppPreferences } from '@/lib/app-preferences';

export default function SalesInvoiceCreateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sourceName?: string; salesInvoice?: string }>();
  const preferences = getAppPreferences();
  const [sourceName, setSourceName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (typeof params.sourceName === 'string' && params.sourceName.trim()) {
      setSourceName(params.sourceName.trim());
    }
    if (typeof params.salesInvoice === 'string' && params.salesInvoice.trim()) {
      setMessage(`已生成销售发票：${params.salesInvoice.trim()}`);
    }
  }, [params.salesInvoice, params.sourceName]);

  async function handleSubmit() {
    const trimmedSource = sourceName.trim();
    if (!trimmedSource) {
      setMessage('请输入销售订单号。');
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await createSalesInvoice({
        source_name: trimmedSource,
        due_date: dueDate.trim() || undefined,
        remarks: remarks.trim() || undefined,
      });
      const invoiceName = String(result?.sales_invoice || result?.name || '');
      setMessage(invoiceName ? `销售发票已创建：${invoiceName}` : '销售发票已创建。');
      if (invoiceName) {
        router.replace('/(tabs)/docs');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '销售发票创建失败。');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppShell
      title="销售开票"
      description="根据已存在的销售订单生成销售发票，适合作为后续结算与收款依据。">
      <PreferenceSummary title="当前销售模式" modeLabel={preferences.salesFlowMode === 'quick' ? '快捷结算' : '分步处理'} />

      <View style={styles.formCard}>
        <View style={styles.fieldBlock}>
          <ThemedText style={styles.label} type="defaultSemiBold">销售订单号</ThemedText>
          <TextInput
            onChangeText={setSourceName}
            placeholder="例如 SAL-ORD-2026-00089"
            placeholderTextColor="#9CA3AF"
            style={styles.input}
            value={sourceName}
          />
        </View>

        <View style={styles.fieldBlock}>
          <ThemedText style={styles.label} type="defaultSemiBold">到期日期</ThemedText>
          <TextInput
            onChangeText={setDueDate}
            placeholder="YYYY-MM-DD，可留空"
            placeholderTextColor="#9CA3AF"
            style={styles.input}
            value={dueDate}
          />
        </View>

        <View style={styles.fieldBlock}>
          <ThemedText style={styles.label} type="defaultSemiBold">备注</ThemedText>
          <TextInput
            multiline
            numberOfLines={4}
            onChangeText={setRemarks}
            placeholder="可补充开票说明"
            placeholderTextColor="#9CA3AF"
            style={styles.textarea}
            textAlignVertical="top"
            value={remarks}
          />
        </View>

        <Pressable onPress={() => void handleSubmit()} style={styles.primaryButton}>
          <ThemedText style={styles.primaryButtonText} type="defaultSemiBold">
            {isSubmitting ? '开票中...' : '创建销售发票'}
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
  textarea: {
    borderColor: '#D7DEE7',
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 100,
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
