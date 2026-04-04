import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MobilePageHeader } from '@/components/mobile-page-header';
import { FormalPdfStage } from '@/components/print/formal-pdf-stage';
import { ThemedText } from '@/components/themed-text';
import { useFeedback } from '@/providers/feedback-provider';
import {
  openPreparedPrintPdf,
  preparePrintPdfDocument,
  sharePreparedPrintPdf,
  type StoredPrintPdf,
} from '@/services/print-documents';

export default function SalesInvoicePdfViewerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ salesInvoice?: string; template?: string }>();
  const invoiceName = typeof params.salesInvoice === 'string' ? params.salesInvoice.trim() : '';
  const templateKey = typeof params.template === 'string' ? params.template.trim() : 'standard';
  const { showError, showInfo } = useFeedback();
  const insets = useSafeAreaInsets();
  const [document, setDocument] = useState<StoredPrintPdf | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pageCount, setPageCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!invoiceName) {
        setDocument(null);
        return;
      }

      try {
        setIsLoading(true);
        const nextDocument = await preparePrintPdfDocument({
          doctype: 'Sales Invoice',
          docname: invoiceName,
          template: templateKey || 'standard',
        });
        if (active) {
          setDocument(nextDocument);
        }
      } catch (error) {
        if (active) {
          setDocument(null);
        }
        showError(error instanceof Error ? error.message : '正式 PDF 加载失败。');
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [invoiceName, showError, templateKey]);

  async function handleSystemPrint() {
    if (!document) {
      showError('当前还没有可打印的 PDF。');
      return;
    }

    try {
      await openPreparedPrintPdf(document);
      if (Platform.OS === 'web') {
        showInfo('已打开正式 PDF，请在浏览器 PDF 查看器中完成打印。');
      } else {
        showInfo('已打开正式 PDF，请在系统查看器中完成打印。');
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : '系统打印文件打开失败。');
    }
  }

  async function handleSharePdf() {
    if (!document) {
      showError('当前还没有可分享的 PDF。');
      return;
    }

    try {
      const action = await sharePreparedPrintPdf(document);
      if (action === 'downloaded') {
        showInfo(`PDF 已开始下载：${document.filename}（${document.fileSizeLabel}）。`);
      } else {
        showInfo(`PDF 已准备完成：${document.filename}（${document.fileSizeLabel}）。`);
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : 'PDF 分享失败。');
    }
  }

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#2563EB" />
          <ThemedText style={styles.loadingText}>正在加载正式 PDF...</ThemedText>
        </View>
      );
    }

    if (!document) {
      return (
        <View style={styles.emptyCard}>
          <ThemedText style={styles.emptyText}>未能加载正式 PDF，请返回核对页后重试。</ThemedText>
        </View>
      );
    }

    return (
      <FormalPdfStage
        onError={(message) => showError(message)}
        onLoadComplete={(pages) => setPageCount(pages)}
        pageCount={pageCount}
        uri={document.uri}
      />
    );
  };

  return (
    <View style={styles.screen}>
      <MobilePageHeader showBack title="正式发票" />

      <View style={styles.stageScreen}>
        <View style={styles.stageHeader}>
          <View style={styles.stageMeta}>
            <ThemedText style={styles.stageTitle} type="subtitle">
              正式文档
            </ThemedText>
            <ThemedText style={styles.stageHint}>浏览器里可直接缩放、翻页和打印这份正式 PDF。</ThemedText>
          </View>

          <View style={styles.statRow}>
            <View style={styles.statChip}>
              <ThemedText style={styles.statLabel}>模板</ThemedText>
              <ThemedText style={styles.statValue} type="defaultSemiBold">
                标准发票
              </ThemedText>
            </View>
            <View style={styles.statChip}>
              <ThemedText style={styles.statLabel}>输出</ThemedText>
              <ThemedText style={styles.statValue} type="defaultSemiBold">
                PDF
              </ThemedText>
            </View>
            {document ? (
              <View style={styles.statChip}>
                <ThemedText style={styles.statLabel}>大小</ThemedText>
                <ThemedText style={styles.statValue} type="defaultSemiBold">
                  {document.fileSizeLabel}
                </ThemedText>
              </View>
            ) : null}
          </View>

        </View>

        <View style={styles.documentStage}>{renderContent()}</View>
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.footerRow}>
          <Pressable onPress={() => router.back()} style={[styles.footerButton, styles.footerGhostButton]}>
            <ThemedText style={styles.footerGhostText} type="defaultSemiBold">
              返回核对页
            </ThemedText>
          </Pressable>
          <Pressable
            disabled={!document}
            onPress={() => void handleSystemPrint()}
            style={[styles.footerButton, styles.footerGhostButton, !document ? styles.footerDisabledButton : null]}>
            <ThemedText style={styles.footerGhostText} type="defaultSemiBold">
              系统打印
            </ThemedText>
          </Pressable>
          <Pressable
            disabled={!document}
            onPress={() => void handleSharePdf()}
            style={[styles.footerButton, styles.footerPrimaryButton, !document ? styles.footerDisabledButton : null]}>
            <ThemedText style={styles.footerPrimaryText} type="defaultSemiBold">
              分享 PDF
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  documentStage: {
    flex: 1,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D7DEE7',
    borderRadius: 24,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  eyebrow: {
    color: '#2563EB',
    fontSize: 12,
    letterSpacing: 1.8,
  },
  footer: {
    backgroundColor: '#FFFFFF',
    borderTopColor: '#D7DEE7',
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  footerButton: {
    flex: 1,
  },
  footerDisabledButton: {
    opacity: 0.55,
  },
  footerGhostButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D6E4FF',
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
  footerGhostText: {
    color: '#1D4ED8',
  },
  footerPrimaryButton: {
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 16,
    justifyContent: 'center',
    minHeight: 48,
  },
  footerPrimaryText: {
    color: '#FFFFFF',
  },
  footerRow: {
    flexDirection: 'row',
    gap: 12,
  },
  loadingText: {
    color: '#64748B',
    fontSize: 14,
  },
  loadingWrap: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D7DEE7',
    borderRadius: 24,
    borderWidth: 1,
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 24,
  },
  screen: {
    backgroundColor: '#F5F7FB',
    flex: 1,
  },
  stageHeader: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D6E4FF',
    borderRadius: 22,
    borderWidth: 1,
    gap: 14,
    padding: 16,
  },
  stageMeta: {
    gap: 6,
  },
  stageHint: {
    color: '#50627C',
    fontSize: 13,
    lineHeight: 20,
  },
  stageScreen: {
    flex: 1,
    gap: 14,
    padding: 16,
    paddingTop: 14,
  },
  stageTitle: {
    color: '#102A43',
    fontSize: 20,
    lineHeight: 28,
  },
  statChip: {
    backgroundColor: '#F3F8FF',
    borderColor: '#CFE0FF',
    borderRadius: 16,
    borderWidth: 1,
    gap: 2,
    minWidth: 82,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  statLabel: {
    color: '#5B6B84',
    fontSize: 12,
    lineHeight: 18,
  },
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statValue: {
    color: '#1D4ED8',
    fontSize: 14,
    lineHeight: 20,
  },
});
