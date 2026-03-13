import { StyleSheet, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/providers/auth-provider';

export default function AccountInfoScreen() {
  const { authMode, isAuthenticated, username } = useAuth();
  const borderColor = useThemeColor({}, 'border');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');

  return (
    <AppShell title="账号信息" description="这里集中展示当前登录账号和认证状态。">
      <View style={[styles.groupCard, { backgroundColor: surfaceMuted, borderColor }]}>
        <ThemedText type="defaultSemiBold">当前账号</ThemedText>

        <View style={styles.metaList}>
          <View style={styles.metaRow}>
            <ThemedText style={styles.metaLabel}>用户名</ThemedText>
            <ThemedText style={styles.metaValue}>{username || '未登录'}</ThemedText>
          </View>

          <View style={styles.metaRow}>
            <ThemedText style={styles.metaLabel}>登录状态</ThemedText>
            <ThemedText style={styles.metaValue}>{isAuthenticated ? '已登录' : '未登录'}</ThemedText>
          </View>

          <View style={styles.metaRow}>
            <ThemedText style={styles.metaLabel}>认证模式</ThemedText>
            <ThemedText style={styles.metaValue}>{authMode === 'token' ? 'Token' : 'Session'}</ThemedText>
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
    gap: 12,
  },
  metaRow: {
    gap: 4,
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
