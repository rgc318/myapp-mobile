import { Link } from 'expo-router';
import type { Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useFeedback } from '@/providers/feedback-provider';
import { fetchUoms, type UomDetail } from '@/services/uoms';

function QuickActionTile({
  href,
  icon,
  label,
  description,
}: {
  href: Href;
  icon: string;
  label: string;
  description: string;
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
        <ThemedText style={styles.quickActionDescription}>{description}</ThemedText>
      </View>
    </Link>
  );
}

function UomCard({ item }: { item: UomDetail }) {
  const surface = useThemeColor({}, 'surface');
  const borderColor = useThemeColor({}, 'border');
  const success = useThemeColor({}, 'success');
  const danger = useThemeColor({}, 'danger');
  const warning = useThemeColor({}, 'warning');
  const accentSoft = useThemeColor({}, 'accentSoft');
  const tintColor = useThemeColor({}, 'tint');

  return (
    <Link
      href={{ pathname: '/common/uom/[uomName]', params: { uomName: item.name } } as Href}
      style={[styles.card, { backgroundColor: surface, borderColor }]}>
      <View style={styles.cardTopRow}>
        <View style={styles.cardMainCopy}>
          <View style={styles.cardTitleRow}>
            <ThemedText style={styles.cardTitle} type="defaultSemiBold">
              {item.displayName || item.uomName || item.name}
            </ThemedText>
            {item.symbol ? (
              <View style={[styles.symbolChip, { backgroundColor: accentSoft }]}>
                <ThemedText style={[styles.symbolChipText, { color: tintColor }]} type="defaultSemiBold">
                  {item.symbol}
                </ThemedText>
              </View>
            ) : null}
          </View>
          <ThemedText style={styles.cardMeta}>编码 {item.name}</ThemedText>
        </View>

        <View style={styles.cardStatusCol}>
          <View
            style={[
              styles.statusChip,
              { backgroundColor: item.enabled ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)' },
            ]}>
            <ThemedText
              style={[styles.statusChipText, { color: item.enabled ? success : danger }]}
              type="defaultSemiBold">
              {item.enabled ? '启用中' : '已停用'}
            </ThemedText>
          </View>
          <View
            style={[
              styles.statusChip,
              { backgroundColor: item.mustBeWholeNumber ? 'rgba(245,158,11,0.12)' : 'rgba(59,130,246,0.12)' },
            ]}>
            <ThemedText
              style={[styles.statusChipText, { color: item.mustBeWholeNumber ? warning : tintColor }]}
              type="defaultSemiBold">
              {item.mustBeWholeNumber ? '必须整数' : '允许小数'}
            </ThemedText>
          </View>
        </View>
      </View>

      {item.description ? (
        <ThemedText numberOfLines={2} style={styles.cardDescription}>
          {item.description}
        </ThemedText>
      ) : (
        <ThemedText style={styles.cardHint}>暂无单位说明，可进入详情补充业务说明。</ThemedText>
      )}
    </Link>
  );
}

