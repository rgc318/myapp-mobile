import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { formatDisplayUom } from '@/lib/display-uom';
import { useFeedback } from '@/providers/feedback-provider';
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

  const [draftName, setDraftName] = useState('');
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
    setDraftNickname(next.nickname || '');
    setDraftDescription(next.description || '');
    setDraftImageUrl(next.imageUrl || '');
    setDraftStandardRate(next.priceSummary?.standardSellingRate != null ? String(next.priceSummary.standardSellingRate) : '');
    setDraftWholesaleRate(next.priceSummary?.wholesaleRate != null ? String(next.priceSummary.wholesaleRate) : '');
    setDraftRetailRate(next.priceSummary?.retailRate != null ? String(next.priceSummary.retailRate) : '');
    setDraftBuyingRate(next.priceSummary?.standardBuyingRate != null ? String(next.priceSummary.standardBuyingRate) : '');
    setDraftWholesaleDefaultUom(next.wholesaleDefaultUom || '');
    setDraftRetailDefaultUom(next.retailDefaultUom || '');
    setDraftWarehouseStockQty(next.stockQty != null ? String(next.stockQty) : '');
  };

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

  const stockSummary = useMemo(
    () => [
      { label: '总库存', value: `${detail?.totalQty ?? 0} ${formatDisplayUom(detail?.stockUom)}` },
      { label: '当前仓库', value: detail?.warehouse || '未指定' },
      { label: '单位', value: formatDisplayUom(detail?.stockUom) },
    ],
    [detail],
  );

  const handleSave = async () => {
    if (!detail) {
      return;
    }

    try {
      setIsSaving(true);
      const saved = await saveProductBasicInfo({
        itemCode: detail.itemCode,
        itemName: draftName.trim() || detail.itemName,
        nickname: draftNickname.trim() || undefined,
        description: draftDescription.trim() || undefined,
        imageUrl: draftImageUrl.trim() || undefined,
        standardRate: toNumberOrNull(draftStandardRate),
        wholesaleRate: toNumberOrNull(draftWholesaleRate),
        retailRate: toNumberOrNull(draftRetailRate),
        standardBuyingRate: toNumberOrNull(draftBuyingRate),
        wholesaleDefaultUom: draftWholesaleDefaultUom.trim() || undefined,
        retailDefaultUom: draftRetailDefaultUom.trim() || undefined,
        warehouse: detail.warehouse || undefined,
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
          </View>
        </View>

        {isLoading ? (
          <View style={[styles.sectionCard, { backgroundColor: surface, borderColor }]}>
            <ActivityIndicator />
          </View>
        ) : null}

        {detail ? (
          <>
            <View style={styles.metricRow}>
              {stockSummary.map((summaryItem) => (
                <View key={summaryItem.label} style={[styles.metricCard, { backgroundColor: surfaceMuted }]}>
                  <ThemedText style={styles.metricLabel}>{summaryItem.label}</ThemedText>
                  <ThemedText style={styles.metricValue} type="defaultSemiBold">
                    {summaryItem.value}
                  </ThemedText>
                </View>
              ))}
            </View>

            <View style={[styles.sectionCard, { backgroundColor: surface, borderColor }]}>
              <View style={styles.sectionHeader}>
                <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
                  多价格体系
                </ThemedText>
                <Pressable
                  disabled={isToggling}
                  onPress={() => void handleToggleStatus()}
                  style={[styles.inlineAction, { borderColor: detail.disabled ? success : danger }]}>
                  <ThemedText style={{ color: detail.disabled ? success : danger }} type="defaultSemiBold">
                    {detail.disabled ? '重新启用' : '停用商品'}
                  </ThemedText>
                </Pressable>
              </View>
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
                  <ThemedText style={styles.priceMeta}>默认单位 {formatDisplayUom(detail.wholesaleDefaultUom)}</ThemedText>
                </View>
                <View style={[styles.priceCard, { backgroundColor: surfaceMuted }]}>
                  <ThemedText style={styles.priceLabel}>零售价</ThemedText>
                  <ThemedText style={styles.priceValue} type="defaultSemiBold">
                    {formatMoney(detail.priceSummary?.retailRate)}
                  </ThemedText>
                  <ThemedText style={styles.priceMeta}>默认单位 {formatDisplayUom(detail.retailDefaultUom)}</ThemedText>
                </View>
                <View style={[styles.priceCard, { backgroundColor: surfaceMuted }]}>
                  <ThemedText style={styles.priceLabel}>采购价</ThemedText>
                  <ThemedText style={styles.priceValue} type="defaultSemiBold">
                    {formatMoney(detail.priceSummary?.standardBuyingRate)}
                  </ThemedText>
                </View>
              </View>
            </View>

            <View style={[styles.sectionCard, { backgroundColor: surface, borderColor }]}>
              <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
                库存分布
              </ThemedText>
              <View style={styles.stockList}>
                {detail.warehouseStockDetails.map((stockItem) => (
                  <View key={stockItem.warehouse} style={styles.stockRow}>
                    <View style={styles.stockRowMain}>
                      <ThemedText numberOfLines={1} type="defaultSemiBold">
                        {stockItem.warehouse}
                      </ThemedText>
                      <ThemedText style={styles.stockMeta}>{stockItem.company || '未指定公司'}</ThemedText>
                    </View>
                    <ThemedText style={[styles.stockQty, { color: tintColor }]} type="defaultSemiBold">
                      {stockItem.qty} {formatDisplayUom(detail.stockUom)}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </View>

            <View style={[styles.sectionCard, { backgroundColor: surface, borderColor }]}>
              <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
                基础资料
              </ThemedText>
              {isEditing ? (
                <View style={styles.formBlock}>
                  <DetailField label="商品名称" onChangeText={setDraftName} placeholder="输入商品名称" value={draftName} />
                  <DetailField label="商品昵称" onChangeText={setDraftNickname} placeholder="输入商品昵称" value={draftNickname} />
                  <DetailField label="图片地址" onChangeText={setDraftImageUrl} placeholder="输入商品图片 URL" value={draftImageUrl} />
                  <DetailField label="描述" multiline onChangeText={setDraftDescription} placeholder="输入商品说明" value={draftDescription} />
                  <View style={styles.rowFields}>
                    <View style={styles.rowField}>
                      <DetailField
                        label="批发默认单位"
                        onChangeText={setDraftWholesaleDefaultUom}
                        placeholder="例如 Box"
                        value={draftWholesaleDefaultUom}
                      />
                    </View>
                    <View style={styles.rowField}>
                      <DetailField
                        label="零售默认单位"
                        onChangeText={setDraftRetailDefaultUom}
                        placeholder="例如 Nos"
                        value={draftRetailDefaultUom}
                      />
                    </View>
                  </View>
                  <View style={styles.rowFields}>
                    <View style={styles.rowField}>
                      <DetailField
                        label={`当前仓库库存${detail.warehouse ? `（${detail.warehouse}）` : ''}`}
                        onChangeText={setDraftWarehouseStockQty}
                        placeholder="输入当前仓库库存"
                        value={draftWarehouseStockQty}
                      />
                    </View>
                    <View style={styles.rowField}>
                      <View style={styles.fieldBlock}>
                        <ThemedText style={styles.fieldLabel} type="defaultSemiBold">
                          库存单位
                        </ThemedText>
                        <View style={[styles.staticField, { backgroundColor: surfaceMuted, borderColor }]}>
                          <ThemedText type="defaultSemiBold">{formatDisplayUom(detail.stockUom)}</ThemedText>
                        </View>
                      </View>
                    </View>
                  </View>
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
                    <ThemedText style={styles.readOnlyLabel}>描述</ThemedText>
                    <ThemedText style={styles.readOnlyValue} type="defaultSemiBold">
                      {detail.description || '暂无描述'}
                    </ThemedText>
                  </View>
                </View>
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
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
  metricRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    borderRadius: 18,
    flex: 1,
    gap: 6,
    minHeight: 78,
    padding: 14,
  },
  metricLabel: {
    opacity: 0.62,
  },
  metricValue: {
    fontSize: 16,
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
  sectionTitle: {
    fontSize: 18,
  },
  inlineAction: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 12,
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
  stockList: {
    gap: 12,
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
});
