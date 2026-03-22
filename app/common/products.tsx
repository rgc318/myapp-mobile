import { Link, useLocalSearchParams } from 'expo-router';
import type { Href } from 'expo-router';
import { useDeferredValue, useEffect, useMemo, useState, useCallback } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { formatDisplayUom } from '@/lib/display-uom';
import { useFeedback } from '@/providers/feedback-provider';
import { fetchProducts, type ProductListItem } from '@/services/products';

function formatPriceLine(value: number | null | undefined, uom?: string | null) {
  const price = typeof value === 'number' ? `¥ ${value.toFixed(2)}` : '未配置';
  return `${price}${uom ? ` / ${formatDisplayUom(uom)}` : ''}`;
}

function formatQty(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '0';
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}

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

function ProductCard({ item }: { item: ProductListItem }) {
  const surface = useThemeColor({}, 'surface');
  const borderColor = useThemeColor({}, 'border');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const tintColor = useThemeColor({}, 'tint');
  const success = useThemeColor({}, 'success');
  const danger = useThemeColor({}, 'danger');
  const warning = useThemeColor({}, 'warning');

  const stockUnit = formatDisplayUom(item.stockUom);
  const warehouseCount = item.warehouseStockDetails.length || 0;

  return (
    <Link
      href={{ pathname: '/common/product/[itemCode]', params: { itemCode: item.itemCode } } as Href}
      style={[styles.card, { backgroundColor: surface, borderColor }]}>
      <View
        style={[
          styles.statusChip,
          styles.statusChipFloating,
          { backgroundColor: item.disabled ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)' },
        ]}>
        <ThemedText
          style={[styles.statusChipText, { color: item.disabled ? danger : success }]}
          type="defaultSemiBold">
          {item.disabled ? '已停用' : '启用中'}
        </ThemedText>
      </View>

      <View style={styles.cardTopBar}>
        <ThemedText ellipsizeMode="tail" numberOfLines={2} style={styles.cardTitle} type="defaultSemiBold">
          {item.itemName || item.itemCode}
        </ThemedText>
      </View>

      <View style={styles.cardAside}>
        <View style={styles.priceBoard}>
          <View style={styles.priceRow}>
            <ThemedText style={[styles.pricePillLabel, { color: tintColor }]}>批发价</ThemedText>
            <ThemedText numberOfLines={1} style={[styles.pricePillValue, { color: tintColor }]} type="defaultSemiBold">
              {formatPriceLine(item.priceSummary?.wholesaleRate, item.wholesaleDefaultUom)}
            </ThemedText>
          </View>
          <View style={styles.priceRow}>
            <ThemedText style={[styles.pricePillLabel, { color: success }]}>零售价</ThemedText>
            <ThemedText numberOfLines={1} style={[styles.pricePillValue, { color: success }]} type="defaultSemiBold">
              {formatPriceLine(item.priceSummary?.retailRate, item.retailDefaultUom)}
            </ThemedText>
          </View>
          <View style={styles.priceRow}>
            <ThemedText style={[styles.pricePillLabel, { color: warning }]}>采购价</ThemedText>
            <ThemedText numberOfLines={1} style={[styles.pricePillValue, { color: warning }]} type="defaultSemiBold">
              {formatPriceLine(item.priceSummary?.standardBuyingRate, item.stockUom)}
            </ThemedText>
          </View>
        </View>
      </View>

      <View style={styles.cardBodyRow}>
        <View style={styles.cardMainColumn}>
          <ThemedText ellipsizeMode="tail" numberOfLines={1} style={styles.metaText}>
            编码 {item.itemCode}
          </ThemedText>
          <View style={styles.metaInlineRow}>
            {item.nickname ? (
              <ThemedText ellipsizeMode="tail" numberOfLines={1} style={[styles.metaText, styles.metaInlineText]}>
                昵称 {item.nickname}
              </ThemedText>
            ) : null}
            {item.itemGroup ? (
              <ThemedText ellipsizeMode="tail" numberOfLines={1} style={[styles.metaText, styles.metaInlineText]}>
                分类 {item.itemGroup}
              </ThemedText>
            ) : null}
          </View>

          <View style={styles.metricsRow}>
            <View style={[styles.metricCard, { backgroundColor: surfaceMuted }]}>
              <ThemedText style={styles.metricLabel}>总库存</ThemedText>
              <ThemedText style={styles.metricValue} type="defaultSemiBold">
                {formatQty(item.totalQty ?? item.stockQty ?? 0)} {stockUnit}
              </ThemedText>
            </View>
            <View style={[styles.metricCard, { backgroundColor: surfaceMuted }]}>
              <ThemedText style={styles.metricLabel}>库存分布</ThemedText>
              <ThemedText style={styles.metricValue} type="defaultSemiBold">
                {warehouseCount} 个仓库
              </ThemedText>
              <ThemedText style={styles.metricMeta}>
                {warehouseCount > 1 ? `另有 ${warehouseCount - 1} 个分仓` : '当前分仓记录较少'}
              </ThemedText>
            </View>
          </View>
        </View>
      </View>
    </Link>
  );
}

