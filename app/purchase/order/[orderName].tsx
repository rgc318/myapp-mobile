import { useLocalSearchParams } from 'expo-router';

import { AppShell } from '@/components/app-shell';
import { ThemedText } from '@/components/themed-text';

export default function PurchaseOrderDetailScreen() {
  const { orderName } = useLocalSearchParams<{ orderName: string }>();

  return (
    <AppShell title="采购订单详情" description="这里先验证动态路由，后续展示采购订单详情和后续动作。">
      <ThemedText type="defaultSemiBold">订单号</ThemedText>
      <ThemedText>{orderName}</ThemedText>
    </AppShell>
  );
}
