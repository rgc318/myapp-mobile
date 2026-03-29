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
import { searchLinkOptions } from '@/services/master-data';
import {
  createProductAndStock,
  fetchProducts,
  searchCatalogProducts,
  type ProductSearchItem,
} from '@/services/products';

function getProductResultKey(item: ProductSearchItem) {
  return [item.itemCode, item.warehouse ?? ''].join('::');
}

function getDraftItem(item: ProductSearchItem, draftItems: SalesOrderDraftItem[]) {
  const key = getProductResultKey(item);
  return draftItems.find((draftItem) => draftItem.draftKey === key) ?? null;
}

function getDraftSummaryForItem(itemCode: string, draftItems: SalesOrderDraftItem[]) {
  const rows = draftItems.filter((draftItem) => draftItem.itemCode === itemCode);
  const totalQty = rows.reduce((sum, row) => sum + row.qty, 0);
  const byWarehouse = rows.map((row) => ({
    warehouse: row.warehouse || '未指定仓库',
    qty: row.qty,
    uom: row.uom || '',
  }));

  return {
    totalQty,
    byWarehouse,
  };
}

function getDraftQtyForWarehouse(itemCode: string, warehouse: string | null | undefined, draftItems: SalesOrderDraftItem[]) {
  return draftItems
    .filter((draftItem) => draftItem.itemCode === itemCode && (draftItem.warehouse || '') === (warehouse || ''))
    .reduce((sum, draftItem) => sum + draftItem.qty, 0);
}

function groupDraftItemsByProduct(draftItems: SalesOrderDraftItem[]) {
  const grouped = new Map<
    string,
    {
      itemCode: string;
      itemName: string;
      imageUrl?: string | null;
      totalQty: number;
      totalAmount: number;
      rows: SalesOrderDraftItem[];
    }
  >();

  draftItems.forEach((item) => {
    const existing = grouped.get(item.itemCode);
    if (existing) {
      existing.rows.push(item);
      existing.totalQty += item.qty;
      existing.totalAmount += (item.price ?? 0) * item.qty;
      return;
    }

    grouped.set(item.itemCode, {
      itemCode: item.itemCode,
      itemName: item.itemName || item.itemCode,
      imageUrl: item.imageUrl ?? null,
      totalQty: item.qty,
      totalAmount: (item.price ?? 0) * item.qty,
      rows: [item],
    });
  });

  return Array.from(grouped.values());
}

