import type { Href } from 'expo-router';
import { AppShell } from '@/components/app-shell';
import { PreferenceSummary } from '@/components/preference-summary';
import { getAppPreferences } from '@/lib/app-preferences';

export default function PurchaseOrderCreateScreen() {
  const preferences = getAppPreferences();

  return (
    <AppShell
      title="采购下单"
      description="后续这里接 create_purchase_order，负责供应商、商品、数量、价格和仓库确认。当前页面会先使用默认公司、默认仓库和采购流程模式。"
      actions={[
        { href: '/common/supplier-select' as Href, label: '选择供应商', description: '采购下单前先确认供应商' },
        { href: '/settings' as Href, label: '修改默认设置', description: '调整默认公司、仓库和流程模式' },
      ]}
    >
      <PreferenceSummary
        title="本页默认带出值"
        modeLabel={preferences.purchaseFlowMode === 'immediate' ? '收货并结算' : '收货后结算'}
      />
    </AppShell>
  );
}
