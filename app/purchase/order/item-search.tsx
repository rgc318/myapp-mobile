import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { LinkOptionInput } from '@/components/link-option-input';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { normalizeAppError } from '@/lib/app-error';
import { formatDisplayUom } from '@/lib/display-uom';
import {
  getPurchaseOrderDraft,
  removePurchaseOrderDraftItem,
  upsertPurchaseOrderDraftItem,
  type PurchaseOrderDraftItem,
} from '@/lib/purchase-order-draft';
import { useFeedback } from '@/providers/feedback-provider';
import { searchWarehouses } from '@/services/purchases';
import { fetchProducts, searchCatalogProducts, type ProductSearchItem } from '@/services/products';

function formatMoney(value: number | null | undefined) {
  if (typeof value !== 'number') {
    return '未配置';
  }

  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 2,
  }).format(value);
}

function resolveInitialWarehouse(item: ProductSearchItem, fallbackWarehouse: string) {
  return fallbackWarehouse || item.warehouse || item.warehouseStockDetails?.[0]?.warehouse || '';
}

function getDraftItem(item: ProductSearchItem, warehouse: string, draftItems: PurchaseOrderDraftItem[]) {
  return draftItems.find(
    (draftItem) => draftItem.itemCode === item.itemCode && (draftItem.warehouse || '') === (warehouse || ''),
  );
}

function buildDraftKey(itemCode: string, warehouse: string) {
  return `${itemCode}::${warehouse || ''}`;
}

function formatQty(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }

  return String(value);
}

function DraftSummaryRow({
  item,
  onRemove,
}: {
  item: PurchaseOrderDraftItem;
  onRemove: (id: string) => void;
}) {
  return (
    <View style={styles.draftRow}>
      <View style={styles.draftRowCopy}>
        <ThemedText numberOfLines={1} style={styles.draftRowTitle} type="defaultSemiBold">
          {item.itemName || item.itemCode}
        </ThemedText>
        <ThemedText style={styles.draftRowMeta}>
          {item.qty} · {item.warehouse || '未指定仓库'} · {item.price || '默认采购价'}
        </ThemedText>
      </View>
      <Pressable onPress={() => onRemove(item.id)} style={styles.draftRemoveButton}>
        <ThemedText style={styles.draftRemoveText} type="defaultSemiBold">
          删除
        </ThemedText>
      </Pressable>
    </View>
  );
}

