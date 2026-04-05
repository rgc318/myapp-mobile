import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { SALES_WORKBENCH_SIZE, WORKBENCH_SIZE } from '@/constants/workbench-size';
import { useThemeColor } from '@/hooks/use-theme-color';
import { normalizeAppError } from '@/lib/app-error';
import { getAppPreferences } from '@/lib/app-preferences';
import { formatCurrencyValue } from '@/lib/display-currency';
import { useFeedback } from '@/providers/feedback-provider';
import { type LinkOption } from '@/services/master-data';
import {
  searchCompanies,
  searchSalesOrdersV2,
  type SalesDeskSearchSummary,
  type SalesOrderSummaryItem,
} from '@/services/sales';

type FilterMode = 'all' | 'unfinished' | 'delivering' | 'paying' | 'completed' | 'cancelled';
type SortMode = 'time' | 'unfinished_first' | 'amount';
type SortDirection = 'asc' | 'desc';
type PickerMode = 'company' | 'filter' | 'sort' | null;

const PAGE_SIZE = 20;

const FILTER_OPTIONS: { value: FilterMode; label: string }[] = [
  { value: 'all', label: '有效订单' },
  { value: 'unfinished', label: '未完成' },
  { value: 'delivering', label: '待出货' },
  { value: 'paying', label: '待收款' },
  { value: 'completed', label: '已完成' },
  { value: 'cancelled', label: '已作废' },
];

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'time', label: '时间' },
  { value: 'amount', label: '金额' },
  { value: 'unfinished_first', label: '未完成优先' },
];

const EMPTY_DESK_SUMMARY: SalesDeskSearchSummary = {
  totalCount: 0,
  visibleCount: 0,
  unfinishedCount: 0,
  deliveryCount: 0,
  paymentCount: 0,
  completedCount: 0,
  cancelledCount: 0,
};

function orderStatusText(item: SalesOrderSummaryItem) {
  if (item.status === 'cancelled') {
    return '已作废';
  }
  if (item.completionStatus === 'completed') {
    return '已完成';
  }
  if (item.paymentStatus === 'paid') {
    return '已结清';
  }
  if (item.fulfillmentStatus === 'shipped') {
    return '待收款';
  }
  if (item.fulfillmentStatus === 'partial') {
    return '部分出货';
  }
  if (item.status === 'submitted' && item.fulfillmentStatus === 'pending') {
    return '待出货';
  }
  if (item.status === 'draft') {
    return '草稿';
  }
  return item.status === 'submitted' ? '已提交' : item.status || '未确认';
}

function getStatusTone(item: SalesOrderSummaryItem) {
  if (item.status === 'cancelled') {
    return { backgroundColor: '#FEE2E2', color: '#B91C1C' };
  }
  if (item.completionStatus === 'completed' || item.paymentStatus === 'paid') {
    return { backgroundColor: '#DCFCE7', color: '#15803D' };
  }
  if (item.fulfillmentStatus === 'partial' || item.paymentStatus === 'partial') {
    return { backgroundColor: '#FEF3C7', color: '#B45309' };
  }
  return { backgroundColor: '#DBEAFE', color: '#1D4ED8' };
}

function getSecondaryStatusLabel(item: SalesOrderSummaryItem) {
  if (item.status === 'cancelled') {
    return '已作废';
  }
  if (item.paymentStatus === 'partial') {
    return '部分收款';
  }
  if (item.paymentStatus === 'paid') {
    return '已收款';
  }
  if (item.fulfillmentStatus === 'partial') {
    return '部分出货';
  }
  if (item.fulfillmentStatus === 'shipped') {
    return '已出货';
  }
  return item.outstandingAmount && item.outstandingAmount > 0 ? '未收款' : '待处理';
}

function getSecondaryStatusTone(item: SalesOrderSummaryItem) {
  if (item.status === 'cancelled') {
    return { backgroundColor: '#FEE2E2', color: '#B91C1C' };
  }
  if (item.paymentStatus === 'paid' || item.fulfillmentStatus === 'shipped') {
    return { backgroundColor: '#DCFCE7', color: '#15803D' };
  }
  if (item.paymentStatus === 'partial' || item.fulfillmentStatus === 'partial') {
    return { backgroundColor: '#FEF3C7', color: '#B45309' };
  }
  return { backgroundColor: '#E2E8F0', color: '#475569' };
}

function getQuickActionLabel(item: SalesOrderSummaryItem) {
  if (item.status === 'cancelled') {
    return '查看订单';
  }
  if (item.completionStatus === 'completed') {
    return '查看订单';
  }
  if (item.fulfillmentStatus === 'pending' || item.fulfillmentStatus === 'partial') {
    return '去发货';
  }
  if (item.paymentStatus === 'unpaid' || item.paymentStatus === 'partial') {
    return '去收款';
  }
  return '查看订单';
}

