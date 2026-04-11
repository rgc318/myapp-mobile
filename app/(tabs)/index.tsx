import { Link, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getAppPreferences } from '@/lib/app-preferences';
import { useAuth } from '@/providers/auth-provider';

type Shortcut = {
  href: Href;
  label: string;
  icon:
    | 'cart.fill'
    | 'shippingbox.fill'
    | 'doc.text.fill'
    | 'person.fill'
    | 'building.2.fill'
    | 'gearshape.fill'
    | 'magnifyingglass'
    | 'ruler.fill';
};

function ShortcutItem({ item }: { item: Shortcut }) {
  const tintColor = useThemeColor({}, 'tint');
  return (
    <Link asChild href={item.href}>
      <Pressable style={styles.shortcutItem}>
        <View style={styles.shortcutInner}>
          <IconSymbol color={tintColor} name={item.icon} size={22} />
          <ThemedText style={styles.shortcutLabel}>{item.label}</ThemedText>
        </View>
      </Pressable>
    </Link>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <ThemedText style={styles.statLabel}>{label}</ThemedText>
      <ThemedText style={styles.statValue} type="title">
        {value}
      </ThemedText>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { profile, roles } = useAuth();
  const preferences = getAppPreferences();
  const [searchText, setSearchText] = useState('');
  const tintColor = useThemeColor({}, 'tint');
  const surface = useThemeColor({}, 'surface');
  const borderColor = useThemeColor({}, 'border');

  const canUseSales =
    roles.length === 0 ||
    roles.some((role) =>
      ['Sales User', 'Sales Manager', 'Accounts User', 'Accounts Manager', 'System Manager'].includes(role),
    );
  const canUsePurchase =
    roles.length === 0 ||
    roles.some((role) =>
      ['Purchase User', 'Purchase Manager', 'Accounts User', 'Accounts Manager', 'System Manager'].includes(role),
    );

  const shortcuts: Shortcut[] = [
    ...(canUseSales
      ? [
          {
            href: '/(tabs)/sales',
            label: '销售台',
            icon: 'cart.fill' as const,
          },
        ]
      : []),
    { href: '/common/products', label: '商品', icon: 'magnifyingglass' },
    { href: '/common/customers', label: '客户', icon: 'building.2.fill' },
    { href: '/common/uoms', label: '单位', icon: 'ruler.fill' },
    { href: '/settings', label: '设置', icon: 'gearshape.fill' },
    ...(canUsePurchase
      ? [
          {
            href: { pathname: '/purchase/order/create', params: { returnTo: '/(tabs)' } } as Href,
            label: '进货',
            icon: 'shippingbox.fill' as const,
          },
          { href: '/common/suppliers', label: '供应商', icon: 'building.2.fill' as const },
        ]
      : []),
    { href: '/(tabs)/docs', label: '报表', icon: 'doc.text.fill' },
    { href: '/(tabs)/me', label: '我的', icon: 'person.fill' },
  ];

  const handleSearch = () => {
    const query = searchText.trim();
    router.push(query ? ({ pathname: '/common/products', params: { query } } as Href) : '/common/products');
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.page}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.hero}>
            <View style={styles.heroOverlay} />
            <View style={styles.heroTop}>
              <View style={styles.heroCopy}>
                <ThemedText style={styles.heroKicker}>RGC FLOW</ThemedText>
                <ThemedText style={styles.heroQuestion}>欢迎回来</ThemedText>
                <ThemedText style={styles.heroSubline}>
                  {profile?.fullName || profile?.username || '当前操作员'}
                </ThemedText>
                <ThemedText style={styles.heroHint}>从这里进入今天最常用的业务入口。</ThemedText>
              </View>
              <View style={styles.heroChip}>
                <ThemedText style={styles.heroChipText}>业务首页</ThemedText>
              </View>
            </View>
          </View>

          <View style={[styles.statsPanel, { backgroundColor: surface, borderColor }]}>
            <View style={styles.statsHeader}>
              <View style={styles.statsTitleGroup}>
                <ThemedText type="defaultSemiBold">关键数据</ThemedText>
                <ThemedText style={styles.statsCaption}>业务页面会优先读取这里的默认配置。</ThemedText>
              </View>
              <ThemedText style={styles.statsDate}>更新于 {new Date().toISOString().slice(0, 10)}</ThemedText>
            </View>
            <View style={styles.statsGrid}>
              <StatCard label="默认公司" value={preferences.defaultCompany} />
              <StatCard label="默认仓库" value={preferences.defaultWarehouse} />
            </View>
          </View>

          <View style={styles.primaryActions}>
            {canUseSales ? (
              <Link
                href={{ pathname: '/sales/order/create', params: { returnTo: '/(tabs)' } }}
                style={[styles.primaryCard, styles.primaryCardStrong]}>
                <ThemedText style={styles.primaryCardText}>销售开单</ThemedText>
              </Link>
            ) : null}
            <Link href="/common/products" style={[styles.primaryCard, styles.primaryCardSoft]}>
              <ThemedText style={styles.primaryCardText}>商品管理</ThemedText>
            </Link>
          </View>

          <View style={[styles.searchBar, { backgroundColor: surface, borderColor }]}>
            <IconSymbol color={tintColor} name="magnifyingglass" size={18} />
            <TextInput
              onChangeText={setSearchText}
              onSubmitEditing={handleSearch}
              placeholder="搜索商品 / 仓库 / 订单"
              placeholderTextColor="rgba(31,42,55,0.45)"
              style={styles.searchInput}
              value={searchText}
            />
          </View>

          <View style={styles.shortcutGrid}>
            {shortcuts.map((item) => (
              <ShortcutItem item={item} key={item.label} />
            ))}
          </View>

        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  safeArea: {
    backgroundColor: '#F97316',
    flex: 1,
  },
  content: {
    gap: 14,
    paddingBottom: 40,
  },
  hero: {
    backgroundColor: '#F97316',
    minHeight: 178,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingBottom: 20,
    paddingTop: 20,
  },
  heroOverlay: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    height: 220,
    position: 'absolute',
    right: -40,
    top: -36,
    width: 220,
  },
  heroTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroCopy: {
    flex: 1,
    gap: 4,
    paddingRight: 12,
  },
  heroKicker: {
    color: 'rgba(255,248,241,0.74)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginBottom: 2,
  },
  heroQuestion: {
    color: '#FFF8F1',
    fontSize: 28,
    fontWeight: '700',
  },
  heroSubline: {
    color: 'rgba(255,248,241,0.9)',
    fontSize: 17,
    fontWeight: '600',
    marginTop: 2,
  },
  heroHint: {
    color: 'rgba(255,248,241,0.84)',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
    maxWidth: 260,
  },
  heroChip: {
    backgroundColor: '#FFE083',
    borderRadius: 999,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  heroChipText: {
    color: '#7C2D12',
    fontSize: 14,
    fontWeight: '700',
  },
  statsPanel: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    marginHorizontal: 12,
    marginTop: -34,
    padding: 18,
  },
  statsHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statsTitleGroup: {
    flex: 1,
    gap: 4,
    paddingRight: 12,
  },
  statsCaption: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
  },
  statsDate: {
    color: '#64748B',
    fontSize: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    minHeight: 92,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  statLabel: {
    color: '#64748B',
    fontSize: 13,
  },
  statValue: {
    fontSize: 18,
    lineHeight: 25,
  },
  primaryActions: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 12,
  },
  primaryCard: {
    borderRadius: 16,
    flex: 1,
    minHeight: 82,
    paddingHorizontal: 16,
    paddingVertical: 18,
    textDecorationLine: 'none',
  },
  primaryCardStrong: {
    backgroundColor: '#4D9FFF',
  },
  primaryCardSoft: {
    backgroundColor: '#67D7FF',
  },
  primaryCardText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  searchBar: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 12,
    minHeight: 56,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    minHeight: 36,
    paddingVertical: 0,
  },
  shortcutGrid: {
    columnGap: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginHorizontal: 24,
    rowGap: 18,
    paddingTop: 6,
  },
  shortcutItem: {
    alignItems: 'center',
    borderRadius: 18,
    justifyContent: 'center',
    minHeight: 76,
    width: '29%',
  },
  shortcutInner: {
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
  },
  shortcutLabel: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
});
