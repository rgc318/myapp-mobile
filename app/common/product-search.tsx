import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { normalizeAppError } from '@/lib/app-error';
import { getAppPreferences } from '@/lib/app-preferences';
import { formatDisplayUom } from '@/lib/display-uom';
import { normalizeText, toOptionalText } from '@/lib/form-utils';
import {
  addItemToSalesOrderDraft,
  getSalesOrderDraft,
  removeSalesOrderDraftItem,
  updateSalesOrderDraftQty,
  type SalesOrderDraftItem,
} from '@/lib/sales-order-draft';
import { useFeedback } from '@/providers/feedback-provider';
import { createProductAndStock, searchCatalogProducts, type ProductSearchItem } from '@/services/products';

function getProductResultKey(item: ProductSearchItem) {
  return [item.itemCode, item.warehouse ?? '', item.uom ?? ''].join('::');
}

function getDraftItem(item: ProductSearchItem, draftItems: SalesOrderDraftItem[]) {
  const key = getProductResultKey(item);
  return draftItems.find((draftItem) => draftItem.draftKey === key) ?? null;
}

function ResultRow({
  item,
  selectedQty,
  onAdd,
  onDecrease,
  onOpenDetail,
  isOrderMode,
}: {
  item: ProductSearchItem;
  selectedQty: number;
  onAdd: (item: ProductSearchItem) => void;
  onDecrease: (item: ProductSearchItem) => void;
  onOpenDetail: (item: ProductSearchItem) => void;
  isOrderMode: boolean;
}) {
  const surface = useThemeColor({}, 'surface');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const successSoft = useThemeColor({}, 'accentSoft');

  return (
    <Pressable onPress={() => onOpenDetail(item)} style={[styles.resultRow, { backgroundColor: surface, borderColor }]}>
      <View style={[styles.thumbWrap, { backgroundColor: surfaceMuted }]}>
        {item.imageUrl ? (
          <Image contentFit="cover" source={item.imageUrl} style={styles.thumbImage} />
        ) : (
          <IconSymbol color={tintColor} name="photo" size={20} />
        )}
      </View>

      <View style={styles.resultMain}>
        <View style={styles.resultTitleRow}>
          <ThemedText numberOfLines={1} style={styles.resultTitle} type="defaultSemiBold">
            {item.itemName || item.itemCode}
          </ThemedText>
          <View style={[styles.badge, { backgroundColor: surfaceMuted }]}>
            <ThemedText style={styles.badgeText}>{formatDisplayUom(item.uom)}</ThemedText>
          </View>
        </View>

        <ThemedText style={styles.resultMeta}>{'编码：'} {item.itemCode}</ThemedText>

        <View style={styles.resultStats}>
          <ThemedText style={styles.statText}>{'库存：'} {item.stockQty ?? '-'}</ThemedText>
          <ThemedText style={styles.statText}>{'价格：'} {item.price ?? '-'}</ThemedText>
        </View>

        <ThemedText style={styles.resultMeta}>{item.warehouse || '未指定仓库'}</ThemedText>

        {!isOrderMode ? (
          <ThemedText style={styles.detailHint}>{'点击查看商品详情'}</ThemedText>
        ) : null}

        {isOrderMode ? (
          <View style={styles.selectedRow}>
            {selectedQty > 0 ? (
              <View style={[styles.selectedPill, { backgroundColor: successSoft }]}>
                <ThemedText style={[styles.selectedPillText, { color: tintColor }]} type="defaultSemiBold">
                  {'已加入 '} {selectedQty} {' 件'}
                </ThemedText>
              </View>
            ) : (
              <ThemedText style={styles.selectedHint}>{'还未加入订单'}</ThemedText>
            )}
          </View>
        ) : null}
      </View>

      {isOrderMode ? (
        selectedQty > 0 ? (
          <View style={[styles.stepper, { backgroundColor: surfaceMuted, borderColor }]}>
            <Pressable onPress={(event) => { event.stopPropagation(); onDecrease(item); }} style={styles.stepperButton}>
              <ThemedText style={[styles.stepperActionText, { color: tintColor }]} type="defaultSemiBold">
                -
              </ThemedText>
            </Pressable>
            <View style={styles.stepperValueWrap}>
              <ThemedText style={styles.stepperValue} type="defaultSemiBold">
                {selectedQty}
              </ThemedText>
            </View>
            <Pressable onPress={(event) => { event.stopPropagation(); onAdd(item); }} style={styles.stepperButton}>
              <ThemedText style={[styles.stepperActionText, { color: tintColor }]} type="defaultSemiBold">
                +
              </ThemedText>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={(event) => { event.stopPropagation(); onAdd(item); }} style={[styles.addButton, { backgroundColor: tintColor }]}>
            <ThemedText style={styles.addButtonText} type="defaultSemiBold">
              {'加入订单'}
            </ThemedText>
          </Pressable>
        )
      ) : null}
    </Pressable>
  );
}