export default function SalesTabScreen() {
  const router = useRouter();
  const preferences = getAppPreferences();
  const { showError } = useFeedback();

  const [searchInput, setSearchInput] = useState('');
  const [searchKey, setSearchKey] = useState('');
  const [orders, setOrders] = useState<SalesOrderSummaryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [queryCompany, setQueryCompany] = useState<string | null>(preferences.defaultCompany);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [sortMode, setSortMode] = useState<SortMode>('time');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [deskSummary, setDeskSummary] = useState<SalesDeskSearchSummary>(EMPTY_DESK_SUMMARY);
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
  const hideCancelledByDefault = filterMode !== 'cancelled';

  const loadOrders = useCallback(
    async (options?: {
      nextSearchKey?: string;
      nextCompany?: string | null;
      nextFilterMode?: FilterMode;
      nextSortMode?: SortMode;
      start?: number;
      append?: boolean;
    }) => {
      const resolvedSearchKey = options?.nextSearchKey ?? searchKey;
      const resolvedCompany =
        options?.nextCompany === undefined ? selectedCompany : options.nextCompany?.trim() || undefined;
      const resolvedFilterMode = options?.nextFilterMode ?? filterMode;
      const resolvedSortMode = options?.nextSortMode ?? sortMode;
      const resolvedSortDirection = sortDirection;
      const resolvedStart = options?.start ?? 0;
      const append = options?.append ?? false;
      const resolvedExcludeCancelled = resolvedFilterMode !== 'cancelled';
      const resolvedSortBy =
        resolvedSortMode === 'time'
          ? resolvedSortDirection === 'asc'
            ? 'oldest'
            : 'latest'
          : resolvedSortMode === 'amount'
            ? resolvedSortDirection === 'asc'
              ? 'amount_asc'
              : 'amount_desc'
            : 'unfinished_first';

      try {
        if (append) {
          setIsLoadingMore(true);
        } else {
          setIsLoading(true);
        }

        const result = await searchSalesOrdersV2({
          searchKey: resolvedSearchKey,
          company: resolvedCompany,
          statusFilter: resolvedFilterMode,
          excludeCancelled: resolvedExcludeCancelled,
          sortBy: resolvedSortBy,
          limit: PAGE_SIZE,
          start: resolvedStart,
        });

        setOrders((current) => {
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
    },
    [filterMode, searchKey, selectedCompany, showError, sortDirection, sortMode],
  );

  useFocusEffect(
    useCallback(() => {
      void loadOrders();
    }, [loadOrders]),
  );

  useEffect(() => {
    if (!hasMountedFiltersRef.current) {
      hasMountedFiltersRef.current = true;
      return;
    }
    void loadOrders();
  }, [filterMode, loadOrders, queryCompany, sortDirection, sortMode]);

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

  const quickActions = [
    {
      label: '销售下单',
      icon: 'cart.fill' as const,
      toneBackground: '#EFF6FF',
      toneBorder: '#BFDBFE',
      toneText: '#1D4ED8',
      onPress: () => router.push('/sales/order/create'),
    },
    {
      label: '销售发货',
      icon: 'shippingbox.fill' as const,
      toneBackground: '#F0FDF4',
      toneBorder: '#BBF7D0',
      toneText: '#15803D',
      onPress: () => router.push('/sales/delivery/create'),
    },
    {
      label: '销售开票',
      icon: 'doc.text.fill' as const,
      toneBackground: '#FFF7ED',
      toneBorder: '#FED7AA',
      toneText: '#C2410C',
      onPress: () => router.push('/sales/invoice/create'),
    },
    {
      label: '销售收款',
      icon: 'creditcard.fill' as const,
      toneBackground: '#F5F3FF',
      toneBorder: '#DDD6FE',
      toneText: '#6D28D9',
      onPress: () => router.push('/sales/payment/create'),
    },
  ];

  const activeFilterLabel = FILTER_OPTIONS.find((option) => option.value === filterMode)?.label ?? '有效订单';
  const activeSortLabel = SORT_OPTIONS.find((option) => option.value === sortMode)?.label ?? '时间';
  const activeDirectionLabel = sortDirection === 'asc' ? '升序' : '降序';
  const activeCompanyLabel = queryCompany || '全部公司';
  const hasActiveSearch = Boolean(searchKey.trim());
  const activeFilterChips = [
    activeFilterLabel !== '有效订单' ? activeFilterLabel : null,
    activeCompanyLabel !== '全部公司' ? activeCompanyLabel : null,
    `${activeSortLabel}${sortMode !== 'unfinished_first' ? ` · ${activeDirectionLabel}` : ''}`,
    hasActiveSearch ? `关键词：${searchKey}` : null,
  ].filter((value): value is string => Boolean(value));
  const visibleOrderCount = deskSummary.visibleCount || orders.length;
  const totalOrderCount = deskSummary.totalCount || visibleOrderCount;
  const heroMetrics: WorkbenchMetricItem[] = [
    {
      key: 'unfinished',
      label: '未完成',
      value: deskSummary.unfinishedCount,
      textColor: filterMode === 'unfinished' ? '#B45309' : '#1F2A37',
      backgroundColor: filterMode === 'unfinished' ? '#FFF5D6' : surfaceMuted,
      borderColor: filterMode === 'unfinished' ? '#F59E0B' : borderColor,
      active: filterMode === 'unfinished',
      onPress: () => setFilterMode('unfinished'),
    },
    {
      key: 'delivering',
      label: '待出货',
      value: deskSummary.deliveryCount,
      textColor: filterMode === 'delivering' ? '#1D4ED8' : '#1F2A37',
      backgroundColor: filterMode === 'delivering' ? '#E2EDFF' : surfaceMuted,
      borderColor: filterMode === 'delivering' ? '#2563EB' : borderColor,
      active: filterMode === 'delivering',
      onPress: () => setFilterMode('delivering'),
    },
    {
      key: 'paying',
      label: '待收款',
      value: deskSummary.paymentCount,
      textColor: filterMode === 'paying' ? '#15803D' : '#1F2A37',
      backgroundColor: filterMode === 'paying' ? '#DCFCE7' : surfaceMuted,
      borderColor: filterMode === 'paying' ? '#16A34A' : borderColor,
      active: filterMode === 'paying',
      onPress: () => setFilterMode('paying'),
    },
    {
      key: 'completed',
      label: '已完成',
      value: deskSummary.completedCount,
      textColor: filterMode === 'completed' ? '#334155' : '#1F2A37',
      backgroundColor: filterMode === 'completed' ? '#F1F5F9' : surfaceMuted,
      borderColor: filterMode === 'completed' ? '#334155' : borderColor,
      active: filterMode === 'completed',
      onPress: () => setFilterMode('completed'),
    },
  ];
  const heroGlows = [
    {
      right: SALES_WORKBENCH_SIZE.heroGlowA.right,
      top: SALES_WORKBENCH_SIZE.heroGlowA.top,
      width: SALES_WORKBENCH_SIZE.heroGlowA.width,
      height: SALES_WORKBENCH_SIZE.heroGlowA.height,
      borderRadius: SALES_WORKBENCH_SIZE.heroGlowA.radius,
      backgroundColor: '#DBEAFE',
    },
    {
      left: SALES_WORKBENCH_SIZE.heroGlowB.left,
      bottom: SALES_WORKBENCH_SIZE.heroGlowB.bottom,
      width: SALES_WORKBENCH_SIZE.heroGlowB.width,
      height: SALES_WORKBENCH_SIZE.heroGlowB.height,
      borderRadius: SALES_WORKBENCH_SIZE.heroGlowB.radius,
      backgroundColor: '#FED7AA',
      opacity: SALES_WORKBENCH_SIZE.heroGlowB.opacity,
    },
    {
      right: SALES_WORKBENCH_SIZE.heroGlowC.right,
      bottom: SALES_WORKBENCH_SIZE.heroGlowC.bottom,
      width: SALES_WORKBENCH_SIZE.heroGlowC.width,
      height: SALES_WORKBENCH_SIZE.heroGlowC.height,
      borderRadius: SALES_WORKBENCH_SIZE.heroGlowC.radius,
      backgroundColor: '#CFFAFE',
      opacity: SALES_WORKBENCH_SIZE.heroGlowC.opacity,
      transform: [{ rotate: '-12deg' }],
    },
  ];

  const handleSearch = async () => {
    const trimmedKeyword = searchInput.trim();
    setSearchKey(trimmedKeyword);
    await loadOrders({ nextSearchKey: trimmedKeyword });
  };

  const handleClearSearch = async () => {
    setSearchInput('');
    setSearchKey('');
    await loadOrders({ nextSearchKey: '' });
  };

  const handleResetOrders = async () => {
    setSearchInput('');
    setSearchKey('');
    setQueryCompany(preferences.defaultCompany);
    setFilterMode('all');
    setSortMode('time');
    setSortDirection('desc');
    await loadOrders({
      nextSearchKey: '',
      nextCompany: preferences.defaultCompany,
      nextFilterMode: 'all',
      nextSortMode: 'time',
    });
  };

  const handleLoadMoreOrders = async () => {
    if (isLoadingMore || orders.length >= visibleOrderCount) {
      return;
    }
    await loadOrders({ start: orders.length, append: true });
  };

  const openOrderPrimaryAction = (order: SalesOrderSummaryItem) => {
    router.push(`/sales/order/${order.name}`);
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: background }]}>
      <MobilePageHeader showBack={false} title="销售工作台" />
      <ScrollView contentContainerStyle={styles.container}>
        <>
          <WorkbenchHeroCard
            borderColor={borderColor}
            countText={`${totalOrderCount} 单`}
            description="默认聚焦未完成销售订单，并优先把待出货与待收款单据排在前面。"
            eyebrow="SALES DESK"
            glows={heroGlows}
            metrics={heroMetrics}
            title="销售工作台"
          />

          <WorkbenchQuickActionsCard
            actions={quickActions}
            backgroundColor={surface}
            borderColor={borderColor}
            hint="销售主流程入口"
            title="常用动作"
          />

          <WorkbenchSectionCard
            actionSlot={
              <View style={styles.headerActions}>
                <Pressable onPress={() => void handleResetOrders()} style={[styles.headerActionButton, { backgroundColor: surfaceMuted }]}>
                  <ThemedText style={styles.headerActionText} type="defaultSemiBold">
                    重置
                  </ThemedText>
                </Pressable>
                <Pressable onPress={() => void loadOrders()} style={[styles.headerActionButton, { backgroundColor: surfaceMuted }]}>
                  <ThemedText style={[styles.headerActionText, { color: tintColor }]} type="defaultSemiBold">
                    刷新
                  </ThemedText>
                </Pressable>
              </View>
            }
            backgroundColor={surface}
            borderColor={borderColor}
            hint="销售检索"
            title="销售检索">

            <View style={styles.searchRow}>
              <View style={[styles.searchInputWrap, { backgroundColor: surfaceMuted, borderColor }]}>
                <TextInput
                  autoCorrect={false}
                  onChangeText={setSearchInput}
                  onSubmitEditing={() => void handleSearch()}
                  placeholder="搜索订单号、客户、公司、日期"
                  placeholderTextColor="rgba(31,42,55,0.45)"
                  style={styles.searchInput}
                  value={searchInput}
                />
                {searchInput.trim() ? (
                  <Pressable onPress={() => void handleClearSearch()} style={styles.clearButton}>
                    <IconSymbol color="#94A3B8" name="xmark.circle.fill" size={18} />
                  </Pressable>
                ) : null}
              </View>
              <Pressable onPress={() => void handleSearch()} style={[styles.searchButton, { backgroundColor: tintColor }]}>
                <IconSymbol color="#FFFFFF" name="magnifyingglass" size={15} />
                <ThemedText style={styles.searchButtonText} type="defaultSemiBold">
                  搜索
                </ThemedText>
              </Pressable>
            </View>

            {activeFilterChips.length ? (
              <View style={styles.filterChipsWrap}>
                {activeFilterChips.map((chip) => (
                  <View key={chip} style={[styles.filterChip, { backgroundColor: surfaceMuted, borderColor }]}>
                    <ThemedText style={styles.filterChipText} type="defaultSemiBold">
                      {chip}
                    </ThemedText>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.compactFilterRow}>
              <Pressable onPress={() => setPickerMode('company')} style={[styles.compactFilterChip, { backgroundColor: '#EEF6FF', borderColor: '#BFDBFE' }]}>
                <ThemedText style={styles.compactFilterLabel}>公司</ThemedText>
                <View style={styles.compactFilterValueRow}>
                  <ThemedText style={styles.compactFilterValue} numberOfLines={1} type="defaultSemiBold">
                    {activeCompanyLabel}
                  </ThemedText>
                  <IconSymbol color="#2563EB" name="chevron.right" size={13} />
                </View>
              </Pressable>

              <Pressable onPress={() => setPickerMode('filter')} style={[styles.compactFilterChip, { backgroundColor: '#F7FCEB', borderColor: '#D9F99D' }]}>
                <ThemedText style={styles.compactFilterLabel}>状态</ThemedText>
                <View style={styles.compactFilterValueRow}>
                  <ThemedText style={styles.compactFilterValue} type="defaultSemiBold">
                    {activeFilterLabel}
                  </ThemedText>
                  <IconSymbol color="#65A30D" name="chevron.right" size={13} />
                </View>
              </Pressable>

              <Pressable onPress={() => setPickerMode('sort')} style={[styles.compactFilterChip, { backgroundColor: '#FFF7ED', borderColor: '#FDBA74' }]}>
                <ThemedText style={styles.compactFilterLabel}>排序</ThemedText>
                <View style={styles.compactFilterValueRow}>
                  <ThemedText style={styles.compactFilterValue} type="defaultSemiBold">
                    {activeSortLabel}
                  </ThemedText>
                  <IconSymbol color="#EA580C" name="chevron.right" size={13} />
                </View>
              </Pressable>

              <Pressable
                disabled={sortMode === 'unfinished_first'}
                onPress={() => setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))}
                style={[
                  styles.compactFilterChip,
                  { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' },
                  sortMode === 'unfinished_first' ? styles.selectCardDisabled : null,
                ]}>
                <ThemedText style={styles.compactFilterLabel}>方向</ThemedText>
                <View style={styles.compactFilterValueRow}>
                  <ThemedText style={styles.compactFilterValue} type="defaultSemiBold">
                    {sortMode === 'unfinished_first' ? '固定' : activeDirectionLabel}
                  </ThemedText>
                  <IconSymbol color="#7C3AED" name={sortDirection === 'asc' ? 'arrow.up' : 'arrow.down'} size={13} />
                </View>
              </Pressable>
            </View>

            <View style={[styles.compactSummaryBar, { backgroundColor: '#F8FAFC', borderColor }]}>
              <View style={styles.compactSummaryCopy}>
                <ThemedText style={styles.compactSummaryLabel}>当前结果</ThemedText>
                <ThemedText style={styles.compactSummaryCaption}>
                  {hideCancelledByDefault ? '含已作废总数' : '已作废范围总数'}
                </ThemedText>
              </View>
              <View style={styles.compactSummaryMetric}>
                <ThemedText style={styles.compactSummaryValue} type="defaultSemiBold">
                  {visibleOrderCount} / {hideCancelledByDefault ? totalOrderCount + deskSummary.cancelledCount : totalOrderCount}
                </ThemedText>
                <ThemedText style={styles.compactSummaryUnit} type="defaultSemiBold">
                  单
                </ThemedText>
              </View>
            </View>
          </WorkbenchSectionCard>

          <WorkbenchSectionCard
            backgroundColor={surface}
            borderColor={borderColor}
            hint={
              sortMode === 'unfinished_first'
                ? '当前按未完成优先排序'
                : `当前按${activeSortLabel}${activeDirectionLabel}排序`
            }
            title="销售订单列表">

            {isLoading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator color={tintColor} />
              </View>
            ) : orders.length ? (
              <View style={styles.resultList}>
                {orders.map((order) => {
                  const primaryTone = getStatusTone(order);
                  const secondaryTone = getSecondaryStatusTone(order);
                  return (
                    <Pressable
                      key={order.name}
                      onPress={() => router.push(`/sales/order/${order.name}`)}
                      style={[styles.docCard, { backgroundColor: surfaceMuted, borderColor }]}>
                      <View style={styles.docTopRow}>
                        <View style={styles.docMainInfo}>
                          <ThemedText style={styles.docTitle} numberOfLines={1} type="defaultSemiBold">
                            {order.customer || '未填写客户'}
                          </ThemedText>
                          <View style={styles.docSubRow}>
                            <ThemedText style={styles.docMeta} numberOfLines={1}>
                              {order.name}
                            </ThemedText>
                            <ThemedText style={styles.docMeta}>·</ThemedText>
                            <ThemedText style={styles.docMeta}>{order.transactionDate || '—'}</ThemedText>
                          </View>
                        </View>
                        <View style={[styles.statusPill, { backgroundColor: primaryTone.backgroundColor }]}>
                          <ThemedText style={[styles.statusText, { color: primaryTone.color }]} type="defaultSemiBold">
                            {orderStatusText(order)}
                          </ThemedText>
                        </View>
                      </View>

                      <View style={styles.docMiddleRow}>
                        <View style={styles.docCompanyPill}>
                          <ThemedText style={styles.docCompanyText} numberOfLines={1}>
                            {order.company || '未配置公司'}
                          </ThemedText>
                        </View>
                        <View style={[styles.statusPill, { backgroundColor: secondaryTone.backgroundColor }]}>
                          <ThemedText style={[styles.statusText, { color: secondaryTone.color }]} type="defaultSemiBold">
                            {getSecondaryStatusLabel(order)}
                          </ThemedText>
                        </View>
                      </View>

                      <View style={styles.moneyActionRow}>
                        <View style={styles.moneyColumns}>
                          <View style={styles.moneyBlock}>
                            <ThemedText style={styles.moneyLabel}>订单金额</ThemedText>
                            <ThemedText style={styles.moneyValue} type="defaultSemiBold">
                              {formatCurrencyValue(order.grandTotal, 'CNY')}
                            </ThemedText>
                          </View>
                          <View style={styles.moneyBlock}>
                            <ThemedText style={styles.moneyLabel}>未收金额</ThemedText>
                            <ThemedText
                              style={[
                                styles.moneyValue,
                                { color: (order.outstandingAmount ?? 0) > 0 ? '#C2410C' : '#1F2A37' },
                              ]}
                              type="defaultSemiBold">
                              {formatCurrencyValue(order.outstandingAmount, 'CNY')}
                            </ThemedText>
                          </View>
                        </View>

                        <Pressable onPress={() => openOrderPrimaryAction(order)} style={[styles.primaryActionButton, { backgroundColor: '#DBEAFE' }]}>
                          <ThemedText style={[styles.primaryActionText, { color: tintColor }]} type="defaultSemiBold">
                            {getQuickActionLabel(order)}
                          </ThemedText>
                        </Pressable>
                      </View>
                    </Pressable>
                  );
                })}

                {orders.length < visibleOrderCount ? (
                  <Pressable
                    disabled={isLoadingMore}
                    onPress={() => void handleLoadMoreOrders()}
                    style={[styles.loadMoreButton, { borderColor, backgroundColor: surfaceMuted }]}>
                    <ThemedText style={styles.loadMoreText} type="defaultSemiBold">
                      {isLoadingMore ? '正在加载...' : `加载更多 (${orders.length}/${visibleOrderCount})`}
                    </ThemedText>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <View style={[styles.emptyCard, { backgroundColor: surfaceMuted, borderColor }]}>
                <ThemedText type="defaultSemiBold">暂无查询结果</ThemedText>
                <ThemedText>你可以输入订单号、客户或切换状态筛选查看销售订单。</ThemedText>
              </View>
            )}
          </WorkbenchSectionCard>
        </>
      </ScrollView>

      <Modal animationType="fade" onRequestClose={() => setPickerMode(null)} transparent visible={pickerMode !== null}>
        <Pressable onPress={() => setPickerMode(null)} style={styles.modalOverlay}>
          <Pressable onPress={() => {}} style={[styles.modalCard, { backgroundColor: surface, borderColor }]}>
            {pickerMode === 'company' ? (
              <>
                <ThemedText style={styles.modalTitle} type="defaultSemiBold">
                  选择查询公司
                </ThemedText>
                <View style={[styles.modalSearchInputWrap, { backgroundColor: surfaceMuted, borderColor }]}>
                  <TextInput
                    autoCorrect={false}
                    onChangeText={setCompanyQuery}
                    placeholder="搜索公司"
                    placeholderTextColor="rgba(31,42,55,0.45)"
                    style={styles.modalSearchInput}
                    value={companyQuery}
                  />
                </View>
                <Pressable
                  onPress={() => {
                    setQueryCompany(null);
                    setPickerMode(null);
                  }}
                  style={styles.modalOption}>
                  <ThemedText type="defaultSemiBold">全部公司</ThemedText>
                </Pressable>
                {isLoadingCompanies ? (
                  <View style={styles.loadingWrap}>
                    <ActivityIndicator color={tintColor} />
                  </View>
                ) : (
                  companyOptions.map((option) => (
                    <Pressable
                      key={option.value}
                      onPress={() => {
                        setQueryCompany(option.value);
                        setPickerMode(null);
                      }}
                      style={styles.modalOption}>
                      <ThemedText type="defaultSemiBold">{option.label}</ThemedText>
                      {option.description ? <ThemedText style={styles.modalOptionMeta}>{option.description}</ThemedText> : null}
                    </Pressable>
                  ))
                )}
              </>
            ) : null}

            {pickerMode === 'filter'
              ? FILTER_OPTIONS.map((option) => (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      setFilterMode(option.value);
                      setPickerMode(null);
                    }}
                    style={styles.modalOption}>
                    <ThemedText type="defaultSemiBold">{option.label}</ThemedText>
                  </Pressable>
                ))
              : null}

            {pickerMode === 'sort'
              ? SORT_OPTIONS.map((option) => (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      setSortMode(option.value);
                      setPickerMode(null);
                    }}
                    style={styles.modalOption}>
                    <ThemedText type="defaultSemiBold">{option.label}</ThemedText>
                  </Pressable>
                ))
              : null}
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
    padding: WORKBENCH_SIZE.containerPaddingHorizontal,
    paddingTop: WORKBENCH_SIZE.containerPaddingTop,
    paddingBottom: WORKBENCH_SIZE.containerPaddingBottom,
  },
  heroCard: {
    backgroundColor: '#F7FBFF',
    borderRadius: WORKBENCH_SIZE.heroRadius,
    borderWidth: 1,
    gap: WORKBENCH_SIZE.heroGap,
    overflow: 'hidden',
    padding: WORKBENCH_SIZE.heroPadding,
    position: 'relative',
  },
  heroGlowWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  heroGlowA: {
    position: 'absolute',
    right: SALES_WORKBENCH_SIZE.heroGlowA.right,
    top: SALES_WORKBENCH_SIZE.heroGlowA.top,
    width: SALES_WORKBENCH_SIZE.heroGlowA.width,
    height: SALES_WORKBENCH_SIZE.heroGlowA.height,
    borderRadius: SALES_WORKBENCH_SIZE.heroGlowA.radius,
    backgroundColor: '#DBEAFE',
  },
  heroGlowB: {
    position: 'absolute',
    left: SALES_WORKBENCH_SIZE.heroGlowB.left,
    bottom: SALES_WORKBENCH_SIZE.heroGlowB.bottom,
    width: SALES_WORKBENCH_SIZE.heroGlowB.width,
    height: SALES_WORKBENCH_SIZE.heroGlowB.height,
    borderRadius: SALES_WORKBENCH_SIZE.heroGlowB.radius,
    backgroundColor: '#FED7AA',
    opacity: SALES_WORKBENCH_SIZE.heroGlowB.opacity,
  },
  heroGlowC: {
    position: 'absolute',
    right: SALES_WORKBENCH_SIZE.heroGlowC.right,
    bottom: SALES_WORKBENCH_SIZE.heroGlowC.bottom,
    width: SALES_WORKBENCH_SIZE.heroGlowC.width,
    height: SALES_WORKBENCH_SIZE.heroGlowC.height,
    borderRadius: SALES_WORKBENCH_SIZE.heroGlowC.radius,
    backgroundColor: '#CFFAFE',
    opacity: SALES_WORKBENCH_SIZE.heroGlowC.opacity,
    transform: [{ rotate: '-12deg' }],
  },
  eyebrow: {
    color: '#2563EB',
    fontSize: WORKBENCH_SIZE.heroEyebrowFontSize,
    letterSpacing: WORKBENCH_SIZE.heroEyebrowLetterSpacing,
  },
  heroHeader: {
    flexDirection: 'row',
    gap: SALES_WORKBENCH_SIZE.heroHeaderGap,
    justifyContent: 'space-between',
  },
  heroTextWrap: {
    flex: 1,
    gap: SALES_WORKBENCH_SIZE.heroTextGap,
  },
  heroTitle: {
    fontSize: WORKBENCH_SIZE.heroTitleFontSize,
    lineHeight: WORKBENCH_SIZE.heroTitleLineHeight,
  },
  heroDescription: {
    color: '#475569',
    fontSize: WORKBENCH_SIZE.heroSubtitleFontSize,
    lineHeight: WORKBENCH_SIZE.heroSubtitleLineHeight,
    maxWidth: 420,
  },
  heroCountPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    minWidth: WORKBENCH_SIZE.heroCountPillMinWidth,
    paddingHorizontal: WORKBENCH_SIZE.heroCountPillPaddingHorizontal,
    paddingVertical: WORKBENCH_SIZE.heroCountPillPaddingVertical,
  },
  heroCountText: {
    color: '#2563EB',
    fontSize: 13,
  },
  metricTiles: {
    flexDirection: 'row',
    gap: WORKBENCH_SIZE.metricRowGap,
  },
  metricTile: {
    borderRadius: WORKBENCH_SIZE.metricCardRadius,
    borderWidth: 1,
    flex: 1,
    gap: WORKBENCH_SIZE.metricCardGap,
    minHeight: WORKBENCH_SIZE.metricCardMinHeight,
    paddingHorizontal: WORKBENCH_SIZE.metricCardPaddingHorizontal,
    paddingVertical: WORKBENCH_SIZE.metricCardPaddingVertical,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  metricTileLabel: {
    color: '#475569',
    fontSize: WORKBENCH_SIZE.metricLabelFontSize,
  },
  metricTileValue: {
    fontSize: WORKBENCH_SIZE.metricValueFontSize,
    lineHeight: WORKBENCH_SIZE.metricValueLineHeight,
  },
  sectionCard: {
    borderRadius: WORKBENCH_SIZE.sectionRadius,
    borderWidth: 1,
    gap: WORKBENCH_SIZE.sectionGap,
    padding: WORKBENCH_SIZE.sectionPadding,
  },
  sectionHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
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
  quickActionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: WORKBENCH_SIZE.actionGridGap,
    justifyContent: 'space-between',
  },
  quickActionCard: {
    alignItems: 'center',
    borderRadius: WORKBENCH_SIZE.actionCardRadius,
    borderWidth: 1,
    gap: 10,
    justifyContent: 'center',
    minHeight: WORKBENCH_SIZE.actionCardMinHeight,
    paddingHorizontal: WORKBENCH_SIZE.actionCardPaddingHorizontal,
    paddingVertical: WORKBENCH_SIZE.actionCardPaddingVertical,
    width: '31.5%',
  },
  quickActionText: {
    fontSize: WORKBENCH_SIZE.actionLabelFontSize,
    lineHeight: WORKBENCH_SIZE.actionLabelLineHeight,
    maxWidth: WORKBENCH_SIZE.actionLabelMaxWidth,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerActionButton: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  headerActionText: {
    color: '#475569',
    fontSize: 13,
  },
  searchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: WORKBENCH_SIZE.searchRowGap,
  },
  searchInputWrap: {
    borderRadius: WORKBENCH_SIZE.searchInputRadius,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    minHeight: WORKBENCH_SIZE.searchInputMinHeight,
    paddingHorizontal: 15,
  },
  searchInput: {
    flex: 1,
    fontSize: WORKBENCH_SIZE.searchInputFontSize,
    minHeight: 38,
    paddingVertical: 0,
  },
  clearButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
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
    color: '#FFF',
    fontSize: WORKBENCH_SIZE.searchButtonTextFontSize,
  },
  filterChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterChipText: {
    color: '#334155',
    fontSize: 12,
  },
  queryMetaRow: {
    flexDirection: 'row',
    gap: 10,
  },
  compactFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  compactFilterChip: {
    borderRadius: WORKBENCH_SIZE.searchInputRadius,
    borderWidth: 1,
    gap: 4,
    minHeight: 54,
    minWidth: '47%',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  compactFilterLabel: {
    color: '#64748B',
    fontSize: 11,
  },
  compactFilterValue: {
    color: '#0F172A',
    flex: 1,
    fontSize: 13,
  },
  compactFilterValueRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  compactSummaryBar: {
    alignItems: 'center',
    borderRadius: WORKBENCH_SIZE.searchInputRadius,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 58,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  compactSummaryCopy: {
    flex: 1,
    gap: 2,
  },
  compactSummaryLabel: {
    color: '#64748B',
    fontSize: 11,
  },
  compactSummaryCaption: {
    color: '#94A3B8',
    fontSize: 11,
  },
  compactSummaryMetric: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 6,
    marginLeft: 12,
  },
  compactSummaryValue: {
    color: '#0F172A',
    fontSize: 22,
    lineHeight: 26,
  },
  compactSummaryUnit: {
    color: '#64748B',
    fontSize: 12,
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
  selectCardDisabled: {
    opacity: 0.55,
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
    color: '#0F172A',
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
  queryMetaLabel: {
    color: '#64748B',
    fontSize: 11,
  },
  resultSummaryStrip: {
    borderRadius: WORKBENCH_SIZE.searchInputRadius,
    borderWidth: 1,
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
  resultList: {
    gap: 12,
  },
  docCard: {
    borderRadius: WORKBENCH_SIZE.docCardRadius,
    borderWidth: 1,
    gap: WORKBENCH_SIZE.docCardGap,
    padding: WORKBENCH_SIZE.docCardPadding,
  },
  docTopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: SALES_WORKBENCH_SIZE.docTopRowGap,
    justifyContent: 'space-between',
  },
  docMainInfo: {
    flex: 1,
    gap: SALES_WORKBENCH_SIZE.docMainInfoGap,
  },
  docTitle: {
    fontSize: WORKBENCH_SIZE.docTitleFontSize,
  },
  docSubRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SALES_WORKBENCH_SIZE.docSubRowGap,
  },
  docMeta: {
    color: '#64748B',
    fontSize: WORKBENCH_SIZE.docMetaFontSize,
  },
  statusPill: {
    borderRadius: SALES_WORKBENCH_SIZE.statusPillRadius,
    paddingHorizontal: SALES_WORKBENCH_SIZE.statusPillPaddingHorizontal,
    paddingVertical: SALES_WORKBENCH_SIZE.statusPillPaddingVertical,
  },
  statusText: {
    fontSize: SALES_WORKBENCH_SIZE.statusTextFontSize,
  },
  docMiddleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  docCompanyPill: {
    backgroundColor: '#FFFFFF',
    borderRadius: SALES_WORKBENCH_SIZE.docCompanyPillRadius,
    paddingHorizontal: SALES_WORKBENCH_SIZE.docCompanyPillPaddingHorizontal,
    paddingVertical: SALES_WORKBENCH_SIZE.docCompanyPillPaddingVertical,
  },
  docCompanyText: {
    color: '#475569',
    fontSize: WORKBENCH_SIZE.docCompanyFontSize,
  },
  moneyActionRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: SALES_WORKBENCH_SIZE.moneyActionRowGap,
    justifyContent: 'space-between',
  },
  moneyColumns: {
    flex: 1,
    flexDirection: 'row',
    gap: SALES_WORKBENCH_SIZE.moneyColumnsGap,
  },
  moneyBlock: {
    flex: 1,
    gap: SALES_WORKBENCH_SIZE.moneyBlockGap,
  },
  moneyLabel: {
    color: '#64748B',
    fontSize: WORKBENCH_SIZE.moneyLabelFontSize,
  },
  moneyValue: {
    color: '#0F172A',
    fontSize: WORKBENCH_SIZE.moneyValueFontSize,
  },
  primaryActionButton: {
    alignItems: 'center',
    borderRadius: SALES_WORKBENCH_SIZE.primaryActionRadius,
    justifyContent: 'center',
    minHeight: SALES_WORKBENCH_SIZE.primaryActionMinHeight,
    minWidth: SALES_WORKBENCH_SIZE.primaryActionMinWidth,
    paddingHorizontal: SALES_WORKBENCH_SIZE.primaryActionPaddingHorizontal,
  },
  primaryActionText: {
    fontSize: SALES_WORKBENCH_SIZE.primaryActionFontSize,
  },
  loadMoreButton: {
    alignItems: 'center',
    borderRadius: SALES_WORKBENCH_SIZE.loadMoreRadius,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: SALES_WORKBENCH_SIZE.loadMoreMinHeight,
    paddingHorizontal: SALES_WORKBENCH_SIZE.loadMorePaddingHorizontal,
  },
  loadMoreText: {
    color: '#475569',
  },
  emptyCard: {
    borderRadius: SALES_WORKBENCH_SIZE.emptyCardRadius,
    borderWidth: 1,
    gap: SALES_WORKBENCH_SIZE.emptyCardGap,
    padding: SALES_WORKBENCH_SIZE.emptyCardPadding,
  },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: SALES_WORKBENCH_SIZE.loadingMinHeight,
  },
  modalOverlay: {
    backgroundColor: 'rgba(15, 23, 42, 0.24)',
    flex: 1,
    justifyContent: 'flex-end',
    padding: SALES_WORKBENCH_SIZE.modalPadding,
  },
  modalCard: {
    borderRadius: SALES_WORKBENCH_SIZE.modalCardRadius,
    borderWidth: 1,
    gap: SALES_WORKBENCH_SIZE.modalCardGap,
    maxHeight: '70%',
    padding: SALES_WORKBENCH_SIZE.modalPadding,
  },
  modalTitle: {
    fontSize: SALES_WORKBENCH_SIZE.modalTitleFontSize,
  },
  modalSearchInputWrap: {
    borderRadius: SALES_WORKBENCH_SIZE.modalSearchRadius,
    borderWidth: 1,
    minHeight: SALES_WORKBENCH_SIZE.modalSearchMinHeight,
    justifyContent: 'center',
    paddingHorizontal: SALES_WORKBENCH_SIZE.modalSearchPaddingHorizontal,
  },
  modalSearchInput: {
    fontSize: SALES_WORKBENCH_SIZE.modalSearchFontSize,
    minHeight: SALES_WORKBENCH_SIZE.modalSearchInnerMinHeight,
  },
  modalOption: {
    gap: SALES_WORKBENCH_SIZE.modalOptionGap,
    minHeight: SALES_WORKBENCH_SIZE.modalOptionMinHeight,
    justifyContent: 'center',
    paddingVertical: SALES_WORKBENCH_SIZE.modalOptionPaddingVertical,
  },
  modalOptionMeta: {
    color: '#64748B',
    fontSize: SALES_WORKBENCH_SIZE.modalMetaFontSize,
  },
});