export default function UomsScreen() {
  const { showError } = useFeedback();
  const [query, setQuery] = useState('');
  const [enabledFilter, setEnabledFilter] = useState<number | null>(1);
  const [wholeFilter, setWholeFilter] = useState<number | null>(null);
  const [items, setItems] = useState<UomDetail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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
        } else {
          setIsLoading(true);
        }
        const result = await fetchUoms({
          searchKey: query.trim() || undefined,
          enabled: enabledFilter,
          mustBeWholeNumber: wholeFilter,
        });
        setItems(result.items);
      } catch (error) {
        showError(error instanceof Error ? error.message : '加载单位失败');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [enabledFilter, query, showError, wholeFilter],
  );

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const summary = useMemo(
    () => ({
      enabledCount: items.filter((item) => item.enabled).length,
      wholeCount: items.filter((item) => item.mustBeWholeNumber).length,
    }),
    [items],
  );

  return (
    <AppShell compactHeader contentCard={false} description="维护业务单位、整数规则和启停状态，给商品、订单和库存流程复用。" title="单位管理">
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl onRefresh={() => void loadItems(true)} refreshing={isRefreshing} />}
        showsVerticalScrollIndicator={false}>
        <View style={styles.quickActionsRow}>
          <QuickActionTile
            description="补充单位简称、整数规则和说明"
            href={'/common/uom/create'}
            icon="plus"
            label="新增单位"
          />
        </View>

        <View style={[styles.searchPanel, { backgroundColor: surface, borderColor }]}>
          <View style={styles.searchPanelHeader}>
            <ThemedText style={styles.searchPanelTitle} type="defaultSemiBold">
              单位总览
            </ThemedText>
            <ThemedText style={styles.searchPanelHint}>按状态和整数规则筛选，快速进入单位详情调整。</ThemedText>
          </View>

          <View style={[styles.searchBar, { backgroundColor: surfaceMuted, borderColor }]}>
            <IconSymbol color={tintColor} name="magnifyingglass" size={18} />
            <TextInput
              onChangeText={setQuery}
              placeholder="搜索单位名称、编码、符号"
              placeholderTextColor="rgba(31,42,55,0.42)"
              style={styles.searchInput}
              value={query}
            />
          </View>

          <View style={[styles.segmentedWrap, { backgroundColor: surfaceMuted }]}>
            {[
              { label: '启用中', value: 1 as const },
              { label: '全部状态', value: null },
              { label: '已停用', value: 0 as const },
            ].map((option) => {
              const active = enabledFilter === option.value;
              return (
                <Pressable
                  key={option.label}
                  onPress={() => setEnabledFilter(option.value)}
                  style={[styles.segmentedOption, active ? { backgroundColor: surface, borderColor } : null]}>
                  <ThemedText style={[styles.segmentedText, active ? { color: tintColor } : null]} type="defaultSemiBold">
                    {option.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <View style={[styles.segmentedWrap, { backgroundColor: surfaceMuted }]}>
            {[
              { label: '全部规则', value: null },
              { label: '必须整数', value: 1 as const },
              { label: '允许小数', value: 0 as const },
            ].map((option) => {
              const active = wholeFilter === option.value;
              return (
                <Pressable
                  key={option.label}
                  onPress={() => setWholeFilter(option.value)}
                  style={[styles.segmentedOption, active ? { backgroundColor: surface, borderColor } : null]}>
                  <ThemedText style={[styles.segmentedText, active ? { color: tintColor } : null]} type="defaultSemiBold">
                    {option.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, { backgroundColor: surfaceMuted }]}>
              <ThemedText style={styles.summaryLabel}>启用单位</ThemedText>
              <ThemedText style={styles.summaryValue} type="defaultSemiBold">
                {summary.enabledCount}
              </ThemedText>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: surfaceMuted }]}>
              <ThemedText style={styles.summaryLabel}>必须整数</ThemedText>
              <ThemedText style={styles.summaryValue} type="defaultSemiBold">
                {summary.wholeCount}
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.listWrap}>
          {items.length ? (
            items.map((item) => <UomCard item={item} key={item.name} />)
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: surface, borderColor }]}>
              <ThemedText style={styles.emptyTitle} type="defaultSemiBold">
                {isLoading ? '正在加载单位…' : '没有匹配的单位'}
              </ThemedText>
              <ThemedText style={styles.emptyHint}>
                {isLoading ? '请稍候。' : '换个关键词试试，或者直接新增一个业务单位。'}
              </ThemedText>
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
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    minHeight: 94,
    padding: 18,
    textDecorationLine: 'none',
  },
  quickActionIconWrap: {
    alignItems: 'center',
    borderRadius: 18,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  quickActionCopy: {
    flex: 1,
    gap: 4,
  },
  quickActionLabel: {
    fontSize: 17,
  },
  quickActionDescription: {
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
  summaryRow: {
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
  summaryLabel: {
    color: '#64748B',
    fontSize: 13,
  },
  summaryValue: {
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
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  cardMainCopy: {
    flex: 1,
    gap: 6,
  },
  cardTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cardTitle: {
    fontSize: 20,
    lineHeight: 26,
  },
  symbolChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  symbolChipText: {
    fontSize: 13,
  },
  cardMeta: {
    color: '#64748B',
    fontSize: 14,
  },
  cardStatusCol: {
    alignItems: 'flex-end',
    gap: 8,
  },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusChipText: {
    fontSize: 13,
  },
  cardDescription: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 20,
  },
  cardHint: {
    color: '#64748B',
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
