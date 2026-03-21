import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { normalizeAppError } from '@/lib/app-error';
import { getAppPreferences } from '@/lib/app-preferences';
import { formatDisplayUom } from '@/lib/display-uom';
import { normalizeText, toOptionalText } from '@/lib/form-utils';
import { normalizeSalesMode, type SalesMode } from '@/lib/sales-mode';
import {
  addItemToSalesOrderDraft,
  getSalesOrderDraft,
  getSalesOrderDraftForm,
  removeSalesOrderDraftItem,
  updateSalesOrderDraftQty,
  type SalesOrderDraftItem,
} from '@/lib/sales-order-draft';
import { useFeedback } from '@/providers/feedback-provider';
import { createProductAndStock, searchCatalogProducts, type ProductSearchItem } from '@/services/products';

function getProductResultKey(item: ProductSearchItem, defaultSalesMode?: SalesMode) {
  return [item.itemCode, item.warehouse ?? ''].join('::');
}

function getDraftItem(item: ProductSearchItem, draftItems: SalesOrderDraftItem[], defaultSalesMode?: SalesMode) {
  const key = getProductResultKey(item, defaultSalesMode);
  return draftItems.find((draftItem) => draftItem.draftKey === key) ?? null;
}

function formatModePriceReference(
  label: string,
  rate: number | null | undefined,
  uom: string | null | undefined,
) {
  const priceText = typeof rate === 'number' ? `¥ ${rate}` : '未配置';
  const uomText = uom ? formatDisplayUom(uom) : '未设置单位';
  return `${label} ${priceText} / ${uomText}`;
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

        <View style={styles.resultMetaRow}>
          <ThemedText numberOfLines={1} style={styles.resultMeta}>
            编码 {item.itemCode}
          </ThemedText>
          <ThemedText numberOfLines={1} style={styles.resultMeta}>
            库存 {item.stockQty ?? '-'}
          </ThemedText>
        </View>

        <View style={styles.modePriceInlineRow}>
          <View style={[styles.modePricePill, { backgroundColor: surfaceMuted }]}>
            <ThemedText style={styles.modePricePillText}>
              {formatModePriceReference('批发', item.priceSummary?.wholesaleRate, item.wholesaleDefaultUom)}
            </ThemedText>
          </View>
          <View style={[styles.modePricePill, { backgroundColor: surfaceMuted }]}>
            <ThemedText style={styles.modePricePillText}>
              {formatModePriceReference('零售', item.priceSummary?.retailRate, item.retailDefaultUom)}
            </ThemedText>
          </View>
        </View>

        <View style={styles.resultFooterRow}>
          <ThemedText numberOfLines={1} style={styles.resultMeta}>
            {item.warehouse || '未指定仓库'}
          </ThemedText>
          {!isOrderMode ? (
            <ThemedText style={styles.detailHint}>{'查看详情'}</ThemedText>
          ) : selectedQty > 0 ? (
            <View style={[styles.selectedPill, { backgroundColor: successSoft }]}>
              <ThemedText style={[styles.selectedPillText, { color: tintColor }]} type="defaultSemiBold">
                {'已加入 '} {selectedQty} {' 件'}
              </ThemedText>
            </View>
          ) : (
            <ThemedText style={styles.selectedHint}>{'还未加入订单'}</ThemedText>
          )}
        </View>
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

function DraftItemRow({
  item,
  onAdd,
  onDecrease,
}: {
  item: SalesOrderDraftItem;
  onAdd: (item: SalesOrderDraftItem) => void;
  onDecrease: (item: SalesOrderDraftItem) => void;
}) {
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const tintColor = useThemeColor({}, 'tint');

  return (
    <View style={styles.draftItemRow}>
      <View style={[styles.draftThumbWrap, { backgroundColor: surfaceMuted }]}>
        {item.imageUrl ? (
          <Image contentFit="cover" source={item.imageUrl} style={styles.draftThumbImage} />
        ) : (
          <IconSymbol color={tintColor} name="shippingbox.fill" size={18} />
        )}
      </View>

      <View style={styles.draftItemMain}>
        <View style={styles.draftItemTitleRow}>
          <ThemedText numberOfLines={1} style={styles.draftItemTitle} type="defaultSemiBold">
            {item.itemName || item.itemCode}
          </ThemedText>
          <ThemedText style={styles.draftItemPrice} type="defaultSemiBold">
            {item.price == null ? '--' : `¥ ${item.price}`}
          </ThemedText>
        </View>
        <View style={styles.draftItemMetaRow}>
          <ThemedText numberOfLines={1} style={styles.draftItemMeta}>
            编码 {item.itemCode}
          </ThemedText>
          <ThemedText numberOfLines={1} style={styles.draftItemMeta}>
            {item.warehouse || '未指定仓库'}
          </ThemedText>
        </View>
        <View style={styles.draftItemReferenceRow}>
          <View style={styles.draftReferencePill}>
            <ThemedText numberOfLines={1} style={styles.draftReferenceText}>
              {formatModePriceReference('批发', item.priceSummary?.wholesaleRate, item.wholesaleDefaultUom)}
            </ThemedText>
          </View>
          <View style={styles.draftReferencePill}>
            <ThemedText numberOfLines={1} style={styles.draftReferenceText}>
              {formatModePriceReference('零售', item.priceSummary?.retailRate, item.retailDefaultUom)}
            </ThemedText>
          </View>
        </View>
      </View>

      <View style={styles.draftItemAside}>
        <View style={[styles.stepper, { backgroundColor: surfaceMuted, borderColor: 'rgba(148,163,184,0.22)' }]}>
          <Pressable onPress={() => onDecrease(item)} style={styles.stepperButton}>
            <ThemedText style={[styles.stepperActionText, { color: tintColor }]} type="defaultSemiBold">
              -
            </ThemedText>
          </Pressable>
          <View style={styles.stepperValueWrap}>
            <ThemedText style={styles.stepperValue} type="defaultSemiBold">
              {item.qty}
            </ThemedText>
          </View>
          <Pressable onPress={() => onAdd(item)} style={styles.stepperButton}>
            <ThemedText style={[styles.stepperActionText, { color: tintColor }]} type="defaultSemiBold">
              +
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function ProductSearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    query?: string;
    draftScope?: string;
    returnOrderName?: string;
    defaultSalesMode?: string;
  }>();
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
  const draftScope = typeof params.draftScope === 'string' ? params.draftScope : undefined;
  const returnOrderName = typeof params.returnOrderName === 'string' ? params.returnOrderName : '';
  const defaultSalesMode = useMemo<SalesMode>(
    () =>
      normalizeSalesMode(
        typeof params.defaultSalesMode === 'string'
          ? params.defaultSalesMode
          : getSalesOrderDraftForm(draftScope).defaultSalesMode,
      ),
    [draftScope, params.defaultSalesMode],
  );
  const [draftItems, setDraftItems] = useState(() => getSalesOrderDraft(draftScope));
  const [showDraftSheet, setShowDraftSheet] = useState(false);
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
  const totalSelectedAmount = useMemo(
    () => draftItems.reduce((sum, item) => sum + (item.price ?? 0) * item.qty, 0),
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
    setDraftItems([...getSalesOrderDraft(draftScope)]);
  };

  const handleAdd = (item: ProductSearchItem) => {
    addItemToSalesOrderDraft(item, draftScope, { defaultSalesMode });
    const nextDraft = getSalesOrderDraft(draftScope);
    const nextQty = getDraftItem(item, nextDraft, defaultSalesMode)?.qty ?? 0;
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
    const draftItem = getDraftItem(item, getSalesOrderDraft(draftScope), defaultSalesMode);
    if (!draftItem) {
      return;
    }

    if (draftItem.qty <= 1) {
      removeSalesOrderDraftItem(draftItem.draftKey, draftScope);
      syncDraftState();
      setMessage(`\u5df2\u5c06 ${item.itemName || item.itemCode} \u4ece\u8ba2\u5355\u4e2d\u79fb\u9664\u3002`);
      return;
    }

    updateSalesOrderDraftQty(draftItem.draftKey, draftItem.qty - 1, draftScope);
    const nextDraft = getSalesOrderDraft(draftScope);
    const nextQty = getDraftItem(item, nextDraft, defaultSalesMode)?.qty ?? 0;
    setDraftItems([...nextDraft]);
    setMessage(`\u5df2\u8c03\u6574 ${item.itemName || item.itemCode} \u6570\u91cf\uff0c\u5f53\u524d\u4e3a ${nextQty} \u4ef6\u3002`);
  };

  const handleDraftIncrease = (item: SalesOrderDraftItem) => {
    addItemToSalesOrderDraft(
      {
        itemCode: item.itemCode,
        itemName: item.itemName,
        imageUrl: item.imageUrl ?? null,
        price: item.price,
        stockQty: null,
        uom: item.uom,
        warehouse: item.warehouse,
      },
      draftScope,
    );
    syncDraftState();
  };

  const handleDraftDecrease = (item: SalesOrderDraftItem) => {
    if (item.qty <= 1) {
      removeSalesOrderDraftItem(item.draftKey, draftScope);
      syncDraftState();
      return;
    }

    updateSalesOrderDraftQty(item.draftKey, item.qty - 1, draftScope);
    syncDraftState();
  };

  useEffect(() => {
    setDraftItems(getSalesOrderDraft(draftScope));
    const initialQuery = typeof params.query === 'string' ? params.query.trim() : '';
    if (!initialQuery) {
      return;
    }

    setQuery(initialQuery);
    void handleSearch(initialQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftScope, params.query]);

  const handleReturnToOrder = () => {
    if (isOrderMode) {
      router.back();
      return;
    }

    if (returnOrderName) {
      router.push({
        pathname: '/sales/order/[orderName]',
        params: { orderName: returnOrderName },
      });
      return;
    }

    router.push('/sales/order/create');
  };

  return (
    <AppShell
      compactHeader
      contentCard={false}
      description={isOrderMode ? '\u641c\u7d22\u5546\u54c1\u5e76\u52a0\u5165\u5f53\u524d\u8ba2\u5355\u3002' : '\u7528\u4e8e\u67e5\u8be2\u5546\u54c1\u5e93\u5b58\u3001\u4ef7\u683c\u548c\u57fa\u7840\u4fe1\u606f\u3002'}
      footer={
        isOrderMode ? (
          <View style={styles.footerBar}>
            <Pressable
              onPress={() => setShowDraftSheet(true)}
              style={[styles.footerDraftTrigger, { backgroundColor: surface }]}>
              <View style={styles.footerIconWrap}>
                <IconSymbol color={tintColor} name="cart.fill" size={18} />
              </View>
              <View style={styles.footerCopy}>
                <ThemedText style={styles.footerTitle} type="defaultSemiBold">
                  已选 {draftCount} 项，合计 {totalSelectedQty} 件
                </ThemedText>
                <ThemedText style={styles.footerHint}>
                  点击查看已加入商品
                </ThemedText>
              </View>
            </Pressable>
            <Pressable onPress={handleReturnToOrder} style={[styles.returnButton, { backgroundColor: tintColor }]}>
              <ThemedText style={styles.returnButtonText} type="defaultSemiBold">
                返回订单页
              </ThemedText>
            </Pressable>
          </View>
        ) : null
      }
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

      <View style={styles.resultList}>
        {message ? (
          <View style={[styles.inlineNotice, { backgroundColor: surface, borderColor }]}>
            <ThemedText style={styles.metaText}>{message}</ThemedText>
          </View>
        ) : null}

        {results.map((item) => (
          <ResultRow
            isOrderMode={isOrderMode}
            item={item}
            key={getProductResultKey(item, defaultSalesMode)}
            onAdd={handleAdd}
            onDecrease={handleDecrease}
            onOpenDetail={handleOpenDetail}
            selectedQty={getDraftItem(item, draftItems, defaultSalesMode)?.qty ?? 0}
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

      {isOrderMode ? <View style={styles.bottomSpacer} /> : null}

      <Modal
        animationType="slide"
        onRequestClose={() => setShowDraftSheet(false)}
        transparent
        visible={showDraftSheet && isOrderMode}>
        <View style={styles.sheetBackdrop}>
          <Pressable onPress={() => setShowDraftSheet(false)} style={styles.sheetDismissArea} />
          <View style={[styles.sheetCard, { backgroundColor: surface, borderColor }]}>
            <View style={styles.sheetHeader}>
              <View>
                <ThemedText style={styles.sheetTitle} type="defaultSemiBold">
                  当前订单商品
                </ThemedText>
                <ThemedText style={styles.sheetHint}>
                  已选 {draftCount} 项，合计 {totalSelectedQty} 件
                </ThemedText>
              </View>
              <Pressable onPress={() => setShowDraftSheet(false)} style={styles.sheetCloseButton}>
                <ThemedText style={styles.sheetCloseText} type="defaultSemiBold">
                  收起
                </ThemedText>
              </Pressable>
            </View>

            {draftItems.length ? (
              <>
                <ScrollView contentContainerStyle={styles.sheetList} style={styles.sheetScroll}>
                  {draftItems.map((item) => (
                    <DraftItemRow
                      item={item}
                      key={item.draftKey}
                      onAdd={handleDraftIncrease}
                      onDecrease={handleDraftDecrease}
                    />
                  ))}
                </ScrollView>
                <View style={styles.sheetFooter}>
                  <View>
                    <ThemedText style={styles.sheetTotalLabel}>草稿合计</ThemedText>
                    <ThemedText style={styles.sheetTotalValue} type="defaultSemiBold">
                      ¥ {totalSelectedAmount.toFixed(2)}
                    </ThemedText>
                  </View>
                  <Pressable
                    onPress={() => {
                      setShowDraftSheet(false);
                      handleReturnToOrder();
                    }}
                    style={[styles.returnButton, { backgroundColor: tintColor }]}>
                    <ThemedText style={styles.returnButtonText} type="defaultSemiBold">
                      返回订单页
                    </ThemedText>
                  </Pressable>
                </View>
              </>
            ) : (
              <View style={styles.emptyDraftState}>
                <ThemedText type="defaultSemiBold">还没有加入商品</ThemedText>
                <ThemedText style={styles.metaText}>搜索并点击“加入订单”后，这里会显示当前草稿商品。</ThemedText>
              </View>
            )}
          </View>
        </View>
      </Modal>
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
  metaText: {
    opacity: 0.7,
  },
  footerBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  footerDraftTrigger: {
    alignItems: 'center',
    borderRadius: 16,
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  footerIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
  },
  footerCopy: {
    flex: 1,
    gap: 2,
  },
  footerTitle: {
    color: '#0F172A',
    fontSize: 15,
  },
  footerHint: {
    color: '#64748B',
    fontSize: 12,
  },
  returnButton: {
    alignItems: 'center',
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 118,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  returnButtonText: {
    color: '#FFF',
  },
  inlineNotice: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  resultList: {
    gap: 12,
  },
  resultRow: {
    alignItems: 'flex-start',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  thumbWrap: {
    alignItems: 'center',
    borderRadius: 16,
    height: 60,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 60,
  },
  thumbImage: {
    height: '100%',
    width: '100%',
  },
  resultMain: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  resultTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  resultTitle: {
    flex: 1,
    fontSize: 16,
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
    fontSize: 12,
  },
  resultMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modePriceInlineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  modePricePill: {
    borderRadius: 999,
    maxWidth: '100%',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  modePricePillText: {
    color: '#475569',
    fontSize: 11,
  },
  resultFooterRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    marginTop: 2,
  },
  selectedPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  selectedPillText: {
    fontSize: 11,
  },
  selectedHint: {
    fontSize: 12,
    opacity: 0.6,
  },
  detailHint: {
    color: '#2563EB',
    fontSize: 12,
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
  bottomSpacer: {
    height: 86,
  },
  sheetBackdrop: {
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetDismissArea: {
    flex: 1,
  },
  sheetCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    gap: 14,
    maxHeight: '72%',
    padding: 18,
  },
  sheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sheetTitle: {
    fontSize: 18,
  },
  sheetHint: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 2,
  },
  sheetCloseButton: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  sheetCloseText: {
    color: '#2563EB',
  },
  sheetScroll: {
    maxHeight: 360,
  },
  sheetList: {
    gap: 12,
    paddingBottom: 8,
  },
  draftItemRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  draftThumbWrap: {
    alignItems: 'center',
    borderRadius: 16,
    height: 56,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 56,
  },
  draftThumbImage: {
    height: '100%',
    width: '100%',
  },
  draftItemMain: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  draftItemTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  draftItemTitle: {
    color: '#0F172A',
    flex: 1,
    fontSize: 15,
  },
  draftItemPrice: {
    color: '#A86518',
    fontSize: 13,
  },
  draftItemMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  draftItemMeta: {
    color: '#64748B',
    fontSize: 12,
  },
  draftItemReferenceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  draftReferencePill: {
    backgroundColor: 'rgba(241,245,249,0.9)',
    borderRadius: 999,
    maxWidth: '100%',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  draftReferenceText: {
    color: '#475569',
    fontSize: 11,
  },
  draftItemAside: {
    alignItems: 'flex-end',
    minWidth: 112,
  },
  sheetFooter: {
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.18)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 14,
  },
  sheetTotalLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  sheetTotalValue: {
    color: '#A86518',
    fontSize: 20,
    marginTop: 2,
  },
  emptyDraftState: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 24,
  },
});
