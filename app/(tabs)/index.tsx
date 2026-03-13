import type { Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppShell } from '@/components/app-shell';
import { PreferenceSummary } from '@/components/preference-summary';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getAppPreferences } from '@/lib/app-preferences';
import { useAuth } from '@/providers/auth-provider';

export default function HomeScreen() {
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const preferences = getAppPreferences();
  const { roles } = useAuth();

  const canUseSales =
    roles.length === 0 ||
    roles.some((role) => ['Sales User', 'Sales Manager', 'Accounts User', 'Accounts Manager', 'System Manager'].includes(role));
  const canUsePurchase =
    roles.length === 0 ||
    roles.some((role) => ['Purchase User', 'Purchase Manager', 'Accounts User', 'Accounts Manager', 'System Manager'].includes(role));

  const actions = [
    { href: '/common/product-search' as Href, label: '商品搜索', description: '进入销售前先查商品与价格' },
    ...(canUseSales
      ? [{ href: '/sales/order/create' as Href, label: '新建销售订单', description: '销售主链路的第一个动作' }]
      : []),
    ...(canUsePurchase
      ? [{ href: '/purchase/order/create' as Href, label: '新建采购订单', description: '采购主链路的第一个动作' }]
      : []),
    { href: '/(tabs)/docs' as Href, label: '查看最近单据', description: '后续承接查询和状态跟踪' },
  ];

  return (
    <AppShell
      title="业务首页"
      description="今天优先处理销售、采购和收付款。先把常用动作放在最前面，减少层级跳转。"
      actions={actions}>
      <View style={[styles.panel, { backgroundColor: surfaceMuted, borderColor }]}>
        <ThemedText type="defaultSemiBold">今日工作重点</ThemedText>
        <ThemedText>销售和采购都已经有稳定后端链路，移动端优先做“下单、收货、开票、收付款”的高频动作。</ThemedText>
      </View>
      <PreferenceSummary
        title="当前操作默认值"
        modeLabel={`销售：${preferences.salesFlowMode === 'quick' ? '快捷结算' : '分步处理'} / 采购：${
          preferences.purchaseFlowMode === 'immediate' ? '收货并结算' : '收货后结算'
        }`}
      />
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
