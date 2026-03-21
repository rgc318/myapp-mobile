import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { formatDisplayUom } from '@/lib/display-uom';
import { useFeedback } from '@/providers/feedback-provider';
import { checkLinkOptionExists, searchLinkOptions } from '@/services/master-data';
import { fetchProductDetail, saveProductBasicInfo, setProductDisabled, type ProductDetail } from '@/services/products';

function formatMoney(value: number | null | undefined) {
  return typeof value === 'number' ? `¥ ${value.toFixed(2)}` : '未配置';
}

function toNumberOrNull(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function isSelectableWarehouse(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (normalized.includes('all warehouses')) {
    return false;
  }

  if (value.includes('所有仓库')) {
    return false;
  }

  return true;
}

function formatConversionHint(uom: string, conversionFactor: number | null | undefined, stockUom: string | null | undefined) {
  if (!uom) {
    return '';
  }

  if (!stockUom || uom === stockUom) {
    return `库存按 ${formatDisplayUom(uom)} 记账`;
  }

  if (typeof conversionFactor === 'number' && Number.isFinite(conversionFactor) && conversionFactor > 0) {
    return `1 ${formatDisplayUom(uom)} = ${conversionFactor} ${formatDisplayUom(stockUom)}`;
  }

  return `待补换算：${formatDisplayUom(uom)} -> ${formatDisplayUom(stockUom)}`;
}

function DetailField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');

  return (
    <View style={styles.fieldBlock}>
      <ThemedText style={styles.fieldLabel} type="defaultSemiBold">
        {label}
      </ThemedText>
      <TextInput
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(31,42,55,0.38)"
        style={[multiline ? styles.textarea : styles.textInput, { backgroundColor: surfaceMuted, borderColor }]}
        textAlignVertical={multiline ? 'top' : 'center'}
        value={value}
      />
    </View>
  );
}

