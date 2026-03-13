import { useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { LinkOptionInput } from '@/components/link-option-input';
import { ThemedText } from '@/components/themed-text';
import {
  getAppPreferences,
  getDefaultPreferences,
  resetAppPreferences,
  setAppPreferences,
  type PurchaseFlowMode,
  type SalesFlowMode,
} from '@/lib/app-preferences';
import { getApiBaseUrl, getDefaultBaseUrl, setApiBaseUrl } from '@/lib/config';
import { useThemeColor } from '@/hooks/use-theme-color';
import { checkLinkOptionExists, searchLinkOptions } from '@/services/master-data';

export default function SettingsScreen() {
  const currentValue = getApiBaseUrl();
  const defaultValue = getDefaultBaseUrl();
  const currentPreferences = getAppPreferences();
  const defaultPreferences = getDefaultPreferences();
  const [baseUrl, setBaseUrlValue] = useState(currentValue);
  const [defaultCompany, setDefaultCompany] = useState(currentPreferences.defaultCompany);
  const [defaultWarehouse, setDefaultWarehouse] = useState(currentPreferences.defaultWarehouse);
  const [salesFlowMode, setSalesFlowMode] = useState<SalesFlowMode>(currentPreferences.salesFlowMode);
  const [purchaseFlowMode, setPurchaseFlowMode] = useState<PurchaseFlowMode>(currentPreferences.purchaseFlowMode);
  const [savedMessage, setSavedMessage] = useState('');
  const [companyError, setCompanyError] = useState('');
  const [warehouseError, setWarehouseError] = useState('');

  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const surface = useThemeColor({}, 'surface');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');

  const handleSavePreferences = async (next?: Partial<ReturnType<typeof getAppPreferences>>) => {
    const candidateCompany = (next?.defaultCompany ?? defaultCompany).trim();
    const candidateWarehouse = (next?.defaultWarehouse ?? defaultWarehouse).trim();
    setCompanyError('');
    setWarehouseError('');

    if (!(await checkLinkOptionExists('Company', candidateCompany))) {
      setCompanyError('公司不存在，请从候选项中选择或输入有效公司名称。');
      setSavedMessage('');
      return false;
    }

    if (!(await checkLinkOptionExists('Warehouse', candidateWarehouse))) {
      setWarehouseError('仓库不存在，请从候选项中选择或输入有效仓库名称。');
      setSavedMessage('');
      return false;
    }

    const nextPreferences = setAppPreferences({
      defaultCompany,
      defaultWarehouse,
      salesFlowMode,
      purchaseFlowMode,
      ...next,
    });
    setDefaultCompany(nextPreferences.defaultCompany);
    setDefaultWarehouse(nextPreferences.defaultWarehouse);
    setSalesFlowMode(nextPreferences.salesFlowMode);
    setPurchaseFlowMode(nextPreferences.purchaseFlowMode);
    setSavedMessage('操作默认值已更新。后续业务页面会优先使用这些设置。');
    return true;
  };

  const handleResetPreferences = () => {
    const defaultPrefs = getDefaultPreferences();
    const nextPreferences = setAppPreferences(defaultPrefs);
    setDefaultCompany(nextPreferences.defaultCompany);
    setDefaultWarehouse(nextPreferences.defaultWarehouse);
    setSalesFlowMode(nextPreferences.salesFlowMode);
    setPurchaseFlowMode(nextPreferences.purchaseFlowMode);
    setSavedMessage('已恢复默认公司、仓库和流程模式。');
  };

  const handleSaveBaseUrl = () => {
    const nextValue = setApiBaseUrl(baseUrl);
    setBaseUrlValue(nextValue);
    setSavedMessage('后端地址已更新。后续请求将使用新的地址。');
  };

  const handleResetBaseUrl = () => {
    const nextValue = setApiBaseUrl(null);
    setBaseUrlValue(nextValue);
    setSavedMessage('已恢复默认后端地址。');
  };

  return (
    <AppShell
      title="环境设置"
      description="这里用于查看和调整当前 App 对接的后端地址，以及日常操作常用的默认公司、仓库和流程模式。">
      <View style={[styles.groupCard, { backgroundColor: surface, borderColor }]}>
        <LinkOptionInput
          errorText={companyError}
          helperText={`当前建议值：${defaultPreferences.defaultCompany}`}
          label="默认公司"
          loadOptions={(query) => searchLinkOptions('Company', query)}
          onChangeText={(value) => {
            setDefaultCompany(value);
            if (companyError) {
              setCompanyError('');
            }
          }}
          onOptionSelect={async (value) => {
            setDefaultCompany(value);
            setCompanyError('');
            await handleSavePreferences({ defaultCompany: value });
          }}
          placeholder="请输入或搜索默认公司"
          value={defaultCompany}
        />

        <LinkOptionInput
          errorText={warehouseError}
          helperText={`当前建议值：${defaultPreferences.defaultWarehouse}`}
          label="默认仓库"
          loadOptions={(query) => searchLinkOptions('Warehouse', query, ['warehouse_name'])}
          onChangeText={(value) => {
            setDefaultWarehouse(value);
            if (warehouseError) {
              setWarehouseError('');
            }
          }}
          onOptionSelect={async (value) => {
            setDefaultWarehouse(value);
            setWarehouseError('');
            await handleSavePreferences({ defaultWarehouse: value });
          }}
          placeholder="请输入或搜索默认仓库"
          value={defaultWarehouse}
        />

        <View style={styles.block}>
          <ThemedText type="defaultSemiBold">销售流程模式</ThemedText>
          <View style={styles.optionRow}>
            <ModeChip
              active={salesFlowMode === 'step'}
              label="分步处理"
              onPress={async () => {
                setSalesFlowMode('step');
                await handleSavePreferences({ salesFlowMode: 'step' });
              }}
              tintColor={tintColor}
              borderColor={borderColor}
              surfaceMuted={surfaceMuted}
            />
            <ModeChip
              active={salesFlowMode === 'quick'}
              label="快捷结算"
              onPress={async () => {
                setSalesFlowMode('quick');
                await handleSavePreferences({ salesFlowMode: 'quick' });
              }}
              tintColor={tintColor}
              borderColor={borderColor}
              surfaceMuted={surfaceMuted}
            />
          </View>
        </View>

        <View style={styles.block}>
          <ThemedText type="defaultSemiBold">采购流程模式</ThemedText>
          <View style={styles.optionRow}>
            <ModeChip
              active={purchaseFlowMode === 'deferred'}
              label="收货后结算"
              onPress={async () => {
                setPurchaseFlowMode('deferred');
                await handleSavePreferences({ purchaseFlowMode: 'deferred' });
              }}
              tintColor={tintColor}
              borderColor={borderColor}
              surfaceMuted={surfaceMuted}
            />
            <ModeChip
              active={purchaseFlowMode === 'immediate'}
              label="收货并结算"
              onPress={async () => {
                setPurchaseFlowMode('immediate');
                await handleSavePreferences({ purchaseFlowMode: 'immediate' });
              }}
              tintColor={tintColor}
              borderColor={borderColor}
              surfaceMuted={surfaceMuted}
            />
          </View>
        </View>

        <View style={styles.inlineActions}>
          <Pressable onPress={() => void handleSavePreferences()} style={[styles.inlineButton, { backgroundColor: tintColor }]}>
            <ThemedText style={styles.primaryButtonText} type="defaultSemiBold">
              保存默认值
            </ThemedText>
          </Pressable>

          <Pressable onPress={handleResetPreferences} style={[styles.inlineButton, styles.inlineSecondary, { borderColor }]}>
            <ThemedText type="defaultSemiBold">恢复默认</ThemedText>
          </Pressable>
        </View>
      </View>

      <View style={[styles.groupCard, { backgroundColor: surface, borderColor }]}>
        <View style={styles.block}>
          <ThemedText type="defaultSemiBold">当前后端地址</ThemedText>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setBaseUrlValue}
            placeholder="请输入后端地址"
            style={[
              styles.input,
              { backgroundColor: surfaceMuted, borderColor },
              Platform.OS === 'web' ? ({ outlineWidth: 0 } as any) : null,
            ]}
            value={baseUrl}
          />
        </View>

        <View style={styles.metaBlock}>
          <ThemedText>默认地址：{defaultValue}</ThemedText>
          <ThemedText>当前生效：{currentValue}</ThemedText>
        </View>
      </View>

      {savedMessage ? <ThemedText style={styles.savedMessage}>{savedMessage}</ThemedText> : null}

      <View style={styles.inlineActions}>
        <Pressable onPress={handleSaveBaseUrl} style={[styles.inlineButton, { backgroundColor: tintColor }]}>
          <ThemedText style={styles.primaryButtonText} type="defaultSemiBold">
            保存地址
          </ThemedText>
        </Pressable>

        <Pressable onPress={handleResetBaseUrl} style={[styles.inlineButton, styles.inlineSecondary, { borderColor }]}>
          <ThemedText type="defaultSemiBold">恢复默认地址</ThemedText>
        </Pressable>
      </View>

      <View style={styles.metaBlock}>
        <ThemedText type="defaultSemiBold">使用建议</ThemedText>
        <ThemedText>Web 预览通常用 `http://localhost:8080`。</ThemedText>
        <ThemedText>真机或局域网调试时，请改成可被设备访问的 IP 地址。</ThemedText>
        <ThemedText>默认公司和默认仓库会作为后续业务页面的首选值。</ThemedText>
      </View>
    </AppShell>
  );
}

function ModeChip({
  active,
  borderColor,
  label,
  onPress,
  surfaceMuted,
  tintColor,
}: {
  active: boolean;
  borderColor: string;
  label: string;
  onPress: () => void;
  surfaceMuted: string;
  tintColor: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.modeChip,
        {
          backgroundColor: active ? `${tintColor}16` : surfaceMuted,
          borderColor: active ? tintColor : borderColor,
        },
      ]}>
      <ThemedText style={active ? { color: tintColor } : undefined} type="defaultSemiBold">
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 8,
  },
  groupCard: {
    borderRadius: 20,
    borderWidth: 1,
    gap: 18,
    padding: 16,
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 52,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  modeChip: {
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  metaBlock: {
    gap: 6,
  },
  hintText: {
    color: '#71859D',
    fontSize: 12,
  },
  savedMessage: {
    color: '#2F7D4A',
  },
  inlineActions: {
    flexDirection: 'row',
    gap: 10,
  },
  inlineButton: {
    alignItems: 'center',
    borderRadius: 16,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  primaryButtonText: {
    color: '#FFF',
  },
  inlineSecondary: {
    borderWidth: 1,
  },
});
