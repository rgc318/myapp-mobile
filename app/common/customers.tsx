import { Link } from 'expo-router';
import type { Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useFeedback } from '@/providers/feedback-provider';
import { fetchCustomers, type CustomerDetail } from '@/services/customers';

function QuickActionTile({
  href,
  icon,
  label,
  description,
}: {
  href: Href;
  icon: string;
  label: string;
  description?: string;
}) {
  const surface = useThemeColor({}, 'surface');
  const borderColor = useThemeColor({}, 'border');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const tintColor = useThemeColor({}, 'tint');

  return (
    <Link href={href} style={[styles.quickActionTile, { backgroundColor: surface, borderColor }]}>
      <View style={[styles.quickActionIconWrap, { backgroundColor: surfaceMuted }]}>
        <IconSymbol color={tintColor} name={icon} size={18} />
      </View>
      <View style={styles.quickActionCopy}>
        <ThemedText style={styles.quickActionLabel} type="defaultSemiBold">
          {label}
        </ThemedText>
        {description ? <ThemedText style={styles.quickActionDescription}>{description}</ThemedText> : null}
      </View>
    </Link>
  );
}

function CustomerCard({ item }: { item: CustomerDetail }) {
  const surface = useThemeColor({}, 'surface');
  const borderColor = useThemeColor({}, 'border');
  const success = useThemeColor({}, 'success');
  const danger = useThemeColor({}, 'danger');
  const tintColor = useThemeColor({}, 'tint');

  return (
    <Link
      href={{ pathname: '/common/customer/[customerName]', params: { customerName: item.name } } as Href}
      style={[styles.card, { backgroundColor: surface, borderColor }]}>
      <View style={styles.cardTopRow}>
        <View style={styles.cardMainCopy}>
          <ThemedText style={styles.cardTitle} type="defaultSemiBold">
            {item.displayName || item.customerName || item.name}
          </ThemedText>
          <ThemedText style={styles.cardMeta}>编码 {item.name}</ThemedText>
          <ThemedText numberOfLines={1} style={[styles.cardGroupMeta, { color: tintColor }]} type="defaultSemiBold">
            {item.customerGroup || '未设置客户分组'}
          </ThemedText>
        </View>
        <View
          style={[
            styles.statusChip,
            { backgroundColor: item.disabled ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)' },
          ]}>
          <ThemedText
            style={[styles.statusChipText, { color: item.disabled ? danger : success }]}
            type="defaultSemiBold">
            {item.disabled ? '已停用' : '启用中'}
          </ThemedText>
        </View>
      </View>
    </Link>
  );
}

