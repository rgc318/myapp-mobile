import type { Href } from 'expo-router';
import { AppShell } from '@/components/app-shell';

export default function PurchaseOrderCreateScreen() {
  return (
    <AppShell
      title="采购下单"
      description="后续这里接 create_purchase_order，负责供应商、商品、数量、价格和仓库确认。"
      actions={[
        { href: '/common/supplier-select' as Href, label: '选择供应商', description: '采购下单前先确认供应商' },
      ]}
    />
  );
}
