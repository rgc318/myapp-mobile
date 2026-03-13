import { Platform, StyleSheet, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { ThemedText } from '@/components/themed-text';
import { getApiBaseUrl } from '@/lib/config';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/providers/auth-provider';

export default function SystemInfoScreen() {
  const { authMode, roles } = useAuth();
  const borderColor = useThemeColor({}, 'border');
  const surface = useThemeColor({}, 'surface');
  const separatorColor = useThemeColor({}, 'surfaceMuted');

  return (
    <AppShell title="系统信息" description="这里展示当前 App 运行环境和后端联调信息。">
      <View style={[styles.groupCard, { backgroundColor: surface, borderColor }]}>
        <ThemedText type="defaultSemiBold">运行环境</ThemedText>

        <View style={styles.metaList}>
          <View style={styles.metaRow}>
            <ThemedText style={styles.metaLabel}>客户端</ThemedText>
            <ThemedText style={styles.metaValue}>myapp-mobile / Expo Router</ThemedText>
          </View>

          <View style={[styles.separator, { backgroundColor: separatorColor }]} />

          <View style={styles.metaRow}>
            <ThemedText style={styles.metaLabel}>平台</ThemedText>
            <ThemedText style={styles.metaValue}>{Platform.OS}</ThemedText>
          </View>

          <View style={[styles.separator, { backgroundColor: separatorColor }]} />

          <View style={styles.metaRow}>
            <ThemedText style={styles.metaLabel}>后端地址</ThemedText>
            <ThemedText style={styles.metaValue}>{getApiBaseUrl()}</ThemedText>
          </View>

          <View style={[styles.separator, { backgroundColor: separatorColor }]} />

          <View style={styles.metaRow}>
            <ThemedText style={styles.metaLabel}>认证模式</ThemedText>
            <ThemedText style={styles.metaValue}>{authMode === 'token' ? 'Token' : 'Session'}</ThemedText>
          </View>

          <View style={[styles.separator, { backgroundColor: separatorColor }]} />

          <View style={styles.metaRow}>
            <ThemedText style={styles.metaLabel}>角色数量</ThemedText>
            <ThemedText style={styles.metaValue}>{roles.length}</ThemedText>
          </View>

          <View style={[styles.separator, { backgroundColor: separatorColor }]} />

          <View style={styles.metaRow}>
            <ThemedText style={styles.metaLabel}>业务写接口</ThemedText>
            <ThemedText style={styles.metaValue}>myapp.api.gateway.*</ThemedText>
          </View>
        </View>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  groupCard: {
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  metaList: {
    gap: 10,
  },
  metaRow: {
    gap: 4,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 2,
    marginRight: 2,
  },
  metaLabel: {
    color: '#71859D',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  metaValue: {
    fontSize: 15,
    lineHeight: 21,
  },
});