export default function CustomersScreen() {
  const { showError } = useFeedback();
  const [query, setQuery] = useState('');
  const [disabledFilter, setDisabledFilter] = useState<number | null>(0);
  const [items, setItems] = useState<CustomerDetail[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const surface = useThemeColor({}, 'surface');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');

  const loadItems = useCallback(
    async (refresh = false) => {
      try {
        if (refresh) {
          setIsRefreshing(true);
        }
        const result = await fetchCustomers({
          searchKey: query.trim() || undefined,
          disabled: disabledFilter,
        });
        setItems(result.items);
      } catch (error) {
        showError(error instanceof Error ? error.message : '加载客户失败');
      } finally {
        setIsRefreshing(false);
      }
    },
    [disabledFilter, query, showError],
  );

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const summary = useMemo(
    () => ({
      activeCount: items.filter((item) => !item.disabled).length,
      contactCount: items.filter((item) => item.defaultContact?.displayName).length,
    }),
    [items],
  );

  return (
    <AppShell compactHeader contentCard={false} description="维护客户主数据、默认联系人和默认地址，供订单、开票和收款流程复用。" title="客户管理">
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl onRefresh={() => void loadItems(true)} refreshing={isRefreshing} />}
        showsVerticalScrollIndicator={false}>
        <View style={styles.quickActionsRow}>
          <QuickActionTile
            description="补充默认联系人、地址和价格表"
            href={'/common/customer/create'}
            icon="person.fill"
            label="新增客户"
          />
        </View>

        <View style={[styles.searchPanel, { backgroundColor: surface, borderColor }]}>
          <View style={styles.searchPanelHeader}>
            <ThemedText style={styles.searchPanelTitle} type="defaultSemiBold">
              客户总览
            </ThemedText>
            <ThemedText style={styles.searchPanelHint}>按名称、编码、手机号或邮箱检索客户，快速进入详情维护。</ThemedText>
          </View>

          <View style={[styles.searchBar, { backgroundColor: surfaceMuted, borderColor }]}>
            <IconSymbol color={tintColor} name="magnifyingglass" size={18} />
            <TextInput
              onChangeText={setQuery}
              placeholder="搜索客户名称、编码、手机号、邮箱"
              placeholderTextColor="rgba(31,42,55,0.42)"
              style={styles.searchInput}
              value={query}
            />
          </View>

          <View style={[styles.segmentedWrap, { backgroundColor: surfaceMuted }]}>
            {[
              { label: '启用中', value: 0 as const },
              { label: '全部状态', value: null },
              { label: '已停用', value: 1 as const },
            ].map((option) => {
              const active = disabledFilter === option.value;
              return (
                <Pressable
                  key={option.label}
                  onPress={() => setDisabledFilter(option.value)}
                  style={[styles.segmentedOption, active ? { backgroundColor: surface, borderColor } : null]}>
                  <ThemedText style={[styles.segmentedText, active ? { color: tintColor } : null]} type="defaultSemiBold">
                    {option.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.summaryRowStats}>
            <View style={[styles.summaryCard, { backgroundColor: surfaceMuted }]}>
              <ThemedText style={styles.summaryStatLabel}>启用客户</ThemedText>
              <ThemedText style={styles.summaryStatValue} type="defaultSemiBold">
                {summary.activeCount}
              </ThemedText>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: surfaceMuted }]}>
              <ThemedText style={styles.summaryStatLabel}>已设联系人</ThemedText>
              <ThemedText style={styles.summaryStatValue} type="defaultSemiBold">
                {summary.contactCount}
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.listWrap}>
          {items.length ? (
            items.map((item) => <CustomerCard item={item} key={item.name} />)
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: surface, borderColor }]}>
              <ThemedText style={styles.emptyTitle} type="defaultSemiBold">
                没有匹配的客户
              </ThemedText>
              <ThemedText style={styles.emptyHint}>换个关键词试试，或者直接新增客户主数据。</ThemedText>
            </View>
          )}
        </View>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 14,
    paddingBottom: 24,
  },
  quickActionsRow: {
    gap: 12,
  },
  quickActionTile: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 92,
    padding: 18,
    textDecorationLine: 'none',
  },
  quickActionIconWrap: {
    alignItems: 'center',
    borderRadius: 18,
    height: 44,
    justifyContent: 'center',
    marginTop: 3,
    width: 44,
  },
  quickActionCopy: {
    flex: 1,
    gap: 2,
    justifyContent: 'center',
    marginLeft: 10,
  },
  quickActionLabel: {
    fontSize: 17,
    lineHeight: 22,
  },
  quickActionDescription: {
    lineHeight: 20,
    opacity: 0.72,
  },
  searchPanel: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  searchPanelHeader: {
    gap: 4,
  },
  searchPanelTitle: {
    fontSize: 19,
  },
  searchPanelHint: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 18,
  },
  searchBar: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 54,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    minHeight: 44,
  },
  segmentedWrap: {
    borderRadius: 18,
    flexDirection: 'row',
    gap: 8,
    padding: 6,
  },
  segmentedOption: {
    alignItems: 'center',
    borderColor: '#DEE4EA',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  segmentedText: {
    fontSize: 14,
  },
  summaryRowStats: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryCard: {
    borderRadius: 18,
    flex: 1,
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  summaryStatLabel: {
    color: '#64748B',
    fontSize: 13,
  },
  summaryStatValue: {
    fontSize: 24,
    lineHeight: 30,
  },
  listWrap: {
    gap: 12,
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    padding: 18,
    textDecorationLine: 'none',
  },
  cardTopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  cardMainCopy: {
    flex: 1,
    gap: 5,
  },
  cardTitle: {
    flexShrink: 1,
    fontSize: 18,
    lineHeight: 24,
  },
  cardMeta: {
    color: '#64748B',
    fontSize: 14,
  },
  cardGroupMeta: {
    fontSize: 15,
    lineHeight: 20,
  },
  statusChip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    marginTop: 2,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusChipText: {
    fontSize: 14,
  },
  emptyCard: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 24,
  },
  emptyTitle: {
    fontSize: 18,
  },
  emptyHint: {
    color: '#64748B',
    textAlign: 'center',
  },
});