export default function ProductSearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ query?: string }>();
  const preferences = getAppPreferences();
  const { showError, showSuccess } = useFeedback();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductSearchItem[]>([]);
  const [message, setMessage] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('0');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemDescription, setNewItemDescription] = useState('');
  const mode = params.mode === 'order' ? 'order' : 'lookup';
  const isOrderMode = mode === 'order';
  const [draftItems, setDraftItems] = useState(() => getSalesOrderDraft());
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const surface = useThemeColor({}, 'surface');
  const borderColor = useThemeColor({}, 'border');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const tintColor = useThemeColor({}, 'tint');

  const draftCount = draftItems.length;
  const totalSelectedQty = useMemo(
    () => draftItems.reduce((sum, item) => sum + item.qty, 0),
    [draftItems],
  );

  const handleSearch = async (rawQuery?: string) => {
    const nextQuery = (rawQuery ?? query).trim();

    if (!nextQuery) {
      setMessage('\u8bf7\u8f93\u5165\u5546\u54c1\u7f16\u7801\u3001\u6761\u7801\u6216\u5173\u952e\u8bcd\u3002');
      setResults([]);
      return;
    }

    try {
      setIsLoading(true);
      setQuery(nextQuery);
      const items = await searchCatalogProducts(nextQuery, {
        company: preferences.defaultCompany || undefined,
        warehouse: preferences.defaultWarehouse || undefined,
      });
      setResults(items);
      setMessage(
        items.length
          ? `\u5171\u627e\u5230 ${items.length} \u4e2a\u5546\u54c1\u3002`
          : '\u6ca1\u6709\u627e\u5230\u5339\u914d\u5546\u54c1\u3002',
      );
    } catch (error) {
      setResults([]);
      const appError = normalizeAppError(error, '\u5546\u54c1\u641c\u7d22\u5931\u8d25\u3002');
      setMessage(appError.message);
      showError(appError.message);
    } finally {
      setIsLoading(false);
    }
  };

  const syncDraftState = () => {
    setDraftItems([...getSalesOrderDraft()]);
  };

  const handleAdd = (item: ProductSearchItem) => {
    addItemToSalesOrderDraft(item);
    const nextDraft = getSalesOrderDraft();
    const nextQty = getDraftItem(item, nextDraft)?.qty ?? 0;
    setDraftItems([...nextDraft]);
    setMessage(`\u5df2\u5c06 ${item.itemName || item.itemCode} \u52a0\u5165\u8ba2\u5355\uff0c\u5f53\u524d\u5df2\u9009 ${nextQty} \u4ef6\u3002`);
    showSuccess(`已将 ${item.itemName || item.itemCode} 加入订单`);
  };

  const handleCreateProduct = async () => {
    const itemName = normalizeText(newItemName || query);

    if (!itemName) {
      const text = '请先输入商品名称。';
      setMessage(text);
      showError(text);
      return;
    }

    setIsCreatingProduct(true);

    try {
      const createdItem = await createProductAndStock({
        itemName,
        defaultWarehouse: preferences.defaultWarehouse || undefined,
        openingQty: Number(newItemQty) || 0,
        standardRate: newItemPrice.trim() ? Number(newItemPrice) || 0 : undefined,
        description: toOptionalText(newItemDescription),
      });

      setResults([createdItem]);
      setMessage(`已创建商品 ${createdItem.itemName || createdItem.itemCode}。`);
      setNewItemName('');
      setNewItemQty('0');
      setNewItemPrice('');
      setNewItemDescription('');

      if (isOrderMode) {
        handleAdd(createdItem);
      } else {
        showSuccess(`商品 ${createdItem.itemName || createdItem.itemCode} 已创建并入库`);
      }
    } catch (error) {
      const appError = normalizeAppError(error, '新增商品失败，请稍后重试。');
      setMessage(appError.message);
      showError(appError.message);
    } finally {
      setIsCreatingProduct(false);
    }
  };


  const handleOpenDetail = (item: ProductSearchItem) => {
    if (isOrderMode) {
      return;
    }

    router.push({
      pathname: '/common/product/[itemCode]',
      params: {
        itemCode: item.itemCode,
        itemName: item.itemName,
        price: item.price === null ? '' : String(item.price),
        stockQty: item.stockQty === null ? '' : String(item.stockQty),
        uom: item.uom ?? '',
        warehouse: item.warehouse ?? '',
        imageUrl: item.imageUrl ?? '',
      },
    });
  };

  const handleDecrease = (item: ProductSearchItem) => {
    const draftItem = getDraftItem(item, getSalesOrderDraft());
    if (!draftItem) {
      return;
    }

    if (draftItem.qty <= 1) {
      removeSalesOrderDraftItem(draftItem.draftKey);
      syncDraftState();
      setMessage(`\u5df2\u5c06 ${item.itemName || item.itemCode} \u4ece\u8ba2\u5355\u4e2d\u79fb\u9664\u3002`);
      return;
    }

    updateSalesOrderDraftQty(draftItem.draftKey, draftItem.qty - 1);
    const nextDraft = getSalesOrderDraft();
    const nextQty = getDraftItem(item, nextDraft)?.qty ?? 0;
    setDraftItems([...nextDraft]);
    setMessage(`\u5df2\u8c03\u6574 ${item.itemName || item.itemCode} \u6570\u91cf\uff0c\u5f53\u524d\u4e3a ${nextQty} \u4ef6\u3002`);
  };

  useEffect(() => {
    setDraftItems(getSalesOrderDraft());
    const initialQuery = typeof params.query === 'string' ? params.query.trim() : '';
    if (!initialQuery) {
      return;
    }

    setQuery(initialQuery);
    void handleSearch(initialQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.query]);

  return (
    <AppShell
      compactHeader
      contentCard={false}
      description={isOrderMode ? '\u641c\u7d22\u5546\u54c1\u540e\u52a0\u5165\u5f53\u524d\u8ba2\u5355\u8349\u7a3f\uff0c\u518d\u8fd4\u56de\u8ba2\u5355\u9875\u7ee7\u7eed\u586b\u5199\u6570\u91cf\u3001\u4ef7\u683c\u548c\u5907\u6ce8\u3002' : '\u7528\u4e8e\u67e5\u8be2\u5546\u54c1\u5e93\u5b58\u3001\u4ef7\u683c\u548c\u57fa\u7840\u4fe1\u606f\uff0c\u4e0d\u5173\u8054\u5f53\u524d\u8ba2\u5355\u8349\u7a3f\u3002'}
      title={isOrderMode ? '\u5546\u54c1\u641c\u7d22' : '\u5546\u54c1\u67e5\u8be2'}>
      <View style={[styles.searchCard, { backgroundColor: surface, borderColor }]}>
        <View style={[styles.searchInputWrap, { backgroundColor: surfaceMuted, borderColor }]}>
          <IconSymbol color={tintColor} name="magnifyingglass" size={18} />
          <TextInput
            autoCorrect={false}
            onChangeText={setQuery}
            onSubmitEditing={() => void handleSearch()}
            placeholder={'\u641c\u7d22\u5546\u54c1\u7f16\u7801\u3001\u6761\u7801\u6216\u5173\u952e\u8bcd'}
            placeholderTextColor="rgba(31,42,55,0.45)"
            style={styles.searchInput}
            value={query}
          />
        </View>

        <Pressable onPress={() => void handleSearch()} style={[styles.searchButton, { backgroundColor: tintColor }]}>
          <ThemedText style={styles.searchButtonText} type="defaultSemiBold">
            {isLoading ? '\u641c\u7d22\u4e2d...' : '\u5f00\u59cb\u641c\u7d22'}
          </ThemedText>
        </Pressable>
      </View>

      {isOrderMode ? (
      <View style={[styles.selectionCard, { backgroundColor: surface, borderColor }]}>
        <View style={styles.selectionCopy}>
          <ThemedText type="defaultSemiBold">{'\u5f53\u524d\u8ba2\u5355\u8349\u7a3f'}</ThemedText>
          <ThemedText style={styles.selectionHint}>
            {'\u5df2\u52a0\u5165 '} {draftCount} {' \u9879\u5546\u54c1\uff0c\u5408\u8ba1 '} {totalSelectedQty} {' \u4ef6\uff0c\u9009\u5b8c\u540e\u8fd4\u56de\u8ba2\u5355\u9875\u7ee7\u7eed\u586b\u5199\u3002'}
          </ThemedText>
          <ThemedText style={styles.metaText}>
            {message || '\u8f93\u5165\u5173\u952e\u8bcd\u540e\u5373\u53ef\u641c\u7d22\u5546\u54c1\uff0c\u627e\u5230\u540e\u53ef\u76f4\u63a5\u52a0\u51cf\u5546\u54c1\u6570\u91cf\u3002'}
          </ThemedText>
        </View>
        <Pressable onPress={() => router.push('/sales/order/create')} style={[styles.returnButton, { backgroundColor: tintColor }]}>
          <ThemedText style={styles.returnButtonText} type="defaultSemiBold">
            {'\u8fd4\u56de\u8ba2\u5355\u9875'}
          </ThemedText>
        </Pressable>
      </View>
      ) : null}

      <View style={styles.resultList}>
        {results.map((item) => (
          <ResultRow
            isOrderMode={isOrderMode}
            item={item}
            key={getProductResultKey(item)}
            onAdd={handleAdd}
            onDecrease={handleDecrease}
            onOpenDetail={handleOpenDetail}
            selectedQty={getDraftItem(item, draftItems)?.qty ?? 0}
          />
        ))}

        {!results.length && query.trim() ? (
          <View style={[styles.emptyState, { backgroundColor: surfaceMuted, borderColor }]}>
            <ThemedText type="defaultSemiBold">{'\u6ca1\u6709\u627e\u5230\u5339\u914d\u5546\u54c1'}</ThemedText>
            <ThemedText>
              {'\u4f60\u53ef\u4ee5\u66f4\u6362\u5173\u952e\u8bcd\uff0c\u6216\u8005\u5148\u68c0\u67e5\u5546\u54c1\u7f16\u7801\u3001\u6761\u7801\u662f\u5426\u6b63\u786e\u3002'}
            </ThemedText>

            <View style={[styles.quickCreateCard, { backgroundColor: surface, borderColor }]}>
              <ThemedText type="defaultSemiBold">{'新增商品并入库'}</ThemedText>
              <ThemedText style={styles.metaText}>
                {'未找到商品时，可直接创建正式商品并入默认仓库。'}
              </ThemedText>

              <TextInput
                onChangeText={setNewItemName}
                placeholder={'商品名称'}
                placeholderTextColor="rgba(31,42,55,0.45)"
                style={[styles.quickCreateInput, { backgroundColor: surfaceMuted, borderColor }]}
                value={newItemName || query}
              />
              <TextInput
                keyboardType="numeric"
                onChangeText={setNewItemQty}
                placeholder={'初始数量，默认 0'}
                placeholderTextColor="rgba(31,42,55,0.45)"
                style={[styles.quickCreateInput, { backgroundColor: surfaceMuted, borderColor }]}
                value={newItemQty}
              />
              <TextInput
                keyboardType="numeric"
                onChangeText={setNewItemPrice}
                placeholder={'参考售价，可选'}
                placeholderTextColor="rgba(31,42,55,0.45)"
                style={[styles.quickCreateInput, { backgroundColor: surfaceMuted, borderColor }]}
                value={newItemPrice}
              />
              <TextInput
                onChangeText={setNewItemDescription}
                placeholder={'商品备注，可选'}
                placeholderTextColor="rgba(31,42,55,0.45)"
                style={[styles.quickCreateInput, { backgroundColor: surfaceMuted, borderColor }]}
                value={newItemDescription}
              />

              <ThemedText style={styles.metaText}>
                {'入库仓库：'} {preferences.defaultWarehouse || '未设置，后端将按默认仓库处理'}
              </ThemedText>

              <Pressable
                onPress={() => void handleCreateProduct()}
                style={[styles.searchButton, { backgroundColor: tintColor, opacity: isCreatingProduct ? 0.7 : 1 }]}>
                <ThemedText style={styles.searchButtonText} type="defaultSemiBold">
                  {isCreatingProduct ? '创建中...' : '新增并入库'}
                </ThemedText>
              </Pressable>
            </View>
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
  selectionCard: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
    padding: 16,
  },
  selectionCopy: {
    gap: 6,
  },
  selectionHint: {
    opacity: 0.76,
  },
  metaText: {
    opacity: 0.7,
  },
  returnButton: {
    alignItems: 'center',
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  returnButtonText: {
    color: '#FFF',
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
  thumbWrap: {
    alignItems: 'center',
    borderRadius: 18,
    height: 72,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 72,
  },
  thumbImage: {
    height: '100%',
    width: '100%',
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
  selectedRow: {
    marginTop: 2,
  },
  selectedPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  selectedPillText: {
    fontSize: 12,
  },
  selectedHint: {
    opacity: 0.6,
  },
  detailHint: {
    color: '#2563EB',
    fontSize: 12,
    marginTop: 2,
  },
  addButton: {
    alignItems: 'center',
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 42,
    minWidth: 96,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addButtonText: {
    color: '#FFF',
  },
  stepper: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 44,
    overflow: 'hidden',
  },
  stepperButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    width: 36,
  },
  stepperActionText: {
    fontSize: 22,
    lineHeight: 22,
  },
  stepperValueWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 32,
    paddingHorizontal: 8,
  },
  stepperValue: {
    fontSize: 16,
  },
  emptyState: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    padding: 16,
  },
  quickCreateCard: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    marginTop: 10,
    padding: 14,
  },
  quickCreateInput: {
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
