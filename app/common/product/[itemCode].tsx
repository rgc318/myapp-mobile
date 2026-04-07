import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { ItemImageField } from '@/components/item-image-field';
import { ProductTextField as DetailField } from '@/components/product-form-controls';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { resolveDisplayUom } from '@/lib/display-uom';
import { buildProductUomConversions, formatFactorInput, resolveDisplayConversionFactors, type StockSyncMode } from '@/lib/product-uom-sync';
import { useFeedback } from '@/providers/feedback-provider';
import { checkLinkOptionExists, searchLinkOptions } from '@/services/master-data';
import { fetchProductDetail, saveProductBasicInfo, setProductDisabled, type ProductDetail } from '@/services/products';
import { convertQtyToStockQty, formatConvertedQty } from '@/lib/uom-conversion';

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

function normalizeComparableText(value: string | null | undefined) {
  return (value ?? '').trim();
}

function areOptionalNumbersEqual(left: number | null | undefined, right: number | null | undefined) {
  if (left == null && right == null) {
    return true;
  }

  if (left == null || right == null) {
    return false;
  }

  return Math.abs(left - right) < 0.000001;
}

function formatQty(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '0';
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
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

export default function ProductDetailScreen() {
  const router = useRouter();
  const { showError, showSuccess } = useFeedback();
  const {
    itemCode,
    warehouse: initialWarehouse,
    returnTo: returnToParam,
    returnLabel: returnLabelParam,
  } = useLocalSearchParams<{ itemCode?: string; warehouse?: string; returnTo?: string; returnLabel?: string }>();
  const productCode = typeof itemCode === 'string' ? itemCode : '';
  const returnTo = typeof returnToParam === 'string' && returnToParam.trim() ? returnToParam.trim() : '';
  const returnLabel = typeof returnLabelParam === 'string' && returnLabelParam.trim() ? returnLabelParam.trim() : '返回商品';

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
  const [uomPickerTarget, setUomPickerTarget] = useState<'stock' | 'wholesale' | 'retail' | null>(null);
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
  const [draftSpecification, setDraftSpecification] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftImageUrl, setDraftImageUrl] = useState('');
  const [draftStandardRate, setDraftStandardRate] = useState('');
  const [draftWholesaleRate, setDraftWholesaleRate] = useState('');
  const [draftRetailRate, setDraftRetailRate] = useState('');
  const [draftBuyingRate, setDraftBuyingRate] = useState('');
  const [draftStockUom, setDraftStockUom] = useState('');
  const [draftWholesaleDefaultUom, setDraftWholesaleDefaultUom] = useState('');
  const [draftRetailDefaultUom, setDraftRetailDefaultUom] = useState('');
  const [draftWholesaleConversionFactor, setDraftWholesaleConversionFactor] = useState('');
  const [draftRetailConversionFactor, setDraftRetailConversionFactor] = useState('');
  const [stockSyncMode, setStockSyncMode] = useState<StockSyncMode>('manual');
  const [draftWarehouseStockQty, setDraftWarehouseStockQty] = useState('');
  const [draftWarehouseStockUom, setDraftWarehouseStockUom] = useState('');

  const hydrateDraft = (next: ProductDetail) => {
    setDraftName(next.itemName || next.itemCode);
    setDraftItemGroup(next.itemGroup || '');
    setDraftBrand(next.brand || '');
    setDraftBarcode(next.barcode || '');
    setDraftNickname(next.nickname || '');
    setDraftSpecification(next.specification || '');
    setDraftDescription(next.description || '');
    setDraftImageUrl(next.imageUrl || '');
    setDraftStandardRate(next.priceSummary?.standardSellingRate != null ? String(next.priceSummary.standardSellingRate) : '');
    setDraftWholesaleRate(next.priceSummary?.wholesaleRate != null ? String(next.priceSummary.wholesaleRate) : '');
    setDraftRetailRate(next.priceSummary?.retailRate != null ? String(next.priceSummary.retailRate) : '');
    setDraftBuyingRate(next.priceSummary?.standardBuyingRate != null ? String(next.priceSummary.standardBuyingRate) : '');
    setDraftStockUom(next.stockUom || next.retailDefaultUom || '');
    setDraftWholesaleDefaultUom(next.wholesaleDefaultUom || '');
    setDraftRetailDefaultUom(next.retailDefaultUom || '');

    const {
      stockSyncMode: nextStockSyncMode,
      wholesaleFactor,
      retailFactor,
    } = resolveDisplayConversionFactors({
      stockUom: next.stockUom,
      wholesaleDefaultUom: next.wholesaleDefaultUom,
      retailDefaultUom: next.retailDefaultUom,
      uomConversions: next.uomConversions,
    });

    setDraftWholesaleConversionFactor(formatFactorInput(wholesaleFactor));
    setDraftRetailConversionFactor(formatFactorInput(retailFactor));
    setStockSyncMode(nextStockSyncMode);
    setDraftWarehouseStockUom(next.stockUom || next.retailDefaultUom || next.wholesaleDefaultUom || '');
  };

  const applyImageUrl = useCallback((nextImageUrl: string) => {
    setDraftImageUrl(nextImageUrl);
    setDetail((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        imageUrl: nextImageUrl,
      };
    });
  }, []);

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
  const warehouseCount = detail?.warehouseStockDetails.length ?? 0;

  const stockUomDisplay = draftStockUom.trim() || detail?.stockUom || '';
  const wholesaleUomDisplay = draftWholesaleDefaultUom.trim();
  const retailUomDisplay = draftRetailDefaultUom.trim();
  const currentDisplayStockUom = isEditing ? stockUomDisplay : (detail?.stockUom ?? '');
  const ruleStockUom = isEditing ? stockUomDisplay : (detail?.stockUom ?? '');
  const ruleWholesaleUom = isEditing ? wholesaleUomDisplay : (detail?.wholesaleDefaultUom ?? '');
  const ruleRetailUom = isEditing ? retailUomDisplay : (detail?.retailDefaultUom ?? '');

  const getUomDisplay = useCallback(
    (uom: string | null | undefined, preferredDisplay?: string | null) => {
      const normalizedUom = typeof uom === 'string' ? uom.trim() : '';
      const safePreferredDisplay =
        preferredDisplay &&
        normalizedUom &&
        (
          (normalizedUom === detail?.stockUom && preferredDisplay === detail?.stockUomDisplay) ||
          (normalizedUom === detail?.wholesaleDefaultUom && preferredDisplay === detail?.wholesaleDefaultUomDisplay) ||
          (normalizedUom === detail?.retailDefaultUom && preferredDisplay === detail?.retailDefaultUomDisplay)
        )
          ? preferredDisplay
          : null;
      const detailDisplay =
        safePreferredDisplay ||
        (normalizedUom && normalizedUom === detail?.stockUom ? detail?.stockUomDisplay : null) ||
        (normalizedUom && normalizedUom === detail?.wholesaleDefaultUom ? detail?.wholesaleDefaultUomDisplay : null) ||
        (normalizedUom && normalizedUom === detail?.retailDefaultUom ? detail?.retailDefaultUomDisplay : null) ||
        (normalizedUom ? detail?.allUomDisplays?.[normalizedUom] : null) ||
        null;

      return resolveDisplayUom(normalizedUom, detailDisplay);
    },
    [
      detail?.allUomDisplays,
      detail?.retailDefaultUom,
      detail?.retailDefaultUomDisplay,
      detail?.stockUom,
      detail?.stockUomDisplay,
      detail?.wholesaleDefaultUom,
      detail?.wholesaleDefaultUomDisplay,
    ],
  );

  const wholesaleFormulaPreview = useMemo(() => {
    if (!wholesaleUomDisplay || !stockUomDisplay) {
      return '';
    }
    return `1 ${getUomDisplay(wholesaleUomDisplay)} = ${draftWholesaleConversionFactor || '？'} ${getUomDisplay(stockUomDisplay)}`;
  }, [draftWholesaleConversionFactor, getUomDisplay, stockUomDisplay, wholesaleUomDisplay]);

  const retailFormulaPreview = useMemo(() => {
    if (!retailUomDisplay || !stockUomDisplay) {
      return '';
    }
    if (stockSyncMode === 'wholesale') {
      return `1 ${getUomDisplay(stockUomDisplay)} = ${draftRetailConversionFactor || '？'} ${getUomDisplay(retailUomDisplay)}`;
    }
    if (stockSyncMode === 'retail') {
      return `1 ${getUomDisplay(retailUomDisplay)} = 1 ${getUomDisplay(stockUomDisplay)}`;
    }
    return `1 ${getUomDisplay(retailUomDisplay)} = ${draftRetailConversionFactor || '？'} ${getUomDisplay(stockUomDisplay)}`;
  }, [draftRetailConversionFactor, getUomDisplay, retailUomDisplay, stockSyncMode, stockUomDisplay]);

  useEffect(() => {
    if (!isEditing) {
      return;
    }

    if (stockSyncMode === 'wholesale' && wholesaleUomDisplay && draftStockUom !== wholesaleUomDisplay) {
      setDraftStockUom(wholesaleUomDisplay);
      return;
    }

    if (stockSyncMode === 'retail' && retailUomDisplay && draftStockUom !== retailUomDisplay) {
      setDraftStockUom(retailUomDisplay);
    }
  }, [draftStockUom, isEditing, retailUomDisplay, stockSyncMode, wholesaleUomDisplay]);

  const inventoryDelta = useMemo(() => {
    const inputQty = toNumberOrNull(draftWarehouseStockQty);
    if (inputQty == null) {
      return null;
    }
    const targetStockQty = convertQtyToStockQty({
      qty: inputQty,
      uom: draftWarehouseStockUom || currentDisplayStockUom,
      stockUom: currentDisplayStockUom,
      uomConversions: detail?.uomConversions,
    });
    if (targetStockQty == null) {
      return null;
    }
    return targetStockQty - (selectedWarehouseQty ?? 0);
  }, [currentDisplayStockUom, detail?.uomConversions, draftWarehouseStockQty, draftWarehouseStockUom, selectedWarehouseQty]);

  const inventoryInputUomOptions = useMemo(() => {
    const values = [draftStockUom.trim(), draftWholesaleDefaultUom.trim(), draftRetailDefaultUom.trim() || currentDisplayStockUom].filter(Boolean);
    return Array.from(new Set(values));
  }, [currentDisplayStockUom, draftRetailDefaultUom, draftStockUom, draftWholesaleDefaultUom]);

  const inventoryTargetSummary = useMemo(() => {
    const inputQty = toNumberOrNull(draftWarehouseStockQty);
    if (inputQty == null || !currentDisplayStockUom) {
      return '';
    }
    const targetStockQty = convertQtyToStockQty({
      qty: inputQty,
      uom: draftWarehouseStockUom || currentDisplayStockUom,
      stockUom: currentDisplayStockUom,
      uomConversions: detail?.uomConversions,
    });
    if (targetStockQty == null) {
      return '';
    }
    if ((draftWarehouseStockUom || currentDisplayStockUom) === currentDisplayStockUom) {
      return `将按 ${getUomDisplay(currentDisplayStockUom)} 保存库存目标。`;
    }
    return `将按 ${getUomDisplay(draftWarehouseStockUom)} 录入，约等于 ${formatConvertedQty(targetStockQty)} ${getUomDisplay(currentDisplayStockUom)}。`;
  }, [currentDisplayStockUom, detail?.uomConversions, draftWarehouseStockQty, draftWarehouseStockUom, getUomDisplay]);

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

  const wholesaleNeedsFactor = Boolean(wholesaleUomDisplay && stockUomDisplay && wholesaleUomDisplay !== stockUomDisplay);
  const retailNeedsFactor = Boolean(retailUomDisplay && stockUomDisplay && retailUomDisplay !== stockUomDisplay);

  const wholesaleSummaryText = useMemo(() => {
    if (!ruleWholesaleUom) {
      return '未配置';
    }
    if (!wholesaleNeedsFactor) {
      return `${getUomDisplay(ruleWholesaleUom)}（与库存基准一致）`;
    }
    return `1 ${getUomDisplay(ruleWholesaleUom)} = ${draftWholesaleConversionFactor || '未配置'} ${getUomDisplay(ruleStockUom)}`;
  }, [draftWholesaleConversionFactor, getUomDisplay, ruleStockUom, ruleWholesaleUom, wholesaleNeedsFactor]);

  const retailSummaryText = useMemo(() => {
    if (!ruleRetailUom) {
      return '未配置';
    }
    if (!retailNeedsFactor) {
      return `${getUomDisplay(ruleRetailUom)}（与库存基准一致）`;
    }
    if (stockSyncMode === 'wholesale') {
      return `1 ${getUomDisplay(ruleStockUom)} = ${draftRetailConversionFactor || '未配置'} ${getUomDisplay(ruleRetailUom)}`;
    }
    return `1 ${getUomDisplay(ruleRetailUom)} = ${draftRetailConversionFactor || '未配置'} ${getUomDisplay(ruleStockUom)}`;
  }, [draftRetailConversionFactor, getUomDisplay, retailNeedsFactor, ruleRetailUom, ruleStockUom, stockSyncMode]);

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
      const next = await fetchProductDetail(productCode, {
        warehouse: typeof initialWarehouse === 'string' ? initialWarehouse : undefined,
      });
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
  }, [initialWarehouse, productCode, showError]);

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
      (typeof initialWarehouse === 'string' && initialWarehouse.trim() ? initialWarehouse.trim() : '') ||
      warehouseOptions.find((warehouse) => warehouse === selectedWarehouse) ||
      detail.warehouse ||
      warehouseOptions[0] ||
      '';

    if (nextWarehouse !== selectedWarehouse) {
      setSelectedWarehouse(nextWarehouse);
      return;
    }

    setDraftWarehouseStockQty(selectedWarehouseQty != null ? String(selectedWarehouseQty) : '');
  }, [detail, initialWarehouse, selectedWarehouse, selectedWarehouseQty, warehouseOptions]);

  const handleSave = async () => {
    if (!detail) {
      return;
    }

    const trimmedWarehouse = selectedWarehouse.trim();

    try {
      setIsSaving(true);
      setWarehouseError('');
      setItemGroupError('');
      setBrandError('');

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

      const trimmedName = draftName.trim() || detail.itemName;
      const trimmedNickname = draftNickname.trim();
      const trimmedSpecification = draftSpecification.trim();
      const trimmedDescription = draftDescription.trim();
      const trimmedImageUrl = draftImageUrl.trim();
      const trimmedRetailUom = draftRetailDefaultUom.trim();
      const trimmedWholesaleUom = draftWholesaleDefaultUom.trim();
      const trimmedStockUom = draftStockUom.trim();
      const trimmedWarehouseStockUom = draftWarehouseStockUom.trim() || trimmedStockUom;
      const standardRateValue = toNumberOrNull(draftStandardRate);
      const wholesaleRateValue = toNumberOrNull(draftWholesaleRate);
      const retailRateValue = toNumberOrNull(draftRetailRate);
      const buyingRateValue = toNumberOrNull(draftBuyingRate);
      const wholesaleFactor = toNumberOrNull(draftWholesaleConversionFactor);
      const retailFactor = toNumberOrNull(draftRetailConversionFactor);
      const {
        wholesaleFactor: currentWholesaleFactor,
        retailFactor: currentRetailFactor,
      } = resolveDisplayConversionFactors({
        stockUom: detail.stockUom,
        wholesaleDefaultUom: detail.wholesaleDefaultUom,
        retailDefaultUom: detail.retailDefaultUom,
        uomConversions: detail.uomConversions,
      });

      const baseInfoChanged =
        normalizeComparableText(trimmedName) !== normalizeComparableText(detail.itemName) ||
        normalizeComparableText(trimmedItemGroup) !== normalizeComparableText(detail.itemGroup) ||
        normalizeComparableText(trimmedBrand) !== normalizeComparableText(detail.brand) ||
        normalizeComparableText(draftBarcode) !== normalizeComparableText(detail.barcode) ||
        normalizeComparableText(trimmedNickname) !== normalizeComparableText(detail.nickname) ||
        normalizeComparableText(trimmedSpecification) !== normalizeComparableText(detail.specification) ||
        normalizeComparableText(trimmedDescription) !== normalizeComparableText(detail.description) ||
        normalizeComparableText(trimmedImageUrl) !== normalizeComparableText(detail.imageUrl);

      const standardRateChanged = !areOptionalNumbersEqual(
        standardRateValue,
        detail.priceSummary?.standardSellingRate ?? null,
      );
      const wholesaleRateChanged = !areOptionalNumbersEqual(
        wholesaleRateValue,
        detail.priceSummary?.wholesaleRate ?? null,
      );
      const retailRateChanged = !areOptionalNumbersEqual(
        retailRateValue,
        detail.priceSummary?.retailRate ?? null,
      );
      const buyingRateChanged = !areOptionalNumbersEqual(
        buyingRateValue,
        detail.priceSummary?.standardBuyingRate ?? null,
      );

      const stockUomChanged =
        normalizeComparableText(trimmedStockUom) !== normalizeComparableText(detail.stockUom);
      const wholesaleUomChanged =
        normalizeComparableText(trimmedWholesaleUom) !== normalizeComparableText(detail.wholesaleDefaultUom);
      const retailUomChanged =
        normalizeComparableText(trimmedRetailUom) !== normalizeComparableText(detail.retailDefaultUom);
      const wholesaleFactorChanged =
        normalizeComparableText(draftWholesaleConversionFactor) !== normalizeComparableText(formatFactorInput(currentWholesaleFactor));
      const retailFactorChanged =
        normalizeComparableText(draftRetailConversionFactor) !== normalizeComparableText(formatFactorInput(currentRetailFactor));

      const wholesaleConfigTouched =
        wholesaleRateChanged ||
        wholesaleUomChanged ||
        wholesaleFactorChanged ||
        (stockUomChanged && Boolean(trimmedWholesaleUom || detail.wholesaleDefaultUom));
      const retailConfigTouched =
        retailRateChanged ||
        retailUomChanged ||
        retailFactorChanged ||
        (stockUomChanged && Boolean(trimmedRetailUom || detail.retailDefaultUom));

      const salesConfigChanged =
        stockUomChanged ||
        wholesaleUomChanged ||
        retailUomChanged ||
        wholesaleFactorChanged ||
        retailFactorChanged;

      const warehouseStockQtyValue = toNumberOrNull(draftWarehouseStockQty);
      const inventoryQtyChanged = !areOptionalNumbersEqual(warehouseStockQtyValue, selectedWarehouseQty);
      const inventoryUomChanged =
        normalizeComparableText(trimmedWarehouseStockUom) !== normalizeComparableText(currentDisplayStockUom);
      const inventoryChanged = inventoryQtyChanged || (warehouseStockQtyValue != null && inventoryUomChanged);

      if (!baseInfoChanged && !standardRateChanged && !wholesaleRateChanged && !retailRateChanged && !buyingRateChanged && !salesConfigChanged && !inventoryChanged) {
        showSuccess('没有检测到需要保存的修改');
        setIsEditing(false);
        return;
      }

      if ((salesConfigChanged || inventoryChanged) && !trimmedStockUom) {
        throw new Error('你正在修改单位或库存配置，请先选择库存基准单位。');
      }

      if (retailConfigTouched && !trimmedRetailUom) {
        throw new Error('你正在修改零售规则，请先选择零售成交单位。');
      }

      if (wholesaleConfigTouched && !trimmedWholesaleUom) {
        throw new Error('你正在修改批发规则，请先选择批发成交单位。');
      }

      if (wholesaleConfigTouched && wholesaleNeedsFactor && (wholesaleFactor == null || wholesaleFactor <= 0)) {
        throw new Error('你正在修改批发规则，请填写有效的批发单位换算系数。');
      }

      if (retailConfigTouched && retailNeedsFactor && (retailFactor == null || retailFactor <= 0)) {
        throw new Error('你正在修改零售规则，请填写有效的零售单位换算系数。');
      }

      if (inventoryChanged) {
        if (!trimmedWarehouse) {
          setWarehouseError('你正在调整库存，请先选择一个要调整库存的仓库。');
          return;
        }

        const warehouseExists = await checkLinkOptionExists('Warehouse', trimmedWarehouse);
        if (!warehouseExists) {
          setWarehouseError('仓库不存在，请从候选项中选择有效仓库。');
          return;
        }
      }

      const payload: Parameters<typeof saveProductBasicInfo>[0] = {
        itemCode: detail.itemCode,
      };

      if (baseInfoChanged) {
        payload.itemName = trimmedName;
        payload.itemGroup = trimmedItemGroup || undefined;
        payload.brand = trimmedBrand || undefined;
        payload.barcode = draftBarcode.trim() || undefined;
        payload.nickname = trimmedNickname || undefined;
        payload.specification = trimmedSpecification || undefined;
        payload.description = trimmedDescription || undefined;
        payload.imageUrl = trimmedImageUrl || undefined;
      }

      if (standardRateChanged) {
        payload.standardRate = standardRateValue;
      }
      if (wholesaleRateChanged) {
        payload.wholesaleRate = wholesaleRateValue;
      }
      if (retailRateChanged) {
        payload.retailRate = retailRateValue;
      }
      if (buyingRateChanged) {
        payload.standardBuyingRate = buyingRateValue;
      }

      if (salesConfigChanged) {
        const uomConversions = buildProductUomConversions({
          stockUom: trimmedStockUom,
          wholesaleDefaultUom: trimmedWholesaleUom || undefined,
          retailDefaultUom: trimmedRetailUom || undefined,
          wholesaleFactor,
          retailFactor,
          stockSyncMode,
        });

        payload.stockUom = trimmedStockUom;
        payload.uomConversions = uomConversions;
        payload.wholesaleDefaultUom = trimmedWholesaleUom || undefined;
        payload.retailDefaultUom = trimmedRetailUom || undefined;
      }

      if (inventoryChanged) {
        payload.warehouse = trimmedWarehouse;
        payload.warehouseStockQty = warehouseStockQtyValue;
        payload.warehouseStockUom = trimmedWarehouseStockUom || trimmedStockUom;
      }

      const saved = await saveProductBasicInfo(payload);

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

  const handleOpenUomPicker = (target: 'stock' | 'wholesale' | 'retail') => {
    setUomPickerTarget(target);
    setUomSearchQuery('');
    setUomPickerVisible(true);
  };

  const handleOpenMasterPicker = (target: 'itemGroup' | 'brand') => {
    setMasterPickerTarget(target);
    setMasterPickerQuery('');
    setMasterPickerVisible(true);
  };

  const applyStockSyncMode = (mode: 'manual' | 'wholesale' | 'retail') => {
    setStockSyncMode(mode);

    if (mode === 'wholesale' && draftWholesaleDefaultUom.trim()) {
      const nextStock = draftWholesaleDefaultUom.trim();
      setDraftStockUom(nextStock);
      setDraftWholesaleConversionFactor('1');
      setDraftRetailConversionFactor(draftRetailDefaultUom.trim() && draftRetailDefaultUom.trim() !== nextStock ? '' : '1');
      return;
    }

    if (mode === 'retail' && draftRetailDefaultUom.trim()) {
      const nextStock = draftRetailDefaultUom.trim();
      setDraftStockUom(nextStock);
      setDraftRetailConversionFactor('1');
      setDraftWholesaleConversionFactor(draftWholesaleDefaultUom.trim() && draftWholesaleDefaultUom.trim() !== nextStock ? '' : '1');
    }
  };

  const handleSelectUom = (uom: string) => {
    if (uomPickerTarget === 'wholesale') {
      setDraftWholesaleDefaultUom(uom);
      if (stockSyncMode === 'wholesale') {
        setDraftStockUom(uom);
        setDraftWholesaleConversionFactor('1');
        setDraftRetailConversionFactor(draftRetailDefaultUom.trim() && draftRetailDefaultUom.trim() !== uom ? '' : '1');
      }
    }

    if (uomPickerTarget === 'retail') {
      setDraftRetailDefaultUom(uom);
      if (stockSyncMode === 'retail') {
        setDraftStockUom(uom);
        setDraftRetailConversionFactor('1');
        setDraftWholesaleConversionFactor(draftWholesaleDefaultUom.trim() && draftWholesaleDefaultUom.trim() !== uom ? '' : '1');
      }
    }

    if (uomPickerTarget === 'stock') {
      setDraftStockUom(uom);
      setStockSyncMode('manual');
      setDraftWholesaleConversionFactor(draftWholesaleDefaultUom.trim() && draftWholesaleDefaultUom.trim() !== uom ? '' : '1');
      setDraftRetailConversionFactor(draftRetailDefaultUom.trim() && draftRetailDefaultUom.trim() !== uom ? '' : '1');
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
          <Pressable onPress={() => router.replace((returnTo || '/common/products') as never)} style={styles.footerSecondary}>
            <ThemedText style={{ color: tintColor }} type="defaultSemiBold">
              {returnTo ? returnLabel : '返回商品'}
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
          <View style={styles.heroGlowBlue} />
          <View style={styles.heroGlowAmber} />
          <View style={styles.heroTopRow}>
            <View style={[styles.imageWrap, { backgroundColor: surfaceMuted }]}>
              {detail?.imageUrl ? <Image contentFit="cover" source={detail.imageUrl} style={styles.image} /> : null}
            </View>
            <View style={styles.heroCopy}>
              <ThemedText style={styles.heroEyebrow}>PRODUCT DETAIL</ThemedText>
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
            </View>
          </View>
          <View style={styles.tagRow}>
            <View style={[styles.tag, { backgroundColor: surfaceMuted }]}>
              <ThemedText style={[styles.tagText, { color: tintColor }]} type="defaultSemiBold">
                分类 {detail?.itemGroup || '未分类'}
              </ThemedText>
            </View>
            <View style={[styles.tag, { backgroundColor: 'rgba(251,146,60,0.14)' }]}>
                <ThemedText style={[styles.tagText, { color: '#C2410C' }]} type="defaultSemiBold">
                单位 {getUomDisplay(currentDisplayStockUom, detail?.stockUomDisplay)}
              </ThemedText>
            </View>
            {detail?.brand ? (
              <View style={[styles.tag, { backgroundColor: surfaceMuted }]}>
                <ThemedText style={[styles.tagText, { color: '#334155' }]} type="defaultSemiBold">
                  品牌 {detail.brand}
                </ThemedText>
              </View>
            ) : null}
          </View>
          <View style={styles.heroStatsRow}>
            <View style={[styles.heroStatCard, { borderColor: 'rgba(59,130,246,0.2)', backgroundColor: 'rgba(59,130,246,0.08)' }]}>
              <ThemedText style={styles.heroStatLabel}>标准售价</ThemedText>
              <ThemedText style={styles.heroStatValue} type="defaultSemiBold">
                {formatMoney(detail?.priceSummary?.standardSellingRate)}
              </ThemedText>
            </View>
            <View style={[styles.heroStatCard, { borderColor: 'rgba(16,185,129,0.24)', backgroundColor: 'rgba(16,185,129,0.08)' }]}>
              <ThemedText style={styles.heroStatLabel}>总库存</ThemedText>
              <ThemedText style={styles.heroStatValue} type="defaultSemiBold">
                {formatQty(detail?.totalQty)} {getUomDisplay(currentDisplayStockUom, detail?.stockUomDisplay)}
              </ThemedText>
            </View>
            <View style={[styles.heroStatCard, { borderColor: 'rgba(234,88,12,0.24)', backgroundColor: 'rgba(234,88,12,0.08)' }]}>
              <ThemedText style={styles.heroStatLabel}>仓库记录</ThemedText>
              <ThemedText style={styles.heroStatValue} type="defaultSemiBold">
                {warehouseCount} 个
              </ThemedText>
            </View>
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
                      {detail.totalQty ?? 0} {getUomDisplay(currentDisplayStockUom, detail?.stockUomDisplay)}
                    </ThemedText>
                  </View>
                  <View style={styles.inventoryFocusMetric}>
                    <ThemedText style={styles.inventoryFocusMetricLabel}>当前库存</ThemedText>
                    <ThemedText style={styles.inventoryFocusMetricValue} type="defaultSemiBold">
                      {selectedWarehouseQty ?? 0} {getUomDisplay(currentDisplayStockUom, detail?.stockUomDisplay)}
                    </ThemedText>
                  </View>
                  <View style={styles.inventoryFocusMetric}>
                    <ThemedText style={styles.inventoryFocusMetricLabel}>库存基准单位</ThemedText>
                    <ThemedText style={styles.inventoryFocusMetricValue} type="defaultSemiBold">
                      {getUomDisplay(currentDisplayStockUom, detail?.stockUomDisplay)}
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
                  <View style={styles.inventoryInputModeRow}>
                    {inventoryInputUomOptions.map((uom) => {
                      const active = (draftWarehouseStockUom || currentDisplayStockUom) === uom;
                      return (
                        <Pressable
                          key={uom}
                          onPress={() => setDraftWarehouseStockUom(uom)}
                          style={[
                            styles.inventoryInputModeChip,
                            {
                              backgroundColor: active ? 'rgba(59,130,246,0.1)' : surfaceMuted,
                              borderColor: active ? tintColor : borderColor,
                            },
                          ]}>
                          <ThemedText style={{ color: active ? tintColor : '#475569' }} type="defaultSemiBold">
                            按{getUomDisplay(uom)}录入
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                  <View style={styles.rowFields}>
                    <View style={styles.rowField}>
                      <DetailField
                        label={`目标库存${selectedWarehouse ? `（${selectedWarehouse}）` : ''}`}
                        onChangeText={setDraftWarehouseStockQty}
                        placeholder={`输入${getUomDisplay(draftWarehouseStockUom || currentDisplayStockUom)}口径的目标库存`}
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
                              : `${inventoryDelta > 0 ? '+' : ''}${inventoryDelta} ${getUomDisplay(currentDisplayStockUom, detail?.stockUomDisplay)}`}
                          </ThemedText>
                        </View>
                      </View>
                    </View>
                  </View>
                  {inventoryTargetSummary ? <ThemedText style={styles.helperText}>{inventoryTargetSummary}</ThemedText> : null}
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
                        {stockItem.qty} {getUomDisplay(currentDisplayStockUom, detail?.stockUomDisplay)}
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
                  价格与成交单位
                </ThemedText>
                <ThemedText style={styles.sectionHint}>
                  先确定库存基准单位，再配置批发、零售默认成交单位以及到库存基准单位的换算关系。
                </ThemedText>
              </View>
              {uomConversionRows.length ? (
                <View style={[styles.unitRelationCard, { backgroundColor: surfaceMuted }]}>
                  <ThemedText style={styles.unitRelationTitle} type="defaultSemiBold">
                    单位规则
                  </ThemedText>
                  <View style={styles.unitFlowRow}>
                    <View style={styles.unitFlowCell}>
                      <ThemedText style={styles.unitFlowLabel}>库存基准</ThemedText>
                      <ThemedText style={styles.unitFlowValue} type="defaultSemiBold">
                        {getUomDisplay(ruleStockUom, detail?.stockUomDisplay)}
                      </ThemedText>
                    </View>
                    <View style={styles.unitFlowCenter}>
                      <ThemedText style={styles.unitFlowLabel}>批发默认</ThemedText>
                      <ThemedText style={styles.unitFlowValue} type="defaultSemiBold">
                        {wholesaleSummaryText}
                      </ThemedText>
                    </View>
                    <View style={styles.unitFlowCell}>
                      <ThemedText style={styles.unitFlowLabel}>零售默认</ThemedText>
                      <ThemedText style={styles.unitFlowValue} type="defaultSemiBold">
                        {retailSummaryText}
                      </ThemedText>
                    </View>
                  </View>
                  <ThemedText style={styles.unitRelationMeta}>
                    库存始终按 {getUomDisplay(ruleStockUom, detail?.stockUomDisplay)} 记账，批发和零售只决定默认成交单位。
                  </ThemedText>
                </View>
              ) : null}
              {isEditing ? (
                <View style={styles.formBlock}>
                  <View style={[styles.inlineInfoCard, { backgroundColor: surfaceMuted }]}>
                    <ThemedText style={styles.inlineInfoLabel}>库存基准单位</ThemedText>
                    <ThemedText style={styles.inlineInfoValue} type="defaultSemiBold">
                      {getUomDisplay(draftStockUom || detail.stockUom, detail?.stockUomDisplay)}
                    </ThemedText>
                    <ThemedText style={styles.inlineInfoHint}>库存统一按这个单位结算，批发和零售默认单位都要能换算到这里。</ThemedText>
                  </View>
                  <View style={[styles.priceFocusBand, { backgroundColor: surfaceMuted }]}>
                    <View style={styles.priceFocusBandRow}>
                      <ThemedText style={[styles.priceFocusLabel, { color: tintColor }]} type="defaultSemiBold">
                        批发价
                      </ThemedText>
                      <ThemedText style={[styles.priceFocusValue, { color: tintColor }]} type="defaultSemiBold">
                        {draftWholesaleRate.trim() ? `¥ ${draftWholesaleRate.trim()}` : '未配置'}
                      </ThemedText>
                    </View>
                    <View style={styles.priceFocusBandDivider} />
                    <View style={styles.priceFocusBandRow}>
                      <ThemedText style={[styles.priceFocusLabel, { color: success }]} type="defaultSemiBold">
                        零售价
                      </ThemedText>
                      <ThemedText style={[styles.priceFocusValue, { color: success }]} type="defaultSemiBold">
                        {draftRetailRate.trim() ? `¥ ${draftRetailRate.trim()}` : '未配置'}
                      </ThemedText>
                    </View>
                    <View style={styles.priceFocusBandDivider} />
                    <View style={styles.priceFocusBandRow}>
                      <ThemedText style={[styles.priceFocusLabel, { color: '#B45309' }]} type="defaultSemiBold">
                        默认采购价
                      </ThemedText>
                      <ThemedText style={[styles.priceFocusValue, { color: '#B45309' }]} type="defaultSemiBold">
                        {draftBuyingRate.trim() ? `¥ ${draftBuyingRate.trim()}` : '未配置'}
                      </ThemedText>
                    </View>
                  </View>
                  <View style={styles.rowFields}>
                    <View style={styles.rowField}>
                      <DetailField
                        label="批发价"
                        labelColor={tintColor}
                        onChangeText={setDraftWholesaleRate}
                        placeholder="例如 68"
                        value={draftWholesaleRate}
                      />
                    </View>
                    <View style={styles.rowField}>
                      <DetailField
                        label="零售价"
                        labelColor={success}
                        onChangeText={setDraftRetailRate}
                        placeholder="例如 9.9"
                        value={draftRetailRate}
                      />
                    </View>
                  </View>
                  <View style={styles.rowFields}>
                    <View style={styles.rowField}>
                      <DetailField
                        label="标准售价"
                        onChangeText={setDraftStandardRate}
                        placeholder="例如 99"
                        value={draftStandardRate}
                      />
                    </View>
                    <View style={styles.rowField}>
                      <DetailField
                        label="默认采购价"
                        labelColor="#B45309"
                        onChangeText={setDraftBuyingRate}
                        placeholder="例如 55（默认按批发采购口径）"
                        value={draftBuyingRate}
                      />
                    </View>
                  </View>
                  <View style={styles.unitEditorRow}>
                    <View style={styles.unitEditorCell}>
                      <View style={styles.labelRow}>
                        <ThemedText style={styles.fieldLabel} type="defaultSemiBold">
                          库存基准单位
                        </ThemedText>
                        <ThemedText style={styles.requiredMark} type="defaultSemiBold">
                          *
                        </ThemedText>
                      </View>
                      <Pressable
                        onPress={() => handleOpenUomPicker('stock')}
                        style={[styles.selectorFieldCompact, { backgroundColor: surfaceMuted, borderColor }]}>
                        <View style={styles.selectorFieldCompactCopy}>
                          <ThemedText numberOfLines={1} style={styles.selectorFieldCompactValue} type="defaultSemiBold">
                            {draftStockUom ? getUomDisplay(draftStockUom, detail?.stockUomDisplay) : '请选择'}
                          </ThemedText>
                        </View>
                        <ThemedText style={{ color: tintColor }} type="defaultSemiBold">
                          选择
                        </ThemedText>
                      </Pressable>
                    </View>
                  </View>
                  <View style={styles.syncModeRow}>
                    {[
                      { key: 'manual', label: '手动指定' },
                      { key: 'wholesale', label: '与批发单位同步' },
                      { key: 'retail', label: '与零售单位同步' },
                    ].map((option) => {
                      const active = stockSyncMode === option.key;
                      return (
                        <Pressable
                          key={option.key}
                          onPress={() => applyStockSyncMode(option.key as 'manual' | 'wholesale' | 'retail')}
                          style={[
                            styles.syncModeChip,
                            {
                              backgroundColor: active ? 'rgba(59,130,246,0.08)' : surfaceMuted,
                              borderColor: active ? tintColor : borderColor,
                            },
                          ]}>
                          <ThemedText style={[styles.syncModeChipText, active ? { color: tintColor } : null]} type="defaultSemiBold">
                            {option.label}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                  <ThemedText style={styles.unitEditorHint}>
                    选择同步后，库存基准单位会跟随对应默认成交单位变化；批发、零售两行都按“1 当前单位 = ? 库存基准单位”填写。
                  </ThemedText>
                  <View style={styles.unitRuleList}>
                    {stockSyncMode !== 'wholesale' ? (
                      <View style={styles.unitRuleRow}>
                        <View style={styles.labelRow}>
                          <ThemedText style={styles.unitRuleLabel} type="defaultSemiBold">
                            批发规则
                          </ThemedText>
                          {wholesaleNeedsFactor ? (
                            <ThemedText style={styles.requiredMark} type="defaultSemiBold">
                              *
                            </ThemedText>
                          ) : null}
                        </View>
                        <View style={styles.unitFormulaRow}>
                          <View style={styles.unitFormulaUnitCell}>
                            <Pressable
                              onPress={() => handleOpenUomPicker('wholesale')}
                              style={[styles.selectorFieldCompact, { backgroundColor: surfaceMuted, borderColor }]}>
                              <View style={styles.selectorFieldCompactCopy}>
                                <ThemedText numberOfLines={1} style={styles.selectorFieldCompactValue} type="defaultSemiBold">
                                  {draftWholesaleDefaultUom
                                    ? getUomDisplay(draftWholesaleDefaultUom, detail?.wholesaleDefaultUomDisplay)
                                    : '请选择'}
                                </ThemedText>
                              </View>
                              <ThemedText style={{ color: tintColor }} type="defaultSemiBold">
                                选择
                              </ThemedText>
                            </Pressable>
                          </View>
                          <ThemedText style={styles.unitFormulaOperator} type="defaultSemiBold">
                            =
                          </ThemedText>
                          <View style={styles.unitFormulaFactorCell}>
                            <TextInput
                              onChangeText={setDraftWholesaleConversionFactor}
                              placeholder={wholesaleNeedsFactor ? '例如 12' : '1'}
                              placeholderTextColor="rgba(31,42,55,0.38)"
                              style={[styles.textInput, { backgroundColor: surfaceMuted, borderColor }]}
                              value={wholesaleNeedsFactor ? draftWholesaleConversionFactor : '1'}
                            />
                          </View>
                          <View style={styles.unitFormulaTargetCell}>
                            <View style={[styles.staticField, { backgroundColor: surfaceMuted, borderColor }]}>
                              <ThemedText style={styles.selectorFieldCompactValue} type="defaultSemiBold">
                                {getUomDisplay(draftStockUom || detail.stockUom, detail?.stockUomDisplay)}
                              </ThemedText>
                            </View>
                          </View>
                        </View>
                        <ThemedText style={styles.unitFormulaPreview}>{wholesaleFormulaPreview}</ThemedText>
                      </View>
                    ) : null}
                    {stockSyncMode !== 'retail' ? (
                      <View style={styles.unitRuleRow}>
                        <View style={styles.labelRow}>
                          <ThemedText style={styles.unitRuleLabel} type="defaultSemiBold">
                            零售规则
                          </ThemedText>
                          {retailNeedsFactor ? (
                            <ThemedText style={styles.requiredMark} type="defaultSemiBold">
                              *
                            </ThemedText>
                          ) : null}
                        </View>
                        <View style={styles.unitFormulaRow}>
                          {stockSyncMode === 'wholesale' ? (
                            <View style={styles.unitFormulaUnitCell}>
                              <View style={[styles.staticField, { backgroundColor: surfaceMuted, borderColor }]}>
                                <ThemedText style={styles.selectorFieldCompactValue} type="defaultSemiBold">
                                  {getUomDisplay(draftStockUom || detail.stockUom, detail?.stockUomDisplay)}
                                </ThemedText>
                              </View>
                            </View>
                          ) : (
                            <View style={styles.unitFormulaUnitCell}>
                              <Pressable
                                onPress={() => handleOpenUomPicker('retail')}
                                style={[styles.selectorFieldCompact, { backgroundColor: surfaceMuted, borderColor }]}>
                                <View style={styles.selectorFieldCompactCopy}>
                                  <ThemedText numberOfLines={1} style={styles.selectorFieldCompactValue} type="defaultSemiBold">
                                    {draftRetailDefaultUom
                                      ? getUomDisplay(draftRetailDefaultUom, detail?.retailDefaultUomDisplay)
                                      : '请选择'}
                                  </ThemedText>
                                </View>
                                <ThemedText style={{ color: tintColor }} type="defaultSemiBold">
                                  选择
                                </ThemedText>
                              </Pressable>
                            </View>
                          )}
                          <ThemedText style={styles.unitFormulaOperator} type="defaultSemiBold">
                            =
                          </ThemedText>
                          <View style={styles.unitFormulaFactorCell}>
                            <TextInput
                              onChangeText={setDraftRetailConversionFactor}
                              placeholder={retailNeedsFactor ? '例如 1' : '1'}
                              placeholderTextColor="rgba(31,42,55,0.38)"
                              style={[styles.textInput, { backgroundColor: surfaceMuted, borderColor }]}
                              value={retailNeedsFactor ? draftRetailConversionFactor : '1'}
                            />
                          </View>
                          <View style={styles.unitFormulaTargetCell}>
                            {stockSyncMode === 'wholesale' ? (
                              <Pressable
                                onPress={() => handleOpenUomPicker('retail')}
                                style={[styles.selectorFieldCompact, { backgroundColor: surfaceMuted, borderColor }]}>
                                <View style={styles.selectorFieldCompactCopy}>
                                  <ThemedText numberOfLines={1} style={styles.selectorFieldCompactValue} type="defaultSemiBold">
                                    {draftRetailDefaultUom
                                      ? getUomDisplay(draftRetailDefaultUom, detail?.retailDefaultUomDisplay)
                                      : '请选择'}
                                  </ThemedText>
                                </View>
                                <ThemedText style={{ color: tintColor }} type="defaultSemiBold">
                                  选择
                                </ThemedText>
                              </Pressable>
                            ) : (
                              <View style={[styles.staticField, { backgroundColor: surfaceMuted, borderColor }]}>
                                <ThemedText style={styles.selectorFieldCompactValue} type="defaultSemiBold">
                                  {getUomDisplay(draftStockUom || detail.stockUom, detail?.stockUomDisplay)}
                                </ThemedText>
                              </View>
                            )}
                          </View>
                        </View>
                        <ThemedText style={styles.unitFormulaPreview}>{retailFormulaPreview}</ThemedText>
                      </View>
                    ) : null}
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
                    <ThemedText style={styles.priceMeta}>
                      默认成交单位 {getUomDisplay(detail.wholesaleDefaultUom, detail.wholesaleDefaultUomDisplay)}
                    </ThemedText>
                  </View>
                  <View style={[styles.priceCard, { backgroundColor: surfaceMuted }]}>
                    <ThemedText style={styles.priceLabel}>零售价</ThemedText>
                    <ThemedText style={styles.priceValue} type="defaultSemiBold">
                      {formatMoney(detail.priceSummary?.retailRate)}
                    </ThemedText>
                    <ThemedText style={styles.priceMeta}>
                      默认成交单位 {getUomDisplay(detail.retailDefaultUom, detail.retailDefaultUomDisplay)}
                    </ThemedText>
                  </View>
                  <View style={[styles.priceCard, { backgroundColor: surfaceMuted }]}>
                    <ThemedText style={styles.priceLabel}>默认采购价</ThemedText>
                    <ThemedText style={styles.priceValue} type="defaultSemiBold">
                      {formatMoney(detail.priceSummary?.standardBuyingRate)}
                    </ThemedText>
                    <ThemedText style={styles.priceMeta}>默认按批发采购口径</ThemedText>
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
                  <DetailField label="商品名称" onChangeText={setDraftName} placeholder="输入商品名称" required value={draftName} />
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
                  <DetailField label="规格" onChangeText={setDraftSpecification} placeholder="输入规格，如 500ml / 大号 / A4" value={draftSpecification} />
                  <ItemImageField itemCode={detail.itemCode} onChange={applyImageUrl} value={draftImageUrl} />
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
                    <ThemedText style={styles.readOnlyLabel}>规格</ThemedText>
                    <ThemedText style={styles.readOnlyValue} type="defaultSemiBold">
                      {detail.specification || '未设置'}
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
                            当前库存 {stockItem?.qty ?? 0} {getUomDisplay(detail?.stockUom, detail?.stockUomDisplay)}
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
                {uomPickerTarget === 'stock'
                  ? '选择库存基准单位'
                  : uomPickerTarget === 'retail'
                    ? '选择零售单位'
                    : '选择批发单位'}
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
                      (uomPickerTarget === 'stock' && uom === draftStockUom) ||
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
                            {getUomDisplay(uom)}
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
    paddingBottom: 140,
  },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    gap: 12,
    padding: 16,
    position: 'relative',
  },
  heroGlowBlue: {
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderRadius: 999,
    height: 180,
    position: 'absolute',
    right: -78,
    top: -66,
    width: 180,
  },
  heroGlowAmber: {
    backgroundColor: 'rgba(251,191,36,0.14)',
    borderRadius: 999,
    height: 112,
    left: -32,
    position: 'absolute',
    top: 116,
    width: 112,
  },
  heroTopRow: {
    flexDirection: 'row',
    gap: 12,
  },
  imageWrap: {
    borderRadius: 18,
    height: 76,
    overflow: 'hidden',
    width: 76,
  },
  image: {
    height: '100%',
    width: '100%',
  },
  heroCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  heroEyebrow: {
    color: '#2563EB',
    fontSize: 12,
    letterSpacing: 1.2,
  },
  heroTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  heroTitle: {
    flex: 1,
    fontSize: 22,
    lineHeight: 28,
  },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusChipText: {
    fontSize: 11,
  },
  metaText: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 17,
  },
  tagRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 11,
    lineHeight: 14,
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  heroStatCard: {
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    gap: 3,
    minHeight: 68,
    padding: 10,
  },
  heroStatLabel: {
    color: '#6B7280',
    fontSize: 11,
  },
  heroStatValue: {
    color: '#0F172A',
    fontSize: 13,
    lineHeight: 17,
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
    color: '#64748B',
    fontSize: 14,
    lineHeight: 20,
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
  unitFlowRow: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: 10,
  },
  unitFlowCell: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 16,
    flex: 1,
    gap: 4,
    minHeight: 82,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  unitFlowCenter: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 16,
    flex: 1.4,
    gap: 4,
    justifyContent: 'center',
    minHeight: 82,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  unitFlowLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  unitFlowValue: {
    fontSize: 15,
    lineHeight: 20,
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
  inventoryInputModeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  inventoryInputModeChip: {
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  inlineInfoCard: {
    borderRadius: 18,
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inlineInfoLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  inlineInfoValue: {
    fontSize: 16,
  },
  inlineInfoHint: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 18,
  },
  priceFocusBand: {
    borderRadius: 18,
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  priceFocusBandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  priceFocusBandDivider: {
    backgroundColor: 'rgba(148,163,184,0.18)',
    height: 1,
  },
  priceFocusLabel: {
    fontSize: 13,
  },
  priceFocusValue: {
    fontSize: 15,
  },
  fieldBlock: {
    gap: 8,
  },
  labelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  fieldLabel: {
    fontSize: 14,
  },
  requiredMark: {
    color: '#DC2626',
    fontSize: 15,
    lineHeight: 18,
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
  unitEditorRow: {
    gap: 10,
  },
  unitEditorCell: {
    gap: 8,
  },
  unitEditorCenter: {
    gap: 8,
  },
  syncModeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  syncModeChip: {
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  syncModeChipText: {
    fontSize: 13,
  },
  unitEditorHint: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 18,
  },
  unitRuleList: {
    gap: 12,
  },
  unitRuleRow: {
    gap: 10,
  },
  unitRuleLabel: {
    fontSize: 14,
  },
  unitFormulaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  unitFormulaUnitCell: {
    flex: 1.15,
  },
  unitFormulaOperator: {
    fontSize: 18,
    lineHeight: 22,
    minWidth: 16,
    textAlign: 'center',
  },
  unitFormulaFactorCell: {
    flex: 0.72,
  },
  unitFormulaTargetCell: {
    flex: 0.78,
  },
  unitFormulaPreview: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 18,
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
