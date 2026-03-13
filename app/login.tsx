import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { ThemedText } from '@/components/themed-text';

export default function LoginScreen() {
  return (
    <AppShell
      title="登录"
      description="这里先保留登录占位页。后续接入 ERPNext / 网关认证后，从这里进入业务首页。">
      <View style={styles.block}>
        <ThemedText type="defaultSemiBold">当前阶段</ThemedText>
        <ThemedText>已验证 Expo 路由和项目可启动，下一步再替换为真实认证表单。</ThemedText>
      </View>

      <Link href="/(tabs)" style={styles.enterButton}>
        <ThemedText type="defaultSemiBold">进入业务首页</ThemedText>
      </Link>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 8,
  },
  enterButton: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1F6FEB',
    padding: 16,
    textAlign: 'center',
    textDecorationLine: 'none',
  },
});
