import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';

type CameraPermission = {
  canAskAgain?: boolean;
  granted?: boolean;
};

type BarcodeScanResultLike = {
  data?: string | null;
};

type CameraModuleLike = {
  CameraView?: React.ComponentType<{
    barcodeScannerSettings?: { barcodeTypes?: string[] };
    onBarcodeScanned?: ((result: BarcodeScanResultLike) => void) | undefined;
    style?: object;
  }>;
  getCameraPermissionsAsync?: () => Promise<CameraPermission>;
  requestCameraPermissionsAsync?: () => Promise<CameraPermission>;
};

type BarcodeScannerSheetProps = {
  description?: string;
  onClose: () => void;
  onScanned: (value: string) => void | Promise<void>;
  title?: string;
  visible: boolean;
};

const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'code93', 'codabar', 'itf14', 'qr'] as const;

let cameraModule: CameraModuleLike | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  cameraModule = require('expo-camera') as CameraModuleLike;
} catch {
  cameraModule = null;
}

export function BarcodeScannerSheet({
  description = '将条码放入取景框内，扫到后会自动搜索并加入采购单。',
  onClose,
  onScanned,
  title = '扫码添加',
  visible,
}: BarcodeScannerSheetProps) {
  const [permission, setPermission] = useState<CameraPermission | null>(null);
  const [isHandlingScan, setIsHandlingScan] = useState(false);
  const surface = useThemeColor({}, 'surface');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');
  const CameraView = cameraModule?.CameraView ?? null;
  const hasNativeCameraModule = Boolean(CameraView && cameraModule);

  async function requestPermission() {
    if (!cameraModule?.requestCameraPermissionsAsync) {
      return;
    }

    const nextPermission = await cameraModule.requestCameraPermissionsAsync();
    setPermission(nextPermission);
  }

  useEffect(() => {
    let active = true;

    async function syncPermission() {
      if (!visible || Platform.OS === 'web' || !hasNativeCameraModule) {
        return;
      }

      const nextPermission = cameraModule?.getCameraPermissionsAsync
        ? await cameraModule.getCameraPermissionsAsync()
        : null;
      if (!active) {
        return;
      }
      setPermission(nextPermission);

      if (!nextPermission?.granted && nextPermission?.canAskAgain !== false) {
        const requestedPermission = await cameraModule?.requestCameraPermissionsAsync?.();
        if (active) {
          setPermission(requestedPermission ?? nextPermission);
        }
      }
    }

    void syncPermission();
    return () => {
      active = false;
    };
  }, [hasNativeCameraModule, visible]);

  useEffect(() => {
    if (!visible) {
      setIsHandlingScan(false);
    }
  }, [visible]);

  const handleBarcodeScanned = async (result: BarcodeScanResultLike) => {
    const data = typeof result.data === 'string' ? result.data.trim() : '';
    if (!data || isHandlingScan) {
      return;
    }

    setIsHandlingScan(true);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await onScanned(data);
  };

  const renderPlaceholder = (titleText: string, bodyText: string, allowPermissionRequest = false) => (
    <View style={[styles.placeholderCard, { backgroundColor: surfaceMuted, borderColor }]}>
      <IconSymbol color={tintColor} name="barcode.viewfinder" size={28} />
      <ThemedText style={styles.placeholderTitle} type="defaultSemiBold">
        {titleText}
      </ThemedText>
      <ThemedText style={styles.placeholderText}>{bodyText}</ThemedText>
      {allowPermissionRequest ? (
        <Pressable onPress={() => void requestPermission()} style={[styles.permissionButton, { backgroundColor: tintColor }]}>
          <ThemedText style={styles.permissionButtonText} type="defaultSemiBold">
            继续授权
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );

  const renderContent = () => {
    if (Platform.OS === 'web') {
      return renderPlaceholder('Web 暂不支持摄像头扫码', '请在移动端使用扫码，或直接输入商品条码进行搜索。');
    }

    if (!hasNativeCameraModule || !CameraView) {
      return renderPlaceholder(
        '当前客户端缺少相机模块',
        '这通常是因为当前运行的开发客户端没有包含 expo-camera。请重启并重新构建移动端客户端，或先手动输入商品条码。'
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
    return renderPlaceholder('需要相机权限', '允许访问相机后，才能直接扫码把商品加入采购单。', canAskPermission);
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
    justifyContent: 'center',
    minHeight: 260,
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