export default function ProductDetailScreen() {
  const router = useRouter();
  const { showError, showSuccess } = useFeedback();
  const { itemCode } = useLocalSearchParams<{ itemCode?: string }>();
  const productCode = typeof itemCode === 'string' ? itemCode : '';

  const surface = useThemeColor({}, 'surface');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');
  const success = useThemeColor({}, 'success');
  const danger = useThemeColor({}, 'danger');

  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [warehouseError, setWarehouseError] = useState('');
  const [availableWarehouses, setAvailableWarehouses] = useState<string[]>([]);
  const [warehousePickerVisible, setWarehousePickerVisible] = useState(false);
  const [warehouseSearchQuery, setWarehouseSearchQuery] = useState('');
  const [availableUoms, setAvailableUoms] = useState<string[]>([]);
  const [uomPickerVisible, setUomPickerVisible] = useState(false);
  const [uomSearchQuery, setUomSearchQuery] = useState('');
  const [uomPickerTarget, setUomPickerTarget] = useState<'wholesale' | 'retail' | null>(null);
  const [masterPickerVisible, setMasterPickerVisible] = useState(false);
  const [masterPickerTarget, setMasterPickerTarget] = useState<'itemGroup' | 'brand' | null>(null);
  const [masterPickerQuery, setMasterPickerQuery] = useState('');
  const [masterPickerOptions, setMasterPickerOptions] = useState<string[]>([]);
  const [itemGroupError, setItemGroupError] = useState('');
  const [brandError, setBrandError] = useState('');

  const [draftName, setDraftName] = useState('');
  const [draftItemGroup, setDraftItemGroup] = useState('');
  const [draftBrand, setDraftBrand] = useState('');
  const [draftBarcode, setDraftBarcode] = useState('');
  const [draftNickname, setDraftNickname] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftImageUrl, setDraftImageUrl] = useState('');
  const [draftStandardRate, setDraftStandardRate] = useState('');
  const [draftWholesaleRate, setDraftWholesaleRate] = useState('');
  const [draftRetailRate, setDraftRetailRate] = useState('');
  const [draftBuyingRate, setDraftBuyingRate] = useState('');
  const [draftWholesaleDefaultUom, setDraftWholesaleDefaultUom] = useState('');
  const [draftRetailDefaultUom, setDraftRetailDefaultUom] = useState('');
  const [draftWarehouseStockQty, setDraftWarehouseStockQty] = useState('');

  const hydrateDraft = (next: ProductDetail) => {
    setDraftName(next.itemName || next.itemCode);
    setDraftItemGroup(next.itemGroup || '');
    setDraftBrand(next.brand || '');
    setDraftBarcode(next.barcode || '');
    setDraftNickname(next.nickname || '');
    setDraftDescription(next.description || '');
    setDraftImageUrl(next.imageUrl || '');
    setDraftStandardRate(next.priceSummary?.standardSellingRate != null ? String(next.priceSummary.standardSellingRate) : '');
    setDraftWholesaleRate(next.priceSummary?.wholesaleRate != null ? String(next.priceSummary.wholesaleRate) : '');
    setDraftRetailRate(next.priceSummary?.retailRate != null ? String(next.priceSummary.retailRate) : '');
    setDraftBuyingRate(next.priceSummary?.standardBuyingRate != null ? String(next.priceSummary.standardBuyingRate) : '');
    setDraftWholesaleDefaultUom(next.wholesaleDefaultUom || '');
    setDraftRetailDefaultUom(next.retailDefaultUom || '');
  };

  const warehouseOptions = useMemo(() => {
    const values = new Set<string>();

    nextWarehouse: for (const stockItem of detail?.warehouseStockDetails ?? []) {
      if (!stockItem.warehouse) {
        continue nextWarehouse;
      }
      values.add(stockItem.warehouse);
    }

    if (detail?.warehouse) {
      values.add(detail.warehouse);
    }

    for (const warehouse of availableWarehouses) {
      if (warehouse) {
        values.add(warehouse);
      }
    }

    return Array.from(values);
  }, [availableWarehouses, detail]);

  const selectedWarehouseQty = useMemo(() => {
    if (!detail) {
      return null;
    }

    const trimmedWarehouse = selectedWarehouse.trim();
    const warehouse = trimmedWarehouse || detail.warehouse;
    if (!warehouse) {
      return detail.stockQty;
    }

    const matched = detail.warehouseStockDetails.find((stockItem) => stockItem.warehouse === warehouse);
    if (matched) {
      return matched.qty;
    }

    if (trimmedWarehouse) {
      return null;
    }

    return detail.stockQty;
  }, [detail, selectedWarehouse]);

  const stockedWarehouses = useMemo(() => {
    if (!detail) {
      return [];
    }

    return [...detail.warehouseStockDetails].sort((left, right) => {
      if (right.qty !== left.qty) {
        return right.qty - left.qty;
      }
      return left.warehouse.localeCompare(right.warehouse);
    });
  }, [detail]);

  const selectedWarehouseHasStock = useMemo(() => {
    const trimmedWarehouse = selectedWarehouse.trim();
    if (!trimmedWarehouse || !detail) {
      return false;
    }
    return detail.warehouseStockDetails.some((item) => item.warehouse === trimmedWarehouse);
  }, [detail, selectedWarehouse]);

  const inventoryDelta = useMemo(() => {
    const targetQty = toNumberOrNull(draftWarehouseStockQty);
    if (targetQty == null) {
      return null;
    }
    return targetQty - (selectedWarehouseQty ?? 0);
  }, [draftWarehouseStockQty, selectedWarehouseQty]);

  const warehousePickerSections = useMemo(() => {
    const keyword = warehouseSearchQuery.trim().toLowerCase();
    const stocked = stockedWarehouses
      .map((item) => item.warehouse)
      .filter(isSelectableWarehouse);
    const stockedSet = new Set(stocked);

    const matches = (value: string) => {
      if (!keyword) {
        return true;
      }
      return value.toLowerCase().includes(keyword);
    };

    const stockedMatches = stocked.filter(matches);
    const otherMatches = warehouseOptions.filter((warehouse) => {
      if (!isSelectableWarehouse(warehouse) || stockedSet.has(warehouse)) {
        return false;
      }
      return matches(warehouse);
    });

    return {
      stocked: stockedMatches,
      others: otherMatches,
    };
  }, [stockedWarehouses, warehouseOptions, warehouseSearchQuery]);

  const uomOptions = useMemo(() => {
    const values = new Set<string>();

    for (const uom of detail?.allUoms ?? []) {
      if (uom) {
        values.add(uom);
      }
    }

    for (const uom of availableUoms) {
      if (uom) {
        values.add(uom);
      }
    }

    if (detail?.stockUom) {
      values.add(detail.stockUom);
    }

    if (draftWholesaleDefaultUom.trim()) {
      values.add(draftWholesaleDefaultUom.trim());
    }

    if (draftRetailDefaultUom.trim()) {
      values.add(draftRetailDefaultUom.trim());
    }

    return Array.from(values);
  }, [availableUoms, detail?.allUoms, detail?.stockUom, draftRetailDefaultUom, draftWholesaleDefaultUom]);

  const filteredUomOptions = useMemo(() => {
    const keyword = uomSearchQuery.trim().toLowerCase();
    if (!keyword) {
      return uomOptions;
    }
    return uomOptions.filter((uom) => uom.toLowerCase().includes(keyword));
  }, [uomOptions, uomSearchQuery]);

  const uomConversionRows = useMemo(() => {
    if (!detail) {
      return [];
    }

    const rows = detail.uomConversions.length
      ? detail.uomConversions
      : detail.allUoms.map((uom) => ({ uom, conversionFactor: null }));

    return rows
      .filter((row) => row.uom)
      .sort((left, right) => {
        if (left.uom === detail.stockUom) {
          return -1;
        }
        if (right.uom === detail.stockUom) {
          return 1;
        }
        return left.uom.localeCompare(right.uom);
      });
  }, [detail]);

  const loadDetail = useCallback(async () => {
    if (!productCode) {
      return;
    }

    try {
      setIsLoading(true);
      const next = await fetchProductDetail(productCode);
      if (!next) {
        throw new Error('未找到商品详情');
      }
      setDetail(next);
      hydrateDraft(next);
    } catch (error) {
      showError(error instanceof Error ? error.message : '加载商品详情失败');
    } finally {
      setIsLoading(false);
    }
  }, [productCode, showError]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (!isEditing) {
      return;
    }

    let cancelled = false;

    async function loadWarehouses() {
      try {
        const options = await searchLinkOptions('Warehouse', '', ['warehouse_name']);
        if (cancelled) {
          return;
        }
        setAvailableWarehouses(
          options
            .map((option) => option.value.trim())
            .filter(isSelectableWarehouse)
            .filter(Boolean),
        );
      } catch {
        if (!cancelled) {
          setAvailableWarehouses([]);
        }
      }
    }

    async function loadUoms() {
      try {
        const options = await searchLinkOptions('UOM', '');
        if (cancelled) {
          return;
        }
        setAvailableUoms(
          options
            .map((option) => option.value.trim())
            .filter(Boolean),
        );
      } catch {
        if (!cancelled) {
          setAvailableUoms([]);
        }
      }
    }

    if (masterPickerVisible && masterPickerTarget) {
      async function loadMasterOptions() {
        try {
          const doctype = masterPickerTarget === 'itemGroup' ? 'Item Group' : 'Brand';
          const options = await searchLinkOptions(doctype, masterPickerQuery);
          if (cancelled) {
            return;
          }
          setMasterPickerOptions(
            options
              .map((option) => option.value.trim())
              .filter(Boolean),
          );
        } catch {
          if (!cancelled) {
            setMasterPickerOptions([]);
          }
        }
      }

      void loadMasterOptions();
    }

    void loadWarehouses();
    void loadUoms();

    return () => {
      cancelled = true;
    };
  }, [isEditing, masterPickerQuery, masterPickerTarget, masterPickerVisible]);

  useEffect(() => {
    if (!detail) {
      return;
    }

    const nextWarehouse =
      warehouseOptions.find((warehouse) => warehouse === selectedWarehouse) ||
      detail.warehouse ||
      warehouseOptions[0] ||
      '';

    if (nextWarehouse !== selectedWarehouse) {
      setSelectedWarehouse(nextWarehouse);
      return;
    }

    setDraftWarehouseStockQty(selectedWarehouseQty != null ? String(selectedWarehouseQty) : '');
  }, [detail, selectedWarehouse, selectedWarehouseQty, warehouseOptions]);

  const handleSave = async () => {
    if (!detail) {
      return;
    }

    const trimmedWarehouse = selectedWarehouse.trim();
    if (!trimmedWarehouse) {
      setWarehouseError('请先选择一个要调整库存的仓库。');
      return;
    }

    try {
      setIsSaving(true);
      setWarehouseError('');
      setItemGroupError('');
      setBrandError('');

      const warehouseExists = await checkLinkOptionExists('Warehouse', trimmedWarehouse);
      if (!warehouseExists) {
        setWarehouseError('仓库不存在，请从候选项中选择有效仓库。');
        return;
      }

      const trimmedItemGroup = draftItemGroup.trim();
      if (trimmedItemGroup) {
        const itemGroupExists = await checkLinkOptionExists('Item Group', trimmedItemGroup);
        if (!itemGroupExists) {
          setItemGroupError('分类不存在，请从候选项中选择有效分类。');
          return;
        }
      }

      const trimmedBrand = draftBrand.trim();
      if (trimmedBrand) {
        const brandExists = await checkLinkOptionExists('Brand', trimmedBrand);
        if (!brandExists) {
          setBrandError('品牌不存在，请从候选项中选择有效品牌。');
          return;
        }
      }

      const saved = await saveProductBasicInfo({
        itemCode: detail.itemCode,
        itemName: draftName.trim() || detail.itemName,
        itemGroup: trimmedItemGroup || undefined,
        brand: trimmedBrand || undefined,
        barcode: draftBarcode.trim() || undefined,
        nickname: draftNickname.trim() || undefined,
        description: draftDescription.trim() || undefined,
        imageUrl: draftImageUrl.trim() || undefined,
        standardRate: toNumberOrNull(draftStandardRate),
        wholesaleRate: toNumberOrNull(draftWholesaleRate),
        retailRate: toNumberOrNull(draftRetailRate),
        standardBuyingRate: toNumberOrNull(draftBuyingRate),
        wholesaleDefaultUom: draftWholesaleDefaultUom.trim() || undefined,
        retailDefaultUom: draftRetailDefaultUom.trim() || undefined,
        warehouse: trimmedWarehouse,
        warehouseStockQty: toNumberOrNull(draftWarehouseStockQty),
      });

      if (!saved) {
        throw new Error('商品更新失败');
      }

      setDetail(saved);
      hydrateDraft(saved);
      setIsEditing(false);
      showSuccess(`商品 ${saved.itemName} 已更新`);
    } catch (error) {
      showError(error instanceof Error ? error.message : '保存商品失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!detail) {
      return;
    }

    try {
      setIsToggling(true);
      const next = await setProductDisabled(detail.itemCode, !detail.disabled);
      if (!next) {
        throw new Error('商品状态更新失败');
      }
      setDetail(next);
      hydrateDraft(next);
      showSuccess(next.disabled ? '商品已停用' : '商品已重新启用');
    } catch (error) {
      showError(error instanceof Error ? error.message : '更新状态失败');
    } finally {
      setIsToggling(false);
    }
  };

  const handleSelectWarehouse = (warehouse: string) => {
    setSelectedWarehouse(warehouse);
    setWarehousePickerVisible(false);
    setWarehouseSearchQuery('');
    if (warehouseError) {
      setWarehouseError('');
    }
  };

  const handleOpenUomPicker = (target: 'wholesale' | 'retail') => {
    setUomPickerTarget(target);
    setUomSearchQuery('');
    setUomPickerVisible(true);
  };

  const handleOpenMasterPicker = (target: 'itemGroup' | 'brand') => {
    setMasterPickerTarget(target);
    setMasterPickerQuery('');
    setMasterPickerVisible(true);
  };

  const handleSelectUom = (uom: string) => {
    if (uomPickerTarget === 'wholesale') {
      setDraftWholesaleDefaultUom(uom);
    }

    if (uomPickerTarget === 'retail') {
      setDraftRetailDefaultUom(uom);
    }

    setUomPickerVisible(false);
    setUomPickerTarget(null);
    setUomSearchQuery('');
  };

  const handleSelectMasterOption = (value: string) => {
    if (masterPickerTarget === 'itemGroup') {
      setDraftItemGroup(value);
      setItemGroupError('');
    }

    if (masterPickerTarget === 'brand') {
      setDraftBrand(value);
      setBrandError('');
    }

    setMasterPickerVisible(false);
    setMasterPickerTarget(null);
    setMasterPickerQuery('');
  };

  return (
    <AppShell
      compactHeader
      contentCard={false}
      description="查看商品价格、库存分布，并维护基础信息。"
      footer={
        <View style={styles.footerBar}>
          <Pressable onPress={() => router.back()} style={styles.footerSecondary}>
            <ThemedText style={{ color: tintColor }} type="defaultSemiBold">
              返回商品
            </ThemedText>
          </Pressable>
          {isEditing ? (
            <Pressable
              onPress={() => void handleSave()}
              style={[styles.footerPrimary, { backgroundColor: tintColor, opacity: isSaving ? 0.72 : 1 }]}>
              <ThemedText style={styles.footerPrimaryText} type="defaultSemiBold">
                {isSaving ? '保存中…' : '保存商品'}
              </ThemedText>
            </Pressable>
          ) : (
            <Pressable onPress={() => setIsEditing(true)} style={[styles.footerPrimary, { backgroundColor: tintColor }]}>
              <ThemedText style={styles.footerPrimaryText} type="defaultSemiBold">
                编辑商品
              </ThemedText>
            </Pressable>
          )}
        </View>
      }
      title="商品详情">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.heroCard, { backgroundColor: surface, borderColor }]}>
          <View style={[styles.imageWrap, { backgroundColor: surfaceMuted }]}>
            {detail?.imageUrl ? <Image contentFit="cover" source={detail.imageUrl} style={styles.image} /> : null}
          </View>
          <View style={styles.heroCopy}>
            <View style={styles.heroTitleRow}>
              <ThemedText numberOfLines={1} style={styles.heroTitle} type="title">
                {detail?.itemName || productCode}
              </ThemedText>
              <View
                style={[
                  styles.statusChip,
                  { backgroundColor: detail?.disabled ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)' },
                ]}>
                <ThemedText
                  style={[styles.statusChipText, { color: detail?.disabled ? danger : success }]}
                  type="defaultSemiBold">
                  {detail?.disabled ? '已停用' : '启用中'}
                </ThemedText>
              </View>
            </View>
            <ThemedText style={styles.metaText}>编码 {detail?.itemCode || productCode}</ThemedText>
            {detail?.nickname ? <ThemedText style={styles.metaText}>昵称 {detail.nickname}</ThemedText> : null}
            <ThemedText style={styles.metaText}>分类 {detail?.itemGroup || '未分类'}</ThemedText>
            {detail?.brand ? <ThemedText style={styles.metaText}>品牌 {detail.brand}</ThemedText> : null}
            {detail?.barcode ? <ThemedText style={styles.metaText}>条码 {detail.barcode}</ThemedText> : null}
          </View>
        </View>

        {isLoading ? (
          <View style={[styles.sectionCard, { backgroundColor: surface, borderColor }]}>
            <ActivityIndicator />
          </View>
        ) : null}

        {detail ? (
          <>
            <View style={[styles.sectionCard, { backgroundColor: surface, borderColor }]}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderCopy}>
                  <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
                    库存
                  </ThemedText>
                  <ThemedText style={styles.sectionHint}>
                    查看商品的分仓库存，并在需要时切换仓库维护当前库存。
                  </ThemedText>
                </View>
              </View>
              <View style={[styles.inventoryFocusCard, { backgroundColor: surfaceMuted }]}>
                <View style={styles.inventoryFocusHeader}>
                  <View style={styles.inventoryFocusCopy}>
                    <ThemedText style={styles.inventoryFocusLabel}>当前调整仓库</ThemedText>
                    <ThemedText numberOfLines={1} style={styles.inventoryFocusTitle} type="defaultSemiBold">
                      {selectedWarehouse || '未选择仓库'}
                    </ThemedText>
                  </View>
                  <View
                    style={[
                      styles.inventoryStatusChip,
                      {
                        backgroundColor: selectedWarehouseHasStock ? 'rgba(16,185,129,0.12)' : 'rgba(59,130,246,0.12)',
                      },
                    ]}>
                    <ThemedText
                      style={{ color: selectedWarehouseHasStock ? success : tintColor }}
                      type="defaultSemiBold">
                      {selectedWarehouseHasStock ? '已有库存' : '新仓补录'}
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.inventoryFocusMetrics}>
                  <View style={styles.inventoryFocusMetric}>
                    <ThemedText style={styles.inventoryFocusMetricLabel}>总库存</ThemedText>
                    <ThemedText style={styles.inventoryFocusMetricValue} type="defaultSemiBold">
                      {detail.totalQty ?? 0} {formatDisplayUom(detail.stockUom)}
                    </ThemedText>
                  </View>
                  <View style={styles.inventoryFocusMetric}>
                    <ThemedText style={styles.inventoryFocusMetricLabel}>当前库存</ThemedText>
                    <ThemedText style={styles.inventoryFocusMetricValue} type="defaultSemiBold">
                      {selectedWarehouseQty ?? 0} {formatDisplayUom(detail.stockUom)}
                    </ThemedText>
                  </View>
                  <View style={styles.inventoryFocusMetric}>
                    <ThemedText style={styles.inventoryFocusMetricLabel}>库存基准单位</ThemedText>
                    <ThemedText style={styles.inventoryFocusMetricValue} type="defaultSemiBold">
                      {formatDisplayUom(detail.stockUom)}
                    </ThemedText>
                  </View>
                </View>
                {stockedWarehouses.length ? (
                  <View style={styles.inventoryFocusFootnote}>
                    <ThemedText style={styles.inventoryFocusFootnoteText}>
                      该商品当前已有 {stockedWarehouses.length} 个仓库库存记录，其他仓库请通过“更换”进入。
                    </ThemedText>
                  </View>
                ) : null}
                {isEditing ? (
                  <Pressable
                    onPress={() => setWarehousePickerVisible(true)}
                    style={[styles.inventoryPickerButton, { backgroundColor: surface, borderColor }]}>
                    <View style={styles.inventoryPickerCopy}>
                      <ThemedText style={styles.inventoryPickerLabel}>切换调整仓库</ThemedText>
                      <ThemedText numberOfLines={1} style={styles.inventoryPickerValue} type="defaultSemiBold">
                        {selectedWarehouse || '请选择仓库'}
                      </ThemedText>
                    </View>
                    <ThemedText style={{ color: tintColor }} type="defaultSemiBold">
                      更换
                    </ThemedText>
                  </Pressable>
                ) : null}
              </View>

              {isEditing ? (
                <View style={styles.formBlock}>
                  {warehouseError ? <ThemedText style={[styles.helperText, { color: danger }]}>{warehouseError}</ThemedText> : null}
                  <View style={styles.rowFields}>
                    <View style={styles.rowField}>
                      <DetailField
                        label={`目标库存${selectedWarehouse ? `（${selectedWarehouse}）` : ''}`}
                        onChangeText={setDraftWarehouseStockQty}
                        placeholder="输入调整后的目标库存"
                        value={draftWarehouseStockQty}
                      />
                    </View>
                    <View style={styles.rowField}>
                      <View style={styles.fieldBlock}>
                        <ThemedText style={styles.fieldLabel} type="defaultSemiBold">
                          预计变动
                        </ThemedText>
                        <View style={[styles.staticField, { backgroundColor: surfaceMuted, borderColor }]}>
                          <ThemedText type="defaultSemiBold">
                            {inventoryDelta == null
                              ? '输入目标库存后自动计算'
                              : `${inventoryDelta > 0 ? '+' : ''}${inventoryDelta} ${formatDisplayUom(detail.stockUom)}`}
                          </ThemedText>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
              ) : stockedWarehouses.length ? (
                <View style={styles.inventoryRows}>
                  {stockedWarehouses.map((stockItem) => (
                    <View key={stockItem.warehouse} style={[styles.inventoryRowButton, { backgroundColor: surfaceMuted, borderColor }]}>
                      <View style={styles.inventoryRowCopy}>
                        <ThemedText numberOfLines={1} type="defaultSemiBold">
                          {stockItem.warehouse}
                        </ThemedText>
                        <ThemedText style={styles.inventoryRowMeta}>{stockItem.company || '未指定公司'}</ThemedText>
                      </View>
                      <ThemedText style={[styles.inventoryRowQty, { color: tintColor }]} type="defaultSemiBold">
                        {stockItem.qty} {formatDisplayUom(detail.stockUom)}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={[styles.emptyInventoryCard, { backgroundColor: surfaceMuted }]}>
                  <ThemedText type="defaultSemiBold">当前还没有分仓库存记录</ThemedText>
                  <ThemedText style={styles.sectionHint}>进入编辑后可搜索任意仓库并补录首笔库存。</ThemedText>
                </View>
              )}
            </View>

            <View style={[styles.sectionCard, { backgroundColor: surface, borderColor }]}>
              <View style={styles.sectionHeaderCopy}>
                <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
                  价格与销售单位
                </ThemedText>
                <ThemedText style={styles.sectionHint}>
                  上方库存使用库存基准单位；这里配置批发和零售场景下的默认成交单位。
                </ThemedText>
              </View>
              {uomConversionRows.length ? (
                <View style={[styles.unitRelationCard, { backgroundColor: surfaceMuted }]}>
                  <ThemedText style={styles.unitRelationTitle} type="defaultSemiBold">
                    单位换算
                  </ThemedText>
                  <View style={styles.unitRelationRows}>
                    {uomConversionRows.map((row) => (
                      <View key={row.uom} style={styles.unitRelationRow}>
                        <ThemedText style={styles.unitRelationName} type="defaultSemiBold">
                          {formatDisplayUom(row.uom)}
                        </ThemedText>
                        <ThemedText style={styles.unitRelationMeta}>
                          {formatConversionHint(row.uom, row.conversionFactor, detail.stockUom)}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
              {isEditing ? (
                <View style={styles.formBlock}>
                  <View style={styles.rowFields}>
                    <View style={styles.rowField}>
                      <DetailField label="标准售价" onChangeText={setDraftStandardRate} placeholder="例如 99" value={draftStandardRate} />
                    </View>
                    <View style={styles.rowField}>
                      <DetailField label="批发价" onChangeText={setDraftWholesaleRate} placeholder="例如 68" value={draftWholesaleRate} />
                    </View>
                  </View>
                  <View style={styles.rowFields}>
                    <View style={styles.rowField}>
                      <DetailField label="零售价" onChangeText={setDraftRetailRate} placeholder="例如 9.9" value={draftRetailRate} />
                    </View>
                    <View style={styles.rowField}>
                      <DetailField label="采购价" onChangeText={setDraftBuyingRate} placeholder="例如 55" value={draftBuyingRate} />
                    </View>
                  </View>
                  <View style={styles.rowFields}>
                    <View style={styles.rowField}>
                      <View style={styles.fieldBlock}>
                        <ThemedText style={styles.fieldLabel} type="defaultSemiBold">
                          批发成交单位
                        </ThemedText>
                        <Pressable
                          onPress={() => handleOpenUomPicker('wholesale')}
                          style={[styles.selectorField, { backgroundColor: surfaceMuted, borderColor }]}>
                          <View style={styles.selectorFieldCopy}>
                            <ThemedText style={styles.selectorFieldValue} type="defaultSemiBold">
                              {draftWholesaleDefaultUom ? formatDisplayUom(draftWholesaleDefaultUom) : '请选择'}
                            </ThemedText>
                          </View>
                          <ThemedText style={{ color: tintColor }} type="defaultSemiBold">
                            选择
                          </ThemedText>
                        </Pressable>
                      </View>
                    </View>
                    <View style={styles.rowField}>
                      <View style={styles.fieldBlock}>
                        <ThemedText style={styles.fieldLabel} type="defaultSemiBold">
                          零售成交单位
                        </ThemedText>
                        <Pressable
                          onPress={() => handleOpenUomPicker('retail')}
                          style={[styles.selectorField, { backgroundColor: surfaceMuted, borderColor }]}>
                          <View style={styles.selectorFieldCopy}>
                            <ThemedText style={styles.selectorFieldValue} type="defaultSemiBold">
                              {draftRetailDefaultUom ? formatDisplayUom(draftRetailDefaultUom) : '请选择'}
                            </ThemedText>
                          </View>
                          <ThemedText style={{ color: tintColor }} type="defaultSemiBold">
                            选择
                          </ThemedText>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.priceGrid}>
                  <View style={[styles.priceCard, { backgroundColor: surfaceMuted }]}>
                    <ThemedText style={styles.priceLabel}>标准售价</ThemedText>
                    <ThemedText style={styles.priceValue} type="defaultSemiBold">
                      {formatMoney(detail.priceSummary?.standardSellingRate)}
                    </ThemedText>
                  </View>
                  <View style={[styles.priceCard, { backgroundColor: surfaceMuted }]}>
                    <ThemedText style={styles.priceLabel}>批发价</ThemedText>
                    <ThemedText style={styles.priceValue} type="defaultSemiBold">
                      {formatMoney(detail.priceSummary?.wholesaleRate)}
                    </ThemedText>
                    <ThemedText style={styles.priceMeta}>成交单位 {formatDisplayUom(detail.wholesaleDefaultUom)}</ThemedText>
                  </View>
                  <View style={[styles.priceCard, { backgroundColor: surfaceMuted }]}>
                    <ThemedText style={styles.priceLabel}>零售价</ThemedText>
                    <ThemedText style={styles.priceValue} type="defaultSemiBold">
                      {formatMoney(detail.priceSummary?.retailRate)}
                    </ThemedText>
                    <ThemedText style={styles.priceMeta}>成交单位 {formatDisplayUom(detail.retailDefaultUom)}</ThemedText>
                  </View>
                  <View style={[styles.priceCard, { backgroundColor: surfaceMuted }]}>
                    <ThemedText style={styles.priceLabel}>采购价</ThemedText>
                    <ThemedText style={styles.priceValue} type="defaultSemiBold">
                      {formatMoney(detail.priceSummary?.standardBuyingRate)}
                    </ThemedText>
                  </View>
                </View>
              )}
            </View>

            <View style={[styles.sectionCard, { backgroundColor: surface, borderColor }]}>
              <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
                基础资料
              </ThemedText>
              {isEditing ? (
                <View style={styles.formBlock}>
                  <DetailField label="商品名称" onChangeText={setDraftName} placeholder="输入商品名称" value={draftName} />
                  <View style={styles.rowFields}>
                    <View style={styles.rowField}>
                      <View style={styles.fieldBlock}>
                        <ThemedText style={styles.fieldLabel} type="defaultSemiBold">
                          商品分类
                        </ThemedText>
                        <Pressable
                          onPress={() => handleOpenMasterPicker('itemGroup')}
                          style={[styles.selectorFieldCompact, { backgroundColor: surfaceMuted, borderColor }]}>
                          <View style={styles.selectorFieldCompactCopy}>
                            <ThemedText numberOfLines={1} style={styles.selectorFieldCompactValue} type="defaultSemiBold">
                              {draftItemGroup || '请选择'}
                            </ThemedText>
                          </View>
                          <ThemedText style={{ color: tintColor }} type="defaultSemiBold">
                            选择
                          </ThemedText>
                        </Pressable>
                        {itemGroupError ? <ThemedText style={[styles.helperText, { color: danger }]}>{itemGroupError}</ThemedText> : null}
                      </View>
                    </View>
                    <View style={styles.rowField}>
                      <View style={styles.fieldBlock}>
                        <ThemedText style={styles.fieldLabel} type="defaultSemiBold">
                          品牌
                        </ThemedText>
                        <Pressable
                          onPress={() => handleOpenMasterPicker('brand')}
                          style={[styles.selectorFieldCompact, { backgroundColor: surfaceMuted, borderColor }]}>
                          <View style={styles.selectorFieldCompactCopy}>
                            <ThemedText numberOfLines={1} style={styles.selectorFieldCompactValue} type="defaultSemiBold">
                              {draftBrand || '请选择'}
                            </ThemedText>
                          </View>
                          <ThemedText style={{ color: tintColor }} type="defaultSemiBold">
                            选择
                          </ThemedText>
                        </Pressable>
                        {brandError ? <ThemedText style={[styles.helperText, { color: danger }]}>{brandError}</ThemedText> : null}
                      </View>
                    </View>
                  </View>
                  <DetailField label="主条码" onChangeText={setDraftBarcode} placeholder="输入商品主条码" value={draftBarcode} />
                  <DetailField label="商品昵称" onChangeText={setDraftNickname} placeholder="输入商品昵称" value={draftNickname} />
                  <DetailField label="图片地址" onChangeText={setDraftImageUrl} placeholder="输入商品图片 URL" value={draftImageUrl} />
                  <DetailField label="描述" multiline onChangeText={setDraftDescription} placeholder="输入商品说明" value={draftDescription} />
                </View>
              ) : (
                <View style={styles.readOnlyBlock}>
                  <View style={styles.readOnlyRow}>
                    <ThemedText style={styles.readOnlyLabel}>商品名称</ThemedText>
                    <ThemedText style={styles.readOnlyValue} type="defaultSemiBold">
                      {detail.itemName}
                    </ThemedText>
                  </View>
                  <View style={styles.readOnlyRow}>
                    <ThemedText style={styles.readOnlyLabel}>商品昵称</ThemedText>
                    <ThemedText style={styles.readOnlyValue} type="defaultSemiBold">
                      {detail.nickname || '未设置'}
                    </ThemedText>
                  </View>
                  <View style={styles.readOnlyRow}>
                    <ThemedText style={styles.readOnlyLabel}>商品分类</ThemedText>
                    <ThemedText style={styles.readOnlyValue} type="defaultSemiBold">
                      {detail.itemGroup || '未设置'}
                    </ThemedText>
                  </View>
                  <View style={styles.readOnlyRow}>
                    <ThemedText style={styles.readOnlyLabel}>品牌</ThemedText>
                    <ThemedText style={styles.readOnlyValue} type="defaultSemiBold">
                      {detail.brand || '未设置'}
                    </ThemedText>
                  </View>
                  <View style={styles.readOnlyRow}>
                    <ThemedText style={styles.readOnlyLabel}>主条码</ThemedText>
                    <ThemedText style={styles.readOnlyValue} type="defaultSemiBold">
                      {detail.barcode || '未设置'}
                    </ThemedText>
                  </View>
                  <View style={styles.readOnlyRow}>
                    <ThemedText style={styles.readOnlyLabel}>描述</ThemedText>
                    <ThemedText style={styles.readOnlyValue} type="defaultSemiBold">
                      {detail.description || '暂无描述'}
                    </ThemedText>
                  </View>
                </View>
              )}
            </View>

            <View style={[styles.sectionCard, styles.dangerSection, { backgroundColor: surface, borderColor }]}>
              <View style={styles.sectionHeaderCopy}>
                <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
                  危险操作
                </ThemedText>
                <ThemedText style={styles.sectionHint}>
                  停用后商品不会物理删除，但会影响后续使用。请在确认无误后再操作。
                </ThemedText>
              </View>
              <Pressable
                disabled={isToggling}
                onPress={() => void handleToggleStatus()}
                style={[
                  styles.dangerAction,
                  {
                    borderColor: detail.disabled ? success : danger,
                    backgroundColor: detail.disabled ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                  },
                ]}>
                <ThemedText style={{ color: detail.disabled ? success : danger }} type="defaultSemiBold">
                  {detail.disabled ? '重新启用商品' : '停用商品'}
                </ThemedText>
              </Pressable>
            </View>
          </>
        ) : null}
      </ScrollView>
      <Modal
        animationType="slide"
        onRequestClose={() => {
          setWarehousePickerVisible(false);
          setWarehouseSearchQuery('');
        }}
        transparent
        visible={warehousePickerVisible}>
        <View style={styles.modalBackdrop}>
          <Pressable
            onPress={() => {
              setWarehousePickerVisible(false);
              setWarehouseSearchQuery('');
            }}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.modalSheet, { backgroundColor: surface }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle} type="title">
                选择调整仓库
              </ThemedText>
              <ThemedText style={styles.sectionHint}>
                先选仓库，再回到商品页输入目标库存。
              </ThemedText>
            </View>
            <View style={[styles.modalSearchWrap, { backgroundColor: surfaceMuted, borderColor }]}>
              <TextInput
                onChangeText={setWarehouseSearchQuery}
                placeholder="搜索仓库名称"
                placeholderTextColor="rgba(31,42,55,0.38)"
                style={styles.modalSearchInput}
                value={warehouseSearchQuery}
              />
            </View>
            <ScrollView contentContainerStyle={styles.modalList} showsVerticalScrollIndicator={false}>
              {warehousePickerSections.stocked.length ? (
                <View style={styles.modalSection}>
                  <ThemedText style={styles.modalSectionTitle} type="defaultSemiBold">
                    已有库存仓库
                  </ThemedText>
                  {warehousePickerSections.stocked.map((warehouse) => {
                    const stockItem = stockedWarehouses.find((item) => item.warehouse === warehouse);
                    const active = warehouse === selectedWarehouse;
                    return (
                      <Pressable
                        key={warehouse}
                        onPress={() => handleSelectWarehouse(warehouse)}
                        style={[
                          styles.modalOption,
                          { backgroundColor: active ? 'rgba(59,130,246,0.08)' : surfaceMuted, borderColor },
                        ]}>
                        <View style={styles.modalOptionCopy}>
                          <ThemedText numberOfLines={1} type="defaultSemiBold">
                            {warehouse}
                          </ThemedText>
                          <ThemedText style={styles.modalOptionMeta}>
                            当前库存 {stockItem?.qty ?? 0} {formatDisplayUom(detail?.stockUom)}
                          </ThemedText>
                        </View>
                        <ThemedText style={{ color: tintColor }} type="defaultSemiBold">
                          {active ? '当前' : '选择'}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              {warehousePickerSections.others.length ? (
                <View style={styles.modalSection}>
                  <ThemedText style={styles.modalSectionTitle} type="defaultSemiBold">
                    其他可用仓库
                  </ThemedText>
                  {warehousePickerSections.others.map((warehouse) => {
                    const active = warehouse === selectedWarehouse;
                    return (
                      <Pressable
                        key={warehouse}
                        onPress={() => handleSelectWarehouse(warehouse)}
                        style={[
                          styles.modalOption,
                          { backgroundColor: active ? 'rgba(59,130,246,0.08)' : surfaceMuted, borderColor },
                        ]}>
                        <View style={styles.modalOptionCopy}>
                          <ThemedText numberOfLines={1} type="defaultSemiBold">
                            {warehouse}
                          </ThemedText>
                          <ThemedText style={styles.modalOptionMeta}>当前无库存记录，可直接补录首笔库存</ThemedText>
                        </View>
                        <ThemedText style={{ color: tintColor }} type="defaultSemiBold">
                          {active ? '当前' : '选择'}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              {!warehousePickerSections.stocked.length && !warehousePickerSections.others.length ? (
                <View style={[styles.emptyInventoryCard, { backgroundColor: surfaceMuted }]}>
                  <ThemedText type="defaultSemiBold">没有找到匹配仓库</ThemedText>
                  <ThemedText style={styles.sectionHint}>换个关键词试试。</ThemedText>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal
        animationType="slide"
        onRequestClose={() => {
          setMasterPickerVisible(false);
          setMasterPickerTarget(null);
          setMasterPickerQuery('');
        }}
        transparent
        visible={masterPickerVisible}>
        <View style={styles.modalBackdrop}>
          <Pressable
            onPress={() => {
              setMasterPickerVisible(false);
              setMasterPickerTarget(null);
              setMasterPickerQuery('');
            }}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.modalSheet, { backgroundColor: surface }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle} type="title">
                {masterPickerTarget === 'brand' ? '选择品牌' : '选择商品分类'}
              </ThemedText>
              <ThemedText style={styles.sectionHint}>
                通过搜索选择系统中已有主数据，避免手工录错。
              </ThemedText>
            </View>
            <View style={[styles.modalSearchWrap, { backgroundColor: surfaceMuted, borderColor }]}>
              <TextInput
                onChangeText={setMasterPickerQuery}
                placeholder={masterPickerTarget === 'brand' ? '搜索品牌名称' : '搜索分类名称'}
                placeholderTextColor="rgba(31,42,55,0.38)"
                style={styles.modalSearchInput}
                value={masterPickerQuery}
              />
            </View>
            <ScrollView contentContainerStyle={styles.modalList} showsVerticalScrollIndicator={false}>
              {masterPickerOptions.length ? (
                <View style={styles.modalSection}>
                  <ThemedText style={styles.modalSectionTitle} type="defaultSemiBold">
                    可选主数据
                  </ThemedText>
                  {masterPickerOptions.map((value) => {
                    const active =
                      (masterPickerTarget === 'itemGroup' && value === draftItemGroup) ||
                      (masterPickerTarget === 'brand' && value === draftBrand);
                    return (
                      <Pressable
                        key={value}
                        onPress={() => handleSelectMasterOption(value)}
                        style={[
                          styles.modalOption,
                          { backgroundColor: active ? 'rgba(59,130,246,0.08)' : surfaceMuted, borderColor },
                        ]}>
                        <View style={styles.modalOptionCopy}>
                          <ThemedText numberOfLines={1} type="defaultSemiBold">
                            {value}
                          </ThemedText>
                        </View>
                        <ThemedText style={{ color: tintColor }} type="defaultSemiBold">
                          {active ? '当前' : '选择'}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <View style={[styles.emptyInventoryCard, { backgroundColor: surfaceMuted }]}>
                  <ThemedText type="defaultSemiBold">没有找到匹配主数据</ThemedText>
                  <ThemedText style={styles.sectionHint}>换个关键词试试。</ThemedText>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal
        animationType="slide"
        onRequestClose={() => {
          setUomPickerVisible(false);
          setUomPickerTarget(null);
          setUomSearchQuery('');
        }}
        transparent
        visible={uomPickerVisible}>
        <View style={styles.modalBackdrop}>
          <Pressable
            onPress={() => {
              setUomPickerVisible(false);
              setUomPickerTarget(null);
              setUomSearchQuery('');
            }}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.modalSheet, { backgroundColor: surface }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle} type="title">
                {uomPickerTarget === 'retail' ? '选择零售单位' : '选择批发单位'}
              </ThemedText>
              <ThemedText style={styles.sectionHint}>
                优先显示商品单位，再补充系统单位。
              </ThemedText>
            </View>
            <View style={[styles.modalSearchWrap, { backgroundColor: surfaceMuted, borderColor }]}>
              <TextInput
                onChangeText={setUomSearchQuery}
                placeholder="搜索单位名称"
                placeholderTextColor="rgba(31,42,55,0.38)"
                style={styles.modalSearchInput}
                value={uomSearchQuery}
              />
            </View>
            <ScrollView contentContainerStyle={styles.modalList} showsVerticalScrollIndicator={false}>
              {filteredUomOptions.length ? (
                <View style={styles.modalSection}>
                  <ThemedText style={styles.modalSectionTitle} type="defaultSemiBold">
                    可选单位
                  </ThemedText>
                  {filteredUomOptions.map((uom) => {
                    const active =
                      (uomPickerTarget === 'wholesale' && uom === draftWholesaleDefaultUom) ||
                      (uomPickerTarget === 'retail' && uom === draftRetailDefaultUom);
                    const fromItem = (detail?.allUoms ?? []).includes(uom) || detail?.stockUom === uom;

                    return (
                      <Pressable
                        key={uom}
                        onPress={() => handleSelectUom(uom)}
                        style={[
                          styles.modalOption,
                          { backgroundColor: active ? 'rgba(59,130,246,0.08)' : surfaceMuted, borderColor },
                        ]}>
                        <View style={styles.modalOptionCopy}>
                          <ThemedText numberOfLines={1} type="defaultSemiBold">
                            {formatDisplayUom(uom)}
                          </ThemedText>
                          <ThemedText style={styles.modalOptionMeta}>
                            {fromItem ? `${uom} · 商品单位` : `${uom} · 系统单位`}
                          </ThemedText>
                        </View>
                        <ThemedText style={{ color: tintColor }} type="defaultSemiBold">
                          {active ? '当前' : '选择'}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <View style={[styles.emptyInventoryCard, { backgroundColor: surfaceMuted }]}>
                  <ThemedText type="defaultSemiBold">没有找到匹配单位</ThemedText>
                  <ThemedText style={styles.sectionHint}>换个关键词试试。</ThemedText>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 14,
    paddingBottom: 20,
  },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 16,
    padding: 18,
  },
  imageWrap: {
    borderRadius: 22,
    height: 88,
    overflow: 'hidden',
    width: 88,
  },
  image: {
    height: '100%',
    width: '100%',
  },
  heroCopy: {
    flex: 1,
    gap: 6,
  },
  heroTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  heroTitle: {
    flex: 1,
    fontSize: 24,
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
  sectionCard: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionHeaderCopy: {
    flex: 1,
    gap: 4,
    paddingRight: 12,
  },
  sectionTitle: {
    fontSize: 18,
  },
  sectionHint: {
    opacity: 0.72,
  },
  dangerSection: {
    gap: 12,
  },
  dangerAction: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 14,
  },
  priceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  priceCard: {
    borderRadius: 18,
    gap: 6,
    minHeight: 90,
    minWidth: '47%',
    padding: 14,
  },
  priceLabel: {
    opacity: 0.62,
  },
  priceValue: {
    fontSize: 18,
  },
  priceMeta: {
    opacity: 0.72,
  },
  unitRelationCard: {
    borderRadius: 18,
    gap: 10,
    padding: 14,
  },
  unitRelationTitle: {
    fontSize: 15,
  },
  unitRelationRows: {
    gap: 8,
  },
  unitRelationRow: {
    gap: 2,
  },
  unitRelationName: {
    fontSize: 14,
  },
  unitRelationMeta: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 18,
  },
  stockList: {
    gap: 12,
  },
  inventoryFocusCard: {
    borderRadius: 20,
    gap: 12,
    padding: 16,
  },
  inventoryFocusHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  inventoryFocusCopy: {
    flex: 1,
    gap: 4,
  },
  inventoryFocusLabel: {
    opacity: 0.62,
  },
  inventoryFocusTitle: {
    fontSize: 18,
  },
  inventoryStatusChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  inventoryFocusMetrics: {
    flexDirection: 'row',
    gap: 10,
  },
  inventoryFocusMetric: {
    flex: 1,
    gap: 4,
  },
  inventoryFocusMetricLabel: {
    opacity: 0.62,
  },
  inventoryFocusMetricValue: {
    fontSize: 16,
  },
  inventoryFocusFootnote: {
    borderTopColor: 'rgba(148,163,184,0.18)',
    borderTopWidth: 1,
    paddingTop: 10,
  },
  inventoryFocusFootnoteText: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 18,
  },
  inventoryPickerButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 54,
    paddingHorizontal: 14,
  },
  inventoryPickerCopy: {
    flex: 1,
    gap: 4,
    paddingRight: 12,
  },
  inventoryPickerLabel: {
    opacity: 0.62,
  },
  inventoryPickerValue: {
    fontSize: 15,
  },
  stockRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stockRowMain: {
    flex: 1,
    paddingRight: 10,
  },
  stockMeta: {
    marginTop: 4,
    opacity: 0.62,
  },
  stockQty: {
    fontSize: 14,
  },
  formBlock: {
    gap: 12,
  },
  fieldBlock: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 14,
  },
  textInput: {
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  textarea: {
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 108,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  selectorField: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 68,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  selectorFieldCompact: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 14,
  },
  selectorFieldCompactCopy: {
    flex: 1,
    paddingRight: 12,
  },
  selectorFieldCompactValue: {
    fontSize: 15,
  },
  selectorFieldCopy: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingRight: 12,
  },
  selectorFieldValue: {
    textAlign: 'center',
    width: '100%',
  },
  staticField: {
    alignItems: 'flex-start',
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 14,
  },
  rowFields: {
    flexDirection: 'row',
    gap: 12,
  },
  rowField: {
    flex: 1,
  },
  inventoryRows: {
    gap: 10,
  },
  inventoryRowButton: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inventoryRowCopy: {
    flex: 1,
    gap: 4,
    paddingRight: 10,
  },
  inventoryRowMeta: {
    opacity: 0.62,
    fontSize: 13,
  },
  inventoryRowSide: {
    alignItems: 'flex-end',
    gap: 4,
  },
  inventoryRowQty: {
    fontSize: 14,
  },
  inventoryRowAction: {
    color: '#64748B',
    fontSize: 12,
  },
  emptyInventoryCard: {
    borderRadius: 18,
    gap: 6,
    padding: 16,
  },
  helperText: {
    fontSize: 13,
    lineHeight: 18,
    paddingLeft: 4,
  },
  readOnlyBlock: {
    gap: 12,
  },
  readOnlyRow: {
    gap: 6,
  },
  readOnlyLabel: {
    opacity: 0.62,
  },
  readOnlyValue: {
    lineHeight: 22,
  },
  footerBar: {
    flexDirection: 'row',
    gap: 12,
  },
  footerSecondary: {
    alignItems: 'center',
    borderColor: 'rgba(59,130,246,0.24)',
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
  },
  footerPrimary: {
    alignItems: 'center',
    borderRadius: 18,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
  },
  footerPrimaryText: {
    color: '#FFFFFF',
  },
  modalBackdrop: {
    backgroundColor: 'rgba(15,23,42,0.28)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '78%',
    paddingBottom: 18,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  modalHandle: {
    alignSelf: 'center',
    backgroundColor: 'rgba(148,163,184,0.6)',
    borderRadius: 999,
    height: 5,
    marginBottom: 14,
    width: 56,
  },
  modalHeader: {
    gap: 6,
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 22,
  },
  modalSearchWrap: {
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 14,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  modalSearchInput: {
    color: '#111827',
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  modalList: {
    gap: 16,
    paddingBottom: 12,
  },
  modalSection: {
    gap: 10,
  },
  modalSectionTitle: {
    fontSize: 15,
  },
  modalOption: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  modalOptionCopy: {
    flex: 1,
    gap: 4,
    paddingRight: 10,
  },
  modalOptionMeta: {
    opacity: 0.62,
  },
});
