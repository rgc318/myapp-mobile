import { AppShell } from '@/components/app-shell';
import { PreferenceSummary } from '@/components/preference-summary';
import { getAppPreferences } from '@/lib/app-preferences';

export default function PurchaseReceiptCreateScreen() {
  const preferences = getAppPreferences();

  return (
    <AppShell
      title="采购收货"
      description="后续这里接 receive_purchase_order，支持部分收货、删行和改实际价格。页面会先参考你的默认仓库和采购流程模式。">
      <PreferenceSummary
        title="收货默认参考值"
        modeLabel={preferences.purchaseFlowMode === 'immediate' ? '收货并结算' : '收货后结算'}
      />
    </AppShell>
  );
}
