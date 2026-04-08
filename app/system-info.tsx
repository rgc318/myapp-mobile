import Constants from 'expo-constants';
import { Platform, StyleSheet, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getApiBaseUrl } from '@/lib/config';
import { useAuth } from '@/providers/auth-provider';

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <View style={[styles.summaryCard, { backgroundColor: `${accent}10`, borderColor: `${accent}22` }]}>
      <ThemedText style={styles.summaryLabel}>{label}</ThemedText>
      <ThemedText style={[styles.summaryValue, { color: accent }]} type="defaultSemiBold">
        {value}
      </ThemedText>
    </View>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoItem}>
      <ThemedText style={styles.infoLabel}>{label}</ThemedText>
      <ThemedText style={styles.infoValue} type="defaultSemiBold">
        {value}
      </ThemedText>
    </View>
  );
}

export default function SystemInfoScreen() {
  const { authMode, roles } = useAuth();
  const borderColor = useThemeColor({}, 'border');
  const surface = useThemeColor({}, 'surface');
  const tintColor = useThemeColor({}, 'tint');
  const success = useThemeColor({}, 'success');
  const warning = useThemeColor({}, 'warning');
  const appVersion = Constants.expoConfig?.version || '1.0.0';
  const appName = Constants.expoConfig?.name || 'myapp-mobile';
  const packageName = Constants.expoConfig?.android?.package || 'com.anonymous.myappmobile';
  const apiBaseUrl = getApiBaseUrl();
  const platformLabel = Platform.OS === 'web' ? 'Web 联调' : Platform.OS === 'android' ? 'Android 客户端' : 'iOS 客户端';

  return (
    <AppShell title="系统信息" description="查看当前运行环境、联调地址和文件策略。" contentCard={false}>
      <View style={[styles.heroCard, { backgroundColor: surface, borderColor }]}>
        <View style={styles.heroGlow} />
        <ThemedText style={styles.heroEyebrow}>SYSTEM PANEL</ThemedText>
        <ThemedText style={styles.heroTitle} type="subtitle">
          系统运行概览
        </ThemedText>
        <ThemedText style={styles.heroText}>
          这里保留真正有用的环境摘要：当前运行平台、后端联调地址、认证方式，以及图片与打印文件的存储规则。
        </ThemedText>

        <View style={styles.summaryGrid}>
          <SummaryCard accent={tintColor} label="运行平台" value={platformLabel} />
          <SummaryCard accent={success} label="认证方式" value={authMode === 'token' ? 'Token' : 'Session'} />
          <SummaryCard accent={warning} label="版本号" value={`v${appVersion}`} />
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
          联调与客户端
        </ThemedText>
        <View style={[styles.panelCard, { backgroundColor: surface, borderColor }]}>
          <InfoItem label="客户端名称" value={appName} />
          <InfoItem label="后端地址" value={apiBaseUrl} />
          <InfoItem label="平台" value={Platform.OS} />
          <InfoItem label="角色数量" value={String(roles.length)} />
          <InfoItem label="业务写接口" value="myapp.api.gateway.*" />
          <InfoItem label="Android 包名" value={packageName} />
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
          文件与打印策略
        </ThemedText>
        <View style={[styles.panelCard, { backgroundColor: surface, borderColor }]}>
          <InfoItem label="商品图片" value="新增商品先临时上传，创建成功后再正式绑定到 Item。" />
          <InfoItem label="图片存储" value="基于 Frappe File，临时图片会自动清理，正式商品图使用托管目录。" />
          <InfoItem label="PDF 默认模式" value="stream：普通预览、分享、下载不在后端落盘。" />
          <InfoItem label="PDF 归档模式" value="archive=1：仅在明确留档时生成私有 File。" />
          <InfoItem label="归档目录" value="Home/Attachments/MyApp Print Files/Archive" />
        </View>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
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
    height: 190,
    position: 'absolute',
    right: -70,
    top: -35,
    width: 190,
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
    maxWidth: '92%',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryCard: {
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    minWidth: 96,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  summaryLabel: {
    color: '#6F8499',
    fontSize: 12,
    marginBottom: 6,
  },
  summaryValue: {
    fontSize: 17,
    lineHeight: 22,
  },
  panelCard: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  infoItem: {
    gap: 5,
  },
  infoLabel: {
    color: '#74879D',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  infoValue: {
    fontSize: 15,
    lineHeight: 21,
  },
});
