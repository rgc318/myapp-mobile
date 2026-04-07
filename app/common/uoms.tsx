import { useRouter } from 'expo-router';
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useFeedback } from '@/providers/feedback-provider';
import { fetchUoms, type UomDetail } from '@/services/uoms';

function HeroStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <View style={[styles.heroStatCard, { borderColor: `${accent}33`, backgroundColor: `${accent}12` }]}>
      <ThemedText style={styles.heroStatLabel}>{label}</ThemedText>
      <ThemedText style={[styles.heroStatValue, { color: accent }]} type="defaultSemiBold">
        {value}
      </ThemedText>
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const surface = useThemeColor({}, 'surface');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.filterChip,
        {
          backgroundColor: active ? surface : 'rgba(255,255,255,0.58)',
          borderColor: active ? tintColor : borderColor,
        },
      ]}>
      <ThemedText style={[styles.filterChipText, active ? { color: tintColor } : null]} type="defaultSemiBold">
        {label}
      </ThemedText>
    </Pressable>
  );
}

function UomCard({ item }: { item: UomDetail }) {
  const router = useRouter();
  const surface = useThemeColor({}, 'surface');
  const borderColor = useThemeColor({}, 'border');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const tintColor = useThemeColor({}, 'tint');
  const success = useThemeColor({}, 'success');
  const danger = useThemeColor({}, 'danger');
  const warning = useThemeColor({}, 'warning');
  const displayName = item.displayName || item.uomName || item.name;
  const showDisplayNameRow = displayName !== item.name;
  const descriptionText = item.description?.trim() || '暂无业务说明，建议进入详情补充使用场景和录入规则。';
  const symbolText = item.symbol || '未设置';
  const statusText = item.enabled ? '启用中' : '已停用';
  const ruleText = item.mustBeWholeNumber ? '必须整数' : '允许小数';

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/common/uom/[uomName]',
          params: { uomName: item.name },
        })
      }
      style={[styles.card, { backgroundColor: surface, borderColor }]}>
        <View style={styles.cardTopRow}>
          <View style={styles.cardTitleWrap}>
            <View style={styles.cardEyebrowRow}>
              <View style={[styles.cardEyebrowDot, { backgroundColor: item.enabled ? success : danger }]} />
              <ThemedText style={styles.cardEyebrow}>UNIT PROFILE</ThemedText>
            </View>

            <View style={styles.cardTitleRow}>
              <ThemedText numberOfLines={2} style={styles.cardTitle} type="defaultSemiBold">
                {displayName}
              </ThemedText>
              {item.symbol ? (
                <View style={[styles.symbolChip, { backgroundColor: `${tintColor}15` }]}>
                  <ThemedText style={[styles.symbolChipText, { color: tintColor }]} type="defaultSemiBold">
                    {item.symbol}
                  </ThemedText>
                </View>
              ) : null}
            </View>

            <ThemedText numberOfLines={1} style={styles.cardMeta}>
              系统编码 {item.name}
            </ThemedText>
          </View>

          <View style={styles.cardStatusCol}>
            <View
              style={[
                styles.statusChip,
                styles.primaryStatusChip,
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
                styles.secondaryStatusChip,
                { backgroundColor: item.mustBeWholeNumber ? 'rgba(245,158,11,0.14)' : 'rgba(59,130,246,0.12)' },
              ]}>
              <ThemedText
                style={[styles.statusChipText, { color: item.mustBeWholeNumber ? warning : tintColor }]}
                type="defaultSemiBold">
                {item.mustBeWholeNumber ? '必须整数' : '允许小数'}
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.inlineMetaRow}>
          <View style={styles.inlineMetaItem}>
            <ThemedText style={styles.inlineMetaLabel}>符号</ThemedText>
            <ThemedText style={styles.inlineMetaValue} type="defaultSemiBold">
              {symbolText}
            </ThemedText>
          </View>
          <View style={styles.inlineMetaItem}>
            <ThemedText style={styles.inlineMetaLabel}>录入</ThemedText>
            <ThemedText style={styles.inlineMetaValue} type="defaultSemiBold">
              {ruleText}
            </ThemedText>
          </View>
          <View style={styles.inlineMetaItem}>
            <ThemedText style={styles.inlineMetaLabel}>状态</ThemedText>
            <ThemedText style={styles.inlineMetaValue} type="defaultSemiBold">
              {statusText}
            </ThemedText>
          </View>
        </View>

        <View style={[styles.infoPanel, { backgroundColor: surfaceMuted }]}>
          {showDisplayNameRow ? (
            <View style={styles.infoRow}>
              <ThemedText style={styles.infoLabel}>显示名称</ThemedText>
              <ThemedText numberOfLines={1} style={styles.infoValue} type="defaultSemiBold">
                {displayName}
              </ThemedText>
            </View>
          ) : null}
          <View style={styles.infoRow}>
            <ThemedText style={styles.infoLabel}>单位符号</ThemedText>
            <ThemedText numberOfLines={1} style={styles.infoValue} type="defaultSemiBold">
              {symbolText}
            </ThemedText>
          </View>
          <View style={styles.infoRow}>
            <ThemedText style={styles.infoLabel}>业务说明</ThemedText>
            <ThemedText numberOfLines={3} style={styles.infoValue} type="defaultSemiBold">
              {descriptionText}
            </ThemedText>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <ThemedText numberOfLines={1} style={styles.cardFooterText}>
            进入详情维护启停状态、符号和业务说明
          </ThemedText>
          <View style={styles.cardFooterAction}>
            <ThemedText style={[styles.cardFooterActionText, { color: tintColor }]} type="defaultSemiBold">
              查看
            </ThemedText>
            <IconSymbol color={tintColor} name="chevron.right" size={14} />
          </View>
        </View>
      </Pressable>
    );
}

