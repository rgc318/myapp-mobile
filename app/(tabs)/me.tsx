import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/providers/auth-provider';

function StatusBadge({
  label,
  color,
  backgroundColor,
}: {
  label: string;
  color: string;
  backgroundColor: string;
}) {
  return (
    <View style={[styles.badge, { backgroundColor }]}>
      <ThemedText style={[styles.badgeText, { color }]} type="defaultSemiBold">
        {label}
      </ThemedText>
    </View>
  );
}

function HeroMetric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <View style={[styles.heroMetricCard, { borderColor: `${accent}24`, backgroundColor: `${accent}10` }]}>
      <ThemedText style={styles.heroMetricLabel}>{label}</ThemedText>
      <ThemedText style={[styles.heroMetricValue, { color: accent }]} type="defaultSemiBold">
        {value}
      </ThemedText>
    </View>
  );
}

function QuickCard({
  icon,
  title,
  description,
  accent,
  onPress,
}: {
  icon: Parameters<typeof IconSymbol>[0]['name'];
  title: string;
  description: string;
  accent: string;
  onPress: () => void;
}) {
  const surface = useThemeColor({}, 'surface');
  const borderColor = useThemeColor({}, 'border');

  return (
    <Pressable onPress={onPress} style={[styles.quickCard, { backgroundColor: surface, borderColor }]}>
      <View style={[styles.quickCardIcon, { backgroundColor: `${accent}14` }]}>
        <IconSymbol color={accent} name={icon} size={18} />
      </View>
      <ThemedText style={styles.quickCardTitle} type="defaultSemiBold">
        {title}
      </ThemedText>
      <ThemedText style={styles.quickCardDescription}>{description}</ThemedText>
    </Pressable>
  );
}

function MenuRow({
  title,
  description,
  icon,
  onPress,
  danger = false,
}: {
  title: string;
  description: string;
  icon: Parameters<typeof IconSymbol>[0]['name'];
  onPress: () => void;
  danger?: boolean;
}) {
  const surface = useThemeColor({}, 'surface');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');
  const dangerColor = useThemeColor({}, 'danger');
  const activeColor = danger ? dangerColor : tintColor;

  return (
    <Pressable onPress={onPress} style={[styles.menuCard, { backgroundColor: surface, borderColor }]}>
      <View style={[styles.menuIconWrap, { backgroundColor: `${activeColor}12` }]}>
        <IconSymbol color={activeColor} name={icon} size={18} />
      </View>
      <View style={styles.menuBody}>
        <ThemedText style={danger ? { color: dangerColor } : null} type="defaultSemiBold">
          {title}
        </ThemedText>
        <ThemedText>{description}</ThemedText>
      </View>
      <IconSymbol color={activeColor} name="chevron.right" size={18} />
    </Pressable>
  );
}

