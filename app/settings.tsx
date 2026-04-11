import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import * as Linking from 'expo-linking';

import { AppShell } from '@/components/app-shell';
import { LinkOptionInput } from '@/components/link-option-input';
import { ThemedText } from '@/components/themed-text';
import { getDefaultPreferences } from '@/lib/app-preferences';
import { getApiBaseUrl, getDefaultBaseUrl, setApiBaseUrl } from '@/lib/config';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/providers/auth-provider';
import { useFeedback } from '@/providers/feedback-provider';
import { checkLinkOptionExists, searchLinkOptions } from '@/services/master-data';
import { getWarehouseCompany, searchWarehouses } from '@/services/purchases';
import { getMobileReleaseInfo, type MobileReleaseInfo } from '@/services/user';

function formatVersionText(version: string, buildNumber: number | null) {
  if (!version) {
    return '';
  }
  if (/\+build\.\d+$/i.test(version)) {
    return version;
  }
  return buildNumber ? `${version}+build.${buildNumber}` : version;
}

export default function SettingsScreen() {
  const { saveWorkspacePreferences, workspacePreferences } = useAuth();
  const currentValue = getApiBaseUrl();
  const defaultValue = getDefaultBaseUrl();
  const defaultPreferences = getDefaultPreferences();
  const [baseUrl, setBaseUrlValue] = useState(currentValue);
  const [defaultCompany, setDefaultCompany] = useState(workspacePreferences.defaultCompany);
  const [defaultWarehouse, setDefaultWarehouse] = useState(workspacePreferences.defaultWarehouse);
  const [savedMessage, setSavedMessage] = useState('');
  const [companyError, setCompanyError] = useState('');
  const [warehouseError, setWarehouseError] = useState('');
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [releaseInfo, setReleaseInfo] = useState<MobileReleaseInfo | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const { showError, showInfo, showSuccess } = useFeedback();
  const appVersion = Constants.expoConfig?.version || '1.0.0';
  const currentBuildNumber = (() => {
    const candidate = Constants.nativeBuildVersion;
    if (typeof candidate !== 'string' || !candidate.trim()) {
      return null;
    }
    const parsed = Number.parseInt(candidate, 10);
    return Number.isFinite(parsed) ? parsed : null;
  })();

  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const surface = useThemeColor({}, 'surface');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');
  const successColor = useThemeColor({}, 'success');
  const dangerColor = useThemeColor({}, 'danger');

  useEffect(() => {
    setDefaultCompany(workspacePreferences.defaultCompany);
    setDefaultWarehouse(workspacePreferences.defaultWarehouse);
  }, [workspacePreferences.defaultCompany, workspacePreferences.defaultWarehouse]);

  const handleSavePreferences = async (next?: { defaultCompany?: string; defaultWarehouse?: string }) => {
    const candidateCompany = (next?.defaultCompany ?? defaultCompany).trim();
    const candidateWarehouse = (next?.defaultWarehouse ?? defaultWarehouse).trim();
    setCompanyError('');
    setWarehouseError('');

    if (!(await checkLinkOptionExists('Company', candidateCompany))) {
      const message = '公司不存在，请从候选项中选择或输入有效公司名称。';
      setCompanyError(message);
      setSavedMessage('');
      showError(message);
      return false;
    }

    let resolvedWarehouse = candidateWarehouse;

    if (resolvedWarehouse && !(await checkLinkOptionExists('Warehouse', resolvedWarehouse))) {
      const message = '仓库不存在，请从候选项中选择或输入有效仓库名称。';
      setWarehouseError(message);
      setSavedMessage('');
      showError(message);
      return false;
    }

    if (resolvedWarehouse && candidateCompany) {
      const warehouseCompany = await getWarehouseCompany(resolvedWarehouse);
      if (warehouseCompany && warehouseCompany !== candidateCompany) {
        resolvedWarehouse = '';
        setDefaultWarehouse('');
        setWarehouseError('');
      }
    }

    const nextPreferences = await saveWorkspacePreferences({
      defaultCompany: candidateCompany,
      defaultWarehouse: resolvedWarehouse,
      ...next,
    });
    setDefaultCompany(nextPreferences.defaultCompany);
    setDefaultWarehouse(nextPreferences.defaultWarehouse);
    const warehouseAutoCleared = Boolean(candidateWarehouse) && !resolvedWarehouse;
    const message = warehouseAutoCleared
      ? '默认公司已更新，原默认仓库不属于该公司，已自动清空，请重新选择仓库。'
      : '工作偏好已更新，后续业务页面会优先使用这些默认值。';
    setSavedMessage(message);
    showSuccess(message);
    return true;
  };

  const handleResetPreferences = async () => {
    const defaultPrefs = getDefaultPreferences();
    const nextPreferences = await saveWorkspacePreferences(defaultPrefs);
    setDefaultCompany(nextPreferences.defaultCompany);
    setDefaultWarehouse(nextPreferences.defaultWarehouse);
    const message = '已恢复默认公司和默认仓库。';
    setSavedMessage(message);
    showSuccess(message);
  };

  const handleSaveBaseUrl = () => {
    const nextValue = setApiBaseUrl(baseUrl);
    setBaseUrlValue(nextValue);
    const message = '后端地址已更新。后续请求将使用新的地址。';
    setSavedMessage(message);
    showSuccess(message);
  };

  const handleResetBaseUrl = () => {
    const nextValue = setApiBaseUrl(null);
    setBaseUrlValue(nextValue);
    const message = '已恢复默认后端地址。';
    setSavedMessage(message);
    showSuccess(message);
  };

  const checkForUpdate = async () => {
    setCheckingUpdate(true);
    try {
      const nextReleaseInfo = await getMobileReleaseInfo({
        currentVersion: appVersion,
        currentBuildNumber,
      });
      setReleaseInfo(nextReleaseInfo);

      if (!nextReleaseInfo.enabled) {
        showError('服务端还没有配置移动端 Release 源，请先补充站点配置。');
        return nextReleaseInfo;
      }

      if (nextReleaseInfo.hasUpdate) {
        setShowUpdateModal(true);
        showSuccess(`发现新版本 ${nextReleaseInfo.latestVersion || nextReleaseInfo.latestTag}。`);
        return nextReleaseInfo;
      }

      showSuccess('当前已经是已知最新版本。');
      return nextReleaseInfo;
    } catch (error) {
      showError(error instanceof Error ? error.message : '检查更新失败，请稍后重试。');
      return null;
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleCheckUpdate = async () => {
    await checkForUpdate();
  };

  const handleOpenUpdateLink = async () => {
    const resolvedReleaseInfo = releaseInfo ?? (await checkForUpdate());
    const targetUrl = resolvedReleaseInfo?.downloadUrl || resolvedReleaseInfo?.releasePageUrl;
    if (!targetUrl) {
      showError('当前没有可用的下载地址，请先确认 Release 源配置和发布内容。');
      return;
    }

    try {
      showInfo('正在打开下载页...');
      if (Platform.OS === 'web' && typeof globalThis.open === 'function') {
        globalThis.open(targetUrl, '_blank');
        return;
      }
      await Linking.openURL(targetUrl);
    } catch {
      showError('无法打开下载链接，请检查设备网络或链接配置。');
    }
  };

  const currentVersionText = formatVersionText(appVersion, currentBuildNumber);
  const publishedText = releaseInfo?.publishedAt
    ? new Date(releaseInfo.publishedAt).toLocaleString()
    : '尚未检查';
  const releaseSourceText = releaseInfo
    ? releaseInfo.repo || '未配置 GitHub Release 源'
    : '尚未检查';
  const latestVersionText = releaseInfo
    ? formatVersionText(releaseInfo.latestVersion || releaseInfo.latestTag || '未知版本', releaseInfo.latestBuildNumber)
    : '尚未检查';
  const updateStatus = checkingUpdate
    ? { label: '检查中', color: tintColor, backgroundColor: `${tintColor}12` }
    : !releaseInfo
      ? { label: '尚未检查', color: '#64748B', backgroundColor: '#F1F5F9' }
      : !releaseInfo.enabled
        ? { label: '未配置更新源', color: dangerColor, backgroundColor: `${dangerColor}12` }
        : releaseInfo.hasUpdate
          ? { label: '发现新版本', color: tintColor, backgroundColor: `${tintColor}12` }
          : { label: '已是最新版本', color: successColor, backgroundColor: `${successColor}12` };
  const updateButtonLabel = checkingUpdate
    ? '检查中...'
    : releaseInfo?.hasUpdate
      ? '重新检查'
      : '检查更新';
  const downloadButtonLabel = checkingUpdate
    ? '请稍候'
    : releaseInfo?.hasUpdate
      ? '下载新版本'
      : '打开下载页';
  const downloadHintText = !releaseInfo
    ? '先检查更新，页面会展示版本、发布时间和更新说明。'
    : !releaseInfo.enabled
      ? '当前服务端还没有配置 GitHub Release 源。'
      : releaseInfo.hasUpdate
        ? '检测到新版本后，可以直接跳转到 APK 下载页。'
        : '即使当前已是最新版本，也可以打开 Release 页面查看安装包与历史说明。';
  const releaseNotesPreview = releaseInfo?.releaseNotes?.trim()
    ? releaseInfo.releaseNotes.trim()
    : '本次版本暂无额外更新说明。';

  return (
    <AppShell
      title="环境设置"
      description="统一维护默认公司、默认仓库和当前联调环境。"
      contentCard={false}>
      <View style={[styles.heroCard, { backgroundColor: surface, borderColor }]}>
        <View style={styles.heroGlow} />
        <ThemedText style={styles.heroEyebrow}>WORK PREFERENCES</ThemedText>
        <ThemedText style={styles.heroTitle} type="subtitle">
          当前工作默认值
        </ThemedText>
        <ThemedText style={styles.heroText}>
          这里的设置会影响商品、销售、采购和库存页面的默认带入值，也决定当前 App 连到哪个后端环境。
        </ThemedText>

        <View style={styles.heroSummaryGrid}>
          <View style={[styles.heroSummaryCard, { backgroundColor: `${tintColor}10`, borderColor: `${tintColor}20` }]}>
            <ThemedText style={styles.heroSummaryLabel}>默认公司</ThemedText>
            <ThemedText numberOfLines={1} style={[styles.heroSummaryValue, { color: tintColor }]} type="defaultSemiBold">
              {defaultCompany}
            </ThemedText>
          </View>
          <View style={[styles.heroSummaryCard, { backgroundColor: 'rgba(15,118,110,0.10)', borderColor: 'rgba(15,118,110,0.20)' }]}>
            <ThemedText style={styles.heroSummaryLabel}>默认仓库</ThemedText>
            <ThemedText numberOfLines={1} style={[styles.heroSummaryValue, { color: '#0F766E' }]} type="defaultSemiBold">
              {defaultWarehouse}
            </ThemedText>
          </View>
        </View>
      </View>

      <View style={[styles.section, styles.raisedSection]}>
        <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
          业务默认值
        </ThemedText>

        <View style={[styles.groupCard, styles.raisedGroupCard, { backgroundColor: surface, borderColor }]}>
          <LinkOptionInput
            errorText={companyError}
            helperText={`建议默认值：${defaultPreferences.defaultCompany}`}
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
            helperText={`建议默认值：${defaultPreferences.defaultWarehouse}`}
            label="默认仓库"
            loadOptions={(query) => searchWarehouses(query, defaultCompany.trim() || undefined)}
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

          <View style={styles.inlineActions}>
            <Pressable onPress={() => void handleSavePreferences()} style={[styles.inlineButton, { backgroundColor: tintColor }]}>
              <ThemedText style={styles.primaryButtonText} type="defaultSemiBold">
                保存业务默认值
              </ThemedText>
            </Pressable>

            <Pressable onPress={() => void handleResetPreferences()} style={[styles.inlineButton, styles.inlineSecondary, { borderColor }]}>
              <ThemedText type="defaultSemiBold">恢复默认</ThemedText>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
          联调环境
        </ThemedText>

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
                Platform.OS === 'web' ? ({ outlineWidth: 0 } as never) : null,
              ]}
              value={baseUrl}
            />
          </View>

          <View style={styles.metaBlock}>
            <ThemedText style={styles.metaLabel}>默认地址</ThemedText>
            <ThemedText style={styles.metaValue}>{defaultValue}</ThemedText>
          </View>

          <View style={styles.metaBlock}>
            <ThemedText style={styles.metaLabel}>当前生效</ThemedText>
            <ThemedText style={styles.metaValue}>{currentValue}</ThemedText>
          </View>

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
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
          应用更新
        </ThemedText>

        <View style={[styles.groupCard, { backgroundColor: surface, borderColor }]}>
          <View style={[styles.updateStatusCard, { backgroundColor: surfaceMuted, borderColor }]}>
            <View style={styles.updateStatusHeader}>
              <View>
                <ThemedText type="defaultSemiBold">版本检查</ThemedText>
                <ThemedText style={styles.updateStatusDescription}>
                  先确认当前版本，再检查是否存在新的 Release 安装包。
                </ThemedText>
              </View>
              <View style={[styles.updateStatusBadge, { backgroundColor: updateStatus.backgroundColor }]}>
                <ThemedText style={[styles.updateStatusBadgeText, { color: updateStatus.color }]} type="defaultSemiBold">
                  {updateStatus.label}
                </ThemedText>
              </View>
            </View>
          </View>

          <View style={styles.metaBlock}>
            <ThemedText style={styles.metaLabel}>当前版本</ThemedText>
            <ThemedText style={styles.metaValue}>{currentVersionText}</ThemedText>
          </View>

          <View style={styles.metaBlock}>
            <ThemedText style={styles.metaLabel}>最新版本</ThemedText>
            <ThemedText style={styles.metaValue}>{latestVersionText}</ThemedText>
          </View>

          <View style={styles.metaBlock}>
            <ThemedText style={styles.metaLabel}>发布时间</ThemedText>
            <ThemedText style={styles.metaValue}>{publishedText}</ThemedText>
          </View>

          <View style={styles.metaBlock}>
            <ThemedText style={styles.metaLabel}>更新来源</ThemedText>
            <ThemedText style={styles.metaValue}>{releaseSourceText}</ThemedText>
          </View>

          {releaseInfo?.releaseNotes ? (
            <View style={styles.metaBlock}>
              <ThemedText style={styles.metaLabel}>更新说明</ThemedText>
              <ThemedText style={styles.metaValue}>{releaseInfo.releaseNotes}</ThemedText>
            </View>
          ) : null}

          <View style={styles.inlineActions}>
            <Pressable
              disabled={checkingUpdate}
              onPress={() => void handleCheckUpdate()}
              style={[styles.inlineButton, { backgroundColor: tintColor }, checkingUpdate ? styles.disabledButton : null]}>
              <ThemedText style={styles.primaryButtonText} type="defaultSemiBold">
                {updateButtonLabel}
              </ThemedText>
            </Pressable>

            <Pressable
              disabled={checkingUpdate}
              onPress={() => void handleOpenUpdateLink()}
              style={[
                styles.inlineButton,
                styles.inlineSecondary,
                { borderColor },
                checkingUpdate ? styles.disabledSecondaryButton : null,
              ]}>
              <ThemedText type="defaultSemiBold">{downloadButtonLabel}</ThemedText>
            </Pressable>
          </View>

          <ThemedText style={styles.helperText}>{downloadHintText}</ThemedText>

          <ThemedText style={styles.helperText}>
            当前实现由后端统一读取 GitHub Releases。Android release 构建应同步递增内部 build number，
            这样同一 `version` 下的新测试包才能被稳定识别为更新。
          </ThemedText>
        </View>
      </View>

      {savedMessage ? <ThemedText style={styles.savedMessage}>{savedMessage}</ThemedText> : null}

      <View style={[styles.tipCard, { backgroundColor: surface, borderColor }]}>
        <ThemedText type="defaultSemiBold">使用建议</ThemedText>
        <ThemedText>Web 联调通常使用 `http://localhost:8080`。</ThemedText>
        <ThemedText>真机或局域网调试时，请改成设备可访问的 IP 地址。</ThemedText>
        <ThemedText>默认公司和默认仓库会作为商品、销售、采购等页面的首选值。</ThemedText>
      </View>

      <Modal animationType="fade" onRequestClose={() => setShowUpdateModal(false)} transparent visible={showUpdateModal}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: surface, borderColor }]}>
            <ThemedText style={styles.modalEyebrow}>NEW VERSION</ThemedText>
            <ThemedText style={styles.modalTitle} type="subtitle">
              发现新版本
            </ThemedText>
            <ThemedText style={styles.modalDescription}>
              当前版本 {currentVersionText}，最新版本 {latestVersionText}。
            </ThemedText>

            <View style={[styles.modalMetaCard, { backgroundColor: surfaceMuted, borderColor }]}>
              <ThemedText style={styles.metaLabel}>发布时间</ThemedText>
              <ThemedText style={styles.metaValue}>{publishedText}</ThemedText>
              <ThemedText style={[styles.metaLabel, styles.modalMetaSpacing]}>更新说明</ThemedText>
              <ScrollView nestedScrollEnabled style={styles.modalNotesScroll}>
                <ThemedText style={styles.modalNotesText}>{releaseNotesPreview}</ThemedText>
              </ScrollView>
            </View>

            <View style={styles.inlineActions}>
              <Pressable
                onPress={() => setShowUpdateModal(false)}
                style={[styles.inlineButton, styles.inlineSecondary, { borderColor }]}>
                <ThemedText type="defaultSemiBold">稍后再说</ThemedText>
              </Pressable>

              <Pressable
                onPress={() => {
                  setShowUpdateModal(false);
                  void handleOpenUpdateLink();
                }}
                style={[styles.inlineButton, { backgroundColor: tintColor }]}>
                <ThemedText style={styles.primaryButtonText} type="defaultSemiBold">
                  立即下载
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
  raisedSection: {
    elevation: 6,
    zIndex: 20,
  },
  sectionTitle: {
    paddingHorizontal: 4,
  },
  heroCard: {
    borderRadius: 28,
    borderWidth: 1,
    gap: 14,
    overflow: 'hidden',
    padding: 20,
    position: 'relative',
  },
  heroGlow: {
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderRadius: 140,
    height: 180,
    position: 'absolute',
    right: -55,
    top: -25,
    width: 180,
  },
  heroEyebrow: {
    color: '#356AE6',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  heroTitle: {
    fontSize: 26,
    lineHeight: 30,
  },
  heroText: {
    lineHeight: 21,
    maxWidth: '94%',
  },
  heroSummaryGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  heroSummaryCard: {
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  heroSummaryLabel: {
    color: '#6F8499',
    fontSize: 12,
  },
  heroSummaryValue: {
    fontSize: 16,
  },
  groupCard: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 18,
    padding: 18,
  },
  raisedGroupCard: {
    overflow: 'visible',
  },
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
    gap: 4,
  },
  metaLabel: {
    color: '#74879D',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  metaValue: {
    fontSize: 15,
    lineHeight: 21,
  },
  updateStatusCard: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  updateStatusHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  updateStatusDescription: {
    color: '#74879D',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
    maxWidth: '90%',
  },
  updateStatusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  updateStatusBadgeText: {
    fontSize: 12,
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
    minHeight: 46,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  inlineSecondary: {
    borderWidth: 1,
  },
  disabledButton: {
    opacity: 0.7,
  },
  disabledSecondaryButton: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#FFF',
  },
  helperText: {
    color: '#74879D',
    fontSize: 12,
    lineHeight: 18,
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.36)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    maxWidth: 420,
    padding: 20,
    width: '100%',
  },
  modalEyebrow: {
    color: '#356AE6',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  modalTitle: {
    fontSize: 24,
    lineHeight: 28,
  },
  modalDescription: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 21,
  },
  modalMetaCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  modalMetaSpacing: {
    marginTop: 12,
  },
  modalNotesScroll: {
    marginTop: 6,
    maxHeight: 180,
  },
  modalNotesText: {
    color: '#0F172A',
    fontSize: 14,
    lineHeight: 21,
  },
  savedMessage: {
    color: '#2F7D4A',
  },
  tipCard: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 8,
    padding: 18,
  },
});
