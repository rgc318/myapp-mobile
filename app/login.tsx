import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { loadStoredUsername } from '@/lib/auth-storage';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/providers/auth-provider';

export default function LoginScreen() {
  const { isAuthenticated, signIn } = useAuth();
  const [username, setUsername] = useState(() => loadStoredUsername() ?? '');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const surface = useThemeColor({}, 'surface');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');
  const accentSoft = useThemeColor({}, 'accentSoft');
  const backgroundColor = useThemeColor({}, 'background');

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      setError('请输入账号和密码。');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await signIn({ username: username.trim(), password });
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : '登录失败，请重试。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor, flex: 1 }}>
      <ScrollView
        contentContainerStyle={styles.container}
        style={{ backgroundColor }}>
        <View style={[styles.heroSection, { backgroundColor: accentSoft }]}>
        <View style={[styles.heroBadge, { backgroundColor: surface }]}>
          <ThemedText style={[styles.heroBadgeText, { color: tintColor }]}>RGC FLOW</ThemedText>
        </View>

        <View style={styles.heroContent}>
          <ThemedText style={styles.heroTitle}>业务登录</ThemedText>
          <ThemedText style={styles.heroDescription}>
            使用 ERPNext 账户进入现场业务端。登录后即可处理销售、采购与收付款。
          </ThemedText>
        </View>

        <View style={styles.heroNotes}>
          <View style={styles.heroNoteRow}>
            <View style={[styles.heroDot, { backgroundColor: tintColor }]} />
            <ThemedText style={styles.heroNoteText}>销售：下单、发货、开票、收款</ThemedText>
          </View>
          <View style={styles.heroNoteRow}>
            <View style={[styles.heroDot, { backgroundColor: tintColor }]} />
            <ThemedText style={styles.heroNoteText}>采购：收货、开票、付款</ThemedText>
          </View>
        </View>
      </View>

      <View style={[styles.formCard, { backgroundColor: surface, borderColor }]}>
        <View style={styles.formHeader}>
          <ThemedText type="subtitle">欢迎回来</ThemedText>
          <ThemedText>请输入账号和密码。</ThemedText>
        </View>

        <View style={styles.block}>
          <ThemedText type="defaultSemiBold">账号</ThemedText>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setUsername}
            placeholder="请输入用户名"
            placeholderTextColor="#8FA1B7"
            selectTextOnFocus
            style={[styles.input, { backgroundColor: surfaceMuted, borderColor }]}
            value={username}
          />
        </View>

        <View style={styles.block}>
          <ThemedText type="defaultSemiBold">密码</ThemedText>
          <View
            style={[
              styles.passwordField,
              {
                backgroundColor: surfaceMuted,
                borderColor,
              },
            ]}>
            <TextInput
              onChangeText={setPassword}
              placeholder="请输入密码"
              placeholderTextColor="#8FA1B7"
              secureTextEntry={!passwordVisible}
              style={styles.passwordInput}
              value={password}
            />
            <Pressable
              hitSlop={8}
              onPress={() => setPasswordVisible((value) => !value)}
              style={styles.passwordToggle}>
              <ThemedText style={[styles.passwordToggleText, { color: tintColor }]}>
                {passwordVisible ? '隐藏' : '显示'}
              </ThemedText>
            </Pressable>
          </View>
        </View>

        {error ? (
          <View style={[styles.errorBox, { backgroundColor: surfaceMuted }]}>
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          </View>
        ) : null}

        <Pressable
          onPress={handleLogin}
          style={[styles.enterButton, { backgroundColor: tintColor, shadowColor: tintColor }]}>
          {submitting ? (
            <ActivityIndicator color="#FFF7F0" />
          ) : (
            <ThemedText style={styles.enterButtonText} type="defaultSemiBold">
              登录并进入首页
            </ThemedText>
          )}
        </Pressable>

        <View style={styles.tipsBlock}>
          <ThemedText style={styles.tipText}>登录后将复用 ERPNext session，无需重复认证。</ThemedText>
        </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 0,
    minHeight: '100%',
    paddingBottom: 28,
  },
  heroSection: {
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 74,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  heroContent: {
    gap: 8,
  },
  heroTitle: {
    color: '#1F2A37',
    fontSize: 34,
    fontWeight: '700',
    lineHeight: 40,
  },
  heroDescription: {
    color: '#5C7088',
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 360,
  },
  heroNotes: {
    gap: 8,
  },
  heroNoteRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  heroDot: {
    borderRadius: 999,
    height: 6,
    width: 6,
  },
  heroNoteText: {
    color: '#647A93',
    fontSize: 13,
    lineHeight: 18,
  },
  formCard: {
    borderRadius: 26,
    borderWidth: 1,
    gap: 16,
    marginHorizontal: 16,
    marginTop: -42,
    paddingHorizontal: 18,
    paddingVertical: 18,
    shadowColor: '#0F2747',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.08,
    shadowRadius: 20,
  },
  formHeader: {
    gap: 4,
  },
  block: {
    gap: 6,
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    color: '#1F2A37',
    fontSize: 15,
    minHeight: 52,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  passwordField: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 52,
    paddingLeft: 15,
    paddingRight: 12,
  },
  passwordInput: {
    flex: 1,
    fontSize: 15,
    minHeight: 50,
    paddingVertical: 0,
  },
  passwordToggle: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    minWidth: 44,
  },
  passwordToggleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  errorBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E3A8A8',
    padding: 12,
  },
  errorText: {
    color: '#B42318',
  },
  enterButton: {
    alignItems: 'center',
    borderRadius: 16,
    minHeight: 52,
    justifyContent: 'center',
    padding: 14,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.16,
    shadowRadius: 16,
  },
  enterButtonText: {
    color: '#FFF7F0',
  },
  tipsBlock: {
    paddingTop: 2,
  },
  tipText: {
    color: '#71859D',
    fontSize: 12,
    lineHeight: 18,
  },
});
