import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { ProductPickerSheet, ProductSelectorField, ProductTextField } from '@/components/product-form-controls';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { formatDisplayUom } from '@/lib/display-uom';
import { useFeedback } from '@/providers/feedback-provider';
import { checkLinkOptionExists, searchLinkOptions } from '@/services/master-data';
import { createProduct } from '@/services/products';

function toNumberOrNull(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function ProductCreateScreen() {
  const router = useRouter();
  const { showError, showSuccess } = useFeedback();
  const tintColor = useThemeColor({}, 'tint');

  const [itemName, setItemName] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [itemGroup, setItemGroup] = useState('');
  const [brand, setBrand] = useState('');
  const [barcode, setBarcode] = useState('');
  const [nickname, setNickname] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [stockUom, setStockUom] = useState('Nos');
  const [wholesaleDefaultUom, setWholesaleDefaultUom] = useState('Box');
  const [retailDefaultUom, setRetailDefaultUom] = useState('Nos');
  const [wholesaleConversionFactor, setWholesaleConversionFactor] = useState('12');
  const [retailConversionFactor, setRetailConversionFactor] = useState('1');
  const [standardRate, setStandardRate] = useState('');
  const [wholesaleRate, setWholesaleRate] = useState('');
  const [retailRate, setRetailRate] = useState('');
  const [standardBuyingRate, setStandardBuyingRate] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [masterPickerVisible, setMasterPickerVisible] = useState(false);
  const [masterPickerTarget, setMasterPickerTarget] = useState<'itemGroup' | 'brand' | null>(null);
  const [masterPickerQuery, setMasterPickerQuery] = useState('');
  const [masterPickerOptions, setMasterPickerOptions] = useState<string[]>([]);
  const [uomPickerVisible, setUomPickerVisible] = useState(false);
  const [uomPickerTarget, setUomPickerTarget] = useState<'stock' | 'wholesale' | 'retail' | null>(null);
  const [uomPickerQuery, setUomPickerQuery] = useState('');
  const [uomOptions, setUomOptions] = useState<string[]>([]);

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

  const handleCreate = async () => {
    if (!itemName.trim()) {
      showError('请先填写商品名称。');
      return;
    }

    const trimmedItemGroup = itemGroup.trim();
    const trimmedBrand = brand.trim();

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

    try {
      setIsSaving(true);
      const trimmedStockUom = stockUom.trim();
      if (!trimmedStockUom) {
        throw new Error('请先填写库存基准单位。');
      }

      const trimmedRetailUom = retailDefaultUom.trim();
      if (!trimmedRetailUom) {
        throw new Error('请先填写零售默认成交单位。');
      }

      const trimmedWholesaleUom = wholesaleDefaultUom.trim();
      const wholesaleFactor = toNumberOrNull(wholesaleConversionFactor);
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
        description: description.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
        stockUom: trimmedStockUom,
        wholesaleDefaultUom: trimmedWholesaleUom || undefined,
        retailDefaultUom: trimmedRetailUom,
        uomConversions: [
          { uom: trimmedStockUom, conversionFactor: 1 },
          ...(trimmedWholesaleUom
            ? [
                {
                  uom: trimmedWholesaleUom,
                  conversionFactor: trimmedWholesaleUom === trimmedStockUom ? 1 : (wholesaleFactor as number),
                },
              ]
            : []),
          ...(trimmedRetailUom
            ? [
                {
                  uom: trimmedRetailUom,
                  conversionFactor: trimmedRetailUom === trimmedStockUom ? 1 : (retailFactor as number),
                },
              ]
            : []),
        ].filter((entry, index, array) => array.findIndex((row) => row.uom === entry.uom) === index),
        standardRate: toNumberOrNull(standardRate),
        wholesaleRate: toNumberOrNull(wholesaleRate),
        retailRate: toNumberOrNull(retailRate),
        standardBuyingRate: toNumberOrNull(standardBuyingRate),
      });

      if (!created) {
        throw new Error('商品创建失败');
      }

      showSuccess(`商品 ${created.itemName} 已创建`);
      router.replace({
        pathname: '/common/product/[itemCode]',
        params: { itemCode: created.itemCode },
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

  const handleSelectUom = (value: string) => {
    if (uomPickerTarget === 'stock') {
      setStockUom(value);
    }

    if (uomPickerTarget === 'wholesale') {
      setWholesaleDefaultUom(value);
    }

    if (uomPickerTarget === 'retail') {
      setRetailDefaultUom(value);
    }

    setUomPickerVisible(false);
    setUomPickerTarget(null);
    setUomPickerQuery('');
  };

  const wholesaleNeedsFactor =
    Boolean(wholesaleDefaultUom.trim()) &&
    Boolean(stockUom.trim()) &&
    wholesaleDefaultUom.trim() !== stockUom.trim();
  const retailNeedsFactor = Boolean(retailDefaultUom.trim()) && Boolean(stockUom.trim()) && retailDefaultUom.trim() !== stockUom.trim();

  return (
    <AppShell
      compactHeader
      contentCard={false}
      description="录入商品基础资料、多价格、库存基准单位和默认成交单位。"
      footer={
        <View style={styles.footerBar}>
          <Pressable onPress={() => router.replace('/common/products')} style={styles.footerSecondary}>
            <ThemedText style={{ color: tintColor }} type="defaultSemiBold">
              返回商品
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
        <View style={styles.sectionBlock}>
          <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
            基础资料
          </ThemedText>
          <ProductTextField label="商品名称" onChangeText={setItemName} placeholder="例如 可口可乐 500ml" value={itemName} />
          <ProductTextField label="商品编码" onChangeText={setItemCode} placeholder="可留空，由系统生成" value={itemCode} />
          <View style={styles.rowFields}>
            <View style={styles.rowField}>
              <ProductSelectorField label="商品分类" onPress={() => handleOpenMasterPicker('itemGroup')} value={itemGroup} />
            </View>
            <View style={styles.rowField}>
              <ProductSelectorField label="品牌" onPress={() => handleOpenMasterPicker('brand')} value={brand} />
            </View>
          </View>
          <ProductTextField label="主条码" onChangeText={setBarcode} placeholder="输入商品主条码" value={barcode} />
          <ProductTextField label="商品昵称" onChangeText={setNickname} placeholder="如常用简称或别名" value={nickname} />
          <ProductTextField label="图片地址" onChangeText={setImageUrl} placeholder="输入商品图片 URL" value={imageUrl} />
          <ProductTextField label="描述" multiline onChangeText={setDescription} placeholder="补充规格、备注或说明" value={description} />
        </View>

        <View style={styles.sectionBlock}>
          <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
            价格与成交单位
          </ThemedText>
          <ThemedText style={styles.sectionHint}>
            先确定库存基准单位，再配置批发、零售默认成交单位以及到库存基准单位的换算关系。
          </ThemedText>
          <ProductSelectorField label="库存基准单位" onPress={() => handleOpenUomPicker('stock')} value={formatDisplayUom(stockUom)} />
          <View style={styles.rowFields}>
            <View style={styles.rowField}>
              <ProductSelectorField
                label="批发默认成交单位"
                onPress={() => handleOpenUomPicker('wholesale')}
                value={formatDisplayUom(wholesaleDefaultUom)}
              />
            </View>
            <View style={styles.rowField}>
              <ProductSelectorField
                label="零售默认成交单位"
                onPress={() => handleOpenUomPicker('retail')}
                value={formatDisplayUom(retailDefaultUom)}
              />
            </View>
          </View>
          <View style={styles.rowFields}>
            <View style={styles.rowField}>
              <ProductTextField
                label={
                  wholesaleNeedsFactor
                    ? `批发换算（1 ${formatDisplayUom(wholesaleDefaultUom || '批发')} = ? ${formatDisplayUom(stockUom || '库存基准')})`
                    : '批发换算'
                }
                onChangeText={setWholesaleConversionFactor}
                placeholder={wholesaleNeedsFactor ? '例如 12' : '与库存基准单位一致时自动按 1'}
                value={wholesaleNeedsFactor ? wholesaleConversionFactor : '1'}
              />
            </View>
            <View style={styles.rowField}>
              <ProductTextField
                label={retailNeedsFactor ? `零售换算（1 ${formatDisplayUom(retailDefaultUom || '零售')} = ? ${formatDisplayUom(stockUom || '库存基准')})` : '零售换算'}
                onChangeText={setRetailConversionFactor}
                placeholder={retailNeedsFactor ? '例如 1' : '与库存基准单位一致时自动按 1'}
                value={retailNeedsFactor ? retailConversionFactor : '1'}
              />
            </View>
          </View>
          <View style={styles.rowFields}>
            <View style={styles.rowField}>
              <ProductTextField label="标准售价" onChangeText={setStandardRate} placeholder="例如 99" value={standardRate} />
            </View>
            <View style={styles.rowField}>
              <ProductTextField label="批发价" onChangeText={setWholesaleRate} placeholder="例如 68" value={wholesaleRate} />
            </View>
          </View>
          <View style={styles.rowFields}>
            <View style={styles.rowField}>
              <ProductTextField label="零售价" onChangeText={setRetailRate} placeholder="例如 9.9" value={retailRate} />
            </View>
            <View style={styles.rowField}>
              <ProductTextField
                label="默认采购价"
                onChangeText={setStandardBuyingRate}
                placeholder="例如 55（默认按批发采购口径）"
                value={standardBuyingRate}
              />
            </View>
          </View>
        </View>
      </ScrollView>
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
    paddingBottom: 20,
  },
  sectionBlock: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
  },
  sectionHint: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 18,
  },
  rowFields: {
    flexDirection: 'row',
    gap: 12,
  },
  rowField: {
    flex: 1,
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