export default function ProductsScreen() {
  const params = useLocalSearchParams<{ query?: string }>();
  const { showError } = useFeedback();
  const [query, setQuery] = useState(typeof params.query === 'string' ? params.query : '');
  const deferredQuery = useDeferredValue(query);
  const [disabledFilter, setDisabledFilter] = useState<0 | 1>(0);
  const [items, setItems] = useState<ProductListItem[]>([]);
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
        const nextItems = await fetchProducts({
          searchKey: deferredQuery.trim() || undefined,
          disabled: disabledFilter,
        });
        setItems(nextItems);
      } catch (error) {
        showError(error instanceof Error ? error.message : '加载商品失败');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [deferredQuery, disabledFilter, showError],
  );

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const summary = useMemo(
    () => ({
      totalStock: items.reduce((sum, item) => sum + (item.totalQty ?? 0), 0),
      activeCount: items.filter((item) => !item.disabled).length,
    }),
    [items],
  );

  return (
    <AppShell compactHeader contentCard={false} description="维护商品基础资料、价格体系、默认单位和库存分布。" title="商品管理">
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl onRefresh={() => void loadItems(true)} refreshing={isRefreshing} />}
        showsVerticalScrollIndicator={false}>
        <View style={styles.quickActionsRow}>
          <QuickActionTile
            description="补充名称、价格、单位和图片"
            href={'/common/product/create'}
            icon="plus"
            label="新增商品"
          />
          <QuickActionTile
            description="现场快速查价和看库存"
            href={'/common/product-search?mode=lookup'}
            icon="magnifyingglass"
            label="商品查价"
          />
        </View>

        <View style={[styles.searchPanel, { backgroundColor: surface, borderColor }]}>
          <View style={styles.searchPanelHeader}>
            <ThemedText style={styles.searchPanelTitle} type="defaultSemiBold">
              商品总览
            </ThemedText>
            <ThemedText style={styles.searchPanelHint}>按状态筛选、搜索商品，并快速查看价格和库存分布。</ThemedText>
          </View>

          <View style={[styles.searchBar, { backgroundColor: surfaceMuted, borderColor }]}>
            <IconSymbol color={tintColor} name="magnifyingglass" size={18} />
            <TextInput
              onChangeText={setQuery}
              placeholder="搜索商品名称、编码、昵称"
              placeholderTextColor="rgba(31,42,55,0.42)"
              style={styles.searchInput}
              value={query}
            />
          </View>

          <View style={[styles.segmentedWrap, { backgroundColor: surfaceMuted }]}>
            {[
              { label: '启用中', value: 0 as const },
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

          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, { backgroundColor: surfaceMuted }]}>
              <ThemedText style={styles.summaryLabel}>当前条目</ThemedText>
              <ThemedText style={styles.summaryValue} type="defaultSemiBold">
                {items.length} 项
              </ThemedText>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: surfaceMuted }]}>
              <ThemedText style={styles.summaryLabel}>总库存</ThemedText>
              <ThemedText style={styles.summaryValue} type="defaultSemiBold">
                {formatQty(summary.totalStock)}
              </ThemedText>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: surfaceMuted }]}>
              <ThemedText style={styles.summaryLabel}>启用中</ThemedText>
              <ThemedText style={styles.summaryValue} type="defaultSemiBold">
                {summary.activeCount}
              </ThemedText>
            </View>
          </View>
        </View>

        {isLoading ? (
          <View style={[styles.emptyPanel, { backgroundColor: surface, borderColor }]}>
            <ThemedText>正在加载商品列表…</ThemedText>
          </View>
        ) : items.length === 0 ? (
          <View style={[styles.emptyPanel, { backgroundColor: surface, borderColor }]}>
            <ThemedText type="defaultSemiBold">当前没有匹配商品</ThemedText>
            <ThemedText style={styles.emptyDescription}>可以调整筛选条件，或直接新建一条商品资料。</ThemedText>
          </View>
        ) : (
          items.map((item) => <ProductCard item={item} key={item.itemCode} />)
        )}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 14,
    paddingBottom: 36,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionTile: {
    borderRadius: 24,
    borderWidth: 1,
    flex: 1,
    minHeight: 104,
    padding: 16,
    textDecorationLine: 'none',
  },
  quickActionIconWrap: {
    alignItems: 'center',
    borderRadius: 16,
    height: 38,
    justifyContent: 'center',
    marginBottom: 12,
    width: 38,
  },
  quickActionCopy: {
    gap: 6,
  },
  quickActionLabel: {
    fontSize: 17,
  },
  quickActionDescription: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 18,
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
    fontSize: 18,
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
    minHeight: 52,
    paddingHorizontal: 14,
  },
  searchInput: {
    color: '#111827',
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  segmentedWrap: {
    borderRadius: 18,
    flexDirection: 'row',
    gap: 8,
    padding: 6,
  },
  segmentedOption: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    minHeight: 40,
    justifyContent: 'center',
  },
  segmentedText: {
    opacity: 0.72,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryCard: {
    borderRadius: 18,
    flex: 1,
    gap: 6,
    minHeight: 76,
    padding: 14,
  },
  summaryLabel: {
    opacity: 0.62,
  },
  summaryValue: {
    fontSize: 16,
  },
  emptyPanel: {
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 26,
  },
  emptyDescription: {
    opacity: 0.7,
    textAlign: 'center',
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    position: 'relative',
    padding: 18,
    textDecorationLine: 'none',
  },
  cardTopBar: {
    minHeight: 60,
    paddingRight: 84,
  },
  cardBodyRow: {
    paddingRight: 226,
  },
  cardMainColumn: {
    gap: 12,
    minHeight: 152,
  },
  cardAside: {
    bottom: 18,
    position: 'absolute',
    right: 18,
    width: 208,
  },
  cardTitle: {
    flex: 1,
    fontSize: 22,
    lineHeight: 30,
    minHeight: 60,
  },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusChipText: {
    fontSize: 12,
  },
  statusChipFloating: {
    position: 'absolute',
    right: 18,
    top: 18,
    zIndex: 1,
  },
  metaText: {
    lineHeight: 22,
    opacity: 0.72,
  },
  metaInlineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    minHeight: 22,
  },
  metaInlineText: {
    maxWidth: '48%',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    borderRadius: 16,
    flexBasis: 120,
    flexGrow: 0,
    flexShrink: 0,
    gap: 6,
    height: 108,
    padding: 14,
  },
  metricLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  metricValue: {
    fontSize: 15,
  },
  metricMeta: {
    color: '#475569',
    fontSize: 12,
  },
  priceBoard: {
    gap: 10,
    width: '100%',
  },
  priceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 26,
  },
  pricePillLabel: {
    fontSize: 13,
    lineHeight: 20,
    width: 50,
  },
  pricePillValue: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'right',
  },
});
