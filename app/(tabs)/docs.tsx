import type { Href } from 'expo-router';
import { AppShell } from '@/components/app-shell';

export default function DocsTabScreen() {
  return (
    <AppShell
      title="单据"
      description="这里先保留为最近单据与查询入口占位，后续接销售单据、采购单据和状态跟踪。"
      actions={[
        { href: '/sales/order/SAL-ORDER-DEMO' as Href, label: '销售订单详情示例', description: '占位页，用来验证详情路由' },
        { href: '/purchase/order/PURCHASE-ORDER-DEMO' as Href, label: '采购订单详情示例', description: '占位页，用来验证详情路由' },
      ]}
    />
  );
}
