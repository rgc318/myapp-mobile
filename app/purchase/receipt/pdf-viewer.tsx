import { useLocalSearchParams, useRouter } from 'expo-router';

import { FormalPdfViewerScreen } from '@/components/print/formal-pdf-viewer-screen';

export default function PurchaseReceiptPdfViewerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ purchaseReceipt?: string; template?: string }>();

  return (
    <FormalPdfViewerScreen
      docname={typeof params.purchaseReceipt === 'string' ? params.purchaseReceipt.trim() : ''}
      doctype="Purchase Receipt"
      onBack={() => router.back()}
      pageTitle="正式采购收货单"
      template={typeof params.template === 'string' ? params.template.trim() : 'standard'}
      templateLabel="标准采购收货单"
    />
  );
}
