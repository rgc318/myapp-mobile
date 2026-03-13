import { Link, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getAppPreferences } from '@/lib/app-preferences';
import { useAuth } from '@/providers/auth-provider';

type Shortcut = {
  href: Href;
  label: string;
  icon: 'cart.fill' | 'shippingbox.fill' | 'doc.text.fill' | 'person.fill' | 'gearshape.fill' | 'magnifyingglass';
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
  const background = useThemeColor({}, 'background');

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
    ...(canUseSales ? [{ href: '/sales/order/create' as Href, label: '销售', icon: 'cart.fill' as const }] : []),
    { href: '/common/product-search', label: '商品', icon: 'magnifyingglass' },
    { href: '/settings', label: '设置', icon: 'gearshape.fill' },
    ...(canUsePurchase ? [{ href: '/purchase/order/create' as Href, label: '进货', icon: 'shippingbox.fill' as const }] : []),
    { href: '/(tabs)/docs', label: '对账', icon: 'doc.text.fill' },
    { href: '/(tabs)/me', label: '我的', icon: 'person.fill' },
  ];

  const handleSearch = () => {
    const query = searchText.trim();
    router.push(query ? ({ pathname: '/common/product-search', params: { query } } as Href) : '/common/product-search');
  };

  return (
    <View style={[styles.page, { backgroundColor: background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroOverlay} />
          <View style={styles.heroTop}>
            <View>
              <ThemedText style={styles.heroQuestion}>有订单要处理？</ThemedText>
              <ThemedText style={styles.heroSubline}>
                {profile?.fullName || profile?.username || '当前操作员'}
              </ThemedText>
            </View>
            <Pressable style={styles.heroChip}>
              <ThemedText style={styles.heroChipText}>去处理</ThemedText>
            </Pressable>
          </View>
        </View>

        <View style={[styles.statsPanel, { backgroundColor: surface, borderColor }]}>
          <View style={styles.statsHeader}>
            <ThemedText type="defaultSemiBold">关键数据</ThemedText>
            <ThemedText style={styles.statsDate}>更新于 {new Date().toISOString().slice(0, 10)}</ThemedText>
          </View>
          <View style={styles.statsGrid}>
            <StatCard label="默认公司" value={preferences.defaultCompany} />
            <StatCard label="默认仓库" value={preferences.defaultWarehouse} />
          </View>
        </View>

        <View style={styles.primaryActions}>
          {canUseSales ? (
            <Link href="/sales/order/create" style={[styles.primaryCard, styles.primaryCardStrong]}>
              <ThemedText style={styles.primaryCardText}>销售开单</ThemedText>
            </Link>
          ) : null}
          <Link href="/common/product-search" style={[styles.primaryCard, styles.primaryCardSoft]}>
            <ThemedText style={styles.primaryCardText}>商品查价</ThemedText>
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

        <View style={[styles.noticeBar, { backgroundColor: surface, borderColor }]}>
          <ThemedText style={styles.noticeText}>
            销售模式：{preferences.salesFlowMode === 'quick' ? '快捷结算' : '分步处理'} / 采购模式：
            {preferences.purchaseFlowMode === 'immediate' ? '收货并结算' : '收货后结算'}
          </ThemedText>
          <Link href="/settings" style={styles.noticeAction}>
            <ThemedText style={styles.noticeActionText}>立即设置</ThemedText>
          </Link>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  content: {
    gap: 12,
    paddingBottom: 40,
  },
  hero: {
    backgroundColor: '#F97316',
    minHeight: 164,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingTop: 18,
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
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroQuestion: {
    color: '#FFF8F1',
    fontSize: 18,
    fontWeight: '700',
  },
  heroSubline: {
    color: 'rgba(255,248,241,0.9)',
    marginTop: 6,
  },
  heroChip: {
    backgroundColor: '#FFE083',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  heroChipText: {
    color: '#7C2D12',
    fontWeight: '700',
  },
  statsPanel: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    marginHorizontal: 12,
    marginTop: -34,
    padding: 16,
  },
  statsHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statsDate: {
    opacity: 0.62,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    gap: 8,
  },
  statLabel: {
    opacity: 0.6,
  },
  statValue: {
    fontSize: 18,
  },
  primaryActions: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 12,
  },
  primaryCard: {
    borderRadius: 16,
    flex: 1,
    minHeight: 72,
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
    fontSize: 16,
    fontWeight: '700',
  },
  searchBar: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 12,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
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
    justifyContent: 'center',
    minHeight: 62,
    width: '29%',
  },
  shortcutInner: {
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  shortcutLabel: {
    fontSize: 13,
    textAlign: 'center',
  },
  noticeBar: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    marginHorizontal: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  noticeText: {
    flex: 1,
    opacity: 0.72,
  },
  noticeAction: {
    backgroundColor: '#2DD4BF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    textDecorationLine: 'none',
  },
  noticeActionText: {
    color: '#FFF',
    fontWeight: '700',
  },
});
