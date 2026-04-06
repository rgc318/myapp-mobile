import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { BarcodeScannerSheet } from '@/components/barcode-scanner-sheet';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { formatDisplayUom } from '@/lib/display-uom';
import { useFeedback } from '@/providers/feedback-provider';
import { searchCatalogProducts } from '@/services/products';
import { fetchProducts, type ProductListItem } from '@/services/products';

function formatPriceLine(value: number | null | undefined, uom?: string | null) {
  const price = typeof value === 'number' ? `¥ ${value.toFixed(2)}` : '未配置';
  return `${price}${uom ? ` / ${formatDisplayUom(uom)}` : ''}`;
}

function formatQty(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '0';
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}

function HeroStat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <View style={[styles.heroStatCard, { borderColor: `${accent}33`, backgroundColor: `${accent}12` }]}>
      <ThemedText style={styles.heroStatLabel}>{label}</ThemedText>
      <ThemedText style={[styles.heroStatValue, { color: accent }]} type="defaultSemiBold">
        {value}
      </ThemedText>
    </View>
  );
}

function ProductCard({ item, onOpen }: { item: ProductListItem; onOpen: (code: string) => void }) {
  const surface = useThemeColor({}, 'surface');
  const borderColor = useThemeColor({}, 'border');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const tintColor = useThemeColor({}, 'tint');
  const success = useThemeColor({}, 'success');
  const danger = useThemeColor({}, 'danger');

  const shortCode = item.itemCode.length > 22 ? `${item.itemCode.slice(0, 22)}...` : item.itemCode;
  const stockUnit = formatDisplayUom(item.stockUom);
  const warehouseCount = item.warehouseStockDetails.length || 0;
  const primaryTitle = item.itemName || item.itemCode;
  const nicknameText = item.nickname?.trim() || '';
  const specificationText = item.specification?.trim() || '';

  return (
    <Pressable onPress={() => onOpen(item.itemCode)} style={[styles.card, { backgroundColor: surface, borderColor }]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleWrap}>
          <ThemedText numberOfLines={2} style={styles.cardTitle} type="defaultSemiBold">
            {primaryTitle}
          </ThemedText>
          {nicknameText || specificationText ? (
            <ThemedText numberOfLines={1} style={styles.cardSubtitle}>
              {nicknameText ? (
                <ThemedText style={styles.cardNicknameText} type="default">
                  昵称 {nicknameText}
                </ThemedText>
              ) : null}
              {nicknameText && specificationText ? (
                <ThemedText style={styles.cardSubtitleDivider} type="default">
                  {' · '}
                </ThemedText>
              ) : null}
              {specificationText ? (
                <ThemedText style={styles.cardSpecificationText} type="defaultSemiBold">
                  规格 {specificationText}
                </ThemedText>
              ) : null}
            </ThemedText>
          ) : null}
          <ThemedText numberOfLines={1} style={styles.cardMeta}>
            商品编码: {shortCode}
          </ThemedText>
        </View>
        <View
          style={[
            styles.statusChip,
            { backgroundColor: item.disabled ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)' },
          ]}>
          <ThemedText
            style={[styles.statusChipText, { color: item.disabled ? danger : success }]}
            type="defaultSemiBold">
            {item.disabled ? '已停用' : '启用中'}
          </ThemedText>
        </View>
      </View>

      <View style={styles.tagRow}>
        <ThemedText style={styles.tagLabel}>分类</ThemedText>
        <View style={[styles.tag, { backgroundColor: surfaceMuted }]}>
          <ThemedText style={[styles.tagText, { color: tintColor }]} type="defaultSemiBold">
            {item.itemGroup || '未分组'}
          </ThemedText>
        </View>
        <ThemedText style={styles.tagLabel}>单位</ThemedText>
        <View style={[styles.tag, { backgroundColor: 'rgba(251,146,60,0.14)' }]}>
          <ThemedText style={[styles.tagText, { color: '#C2410C' }]} type="defaultSemiBold">
            {stockUnit}
          </ThemedText>
        </View>
      </View>

      <View style={[styles.infoPanel, { backgroundColor: surfaceMuted }]}>
        <View style={styles.infoRow}>
          <ThemedText style={styles.infoLabel}>批发价</ThemedText>
          <ThemedText numberOfLines={1} style={styles.infoValue} type="defaultSemiBold">
            {formatPriceLine(item.priceSummary?.wholesaleRate, item.wholesaleDefaultUom)}
          </ThemedText>
        </View>
        <View style={styles.infoRow}>
          <ThemedText style={styles.infoLabel}>零售价</ThemedText>
          <ThemedText numberOfLines={1} style={styles.infoValue} type="defaultSemiBold">
            {formatPriceLine(item.priceSummary?.retailRate, item.retailDefaultUom)}
          </ThemedText>
        </View>
        <View style={styles.infoRow}>
          <ThemedText style={styles.infoLabel}>总库存</ThemedText>
          <ThemedText numberOfLines={1} style={styles.infoValue} type="defaultSemiBold">
            {formatQty(item.totalQty ?? item.stockQty ?? 0)} {stockUnit}
          </ThemedText>
        </View>
        <View style={styles.infoRow}>
          <ThemedText style={styles.infoLabel}>库存分布</ThemedText>
          <ThemedText numberOfLines={1} style={styles.infoValue} type="defaultSemiBold">
            {warehouseCount} 个仓库
          </ThemedText>
        </View>
        <View style={styles.infoRow}>
          <ThemedText style={styles.infoLabel}>最近更新</ThemedText>
          <ThemedText numberOfLines={1} style={styles.infoValue} type="defaultSemiBold">
            {item.modified ? item.modified.slice(0, 10) : '—'}
          </ThemedText>
        </View>
      </View>
    </Pressable>
  );
}

