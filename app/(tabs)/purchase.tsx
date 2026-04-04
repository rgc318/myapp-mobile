import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MobilePageHeader } from '@/components/mobile-page-header';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  WorkbenchHeroCard,
  WorkbenchQuickActionsCard,
  type WorkbenchMetricItem,
  WorkbenchSectionCard,
} from '@/components/workbench/workbench-shell';
import { WORKBENCH_SIZE } from '@/constants/workbench-size';
import { useThemeColor } from '@/hooks/use-theme-color';
import { normalizeAppError } from '@/lib/app-error';
import { getAppPreferences } from '@/lib/app-preferences';
import { useFeedback } from '@/providers/feedback-provider';
import {
  searchCompanies,
  searchPurchaseOrdersV2,
  type PurchaseDeskSearchSummary,
  type PurchaseOrderSummaryItem,
} from '@/services/purchases';
import type { LinkOption } from '@/services/master-data';

type FilterMode = 'all' | 'unfinished' | 'receiving' | 'paying' | 'completed' | 'cancelled';
type SortMode = 'unfinished_first' | 'latest' | 'oldest' | 'amount_desc';
type PickerMode = 'company' | 'filter' | 'sort' | null;
const PAGE_SIZE = 20;

const FILTER_OPTIONS: { value: FilterMode; label: string }[] = [
  { value: 'all', label: '全部订单' },
  { value: 'unfinished', label: '未完成' },
  { value: 'receiving', label: '待收货' },
  { value: 'paying', label: '待付款' },
  { value: 'completed', label: '已完成' },
  { value: 'cancelled', label: '已作废' },
];

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'unfinished_first', label: '未完成优先' },
  { value: 'latest', label: '最近更新' },
  { value: 'oldest', label: '最早下单' },
  { value: 'amount_desc', label: '金额从高到低' },
];

function formatMoney(value: number | null) {
  if (typeof value !== 'number') {
    return '—';
  }

  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 2,
  }).format(value);
}

function getWorkflowStatusLabel(row: PurchaseOrderSummaryItem) {
  if (row.documentStatus === 'cancelled') {
    return '已作废';
  }
  if (row.completionStatus === 'completed') {
    return '已完成';
  }
  if (row.paymentStatus === 'paid') {
    return '已结清';
  }
  if (row.receivingStatus === 'partial') {
    return '部分收货';
  }
  if (row.receivingStatus === 'completed') {
    return '待到票';
  }
  return '待收货';
}

function getStatusTone(row: PurchaseOrderSummaryItem) {
  if (row.documentStatus === 'cancelled') {
    return { backgroundColor: '#FEE2E2', color: '#B91C1C' };
  }
  if (row.completionStatus === 'completed' || row.paymentStatus === 'paid') {
    return { backgroundColor: '#DCFCE7', color: '#15803D' };
  }
  if (row.receivingStatus === 'partial') {
    return { backgroundColor: '#FEF3C7', color: '#B45309' };
  }
  return { backgroundColor: '#DBEAFE', color: '#1D4ED8' };
}

function getQuickActionLabel(row: PurchaseOrderSummaryItem) {
  if (row.documentStatus === 'cancelled') {
    return '查看详情';
  }
  if (row.completionStatus === 'completed') {
    return '查看订单';
  }
  if (row.receivingStatus === 'pending' || row.receivingStatus === 'partial') {
    return '继续收货';
  }
  if (row.paymentStatus === 'unpaid' || row.paymentStatus === 'partial') {
    return '查看付款入口';
  }
  return '查看订单';
}

function getSecondaryStatusLabel(row: PurchaseOrderSummaryItem) {
  if (row.documentStatus === 'cancelled') {
    return '已作废';
  }
  if (row.paymentStatus === 'partial') {
    return '部分付款';
  }
  if (row.paymentStatus === 'paid') {
    return '已付款';
  }
  if (row.receivingStatus === 'partial') {
    return '部分收货';
  }
  if (row.receivingStatus === 'completed' || row.receivingStatus === 'received') {
    return '已收货';
  }
  return row.outstandingAmount && row.outstandingAmount > 0 ? '未付款' : '待处理';
}

function getSecondaryStatusTone(row: PurchaseOrderSummaryItem) {
  if (row.documentStatus === 'cancelled') {
    return { backgroundColor: '#FEE2E2', color: '#B91C1C' };
  }
  if (row.paymentStatus === 'paid' || row.receivingStatus === 'completed' || row.receivingStatus === 'received') {
    return { backgroundColor: '#DCFCE7', color: '#15803D' };
  }
  if (row.paymentStatus === 'partial' || row.receivingStatus === 'partial') {
    return { backgroundColor: '#FEF3C7', color: '#B45309' };
  }
  return { backgroundColor: '#E2E8F0', color: '#475569' };
}

