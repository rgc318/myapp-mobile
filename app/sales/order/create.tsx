import type { Href } from 'expo-router';
import { AppShell } from '@/components/app-shell';
import { PreferenceSummary } from '@/components/preference-summary';
import { getAppPreferences } from '@/lib/app-preferences';

export default function SalesOrderCreateScreen() {
  const preferences = getAppPreferences();

  return (
    <AppShell
      title="销售下单"
      description="后续这里接 create_order，负责客户、商品、数量、价格和仓库确认。当前页面已经会优先参考你的默认公司、默认仓库和销售流程模式。"
      actions={[
        { href: '/common/product-search' as Href, label: '先搜商品', description: '通过商品搜索挑选销售商品' },
        { href: '/common/customer-select' as Href, label: '选择客户', description: '销售下单前先确认客户' },
        { href: '/settings' as Href, label: '修改默认设置', description: '调整默认公司、仓库和流程模式' },
      ]}
    >
      <PreferenceSummary title="本页默认带出值" modeLabel={preferences.salesFlowMode === 'quick' ? '快捷结算' : '分步处理'} />
    </AppShell>
  );
}
