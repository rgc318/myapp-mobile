import { useLocalSearchParams, useRouter } from 'expo-router';

import { FormalPdfViewerScreen } from '@/components/print/formal-pdf-viewer-screen';

export default function SalesDeliveryPdfViewerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ deliveryNote?: string; template?: string }>();

  return (
    <FormalPdfViewerScreen
      docname={typeof params.deliveryNote === 'string' ? params.deliveryNote.trim() : ''}
      doctype="Delivery Note"
      onBack={() => router.back()}
      pageTitle="正式发货单"
      template={typeof params.template === 'string' ? params.template.trim() : 'standard'}
      templateLabel="标准发货单"
    />
  );
}
