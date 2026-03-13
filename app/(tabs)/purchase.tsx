import type { Href } from 'expo-router';
import { AppShell } from '@/components/app-shell';

export default function PurchaseTabScreen() {
  return (
    <AppShell
      title="采购"
      description="采购模块入口，后续从这里进入下单、收货、开票、付款和退货。"
      actions={[
        { href: '/purchase/order/create' as Href, label: '采购下单', description: '创建采购订单' },
        { href: '/purchase/receipt/create' as Href, label: '采购收货', description: '基于订单做实际收货入库' },
        { href: '/purchase/invoice/create' as Href, label: '采购开票', description: '基于收货单开票' },
        { href: '/purchase/payment/create' as Href, label: '供应商付款', description: '登记采购付款' },
        { href: '/purchase/return/create' as Href, label: '采购退货', description: '基于收货或发票做退货' },
      ]}
    />
  );
}
