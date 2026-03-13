import { AppShell } from '@/components/app-shell';
import { PreferenceSummary } from '@/components/preference-summary';
import { getAppPreferences } from '@/lib/app-preferences';

export default function SalesInvoiceCreateScreen() {
  const preferences = getAppPreferences();

  return (
    <AppShell
      title="销售开票"
      description="后续这里接 create_sales_invoice，支持部分开票和开票时改价。页面会先参考默认公司和销售流程模式。">
      <PreferenceSummary title="开票默认参考值" modeLabel={preferences.salesFlowMode === 'quick' ? '快捷结算' : '分步处理'} />
    </AppShell>
  );
}