export default function UomsScreen() {
  const router = useRouter();
  const { showError } = useFeedback();
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
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
          searchKey: deferredQuery.trim() || undefined,
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
    [deferredQuery, enabledFilter, showError, wholeFilter],
  );

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const summary = useMemo(
    () => ({
      totalCount: items.length,
      enabledCount: items.filter((item) => item.enabled).length,
      pausedCount: items.filter((item) => !item.enabled).length,
      wholeCount: items.filter((item) => item.mustBeWholeNumber).length,
    }),
    [items],
  );

  return (
    <AppShell
      compactHeader
      contentCard={false}
      description="统一维护单位显示、整数规则和启停状态，让商品、销售、采购和库存页面共用同一套口径。"
      title="单位管理">
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl onRefresh={() => void loadItems(true)} refreshing={isRefreshing} />}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.heroCard, { backgroundColor: surface, borderColor }]}>
          <View style={styles.heroGlowBlue} />
          <View style={styles.heroGlowAmber} />

          <View style={styles.heroTopRow}>
            <View style={styles.heroCopy}>
              <ThemedText style={styles.heroEyebrow}>UOM STUDIO</ThemedText>
              <ThemedText style={styles.heroTitle} type="title">
                单位工作台
              </ThemedText>
              <ThemedText style={styles.heroDescription}>
                把显示名称、符号、整数规则和启停状态集中到一个界面里管理，避免商品和单据页面继续出现中英文混用。
              </ThemedText>
            </View>

            <Pressable onPress={() => router.push('/common/uom/create')} style={[styles.primaryAction, { backgroundColor: tintColor }]}>
              <IconSymbol color="#FFFFFF" name="plus" size={16} />
              <ThemedText style={styles.primaryActionText} type="defaultSemiBold">
                新增单位
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.heroStatRow}>
            <HeroStat accent="#2563EB" label="当前结果" value={`${summary.totalCount}`} />
            <HeroStat accent="#059669" label="启用单位" value={`${summary.enabledCount}`} />
            <HeroStat accent="#D97706" label="必须整数" value={`${summary.wholeCount}`} />
          </View>
        </View>

        <View style={[styles.filterPanel, { backgroundColor: surface, borderColor }]}>
          <View style={styles.panelHeader}>
            <View style={styles.panelHeaderCopy}>
              <ThemedText style={styles.panelTitle} type="defaultSemiBold">
                快速筛选
              </ThemedText>
              <ThemedText style={styles.panelHint}>先按状态和录入规则缩小范围，再进入详情做修改。</ThemedText>
            </View>
            <View style={[styles.summaryBadge, { backgroundColor: surfaceMuted }]}>
              <ThemedText style={styles.summaryBadgeText} type="defaultSemiBold">
                停用 {summary.pausedCount}
              </ThemedText>
            </View>
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

          <View style={styles.filterSection}>
            <ThemedText style={styles.filterLabel}>状态</ThemedText>
            <View style={[styles.filterRail, { backgroundColor: surfaceMuted }]}>
              {[
                { label: '启用中', value: 1 as const },
                { label: '全部状态', value: null },
                { label: '已停用', value: 0 as const },
              ].map((option) => (
                <FilterChip
                  active={enabledFilter === option.value}
                  key={option.label}
                  label={option.label}
                  onPress={() => setEnabledFilter(option.value)}
                />
              ))}
            </View>
          </View>

          <View style={styles.filterSection}>
            <ThemedText style={styles.filterLabel}>录入规则</ThemedText>
            <View style={[styles.filterRail, { backgroundColor: surfaceMuted }]}>
              {[
                { label: '全部规则', value: null },
                { label: '必须整数', value: 1 as const },
                { label: '允许小数', value: 0 as const },
              ].map((option) => (
                <FilterChip
                  active={wholeFilter === option.value}
                  key={option.label}
                  label={option.label}
                  onPress={() => setWholeFilter(option.value)}
                />
              ))}
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderCopy}>
            <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
              单位目录
            </ThemedText>
            <ThemedText style={styles.sectionHint}>
              {isLoading ? '正在同步单位列表…' : `共找到 ${summary.totalCount} 个单位，点击卡片进入详情。`}
            </ThemedText>
          </View>
        </View>

        <View style={styles.listWrap}>
          {items.length ? (
            items.map((item) => <UomCard item={item} key={item.name} />)
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: surface, borderColor }]}>
              <View style={[styles.emptyIconWrap, { backgroundColor: surfaceMuted }]}>
                <IconSymbol color={tintColor} name="ruler.fill" size={22} />
              </View>
              <ThemedText style={styles.emptyTitle} type="defaultSemiBold">
                {isLoading ? '正在加载单位…' : '没有匹配的单位'}
              </ThemedText>
              <ThemedText style={styles.emptyHint}>
                {isLoading ? '请稍候。' : '换个关键词试试，或者直接新增一个业务单位。'}
              </ThemedText>
              {!isLoading ? (
                <Pressable onPress={() => router.push('/common/uom/create')} style={[styles.emptyAction, { backgroundColor: tintColor }]}>
                  <ThemedText style={styles.emptyActionText} type="defaultSemiBold">
                    去新增单位
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>
          )}
        </View>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
    paddingBottom: 28,
  },
  heroCard: {
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 18,
    position: 'relative',
  },
  heroGlowBlue: {
    backgroundColor: 'rgba(59,130,246,0.16)',
    borderRadius: 999,
    height: 164,
    position: 'absolute',
    right: -36,
    top: -56,
    width: 164,
  },
  heroGlowAmber: {
    backgroundColor: 'rgba(251,191,36,0.14)',
    borderRadius: 999,
    bottom: -74,
    height: 148,
    left: -52,
    position: 'absolute',
    width: 148,
  },
  heroTopRow: {
    gap: 14,
  },
  heroCopy: {
    gap: 6,
  },
  heroEyebrow: {
    color: '#2563EB',
    fontSize: 12,
    letterSpacing: 1.1,
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 34,
  },
  heroDescription: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 21,
    maxWidth: '92%',
  },
  primaryAction: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 8,
    minHeight: 46,
    paddingHorizontal: 16,
    textDecorationLine: 'none',
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 15,
  },
  heroStatRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 18,
  },
  heroStatCard: {
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    gap: 6,
    minHeight: 88,
    minWidth: '30%',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  heroStatLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  heroStatValue: {
    fontSize: 24,
    lineHeight: 30,
  },
  filterPanel: {
    borderRadius: 26,
    borderWidth: 1,
    gap: 16,
    padding: 18,
  },
  panelHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  panelHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  panelTitle: {
    fontSize: 20,
  },
  panelHint: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 18,
  },
  summaryBadge: {
    borderRadius: 999,
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  summaryBadgeText: {
    color: '#475569',
    fontSize: 12,
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
  filterSection: {
    gap: 8,
  },
  filterLabel: {
    color: '#64748B',
    fontSize: 13,
  },
  filterRail: {
    borderRadius: 18,
    flexDirection: 'row',
    gap: 8,
    padding: 6,
  },
  filterChip: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 8,
  },
  filterChipText: {
    fontSize: 14,
  },
  sectionHeader: {
    paddingHorizontal: 2,
  },
  sectionHeaderCopy: {
    gap: 4,
  },
  sectionTitle: {
    fontSize: 20,
  },
  sectionHint: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 18,
  },
  listWrap: {
    gap: 12,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    padding: 16,
    textDecorationLine: 'none',
  },
  cardTopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  cardTitleWrap: {
    flex: 1,
    gap: 5,
    minWidth: 0,
  },
  cardEyebrowRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  cardEyebrowDot: {
    borderRadius: 999,
    height: 7,
    width: 7,
  },
  cardEyebrow: {
    color: '#64748B',
    fontSize: 11,
    letterSpacing: 0.8,
  },
  cardTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cardTitle: {
    flexShrink: 1,
    fontSize: 18,
    lineHeight: 24,
  },
  symbolChip: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  symbolChipText: {
    fontSize: 12,
  },
  cardMeta: {
    color: '#64748B',
    fontSize: 13,
  },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  cardStatusCol: {
    alignItems: 'flex-end',
    flexShrink: 0,
    gap: 8,
    marginLeft: 8,
  },
  primaryStatusChip: {
    minWidth: 66,
  },
  secondaryStatusChip: {
    opacity: 0.94,
  },
  statusChipText: {
    fontSize: 12,
  },
  inlineMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  inlineMetaItem: {
    flexDirection: 'row',
    gap: 6,
  },
  inlineMetaLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  inlineMetaValue: {
    color: '#334155',
    fontSize: 12,
  },
  infoPanel: {
    borderRadius: 18,
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  infoRow: {
    gap: 4,
  },
  infoLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  infoValue: {
    color: '#1E293B',
    fontSize: 14,
    lineHeight: 19,
  },
  cardFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  cardFooterText: {
    color: '#64748B',
    flex: 1,
    minWidth: '60%',
    fontSize: 12,
    lineHeight: 17,
  },
  cardFooterAction: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  cardFooterActionText: {
    fontSize: 13,
  },
  emptyCard: {
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  emptyIconWrap: {
    alignItems: 'center',
    borderRadius: 18,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  emptyTitle: {
    fontSize: 18,
  },
  emptyHint: {
    color: '#64748B',
    lineHeight: 20,
    textAlign: 'center',
  },
  emptyAction: {
    alignItems: 'center',
    borderRadius: 14,
    justifyContent: 'center',
    marginTop: 6,
    minHeight: 44,
    paddingHorizontal: 16,
    textDecorationLine: 'none',
  },
  emptyActionText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
});
