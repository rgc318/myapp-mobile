import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { AppShell } from '@/components/app-shell';
import { ThemedText } from '@/components/themed-text';
import { StyleSheet, View } from 'react-native';
import { useFeedback } from '@/providers/feedback-provider';

export default function SalesDeliveryCreateScreen() {
  const params = useLocalSearchParams<{ orderName?: string; deliveryNote?: string; notice?: string }>();
  const { showSuccess } = useFeedback();

  useEffect(() => {
    if (params.notice === 'created' && typeof params.deliveryNote === 'string' && params.deliveryNote.trim()) {
      showSuccess(`已生成发货单：${params.deliveryNote.trim()}`);
    }
  }, [params.deliveryNote, params.notice, showSuccess]);

  return (
    <AppShell title="销售发货" description="当前已支持从订单页直接发货，发货成功后会带着生成的发货单号跳转到这里。">
      <View style={styles.card}>
        <ThemedText style={styles.label} type="defaultSemiBold">
          来源订单
        </ThemedText>
        <ThemedText style={styles.value}>{params.orderName || '未传入'}</ThemedText>

        <ThemedText style={styles.label} type="defaultSemiBold">
          发货单号
        </ThemedText>
        <ThemedText style={styles.value}>{params.deliveryNote || '尚未生成'}</ThemedText>

        <ThemedText style={styles.hint}>
          这里后续会继续补成真正的发货单详情/处理页；当前先作为订单出货后的确认落点。
        </ThemedText>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
  },
  label: {
    fontSize: 14,
  },
  value: {
    color: '#0F172A',
    fontSize: 16,
  },
  hint: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },
});
