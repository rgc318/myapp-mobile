import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { ThemedText } from '@/components/themed-text';
import { getApiBaseUrl, getDefaultBaseUrl, setApiBaseUrl } from '@/lib/config';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function SettingsScreen() {
  const currentValue = getApiBaseUrl();
  const defaultValue = getDefaultBaseUrl();
  const [baseUrl, setBaseUrlValue] = useState(currentValue);
  const [savedMessage, setSavedMessage] = useState('');

  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');

  const handleSave = () => {
    const nextValue = setApiBaseUrl(baseUrl);
    setBaseUrlValue(nextValue);
    setSavedMessage('后端地址已更新。后续请求将使用新的地址。');
  };

  const handleReset = () => {
    const nextValue = setApiBaseUrl(null);
    setBaseUrlValue(nextValue);
    setSavedMessage('已恢复默认后端地址。');
  };

  return (
    <AppShell
      title="环境设置"
      description="这里用于查看和调整当前 App 对接的后端地址，方便切换本地、局域网或其他开发环境。">
      <View style={styles.block}>
        <ThemedText type="defaultSemiBold">当前后端地址</ThemedText>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setBaseUrlValue}
          placeholder="请输入后端地址"
          style={[styles.input, { backgroundColor: surfaceMuted, borderColor }]}
          value={baseUrl}
        />
      </View>

      <View style={styles.metaBlock}>
        <ThemedText>默认地址：{defaultValue}</ThemedText>
        <ThemedText>当前生效：{currentValue}</ThemedText>
      </View>

      {savedMessage ? <ThemedText style={styles.savedMessage}>{savedMessage}</ThemedText> : null}

      <Pressable onPress={handleSave} style={[styles.primaryButton, { backgroundColor: tintColor }]}>
        <ThemedText style={styles.primaryButtonText} type="defaultSemiBold">
          保存当前地址
        </ThemedText>
      </Pressable>

      <Pressable onPress={handleReset} style={[styles.secondaryButton, { borderColor }]}>
        <ThemedText type="defaultSemiBold">恢复默认地址</ThemedText>
      </Pressable>

      <View style={styles.metaBlock}>
        <ThemedText type="defaultSemiBold">使用建议</ThemedText>
        <ThemedText>Web 预览通常用 `http://localhost:8080`。</ThemedText>
        <ThemedText>真机或局域网调试时，请改成可被设备访问的 IP 地址。</ThemedText>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 8,
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 52,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  metaBlock: {
    gap: 6,
  },
  savedMessage: {
    color: '#2F7D4A',
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 16,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: '#FFF',
  },
  secondaryButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
});
