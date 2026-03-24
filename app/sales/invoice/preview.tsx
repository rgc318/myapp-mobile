import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { SalesInvoiceSheet } from '@/components/sales-invoice-sheet';
import { ThemedText } from '@/components/themed-text';
import { useFeedback } from '@/providers/feedback-provider';
import { getSalesInvoiceDetailV2, type SalesInvoiceDetailV2 } from '@/services/sales';

export default function SalesInvoicePreviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ salesInvoice?: string }>();
  const invoiceName = typeof params.salesInvoice === 'string' ? params.salesInvoice.trim() : '';
  const { showError, showInfo } = useFeedback();
  const [detail, setDetail] = useState<SalesInvoiceDetailV2 | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!invoiceName) {
        setDetail(null);
        return;
      }

      try {
        setIsLoading(true);
        const nextDetail = await getSalesInvoiceDetailV2(invoiceName);
        if (active) {
          setDetail(nextDetail);
        }
      } catch (error) {
        if (active) {
          setDetail(null);
        }
        showError(error instanceof Error ? error.message : '打印预览加载失败。');
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [invoiceName, showError]);

  function handlePrint() {
    showInfo('系统打印正在接入，当前先提供预览页骨架。');
  }

  return (
    <AppShell
      title="打印预览"
      description="先核对发票版式和关键字段，后续这里将承接系统打印、分享 PDF 和补打。"
      footer={
        <View style={styles.footerRow}>
          <Pressable
            onPress={() =>
              router.replace({
                pathname: '/sales/invoice/create',
                params: invoiceName ? { salesInvoice: invoiceName } : undefined,
              })
            }
            style={[styles.footerButton, styles.footerGhostButton]}>
            <ThemedText style={styles.footerGhostText} type="defaultSemiBold">
              返回发票
            </ThemedText>
          </Pressable>
          <Pressable onPress={handlePrint} style={[styles.footerButton, styles.footerPrimaryButton]}>
            <ThemedText style={styles.footerPrimaryText} type="defaultSemiBold">
              调起打印
            </ThemedText>
          </Pressable>
        </View>
      }>
      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#2563EB" />
          <ThemedText style={styles.loadingText}>正在生成预览...</ThemedText>
        </View>
      ) : detail ? (
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <SalesInvoiceSheet detail={detail} />
        </ScrollView>
      ) : (
        <View style={styles.emptyCard}>
          <ThemedText style={styles.emptyText}>未找到可预览的销售发票，请返回详情页后重试。</ThemedText>
        </View>
      )}
    </AppShell>
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
  footerPrimaryButton: {
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 16,
    justifyContent: 'center',
    minHeight: 48,
  },
  footerGhostText: {
    color: '#1D4ED8',
  },
  footerPrimaryText: {
    color: '#FFFFFF',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D7DEE7',
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 22,
  },
});
