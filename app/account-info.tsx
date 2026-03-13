import { StyleSheet, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/providers/auth-provider';

export default function AccountInfoScreen() {
  const { authMode, isAuthenticated, profile, roles, username } = useAuth();
  const borderColor = useThemeColor({}, 'border');
  const surface = useThemeColor({}, 'surface');
  const separatorColor = useThemeColor({}, 'surfaceMuted');
  const displayName = profile?.fullName || username || '未登录';

  return (
    <AppShell title="账号信息" description="这里集中展示当前登录账号和认证状态。">
      <View style={[styles.groupCard, { backgroundColor: surface, borderColor }]}>
        <ThemedText type="defaultSemiBold">当前账号</ThemedText>

        <View style={styles.metaList}>
          <View style={styles.metaRow}>
            <ThemedText style={styles.metaLabel}>显示名称</ThemedText>
            <ThemedText style={styles.metaValue}>{displayName}</ThemedText>
          </View>

          <View style={[styles.separator, { backgroundColor: separatorColor }]} />

          <View style={styles.metaRow}>
            <ThemedText style={styles.metaLabel}>用户名</ThemedText>
            <ThemedText style={styles.metaValue}>{username || '未登录'}</ThemedText>
          </View>

          <View style={[styles.separator, { backgroundColor: separatorColor }]} />

          <View style={styles.metaRow}>
            <ThemedText style={styles.metaLabel}>邮箱</ThemedText>
            <ThemedText style={styles.metaValue}>{profile?.email || '未提供'}</ThemedText>
          </View>

          <View style={[styles.separator, { backgroundColor: separatorColor }]} />

          <View style={styles.metaRow}>
            <ThemedText style={styles.metaLabel}>手机号</ThemedText>
            <ThemedText style={styles.metaValue}>{profile?.mobileNo || '未提供'}</ThemedText>
          </View>

          <View style={[styles.separator, { backgroundColor: separatorColor }]} />

          <View style={styles.metaRow}>
            <ThemedText style={styles.metaLabel}>登录状态</ThemedText>
            <ThemedText style={styles.metaValue}>{isAuthenticated ? '已登录' : '未登录'}</ThemedText>
          </View>

          <View style={[styles.separator, { backgroundColor: separatorColor }]} />

          <View style={styles.metaRow}>
            <ThemedText style={styles.metaLabel}>认证模式</ThemedText>
            <ThemedText style={styles.metaValue}>{authMode === 'token' ? 'Token' : 'Session'}</ThemedText>
          </View>

          <View style={[styles.separator, { backgroundColor: separatorColor }]} />

          <View style={styles.metaRow}>
            <ThemedText style={styles.metaLabel}>当前角色</ThemedText>
            <ThemedText style={styles.metaValue}>{roles.length ? roles.join(' / ') : '未读取到角色信息'}</ThemedText>
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
