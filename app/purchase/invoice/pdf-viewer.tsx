import { useLocalSearchParams, useRouter } from 'expo-router';

import { FormalPdfViewerScreen } from '@/components/print/formal-pdf-viewer-screen';

export default function PurchaseInvoicePdfViewerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ purchaseInvoice?: string; template?: string }>();

  return (
    <FormalPdfViewerScreen
      docname={typeof params.purchaseInvoice === 'string' ? params.purchaseInvoice.trim() : ''}
      doctype="Purchase Invoice"
      onBack={() => router.back()}
      pageTitle="正式采购发票"
      template={typeof params.template === 'string' ? params.template.trim() : 'standard'}
      templateLabel="标准采购发票"
    />
  );
}
