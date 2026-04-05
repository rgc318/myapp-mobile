import { useLocalSearchParams, useRouter } from 'expo-router';

import { FormalPdfViewerScreen } from '@/components/print/formal-pdf-viewer-screen';

export default function PurchaseOrderPdfViewerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ purchaseOrder?: string; template?: string }>();

  return (
    <FormalPdfViewerScreen
      docname={typeof params.purchaseOrder === 'string' ? params.purchaseOrder.trim() : ''}
      doctype="Purchase Order"
      onBack={() => router.back()}
      pageTitle="正式采购订单"
      template={typeof params.template === 'string' ? params.template.trim() : 'standard'}
      templateLabel="标准采购订单"
    />
  );
}
