import { useLocalSearchParams, useRouter } from 'expo-router';

import { FormalPdfViewerScreen } from '@/components/print/formal-pdf-viewer-screen';

export default function SalesInvoicePdfViewerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ salesInvoice?: string; template?: string }>();

  return (
    <FormalPdfViewerScreen
      docname={typeof params.salesInvoice === 'string' ? params.salesInvoice.trim() : ''}
      doctype="Sales Invoice"
      onBack={() => router.back()}
      pageTitle="正式发票"
      template={typeof params.template === 'string' ? params.template.trim() : 'standard'}
      templateLabel="标准发票"
    />
  );
}
