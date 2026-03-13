import { Link } from 'expo-router';
import type { Href } from 'expo-router';
import { StyleSheet } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { ThemedText } from '@/components/themed-text';

export default function MeTabScreen() {
  return (
    <AppShell title="我的" description="这里先放当前环境信息和退出入口占位。">
      <ThemedText type="defaultSemiBold">当前项目</ThemedText>
      <ThemedText>myapp-mobile / Expo Router</ThemedText>
      <ThemedText>后端联调目标：myapp.api.gateway.*</ThemedText>

      <Link href={'/login' as Href} style={styles.link}>
        <ThemedText type="defaultSemiBold">返回登录页</ThemedText>
      </Link>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  link: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D9DDE3',
    marginTop: 8,
    padding: 16,
    textDecorationLine: 'none',
  },
});
