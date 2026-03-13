import type { Href } from 'expo-router';
import { AppShell } from '@/components/app-shell';

export default function SalesOrderCreateScreen() {
  return (
    <AppShell
      title="销售下单"
      description="后续这里接 create_order，负责客户、商品、数量、价格和仓库确认。"
      actions={[
        { href: '/common/product-search' as Href, label: '先搜商品', description: '通过商品搜索挑选销售商品' },
        { href: '/common/customer-select' as Href, label: '选择客户', description: '销售下单前先确认客户' },
      ]}
    />
  );
}