const EMPTY_DESK_SUMMARY: PurchaseDeskSearchSummary = {
  totalCount: 0,
  visibleCount: 0,
  unfinishedCount: 0,
  receivingCount: 0,
  paymentCount: 0,
  completedCount: 0,
  cancelledCount: 0,
};

export default function PurchaseTabScreen() {
  const router = useRouter();
  const preferences = getAppPreferences();
  const { showError } = useFeedback();
  const [searchInput, setSearchInput] = useState('');
  const [searchKey, setSearchKey] = useState('');
  const [queryCompany, setQueryCompany] = useState<string | null>(preferences.defaultCompany);
  const [filterMode, setFilterMode] = useState<FilterMode>('unfinished');
  const [sortMode, setSortMode] = useState<SortMode>('unfinished_first');
  const [summaries, setSummaries] = useState<PurchaseOrderSummaryItem[]>([]);
  const [deskSummary, setDeskSummary] = useState<PurchaseDeskSearchSummary>(EMPTY_DESK_SUMMARY);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [companyQuery, setCompanyQuery] = useState('');
  const [companyOptions, setCompanyOptions] = useState<LinkOption[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const hasMountedFiltersRef = useRef(false);

  const surface = useThemeColor({}, 'surface');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const background = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');
  const selectedCompany = queryCompany?.trim() || undefined;
  const hideCancelledByDefault = filterMode !== 'all' && filterMode !== 'cancelled';

  const loadSummaries = useCallback(async (options?: {
    nextSearchKey?: string;
    nextCompany?: string | null;
    nextFilterMode?: FilterMode;
    nextSortMode?: SortMode;
    start?: number;
    append?: boolean;
  }) => {
    const resolvedSearchKey = options?.nextSearchKey ?? searchKey;
    const resolvedCompany = options?.nextCompany === undefined ? selectedCompany : options.nextCompany?.trim() || undefined;
    const resolvedFilterMode = options?.nextFilterMode ?? filterMode;
    const resolvedSortMode = options?.nextSortMode ?? sortMode;
    const resolvedStart = options?.start ?? 0;
    const append = options?.append ?? false;
    const resolvedExcludeCancelled = resolvedFilterMode !== 'all' && resolvedFilterMode !== 'cancelled';

    try {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }

      const result = await searchPurchaseOrdersV2({
        searchKey: resolvedSearchKey,
        company: resolvedCompany,
        statusFilter: resolvedFilterMode,
        excludeCancelled: resolvedExcludeCancelled,
        sortBy: resolvedSortMode,
        limit: PAGE_SIZE,
        start: resolvedStart,
      });

      setSummaries((current) => {
        if (!append) {
          return result.items;
        }

        const seen = new Set(current.map((row) => row.name));
        const nextRows = result.items.filter((row) => !seen.has(row.name));
        return [...current, ...nextRows];
      });
      setDeskSummary(result.summary);
    } catch (error) {
      showError(normalizeAppError(error).message);
    } finally {
      if (append) {
        setIsLoadingMore(false);
      } else {
        setIsLoading(false);
      }
    }
  }, [filterMode, searchKey, selectedCompany, showError, sortMode]);

  useFocusEffect(
    useCallback(() => {
      void loadSummaries();
    }, [loadSummaries]),
  );

  useEffect(() => {
    if (!hasMountedFiltersRef.current) {
      hasMountedFiltersRef.current = true;
      return;
    }

    void loadSummaries();
  }, [filterMode, loadSummaries, queryCompany, sortMode]);

  useEffect(() => {
    if (pickerMode !== 'company') {
      return;
    }

    let cancelled = false;
    setIsLoadingCompanies(true);
    searchCompanies(companyQuery)
      .then((rows) => {
        if (!cancelled) {
          setCompanyOptions(rows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCompanyOptions([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingCompanies(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [companyQuery, pickerMode]);

  const filteredSummaries = summaries;
  const unfinishedCount = deskSummary.unfinishedCount;
  const receivingCount = deskSummary.receivingCount;
  const paymentCount = deskSummary.paymentCount;
  const completedCount = deskSummary.completedCount;

  const quickActions = [
    {
      label: '采购下单',
      icon: 'cart.fill' as const,
      toneBackground: '#EFF6FF',
      toneBorder: '#BFDBFE',
      toneText: '#1D4ED8',
      onPress: () => router.push('/purchase/order/create'),
    },
    {
      label: '采购收货',
      icon: 'shippingbox.fill' as const,
      toneBackground: '#F0FDF4',
      toneBorder: '#BBF7D0',
      toneText: '#15803D',
      onPress: () => router.push('/purchase/receipt/create'),
    },
    {
      label: '登记发票',
      icon: 'doc.text.fill' as const,
      toneBackground: '#FFF7ED',
      toneBorder: '#FED7AA',
      toneText: '#C2410C',
      onPress: () => router.push('/purchase/invoice/create'),
    },
    {
      label: '供应商付款',
      icon: 'creditcard.fill' as const,
      toneBackground: '#F5F3FF',
      toneBorder: '#DDD6FE',
      toneText: '#6D28D9',
      onPress: () => router.push('/purchase/payment/create'),
    },
  ];

  const activeFilterLabel = FILTER_OPTIONS.find((option) => option.value === filterMode)?.label ?? '全部订单';
  const activeSortLabel = SORT_OPTIONS.find((option) => option.value === sortMode)?.label ?? '未完成优先';
  const activeCompanyLabel = queryCompany || '全部公司';
  const hasActiveSearch = Boolean(searchKey.trim());
  const isCancelledHiddenByDefault = hideCancelledByDefault;
  const activeFilterChips = [
    activeFilterLabel,
    activeCompanyLabel !== '全部公司' ? activeCompanyLabel : null,
    activeSortLabel !== '未完成优先' ? activeSortLabel : null,
    hasActiveSearch ? `关键词：${searchKey}` : null,
  ].filter((value): value is string => Boolean(value));
  const visibleOrderCount = deskSummary.visibleCount || filteredSummaries.length;
  const totalScopedCount = deskSummary.totalCount || filteredSummaries.length;
  const hiddenCancelledCount = Math.max(0, deskSummary.cancelledCount);
  const resultDenominator = isCancelledHiddenByDefault && hiddenCancelledCount > 0
    ? visibleOrderCount + hiddenCancelledCount
    : totalScopedCount;
  const hasMoreResults = visibleOrderCount > filteredSummaries.length;
  const heroMetrics: WorkbenchMetricItem[] = [
    {
      key: 'unfinished',
      label: '未完成',
      value: unfinishedCount,
      textColor: '#B45309',
      backgroundColor: '#FFF5D6',
      borderColor: filterMode === 'unfinished' ? '#F59E0B' : '#FDE68A',
      active: filterMode === 'unfinished',
      onPress: () => setFilterMode('unfinished'),
    },
    {
      key: 'receiving',
      label: '待收货',
      value: receivingCount,
      textColor: '#1D4ED8',
      backgroundColor: '#E2EDFF',
      borderColor: filterMode === 'receiving' ? '#2563EB' : '#BFDBFE',
      active: filterMode === 'receiving',
      onPress: () => setFilterMode('receiving'),
    },
    {
      key: 'paying',
      label: '待付款',
      value: paymentCount,
      textColor: '#15803D',
      backgroundColor: '#DCFCE7',
      borderColor: filterMode === 'paying' ? '#16A34A' : '#BBF7D0',
      active: filterMode === 'paying',
      onPress: () => setFilterMode('paying'),
    },
    {
      key: 'completed',
      label: '已完成',
      value: completedCount,
      textColor: '#334155',
      backgroundColor: '#F1F5F9',
      borderColor: filterMode === 'completed' ? '#334155' : '#CBD5E1',
      active: filterMode === 'completed',
      onPress: () => setFilterMode('completed'),
    },
  ];
  const heroGlows = [
    { right: -20, top: -18, width: 148, height: 148, borderRadius: 999, backgroundColor: '#DBEAFE' },
    { left: -30, bottom: -48, width: 164, height: 164, borderRadius: 999, backgroundColor: '#FDE68A', opacity: 0.4 },
    {
      right: 88,
      bottom: 24,
      width: 92,
      height: 92,
      borderRadius: 28,
      backgroundColor: '#BFDBFE',
      opacity: 0.5,
      transform: [{ rotate: '-12deg' }],
    },
  ];

  const companyPickerOptions = useMemo(() => {
    const allOptions: LinkOption[] = [{ label: '全部公司', value: '__all__', description: '跨公司查看全部采购订单' }];
    const selectedOption =
      queryCompany && !companyOptions.some((option) => option.value === queryCompany)
        ? [{ label: queryCompany, value: queryCompany }]
        : [];

    return [...allOptions, ...selectedOption, ...companyOptions];
  }, [companyOptions, queryCompany]);

  function handleResetQuery() {
    setSearchInput('');
    setSearchKey('');
    setQueryCompany(preferences.defaultCompany);
    setFilterMode('unfinished');
    setSortMode('unfinished_first');
    void loadSummaries({
      nextSearchKey: '',
      nextCompany: preferences.defaultCompany,
      nextFilterMode: 'unfinished',
      nextSortMode: 'unfinished_first',
      start: 0,
    });
  }

  function handleApplySearch() {
    const nextSearchKey = searchInput.trim();
    setSearchKey(nextSearchKey);
    void loadSummaries({ nextSearchKey, start: 0 });
  }

  return (
    <SafeAreaView edges={[]} style={[styles.screen, { backgroundColor: background }]}>
      <MobilePageHeader title="采购" />

      <ScrollView contentContainerStyle={styles.container}>
        <WorkbenchHeroCard
          borderColor={borderColor}
          countText={`${deskSummary.visibleCount || filteredSummaries.length} 单`}
          description="自动载入采购订单，并优先把未完成订单排在前面。"
          eyebrow="PURCHASE DESK"
          glows={heroGlows}
          metrics={heroMetrics}
          title="采购工作台"
        />

        <WorkbenchQuickActionsCard
          actions={quickActions}
          backgroundColor={surface}
          borderColor={borderColor}
          hint="采购主流程入口"
          title="常用动作"
        />

        <WorkbenchSectionCard
          actionSlot={
            <View style={styles.headerActions}>
              <Pressable onPress={handleResetQuery} style={[styles.refreshButton, { backgroundColor: surfaceMuted }]}>
                <ThemedText style={[styles.refreshButtonText, { color: '#475569' }]} type="defaultSemiBold">
                  重置
                </ThemedText>
              </Pressable>
              <Pressable onPress={() => void loadSummaries()} style={[styles.refreshButton, { backgroundColor: surfaceMuted }]}>
                <ThemedText style={[styles.refreshButtonText, { color: tintColor }]} type="defaultSemiBold">
                  刷新
                </ThemedText>
              </Pressable>
            </View>
          }
          backgroundColor={surface}
          borderColor={borderColor}
          hint="采购检索"
          title="采购检索">

          <View style={styles.searchComposer}>
            <View style={styles.searchInputWrap}>
              <TextInput
                autoCorrect={false}
                onChangeText={setSearchInput}
                onSubmitEditing={handleApplySearch}
                placeholder="搜索订单号、供应商、公司、日期或状态"
                returnKeyType="search"
                style={[styles.searchInput, styles.searchInputWithClear, { backgroundColor: surfaceMuted, borderColor }]}
                value={searchInput}
              />
              {searchInput.trim().length ? (
                <Pressable
                  onPress={() => {
                    setSearchInput('');
                    setSearchKey('');
                    void loadSummaries({ nextSearchKey: '', start: 0 });
                  }}
                  style={styles.searchClearButton}>
                  <IconSymbol color="#94A3B8" name="xmark.circle.fill" size={18} />
                </Pressable>
              ) : null}
            </View>
            <Pressable
              onPress={handleApplySearch}
              style={[styles.searchButton, { backgroundColor: tintColor }]}>
              <IconSymbol color="#FFFFFF" name="magnifyingglass" size={15} />
              <ThemedText style={styles.searchButtonText} type="defaultSemiBold">
                搜索
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.activeChipRow}>
            {activeFilterChips.map((chip) => (
              <View key={chip} style={[styles.activeChip, { backgroundColor: surfaceMuted, borderColor }]}>
                <ThemedText style={styles.activeChipText} type="defaultSemiBold">
                  {chip}
                </ThemedText>
              </View>
            ))}
          </View>

          <View style={styles.queryMetaRow}>
            <Pressable
              onPress={() => setPickerMode('company')}
              style={[styles.selectCard, styles.filterSelectCard, { backgroundColor: '#EEF6FF', borderColor: '#BFDBFE' }]}>
              <View style={styles.selectCardTopRow}>
                <ThemedText style={[styles.selectLabel, styles.filterSelectLabel]}>查询公司</ThemedText>
                <IconSymbol color="#2563EB" name="chevron.right" size={14} />
              </View>
              <ThemedText style={[styles.selectValue, styles.filterSelectValue]} numberOfLines={1} type="defaultSemiBold">
                {activeCompanyLabel}
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setPickerMode('filter')}
              style={[styles.selectCard, styles.filterSelectCard, { backgroundColor: '#F7FCEB', borderColor: '#D9F99D' }]}>
              <View style={styles.selectCardTopRow}>
                <ThemedText style={[styles.selectLabel, styles.filterSelectLabel]}>订单状态</ThemedText>
                <IconSymbol color="#65A30D" name="chevron.right" size={14} />
              </View>
              <ThemedText style={[styles.selectValue, styles.filterSelectValue]} numberOfLines={1} type="defaultSemiBold">
                {activeFilterLabel}
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.queryMetaRow}>
            <Pressable
              onPress={() => setPickerMode('sort')}
              style={[styles.selectCard, styles.filterSelectCard, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}>
              <View style={styles.selectCardTopRow}>
                <ThemedText style={[styles.selectLabel, styles.filterSelectLabel]}>排序方式</ThemedText>
                <IconSymbol color="#EA580C" name="chevron.right" size={14} />
              </View>
              <ThemedText style={[styles.selectValue, styles.filterSelectValue]} numberOfLines={1} type="defaultSemiBold">
                {activeSortLabel}
              </ThemedText>
            </Pressable>
            <View style={[styles.resultSummaryStrip, { backgroundColor: '#F8FAFC', borderColor }]}>
              <ThemedText style={styles.queryMetaLabel}>当前结果</ThemedText>
              <View style={styles.resultSummaryMainRow}>
                <ThemedText style={styles.resultSummaryValue} type="defaultSemiBold">
                  {visibleOrderCount} / {resultDenominator}
                </ThemedText>
                <ThemedText style={styles.resultSummaryUnit} type="defaultSemiBold">
                  单
                </ThemedText>
              </View>
              <ThemedText style={styles.resultSummaryCaption}>
                {isCancelledHiddenByDefault && hiddenCancelledCount > 0 ? '当前结果 / 含已作废总数' : '当前结果 / 当前范围总数'}
              </ThemedText>
            </View>
          </View>
        </WorkbenchSectionCard>

        <WorkbenchSectionCard
          backgroundColor={surface}
          borderColor={borderColor}
          hint="默认按未完成优先排序"
          title="采购订单列表">

          {isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={tintColor} />
              <ThemedText>正在读取采购订单摘要...</ThemedText>
            </View>
          ) : filteredSummaries.length ? (
            <>
              <View style={styles.list}>
                {filteredSummaries.map((row) => (
                  <Pressable
                    key={row.name}
                    onPress={() =>
                      router.push({
                        pathname: '/purchase/order/[orderName]',
                        params: { orderName: row.name },
                      })
                    }
                    style={[styles.orderCard, { backgroundColor: surfaceMuted, borderColor }]}>
                    <View style={styles.orderTopRow}>
                      <View style={styles.orderTopCopy}>
                        <ThemedText style={styles.orderName} numberOfLines={1} type="defaultSemiBold">
                          {row.supplierName || row.supplier}
                        </ThemedText>
                        <View style={styles.orderMetaInlineRow}>
                          <ThemedText style={styles.orderCode}>{row.name}</ThemedText>
                          <ThemedText style={styles.orderMetaDot}>·</ThemedText>
                          <ThemedText style={styles.orderSubMeta}>{row.transactionDate || '未设置日期'}</ThemedText>
                        </View>
                      </View>
                      <View
                        style={[
                          styles.workflowBadge,
                          { backgroundColor: getStatusTone(row).backgroundColor },
                        ]}>
                        <ThemedText
                          style={[styles.workflowBadgeText, { color: getStatusTone(row).color }]}
                          type="defaultSemiBold">
                          {getWorkflowStatusLabel(row)}
                        </ThemedText>
                      </View>
                    </View>

                    <View style={styles.orderCompactMetaRow}>
                      <View style={[styles.orderMetaPill, { backgroundColor: '#EEF2FF' }]}>
                        <ThemedText style={styles.orderMetaPillText} numberOfLines={1}>
                          {row.company || '未设置公司'}
                        </ThemedText>
                      </View>
                      <View
                        style={[
                          styles.orderSecondaryBadge,
                          { backgroundColor: getSecondaryStatusTone(row).backgroundColor },
                        ]}>
                        <ThemedText
                          style={[styles.orderSecondaryBadgeText, { color: getSecondaryStatusTone(row).color }]}
                          type="defaultSemiBold">
                          {getSecondaryStatusLabel(row)}
                        </ThemedText>
                      </View>
                    </View>

                    <View style={styles.orderCompactFooterRow}>
                      <View style={styles.orderCompactDataRow}>
                        <View style={styles.orderCompactValueGroup}>
                          <ThemedText style={styles.orderCompactLabel}>订单金额</ThemedText>
                          <ThemedText style={styles.orderCompactValue} numberOfLines={1} type="defaultSemiBold">
                            {formatMoney(row.orderAmountEstimate)}
                          </ThemedText>
                        </View>
                        <View style={styles.orderCompactValueGroup}>
                          <ThemedText style={styles.orderCompactLabel}>未付金额</ThemedText>
                          <ThemedText
                            style={[
                              styles.orderCompactValue,
                              typeof row.outstandingAmount === 'number' && row.outstandingAmount > 0 ? styles.orderAmountEmphasis : null,
                            ]}
                            numberOfLines={1}
                            type="defaultSemiBold">
                            {formatMoney(row.outstandingAmount)}
                          </ThemedText>
                        </View>
                      </View>
                      <Pressable
                        onPress={(event) => {
                          event.stopPropagation();
                          if (row.receivingStatus === 'pending' || row.receivingStatus === 'partial') {
                            router.push({
                              pathname: '/purchase/receipt/create',
                              params: { orderName: row.name },
                            });
                            return;
                          }

                          router.push({
                            pathname: '/purchase/order/[orderName]',
                            params: { orderName: row.name },
                          });
                        }}
                        style={styles.orderActionButton}>
                        <ThemedText style={styles.orderActionButtonText} type="defaultSemiBold">
                          {getQuickActionLabel(row)}
                        </ThemedText>
                      </Pressable>
                    </View>
                  </Pressable>
                ))}
              </View>
              {hasMoreResults ? (
                <Pressable
                  onPress={() => void loadSummaries({ start: filteredSummaries.length, append: true })}
                  style={[styles.loadMoreButton, { backgroundColor: surfaceMuted, borderColor }]}
                  disabled={isLoadingMore}>
                  {isLoadingMore ? <ActivityIndicator color={tintColor} /> : null}
                  <ThemedText style={[styles.loadMoreButtonText, { color: tintColor }]} type="defaultSemiBold">
                    {isLoadingMore ? '正在加载更多...' : `加载更多 (${filteredSummaries.length}/${visibleOrderCount})`}
                  </ThemedText>
                </Pressable>
              ) : null}
            </>
          ) : (
              <View style={[styles.emptyCard, { backgroundColor: surfaceMuted }]}>
                <ThemedText type="defaultSemiBold">当前没有匹配的采购订单</ThemedText>
                <ThemedText>你可以调整筛选条件，或者直接新建采购订单。</ThemedText>
              </View>
            )}
        </WorkbenchSectionCard>
      </ScrollView>

      <Modal animationType="fade" transparent visible={pickerMode !== null} onRequestClose={() => setPickerMode(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPickerMode(null)}>
          <Pressable style={[styles.modalCard, { backgroundColor: surface }]} onPress={() => undefined}>
            <ThemedText style={styles.modalTitle} type="defaultSemiBold">
              {pickerMode === 'company'
                ? '选择查询公司'
                : pickerMode === 'filter'
                  ? '选择订单状态'
                  : '选择排序方式'}
            </ThemedText>

            {pickerMode === 'company' ? (
              <TextInput
                autoCorrect={false}
                onChangeText={setCompanyQuery}
                placeholder="搜索公司名称"
                style={[styles.modalSearchInput, { backgroundColor: surfaceMuted, borderColor }]}
                value={companyQuery}
              />
            ) : null}

            {(pickerMode === 'company' ? companyPickerOptions : pickerMode === 'filter' ? FILTER_OPTIONS : SORT_OPTIONS).map((option) => {
              const active =
                pickerMode === 'company'
                  ? (option.value === '__all__' ? queryCompany === null : option.value === queryCompany)
                  : pickerMode === 'filter'
                    ? option.value === filterMode
                    : option.value === sortMode;

              return (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    if (pickerMode === 'company') {
                      setQueryCompany(option.value === '__all__' ? null : String(option.value));
                      setCompanyQuery('');
                    } else if (pickerMode === 'filter') {
                      setFilterMode(option.value as FilterMode);
                    } else {
                      setSortMode(option.value as SortMode);
                    }
                    setPickerMode(null);
                  }}
                  style={[
                    styles.modalOption,
                    {
                      backgroundColor: active ? '#DBEAFE' : surfaceMuted,
                      borderColor: active ? '#93C5FD' : borderColor,
                    },
                  ]}>
                  <View style={styles.modalOptionCopy}>
                    <ThemedText
                      style={[styles.modalOptionText, { color: active ? '#1D4ED8' : '#334155' }]}
                      type="defaultSemiBold">
                      {option.label}
                    </ThemedText>
                    {'description' in option && option.description ? (
                      <ThemedText style={styles.modalOptionDescription}>{option.description}</ThemedText>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}

            {pickerMode === 'company' && !isLoadingCompanies && companyPickerOptions.length === 1 ? (
              <View style={[styles.emptyModalState, { backgroundColor: surfaceMuted }]}>
                <ThemedText>没有匹配的公司，可以换个关键词再试。</ThemedText>
              </View>
            ) : null}

            {pickerMode === 'company' && isLoadingCompanies ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator color={tintColor} />
                <ThemedText>正在读取公司列表...</ThemedText>
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    gap: WORKBENCH_SIZE.containerGap,
    paddingHorizontal: WORKBENCH_SIZE.containerPaddingHorizontal,
    paddingBottom: WORKBENCH_SIZE.containerPaddingBottom,
    paddingTop: WORKBENCH_SIZE.containerPaddingTop,
  },
  heroStage: {
    backgroundColor: '#F7FBFF',
    borderRadius: WORKBENCH_SIZE.heroRadius,
    borderWidth: 1,
    overflow: 'hidden',
    padding: WORKBENCH_SIZE.heroPadding,
    position: 'relative',
    gap: WORKBENCH_SIZE.heroGap,
  },
  heroGlowWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  heroGlowA: {
    position: 'absolute',
    right: -20,
    top: -18,
    width: 148,
    height: 148,
    borderRadius: 999,
    backgroundColor: '#DBEAFE',
  },
  heroGlowB: {
    position: 'absolute',
    left: -30,
    bottom: -48,
    width: 164,
    height: 164,
    borderRadius: 999,
    backgroundColor: '#FDE68A',
    opacity: 0.4,
  },
  heroGlowC: {
    position: 'absolute',
    right: 88,
    bottom: 24,
    width: 92,
    height: 92,
    borderRadius: 28,
    backgroundColor: '#BFDBFE',
    opacity: 0.5,
    transform: [{ rotate: '-12deg' }],
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroCopy: {
    flex: 1,
    gap: 8,
  },
  heroEyebrow: {
    color: '#2563EB',
    fontSize: WORKBENCH_SIZE.heroEyebrowFontSize,
    letterSpacing: WORKBENCH_SIZE.heroEyebrowLetterSpacing,
  },
  heroTitle: {
    fontSize: WORKBENCH_SIZE.heroTitleFontSize,
    lineHeight: WORKBENCH_SIZE.heroTitleLineHeight,
  },
  heroSubtitle: {
    color: '#475569',
    fontSize: WORKBENCH_SIZE.heroSubtitleFontSize,
    lineHeight: WORKBENCH_SIZE.heroSubtitleLineHeight,
    maxWidth: 420,
  },
  heroCountPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: WORKBENCH_SIZE.heroCountPillPaddingHorizontal,
    paddingVertical: WORKBENCH_SIZE.heroCountPillPaddingVertical,
  },
  heroCountText: {
    color: '#2563EB',
    fontSize: 13,
  },
  metricRow: {
    flexDirection: 'row',
    gap: WORKBENCH_SIZE.metricRowGap,
  },
  metricCard: {
    borderRadius: WORKBENCH_SIZE.metricCardRadius,
    flex: 1,
    gap: WORKBENCH_SIZE.metricCardGap,
    paddingHorizontal: WORKBENCH_SIZE.metricCardPaddingHorizontal,
    paddingVertical: WORKBENCH_SIZE.metricCardPaddingVertical,
    borderWidth: 1,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  metricPressable: {
    minHeight: WORKBENCH_SIZE.metricCardMinHeight,
  },
  metricLabel: {
    color: '#475569',
    fontSize: WORKBENCH_SIZE.metricLabelFontSize,
  },
  metricValue: {
    fontSize: WORKBENCH_SIZE.metricValueFontSize,
    lineHeight: WORKBENCH_SIZE.metricValueLineHeight,
  },
  quickActionsCard: {
    borderRadius: WORKBENCH_SIZE.sectionRadius,
    borderWidth: 1,
    padding: WORKBENCH_SIZE.sectionPadding,
    gap: WORKBENCH_SIZE.sectionGap,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  sectionTitle: {
    fontSize: WORKBENCH_SIZE.sectionTitleFontSize,
  },
  sectionHint: {
    color: '#64748B',
    flex: 1,
    fontSize: WORKBENCH_SIZE.sectionHintFontSize,
    textAlign: 'right',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: WORKBENCH_SIZE.actionGridGap,
    justifyContent: 'space-between',
  },
  actionCard: {
    alignItems: 'center',
    borderRadius: WORKBENCH_SIZE.actionCardRadius,
    borderWidth: 1,
    gap: 10,
    justifyContent: 'center',
    minHeight: WORKBENCH_SIZE.actionCardMinHeight,
    paddingHorizontal: WORKBENCH_SIZE.actionCardPaddingHorizontal,
    paddingVertical: WORKBENCH_SIZE.actionCardPaddingVertical,
    textDecorationLine: 'none',
    width: '31.5%',
  },
  actionLabel: {
    fontSize: WORKBENCH_SIZE.actionLabelFontSize,
    lineHeight: WORKBENCH_SIZE.actionLabelLineHeight,
    maxWidth: WORKBENCH_SIZE.actionLabelMaxWidth,
    textAlign: 'center',
  },
  panel: {
    borderRadius: WORKBENCH_SIZE.sectionRadius,
    borderWidth: 1,
    gap: WORKBENCH_SIZE.sectionGap,
    padding: WORKBENCH_SIZE.sectionPadding,
  },
  refreshButton: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  refreshButtonText: {
    fontSize: 13,
  },
  searchComposer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: WORKBENCH_SIZE.searchRowGap,
  },
  searchInputWrap: {
    flex: 1,
    justifyContent: 'center',
    position: 'relative',
  },
  searchInput: {
    borderRadius: WORKBENCH_SIZE.searchInputRadius,
    borderWidth: 1,
    fontSize: WORKBENCH_SIZE.searchInputFontSize,
    minHeight: WORKBENCH_SIZE.searchInputMinHeight,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  searchInputWithClear: {
    paddingRight: 42,
  },
  searchClearButton: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    position: 'absolute',
    right: 10,
    width: 28,
  },
  searchButton: {
    alignItems: 'center',
    borderRadius: WORKBENCH_SIZE.searchButtonRadius,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: WORKBENCH_SIZE.searchButtonMinHeight,
    minWidth: WORKBENCH_SIZE.searchButtonMinWidth,
    paddingHorizontal: WORKBENCH_SIZE.searchButtonPaddingHorizontal,
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: WORKBENCH_SIZE.searchButtonTextFontSize,
  },
  activeChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  activeChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  activeChipText: {
    color: '#334155',
    fontSize: 12,
  },
  queryMetaRow: {
    flexDirection: 'row',
    gap: 10,
  },
  queryMetaCard: {
    borderWidth: 1,
    borderRadius: 16,
    flex: 1,
    gap: 5,
    minHeight: 58,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  queryMetaLabel: {
    color: '#64748B',
    fontSize: 11,
  },
  queryMetaValue: {
    fontSize: 14,
  },
  queryMetaSubvalue: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 16,
  },
  selectCard: {
    borderRadius: WORKBENCH_SIZE.searchInputRadius,
    borderWidth: 1,
    flex: 1,
    gap: 5,
    minHeight: 58,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  selectCardTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  selectLabel: {
    color: '#64748B',
    fontSize: 11,
  },
  selectValue: {
    fontSize: 13,
  },
  filterSelectCard: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 1,
  },
  filterSelectLabel: {
    color: '#64748B',
  },
  filterSelectValue: {
    color: '#0F172A',
  },
  resultSummaryCard: {
    justifyContent: 'center',
  },
  resultSummaryStrip: {
    borderWidth: 1,
    borderRadius: WORKBENCH_SIZE.searchInputRadius,
    flex: 1,
    gap: 6,
    justifyContent: 'center',
    minHeight: 58,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  resultSummaryMainRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'flex-start',
  },
  resultSummaryValue: {
    color: '#0F172A',
    fontSize: 22,
    lineHeight: 26,
  },
  resultSummaryUnit: {
    color: '#64748B',
    fontSize: 12,
  },
  resultSummaryCaption: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 15,
  },
  resultBanner: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  resultBannerText: {
    color: '#475569',
    fontSize: 12,
    lineHeight: 17,
  },
  loadingWrap: {
    alignItems: 'center',
    gap: 10,
    minHeight: 140,
    justifyContent: 'center',
  },
  list: {
    gap: 10,
  },
  loadMoreButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 4,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  loadMoreButtonText: {
    fontSize: 13,
  },
  orderCard: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    position: 'relative',
    padding: 16,
    textDecorationLine: 'none',
  },
  orderTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  orderTopCopy: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  orderName: {
    fontSize: 18,
    lineHeight: 22,
  },
  orderMetaInlineRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  orderCode: {
    color: '#64748B',
    fontSize: 13,
  },
  orderMetaDot: {
    color: '#CBD5E1',
    fontSize: 12,
  },
  orderSubMeta: {
    color: '#94A3B8',
    fontSize: 12,
  },
  workflowBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  workflowBadgeText: {
    fontSize: 12,
  },
  orderCompactMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  orderMetaPill: {
    borderRadius: 999,
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  orderMetaPillText: {
    color: '#475569',
    fontSize: 12,
  },
  orderSecondaryBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  orderSecondaryBadgeText: {
    fontSize: 12,
  },
  orderCompactDataRow: {
    flexDirection: 'row',
    flex: 1,
    gap: 10,
  },
  orderCompactValueGroup: {
    flex: 1,
    gap: 4,
  },
  infoPairLabel: {
    color: '#94A3B8',
    fontSize: 11,
  },
  infoPairValue: {
    color: '#0F172A',
    fontSize: 14,
  },
  orderCompactLabel: {
    color: '#64748B',
    fontSize: 11,
  },
  orderCompactValue: {
    color: '#0F172A',
    fontSize: 18,
    lineHeight: 24,
    textAlign: 'left',
  },
  orderAmountEmphasis: {
    color: '#C2410C',
  },
  orderCompactFooterRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  orderActionButton: {
    backgroundColor: '#DBEAFE',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  orderActionButtonText: {
    color: '#1D4ED8',
    fontSize: 12,
  },
  emptyCard: {
    borderRadius: 18,
    gap: 8,
    padding: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    borderRadius: 22,
    gap: 10,
    padding: 18,
  },
  modalTitle: {
    fontSize: 18,
    marginBottom: 4,
  },
  modalSearchInput: {
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  modalOption: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  modalOptionCopy: {
    gap: 4,
  },
  modalOptionText: {
    fontSize: 14,
  },
  modalOptionDescription: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 17,
  },
  emptyModalState: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  modalLoading: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
});
