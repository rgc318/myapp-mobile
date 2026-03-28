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
import { searchCatalogProducts, type ProductSearchItem } from '@/services/products';

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

  return (
    <View style={[styles.resultRow, { backgroundColor: surface, borderColor }]}>
      <View style={styles.resultMain}>
        <View style={styles.resultTitleRow}>
          <ThemedText numberOfLines={1} style={styles.resultTitle} type="defaultSemiBold">
            {item.itemName || item.itemCode}
          </ThemedText>
        </View>

        <ThemedText numberOfLines={1} style={styles.resultWarehouseHeadline} type="defaultSemiBold">
          当前仓库 {selectedWarehouse || '未指定仓库'}
        </ThemedText>

        <View style={styles.resultMetaRow}>
          <ThemedText numberOfLines={1} style={styles.resultMeta}>
            编码 {item.itemCode}
          </ThemedText>
          <ThemedText style={styles.resultMeta}>库存单位 {item.stockUom ? formatDisplayUom(item.stockUom) : '未设置'}</ThemedText>
        </View>

        <View style={styles.stockSummaryRow}>
          <ThemedText style={styles.stockSummaryLabel}>总库存</ThemedText>
          <ThemedText style={styles.stockSummaryValue} type="defaultSemiBold">
            {typeof item.totalQty === 'number' ? item.totalQty : '—'}
          </ThemedText>
        </View>

        <View style={styles.modePriceInlineRow}>
          <View style={styles.modePriceBlock}>
            <ThemedText style={styles.modePriceLabel}>建议采购价</ThemedText>
            <ThemedText style={styles.modePriceValue} type="defaultSemiBold">
              {formatMoney(item.priceSummary?.standardBuyingRate)}
            </ThemedText>
          </View>
          <View style={styles.modePriceBlock}>
            <ThemedText style={styles.modePriceLabel}>总加入数</ThemedText>
            <ThemedText style={styles.modePriceValue} type="defaultSemiBold">
              {totalSelectedQty}
            </ThemedText>
          </View>
        </View>

        <View style={[styles.warehouseSelectorButton, { backgroundColor: surfaceMuted, borderColor }]}>
          <View style={styles.warehouseSelectorCopy}>
            <ThemedText style={styles.warehouseSelectorLabel}>默认入库目标</ThemedText>
            <ThemedText style={styles.warehouseSelectorValue} numberOfLines={1} type="defaultSemiBold">
              {selectedWarehouse || '未指定仓库'}
            </ThemedText>
            <ThemedText style={styles.warehouseSelectorHint}>
              最终仓库可回到采购明细卡继续修改。
            </ThemedText>
          </View>
        </View>
      </View>

      <View style={[styles.actionColumn, { backgroundColor: surfaceMuted, borderColor }]}>
        <ThemedText style={styles.actionSummaryLabel}>当前仓库加入数</ThemedText>
        <ThemedText style={[styles.actionSummaryValue, { color: tintColor }]} type="defaultSemiBold">
          {selectedQty}
        </ThemedText>
        <View style={styles.actionControlGroup}>
          <Pressable onPress={() => onDecrease(item)} style={[styles.qtyActionButton, { borderColor }]}>
            <ThemedText style={[styles.qtyActionText, { color: tintColor }]} type="defaultSemiBold">
              -
            </ThemedText>
          </Pressable>
          <Pressable onPress={() => onAdd(item)} style={[styles.qtyActionButton, { borderColor }]}>
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

    if (!nextQuery) {
      setMessage('请输入商品编码、名称、别名或关键词。');
      setResults([]);
      return;
    }

    try {
      setIsLoading(true);
      setQuery(nextQuery);
      const items = await searchCatalogProducts(nextQuery, {
        company: warehouseFilter.trim() ? undefined : company || undefined,
        warehouse: warehouseFilter.trim() || undefined,
        limit: 20,
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
          ? `共找到 ${items.length} 个商品。${warehouseFilter.trim() ? ` 当前按仓库 ${warehouseFilter.trim()} 搜索。` : ''}`
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
    if (query.trim()) {
      void handleSearch(query);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppShell
      compactHeader
      contentCard={false}
      description="搜索采购商品并加入当前采购单。"
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
      title="商品搜索">
      <View style={[styles.searchCard, { backgroundColor: surface, borderColor }]}>
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
        <View style={styles.searchFilterField}>
          <LinkOptionInput
            helperText={company ? `仅显示公司 ${company} 下的仓库。目标仓库会影响默认带入的仓库，但不会把商品结果强制过滤掉。` : '目标仓库会影响默认带入的仓库，但不会把商品结果强制过滤掉。'}
            label="目标仓库"
            loadOptions={loadWarehouseOptions}
            onChangeText={setWarehouseFilter}
            onOptionSelect={setWarehouseFilter}
            placeholder="全部仓库"
            value={warehouseFilter}
          />
        </View>
        <View style={styles.searchMetaRow}>
          <ThemedText style={styles.searchHintText}>
            {warehouseFilter.trim() ? `目标仓库 ${warehouseFilter.trim()}` : '未指定目标仓库'}
          </ThemedText>
          <Pressable onPress={() => void handleSearch()} style={[styles.searchButtonCompact, { backgroundColor: tintColor }]}>
            <ThemedText style={styles.searchButtonText} type="defaultSemiBold">
              {isLoading ? '搜索中' : '搜索'}
            </ThemedText>
          </Pressable>
        </View>
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
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    overflow: 'visible',
    padding: 16,
    zIndex: 40,
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
  searchFilterFieldCompact: {
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
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  resultList: {
    gap: 12,
    zIndex: 1,
  },
  resultRow: {
    alignItems: 'flex-start',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
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
    fontSize: 22,
  },
  resultWarehouseHeadline: {
    color: '#0F172A',
    fontSize: 18,
  },
  resultMeta: {
    opacity: 0.68,
    fontSize: 11,
  },
  resultMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stockSummaryRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  stockSummaryLabel: {
    color: '#64748B',
    fontSize: 13,
  },
  stockSummaryValue: {
    color: '#0F172A',
    fontSize: 18,
  },
  modePriceInlineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modePriceBlock: {
    flex: 1,
    minWidth: 132,
  },
  modePriceLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  modePriceValue: {
    color: '#0F172A',
    fontSize: 15,
  },
  warehouseSelectorButton: {
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 8,
    padding: 12,
  },
  warehouseSelectorCopy: {
    gap: 4,
  },
  warehouseSelectorLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  warehouseSelectorValue: {
    fontSize: 14,
  },
  warehouseSelectorHint: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
  },
  actionColumn: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    justifyContent: 'center',
    minWidth: 72,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  actionSummaryLabel: {
    color: '#64748B',
    fontSize: 11,
    textAlign: 'center',
  },
  actionSummaryValue: {
    fontSize: 18,
  },
  actionControlGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  qtyActionButton: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
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