export default function ProductsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ query?: string }>();
  const { showError } = useFeedback();
  const [query, setQuery] = useState(typeof params.query === 'string' ? params.query : '');
  const deferredQuery = useDeferredValue(query);
  const [disabledFilter, setDisabledFilter] = useState<number | null>(0);
  const [items, setItems] = useState<ProductListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [pendingScannedBarcode, setPendingScannedBarcode] = useState('');
  const [matchedScannedBarcode, setMatchedScannedBarcode] = useState('');
  const [matchedScannedCount, setMatchedScannedCount] = useState(0);

  const surface = useThemeColor({}, 'surface');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');

  const loadItems = useCallback(
    async (refresh = false) => {
      try {
        if (refresh) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }
        const nextItems = await fetchProducts({
          searchKey: deferredQuery.trim() || undefined,
          disabled: disabledFilter,
        });
        setItems(nextItems);
      } catch (error) {
        showError(error instanceof Error ? error.message : '加载商品失败');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [deferredQuery, disabledFilter, showError],
  );

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const handleBarcodeMatched = async (scannedValue: string) => {
    const normalized = scannedValue.trim();
    if (!normalized) {
      return;
    }

    setShowScanner(false);

    try {
      const matchedItems = await searchCatalogProducts(normalized, {
        limit: 20,
      });

      if (!matchedItems.length) {
        setPendingScannedBarcode(normalized);
        return;
      }

      const exactMatchedItems = matchedItems.filter(
        (item) => item.barcode?.trim() === normalized || item.itemCode?.trim() === normalized,
      );
      const targetItem =
        exactMatchedItems.length === 1 ? exactMatchedItems[0] : matchedItems.length === 1 ? matchedItems[0] : null;

      setQuery(normalized);
      setMatchedScannedBarcode(normalized);
      setMatchedScannedCount(targetItem ? 1 : matchedItems.length);
    } catch (error) {
      showError(error instanceof Error ? error.message : '扫码搜索商品失败');
    }
  };

  const summary = useMemo(
    () => ({
      totalStock: items.reduce((sum, item) => sum + (item.totalQty ?? 0), 0),
      activeCount: items.filter((item) => !item.disabled).length,
      disabledCount: items.filter((item) => item.disabled).length,
    }),
    [items],
  );

  return (
    <AppShell compactHeader contentCard={false} description="维护商品基础资料、价格体系、默认单位和库存分布。" title="商品管理">
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl onRefresh={() => void loadItems(true)} refreshing={isRefreshing} />}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.heroCard, { backgroundColor: surface, borderColor }]}>
          <View style={styles.heroGlowBlue} />
          <View style={styles.heroGlowAmber} />
          <View style={styles.heroTopRow}>
            <View style={styles.heroCopy}>
              <ThemedText style={styles.heroEyebrow}>PRODUCT HUB</ThemedText>
              <ThemedText style={styles.heroTitle} type="title">
                商品中心
              </ThemedText>
              <ThemedText style={styles.heroDescription}>
                统一维护商品资料、价格与库存口径，让销售、采购和盘点数据保持一致。
              </ThemedText>
            </View>
            <Pressable onPress={() => router.push('/common/product/create')} style={[styles.primaryCta, { backgroundColor: tintColor }]}>
              <IconSymbol color="#FFFFFF" name="tray.full.fill" size={16} />
              <ThemedText style={styles.primaryCtaText} type="defaultSemiBold">
                新增商品
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.heroStatsRow}>
            <HeroStat accent="#2563EB" label="当前条目" value={`${items.length}`} />
            <HeroStat accent="#16A34A" label="启用中" value={`${summary.activeCount}`} />
            <HeroStat accent="#EA580C" label="总库存" value={formatQty(summary.totalStock)} />
          </View>
        </View>

        <View style={[styles.filterCard, { backgroundColor: surface, borderColor }]}>
          <View style={styles.filterHeader}>
            <View>
              <ThemedText style={styles.filterTitle} type="defaultSemiBold">
                检索与筛选
              </ThemedText>
              <ThemedText style={styles.filterHint}>支持按商品名称、编码、昵称和规格快速定位。</ThemedText>
            </View>
            <Pressable
              onPress={() => {
                setQuery('');
                setDisabledFilter(0);
              }}
              style={[styles.resetButton, { backgroundColor: surfaceMuted }]}>
              <ThemedText style={{ color: tintColor }} type="defaultSemiBold">
                清空
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.searchRow}>
            <View style={[styles.searchBar, styles.searchBarExpanded, { backgroundColor: surfaceMuted, borderColor }]}>
              <IconSymbol color={tintColor} name="magnifyingglass" size={18} />
              <TextInput
                onChangeText={setQuery}
                placeholder="搜索商品名称、编码、昵称、规格"
                placeholderTextColor="rgba(31,42,55,0.42)"
                style={styles.searchInput}
                value={query}
              />
            </View>
            <Pressable onPress={() => setShowScanner(true)} style={[styles.scanEntryButton, { backgroundColor: surfaceMuted, borderColor }]}>
              <IconSymbol color={tintColor} name="barcode.viewfinder" size={18} />
              <ThemedText style={styles.scanEntryLabel} type="defaultSemiBold">
                扫码
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.segmentedWrap}>
            {[
              { label: '启用中', value: 0 as const },
              { label: '全部', value: null },
              { label: '已停用', value: 1 as const },
            ].map((option) => {
              const active = disabledFilter === option.value;
              return (
                <Pressable
                  key={option.label}
                  onPress={() => setDisabledFilter(option.value)}
                  style={[
                    styles.segmentedOption,
                    active
                      ? { backgroundColor: tintColor, borderColor: tintColor }
                      : { backgroundColor: surfaceMuted, borderColor },
                  ]}>
                  <ThemedText style={[styles.segmentedText, active ? styles.segmentedTextActive : null]} type="defaultSemiBold">
                    {option.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.listHeader}>
          <ThemedText style={styles.listTitle} type="defaultSemiBold">
            商品列表
          </ThemedText>
          <ThemedText style={styles.listMeta}>
            {items.length} 条结果 · 启用 {summary.activeCount} · 停用 {summary.disabledCount}
          </ThemedText>
        </View>

        {isLoading ? (
          <View style={[styles.emptyCard, { backgroundColor: surface, borderColor }]}>
            <ThemedText style={styles.emptyTitle} type="defaultSemiBold">
              正在加载商品列表
            </ThemedText>
            <ThemedText style={styles.emptyHint}>请稍候…</ThemedText>
          </View>
        ) : items.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: surface, borderColor }]}>
            <View style={styles.emptyIconWrap}>
              <IconSymbol color={tintColor} name="tray.full.fill" size={24} />
            </View>
            <ThemedText style={styles.emptyTitle} type="defaultSemiBold">
              当前没有匹配商品
            </ThemedText>
            <ThemedText style={styles.emptyHint}>可以调整筛选条件，或直接新建一条商品资料。</ThemedText>
          </View>
        ) : (
          <View style={styles.listWrap}>
            {items.map((item) => (
              <ProductCard
                item={item}
                key={item.itemCode}
                onOpen={(itemCode) => router.push({ pathname: '/common/product/[itemCode]', params: { itemCode } })}
              />
            ))}
          </View>
        )}

        <BarcodeScannerSheet
          description="将商品条码放入取景框内，扫到后会自动搜索；若未命中商品，会先提示你是否新建商品。"
          onClose={() => setShowScanner(false)}
          onScanned={handleBarcodeMatched}
          title="扫码搜索商品"
          visible={showScanner}
        />

        <Modal animationType="fade" onRequestClose={() => setPendingScannedBarcode('')} transparent visible={Boolean(pendingScannedBarcode)}>
          <View style={styles.centerDialogBackdrop}>
            <View style={[styles.centerDialogCard, { backgroundColor: surface, borderColor }]}>
              <View style={[styles.centerDialogIconWrap, { backgroundColor: surfaceMuted }]}>
                <IconSymbol color={tintColor} name="barcode.viewfinder" size={22} />
              </View>
              <ThemedText style={styles.centerDialogTitle} type="defaultSemiBold">
                未找到对应商品
              </ThemedText>
              <ThemedText style={styles.centerDialogText}>
                条码 {pendingScannedBarcode || '—'} 目前还没有对应商品资料。你可以继续新建商品，并自动带入这条码。
              </ThemedText>
              <View style={styles.centerDialogActions}>
                <Pressable
                  onPress={() => setPendingScannedBarcode('')}
                  style={[styles.centerDialogButton, { backgroundColor: surfaceMuted, borderColor }]}>
                  <ThemedText style={[styles.centerDialogButtonText, { color: '#475569' }]} type="defaultSemiBold">
                    先取消
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => {
                    const barcode = pendingScannedBarcode;
                    setPendingScannedBarcode('');
                    router.push({
                      pathname: '/common/product/create',
                      params: { barcode },
                    });
                  }}
                  style={[styles.centerDialogButton, { backgroundColor: tintColor, borderColor: tintColor }]}>
                  <ThemedText style={[styles.centerDialogButtonText, { color: '#FFFFFF' }]} type="defaultSemiBold">
                    去新建商品
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          animationType="fade"
          onRequestClose={() => {
            setMatchedScannedBarcode('');
            setMatchedScannedCount(0);
          }}
          transparent
          visible={Boolean(matchedScannedBarcode)}>
          <View style={styles.centerDialogBackdrop}>
            <View style={[styles.centerDialogCard, { backgroundColor: surface, borderColor }]}>
              <View style={[styles.centerDialogIconWrap, { backgroundColor: 'rgba(37,99,235,0.10)' }]}>
                <IconSymbol color={tintColor} name="checkmark.circle.fill" size={22} />
              </View>
              <ThemedText style={styles.centerDialogTitle} type="defaultSemiBold">
                已找到对应商品
              </ThemedText>
              <ThemedText style={styles.centerDialogText}>
                已按条码 {matchedScannedBarcode || '—'} 筛出
                {matchedScannedCount > 0 ? ` ${matchedScannedCount} ` : ' '}
                条商品结果，你可以直接在下方列表继续确认。
              </ThemedText>
              <View style={styles.centerDialogSingleAction}>
                <Pressable
                  onPress={() => {
                    setMatchedScannedBarcode('');
                    setMatchedScannedCount(0);
                  }}
                  style={[styles.centerDialogPrimaryButton, { backgroundColor: tintColor, borderColor: tintColor }]}>
                  <ThemedText style={[styles.centerDialogButtonText, { color: '#FFFFFF' }]} type="defaultSemiBold">
                    查看结果
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 14,
    paddingBottom: 32,
  },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 16,
    position: 'relative',
    gap: 14,
  },
  heroGlowBlue: {
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderRadius: 999,
    height: 200,
    position: 'absolute',
    right: -78,
    top: -66,
    width: 200,
  },
  heroGlowAmber: {
    backgroundColor: 'rgba(251,191,36,0.14)',
    borderRadius: 999,
    height: 128,
    left: -36,
    position: 'absolute',
    top: 108,
    width: 128,
  },
  heroTopRow: {
    gap: 14,
  },
  heroCopy: {
    gap: 4,
  },
  heroEyebrow: {
    color: '#2563EB',
    fontSize: 12,
    letterSpacing: 1.4,
  },
  heroTitle: {
    color: '#14213D',
    fontSize: 24,
    lineHeight: 28,
  },
  heroDescription: {
    color: '#5B6B81',
    fontSize: 15,
    lineHeight: 22,
    maxWidth: '94%',
  },
  primaryCta: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 0,
  },
  primaryCtaText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 18,
    includeFontPadding: false,
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  heroStatCard: {
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    minHeight: 74,
    padding: 12,
  },
  heroStatLabel: {
    color: '#6B7280',
    fontSize: 12,
  },
  heroStatValue: {
    fontSize: 18,
    lineHeight: 22,
  },
  filterCard: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  filterHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  filterTitle: {
    fontSize: 17,
  },
  filterHint: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 240,
  },
  resetButton: {
    borderRadius: 999,
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  searchBar: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 50,
    paddingHorizontal: 12,
  },
  searchBarExpanded: {
    flex: 1,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 10,
  },
  scanEntryButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 14,
  },
  scanEntryLabel: {
    fontSize: 13,
  },
  segmentedWrap: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentedOption: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 10,
  },
  segmentedText: {
    color: '#64748B',
    fontSize: 13,
  },
  segmentedTextActive: {
    color: '#FFFFFF',
  },
  listHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  listTitle: {
    fontSize: 18,
  },
  listMeta: {
    color: '#64748B',
    fontSize: 13,
  },
  listWrap: {
    gap: 10,
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  cardTitleWrap: {
    flex: 1,
    gap: 4,
    minWidth: 0,
    paddingRight: 8,
  },
  cardTitle: {
    fontSize: 24,
    lineHeight: 30,
  },
  cardSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  cardNicknameText: {
    color: '#526277',
  },
  cardSubtitleDivider: {
    color: '#94A3B8',
  },
  cardSpecificationText: {
    color: '#315EAF',
  },
  cardMeta: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 17,
  },
  statusChip: {
    flexShrink: 0,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusChipText: {
    fontSize: 11,
  },
  tagRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: -2,
  },
  tagLabel: {
    color: '#6B7280',
    fontSize: 11,
    lineHeight: 14,
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
  infoPanel: {
    borderRadius: 14,
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  infoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  infoLabel: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 16,
  },
  infoValue: {
    flex: 1,
    fontSize: 13,
    lineHeight: 17,
    textAlign: 'right',
  },
  emptyCard: {
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    gap: 10,
    padding: 24,
  },
  emptyIconWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderRadius: 18,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  emptyTitle: {
    fontSize: 18,
  },
  emptyHint: {
    color: '#64748B',
    textAlign: 'center',
  },
  centerDialogBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(15,23,42,0.36)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  centerDialogCard: {
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    maxWidth: 420,
    paddingHorizontal: 20,
    paddingVertical: 22,
    width: '100%',
  },
  centerDialogIconWrap: {
    alignItems: 'center',
    borderRadius: 18,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  centerDialogTitle: {
    fontSize: 20,
  },
  centerDialogText: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  centerDialogActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
    width: '100%',
  },
  centerDialogSingleAction: {
    marginTop: 4,
    width: '100%',
  },
  centerDialogButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 12,
  },
  centerDialogPrimaryButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 12,
    width: '100%',
  },
  centerDialogButtonText: {
    fontSize: 14,
  },
});