export default function MeTabScreen() {
  const router = useRouter();
  const { isAuthenticated, profile, refreshSession, roles, signOut, username, workspacePreferences } = useAuth();
  const surface = useThemeColor({}, 'surface');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');
  const success = useThemeColor({}, 'success');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const displayName = profile?.fullName || username || '未登录';
  const avatarLabel = displayName.slice(0, 1).toUpperCase();
  const profileHint = profile?.email || profile?.mobileNo || '当前账号已连接，可继续处理销售、采购、库存和报表工作。';
  const roleSummary = roles.length ? `${roles.length} 个角色` : '待加载角色信息';
  const environmentLabel = Platform.OS === 'web' ? 'Web 联调' : '移动端';

  const handleSignOut = async () => {
    const proceed = async () => {
      await signOut();
    };

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm('确认退出当前账号吗？')) {
        await proceed();
      }
      return;
    }

    Alert.alert('退出登录', '确认退出当前账号并返回登录页吗？', [
      { text: '取消', style: 'cancel' },
      { text: '退出', style: 'destructive', onPress: () => void proceed() },
    ]);
  };

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshSession();
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshSession]);

  return (
    <AppShell title="我的" description="账号资料、环境设置和系统信息都集中在这里。" contentCard={false} scrollable={false}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl onRefresh={() => void handleRefresh()} refreshing={isRefreshing} />}
        showsVerticalScrollIndicator={false}>
      <View style={[styles.heroCard, { backgroundColor: surface, borderColor }]}>
        <View style={styles.heroGlowOne} />
        <View style={styles.heroGlowTwo} />

        <View style={styles.heroTopRow}>
          <View style={[styles.avatar, { backgroundColor: '#F3F7FF' }]}>
            <ThemedText style={[styles.avatarText, { color: tintColor }]}>{avatarLabel}</ThemedText>
          </View>

          <View style={styles.heroMain}>
            <View style={styles.heroHeaderRow}>
              <View style={styles.heroTitleWrap}>
                <ThemedText style={styles.heroEyebrow}>WORKSPACE</ThemedText>
                <ThemedText style={styles.heroTitle} type="subtitle">
                  {displayName}
                </ThemedText>
              </View>

              <View style={styles.heroBadgeColumn}>
                <StatusBadge
                  backgroundColor={isAuthenticated ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)'}
                  color={isAuthenticated ? success : '#DC2626'}
                  label={isAuthenticated ? '已登录' : '未登录'}
                />
              </View>
            </View>

            <ThemedText style={styles.heroSubtitle}>{profileHint}</ThemedText>
            <ThemedText style={styles.heroMeta}>
              {workspacePreferences.defaultCompany} · {workspacePreferences.defaultWarehouse}
            </ThemedText>
            <ThemedText style={styles.heroMetaSecondary}>{roleSummary}</ThemedText>
          </View>
        </View>

        <View style={styles.heroMetricGrid}>
          <HeroMetric accent={tintColor} label="当前环境" value={environmentLabel} />
          <HeroMetric accent={success} label="角色概览" value={roleSummary} />
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
          核心入口
        </ThemedText>
        <View style={styles.quickGrid}>
          <QuickCard
            accent={tintColor}
            description="查看账号资料、联系方式和身份状态"
            icon="person.fill"
            onPress={() => router.push('/account-info')}
            title="账号身份"
          />
          <QuickCard
            accent="#0F766E"
            description="维护默认公司、默认仓库和当前后端地址"
            icon="gearshape.fill"
            onPress={() => router.push('/settings')}
            title="环境设置"
          />
          <QuickCard
            accent="#B45309"
            description="查看当前 App、后端和打印策略信息"
            icon="chevron.left.forwardslash.chevron.right"
            onPress={() => router.push('/system-info')}
            title="系统环境"
          />
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
          当前工作上下文
        </ThemedText>
        <View style={[styles.summaryCard, { backgroundColor: surface, borderColor }]}>
          <View style={styles.summaryRow}>
            <ThemedText style={styles.summaryLabel}>默认公司</ThemedText>
            <ThemedText style={styles.summaryValue} type="defaultSemiBold">
              {workspacePreferences.defaultCompany}
            </ThemedText>
          </View>
          <View style={styles.summaryRow}>
            <ThemedText style={styles.summaryLabel}>默认仓库</ThemedText>
            <ThemedText style={styles.summaryValue} type="defaultSemiBold">
              {workspacePreferences.defaultWarehouse}
            </ThemedText>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
          账号操作
        </ThemedText>
        <View style={styles.menuStack}>
          <MenuRow
            danger
            description="退出当前账号并返回登录页"
            icon="xmark.circle.fill"
            onPress={() => void handleSignOut()}
            title="退出登录"
          />
        </View>
      </View>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
    paddingBottom: 32,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    paddingHorizontal: 4,
  },
  heroCard: {
    borderRadius: 28,
    borderWidth: 1,
    gap: 18,
    overflow: 'hidden',
    padding: 20,
    position: 'relative',
  },
  heroGlowOne: {
    backgroundColor: 'rgba(59,130,246,0.09)',
    borderRadius: 120,
    height: 180,
    position: 'absolute',
    right: -45,
    top: -40,
    width: 180,
  },
  heroGlowTwo: {
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderRadius: 120,
    bottom: -60,
    height: 140,
    left: -50,
    position: 'absolute',
    width: 140,
  },
  heroTopRow: {
    flexDirection: 'row',
    gap: 16,
  },
  avatar: {
    alignItems: 'center',
    borderRadius: 24,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '800',
  },
  heroMain: {
    flex: 1,
    gap: 6,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  heroTitleWrap: {
    flex: 1,
    gap: 3,
  },
  heroEyebrow: {
    color: '#356AE6',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  heroTitle: {
    fontSize: 26,
    lineHeight: 31,
  },
  heroBadgeColumn: {
    alignItems: 'flex-end',
    gap: 8,
  },
  heroSubtitle: {
    lineHeight: 21,
    maxWidth: '95%',
  },
  heroMeta: {
    color: '#5F7590',
    fontSize: 13,
    fontWeight: '600',
  },
  heroMetaSecondary: {
    color: '#7B8FA6',
    fontSize: 12,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 12,
  },
  heroMetricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  heroMetricCard: {
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    minWidth: 96,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  heroMetricLabel: {
    color: '#6B7F95',
    fontSize: 12,
    marginBottom: 6,
  },
  heroMetricValue: {
    fontSize: 18,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickCard: {
    borderRadius: 22,
    borderWidth: 1,
    flexBasis: '31%',
    flexGrow: 1,
    gap: 10,
    minHeight: 132,
    padding: 16,
  },
  quickCardIcon: {
    alignItems: 'center',
    borderRadius: 14,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  quickCardTitle: {
    fontSize: 16,
  },
  quickCardDescription: {
    color: '#6F8499',
    fontSize: 13,
    lineHeight: 19,
  },
  summaryCard: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  summaryRow: {
    gap: 5,
  },
  summaryLabel: {
    color: '#74879D',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  summaryValue: {
    fontSize: 15,
    lineHeight: 21,
  },
  menuStack: {
    gap: 0,
  },
  menuCard: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    minHeight: 86,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuIconWrap: {
    alignItems: 'center',
    borderRadius: 16,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  menuBody: {
    flex: 1,
    gap: 4,
  },
});
