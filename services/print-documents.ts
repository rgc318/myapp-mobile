import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import { downloadPrintFile, fetchPrintFile } from '@/services/printing';

export type StoredPrintPdf = {
  filename: string;
  fileSizeLabel: string;
  kind: 'web' | 'native';
  uri: string;
};

export async function preparePrintPdfDocument(params: {
  doctype: string;
  docname: string;
  template?: string | null;
}): Promise<StoredPrintPdf> {
  const file = await fetchPrintFile({
    doctype: params.doctype,
    docname: params.docname,
    template: params.template ?? undefined,
  });
  const safeFilename = file.filename.replace(/[\\/]/g, '-');
  const pdfBytes = await downloadPrintFile({
    doctype: params.doctype,
    docname: params.docname,
    template: params.template ?? undefined,
    filename: file.filename,
  });
  const fileSizeLabel = file.fileSize > 0 ? `${Math.max(1, Math.round(file.fileSize / 1024))} KB` : '未知大小';

  if (Platform.OS === 'web') {
    const pdfBlob = new Blob([pdfBytes], { type: file.mimeType });
    const objectUrl = URL.createObjectURL(pdfBlob);
    return {
      filename: safeFilename,
      fileSizeLabel,
      kind: 'web',
      uri: objectUrl,
    };
  }

  const { File, Paths } = await import('expo-file-system');
  const pdfFile = new File(Paths.document, safeFilename);
  if (pdfFile.exists) {
    pdfFile.delete();
  }
  pdfFile.create({ intermediates: true, overwrite: true });
  pdfFile.write(pdfBytes);
  return {
    filename: safeFilename,
    fileSizeLabel,
    kind: 'native',
    uri: pdfFile.uri,
  };
}

export async function openPreparedPrintPdf(pdfDocument: StoredPrintPdf): Promise<void> {
  if (Platform.OS === 'web') {
    window.open(pdfDocument.uri, '_blank', 'noopener,noreferrer');
    return;
  }

  if (Platform.OS === 'android') {
    const FileSystemLegacy = await import('expo-file-system/legacy');
    const contentUri = await FileSystemLegacy.getContentUriAsync(pdfDocument.uri);
    await Linking.openURL(contentUri);
    return;
  }

  await Linking.openURL(pdfDocument.uri);
}

export async function sharePreparedPrintPdf(pdfDocument: StoredPrintPdf): Promise<'shared' | 'downloaded'> {
  if (Platform.OS === 'web') {
    const anchor = document.createElement('a');
    anchor.href = pdfDocument.uri;
    anchor.download = pdfDocument.filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    return 'downloaded';
  }

  const Sharing = await import('expo-sharing');
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(pdfDocument.uri, {
      mimeType: 'application/pdf',
      dialogTitle: '分享打印文件',
      UTI: 'com.adobe.pdf',
    });
  }
  return 'shared';
}
