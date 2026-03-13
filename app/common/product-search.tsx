import type { Href } from 'expo-router';
import { AppShell } from '@/components/app-shell';

export default function ProductSearchScreen() {
  return (
    <AppShell
      title="商品搜索"
      description="后续这里会接 search_product，并支持把商品加入销售订单。"
      actions={[
        { href: '/sales/order/create' as Href, label: '去销售下单', description: '从商品搜索进入销售订单创建' },
      ]}
    />
  );
}
