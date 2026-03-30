import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { BarcodeScannerSheet } from '@/components/barcode-scanner-sheet';
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

function resolvePreferredWarehouse(item: ProductSearchItem, preferredWarehouse: string) {
  if (preferredWarehouse && item.warehouseStockDetails?.some((row) => row.warehouse === preferredWarehouse)) {
    return preferredWarehouse;
  }

  return item.warehouse || item.warehouseStockDetails?.[0]?.warehouse || preferredWarehouse || '';
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
  targetWarehouseQty,
  selectedQty,
  totalSelectedQty,
  onAdd,
  onDecrease,
}: {
  item: ProductSearchItem;
  targetWarehouseQty: number;
  selectedQty: number;
  totalSelectedQty: number;
  onAdd: (item: ProductSearchItem) => void;
  onDecrease: (item: ProductSearchItem) => void;
}) {
  const surface = useThemeColor({}, 'surface');
  const borderColor = useThemeColor({}, 'border');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const tintColor = useThemeColor({}, 'tint');
  const stockUomLabel = item.stockUom ? formatDisplayUom(item.stockUom) : '未设置';
  const totalStockQty = item.globalTotalQty ?? item.totalQty;

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
        </View>

        <View style={styles.resultSummaryRow}>
          <View style={styles.resultSummaryItem}>
            <ThemedText style={styles.resultSummaryLabel}>总库存</ThemedText>
            <ThemedText style={styles.resultSummaryValue} type="defaultSemiBold">
              {formatQty(totalStockQty)} {stockUomLabel}
            </ThemedText>
          </View>
          <View style={styles.resultSummaryItem}>
            <ThemedText style={styles.resultSummaryLabel}>该仓库存</ThemedText>
            <ThemedText style={styles.resultSummaryValue} type="defaultSemiBold">
              {formatQty(targetWarehouseQty)} {stockUomLabel}
            </ThemedText>
          </View>
        </View>

        <View style={styles.resultSummaryRow}>
          <View style={styles.resultSummaryItem}>
            <ThemedText style={styles.resultSummaryLabel}>参考采购价</ThemedText>
            <ThemedText style={styles.resultSummaryValue} type="defaultSemiBold">
              {formatMoney(item.priceSummary?.standardBuyingRate)}
            </ThemedText>
          </View>
          <View style={styles.resultSummaryItem}>
            <ThemedText style={styles.resultSummaryLabel}>库存单位</ThemedText>
            <ThemedText style={styles.resultSummaryValue} type="defaultSemiBold">
              {stockUomLabel}
            </ThemedText>
          </View>
        </View>
      </View>

      <View style={styles.actionColumn}>
        <View style={[styles.actionControlCard, { backgroundColor: surfaceMuted, borderColor }]}>
          <View style={styles.actionControlTopRow}>
            <View style={styles.totalAddedHintRow}>
              <ThemedText style={styles.totalAddedHintLabel}>总已加</ThemedText>
              <ThemedText style={[styles.totalAddedHintValue, { color: tintColor }]} type="defaultSemiBold">
                {totalSelectedQty}
              </ThemedText>
            </View>
          </View>

          <View style={styles.actionControlHeader}>
            <ThemedText style={styles.actionSummaryLabel}>当前已加</ThemedText>
            <ThemedText style={[styles.actionSummaryValue, { color: tintColor }]} type="defaultSemiBold">
              {selectedQty}
            </ThemedText>
          </View>

          <View style={styles.actionStepper}>
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
    </View>
  );
}

