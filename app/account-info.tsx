import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/providers/auth-provider';

function MetaCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');

  return (
    <View style={[styles.metaCard, { backgroundColor: surfaceMuted }]}>
      <ThemedText style={styles.metaLabel}>{label}</ThemedText>
      <ThemedText style={styles.metaValue} type="defaultSemiBold">
        {value}
      </ThemedText>
    </View>
  );
}

function RoleChip({ label }: { label: string }) {
  const tintColor = useThemeColor({}, 'tint');

  return (
    <View style={[styles.roleChip, { backgroundColor: `${tintColor}12` }]}>
      <ThemedText style={[styles.roleChipText, { color: tintColor }]} type="defaultSemiBold">
        {label}
      </ThemedText>
    </View>
  );
}

export default function AccountInfoScreen() {
  const { authMode, isAuthenticated, profile, roles, username } = useAuth();
  const borderColor = useThemeColor({}, 'border');
  const surface = useThemeColor({}, 'surface');
  const success = useThemeColor({}, 'success');
  const tintColor = useThemeColor({}, 'tint');
  const displayName = profile?.fullName || username || '未登录';
  const avatarLabel = displayName.slice(0, 1).toUpperCase();
  const authStatus = isAuthenticated ? '已登录' : '未登录';
  const authModeLabel = authMode === 'token' ? 'Token 认证' : 'Session 认证';

  return (
    <AppShell title="账号信息" description="集中查看当前账号身份、联系方式和认证状态。" contentCard={false}>
      <View style={[styles.heroCard, { backgroundColor: surface, borderColor }]}>
        <View style={styles.heroGlow} />
        <View style={styles.heroRow}>
          {profile?.userImage ? (
            <Image contentFit="cover" source={profile.userImage} style={styles.avatarImage} />
          ) : (
            <View style={[styles.avatarFallback, { backgroundColor: '#F3F7FF' }]}>
              <ThemedText style={[styles.avatarText, { color: tintColor }]}>{avatarLabel}</ThemedText>
            </View>
          )}

          <View style={styles.heroBody}>
            <ThemedText style={styles.heroEyebrow}>ACCOUNT IDENTITY</ThemedText>
            <ThemedText style={styles.heroTitle} type="subtitle">
              {displayName}
            </ThemedText>
            <ThemedText>{profile?.email || profile?.mobileNo || '当前账号未补全联系资料。'}</ThemedText>
            <View style={styles.heroBadgeRow}>
              <View style={[styles.statusBadge, { backgroundColor: isAuthenticated ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)' }]}>
                <ThemedText style={[styles.statusBadgeText, { color: isAuthenticated ? success : '#DC2626' }]} type="defaultSemiBold">
                  {authStatus}
                </ThemedText>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: `${tintColor}12` }]}>
                <ThemedText style={[styles.statusBadgeText, { color: tintColor }]} type="defaultSemiBold">
                  {authModeLabel}
                </ThemedText>
              </View>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
          基本信息
        </ThemedText>
        <View style={styles.metaGrid}>
          <MetaCard label="显示名称" value={displayName} />
          <MetaCard label="用户名" value={username || '未登录'} />
          <MetaCard label="邮箱" value={profile?.email || '未提供'} />
          <MetaCard label="手机号" value={profile?.mobileNo || '未提供'} />
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
          认证与会话
        </ThemedText>
        <View style={[styles.infoCard, { backgroundColor: surface, borderColor }]}>
          <View style={styles.infoRow}>
            <ThemedText style={styles.infoLabel}>登录状态</ThemedText>
            <ThemedText style={styles.infoValue} type="defaultSemiBold">
              {authStatus}
            </ThemedText>
          </View>
          <View style={styles.infoRow}>
            <ThemedText style={styles.infoLabel}>认证模式</ThemedText>
            <ThemedText style={styles.infoValue} type="defaultSemiBold">
              {authModeLabel}
            </ThemedText>
          </View>
          <View style={styles.infoRow}>
            <ThemedText style={styles.infoLabel}>账号标识</ThemedText>
            <ThemedText style={styles.infoValue} type="defaultSemiBold">
              {profile?.username || username || '未登录'}
            </ThemedText>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
          角色与权限摘要
        </ThemedText>
        <View style={[styles.infoCard, { backgroundColor: surface, borderColor }]}>
          <ThemedText style={styles.rolesHint}>
            当前页面显示的是后端返回的角色集合，后续业务页面会据此控制商品、销售、采购、报表等能力。
          </ThemedText>
          <View style={styles.roleWrap}>
            {roles.length ? roles.map((role) => <RoleChip key={role} label={role} />) : <RoleChip label="未读取到角色信息" />}
          </View>
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
    overflow: 'hidden',
    padding: 20,
    position: 'relative',
  },
  heroGlow: {
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderRadius: 140,
    height: 180,
    position: 'absolute',
    right: -60,
    top: -30,
    width: 180,
  },
  heroRow: {
    flexDirection: 'row',
    gap: 16,
  },
  avatarImage: {
    borderRadius: 24,
    height: 72,
    width: 72,
  },
  avatarFallback: {
    alignItems: 'center',
    borderRadius: 24,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  avatarText: {
    fontSize: 30,
    fontWeight: '800',
  },
  heroBody: {
    flex: 1,
    gap: 6,
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
  heroBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeText: {
    fontSize: 12,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metaCard: {
    borderRadius: 20,
    flexBasis: '47%',
    flexGrow: 1,
    gap: 6,
    minHeight: 88,
    padding: 16,
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
  infoCard: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  infoRow: {
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
  rolesHint: {
    color: '#6F8499',
    lineHeight: 20,
  },
  roleWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleChip: {
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  roleChipText: {
    fontSize: 12,
  },
});
