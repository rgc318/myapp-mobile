import { Link } from 'expo-router';
import type { Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/providers/auth-provider';

export default function MeTabScreen() {
  const { signOut, username } = useAuth();
  const borderColor = useThemeColor({}, 'border');
  const surface = useThemeColor({}, 'surface');
  const separatorColor = useThemeColor({}, 'surfaceMuted');
  const tintColor = useThemeColor({}, 'tint');

  const displayName = username || '未登录';
  const avatarLabel = displayName.slice(0, 1).toUpperCase();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <AppShell title="我的" description="账号、环境和常用设置都集中在这里。" contentCard={false}>
      <View style={[styles.profileCard, { backgroundColor: surface, borderColor }]}>
        <View style={[styles.avatar, { backgroundColor: '#F3F7FF' }]}>
          <ThemedText style={[styles.avatarText, { color: tintColor }]}>{avatarLabel}</ThemedText>
        </View>
        <View style={styles.profileBody}>
          <ThemedText type="subtitle">{displayName}</ThemedText>
          <ThemedText>当前已登录，可继续处理销售、采购和收付款流程。</ThemedText>
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
          账号与系统
        </ThemedText>
        <View style={[styles.groupCard, { backgroundColor: surface, borderColor }]}>
          <Link href={'/account-info' as Href} style={styles.menuRow}>
            <View style={styles.menuText}>
              <ThemedText type="defaultSemiBold">账号信息</ThemedText>
              <ThemedText>查看当前用户和认证状态</ThemedText>
            </View>
            <ThemedText style={[styles.menuArrow, { color: tintColor }]}>›</ThemedText>
          </Link>

          <View style={[styles.separator, { backgroundColor: separatorColor }]} />

          <Link href={'/system-info' as Href} style={styles.menuRow}>
            <View style={styles.menuText}>
              <ThemedText type="defaultSemiBold">系统信息</ThemedText>
              <ThemedText>查看当前环境和后端联调信息</ThemedText>
            </View>
            <ThemedText style={[styles.menuArrow, { color: tintColor }]}>›</ThemedText>
          </Link>
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
          设置与帮助
        </ThemedText>
        <View style={[styles.groupCard, { backgroundColor: surface, borderColor }]}>
          <Link href={'/settings' as Href} style={styles.menuRow}>
            <View style={styles.menuText}>
              <ThemedText type="defaultSemiBold">环境设置</ThemedText>
              <ThemedText>查看或切换当前后端地址</ThemedText>
            </View>
            <ThemedText style={[styles.menuArrow, { color: tintColor }]}>›</ThemedText>
          </Link>

          <View style={[styles.separator, { backgroundColor: separatorColor }]} />

          <Link href={'/login' as Href} style={styles.menuRow}>
            <View style={styles.menuText}>
              <ThemedText type="defaultSemiBold">查看登录页</ThemedText>
              <ThemedText>检查当前登录界面和认证入口</ThemedText>
            </View>
            <ThemedText style={[styles.menuArrow, { color: tintColor }]}>›</ThemedText>
          </Link>
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
          账号操作
        </ThemedText>
        <View style={[styles.groupCard, { backgroundColor: surface, borderColor }]}>
          <Pressable onPress={handleSignOut} style={styles.menuRow}>
            <View style={styles.menuText}>
              <ThemedText type="defaultSemiBold" style={styles.logoutText}>
                退出登录
              </ThemedText>
              <ThemedText>退出当前账号并返回登录页</ThemedText>
            </View>
            <ThemedText style={styles.logoutText}>›</ThemedText>
          </Pressable>
        </View>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 18,
  },
  avatar: {
    alignItems: 'center',
    borderRadius: 20,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
  },
  profileBody: {
    flex: 1,
    gap: 4,
  },
  groupCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    paddingHorizontal: 4,
  },
  metaList: {
    gap: 10,
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
  menuRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 68,
    paddingHorizontal: 16,
    paddingVertical: 10,
    textDecorationLine: 'none',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
    marginRight: 16,
  },
  menuText: {
    flex: 1,
    gap: 3,
    paddingRight: 12,
  },
  menuArrow: {
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 22,
  },
  logoutText: {
    color: '#B42318',
  },
});