export default function PurchaseOrderItemSearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    lineId?: string;
    company?: string;
    warehouse?: string;
    defaultWarehouse?: string;
    draftScope?: string;
    returnTo?: string;
  }>();
  const { showError, showSuccess } = useFeedback();
  const lineId = typeof params.lineId === 'string' ? params.lineId.trim() : '';
  const company = typeof params.company === 'string' ? params.company.trim() : '';
  const draftScope = typeof params.draftScope === 'string' && params.draftScope.trim() ? params.draftScope.trim() : undefined;
  const returnTo = typeof params.returnTo === 'string' && params.returnTo.trim() ? params.returnTo.trim() : '/purchase/order/create';
  const defaultWarehouse =
    typeof params.defaultWarehouse === 'string' && params.defaultWarehouse.trim()
      ? params.defaultWarehouse.trim()
      : typeof params.warehouse === 'string'
        ? params.warehouse.trim()
        : '';

  const [query, setQuery] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [results, setResults] = useState<ProductSearchItem[]>([]);
  const [selectedWarehouseMap, setSelectedWarehouseMap] = useState<Record<string, string>>({});
  const [draftItems, setDraftItems] = useState<PurchaseOrderDraftItem[]>(() => getPurchaseOrderDraft(draftScope));
  const [showDraftSheet, setShowDraftSheet] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
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
        description: company ? `不限制仓库，搜索 ${company} 下的全部仓库商品` : '不限制仓库，搜索全部仓库商品',
      },
      ...options,
    ];
  };

  const resolveTargetWarehouse = (item: ProductSearchItem) =>
    selectedWarehouseMap[item.itemCode] ||
    draftItems.find((draftItem) => draftItem.itemCode === item.itemCode)?.warehouse ||
    defaultWarehouse ||
    item.warehouseStockDetails?.[0]?.warehouse ||
    item.warehouse ||
    '';

  const syncDraftState = () => {
    const nextDraft = getPurchaseOrderDraft(draftScope);
    setDraftItems(nextDraft);
    setSelectedWarehouseMap((current) => {
      const next = { ...current };
      for (const draftItem of nextDraft) {
        if (draftItem.itemCode && draftItem.warehouse && !next[draftItem.itemCode]) {
          next[draftItem.itemCode] = draftItem.warehouse;
        }
      }
      return next;
    });
  };

  const handleSearch = async (rawQuery?: string) => {
    const nextQuery = (rawQuery ?? query).trim();
    let items: ProductSearchItem[] = [];

    try {
      setIsLoading(true);
      setQuery(nextQuery);
      items = nextQuery
        ? await searchCatalogProducts(nextQuery, {
            company: warehouseFilter.trim() ? undefined : company || undefined,
            warehouse: warehouseFilter.trim() || undefined,
            inStockOnly,
            limit: 20,
          })
        : (
            await fetchProducts({
              company: warehouseFilter.trim() ? undefined : company || undefined,
              warehouse: warehouseFilter.trim() || undefined,
              limit: 40,
            })
          ).filter((item) => {
            if (!inStockOnly) {
              return true;
            }

            const qty =
              warehouseFilter.trim()
                ? (item.warehouseStockDetails?.find((row) => row.warehouse === warehouseFilter.trim())?.qty ??
                  item.stockQty ??
                  0)
                : (item.globalTotalQty ?? item.totalQty ?? item.stockQty ?? 0);
            return qty > 0;
          });
      setResults(items);
      setSelectedWarehouseMap(
        items.reduce<Record<string, string>>((acc, item) => {
          const preferredWarehouse =
            draftItems.find((draftItem) => draftItem.itemCode === item.itemCode)?.warehouse ||
            defaultWarehouse ||
            resolvePreferredWarehouse(item, '');
          if (preferredWarehouse) {
            acc[item.itemCode] = preferredWarehouse;
          }
          return acc;
        }, {}),
      );
      setMessage(
        items.length
          ? `${nextQuery ? `找到 ${items.length} 个商品` : `已载入 ${items.length} 个商品`}${warehouseFilter.trim() ? ` · 查看仓 ${warehouseFilter.trim()}` : ' · 全部仓库'}${inStockOnly ? ' · 仅看有库存' : ''}${nextQuery ? '' : ' · 可继续输入关键词缩小范围'}`
          : '没有找到匹配商品。',
      );
    } catch (error) {
      const appError = normalizeAppError(error, '采购商品搜索失败。');
      setResults([]);
      setMessage(appError.message);
      showError(appError.message);
      return [] as ProductSearchItem[];
    } finally {
      setIsLoading(false);
    }

    return items;
  };

  const handleScanEntry = () => {
    setShowScanner(true);
  };

  const handleAdd = (item: ProductSearchItem, warehouseOverride?: string) => {
    const selectedWarehouse =
      warehouseOverride ||
      resolveTargetWarehouse(item);
    const existing = getDraftItem(item, selectedWarehouse, getPurchaseOrderDraft(draftScope));
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
    upsertPurchaseOrderDraftItem(nextItem, draftScope);
    syncDraftState();
    setMessage(`已将 ${item.itemName || item.itemCode} 加入采购单，目标入库仓 ${selectedWarehouse || '未指定'}，数量 ${nextQty}。`);
    showSuccess(`已加入 ${item.itemName || item.itemCode}`);
  };

  const handleDecrease = (item: ProductSearchItem) => {
    const selectedWarehouse = resolveTargetWarehouse(item);
    const existing = getDraftItem(item, selectedWarehouse, getPurchaseOrderDraft(draftScope));
    if (!existing) {
      return;
    }
    const nextQty = (Number(existing.qty) || 0) - 1;
    if (nextQty <= 0) {
      removePurchaseOrderDraftItem(existing.id, draftScope);
      syncDraftState();
      setMessage(`已将 ${item.itemName || item.itemCode} 从采购单中移除。`);
      return;
    }
    upsertPurchaseOrderDraftItem({ ...existing, qty: String(nextQty) }, draftScope);
    syncDraftState();
    setMessage(`已调整 ${item.itemName || item.itemCode} 数量，当前为 ${nextQty}。`);
  };

  const handleBarcodeMatched = async (scannedValue: string) => {
    const normalized = scannedValue.trim();
    if (!normalized) {
      return;
    }

    setShowScanner(false);
    const items = await handleSearch(normalized);
    if (!items.length) {
      setMessage(`未找到条码 ${normalized} 对应的商品。`);
      showError(`未找到条码 ${normalized}`);
      return;
    }

    const exactMatchedItems = items.filter(
      (item) => item.barcode?.trim() === normalized || item.itemCode?.trim() === normalized,
    );
    const targetItem = exactMatchedItems.length === 1 ? exactMatchedItems[0] : items.length === 1 ? items[0] : null;

    if (!targetItem) {
      setMessage(`已按条码 ${normalized} 搜到 ${items.length} 个商品，请继续确认要加入的商品。`);
      showSuccess(`已按条码 ${normalized} 搜索`);
      return;
    }

    handleAdd(targetItem, defaultWarehouse || undefined);
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
          <Pressable
            onPress={() => router.replace(returnTo as never)}
            style={[styles.returnButton, { backgroundColor: tintColor }]}>
            <ThemedText style={styles.returnButtonText} type="defaultSemiBold">
              返回采购单
            </ThemedText>
          </Pressable>
        </View>
      }
      title="选择采购商品">
      <View style={[styles.searchCard, { backgroundColor: surface, borderColor }]}>
        <View style={styles.searchTopRow}>
          <View style={[styles.searchInputWrap, styles.searchInputWrapExpanded, { backgroundColor: surfaceMuted, borderColor }]}>
            <IconSymbol color={tintColor} name="magnifyingglass" size={18} />
            <TextInput
              autoCorrect={false}
              autoFocus
              onChangeText={setQuery}
              onSubmitEditing={() => void handleSearch()}
              placeholder="搜索商品名称、编码、条码或别名"
              placeholderTextColor="rgba(31,42,55,0.45)"
              style={styles.searchInput}
              value={query}
            />
          </View>

          <Pressable onPress={handleScanEntry} style={[styles.scanEntryButton, { backgroundColor: surfaceMuted, borderColor }]}>
            <IconSymbol color={tintColor} name="barcode.viewfinder" size={18} />
            <ThemedText style={styles.scanEntryLabel} type="defaultSemiBold">
              扫码
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.searchFilterRow}>
          <View style={styles.searchFilterField}>
            <LinkOptionInput
              helperText={
                company
                  ? `当前只展示公司 ${company} 下的仓库。这里只影响库存查看和搜索范围，不决定新增商品入哪个仓。`
                  : '这里只影响库存查看和搜索范围，不决定新增商品入哪个仓。'
              }
              inputActionText="切换"
              label="库存查看仓库（可选）"
              loadOptions={loadWarehouseOptions}
              onChangeText={setWarehouseFilter}
              onOptionSelect={setWarehouseFilter}
              placeholder="全部仓库"
              value={warehouseFilter}
            />
          </View>

          <View style={styles.filterActionsColumn}>
            {warehouseFilter.trim() ? (
              <Pressable
                onPress={() => setWarehouseFilter('')}
                style={[styles.toggleChip, { backgroundColor: surfaceMuted, borderColor }]}>
                <ThemedText style={styles.toggleChipText} type="defaultSemiBold">
                  清空仓库选项
                </ThemedText>
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => setInStockOnly((current) => !current)}
              style={[styles.stockToggleRow, { backgroundColor: surfaceMuted, borderColor }]}>
              <View style={styles.stockToggleCopy}>
                <ThemedText style={styles.stockToggleLabel} type="defaultSemiBold">
                  仅看有库存
                </ThemedText>
                <ThemedText style={styles.stockToggleHint}>
                  {inStockOnly ? '开启后隐藏无库存商品' : '关闭后显示全部商品'}
                </ThemedText>
              </View>
              <View
                style={[
                  styles.stockToggleTrack,
                  { backgroundColor: inStockOnly ? tintColor : '#CBD5E1' },
                ]}>
                <View
                  style={[
                    styles.stockToggleThumb,
                    inStockOnly ? styles.stockToggleThumbOn : styles.stockToggleThumbOff,
                  ]}
                />
              </View>
            </Pressable>
          </View>
        </View>

        <ThemedText style={styles.searchHintText}>
          支持编码、名称、条码与别名搜索；留空会显示全部仓库商品。新增商品时会按采购单里的默认入库仓带入，也可直接扫码添加。
        </ThemedText>

        <View style={[styles.defaultWarehouseNotice, { backgroundColor: surfaceMuted, borderColor }]}>
          <ThemedText style={styles.defaultWarehouseNoticeLabel}>新增默认入库仓</ThemedText>
          <ThemedText style={styles.defaultWarehouseNoticeValue} type="defaultSemiBold">
            {defaultWarehouse || '未设置，将按当前公司默认仓或供应商建议仓带入'}
          </ThemedText>
        </View>

        <Pressable onPress={() => void handleSearch()} style={[styles.searchButton, { backgroundColor: tintColor }]}>
          <ThemedText style={styles.searchButtonText} type="defaultSemiBold">
            {isLoading ? '搜索中...' : '开始搜索'}
          </ThemedText>
        </Pressable>
      </View>

      <View style={styles.resultList}>
        {message ? (
          <View style={[styles.inlineNotice, { backgroundColor: surfaceMuted, borderColor }]}>
            <View style={[styles.inlineNoticeAccent, { backgroundColor: tintColor }]} />
            <ThemedText style={styles.metaText}>{message}</ThemedText>
          </View>
        ) : null}

        {results.map((item) => {
          const selectedWarehouse = resolveTargetWarehouse(item);
          const targetWarehouseQty =
            item.warehouseStockDetails?.find((row) => row.warehouse === selectedWarehouse)?.qty ??
            (selectedWarehouse && selectedWarehouse === item.warehouse ? (item.stockQty ?? 0) : 0);
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
              targetWarehouseQty={targetWarehouseQty}
              totalSelectedQty={totalSelected}
            />
          );
        })}

        {!results.length && !isLoading ? (
          <View style={[styles.emptyState, { backgroundColor: surfaceMuted, borderColor }]}>
            <ThemedText type="defaultSemiBold">
              {query.trim() ? '没有找到匹配商品' : '当前筛选下没有可显示商品'}
            </ThemedText>
            <ThemedText>
              {query.trim() ? '试试换个关键词，或者放宽仓库过滤条件。' : '可以关闭“仅看有库存”或切换仓库后再试。'}
            </ThemedText>
          </View>
        ) : null}
      </View>

      <View style={styles.bottomSpacer} />

      <BarcodeScannerSheet
        description="将商品条码放入取景框内，扫到后会自动搜索；若只匹配一个商品，会直接加入采购单。"
        onClose={() => setShowScanner(false)}
        onScanned={handleBarcodeMatched}
        title="扫码添加采购商品"
        visible={showScanner}
      />

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
                        removePurchaseOrderDraftItem(id, draftScope);
                        syncDraftState();
                      }}
                    />
                  ))}
                </ScrollView>
                <Pressable
                  onPress={() => {
                    setShowDraftSheet(false);
                    router.replace(returnTo as never);
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
    gap: 12,
    overflow: 'visible',
    padding: 14,
    zIndex: 40,
  },
  searchTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
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
  searchInputWrapExpanded: {
    flex: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    minHeight: 38,
    paddingVertical: 0,
  },
  scanEntryButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 14,
    width: 72,
  },
  scanEntryLabel: {
    color: '#0F172A',
    fontSize: 12,
  },
  searchFilterRow: {
    gap: 12,
    zIndex: 120,
  },
  searchFilterField: {
    zIndex: 140,
  },
  filterActionsColumn: {
    gap: 10,
  },
  toggleChip: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
  },
  toggleChipText: {
    color: '#0F172A',
    fontSize: 13,
  },
  stockToggleRow: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  stockToggleCopy: {
    flex: 1,
  },
  stockToggleLabel: {
    color: '#0F172A',
    fontSize: 14,
  },
  stockToggleHint: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  stockToggleTrack: {
    borderRadius: 999,
    height: 28,
    justifyContent: 'center',
    paddingHorizontal: 3,
    width: 48,
  },
  stockToggleThumb: {
    backgroundColor: '#FFF',
    borderRadius: 999,
    height: 22,
    width: 22,
  },
  stockToggleThumbOn: {
    alignSelf: 'flex-end',
  },
  stockToggleThumbOff: {
    alignSelf: 'flex-start',
  },
  searchHintText: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
  },
  defaultWarehouseNotice: {
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  defaultWarehouseNoticeLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  defaultWarehouseNoticeValue: {
    color: '#0F172A',
    fontSize: 13,
    lineHeight: 19,
  },
  searchButton: {
    alignItems: 'center',
    borderRadius: 16,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 18,
  },
  searchButtonText: {
    color: '#FFF',
    fontSize: 15,
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
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inlineNoticeAccent: {
    alignSelf: 'stretch',
    borderRadius: 999,
    width: 3,
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
    fontSize: 17,
  },
  resultMeta: {
    color: '#64748B',
    fontSize: 12,
  },
  resultMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  resultSummaryRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 16,
    marginTop: 2,
  },
  resultSummaryItem: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  resultSummaryLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  resultSummaryValue: {
    color: '#0F172A',
    fontSize: 14,
  },
  actionColumn: {
    justifyContent: 'center',
    minWidth: 108,
  },
  actionControlCard: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    width: '100%',
  },
  actionControlTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    minHeight: 20,
  },
  totalAddedHintRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 4,
  },
  totalAddedHintLabel: {
    color: '#64748B',
    fontSize: 13,
  },
  totalAddedHintValue: {
    fontSize: 20,
    lineHeight: 22,
  },
  actionControlHeader: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  actionSummaryLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  actionSummaryValue: {
    fontSize: 22,
    lineHeight: 24,
  },
  actionStepper: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  actionValueWrap: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minWidth: 20,
  },
  actionValueText: {
    color: '#0F172A',
    fontSize: 17,
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
