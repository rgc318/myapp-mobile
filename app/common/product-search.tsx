import { Link, useLocalSearchParams } from 'expo-router';
import type { Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { addItemToSalesOrderDraft } from '@/lib/sales-order-draft';
import { searchProducts, type ProductSearchItem } from '@/services/gateway';

function ResultRow({
  item,
  onAdd,
}: {
  item: ProductSearchItem;
  onAdd: (item: ProductSearchItem) => void;
}) {
  const surface = useThemeColor({}, 'surface');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');

  return (
    <View style={[styles.resultRow, { backgroundColor: surface, borderColor }]}>
      <View style={styles.resultMain}>
        <View style={styles.resultTitleRow}>
          <ThemedText numberOfLines={1} style={styles.resultTitle} type="defaultSemiBold">
            {item.itemName || item.itemCode}
          </ThemedText>
          <View style={[styles.badge, { backgroundColor: surfaceMuted }]}>
            <ThemedText style={styles.badgeText}>{item.uom || '件'}</ThemedText>
          </View>
        </View>

        <ThemedText style={styles.resultMeta}>编码：{item.itemCode}</ThemedText>

        <View style={styles.resultStats}>
          <ThemedText style={styles.statText}>库存 {item.stockQty ?? '-'}</ThemedText>
          <ThemedText style={styles.statText}>价格 {item.price ?? '-'}</ThemedText>
          <ThemedText style={styles.statText}>{item.warehouse || '未指定仓库'}</ThemedText>
        </View>
      </View>

      <Pressable onPress={() => onAdd(item)} style={[styles.addButton, { backgroundColor: tintColor }]}>
        <ThemedText style={styles.addButtonText} type="defaultSemiBold">
          加入
        </ThemedText>
      </Pressable>
    </View>
  );
}

export default function ProductSearchScreen() {
  const params = useLocalSearchParams<{ query?: string }>();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductSearchItem[]>([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const surface = useThemeColor({}, 'surface');
  const borderColor = useThemeColor({}, 'border');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const tintColor = useThemeColor({}, 'tint');

  const handleSearch = async (rawQuery?: string) => {
    const nextQuery = (rawQuery ?? query).trim();

    if (!nextQuery) {
      setMessage('请输入商品编码、条码或关键词。');
      setResults([]);
      return;
    }

    try {
      setIsLoading(true);
      setQuery(nextQuery);
      const items = await searchProducts(nextQuery);
      setResults(items);
      setMessage(items.length ? `共找到 ${items.length} 个商品` : '没有找到匹配商品');
    } catch (error) {
      setResults([]);
      setMessage(error instanceof Error ? error.message : '商品搜索失败。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = (item: ProductSearchItem) => {
    addItemToSalesOrderDraft(item);
    setMessage(`已将 ${item.itemName || item.itemCode} 加入销售下单草稿。`);
  };

  useEffect(() => {
    const initialQuery = typeof params.query === 'string' ? params.query.trim() : '';
    if (!initialQuery) {
      return;
    }

    setQuery(initialQuery);
    void handleSearch(initialQuery);
  }, [params.query]);

  return (
    <AppShell
      compactHeader
      contentCard={false}
      description="输入关键词后直接搜索并加入下单草稿。"
      title="商品搜索">
      <View style={[styles.searchCard, { backgroundColor: surface, borderColor }]}>
        <View style={[styles.searchInputWrap, { backgroundColor: surfaceMuted, borderColor }]}>
          <IconSymbol color={tintColor} name="magnifyingglass" size={18} />
          <TextInput
            autoCorrect={false}
            onChangeText={setQuery}
            onSubmitEditing={() => void handleSearch()}
            placeholder="搜索商品编码、条码或关键词"
            placeholderTextColor="rgba(31,42,55,0.45)"
            style={styles.searchInput}
            value={query}
          />
        </View>

        <Pressable onPress={() => void handleSearch()} style={[styles.searchButton, { backgroundColor: tintColor }]}>
          <ThemedText style={styles.searchButtonText} type="defaultSemiBold">
            {isLoading ? '搜索中...' : '开始搜索'}
          </ThemedText>
        </Pressable>
      </View>

      <View style={styles.searchMeta}>
        <ThemedText style={styles.metaText}>{message || '输入关键词后即可搜索商品。'}</ThemedText>
        <Link href={'/sales/order/create' as Href} style={[styles.orderLink, { borderColor, backgroundColor: surface }]}>
          <ThemedText type="defaultSemiBold">查看下单草稿</ThemedText>
        </Link>
      </View>

      <View style={styles.resultList}>
        {results.map((item) => (
          <ResultRow item={item} key={item.itemCode} onAdd={handleAdd} />
        ))}

        {!results.length && query.trim() ? (
          <View style={[styles.emptyState, { backgroundColor: surfaceMuted, borderColor }]}>
            <ThemedText type="defaultSemiBold">没有找到匹配商品</ThemedText>
            <ThemedText>你可以更换关键词，或者先检查商品编码是否正确。</ThemedText>
          </View>
        ) : null}
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  searchCard: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  searchInputWrap: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    minHeight: 38,
    paddingVertical: 0,
  },
  searchButton: {
    alignItems: 'center',
    borderRadius: 16,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchButtonText: {
    color: '#FFF',
  },
  searchMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  metaText: {
    flex: 1,
    opacity: 0.7,
  },
  orderLink: {
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 10,
    textDecorationLine: 'none',
  },
  resultList: {
    gap: 12,
  },
  resultRow: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  resultMain: {
    flex: 1,
    gap: 6,
  },
  resultTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  resultTitle: {
    flex: 1,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    opacity: 0.7,
  },
  resultMeta: {
    opacity: 0.68,
  },
  resultStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statText: {
    opacity: 0.8,
  },
  addButton: {
    alignItems: 'center',
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 42,
    minWidth: 60,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addButtonText: {
    color: '#FFF',
  },
  emptyState: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    padding: 16,
  },
});
