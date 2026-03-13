import type { Href } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { AppShell } from '@/components/app-shell';

export default function HomeScreen() {
  return (
    <AppShell
      title="业务首页"
      description="这里是第一版移动端工作台，先展示核心路由入口。"
      actions={[
        { href: '/common/product-search' as Href, label: '商品搜索', description: '进入销售前先查商品与价格' },
        { href: '/sales/order/create' as Href, label: '新建销售订单', description: '销售主链路的第一个动作' },
        { href: '/purchase/order/create' as Href, label: '新建采购订单', description: '采购主链路的第一个动作' },
        { href: '/(tabs)/docs' as Href, label: '查看最近单据', description: '后续承接查询和状态跟踪' },
      ]}>
      <ThemedText type="defaultSemiBold">第一阶段目标</ThemedText>
      <ThemedText>先把销售和采购主链路跑顺，再继续补退货、打印和报表入口。</ThemedText>
    </AppShell>
  );
}
