import { Link } from 'expo-router';
import type { Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { ThemedText } from '@/components/themed-text';
import { getApiBaseUrl } from '@/lib/config';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/providers/auth-provider';

export default function MeTabScreen() {
  const { authMode, signOut, username } = useAuth();
  const borderColor = useThemeColor({}, 'border');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <AppShell title="我的" description="当前账号、后端环境和登录操作都先收口在这里。">
      <View style={[styles.infoCard, { backgroundColor: surfaceMuted, borderColor }]}>
        <ThemedText type="defaultSemiBold">当前账号</ThemedText>
        <ThemedText>{username || '未登录'}</ThemedText>
      </View>

      <View style={[styles.infoCard, { backgroundColor: surfaceMuted, borderColor }]}>
        <ThemedText type="defaultSemiBold">当前项目</ThemedText>
        <ThemedText>myapp-mobile / Expo Router</ThemedText>
        <ThemedText>后端联调目标：myapp.api.gateway.*</ThemedText>
        <ThemedText>当前后端地址：{getApiBaseUrl()}</ThemedText>
        <ThemedText>当前认证模式：{authMode === 'token' ? 'Token' : 'Session'}</ThemedText>
      </View>

      <Link href={'/settings' as Href} style={[styles.secondaryLink, { borderColor }]}>
        <ThemedText type="defaultSemiBold">环境设置</ThemedText>
        <ThemedText>查看或切换当前后端地址</ThemedText>
      </Link>

      <Pressable
        onPress={handleSignOut}
        style={styles.link}>
        <ThemedText type="defaultSemiBold">退出登录</ThemedText>
      </Pressable>

      <Link href={'/login' as Href} style={[styles.secondaryLink, { borderColor }]}>
        <ThemedText type="defaultSemiBold">查看登录页</ThemedText>
      </Link>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  infoCard: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    padding: 16,
  },
  link: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1F6FEB',
    marginTop: 8,
    padding: 16,
  },
  secondaryLink: {
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 8,
    padding: 16,
    textDecorationLine: 'none',
  },
});
