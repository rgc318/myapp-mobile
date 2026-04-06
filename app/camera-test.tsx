import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';

function DiagnosticRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.diagnosticRow}>
      <ThemedText style={styles.diagnosticLabel}>{label}</ThemedText>
      <ThemedText style={styles.diagnosticValue} type="defaultSemiBold">
        {value}
      </ThemedText>
    </View>
  );
}

export default function CameraTestScreen() {
  const router = useRouter();
  const surface = useThemeColor({}, 'surface');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');
  const [permission, requestPermissionAsync, getPermissionAsync] = useCameraPermissions();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null);
  const hasNativeCameraModule = Boolean(CameraView);

  const permissionSummary = useMemo(
    () => ({
      canAskAgain: permission?.canAskAgain == null ? 'unknown' : permission.canAskAgain ? 'true' : 'false',
      granted: permission?.granted == null ? 'unknown' : permission.granted ? 'true' : 'false',
      status: permission?.status ?? 'unknown',
    }),
    [permission],
  );

  const syncPermissionState = useCallback(async () => {
    if (Platform.OS === 'web') {
      return null;
    }

    setIsRefreshing(true);
    try {
      setDiagnosticError(null);
      const nextPermission = await getPermissionAsync();
      return nextPermission ?? null;
    } catch (error) {
      setDiagnosticError(error instanceof Error ? error.message : '读取权限状态失败');
      return null;
    } finally {
      setIsRefreshing(false);
    }
  }, [getPermissionAsync]);

  const handleRequestPermission = useCallback(async () => {
    if (Platform.OS === 'web') {
      return null;
    }

    setIsRefreshing(true);
    try {
      setDiagnosticError(null);
      const nextPermission = await requestPermissionAsync();
      return nextPermission;
    } catch (error) {
      setDiagnosticError(error instanceof Error ? error.message : '请求权限失败');
      return null;
    } finally {
      setIsRefreshing(false);
    }
  }, [requestPermissionAsync]);

  const openSettings = useCallback(async () => {
    try {
      await Linking.openSettings();
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void syncPermissionState();
  }, [syncPermissionState]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void syncPermissionState();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [syncPermissionState]);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headerButton}>
            <IconSymbol color={tintColor} name="chevron.left" size={22} />
          </Pressable>
          <ThemedText style={styles.headerTitle} type="defaultSemiBold">
            相机自检
          </ThemedText>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator>
          <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
            <ThemedText style={styles.cardTitle} type="title">
              相机模块状态
            </ThemedText>
            <ThemedText style={styles.cardDescription}>
              这个页面不走扫码业务逻辑，只用来判断当前客户端是否真的具备相机能力，以及权限读取结果是否正常。
            </ThemedText>

            <View style={[styles.diagnosticPanel, { backgroundColor: surfaceMuted, borderColor }]}>
              <DiagnosticRow label="平台" value={Platform.OS} />
              <DiagnosticRow label="原生模块" value={hasNativeCameraModule ? 'available' : 'missing'} />
              <DiagnosticRow label="权限 granted" value={permissionSummary.granted} />
              <DiagnosticRow label="权限 canAskAgain" value={permissionSummary.canAskAgain} />
              <DiagnosticRow label="权限 status" value={permissionSummary.status} />
            </View>

            <View style={styles.actionRow}>
              <Pressable onPress={() => void syncPermissionState()} style={[styles.actionButton, { borderColor }]}>
                <ThemedText style={[styles.actionText, { color: tintColor }]} type="defaultSemiBold">
                  读取权限
                </ThemedText>
              </Pressable>
              <Pressable onPress={() => void handleRequestPermission()} style={[styles.actionButton, { backgroundColor: tintColor }]}>
                <ThemedText style={styles.actionPrimaryText} type="defaultSemiBold">
                  请求权限
                </ThemedText>
              </Pressable>
            </View>

            <Pressable onPress={() => void openSettings()} style={[styles.settingsButton, { borderColor }]}>
              <ThemedText style={[styles.actionText, { color: tintColor }]} type="defaultSemiBold">
                去系统设置
              </ThemedText>
            </Pressable>

            {diagnosticError ? (
              <ThemedText style={styles.errorText}>
                权限接口报错：{diagnosticError}
              </ThemedText>
            ) : null}

            <ThemedText style={styles.statusHint}>
              {isRefreshing
                ? '正在刷新权限状态...'
                : permission?.granted
                  ? '当前检测结果已授权。如果下面仍然打不开相机，问题更可能在客户端壳或原生模块。'
                  : '当前检测结果未授权。如果你已在系统里开启权限，但这里仍显示 false，就说明权限检测或当前客户端状态有异常。'}
            </ThemedText>
          </View>

          <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
            <ThemedText style={styles.cardTitle} type="title">
              直接打开相机
            </ThemedText>
            <ThemedText style={styles.cardDescription}>
              如果这里能直接显示相机画面，就说明相机模块本身是正常的，问题更偏向扫码业务页逻辑。
            </ThemedText>

            {Platform.OS === 'web' ? (
              <View style={[styles.placeholderCard, { backgroundColor: surfaceMuted, borderColor }]}>
                <ThemedText type="defaultSemiBold">Web 端不做相机自检</ThemedText>
              </View>
            ) : !hasNativeCameraModule ? (
              <View style={[styles.placeholderCard, { backgroundColor: surfaceMuted, borderColor }]}>
                <ThemedText type="defaultSemiBold">当前客户端缺少 expo-camera 原生模块</ThemedText>
                <ThemedText style={styles.placeholderText}>
                  如果这里显示 missing，就算权限开着也无法直接打开相机，需要重新构建客户端。
                </ThemedText>
              </View>
            ) : permission?.granted ? (
              <View style={[styles.cameraWrap, { borderColor }]}>
                <CameraView style={StyleSheet.absoluteFill} />
                <View style={styles.cameraOverlay}>
                  <ThemedText style={styles.cameraHint} type="defaultSemiBold">
                    如果你能看到实时画面，说明相机模块本身正常。
                  </ThemedText>
                </View>
              </View>
            ) : (
              <View style={[styles.placeholderCard, { backgroundColor: surfaceMuted, borderColor }]}>
                <ThemedText type="defaultSemiBold">当前还没有相机可用权限</ThemedText>
                <ThemedText style={styles.placeholderText}>
                  先点击上面的“请求权限”或去系统设置开启权限，然后回到此页观察状态是否同步。
                </ThemedText>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  page: {
    backgroundColor: '#F8FAFC',
    flex: 1,
  },
  header: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomColor: 'rgba(148,163,184,0.18)',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  headerTitle: {
    fontSize: 18,
  },
  headerSpacer: {
    width: 36,
  },
  content: {
    gap: 14,
    padding: 16,
    paddingBottom: 36,
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 14,
    padding: 16,
  },
  cardTitle: {
    fontSize: 22,
  },
  cardDescription: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 20,
  },
  diagnosticPanel: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  diagnosticRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  diagnosticLabel: {
    color: '#64748B',
    fontSize: 13,
  },
  diagnosticValue: {
    fontSize: 14,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 12,
  },
  actionText: {
    fontSize: 14,
  },
  actionPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  settingsButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 12,
  },
  statusHint: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 20,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    lineHeight: 20,
  },
  placeholderCard: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    justifyContent: 'center',
    minHeight: 180,
    padding: 20,
  },
  placeholderText: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  cameraWrap: {
    borderRadius: 18,
    borderWidth: 1,
    height: 360,
    overflow: 'hidden',
    position: 'relative',
  },
  cameraOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(15,23,42,0.08)',
    flex: 1,
    justifyContent: 'flex-end',
    padding: 18,
  },
  cameraHint: {
    backgroundColor: 'rgba(15,23,42,0.5)',
    borderRadius: 999,
    color: '#FFFFFF',
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 8,
    textAlign: 'center',
  },
});