function buildWarehouseSummaryText(draftItems: SalesOrderDraftItem[]) {
  if (!draftItems.length) {
    return '点击查看已加入商品';
  }

  const grouped = draftItems.reduce<Record<string, number>>((acc, item) => {
    const warehouse = item.warehouse || '未指定仓库';
    acc[warehouse] = (acc[warehouse] ?? 0) + item.qty;
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([warehouse, qty]) => `${warehouse} ${qty}`)
    .join(' / ');
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

function formatWarehouseStockLabel(item: ProductSearchItem, warehouse: string | null) {
  const selectedRow = item.warehouseStockDetails?.find((row) => row.warehouse === warehouse);
  const qty = selectedRow?.qty ?? item.stockQty ?? 0;
  const uom = item.stockUom || item.uom || '';
  return `${qty} ${uom ? formatDisplayUom(uom) : ''}`.trim();
}

function ResultRow({
  item,
  selectedQty,
  totalSelectedQty,
  selectedWarehouse,
  onSelectWarehouse,
  onAdd,
  onDecrease,
  onOpenDetail,
  isOrderMode,
}: {
  item: ProductSearchItem;
  selectedQty: number;
  totalSelectedQty: number;
  selectedWarehouse: string | null;
  onSelectWarehouse: (item: ProductSearchItem, warehouse: string) => void;
  onAdd: (item: ProductSearchItem) => void;
  onDecrease: (item: ProductSearchItem) => void;
  onOpenDetail: (item: ProductSearchItem) => void;
  isOrderMode: boolean;
}) {
  const surface = useThemeColor({}, 'surface');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const selectedWarehouseName = selectedWarehouse || item.warehouse || '未指定仓库';
  const selectedWarehouseStockText = formatWarehouseStockLabel(item, selectedWarehouse || item.warehouse);
  const showTotalSelectedHint = totalSelectedQty > 0;

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
        <View style={styles.resultHeaderRow}>
          <View style={styles.resultIdentity}>
            <View style={styles.resultTitleRow}>
              <ThemedText numberOfLines={1} style={styles.resultTitle} type="defaultSemiBold">
                {item.itemName || item.itemCode}
              </ThemedText>
            </View>

            <ThemedText numberOfLines={1} style={styles.resultWarehouseHeadline} type="defaultSemiBold">
              当前仓库 {selectedWarehouseName}
            </ThemedText>

            <View style={styles.resultMetaRow}>
              <ThemedText numberOfLines={1} style={styles.resultMeta}>
                编码 {item.itemCode}
              </ThemedText>
            </View>
          </View>

          {isOrderMode ? (
            <View style={styles.inlineActionColumn}>
              {showTotalSelectedHint ? (
                <View style={[styles.selectionPill, { backgroundColor: surfaceMuted }]}>
                  <ThemedText style={styles.selectionPillLabel}>已加</ThemedText>
                  <ThemedText style={[styles.selectionPillValue, { color: tintColor }]} type="defaultSemiBold">
                    {totalSelectedQty}
                  </ThemedText>
                </View>
              ) : null}

              {selectedQty > 0 ? (
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
                    {'加入当前仓'}
                  </ThemedText>
                </Pressable>
              )}
            </View>
          ) : null}
        </View>

        <View style={styles.compactMetricsRow}>
          {typeof item.totalQty === 'number' ? (
            <ThemedText style={styles.compactMetric} numberOfLines={1}>
              总库存 <ThemedText style={styles.compactMetricValue}>{item.totalQty}</ThemedText>
            </ThemedText>
          ) : null}
          <ThemedText style={styles.compactMetric} numberOfLines={1}>
            当前仓 <ThemedText style={styles.compactMetricValue}>{selectedWarehouseStockText}</ThemedText>
          </ThemedText>
        </View>

        <View style={styles.modePriceInlineRow}>
          <ThemedText style={styles.modePriceInlineText} numberOfLines={1}>
            批发价{' '}
            <ThemedText style={styles.modePriceInlineValue}>
              {typeof item.priceSummary?.wholesaleRate === 'number' ? `¥ ${item.priceSummary.wholesaleRate}` : '¥ 0'}
            </ThemedText>
            {item.wholesaleDefaultUom ? ` / ${formatDisplayUom(item.wholesaleDefaultUom)}` : ' / 未设置单位'}
          </ThemedText>
          <ThemedText style={styles.modePriceInlineText} numberOfLines={1}>
            零售价{' '}
            <ThemedText style={styles.modePriceInlineValue}>
              {typeof item.priceSummary?.retailRate === 'number' ? `¥ ${item.priceSummary.retailRate}` : '¥ 0'}
            </ThemedText>
            {item.retailDefaultUom ? ` / ${formatDisplayUom(item.retailDefaultUom)}` : ' / 未设置单位'}
          </ThemedText>
        </View>

        {isOrderMode ? (
          <ThemedText style={styles.actionCurrentValue} numberOfLines={1} type="defaultSemiBold">
            当前仓已加 {selectedQty}
          </ThemedText>
        ) : null}

        {!isOrderMode ? (
          <View style={styles.resultFooterRow}>
            <View style={styles.resultFooterCopy} />
            <ThemedText style={styles.detailHint}>{'查看详情'}</ThemedText>
          </View>
        ) : null}

        {item.warehouseStockDetails?.length ? (
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              onSelectWarehouse(item, selectedWarehouse || item.warehouse || '');
            }}
            style={[styles.warehouseSelectorButton, { backgroundColor: surfaceMuted, borderColor }]}>
            <View style={styles.warehouseSelectorCopy}>
              <ThemedText numberOfLines={1} style={styles.warehouseSelectorValue} type="defaultSemiBold">
                分仓选择 {selectedWarehouseName}
              </ThemedText>
              <ThemedText numberOfLines={1} style={styles.warehouseSelectorStock}>
                该仓库存：{selectedWarehouseStockText}
              </ThemedText>
            </View>
            <View style={styles.warehouseSelectorAside}>
              <ThemedText style={styles.warehouseSelectorAction} type="defaultSemiBold">
                切换
              </ThemedText>
            </View>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

function DraftWarehouseRow({
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
    <View style={styles.draftWarehouseRow}>
      <View style={styles.draftItemMain}>
        <View style={styles.draftWarehouseTitleRow}>
          <ThemedText numberOfLines={1} style={styles.draftWarehouseName} type="defaultSemiBold">
            {item.warehouse || '未指定仓库'}
          </ThemedText>
          <ThemedText style={styles.draftItemPrice} type="defaultSemiBold">
            {item.price == null ? '--' : `¥ ${item.price}`}
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

function DraftProductGroup({
  group,
  onAdd,
  onDecrease,
}: {
  group: ReturnType<typeof groupDraftItemsByProduct>[number];
  onAdd: (item: SalesOrderDraftItem) => void;
  onDecrease: (item: SalesOrderDraftItem) => void;
}) {
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');

  return (
    <View style={[styles.draftGroupCard, { borderColor }]}>
      <View style={styles.draftGroupHeader}>
        <View style={[styles.draftThumbWrap, { backgroundColor: surfaceMuted }]}>
          {group.imageUrl ? (
            <Image contentFit="cover" source={group.imageUrl} style={styles.draftThumbImage} />
          ) : (
            <IconSymbol color={tintColor} name="shippingbox.fill" size={18} />
          )}
        </View>

        <View style={styles.draftGroupMain}>
          <View style={styles.draftItemTitleRow}>
            <ThemedText numberOfLines={1} style={styles.draftItemTitle} type="defaultSemiBold">
              {group.itemName}
            </ThemedText>
            <ThemedText style={styles.draftItemPrice} type="defaultSemiBold">
              ¥ {group.totalAmount.toFixed(2)}
            </ThemedText>
          </View>
          <View style={styles.draftItemMetaRow}>
            <ThemedText numberOfLines={1} style={styles.draftItemMeta}>
              编码 {group.itemCode}
            </ThemedText>
            <ThemedText numberOfLines={1} style={styles.draftItemMeta}>
              共 {group.rows.length} 个仓库条目
            </ThemedText>
          </View>
          <ThemedText style={styles.draftGroupSummary} type="defaultSemiBold">
            总加入数 {group.totalQty}
          </ThemedText>
        </View>
      </View>

      <View style={styles.draftGroupRows}>
        {group.rows.map((item) => (
          <DraftWarehouseRow key={item.draftKey} item={item} onAdd={onAdd} onDecrease={onDecrease} />
        ))}
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
  const [warehouseFilter, setWarehouseFilter] = useState(preferences.defaultWarehouse || '');
  const [inStockOnly, setInStockOnly] = useState(true);
  const [results, setResults] = useState<ProductSearchItem[]>([]);
  const [selectedWarehouseMap, setSelectedWarehouseMap] = useState<Record<string, string>>({});
  const [warehousePickerItem, setWarehousePickerItem] = useState<ProductSearchItem | null>(null);
  const [message, setMessage] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('0');
  const [newItemOpeningUom, setNewItemOpeningUom] = useState('Nos');
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
  const warehouseDraftSummaryText = useMemo(
    () => buildWarehouseSummaryText(draftItems),
    [draftItems],
  );
  const groupedDraftItems = useMemo(
    () => groupDraftItemsByProduct(draftItems),
    [draftItems],
  );
  const loadWarehouseOptions = async (text: string) => {
    const options = await searchLinkOptions('Warehouse', text, ['warehouse_name']);
    return [
      {
        label: '全部仓库',
        value: '',
        description: '不限制仓库，搜索所有仓库的商品库存',
      },
      ...options,
    ];
  };

  const handleSearch = async (rawQuery?: string) => {
    const nextQuery = (rawQuery ?? query).trim();

    if (!nextQuery && !isOrderMode) {
      setMessage('\u8bf7\u8f93\u5165\u5546\u54c1\u7f16\u7801\u3001\u6761\u7801\u6216\u5173\u952e\u8bcd\u3002');
      setResults([]);
      return;
    }

    try {
      setIsLoading(true);
      setQuery(nextQuery);
      const items = nextQuery
        ? await searchCatalogProducts(nextQuery, {
            company: preferences.defaultCompany || undefined,
            warehouse: warehouseFilter.trim() || undefined,
            inStockOnly,
            limit: 20,
          })
        : (
            await fetchProducts({
              company: preferences.defaultCompany || undefined,
              warehouse: warehouseFilter.trim() || undefined,
              limit: 100,
            })
          ).filter((item) => {
            if (!inStockOnly) {
              return true;
            }
            const qty =
              warehouseFilter.trim()
                ? (item.warehouseStockQty ?? item.stockQty ?? 0)
                : (item.totalQty ?? item.stockQty ?? 0);
            return qty > 0;
          });
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
      setResults(items);
      setMessage(
        items.length
          ? `${nextQuery ? `\u5171\u627e\u5230 ${items.length} \u4e2a\u5546\u54c1。` : `\u5df2\u8f7d\u5165 ${items.length} \u4e2a\u5546\u54c1。`}${warehouseFilter.trim() ? ` 当前按仓库 ${warehouseFilter.trim()} 搜索。` : ''}${inStockOnly ? ' 仅显示有库存结果。' : ''}${!nextQuery ? ' 可继续输入关键词缩小范围。' : ''}`
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
    const selectedWarehouse = selectedWarehouseMap[item.itemCode] ?? item.warehouse ?? null;
    const selectedWarehouseQty =
      item.warehouseStockDetails?.find((row) => row.warehouse === selectedWarehouse)?.qty ?? item.stockQty;
    const nextItem = {
      ...item,
      warehouse: selectedWarehouse,
      warehouseStockQty: selectedWarehouseQty,
      warehouseStockUom: item.stockUom ?? item.uom ?? null,
    };
    addItemToSalesOrderDraft(nextItem, draftScope, { defaultSalesMode });
    const nextDraft = getSalesOrderDraft(draftScope);
    const nextQty = getDraftItem(nextItem, nextDraft)?.qty ?? 0;
    setDraftItems([...nextDraft]);
    setMessage(`\u5df2\u5c06 ${item.itemName || item.itemCode} 加入订单，仓库 ${selectedWarehouse || '未指定'}，当前已选 ${nextQty}。`);
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
        openingUom: newItemOpeningUom.trim() || undefined,
        standardRate: newItemPrice.trim() ? Number(newItemPrice) || 0 : undefined,
        description: toOptionalText(newItemDescription),
      });

      setResults([createdItem]);
      setMessage(`已创建商品 ${createdItem.itemName || createdItem.itemCode}。`);
      setNewItemName('');
      setNewItemQty('0');
      setNewItemOpeningUom('Nos');
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
    const selectedWarehouse = selectedWarehouseMap[item.itemCode] ?? item.warehouse ?? null;
    const draftItem = getDraftItem(
      {
        ...item,
        warehouse: selectedWarehouse,
      },
      getSalesOrderDraft(draftScope),
    );
    if (!draftItem) {
      return;
    }

    if (draftItem.qty <= 1) {
      removeSalesOrderDraftItem(draftItem.draftKey, draftScope);
      syncDraftState();
      setMessage(`\u5df2\u5c06 ${item.itemName || item.itemCode} 从订单中移除。`);
      return;
    }

    updateSalesOrderDraftQty(draftItem.draftKey, draftItem.qty - 1, draftScope);
    const nextDraft = getSalesOrderDraft(draftScope);
    const nextQty = getDraftItem({ ...item, warehouse: selectedWarehouse }, nextDraft)?.qty ?? 0;
    setDraftItems([...nextDraft]);
    setMessage(`\u5df2调整 ${item.itemName || item.itemCode} 数量，当前为 ${nextQty}。`);
  };

  const handleSelectWarehouse = (item: ProductSearchItem, warehouse: string) => {
    if (!warehouse || warehouse === (selectedWarehouseMap[item.itemCode] ?? item.warehouse)) {
      setWarehousePickerItem(item);
      return;
    }

    setSelectedWarehouseMap((current) => ({
      ...current,
      [item.itemCode]: warehouse,
    }));
  };

  const handleDraftIncrease = (item: SalesOrderDraftItem) => {
    addItemToSalesOrderDraft(
      {
        itemCode: item.itemCode,
        itemName: item.itemName,
        imageUrl: item.imageUrl ?? null,
        price: item.price,
        stockQty: null,
        warehouseStockQty: item.warehouseStockQty ?? null,
        warehouseStockUom: item.warehouseStockUom ?? item.stockUom ?? item.uom ?? null,
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
    setQuery(initialQuery);

    if (!initialQuery && !isOrderMode) {
      return;
    }

    void handleSearch(initialQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftScope, isOrderMode, params.query]);

  const handleReturnToOrder = () => {
    if (returnOrderName) {
      router.replace({
        pathname: '/sales/order/[orderName]',
        params: { orderName: returnOrderName },
      });
      return;
    }

    if (isOrderMode) {
      router.replace('/sales/order/create');
      return;
    }

    router.push('/sales/order/create');
  };

  return (
    <AppShell
      compactHeader
      contentCard={false}
      description={isOrderMode ? '\u641c\u7d22\u5546\u54c1\u5e76\u52a0\u5165\u5f53\u524d\u8ba2\u5355\u3002' : '\u7528\u4e8e\u67e5\u8be2\u5546\u54c1\u5e93\u5b58\u3001\u4ef7\u683c\u548c\u57fa\u7840\u4fe1\u606f\u3002'}
      showWorkflowQuickNav={false}
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
                  已选 {draftCount} 项，录入数量 {totalSelectedQty}
                </ThemedText>
                <ThemedText style={styles.footerHint}>
                  {warehouseDraftSummaryText}
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

        <View style={styles.searchFilterRow}>
          <View style={styles.searchFilterField}>
            <LinkOptionInput
              label="仓库过滤"
              loadOptions={loadWarehouseOptions}
              onChangeText={setWarehouseFilter}
              onOptionSelect={setWarehouseFilter}
              placeholder="请输入或搜索仓库"
              value={warehouseFilter}
            />
          </View>

          <View style={styles.filterActionsColumn}>
            <Pressable
              onPress={() => setWarehouseFilter('')}
              style={[
                styles.toggleChip,
                {
                  backgroundColor: warehouseFilter.trim() ? surfaceMuted : tintColor,
                  borderColor: warehouseFilter.trim() ? borderColor : tintColor,
                },
              ]}>
              <ThemedText
                style={[styles.toggleChipText, warehouseFilter.trim() ? null : styles.toggleChipTextActive]}
                type="defaultSemiBold">
                全部仓库
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => setInStockOnly((current) => !current)}
              style={[
                styles.toggleChip,
                {
                  backgroundColor: inStockOnly ? tintColor : surfaceMuted,
                  borderColor: inStockOnly ? tintColor : borderColor,
                },
              ]}>
              <ThemedText
                style={[styles.toggleChipText, inStockOnly ? styles.toggleChipTextActive : null]}
                type="defaultSemiBold">
                {inStockOnly ? '仅看有库存' : '包含无库存'}
              </ThemedText>
            </Pressable>
          </View>
        </View>

        <ThemedText style={styles.searchHintText}>支持编码、名称、条码与描述搜索。</ThemedText>

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
          (() => {
            const selectedWarehouse = selectedWarehouseMap[item.itemCode] ?? item.warehouse;
            const currentWarehouseQty =
              getDraftItem(
                {
                  ...item,
                  warehouse: selectedWarehouse,
                },
                draftItems,
              )?.qty ?? 0;
            const draftSummary = getDraftSummaryForItem(item.itemCode, draftItems);

            return (
              <ResultRow
                isOrderMode={isOrderMode}
                item={item}
                key={getProductResultKey({
                  ...item,
                  warehouse: selectedWarehouse,
                })}
                onAdd={handleAdd}
                onDecrease={handleDecrease}
                onOpenDetail={handleOpenDetail}
                onSelectWarehouse={handleSelectWarehouse}
                selectedQty={currentWarehouseQty}
                selectedWarehouse={selectedWarehouse}
                totalSelectedQty={draftSummary.totalQty}
              />
            );
          })()
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
                onChangeText={setNewItemOpeningUom}
                placeholder={'入库单位，例如 Box / Nos'}
                placeholderTextColor="rgba(31,42,55,0.45)"
                style={[styles.quickCreateInput, { backgroundColor: surfaceMuted, borderColor }]}
                value={newItemOpeningUom}
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
                  已选 {draftCount} 项，录入数量 {totalSelectedQty}
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
                  {groupedDraftItems.map((group) => (
                    <DraftProductGroup
                      group={group}
                      key={group.itemCode}
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

      <Modal
        animationType="slide"
        onRequestClose={() => setWarehousePickerItem(null)}
        transparent
        visible={Boolean(warehousePickerItem)}>
        <View style={styles.sheetBackdrop}>
          <Pressable onPress={() => setWarehousePickerItem(null)} style={styles.sheetDismissArea} />
          <View style={[styles.sheetCard, { backgroundColor: surface, borderColor }]}>
            <View style={styles.sheetHeader}>
              <View>
                <ThemedText style={styles.sheetTitle} type="defaultSemiBold">
                  选择加入仓库
                </ThemedText>
                <ThemedText style={styles.sheetHint}>
                  {warehousePickerItem?.itemName || warehousePickerItem?.itemCode}
                </ThemedText>
              </View>
              <Pressable onPress={() => setWarehousePickerItem(null)} style={styles.sheetCloseButton}>
                <ThemedText style={styles.sheetCloseText} type="defaultSemiBold">
                  收起
                </ThemedText>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.sheetList} style={styles.sheetScroll}>
              {(warehousePickerItem?.warehouseStockDetails?.length
                ? warehousePickerItem.warehouseStockDetails
                : [
                    {
                      warehouse: warehousePickerItem?.warehouse || '未指定仓库',
                      company: null,
                      qty: warehousePickerItem?.stockQty ?? 0,
                    },
                  ]
              ).map((stockRow) => {
                const active =
                  stockRow.warehouse ===
                  (selectedWarehouseMap[warehousePickerItem?.itemCode ?? ''] ?? warehousePickerItem?.warehouse);
                const warehouseAddedQty = warehousePickerItem
                  ? getDraftQtyForWarehouse(warehousePickerItem.itemCode, stockRow.warehouse, draftItems)
                  : 0;

                return (
                  <Pressable
                    key={`${warehousePickerItem?.itemCode}-${stockRow.warehouse}`}
                    onPress={() => {
                      if (warehousePickerItem) {
                        setSelectedWarehouseMap((current) => ({
                          ...current,
                          [warehousePickerItem.itemCode]: stockRow.warehouse,
                        }));
                      }
                      setWarehousePickerItem(null);
                    }}
                    style={[
                      styles.modalWarehouseOption,
                      {
                        backgroundColor: active ? 'rgba(59,130,246,0.08)' : surfaceMuted,
                        borderColor,
                      },
                    ]}>
                    <View style={styles.modalWarehouseCopy}>
                      <ThemedText numberOfLines={1} type="defaultSemiBold">
                        {stockRow.warehouse}
                      </ThemedText>
                      <ThemedText style={styles.modalWarehouseMeta}>
                        库存 {stockRow.qty}{' '}
                        {warehousePickerItem?.stockUom || warehousePickerItem?.uom
                          ? formatDisplayUom(warehousePickerItem?.stockUom || warehousePickerItem?.uom || '')
                          : ''}
                      </ThemedText>
                      <ThemedText style={styles.modalWarehouseMeta}>
                        {warehouseAddedQty > 0 ? `当前仓库已加入数 ${warehouseAddedQty}` : '当前仓库未加入'}
                      </ThemedText>
                      {stockRow.company ? (
                        <ThemedText style={styles.modalWarehouseMeta}>{stockRow.company}</ThemedText>
                      ) : null}
                    </View>
                    <ThemedText style={{ color: tintColor }} type="defaultSemiBold">
                      {active ? '当前' : '选择'}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>
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
    gap: 10,
    overflow: 'visible',
    padding: 14,
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
  searchFilterRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    zIndex: 60,
  },
  inlineFilterInputWrap: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  inlineFilterLabel: {
    color: '#475569',
    fontSize: 13,
  },
  inlineFilterInput: {
    flex: 1,
    fontSize: 14,
    minHeight: 34,
    paddingVertical: 0,
  },
  searchFilterField: {
    flex: 1,
    zIndex: 80,
  },
  filterActionsColumn: {
    gap: 8,
  },
  toggleChip: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 40,
    minWidth: 104,
    paddingHorizontal: 10,
  },
  toggleChipText: {
    color: '#334155',
    fontSize: 13,
  },
  toggleChipTextActive: {
    color: '#FFF',
  },
  searchHintText: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 16,
  },
  searchButton: {
    alignItems: 'center',
    borderRadius: 16,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 16,
    paddingVertical: 8,
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
    zIndex: 1,
  },
  resultRow: {
    alignItems: 'flex-start',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
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
    gap: 5,
    minWidth: 0,
  },
  resultHeaderRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  resultIdentity: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  resultTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  resultTitle: {
    flex: 1,
    fontSize: 18,
  },
  resultWarehouseHeadline: {
    color: '#0F172A',
    fontSize: 15,
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
    fontSize: 11,
  },
  resultMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  compactMetricsRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  compactMetric: {
    color: '#64748B',
    fontSize: 12,
  },
  compactMetricValue: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '700',
  },
  modePriceInlineRow: {
    columnGap: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 4,
  },
  modePriceInlineText: {
    color: '#475569',
    fontSize: 12,
    lineHeight: 16,
  },
  modePriceInlineValue: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '700',
  },
  resultFooterRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    marginTop: 2,
  },
  resultFooterCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  warehouseSelectorButton: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  warehouseSelectorCopy: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  warehouseSelectorValue: {
    color: '#0F172A',
    fontSize: 12,
  },
  warehouseSelectorStock: {
    color: '#475569',
    fontSize: 11,
    lineHeight: 14,
  },
  warehouseSelectorAside: {
    alignItems: 'flex-end',
    gap: 8,
    marginLeft: 12,
    minWidth: 52,
  },
  warehouseSelectorAction: {
    color: '#2563EB',
  },
  detailHint: {
    color: '#2563EB',
    fontSize: 12,
  },
  addButton: {
    alignItems: 'center',
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 40,
    minWidth: 104,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addButtonText: {
    color: '#FFF',
    fontSize: 13,
  },
  inlineActionColumn: {
    alignItems: 'flex-end',
    gap: 8,
    minWidth: 108,
  },
  selectionPill: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    minHeight: 28,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  selectionPillLabel: {
    color: '#64748B',
    fontSize: 11,
  },
  selectionPillValue: {
    fontSize: 13,
  },
  actionCurrentValue: {
    color: '#64748B',
    fontSize: 11,
    marginTop: -1,
  },
  stepper: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 40,
    overflow: 'hidden',
  },
  stepperButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    width: 34,
  },
  stepperActionText: {
    fontSize: 18,
    lineHeight: 18,
  },
  stepperValueWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 30,
    paddingHorizontal: 8,
  },
  stepperValue: {
    fontSize: 15,
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
  draftGroupCard: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 12,
  },
  draftGroupHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  draftGroupMain: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  draftGroupSummary: {
    color: '#2563EB',
    fontSize: 13,
  },
  draftGroupRows: {
    gap: 10,
  },
  draftWarehouseRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(248,250,252,0.92)',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  draftWarehouseTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  draftWarehouseName: {
    color: '#0F172A',
    flex: 1,
    fontSize: 14,
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
  modalWarehouseOption: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  modalWarehouseCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  modalWarehouseMeta: {
    color: '#64748B',
    fontSize: 12,
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
