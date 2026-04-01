import type { Href } from 'expo-router';
import { AppShell } from '@/components/app-shell';

export default function SalesTabScreen() {
  return (
    <AppShell
      title="销售"
      description="销售模块入口，后续从这里进入下单、发货、开票和收款。"
      actions={[
        { href: '/sales/order/create' as Href, label: '销售下单', description: '创建销售订单' },
        { href: '/sales/delivery/create' as Href, label: '销售发货', description: '根据订单提交发货单' },
        { href: '/sales/invoice/create' as Href, label: '销售开票', description: '根据订单生成销售发票' },
        { href: '/sales/payment/create' as Href, label: '销售收款', description: '为发票登记收款' },
      ]}
    />
  );
}
