import { useLocalSearchParams, useRouter } from 'expo-router';

import { FormalPdfViewerScreen } from '@/components/print/formal-pdf-viewer-screen';

export default function SalesOrderPdfViewerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ salesOrder?: string; template?: string }>();

  return (
    <FormalPdfViewerScreen
      docname={typeof params.salesOrder === 'string' ? params.salesOrder.trim() : ''}
      doctype="Sales Order"
      onBack={() => router.back()}
      pageTitle="正式销售订单"
      template={typeof params.template === 'string' ? params.template.trim() : 'standard'}
      templateLabel="标准销售订单"
    />
  );
}