function ResultRow({
  item,
  selectedWarehouse,
  selectedQty,
  totalSelectedQty,
  onAdd,
  onDecrease,
}: {
  item: ProductSearchItem;
  selectedWarehouse: string;
  selectedQty: number;
  totalSelectedQty: number;
  onAdd: (item: ProductSearchItem) => void;
  onDecrease: (item: ProductSearchItem) => void;
}) {
  const surface = useThemeColor({}, 'surface');
  const borderColor = useThemeColor({}, 'border');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const tintColor = useThemeColor({}, 'tint');
  const currentWarehouseQty =
    item.warehouseStockDetails?.find((row) => row.warehouse === selectedWarehouse)?.qty ?? item.stockQty;

  return (
    <View style={[styles.resultRow, { backgroundColor: surface, borderColor }]}>
      <View style={[styles.resultThumbWrap, { backgroundColor: surfaceMuted }]}>
        {item.imageUrl ? (
          <Image contentFit="cover" source={item.imageUrl} style={styles.resultThumbImage} />
        ) : (
          <IconSymbol color={tintColor} name="shippingbox.fill" size={20} />
        )}
      </View>

      <View style={styles.resultMain}>
        <View style={styles.resultTitleRow}>
          <ThemedText numberOfLines={1} style={styles.resultTitle} type="defaultSemiBold">
            {item.itemName || item.itemCode}
          </ThemedText>
        </View>

        <View style={styles.resultMetaRow}>
          <ThemedText numberOfLines={1} style={styles.resultMeta}>
            编码 {item.itemCode}
          </ThemedText>
          <ThemedText style={styles.resultMeta}>
            默认入库 {selectedWarehouse || '未指定仓库'}
          </ThemedText>
        </View>

        <View style={styles.resultCompactRow}>
          <ThemedText style={styles.resultCompactText}>
            总库存 <ThemedText type="defaultSemiBold">{formatQty(item.totalQty)} {item.stockUom ? formatDisplayUom(item.stockUom) : ''}</ThemedText>
          </ThemedText>
          <ThemedText style={styles.resultCompactDivider}>·</ThemedText>
          <ThemedText style={styles.resultCompactText}>
            当前仓库 <ThemedText type="defaultSemiBold">{formatQty(currentWarehouseQty)} {item.stockUom ? formatDisplayUom(item.stockUom) : ''}</ThemedText>
          </ThemedText>
        </View>

        <View style={styles.resultCompactRow}>
          <ThemedText style={styles.resultPriceInlineLabel}>建议采购价</ThemedText>
          <ThemedText style={styles.resultPriceInlineValue} type="defaultSemiBold">
            {formatMoney(item.priceSummary?.standardBuyingRate)}
          </ThemedText>
          {totalSelectedQty > 0 ? (
            <>
              <ThemedText style={styles.resultCompactDivider}>·</ThemedText>
              <ThemedText style={styles.resultCompactText}>
                总加入 <ThemedText type="defaultSemiBold">{totalSelectedQty}</ThemedText>
              </ThemedText>
            </>
          ) : null}
        </View>
      </View>

      <View style={styles.actionColumn}>
        <View style={[styles.actionSummaryPill, { backgroundColor: surfaceMuted }]}>
          <ThemedText style={styles.actionSummaryLabel}>已加入</ThemedText>
          <ThemedText style={[styles.actionSummaryValue, { color: tintColor }]} type="defaultSemiBold">
            {selectedQty}
          </ThemedText>
        </View>

        <View style={[styles.actionStepper, { backgroundColor: surfaceMuted, borderColor }]}>
          <Pressable
            disabled={selectedQty <= 0}
            onPress={() => onDecrease(item)}
            style={[
              styles.qtyActionButton,
              styles.qtyActionButtonCompact,
              { borderColor, opacity: selectedQty > 0 ? 1 : 0.35 },
            ]}>
            <ThemedText style={[styles.qtyActionText, { color: tintColor }]} type="defaultSemiBold">
              -
            </ThemedText>
          </Pressable>

          <View style={styles.actionValueWrap}>
            <ThemedText style={styles.actionValueText} type="defaultSemiBold">
              {selectedQty}
            </ThemedText>
          </View>

          <Pressable
            onPress={() => onAdd(item)}
            style={[styles.qtyActionButton, styles.qtyActionButtonCompact, { borderColor }]}>
            <ThemedText style={[styles.qtyActionText, { color: tintColor }]} type="defaultSemiBold">
              +
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function PurchaseOrderItemSearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ lineId?: string; company?: string; warehouse?: string }>();
  const { showError, showSuccess } = useFeedback();
  const lineId = typeof params.lineId === 'string' ? params.lineId.trim() : '';
  const company = typeof params.company === 'string' ? params.company.trim() : '';
  const initialWarehouse = typeof params.warehouse === 'string' ? params.warehouse.trim() : '';

  const [query, setQuery] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState(initialWarehouse);
  const [results, setResults] = useState<ProductSearchItem[]>([]);
  const [selectedWarehouseMap, setSelectedWarehouseMap] = useState<Record<string, string>>({});
  const [draftItems, setDraftItems] = useState<PurchaseOrderDraftItem[]>(() => getPurchaseOrderDraft());
  const [showDraftSheet, setShowDraftSheet] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const surface = useThemeColor({}, 'surface');
  const borderColor = useThemeColor({}, 'border');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const tintColor = useThemeColor({}, 'tint');

  const draftCount = draftItems.length;
  const totalSelectedQty = useMemo(
    () =>
      draftItems.reduce((sum, item) => {
        const qty = Number(item.qty);
        return sum + (Number.isFinite(qty) ? qty : 0);
      }, 0),
    [draftItems],
  );

  const warehouseDraftSummaryText = useMemo(() => {
    if (!draftItems.length) {
      return '还没有加入商品';
    }

    return draftItems
      .slice(-2)
      .map((item) => `${item.itemName || item.itemCode} · ${item.warehouse || '未指定仓库'}`)
      .join(' / ');
  }, [draftItems]);

  const loadWarehouseOptions = async (text: string) => {
    const options = await searchWarehouses(text, company || undefined);
    return [
      {
        label: '全部仓库',
        value: '',
        description: company ? `不限制仓库，搜索 ${company} 下的商品` : '不限制仓库，搜索所有仓库的商品',
      },
      ...options,
    ];
  };

  const syncDraftState = () => {
    setDraftItems(getPurchaseOrderDraft());
  };

  const handleSearch = async (rawQuery?: string) => {
    const nextQuery = (rawQuery ?? query).trim();

    try {
      setIsLoading(true);
      setQuery(nextQuery);
      const items = nextQuery
        ? await searchCatalogProducts(nextQuery, {
            company: warehouseFilter.trim() ? undefined : company || undefined,
            warehouse: warehouseFilter.trim() || undefined,
            limit: 20,
          })
        : await fetchProducts({
            company: warehouseFilter.trim() ? undefined : company || undefined,
            warehouse: warehouseFilter.trim() || undefined,
            limit: 40,
          });
      setResults(items);
      setSelectedWarehouseMap(
        items.reduce<Record<string, string>>((acc, item) => {
          const preferredWarehouse =
            (warehouseFilter.trim() &&
            item.warehouseStockDetails?.some((row) => row.warehouse === warehouseFilter.trim())
              ? warehouseFilter.trim()
              : item.warehouse) ||
            item.warehouseStockDetails?.[0]?.warehouse ||
            '';
          if (preferredWarehouse) {
            acc[item.itemCode] = preferredWarehouse;
          }
          return acc;
        }, {}),
      );
      setMessage(
        items.length
          ? `${nextQuery ? `共找到 ${items.length} 个商品。` : `已载入 ${items.length} 个商品。`}${warehouseFilter.trim() ? ` 当前默认入库仓库为 ${warehouseFilter.trim()}。` : ''}${nextQuery ? '' : ' 可继续输入关键词缩小范围。'}`
          : '没有找到匹配商品。',
      );
    } catch (error) {
      const appError = normalizeAppError(error, '采购商品搜索失败。');
      setResults([]);
      setMessage(appError.message);
      showError(appError.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = (item: ProductSearchItem) => {
    const selectedWarehouse = selectedWarehouseMap[item.itemCode] ?? resolveInitialWarehouse(item, warehouseFilter.trim());
    const existing = getDraftItem(item, selectedWarehouse, getPurchaseOrderDraft());
    const nextQty = existing ? String((Number(existing.qty) || 0) + 1) : '1';
    const nextItem: PurchaseOrderDraftItem = {
      id: lineId || existing?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      itemCode: item.itemCode,
      itemName: item.itemName || item.itemCode,
      imageUrl: item.imageUrl || existing?.imageUrl || null,
      standardBuyingRate:
        typeof item.priceSummary?.standardBuyingRate === 'number'
          ? item.priceSummary.standardBuyingRate
          : existing?.standardBuyingRate ?? null,
      qty: nextQty,
      price:
        existing?.price ||
        (typeof item.priceSummary?.standardBuyingRate === 'number'
          ? String(item.priceSummary.standardBuyingRate)
          : ''),
      warehouse: selectedWarehouse,
      uom: item.stockUom || item.uom || '',
      stockUom: item.stockUom || existing?.stockUom || item.uom || null,
      totalQty: typeof item.totalQty === 'number' ? item.totalQty : existing?.totalQty ?? null,
      allUoms:
        item.allUoms?.length
          ? item.allUoms
          : existing?.allUoms?.length
            ? existing.allUoms
            : item.stockUom
              ? [item.stockUom]
              : [],
      uomConversions: item.uomConversions?.length ? item.uomConversions : existing?.uomConversions ?? [],
      warehouseStockDetails:
        item.warehouseStockDetails?.length ? item.warehouseStockDetails : existing?.warehouseStockDetails ?? [],
    };
    upsertPurchaseOrderDraftItem(nextItem);
    syncDraftState();
    setMessage(`已将 ${item.itemName || item.itemCode} 加入采购单，当前仓库 ${selectedWarehouse || '未指定'}，数量 ${nextQty}。`);
    showSuccess(`已加入 ${item.itemName || item.itemCode}`);
  };

  const handleDecrease = (item: ProductSearchItem) => {
    const selectedWarehouse = selectedWarehouseMap[item.itemCode] ?? resolveInitialWarehouse(item, warehouseFilter.trim());
    const existing = getDraftItem(item, selectedWarehouse, getPurchaseOrderDraft());
    if (!existing) {
      return;
    }
    const nextQty = (Number(existing.qty) || 0) - 1;
    if (nextQty <= 0) {
      removePurchaseOrderDraftItem(existing.id);
      syncDraftState();
      setMessage(`已将 ${item.itemName || item.itemCode} 从采购单中移除。`);
      return;
    }
    upsertPurchaseOrderDraftItem({ ...existing, qty: String(nextQty) });
    syncDraftState();
    setMessage(`已调整 ${item.itemName || item.itemCode} 数量，当前为 ${nextQty}。`);
  };

  useEffect(() => {
    void handleSearch(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppShell
      compactHeader
      contentCard={false}
      description="搜索采购商品并加入当前采购单。"
      showWorkflowQuickNav={false}
      footer={
        <View style={styles.footerBar}>
          <Pressable
            onPress={() => setShowDraftSheet(true)}
            style={[styles.footerDraftTrigger, { backgroundColor: surface }]}>
            <View style={styles.footerIconWrap}>
              <IconSymbol color={tintColor} name="shippingbox.fill" size={18} />
            </View>
            <View style={styles.footerCopy}>
              <ThemedText style={styles.footerTitle} type="defaultSemiBold">
                已选 {draftCount} 行，录入数量 {totalSelectedQty}
              </ThemedText>
              <ThemedText style={styles.footerHint}>{warehouseDraftSummaryText}</ThemedText>
            </View>
          </Pressable>
          <Pressable onPress={() => router.replace('/purchase/order/create')} style={[styles.returnButton, { backgroundColor: tintColor }]}>
            <ThemedText style={styles.returnButtonText} type="defaultSemiBold">
              返回采购单
            </ThemedText>
          </Pressable>
        </View>
      }
      title="选择采购商品">
      <View style={[styles.searchCard, { backgroundColor: surface, borderColor }]}>
        <View style={styles.searchCardTopRow}>
          <View style={styles.searchStatusChip}>
            <ThemedText style={styles.searchStatusText} type="defaultSemiBold">
              {query.trim() ? '关键词搜索中' : '浏览全部商品'}
            </ThemedText>
          </View>
          <Pressable onPress={() => void handleSearch()} style={[styles.searchButtonCompact, { backgroundColor: tintColor }]}>
            <ThemedText style={styles.searchButtonText} type="defaultSemiBold">
              {isLoading ? '加载中' : query.trim() ? '搜索' : '刷新'}
            </ThemedText>
          </Pressable>
        </View>

        <View style={[styles.searchInputWrap, { backgroundColor: surfaceMuted, borderColor }]}>
          <IconSymbol color={tintColor} name="magnifyingglass" size={18} />
          <TextInput
            autoCorrect={false}
            autoFocus
            onChangeText={setQuery}
            onSubmitEditing={() => void handleSearch()}
            placeholder="搜索商品名称、编码、别名"
            placeholderTextColor="rgba(31,42,55,0.45)"
            style={styles.searchInput}
            value={query}
          />
        </View>
        <View style={styles.searchMetaRow}>
          <ThemedText style={styles.searchHintText}>
            {warehouseFilter.trim() ? `默认入库：${warehouseFilter.trim()}` : '未指定默认入库仓库'}
          </ThemedText>
          <Pressable onPress={() => setShowFilters((current) => !current)}>
            <ThemedText style={[styles.searchMetaSecondary, { color: tintColor }]} type="defaultSemiBold">
              {showFilters ? '收起筛选' : '仓库筛选'}
            </ThemedText>
          </Pressable>
        </View>

        {showFilters ? (
          <View style={styles.searchFilterField}>
            <LinkOptionInput
              helperText={company ? `当前只展示公司 ${company} 下的仓库。这里只决定默认带入的入库仓库。` : '这里只决定默认带入的入库仓库，回到采购单后仍可继续调整。'}
              label="默认入库仓库（可选）"
              loadOptions={loadWarehouseOptions}
              onChangeText={setWarehouseFilter}
              onOptionSelect={setWarehouseFilter}
              placeholder="全部仓库"
              value={warehouseFilter}
            />
          </View>
        ) : null}
      </View>

      <View style={styles.resultList}>
        {message ? (
          <View style={[styles.inlineNotice, { backgroundColor: surface, borderColor }]}>
            <ThemedText style={styles.metaText}>{message}</ThemedText>
          </View>
        ) : null}

        {results.map((item) => {
          const selectedWarehouse = selectedWarehouseMap[item.itemCode] ?? resolveInitialWarehouse(item, warehouseFilter.trim());
          const currentWarehouseQty = Number(getDraftItem(item, selectedWarehouse, draftItems)?.qty || '0');
          const totalSelected = draftItems
            .filter((draftItem) => draftItem.itemCode === item.itemCode)
            .reduce((sum, draftItem) => sum + (Number(draftItem.qty) || 0), 0);

          return (
            <ResultRow
              item={item}
              key={buildDraftKey(item.itemCode, selectedWarehouse)}
              onAdd={handleAdd}
              onDecrease={handleDecrease}
              selectedQty={currentWarehouseQty}
              selectedWarehouse={selectedWarehouse}
              totalSelectedQty={totalSelected}
            />
          );
        })}

        {!results.length && query.trim() && !isLoading ? (
          <View style={[styles.emptyState, { backgroundColor: surfaceMuted, borderColor }]}>
            <ThemedText type="defaultSemiBold">没有找到匹配商品</ThemedText>
            <ThemedText>试试换个关键词，或者放宽仓库过滤条件。</ThemedText>
          </View>
        ) : null}
      </View>

      <View style={styles.bottomSpacer} />

      <Modal
        animationType="slide"
        onRequestClose={() => setShowDraftSheet(false)}
        transparent
        visible={showDraftSheet}>
        <View style={styles.sheetBackdrop}>
          <Pressable onPress={() => setShowDraftSheet(false)} style={styles.sheetDismissArea} />
          <View style={[styles.sheetCard, { backgroundColor: surface, borderColor }]}>
            <View style={styles.sheetHeader}>
              <View>
                <ThemedText style={styles.sheetTitle} type="defaultSemiBold">
                  当前采购草稿
                </ThemedText>
                <ThemedText style={styles.sheetHint}>
                  已选 {draftCount} 行，录入数量 {totalSelectedQty}
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
                    <DraftSummaryRow
                      item={item}
                      key={item.id}
                      onRemove={(id) => {
                        removePurchaseOrderDraftItem(id);
                        syncDraftState();
                      }}
                    />
                  ))}
                </ScrollView>
                <Pressable
                  onPress={() => {
                    setShowDraftSheet(false);
                    router.replace('/purchase/order/create');
                  }}
                  style={[styles.sheetReturnButton, { backgroundColor: tintColor }]}>
                  <ThemedText style={styles.returnButtonText} type="defaultSemiBold">
                    返回采购单
                  </ThemedText>
                </Pressable>
              </>
            ) : (
              <View style={styles.emptyDraftState}>
                <ThemedText type="defaultSemiBold">还没有加入商品</ThemedText>
                <ThemedText style={styles.metaText}>搜索并点击“+”后，这里会显示当前采购草稿。</ThemedText>
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
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    overflow: 'visible',
    padding: 14,
    zIndex: 40,
  },
  searchCardTopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  searchStatusChip: {
    backgroundColor: '#EFF6FF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  searchStatusText: {
    color: '#2563EB',
    fontSize: 12,
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
  searchFilterField: {
    zIndex: 80,
  },
  searchMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  searchHintText: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  searchMetaSecondary: {
    color: '#94A3B8',
    fontSize: 12,
  },
  searchButtonText: {
    color: '#FFF',
  },
  searchButtonCompact: {
    alignItems: 'center',
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 40,
    minWidth: 82,
    paddingHorizontal: 16,
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
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  resultList: {
    gap: 10,
    zIndex: 1,
  },
  resultRow: {
    alignItems: 'flex-start',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 10,
  },
  resultThumbWrap: {
    alignItems: 'center',
    borderRadius: 14,
    height: 50,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 50,
  },
  resultThumbImage: {
    height: '100%',
    width: '100%',
  },
  resultMain: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  resultTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  resultTitle: {
    flex: 1,
    fontSize: 17,
  },
  resultMeta: {
    color: '#64748B',
    fontSize: 12,
  },
  resultMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  resultCompactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  resultCompactText: {
    color: '#64748B',
    fontSize: 12,
  },
  resultCompactDivider: {
    color: '#CBD5E1',
    fontSize: 12,
  },
  resultPriceInlineLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  resultPriceInlineValue: {
    color: '#0F172A',
    fontSize: 15,
  },
  actionColumn: {
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    minWidth: 88,
  },
  actionSummaryPill: {
    alignItems: 'center',
    borderRadius: 14,
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 8,
    width: '100%',
  },
  actionSummaryLabel: {
    color: '#64748B',
    fontSize: 11,
    textAlign: 'center',
  },
  actionSummaryValue: {
    fontSize: 17,
  },
  actionStepper: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 6,
    paddingVertical: 6,
    width: '100%',
  },
  actionValueWrap: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minWidth: 20,
  },
  actionValueText: {
    color: '#0F172A',
    fontSize: 15,
  },
  qtyActionButton: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  qtyActionButtonCompact: {
    backgroundColor: '#FFFFFF',
  },
  qtyActionText: {
    fontSize: 18,
    lineHeight: 18,
  },
  emptyState: {
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  bottomSpacer: {
    height: 20,
  },
  sheetBackdrop: {
    backgroundColor: 'rgba(15,23,42,0.24)',
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
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 24,
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
    fontSize: 12,
    marginTop: 2,
  },
  sheetCloseButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  sheetCloseText: {
    color: '#2563EB',
  },
  sheetScroll: {
    maxHeight: 320,
  },
  sheetList: {
    gap: 10,
    paddingBottom: 8,
  },
  draftRow: {
    alignItems: 'center',
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  draftRowCopy: {
    flex: 1,
    gap: 4,
    marginRight: 10,
  },
  draftRowTitle: {
    fontSize: 14,
  },
  draftRowMeta: {
    color: '#64748B',
    fontSize: 12,
  },
  draftRemoveButton: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  draftRemoveText: {
    color: '#DC2626',
    fontSize: 12,
  },
  sheetReturnButton: {
    alignItems: 'center',
    borderRadius: 16,
    justifyContent: 'center',
    minHeight: 48,
  },
  emptyDraftState: {
    alignItems: 'center',
    gap: 8,
    minHeight: 120,
    justifyContent: 'center',
  },
});
