import { CameraView, type BarcodeScanningResult, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';

type BarcodeScannerSheetProps = {
  description?: string;
  onClose: () => void;
  onScanned: (value: string) => void | Promise<void>;
  title?: string;
  visible: boolean;
};

const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'code93', 'codabar', 'itf14', 'qr'] as const;

export function BarcodeScannerSheet({
  description = '将条码放入取景框内，扫到后会自动搜索并加入采购单。',
  onClose,
  onScanned,
  title = '扫码添加',
  visible,
}: BarcodeScannerSheetProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isHandlingScan, setIsHandlingScan] = useState(false);
  const surface = useThemeColor({}, 'surface');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');

  useEffect(() => {
    if (!visible || Platform.OS === 'web') {
      return;
    }

    if (!permission?.granted && permission?.canAskAgain !== false) {
      void requestPermission();
    }
  }, [permission?.canAskAgain, permission?.granted, requestPermission, visible]);

  useEffect(() => {
    if (!visible) {
      setIsHandlingScan(false);
    }
  }, [visible]);

  const handleBarcodeScanned = async (result: BarcodeScanningResult) => {
    const data = typeof result.data === 'string' ? result.data.trim() : '';
    if (!data || isHandlingScan) {
      return;
    }

    setIsHandlingScan(true);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await onScanned(data);
  };

  const renderContent = () => {
    if (Platform.OS === 'web') {
      return (
        <View style={[styles.placeholderCard, { backgroundColor: surfaceMuted, borderColor }]}>
          <IconSymbol color={tintColor} name="barcode.viewfinder" size={28} />
          <ThemedText style={styles.placeholderTitle} type="defaultSemiBold">
            Web 暂不支持摄像头扫码
          </ThemedText>
          <ThemedText style={styles.placeholderText}>
            请在移动端使用扫码，或直接输入商品条码进行搜索。
          </ThemedText>
        </View>
      );
    }

    if (permission?.granted) {
      return (
        <View style={[styles.cameraWrap, { borderColor }]}>
          <CameraView
            barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
            onBarcodeScanned={isHandlingScan ? undefined : handleBarcodeScanned}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.cameraOverlay}>
            <View style={styles.scanGuideWrap}>
              <View style={[styles.scanGuideFrame, { borderColor: '#FFFFFF' }]} />
            </View>
            <ThemedText style={styles.cameraHint}>
              将条码对准中间框线，扫描成功后会自动返回。
            </ThemedText>
          </View>
        </View>
      );
    }

    const canAskPermission = permission == null || permission.canAskAgain !== false;

    return (
      <View style={[styles.placeholderCard, { backgroundColor: surfaceMuted, borderColor }]}>
        <IconSymbol color={tintColor} name="barcode.viewfinder" size={28} />
        <ThemedText style={styles.placeholderTitle} type="defaultSemiBold">
          需要相机权限
        </ThemedText>
        <ThemedText style={styles.placeholderText}>
          允许访问相机后，才能直接扫码把商品加入采购单。
        </ThemedText>
        {canAskPermission ? (
          <Pressable onPress={() => void requestPermission()} style={[styles.permissionButton, { backgroundColor: tintColor }]}>
            <ThemedText style={styles.permissionButtonText} type="defaultSemiBold">
              继续授权
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    );
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.backdrop}>
        <Pressable onPress={onClose} style={styles.dismissArea} />
        <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <ThemedText style={styles.title} type="defaultSemiBold">
                {title}
              </ThemedText>
              <ThemedText style={styles.description}>{description}</ThemedText>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <ThemedText style={[styles.closeButtonText, { color: tintColor }]} type="defaultSemiBold">
                关闭
              </ThemedText>
            </Pressable>
          </View>

          {renderContent()}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(15,23,42,0.44)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  dismissArea: {
    flex: 1,
  },
  card: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    gap: 16,
    minHeight: '68%',
    paddingBottom: 28,
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 20,
  },
  description: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 19,
  },
  closeButton: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  closeButtonText: {
    fontSize: 14,
  },
  cameraWrap: {
    borderRadius: 22,
    borderWidth: 1,
    height: 440,
    overflow: 'hidden',
    position: 'relative',
  },
  cameraOverlay: {
    backgroundColor: 'rgba(15,23,42,0.08)',
    flex: 1,
    justifyContent: 'space-between',
    padding: 20,
  },
  scanGuideWrap: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  scanGuideFrame: {
    borderRadius: 22,
    borderWidth: 3,
    height: 180,
    width: '84%',
  },
  cameraHint: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  placeholderCard: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    minHeight: 260,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 24,
  },
  placeholderTitle: {
    fontSize: 18,
  },
  placeholderText: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  permissionButton: {
    alignItems: 'center',
    borderRadius: 14,
    justifyContent: 'center',
    marginTop: 6,
    minHeight: 44,
    minWidth: 112,
    paddingHorizontal: 18,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
});
