import { useRef, useState } from 'react';
import { NativeModules, Pressable, StyleSheet, UIManager, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

type FormalPdfStageProps = {
  onError: (message: string) => void;
  onLoadComplete: (pages: number) => void;
  pageCount: number | null;
  uri: string;
};

export function FormalPdfStage({ onError, onLoadComplete, pageCount, uri }: FormalPdfStageProps) {
  const pdfRef = useRef<any>(null);
  const [displayScale, setDisplayScale] = useState(1.18);
  const [commandScale, setCommandScale] = useState(1.18);
  const [fitPolicy, setFitPolicy] = useState<0 | 1 | 2>(2);
  const hasNativePdfModule = Boolean(
    NativeModules.PdfManager || UIManager.getViewManagerConfig?.('RNPDFPdfView')
  );

  if (!hasNativePdfModule) {
    return (
      <View style={styles.fallbackCard}>
        <ThemedText style={styles.fallbackEyebrow} type="defaultSemiBold">
          PDF VIEWER REQUIRED
        </ThemedText>
        <ThemedText style={styles.fallbackTitle} type="subtitle">
          当前客户端还没有内置查看器
        </ThemedText>
        <ThemedText style={styles.viewerHint}>
          当前客户端还没有完成 PDF 查看器原生能力接入。请重新构建移动端客户端后再试，或先使用系统查看器打开正式 PDF。
        </ThemedText>
      </View>
    );
  }

  let Pdf: any = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Pdf = require('react-native-pdf').default;
  } catch {
    Pdf = null;
  }
  if (!Pdf) {
    return (
      <View style={styles.fallbackCard}>
        <ThemedText style={styles.fallbackEyebrow} type="defaultSemiBold">
          PDF VIEWER REQUIRED
        </ThemedText>
        <ThemedText style={styles.fallbackTitle} type="subtitle">
          当前客户端还没有内置查看器
        </ThemedText>
        <ThemedText style={styles.viewerHint}>
          当前客户端还没有完成 PDF 查看器原生能力接入。请重新构建移动端客户端后再试，或先使用系统查看器打开正式 PDF。
        </ThemedText>
      </View>
    );
  }

  const adjustScale = (delta: number) => {
    setFitPolicy(2);
    setDisplayScale((current) => {
      const next = Math.max(1, Math.min(4, Number((current + delta).toFixed(2))));
      setCommandScale(next);
      return next;
    });
  };

  const resetScale = () => {
    setFitPolicy(2);
    setDisplayScale(1.18);
    setCommandScale(1.18);
    if (pdfRef.current?.setPage) {
      pdfRef.current.setPage(1);
    }
  };

  const fitToWidth = () => {
    setFitPolicy(0);
    setDisplayScale(1.02);
    setCommandScale(1.02);
  };

  const viewModeLabel =
    fitPolicy === 0 && displayScale <= 1.08 ? '适宽' : displayScale <= 1.22 ? '阅读' : '自由缩放';

  return (
    <View style={styles.viewerShell}>
      <View style={styles.metaRow}>
        <ThemedText style={styles.viewerHint}>双指缩放或使用下方工具调整查看方式</ThemedText>
        {pageCount ? (
          <ThemedText style={styles.pageCountText} type="defaultSemiBold">
            共 {pageCount} 页
          </ThemedText>
        ) : null}
      </View>
      <View style={styles.toolbarRow}>
        <View style={styles.scaleGroup}>
          <Pressable onPress={() => adjustScale(-0.25)} style={styles.iconToolButton}>
            <ThemedText style={styles.toolButtonText} type="defaultSemiBold">
              -
            </ThemedText>
          </Pressable>
          <Pressable onPress={() => fitToWidth()} style={styles.labelToolButton}>
            <ThemedText style={styles.toolButtonText} type="defaultSemiBold">
              适宽
            </ThemedText>
          </Pressable>
          <Pressable onPress={() => resetScale()} style={styles.labelToolButton}>
            <ThemedText style={styles.toolButtonText} type="defaultSemiBold">
              重置
            </ThemedText>
          </Pressable>
          <Pressable onPress={() => adjustScale(0.25)} style={styles.iconToolButton}>
            <ThemedText style={styles.toolButtonText} type="defaultSemiBold">
              +
            </ThemedText>
          </Pressable>
        </View>
        <View style={styles.statusGroup}>
          <View style={styles.modeBadge}>
            <ThemedText style={styles.modeBadgeText} type="defaultSemiBold">
              {viewModeLabel}
            </ThemedText>
          </View>
          <View style={styles.scaleBadge}>
            <ThemedText style={styles.scaleBadgeText} type="defaultSemiBold">
              {Math.round(displayScale * 100)}%
            </ThemedText>
          </View>
        </View>
      </View>
      <View style={styles.pdfWrap}>
        <View style={styles.pdfViewport}>
          <Pdf
            enableDoubleTapZoom
            enableAntialiasing
            fitPolicy={fitPolicy}
            maxScale={4}
            minScale={1}
            onScaleChanged={(nextScale: number) => setDisplayScale(nextScale)}
            onError={(error: Error) => onError(error.message || 'PDF 查看失败。')}
            onLoadComplete={(pages: number) => onLoadComplete(pages)}
            ref={pdfRef}
            scale={commandScale}
            showsHorizontalScrollIndicator
            showsVerticalScrollIndicator
            source={{ cache: true, uri }}
            spacing={16}
            style={styles.pdf}
            trustAllCerts={false}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fallbackCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D7DEE7',
    borderRadius: 24,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    justifyContent: 'center',
    minHeight: 280,
    padding: 22,
  },
  fallbackEyebrow: {
    color: '#2563EB',
    fontSize: 12,
    letterSpacing: 1.8,
  },
  fallbackTitle: {
    color: '#0F172A',
    fontSize: 22,
    lineHeight: 30,
  },
  iconToolButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D6E4FF',
    borderRadius: 12,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  labelToolButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D6E4FF',
    borderRadius: 12,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    minWidth: 58,
    paddingHorizontal: 12,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  modeBadge: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D6E4FF',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  modeBadgeText: {
    color: '#2563EB',
    fontSize: 12,
  },
  pageCountText: {
    color: '#1D4ED8',
    fontSize: 13,
  },
  pdf: {
    flex: 1,
    width: '100%',
  },
  pdfWrap: {
    backgroundColor: '#D9E2EF',
    borderColor: '#C3D3E8',
    borderRadius: 22,
    borderWidth: 1,
    flex: 1,
    minHeight: 620,
    overflow: 'hidden',
    paddingBottom: 8,
    paddingLeft: 3,
    paddingRight: 6,
    paddingTop: 3,
  },
  pdfViewport: {
    backgroundColor: '#EEF3F9',
    borderRadius: 18,
    flex: 1,
    minHeight: 620,
    overflow: 'hidden',
  },
  scaleBadge: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 64,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  scaleBadgeText: {
    color: '#1D4ED8',
    fontSize: 13,
    textAlign: 'center',
  },
  scaleGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    rowGap: 8,
  },
  statusGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  toolButtonText: {
    color: '#1D4ED8',
    fontSize: 13,
  },
  toolbarRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  viewerShell: {
    flex: 1,
    gap: 12,
    minHeight: 640,
  },
  viewerHint: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 20,
  },
});
