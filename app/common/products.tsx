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

function formatPriceLine(label: string, value: number | null | undefined, uom?: string | null) {
  const price = typeof value === 'number' ? `¥ ${value.toFixed(2)}` : '未配置';
  return `${label} ${price}${uom ? ` / ${formatDisplayUom(uom)}` : ''}`;
}

function ProductCard({ item }: { item: ProductListItem }) {
  const surface = useThemeColor({}, 'surface');
  const borderColor = useThemeColor({}, 'border');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const tintColor = useThemeColor({}, 'tint');
  const success = useThemeColor({}, 'success');
  const danger = useThemeColor({}, 'danger');

  return (
    <Link
      href={{ pathname: '/common/product/[itemCode]', params: { itemCode: item.itemCode } } as Href}
      style={[styles.card, { backgroundColor: surface, borderColor }]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleWrap}>
          <ThemedText numberOfLines={1} style={styles.cardTitle} type="defaultSemiBold">
            {item.itemName || item.itemCode}
          </ThemedText>
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
        <ThemedText style={styles.metaText}>编码 {item.itemCode}</ThemedText>
        {item.nickname ? <ThemedText style={styles.metaText}>昵称 {item.nickname}</ThemedText> : null}
      </View>

      <View style={styles.metricRow}>
        <View style={[styles.metricCard, { backgroundColor: surfaceMuted }]}>
          <ThemedText style={styles.metricLabel}>总库存</ThemedText>
          <ThemedText style={styles.metricValue} type="defaultSemiBold">
            {(item.totalQty ?? item.stockQty ?? 0).toString()} {formatDisplayUom(item.stockUom)}
          </ThemedText>
        </View>
        <View style={[styles.metricCard, { backgroundColor: surfaceMuted }]}>
          <ThemedText style={styles.metricLabel}>当前仓库</ThemedText>
          <ThemedText numberOfLines={1} style={styles.metricValue} type="defaultSemiBold">
            {item.warehouse || '未指定'}
          </ThemedText>
        </View>
      </View>

      <View style={styles.priceLines}>
        <ThemedText style={styles.priceLine}>
          {formatPriceLine('批发', item.priceSummary?.wholesaleRate, item.wholesaleDefaultUom)}
        </ThemedText>
        <ThemedText style={styles.priceLine}>
          {formatPriceLine('零售', item.priceSummary?.retailRate, item.retailDefaultUom)}
        </ThemedText>
        <ThemedText style={styles.priceLine}>
          {formatPriceLine('采购', item.priceSummary?.standardBuyingRate, item.stockUom)}
        </ThemedText>
      </View>

      {item.warehouseStockDetails.length ? (
        <View style={styles.stockWrap}>
          <ThemedText style={styles.stockLabel}>库存分布</ThemedText>
          {item.warehouseStockDetails.slice(0, 2).map((stockItem) => (
            <View key={stockItem.warehouse} style={styles.stockRow}>
              <ThemedText numberOfLines={1} style={styles.stockWarehouse}>
                {stockItem.warehouse}
              </ThemedText>
              <ThemedText style={[styles.stockQty, { color: tintColor }]} type="defaultSemiBold">
                {stockItem.qty} {formatDisplayUom(item.stockUom)}
              </ThemedText>
            </View>
          ))}
          {item.warehouseStockDetails.length > 2 ? (
            <ThemedText style={styles.moreText}>还有 {item.warehouseStockDetails.length - 2} 个仓库</ThemedText>
          ) : null}
        </View>
      ) : null}
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

  const loadItems = useCallback(async (refresh = false) => {
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
  }, [deferredQuery, disabledFilter, showError]);

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
    <AppShell
      actions={[
        { href: '/common/product/create', label: '新增商品', description: '补充名称、价格、单位和图片' },
        { href: '/common/product-search?mode=lookup', label: '商品查价', description: '快速查看价格与库存' },
      ]}
      compactHeader
      contentCard={false}
      description="维护商品基础资料、价格体系、默认单位和库存分布。"
      title="商品管理">
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl onRefresh={() => void loadItems(true)} refreshing={isRefreshing} />}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.searchPanel, { backgroundColor: surface, borderColor }]}>
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
                {summary.totalStock}
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
  searchPanel: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    padding: 18,
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
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
    padding: 18,
    textDecorationLine: 'none',
  },
  cardHeader: {
    gap: 6,
  },
  cardTitleWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  cardTitle: {
    flex: 1,
    fontSize: 20,
  },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusChipText: {
    fontSize: 12,
  },
  metaText: {
    opacity: 0.72,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    borderRadius: 18,
    flex: 1,
    gap: 6,
    minHeight: 76,
    padding: 14,
  },
  metricLabel: {
    opacity: 0.62,
  },
  metricValue: {
    fontSize: 16,
  },
  priceLines: {
    gap: 6,
  },
  priceLine: {
    fontSize: 14,
    opacity: 0.84,
  },
  stockWrap: {
    gap: 8,
  },
  stockLabel: {
    opacity: 0.68,
  },
  stockRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stockWarehouse: {
    flex: 1,
    paddingRight: 10,
  },
  stockQty: {
    fontSize: 14,
  },
  moreText: {
    opacity: 0.58,
  },
});
