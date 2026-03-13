import type { Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppShell } from '@/components/app-shell';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function HomeScreen() {
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');

  return (
    <AppShell
      title="业务首页"
      description="今天优先处理销售、采购和收付款。先把常用动作放在最前面，减少层级跳转。"
      actions={[
        { href: '/common/product-search' as Href, label: '商品搜索', description: '进入销售前先查商品与价格' },
        { href: '/sales/order/create' as Href, label: '新建销售订单', description: '销售主链路的第一个动作' },
        { href: '/purchase/order/create' as Href, label: '新建采购订单', description: '采购主链路的第一个动作' },
        { href: '/(tabs)/docs' as Href, label: '查看最近单据', description: '后续承接查询和状态跟踪' },
      ]}>
      <View style={[styles.panel, { backgroundColor: surfaceMuted, borderColor }]}>
        <ThemedText type="defaultSemiBold">今日工作重点</ThemedText>
        <ThemedText>销售和采购都已经有稳定后端链路，移动端优先做“下单、收货、开票、收付款”的高频动作。</ThemedText>
      </View>
      <ThemedText type="defaultSemiBold">第一阶段目标</ThemedText>
      <ThemedText>先把销售和采购主链路跑顺，再继续补退货、打印和报表入口。</ThemedText>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    marginBottom: 6,
    padding: 16,
  },
});
