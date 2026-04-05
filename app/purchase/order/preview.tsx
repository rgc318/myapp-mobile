import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { ThemedText } from '@/components/themed-text';

export default function PurchaseOrderPreviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ purchaseOrder?: string }>();
  const orderName = typeof params.purchaseOrder === 'string' ? params.purchaseOrder.trim() : '';

  useEffect(() => {
    if (!orderName) {
      return;
    }

    router.replace({
      pathname: '/purchase/order/pdf-viewer',
      params: {
        purchaseOrder: orderName,
        template: 'standard',
      },
    });
  }, [orderName, router]);

  return (
    <AppShell
      title="打印预览"
      description="正在为你打开正式版 PDF 预览。"
      footer={null}>
      <View style={styles.loadingWrap}>
        <ActivityIndicator color="#2563EB" />
        <ThemedText style={styles.loadingText}>正在加载正式打印文档...</ThemedText>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  loadingText: {
    color: '#64748B',
    fontSize: 14,
  },
  loadingWrap: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 40,
  },
});
