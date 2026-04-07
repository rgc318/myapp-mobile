import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { ItemImageField } from '@/components/item-image-field';
import { ProductPickerSheet, ProductSelectorField, ProductTextField } from '@/components/product-form-controls';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getAppPreferences } from '@/lib/app-preferences';
import { resolveDisplayUom } from '@/lib/display-uom';
import { sanitizeDecimalInput } from '@/lib/numeric-input';
import { buildProductUomConversions, type StockSyncMode } from '@/lib/product-uom-sync';
import { useFeedback } from '@/providers/feedback-provider';
import { checkLinkOptionExists, searchLinkOptions } from '@/services/master-data';
import { searchWarehouses } from '@/services/purchases';
import { createProduct } from '@/services/products';

function toNumberOrNull(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function SectionHeader({
  title,
  hint,
  collapsed = false,
  summary,
  onToggle,
}: {
  title: string;
  hint: string;
  collapsed?: boolean;
  summary?: string;
  onToggle?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderTop}>
        <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
          {title}
        </ThemedText>
        {onToggle ? (
          <Pressable onPress={onToggle} style={styles.sectionToggleChip}>
            <ThemedText style={styles.sectionToggleChipText} type="defaultSemiBold">
              {collapsed ? '展开' : '收起'}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
      <ThemedText style={styles.sectionHint}>{collapsed ? summary || hint : hint}</ThemedText>
    </View>
  );
}

export default function ProductCreateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    barcode?: string;
    itemName?: string;
    specification?: string;
    brand?: string;
    defaultWarehouse?: string;
    returnTo?: string;
    returnLabel?: string;
  }>();
  const { showError, showSuccess } = useFeedback();
  const preferences = getAppPreferences();
  const tintColor = useThemeColor({}, 'tint');
  const surface = useThemeColor({}, 'surface');
  const borderColor = useThemeColor({}, 'border');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');

  const [itemName, setItemName] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [itemGroup, setItemGroup] = useState('');
  const [brand, setBrand] = useState('');
  const [barcode, setBarcode] = useState('');
  const [nickname, setNickname] = useState('');
  const [specification, setSpecification] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [stockUom, setStockUom] = useState('Box');
  const [wholesaleDefaultUom, setWholesaleDefaultUom] = useState('Box');
  const [retailDefaultUom, setRetailDefaultUom] = useState('Nos');
  const [wholesaleConversionFactor, setWholesaleConversionFactor] = useState('12');
  const [retailConversionFactor, setRetailConversionFactor] = useState('1');
  const [stockSyncMode, setStockSyncMode] = useState<StockSyncMode>('wholesale');
  const [standardRate, setStandardRate] = useState('');
  const [wholesaleRate, setWholesaleRate] = useState('');
  const [retailRate, setRetailRate] = useState('');
  const [standardBuyingRate, setStandardBuyingRate] = useState('');
  const [openingWarehouse, setOpeningWarehouse] = useState(
    typeof params.defaultWarehouse === 'string' && params.defaultWarehouse.trim()
      ? params.defaultWarehouse.trim()
      : preferences.defaultWarehouse,
  );
  const [openingQty, setOpeningQty] = useState('0');
  const [isSaving, setIsSaving] = useState(false);
  const [masterPickerVisible, setMasterPickerVisible] = useState(false);
  const [masterPickerTarget, setMasterPickerTarget] = useState<'itemGroup' | 'brand' | null>(null);
  const [masterPickerQuery, setMasterPickerQuery] = useState('');
  const [masterPickerOptions, setMasterPickerOptions] = useState<string[]>([]);
  const [warehousePickerVisible, setWarehousePickerVisible] = useState(false);
  const [warehousePickerQuery, setWarehousePickerQuery] = useState('');
  const [warehouseOptions, setWarehouseOptions] = useState<string[]>([]);
  const [uomPickerVisible, setUomPickerVisible] = useState(false);
  const [uomPickerTarget, setUomPickerTarget] = useState<'stock' | 'wholesale' | 'retail' | null>(null);
  const [uomPickerQuery, setUomPickerQuery] = useState('');
  const [uomOptions, setUomOptions] = useState<string[]>([]);
  const [createMode, setCreateMode] = useState<'simple' | 'detailed'>('simple');
  const [baseCollapsed, setBaseCollapsed] = useState(false);
  const [pricingCollapsed, setPricingCollapsed] = useState(false);
  const [inventoryCollapsed, setInventoryCollapsed] = useState(false);
  const returnTo = typeof params.returnTo === 'string' && params.returnTo.trim() ? params.returnTo.trim() : '';
  const returnLabel = typeof params.returnLabel === 'string' && params.returnLabel.trim() ? params.returnLabel.trim() : '返回商品';

  useEffect(() => {
    const nextDefaultWarehouse =
      typeof params.defaultWarehouse === 'string' && params.defaultWarehouse.trim()
        ? params.defaultWarehouse.trim()
        : preferences.defaultWarehouse;

    setItemName(typeof params.itemName === 'string' && params.itemName.trim() ? params.itemName.trim() : '');
    setItemCode('');
    setItemGroup('');
    setBrand(typeof params.brand === 'string' && params.brand.trim() ? params.brand.trim() : '');
    setBarcode(typeof params.barcode === 'string' && params.barcode.trim() ? params.barcode.trim() : '');
    setNickname('');
    setSpecification(typeof params.specification === 'string' && params.specification.trim() ? params.specification.trim() : '');
    setDescription('');
    setImageUrl('');
    setStockUom('Box');
    setWholesaleDefaultUom('Box');
    setRetailDefaultUom('Nos');
    setWholesaleConversionFactor('12');
    setRetailConversionFactor('1');
    setStockSyncMode('wholesale');
    setStandardRate('');
    setWholesaleRate('');
    setRetailRate('');
    setStandardBuyingRate('');
    setOpeningWarehouse(nextDefaultWarehouse);
    setOpeningQty('0');
    setCreateMode('simple');
    setBaseCollapsed(false);
    setPricingCollapsed(false);
    setInventoryCollapsed(false);
  }, [params.barcode, params.brand, params.defaultWarehouse, params.itemName, params.specification, preferences.defaultWarehouse]);

  useEffect(() => {
    if (!masterPickerVisible || !masterPickerTarget) {
      return;
    }

    let cancelled = false;

    async function loadOptions() {
      try {
        const doctype = masterPickerTarget === 'itemGroup' ? 'Item Group' : 'Brand';
        const options = await searchLinkOptions(doctype, masterPickerQuery);
        if (!cancelled) {
          setMasterPickerOptions(
            options
              .map((option) => option.value.trim())
              .filter(Boolean),
          );
        }
      } catch {
        if (!cancelled) {
          setMasterPickerOptions([]);
        }
      }
    }

    void loadOptions();

    return () => {
      cancelled = true;
    };
  }, [masterPickerQuery, masterPickerTarget, masterPickerVisible]);

  useEffect(() => {
    if (!warehousePickerVisible) {
      return;
    }

    let cancelled = false;

    async function loadWarehouses() {
      try {
        const options = await searchWarehouses(warehousePickerQuery);
        if (!cancelled) {
          setWarehouseOptions(
            options
              .map((option) => option.value.trim())
              .filter(Boolean),
          );
        }
      } catch {
        if (!cancelled) {
          setWarehouseOptions([]);
        }
      }
    }

    void loadWarehouses();

    return () => {
      cancelled = true;
    };
  }, [warehousePickerQuery, warehousePickerVisible]);

  useEffect(() => {
    if (!uomPickerVisible) {
      return;
    }

    let cancelled = false;

    async function loadUoms() {
      try {
        const options = await searchLinkOptions('UOM', uomPickerQuery);
        if (!cancelled) {
          setUomOptions(
            options
              .map((option) => option.value.trim())
              .filter(Boolean),
          );
        }
      } catch {
        if (!cancelled) {
          setUomOptions([]);
        }
      }
    }

    void loadUoms();

    return () => {
      cancelled = true;
    };
  }, [uomPickerQuery, uomPickerVisible]);

  useEffect(() => {
    if (createMode !== 'simple') {
      return;
    }

    if (stockSyncMode === 'manual') {
      setStockSyncMode('wholesale');
    }
    if (stockSyncMode === 'retail' && retailDefaultUom.trim()) {
      setStockUom(retailDefaultUom.trim());
      setRetailConversionFactor('1');
      setWholesaleConversionFactor((current) => current || '1');
      return;
    }
    if (wholesaleDefaultUom.trim()) {
      setStockUom(wholesaleDefaultUom.trim());
      setWholesaleConversionFactor('1');
      setRetailConversionFactor((current) => current || '1');
    }
  }, [createMode, retailDefaultUom, stockSyncMode, wholesaleDefaultUom]);

  const displayUom = (uom: string | null | undefined) => resolveDisplayUom(uom);

  const handleCreate = async () => {
    if (!itemName.trim()) {
      showError('请先填写商品名称。');
      return;
    }

    const trimmedItemGroup = itemGroup.trim();
    const trimmedBrand = brand.trim();
    const trimmedOpeningWarehouse = openingWarehouse.trim();
    const parsedOpeningQty = toNumberOrNull(openingQty) ?? 0;

    if (trimmedItemGroup) {
      const itemGroupExists = await checkLinkOptionExists('Item Group', trimmedItemGroup);
      if (!itemGroupExists) {
        showError('商品分类不存在，请从候选项中选择。');
        return;
      }
    }

    if (trimmedBrand) {
      const brandExists = await checkLinkOptionExists('Brand', trimmedBrand);
      if (!brandExists) {
        showError('品牌不存在，请从候选项中选择。');
        return;
      }
    }

    if (!trimmedOpeningWarehouse) {
      showError('请先选择入库仓库。');
      return;
    }

    const warehouseExists = await checkLinkOptionExists('Warehouse', trimmedOpeningWarehouse);
    if (!warehouseExists) {
      showError('入库仓库不存在，请从候选项中选择。');
      return;
    }

    if (parsedOpeningQty < 0) {
      showError('初始库存数量不能为负数。');
      return;
    }

    try {
      setIsSaving(true);
      const effectiveSyncMode: StockSyncMode =
        createMode === 'simple'
          ? stockSyncMode === 'retail'
            ? 'retail'
            : 'wholesale'
          : stockSyncMode;
      const trimmedWholesaleUom = wholesaleDefaultUom.trim();
      const trimmedRetailUom = retailDefaultUom.trim();
      const trimmedStockUom = createMode === 'simple'
        ? effectiveSyncMode === 'retail'
          ? (trimmedRetailUom || stockUom.trim())
          : (trimmedWholesaleUom || stockUom.trim())
        : stockUom.trim();
      if (!trimmedStockUom) {
        throw new Error('请先填写库存基准单位。');
      }

      if (!trimmedRetailUom) {
        throw new Error('请先填写零售默认成交单位。');
      }

      const wholesaleFactor = toNumberOrNull(wholesaleConversionFactor);
      if (createMode === 'simple' && !trimmedWholesaleUom) {
        throw new Error('请先填写批发单位。');
      }
      if (
        trimmedWholesaleUom &&
        trimmedWholesaleUom !== trimmedStockUom &&
        (wholesaleFactor == null || wholesaleFactor <= 0)
      ) {
        throw new Error('请填写有效的批发单位换算系数。');
      }

      const retailFactor = toNumberOrNull(retailConversionFactor);
      if (
        trimmedRetailUom &&
        trimmedRetailUom !== trimmedStockUom &&
        (retailFactor == null || retailFactor <= 0)
      ) {
        throw new Error('请填写有效的零售单位换算系数。');
      }

      const created = await createProduct({
        itemName: itemName.trim(),
        itemCode: itemCode.trim() || undefined,
        itemGroup: trimmedItemGroup || undefined,
        brand: trimmedBrand || undefined,
        barcode: barcode.trim() || undefined,
        nickname: nickname.trim() || undefined,
        specification: specification.trim() || undefined,
        description: description.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
        stockUom: trimmedStockUom,
        wholesaleDefaultUom: trimmedWholesaleUom || undefined,
        retailDefaultUom: trimmedRetailUom,
        uomConversions: buildProductUomConversions({
          stockUom: trimmedStockUom,
          wholesaleDefaultUom: trimmedWholesaleUom || undefined,
          retailDefaultUom: trimmedRetailUom,
          wholesaleFactor,
          retailFactor,
          stockSyncMode: effectiveSyncMode,
        }),
        standardRate:
          createMode === 'simple'
            ? toNumberOrNull(wholesaleRate)
            : toNumberOrNull(standardRate),
        wholesaleRate: toNumberOrNull(wholesaleRate),
        retailRate: toNumberOrNull(retailRate),
        standardBuyingRate: toNumberOrNull(standardBuyingRate),
        warehouse: trimmedOpeningWarehouse,
        warehouseStockQty: parsedOpeningQty,
        warehouseStockUom: trimmedStockUom,
      });

      if (!created) {
        throw new Error('商品创建失败');
      }

      showSuccess(`商品 ${created.itemName} 已创建，并已完成库存初始化`);
      router.replace({
        pathname: '/common/product/[itemCode]',
        params: {
          itemCode: created.itemCode,
          warehouse: trimmedOpeningWarehouse,
          returnTo: returnTo || undefined,
          returnLabel: returnTo ? returnLabel : undefined,
        },
      });
    } catch (error) {
      showError(error instanceof Error ? error.message : '创建商品失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenMasterPicker = (target: 'itemGroup' | 'brand') => {
    setMasterPickerTarget(target);
    setMasterPickerQuery('');
    setMasterPickerVisible(true);
  };

  const handleSelectMasterOption = (value: string) => {
    if (masterPickerTarget === 'itemGroup') {
      setItemGroup(value);
    }

    if (masterPickerTarget === 'brand') {
      setBrand(value);
    }

    setMasterPickerVisible(false);
    setMasterPickerTarget(null);
    setMasterPickerQuery('');
  };

  const handleOpenUomPicker = (target: 'stock' | 'wholesale' | 'retail') => {
    setUomPickerTarget(target);
    setUomPickerQuery('');
    setUomPickerVisible(true);
  };

  const handleSelectWarehouse = (value: string) => {
    setOpeningWarehouse(value);
    setWarehousePickerVisible(false);
    setWarehousePickerQuery('');
  };

  const handleSelectUom = (value: string) => {
    if (uomPickerTarget === 'stock') {
      setStockUom(value);
      setStockSyncMode('manual');
      setWholesaleConversionFactor(wholesaleDefaultUom.trim() && wholesaleDefaultUom.trim() !== value ? '' : '1');
      setRetailConversionFactor(retailDefaultUom.trim() && retailDefaultUom.trim() !== value ? '' : '1');
    }

    if (uomPickerTarget === 'wholesale') {
      setWholesaleDefaultUom(value);
      if (stockSyncMode === 'wholesale') {
        setStockUom(value);
        setWholesaleConversionFactor('1');
        setRetailConversionFactor(retailDefaultUom.trim() && retailDefaultUom.trim() !== value ? '' : '1');
      }
    }

    if (uomPickerTarget === 'retail') {
      setRetailDefaultUom(value);
      if (stockSyncMode === 'retail') {
        setStockUom(value);
        setRetailConversionFactor('1');
        setWholesaleConversionFactor(wholesaleDefaultUom.trim() && wholesaleDefaultUom.trim() !== value ? '' : '1');
      }
    }

    setUomPickerVisible(false);
    setUomPickerTarget(null);
    setUomPickerQuery('');
  };

  const applyStockSyncMode = (mode: 'manual' | 'wholesale' | 'retail') => {
    setStockSyncMode(mode);

    if (mode === 'wholesale' && wholesaleDefaultUom.trim()) {
      const nextStock = wholesaleDefaultUom.trim();
      setStockUom(nextStock);
      setWholesaleConversionFactor('1');
      setRetailConversionFactor(retailDefaultUom.trim() && retailDefaultUom.trim() !== nextStock ? '' : '1');
      return;
    }

    if (mode === 'retail' && retailDefaultUom.trim()) {
      const nextStock = retailDefaultUom.trim();
      setStockUom(nextStock);
      setRetailConversionFactor('1');
      setWholesaleConversionFactor(wholesaleDefaultUom.trim() && wholesaleDefaultUom.trim() !== nextStock ? '' : '1');
    }
  };

  const wholesaleNeedsFactor =
    Boolean(wholesaleDefaultUom.trim()) &&
    Boolean(stockUom.trim()) &&
    wholesaleDefaultUom.trim() !== stockUom.trim();
  const retailNeedsFactor = Boolean(retailDefaultUom.trim()) && Boolean(stockUom.trim()) && retailDefaultUom.trim() !== stockUom.trim();
  const wholesaleFormulaPreview = wholesaleDefaultUom.trim() && stockUom.trim()
    ? `1 ${displayUom(wholesaleDefaultUom)} = ${wholesaleConversionFactor || '？'} ${displayUom(stockUom)}`
    : '';
  const retailFormulaPreview =
    retailDefaultUom.trim() && stockUom.trim()
      ? stockSyncMode === 'wholesale'
        ? `1 ${displayUom(stockUom)} = ${retailConversionFactor || '？'} ${displayUom(retailDefaultUom)}`
        : stockSyncMode === 'retail'
          ? `1 ${displayUom(retailDefaultUom)} = 1 ${displayUom(stockUom)}`
          : `1 ${displayUom(retailDefaultUom)} = ${retailConversionFactor || '？'} ${displayUom(stockUom)}`
      : '';
  const completion = [
    itemName.trim(),
    createMode === 'simple' ? wholesaleDefaultUom.trim() : stockUom.trim(),
    wholesaleRate.trim() || retailRate.trim() || standardRate.trim(),
    wholesaleDefaultUom.trim() || retailDefaultUom.trim(),
  ].filter(Boolean).length;
  const baseSummary = [
    itemName.trim() || '未填名称',
    nickname.trim() ? `昵称 ${nickname.trim()}` : null,
    specification.trim() ? `规格 ${specification.trim()}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const pricingSummary = [
    createMode === 'simple'
      ? stockSyncMode === 'retail'
        ? '以零售为基准'
        : '以批发为基准'
      : stockSyncMode === 'manual'
        ? '手动指定'
        : stockSyncMode === 'retail'
          ? '与零售同步'
          : '与批发同步',
    wholesaleDefaultUom.trim() ? `批 ${displayUom(wholesaleDefaultUom)}` : null,
    retailDefaultUom.trim() ? `零 ${displayUom(retailDefaultUom)}` : null,
    wholesaleRate.trim() ? `批 ¥${wholesaleRate.trim()}` : null,
    retailRate.trim() ? `零 ¥${retailRate.trim()}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const inventorySummary = [
    openingWarehouse.trim() || '未选仓库',
    `库存 ${openingQty.trim() || '0'} ${displayUom(stockUom)}`,
  ].join(' · ');
  const purchasingBaseUomLabel =
    createMode === 'simple'
      ? stockSyncMode === 'retail'
        ? retailDefaultUom.trim() || stockUom.trim()
        : wholesaleDefaultUom.trim() || stockUom.trim()
      : stockUom.trim();
  const handleOpeningQtyChange = (value: string) => setOpeningQty(sanitizeDecimalInput(value));
  const handleWholesaleFactorChange = (value: string) => setWholesaleConversionFactor(sanitizeDecimalInput(value));
  const handleRetailFactorChange = (value: string) => setRetailConversionFactor(sanitizeDecimalInput(value));
  const handleStandardRateChange = (value: string) => setStandardRate(sanitizeDecimalInput(value));
  const handleWholesaleRateChange = (value: string) => setWholesaleRate(sanitizeDecimalInput(value));
  const handleRetailRateChange = (value: string) => setRetailRate(sanitizeDecimalInput(value));
  const handleBuyingRateChange = (value: string) => setStandardBuyingRate(sanitizeDecimalInput(value));

  return (
    <AppShell
      compactHeader
      contentCard={false}
      description="录入商品基础资料、多价格、库存基准单位和默认成交单位。"
      footer={
        <View style={styles.footerBar}>
          <Pressable onPress={() => router.replace((returnTo || '/common/products') as never)} style={styles.footerSecondary}>
            <ThemedText style={{ color: tintColor }} type="defaultSemiBold">
              {returnTo ? returnLabel : '返回商品'}
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => void handleCreate()}
            style={[styles.footerPrimary, { backgroundColor: tintColor, opacity: isSaving ? 0.72 : 1 }]}>
            <ThemedText style={styles.footerPrimaryText} type="defaultSemiBold">
              {isSaving ? '创建中…' : '创建商品'}
            </ThemedText>
          </Pressable>
        </View>
      }
      title="新增商品">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.heroCard, { backgroundColor: surface, borderColor }]}>
          <View style={styles.heroGlowBlue} />
          <View style={styles.heroGlowGreen} />
          <View style={styles.heroHeader}>
            <View style={styles.heroCopy}>
              <ThemedText style={styles.heroEyebrow}>NEW PRODUCT</ThemedText>
              <ThemedText style={styles.heroTitle} type="title">
                新建商品档案
              </ThemedText>
              <ThemedText style={styles.heroDescription}>先快速建档，再按需要补完整信息。</ThemedText>
            </View>
            <View style={[styles.heroBadge, { backgroundColor: surfaceMuted }]}>
              <ThemedText style={styles.heroBadgeLabel}>完成度</ThemedText>
              <ThemedText style={[styles.heroBadgeValue, { color: tintColor }]} type="defaultSemiBold">
                {completion}/4
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={[styles.modeSwitchCard, { backgroundColor: surface, borderColor }]}>
          <View style={styles.modeSwitchHeader}>
            <ThemedText style={styles.modeSwitchTitle} type="defaultSemiBold">
              创建模式
            </ThemedText>
            <ThemedText style={styles.modeSwitchHint}>默认使用简化版，后续可切到详细版补充信息。</ThemedText>
          </View>
          <View style={styles.modeSwitchRow}>
            {[
              {
                key: 'simple',
                label: '简化版',
              },
              {
                key: 'detailed',
                label: '详细版',
              },
            ].map((option) => {
              const active = createMode === option.key;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setCreateMode(option.key as 'simple' | 'detailed')}
                  style={[
                    styles.modeSwitchOption,
                    {
                      backgroundColor: active ? 'rgba(37,99,235,0.08)' : surfaceMuted,
                      borderColor: active ? tintColor : borderColor,
                    },
                  ]}>
                  <ThemedText style={styles.modeSwitchOptionTitle} type="defaultSemiBold">
                    {option.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.sectionBlock, { backgroundColor: surface, borderColor }]}>
          <SectionHeader
            collapsed={baseCollapsed}
            hint="录入商品主数据，作为销售、采购和库存链路的共用基础信息。"
            onToggle={() => setBaseCollapsed((value) => !value)}
            summary={baseSummary}
            title="基础资料"
          />
          {!baseCollapsed ? (
            <>
              <ProductTextField label="商品名称" onChangeText={setItemName} placeholder="例如 可口可乐 500ml" required value={itemName} />
              <ItemImageField onChange={setImageUrl} value={imageUrl} variant="cover" />
              <ProductTextField label="主条码" onChangeText={setBarcode} placeholder="输入商品主条码" value={barcode} />
              <ProductTextField label="商品昵称" onChangeText={setNickname} placeholder="如常用简称或别名" value={nickname} />
              <ProductTextField label="规格" onChangeText={setSpecification} placeholder="如 500ml / 大号 / A4" value={specification} />
              {createMode === 'detailed' ? (
                <>
                  <ProductTextField label="商品编码" onChangeText={setItemCode} placeholder="可留空，由系统生成" value={itemCode} />
                  <View style={styles.rowFields}>
                    <View style={styles.rowField}>
                      <ProductSelectorField label="商品分类" onPress={() => handleOpenMasterPicker('itemGroup')} value={itemGroup} />
                    </View>
                    <View style={styles.rowField}>
                      <ProductSelectorField label="品牌" onPress={() => handleOpenMasterPicker('brand')} value={brand} />
                    </View>
                  </View>
                  <ProductTextField label="描述" multiline onChangeText={setDescription} placeholder="补充备注或说明" value={description} />
                </>
              ) : null}
            </>
          ) : null}
        </View>

        <View style={[styles.sectionBlock, { backgroundColor: surface, borderColor }]}>
          <SectionHeader
            collapsed={pricingCollapsed}
            hint={
              createMode === 'simple'
                ? ''
                : '先确定库存基准单位，再配置批发、零售默认成交单位及换算关系。'
            }
            onToggle={() => setPricingCollapsed((value) => !value)}
            summary={pricingSummary}
            title="价格与成交单位"
          />
          {!pricingCollapsed && createMode === 'simple' ? (
            <>
              <View style={styles.syncModeRow}>
                {[
                  { key: 'wholesale', label: '以批发为基准' },
                  { key: 'retail', label: '以零售为基准' },
                ].map((option) => {
                  const active = stockSyncMode === option.key;
                  return (
                    <Pressable
                      key={option.key}
                      onPress={() => applyStockSyncMode(option.key as 'wholesale' | 'retail')}
                      style={[styles.syncModeChip, active ? styles.syncModeChipActive : null]}>
                      <ThemedText style={[styles.syncModeChipText, active ? { color: tintColor } : null]} type="defaultSemiBold">
                        {option.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.unitRuleList}>
                <View style={styles.labelRow}>
                  <ThemedText style={styles.unitRuleLabel} type="defaultSemiBold">
                    单位换算
                  </ThemedText>
                  <ThemedText style={styles.requiredMark} type="defaultSemiBold">
                    *
                  </ThemedText>
                </View>
                <View style={styles.simpleUnitBridgeRow}>
                  <View style={styles.simpleUnitBridgeCell}>
                    <ThemedText style={styles.inlineInfoLabel}>批发单位</ThemedText>
                    <Pressable onPress={() => handleOpenUomPicker('wholesale')} style={styles.selectorFieldCompact}>
                      <View style={styles.selectorFieldCompactCopy}>
                        <ThemedText numberOfLines={1} style={styles.selectorFieldCompactValue} type="defaultSemiBold">
                          {wholesaleDefaultUom ? displayUom(wholesaleDefaultUom) : '请选择'}
                        </ThemedText>
                      </View>
                      <ThemedText style={{ color: tintColor }} type="defaultSemiBold">
                        选择
                      </ThemedText>
                    </Pressable>
                  </View>
                  <View style={styles.simpleUnitBridgeFactor}>
                    <ThemedText style={styles.inlineInfoLabel}>系数</ThemedText>
                    <ProductTextField
                      keyboardType="decimal-pad"
                      label=""
                      onChangeText={stockSyncMode === 'retail' ? handleWholesaleFactorChange : handleRetailFactorChange}
                      placeholder="1"
                      value={
                        stockSyncMode === 'retail'
                          ? wholesaleNeedsFactor ? wholesaleConversionFactor : '1'
                          : retailNeedsFactor ? retailConversionFactor : '1'
                      }
                    />
                  </View>
                  <View style={styles.simpleUnitBridgeCell}>
                    <ThemedText style={styles.inlineInfoLabel}>零售单位</ThemedText>
                    <Pressable onPress={() => handleOpenUomPicker('retail')} style={styles.selectorFieldCompact}>
                      <View style={styles.selectorFieldCompactCopy}>
                        <ThemedText numberOfLines={1} style={styles.selectorFieldCompactValue} type="defaultSemiBold">
                          {retailDefaultUom ? displayUom(retailDefaultUom) : '请选择'}
                        </ThemedText>
                      </View>
                      <ThemedText style={{ color: tintColor }} type="defaultSemiBold">
                        选择
                      </ThemedText>
                    </Pressable>
                  </View>
                </View>
                <ThemedText style={styles.unitFormulaPreview}>
                  {wholesaleDefaultUom.trim() && retailDefaultUom.trim()
                    ? `1 ${displayUom(wholesaleDefaultUom)} = ${
                        stockSyncMode === 'retail'
                          ? wholesaleNeedsFactor ? wholesaleConversionFactor || '？' : '1'
                          : retailNeedsFactor ? retailConversionFactor || '？' : '1'
                      } ${displayUom(retailDefaultUom)}`
                    : '请选择批发单位和零售单位。'}
                </ThemedText>
              </View>
            </>
          ) : !pricingCollapsed ? (
            <>
              <View style={styles.inlineInfoCard}>
                <ThemedText style={styles.inlineInfoLabel}>库存基准单位</ThemedText>
                <ThemedText style={styles.inlineInfoValue} type="defaultSemiBold">
                  {displayUom(stockUom)}
                </ThemedText>
                <ThemedText style={styles.inlineInfoHint}>库存统一按这个单位结算，批发和零售默认单位都要能换算到这里。</ThemedText>
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
                  <Pressable onPress={() => handleOpenUomPicker('stock')} style={styles.selectorFieldCompact}>
                    <View style={styles.selectorFieldCompactCopy}>
                      <ThemedText numberOfLines={1} style={styles.selectorFieldCompactValue} type="defaultSemiBold">
                        {displayUom(stockUom)}
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
                      style={[styles.syncModeChip, active ? styles.syncModeChipActive : null]}>
                      <ThemedText style={[styles.syncModeChipText, active ? { color: tintColor } : null]} type="defaultSemiBold">
                        {option.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
              <ThemedText style={styles.sectionHint}>
                选择同步后，库存基准单位会跟随对应默认成交单位变化；只需要配置另一侧到基准单位的换算关系。
              </ThemedText>
            </>
          ) : null}
          {!pricingCollapsed && createMode === 'detailed' ? (
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
                    <Pressable onPress={() => handleOpenUomPicker('wholesale')} style={styles.selectorFieldCompact}>
                      <View style={styles.selectorFieldCompactCopy}>
                        <ThemedText numberOfLines={1} style={styles.selectorFieldCompactValue} type="defaultSemiBold">
                          {wholesaleDefaultUom ? displayUom(wholesaleDefaultUom) : '请选择'}
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
                    <ProductTextField
                      keyboardType="decimal-pad"
                      label=""
                      onChangeText={handleWholesaleFactorChange}
                      placeholder={wholesaleNeedsFactor ? '例如 12' : '1'}
                      value={wholesaleNeedsFactor ? wholesaleConversionFactor : '1'}
                    />
                  </View>
                  <View style={styles.unitFormulaTargetCell}>
                    <View style={styles.staticField}>
                      <ThemedText style={styles.selectorFieldCompactValue} type="defaultSemiBold">
                        {displayUom(stockUom)}
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
                      <View style={styles.staticField}>
                        <ThemedText style={styles.selectorFieldCompactValue} type="defaultSemiBold">
                          {displayUom(stockUom)}
                        </ThemedText>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.unitFormulaUnitCell}>
                      <Pressable onPress={() => handleOpenUomPicker('retail')} style={styles.selectorFieldCompact}>
                        <View style={styles.selectorFieldCompactCopy}>
                          <ThemedText numberOfLines={1} style={styles.selectorFieldCompactValue} type="defaultSemiBold">
                            {retailDefaultUom ? displayUom(retailDefaultUom) : '请选择'}
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
                    <ProductTextField
                      keyboardType="decimal-pad"
                      label=""
                      onChangeText={handleRetailFactorChange}
                      placeholder={retailNeedsFactor ? '例如 1' : '1'}
                      value={retailNeedsFactor ? retailConversionFactor : '1'}
                    />
                  </View>
                  <View style={styles.unitFormulaTargetCell}>
                    {stockSyncMode === 'wholesale' ? (
                      <Pressable onPress={() => handleOpenUomPicker('retail')} style={styles.selectorFieldCompact}>
                        <View style={styles.selectorFieldCompactCopy}>
                          <ThemedText numberOfLines={1} style={styles.selectorFieldCompactValue} type="defaultSemiBold">
                            {retailDefaultUom ? displayUom(retailDefaultUom) : '请选择'}
                          </ThemedText>
                        </View>
                        <ThemedText style={{ color: tintColor }} type="defaultSemiBold">
                          选择
                        </ThemedText>
                      </Pressable>
                    ) : (
                      <View style={styles.staticField}>
                        <ThemedText style={styles.selectorFieldCompactValue} type="defaultSemiBold">
                          {displayUom(stockUom)}
                        </ThemedText>
                      </View>
                    )}
                  </View>
                </View>
                <ThemedText style={styles.unitFormulaPreview}>{retailFormulaPreview}</ThemedText>
              </View>
              ) : null}
            </View>
          ) : null}
          {!pricingCollapsed ? (
            <View style={styles.rowFields}>
              <View style={styles.rowField}>
                <ProductTextField
                  keyboardType="decimal-pad"
                  label="批发价"
                  onChangeText={handleWholesaleRateChange}
                  placeholder="例如 68"
                  value={wholesaleRate}
                />
              </View>
              {createMode === 'detailed' ? (
                <View style={styles.rowField}>
                  <ProductTextField
                    keyboardType="decimal-pad"
                    label="标准售价"
                    onChangeText={handleStandardRateChange}
                    placeholder="例如 99"
                    value={standardRate}
                  />
                </View>
              ) : null}
            </View>
          ) : null}
          {!pricingCollapsed ? (
            <View style={styles.rowFields}>
              <View style={styles.rowField}>
                <ProductTextField
                  keyboardType="decimal-pad"
                  label="零售价"
                  onChangeText={handleRetailRateChange}
                  placeholder="例如 9.9"
                  value={retailRate}
                />
              </View>
              <View style={styles.rowField}>
                <ProductTextField
                  keyboardType="decimal-pad"
                  label={`默认采购价（${displayUom(purchasingBaseUomLabel)}）`}
                  onChangeText={handleBuyingRateChange}
                  placeholder="例如 55（默认按批发采购口径）"
                  value={standardBuyingRate}
                />
              </View>
            </View>
          ) : null}
        </View>

        <View style={[styles.sectionBlock, { backgroundColor: surface, borderColor }]}>
          <SectionHeader
            collapsed={inventoryCollapsed}
            hint="新增商品时顺手完成基础库存落仓，避免回到订单后仍然缺少仓库语义。"
            onToggle={() => setInventoryCollapsed((value) => !value)}
            summary={inventorySummary}
            title="库存初始化"
          />
          {!inventoryCollapsed ? (
            <>
              <ProductSelectorField
                label="入库仓库"
                onPress={() => {
                  setWarehousePickerQuery('');
                  setWarehousePickerVisible(true);
                }}
                required
                value={openingWarehouse}
              />
              <View style={styles.rowFields}>
                <View style={styles.rowField}>
                  <ProductTextField
                    keyboardType="decimal-pad"
                    label="初始库存数量"
                    onChangeText={handleOpeningQtyChange}
                    placeholder="默认 0"
                    required
                    value={openingQty}
                  />
                </View>
                <View style={styles.rowField}>
                  <View style={styles.inlineInfoCard}>
                    <ThemedText style={styles.inlineInfoLabel}>库存单位</ThemedText>
                    <ThemedText style={styles.inlineInfoValue} type="defaultSemiBold">
                      {displayUom(stockUom)}
                    </ThemedText>
                    <ThemedText style={styles.inlineInfoHint}>初始库存将按当前库存基准单位写入所选仓库。</ThemedText>
                  </View>
                </View>
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>
      <ProductPickerSheet
        hint="优先使用当前业务上下文仓库；没有时使用系统默认仓。"
        onChangeQuery={setWarehousePickerQuery}
        onClose={() => {
          setWarehousePickerVisible(false);
          setWarehousePickerQuery('');
        }}
        onSelect={handleSelectWarehouse}
        options={warehouseOptions}
        placeholder="搜索仓库名称"
        query={warehousePickerQuery}
        selectedValue={openingWarehouse}
        title="选择入库仓库"
        visible={warehousePickerVisible}
      />
      <ProductPickerSheet
        hint="通过搜索选择系统中已有主数据。"
        onChangeQuery={setMasterPickerQuery}
        onClose={() => {
          setMasterPickerVisible(false);
          setMasterPickerTarget(null);
          setMasterPickerQuery('');
        }}
        onSelect={handleSelectMasterOption}
        options={masterPickerOptions}
        placeholder={masterPickerTarget === 'brand' ? '搜索品牌名称' : '搜索分类名称'}
        query={masterPickerQuery}
        selectedValue={masterPickerTarget === 'itemGroup' ? itemGroup : brand}
        title={masterPickerTarget === 'brand' ? '选择品牌' : '选择商品分类'}
        visible={masterPickerVisible}
      />
      <ProductPickerSheet
        hint="请选择当前商品允许使用的成交单位。"
        onChangeQuery={setUomPickerQuery}
        onClose={() => {
          setUomPickerVisible(false);
          setUomPickerTarget(null);
          setUomPickerQuery('');
        }}
        onSelect={handleSelectUom}
        options={uomOptions}
        getOptionLabel={(value) => `${displayUom(value)} · ${value}`}
        placeholder="搜索单位名称"
        query={uomPickerQuery}
        selectedValue={uomPickerTarget === 'stock' ? stockUom : uomPickerTarget === 'wholesale' ? wholesaleDefaultUom : retailDefaultUom}
        title={uomPickerTarget === 'stock' ? '选择库存基准单位' : uomPickerTarget === 'wholesale' ? '选择批发单位' : '选择零售单位'}
        visible={uomPickerVisible}
      />
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
    paddingBottom: 140,
  },
  heroCard: {
    borderRadius: 28,
    borderWidth: 1,
    gap: 16,
    overflow: 'hidden',
    padding: 18,
    position: 'relative',
  },
  heroGlowBlue: {
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderRadius: 999,
    height: 200,
    position: 'absolute',
    right: -80,
    top: -70,
    width: 200,
  },
  heroGlowGreen: {
    backgroundColor: 'rgba(34,197,94,0.10)',
    borderRadius: 999,
    height: 120,
    left: -30,
    position: 'absolute',
    top: 120,
    width: 120,
  },
  heroHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  heroCopy: {
    flex: 1,
    gap: 6,
  },
  heroEyebrow: {
    color: '#2563EB',
    fontSize: 13,
    letterSpacing: 1.4,
  },
  heroTitle: {
    color: '#14213D',
    fontSize: 30,
    lineHeight: 34,
  },
  heroDescription: {
    color: '#5B6B81',
  },
  heroBadge: {
    borderRadius: 18,
    gap: 4,
    minWidth: 88,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  heroBadgeLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  heroBadgeValue: {
    fontSize: 22,
    lineHeight: 26,
  },
  modeSwitchCard: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  modeSwitchHeader: {
    gap: 4,
  },
  modeSwitchTitle: {
    fontSize: 18,
  },
  modeSwitchHint: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 20,
  },
  modeSwitchRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modeSwitchOption: {
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  modeSwitchOptionTitle: {
    fontSize: 16,
  },
  sectionBlock: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  sectionHeader: {
    gap: 4,
  },
  sectionHeaderTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 18,
  },
  sectionHint: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 20,
  },
  sectionToggleChip: {
    backgroundColor: 'rgba(148,163,184,0.08)',
    borderColor: 'rgba(148,163,184,0.2)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sectionToggleChipText: {
    color: '#475569',
    fontSize: 13,
  },
  rowFields: {
    flexDirection: 'row',
    gap: 12,
  },
  rowField: {
    flex: 1,
  },
  inlineInfoCard: {
    backgroundColor: 'rgba(148,163,184,0.08)',
    borderRadius: 18,
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inlineInfoLabel: {
    color: '#64748B',
    fontSize: 13,
  },
  inlineInfoValue: {
    fontSize: 20,
  },
  inlineInfoHint: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 18,
  },
  fieldLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  labelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
  },
  requiredMark: {
    color: '#DC2626',
    fontSize: 15,
    lineHeight: 18,
    marginBottom: 8,
  },
  unitEditorRow: {
    flexDirection: 'row',
  },
  unitEditorCell: {
    flex: 1,
  },
  selectorFieldCompact: {
    alignItems: 'center',
    backgroundColor: 'rgba(148,163,184,0.08)',
    borderColor: 'rgba(148,163,184,0.2)',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: 14,
  },
  selectorFieldCompactCopy: {
    flex: 1,
    gap: 2,
  },
  selectorFieldCompactValue: {
    fontSize: 16,
  },
  staticField: {
    alignItems: 'center',
    backgroundColor: 'rgba(148,163,184,0.08)',
    borderColor: 'rgba(148,163,184,0.2)',
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: 14,
  },
  syncModeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  syncModeChip: {
    backgroundColor: 'rgba(148,163,184,0.08)',
    borderColor: 'rgba(148,163,184,0.2)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  syncModeChipActive: {
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderColor: 'rgba(59,130,246,0.35)',
  },
  syncModeChipText: {
    fontSize: 14,
  },
  unitRuleList: {
    gap: 16,
  },
  unitRuleRow: {
    gap: 8,
  },
  unitRuleLabel: {
    fontSize: 15,
  },
  unitFormulaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  unitFormulaUnitCell: {
    flex: 1.05,
  },
  unitFormulaFactorCell: {
    flex: 0.72,
  },
  unitFormulaTargetCell: {
    flex: 1,
  },
  unitFormulaOperator: {
    color: '#475569',
    fontSize: 18,
  },
  unitFormulaPreview: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 18,
  },
  simpleUnitBridgeRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 8,
  },
  simpleUnitBridgeCell: {
    flex: 1,
    gap: 8,
  },
  simpleUnitBridgeFactor: {
    flex: 0.72,
    gap: 8,
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
});
