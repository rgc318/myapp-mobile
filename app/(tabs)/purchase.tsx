import type { Href } from 'expo-router';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MobilePageHeader } from '@/components/mobile-page-header';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { normalizeAppError } from '@/lib/app-error';
import { getAppPreferences } from '@/lib/app-preferences';
import { useFeedback } from '@/providers/feedback-provider';
import { fetchPurchaseOrderStatusSummary, searchCompanies, type PurchaseOrderSummaryItem } from '@/services/purchases';
import type { LinkOption } from '@/services/master-data';

type FilterMode = 'all' | 'unfinished' | 'receiving' | 'paying' | 'completed' | 'cancelled';
type SortMode = 'unfinished_first' | 'latest' | 'oldest' | 'amount_desc';
type PickerMode = 'company' | 'filter' | 'sort' | null;

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

function getModifiedTime(row: PurchaseOrderSummaryItem) {
  const value = Date.parse(row.modified || row.transactionDate || '');
  return Number.isNaN(value) ? 0 : value;
}

function getTransactionTime(row: PurchaseOrderSummaryItem) {
  const value = Date.parse(row.transactionDate || '');
  return Number.isNaN(value) ? 0 : value;
}

function isCancelled(row: PurchaseOrderSummaryItem) {
  return row.documentStatus === 'cancelled';
}

function isCompleted(row: PurchaseOrderSummaryItem) {
  return row.completionStatus === 'completed';
}

function isUnfinished(row: PurchaseOrderSummaryItem) {
  return !isCancelled(row) && !isCompleted(row);
}

function isReceivingPending(row: PurchaseOrderSummaryItem) {
  return row.documentStatus === 'submitted' && row.receivingStatus !== 'completed';
}

function isPaymentPending(row: PurchaseOrderSummaryItem) {
  return row.documentStatus === 'submitted' && row.paymentStatus !== 'paid';
}

function summarizeCount(rows: PurchaseOrderSummaryItem[], predicate: (row: PurchaseOrderSummaryItem) => boolean) {
  return rows.filter(predicate).length;
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

function getReceivingStatusLabel(status: string) {
  switch (status) {
    case 'pending':
      return '待收货';
    case 'partial':
      return '部分收货';
    case 'completed':
    case 'received':
      return '已收货';
    default:
      return '未设置';
  }
}

function getPaymentStatusLabel(status: string) {
  switch (status) {
    case 'unpaid':
      return '未付款';
    case 'partial':
      return '部分付款';
    case 'paid':
      return '已付款';
    default:
      return '未设置';
  }
}

function getSortWeight(row: PurchaseOrderSummaryItem) {
  if (row.documentStatus === 'cancelled') {
    return 4;
  }
  if (row.completionStatus === 'completed') {
    return 3;
  }
  if (row.paymentStatus === 'paid') {
    return 2;
  }
  if (row.receivingStatus === 'completed') {
    return 1;
  }
  return 0;
}

function matchesFilter(row: PurchaseOrderSummaryItem, filterMode: FilterMode) {
  switch (filterMode) {
    case 'unfinished':
      return isUnfinished(row);
    case 'receiving':
      return isReceivingPending(row);
    case 'paying':
      return isPaymentPending(row);
    case 'completed':
      return isCompleted(row);
    case 'cancelled':
      return isCancelled(row);
    case 'all':
    default:
      return true;
  }
}

function sortRows(rows: PurchaseOrderSummaryItem[], sortMode: SortMode) {
  return [...rows].sort((left, right) => {
    if (sortMode === 'amount_desc') {
      const amountDiff = (right.orderAmountEstimate ?? 0) - (left.orderAmountEstimate ?? 0);
      if (amountDiff !== 0) {
        return amountDiff;
      }
      return getModifiedTime(right) - getModifiedTime(left);
    }

    if (sortMode === 'oldest') {
      const oldest = getTransactionTime(left) - getTransactionTime(right);
      if (oldest !== 0) {
        return oldest;
      }
      return getModifiedTime(left) - getModifiedTime(right);
    }

    if (sortMode === 'latest') {
      return getModifiedTime(right) - getModifiedTime(left);
    }

    const weightDiff = getSortWeight(left) - getSortWeight(right);
    if (weightDiff !== 0) {
      return weightDiff;
    }

    return getModifiedTime(right) - getModifiedTime(left);
  });
}

export default function PurchaseTabScreen() {
  const router = useRouter();
  const preferences = getAppPreferences();
  const { showError } = useFeedback();
  const [searchKey, setSearchKey] = useState('');
  const [queryCompany, setQueryCompany] = useState<string | null>(preferences.defaultCompany);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [sortMode, setSortMode] = useState<SortMode>('unfinished_first');
  const [summaries, setSummaries] = useState<PurchaseOrderSummaryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [companyQuery, setCompanyQuery] = useState('');
  const [companyOptions, setCompanyOptions] = useState<LinkOption[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);

  const surface = useThemeColor({}, 'surface');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const background = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');
  const selectedCompany = queryCompany?.trim() || undefined;

  const loadSummaries = useCallback(async () => {
    try {
      setIsLoading(true);
      const rows = await fetchPurchaseOrderStatusSummary({
        company: selectedCompany,
        limit: 120,
      });
      setSummaries(rows);
    } catch (error) {
      showError(normalizeAppError(error).message);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCompany, showError]);

  useFocusEffect(
    useCallback(() => {
      void loadSummaries();
    }, [loadSummaries]),
  );

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

  const filteredSummaries = useMemo(() => {
    const normalized = searchKey.trim().toLowerCase();
    const rows = summaries.filter((row) => {
      if (!matchesFilter(row, filterMode)) {
        return false;
      }

      if (!normalized) {
        return true;
      }

      const searchPool = [
        row.name,
        row.supplierName,
        row.supplier,
        row.company,
        row.transactionDate,
        row.receivingStatus,
        row.paymentStatus,
        row.completionStatus,
        getWorkflowStatusLabel(row),
      ]
        .filter(Boolean)
        .map((value) => value.toLowerCase());

      return searchPool.some((value) => value.includes(normalized));
    });

    return sortRows(rows, sortMode);
  }, [filterMode, searchKey, sortMode, summaries]);

  const unfinishedCount = summarizeCount(summaries, (row) => isUnfinished(row));
  const receivingCount = summarizeCount(summaries, (row) => isReceivingPending(row));
  const paymentCount = summarizeCount(summaries, (row) => isPaymentPending(row));
  const completedCount = summarizeCount(summaries, (row) => isCompleted(row));

  const quickActions = [
    {
      href: '/purchase/order/create' as Href,
      label: '采购下单',
      badge: 'PO',
      toneBackground: '#EFF6FF',
      toneBorder: '#BFDBFE',
      toneBadge: '#DBEAFE',
      toneText: '#1D4ED8',
    },
    {
      href: '/purchase/receipt/create' as Href,
      label: '采购收货',
      badge: 'PR',
      toneBackground: '#F0FDF4',
      toneBorder: '#BBF7D0',
      toneBadge: '#DCFCE7',
      toneText: '#15803D',
    },
    {
      href: '/purchase/invoice/create' as Href,
      label: '登记发票',
      badge: 'PI',
      toneBackground: '#FFF7ED',
      toneBorder: '#FED7AA',
      toneBadge: '#FFEDD5',
      toneText: '#C2410C',
    },
    {
      href: '/purchase/payment/create' as Href,
      label: '供应商付款',
      badge: 'PAY',
      toneBackground: '#F5F3FF',
      toneBorder: '#DDD6FE',
      toneBadge: '#EDE9FE',
      toneText: '#6D28D9',
    },
    {
      href: '/purchase/return/create' as Href,
      label: '采购退货',
      badge: 'RET',
      toneBackground: '#FEF2F2',
      toneBorder: '#FECACA',
      toneBadge: '#FEE2E2',
      toneText: '#B91C1C',
    },
  ];

  const activeFilterLabel = FILTER_OPTIONS.find((option) => option.value === filterMode)?.label ?? '全部订单';
  const activeSortLabel = SORT_OPTIONS.find((option) => option.value === sortMode)?.label ?? '未完成优先';
  const activeCompanyLabel = queryCompany || '全部公司';

  const companyPickerOptions = useMemo(() => {
    const allOptions: LinkOption[] = [{ label: '全部公司', value: '__all__', description: '跨公司查看全部采购订单' }];
    const selectedOption =
      queryCompany && !companyOptions.some((option) => option.value === queryCompany)
        ? [{ label: queryCompany, value: queryCompany }]
        : [];

    return [...allOptions, ...selectedOption, ...companyOptions];
  }, [companyOptions, queryCompany]);

  function handleResetQuery() {
    setSearchKey('');
    setQueryCompany(preferences.defaultCompany);
    setFilterMode('all');
    setSortMode('unfinished_first');
  }

  return (
    <SafeAreaView edges={[]} style={[styles.screen, { backgroundColor: background }]}>
      <MobilePageHeader title="采购" />

      <ScrollView contentContainerStyle={styles.container}>
        <View style={[styles.heroStage, { borderColor }]}>
          <View style={styles.heroGlowWrap} pointerEvents="none">
            <View style={styles.heroGlowA} />
            <View style={styles.heroGlowB} />
            <View style={styles.heroGlowC} />
          </View>

          <View style={styles.heroTopRow}>
            <View style={styles.heroCopy}>
              <ThemedText style={styles.heroEyebrow}>PURCHASE DESK</ThemedText>
              <ThemedText style={styles.heroTitle} type="title">
                采购工作台
              </ThemedText>
              <ThemedText style={styles.heroSubtitle}>
                自动载入采购订单，并优先把未完成订单排在前面。
              </ThemedText>
            </View>
            <View style={styles.heroCountPill}>
              <ThemedText style={styles.heroCountText} type="defaultSemiBold">
                {filteredSummaries.length} 单
              </ThemedText>
            </View>
          </View>

          <View style={styles.metricRow}>
            <View style={[styles.metricCard, { backgroundColor: '#FFF5D6' }]}>
              <ThemedText style={styles.metricLabel}>未完成</ThemedText>
              <ThemedText style={[styles.metricValue, { color: '#B45309' }]} type="defaultSemiBold">
                {unfinishedCount}
              </ThemedText>
            </View>
            <View style={[styles.metricCard, { backgroundColor: '#E2EDFF' }]}>
              <ThemedText style={styles.metricLabel}>待收货</ThemedText>
              <ThemedText style={[styles.metricValue, { color: '#1D4ED8' }]} type="defaultSemiBold">
                {receivingCount}
              </ThemedText>
            </View>
            <View style={[styles.metricCard, { backgroundColor: '#DCFCE7' }]}>
              <ThemedText style={styles.metricLabel}>待付款</ThemedText>
              <ThemedText style={[styles.metricValue, { color: '#15803D' }]} type="defaultSemiBold">
                {paymentCount}
              </ThemedText>
            </View>
            <View style={[styles.metricCard, { backgroundColor: '#F1F5F9' }]}>
              <ThemedText style={styles.metricLabel}>已完成</ThemedText>
              <ThemedText style={[styles.metricValue, { color: '#334155' }]} type="defaultSemiBold">
                {completedCount}
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={[styles.quickActionsCard, { backgroundColor: surface, borderColor }]}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
              常用动作
            </ThemedText>
            <ThemedText style={styles.sectionHint}>采购主流程入口</ThemedText>
          </View>

          <View style={styles.actionGrid}>
            {quickActions.map((action) => (
              <Link
                key={action.label}
                href={action.href}
                style={[
                  styles.actionCard,
                  {
                    backgroundColor: action.toneBackground,
                    borderColor: action.toneBorder,
                  },
                ]}>
                <View style={[styles.actionBadge, { backgroundColor: action.toneBadge }]}>
                  <ThemedText style={[styles.actionBadgeText, { color: action.toneText }]} type="defaultSemiBold">
                    {action.badge}
                  </ThemedText>
                </View>
                <ThemedText style={[styles.actionLabel, { color: action.toneText }]} type="defaultSemiBold">
                  {action.label}
                </ThemedText>
              </Link>
            ))}
          </View>
        </View>

        <View style={[styles.panel, { backgroundColor: surface, borderColor }]}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
              采购检索
            </ThemedText>
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
          </View>

          <TextInput
            autoCorrect={false}
            onChangeText={setSearchKey}
            placeholder="搜索订单号、供应商、公司、日期或状态"
            style={[styles.searchInput, { backgroundColor: surfaceMuted, borderColor }]}
            value={searchKey}
          />

          <View style={styles.queryMetaRow}>
            <Pressable
              onPress={() => setPickerMode('company')}
              style={[styles.selectCard, { backgroundColor: surfaceMuted, borderColor }]}>
              <ThemedText style={styles.selectLabel}>查询公司</ThemedText>
              <ThemedText style={styles.selectValue} numberOfLines={1} type="defaultSemiBold">
                {activeCompanyLabel}
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setPickerMode('filter')}
              style={[styles.selectCard, { backgroundColor: surfaceMuted, borderColor }]}>
              <ThemedText style={styles.selectLabel}>订单状态</ThemedText>
              <ThemedText style={styles.selectValue} numberOfLines={1} type="defaultSemiBold">
                {activeFilterLabel}
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.queryMetaRow}>
            <Pressable
              onPress={() => setPickerMode('sort')}
              style={[styles.selectCard, { backgroundColor: surfaceMuted, borderColor }]}>
              <ThemedText style={styles.selectLabel}>排序方式</ThemedText>
              <ThemedText style={styles.selectValue} numberOfLines={1} type="defaultSemiBold">
                {activeSortLabel}
              </ThemedText>
            </Pressable>
            <View style={[styles.queryMetaCard, { backgroundColor: surfaceMuted }]}>
              <ThemedText style={styles.queryMetaLabel}>当前结果</ThemedText>
              <ThemedText style={styles.queryMetaValue} type="defaultSemiBold">
                {filteredSummaries.length} / {summaries.length} 单
              </ThemedText>
            </View>
          </View>

          <View style={[styles.resultBanner, { backgroundColor: surfaceMuted }]}>
            <ThemedText style={styles.resultBannerText}>
              当前按 {activeCompanyLabel} 检索采购订单，支持搜索、公司范围、订单状态和排序方式联动查询。
            </ThemedText>
          </View>
        </View>

        <View style={[styles.panel, { backgroundColor: surface, borderColor }]}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
              采购订单列表
            </ThemedText>
            <ThemedText style={styles.sectionHint}>默认按未完成优先排序</ThemedText>
          </View>

          {isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={tintColor} />
              <ThemedText>正在读取采购订单摘要...</ThemedText>
            </View>
          ) : filteredSummaries.length ? (
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
                      <ThemedText style={styles.orderCode}>{row.name}</ThemedText>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.workflowBadgeFloating,
                      { backgroundColor: getStatusTone(row).backgroundColor },
                    ]}>
                    <ThemedText
                      style={[styles.workflowBadgeText, { color: getStatusTone(row).color }]}
                      type="defaultSemiBold">
                      {getWorkflowStatusLabel(row)}
                    </ThemedText>
                  </View>

                  <View style={styles.orderMiddleRow}>
                    <View style={styles.orderMetaBlock}>
                      <ThemedText style={styles.infoPairLabel}>公司</ThemedText>
                      <ThemedText style={styles.infoPairValue} numberOfLines={1} type="defaultSemiBold">
                        {row.company || '未设置'}
                      </ThemedText>
                    </View>
                    <View style={styles.orderMetaBlock}>
                      <ThemedText style={styles.infoPairLabel}>下单日期</ThemedText>
                      <ThemedText style={styles.infoPairValue} numberOfLines={1} type="defaultSemiBold">
                        {row.transactionDate || '未设置'}
                      </ThemedText>
                    </View>
                    <View style={styles.orderAmountRow}>
                      <View style={styles.orderMetaBlock}>
                        <ThemedText style={styles.orderAmountLabel}>订单金额</ThemedText>
                        <ThemedText style={styles.orderAmountValueLeft} numberOfLines={1} type="defaultSemiBold">
                          {formatMoney(row.orderAmountEstimate)}
                        </ThemedText>
                      </View>
                      <View style={styles.orderMetaBlock}>
                        <ThemedText style={styles.orderAmountLabel}>未付金额</ThemedText>
                        <ThemedText style={styles.orderAmountValueLeft} numberOfLines={1} type="defaultSemiBold">
                          {formatMoney(row.outstandingAmount)}
                        </ThemedText>
                      </View>
                    </View>
                  </View>

                  <View style={styles.orderBottomRow}>
                    <View style={styles.orderStatePair}>
                      <ThemedText style={styles.infoPairLabel}>收货</ThemedText>
                      <ThemedText
                        style={styles.infoPairValue}
                        type="defaultSemiBold">
                        {getReceivingStatusLabel(row.receivingStatus)}
                      </ThemedText>
                    </View>
                    <View style={styles.orderStatePair}>
                      <ThemedText style={styles.infoPairLabel}>付款</ThemedText>
                      <ThemedText style={styles.infoPairValue} type="defaultSemiBold">
                        {getPaymentStatusLabel(row.paymentStatus)}
                      </ThemedText>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: surfaceMuted }]}>
              <ThemedText type="defaultSemiBold">当前没有匹配的采购订单</ThemedText>
              <ThemedText>你可以调整筛选条件，或者直接新建采购订单。</ThemedText>
            </View>
          )}
        </View>
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
    gap: 16,
    paddingHorizontal: 18,
    paddingBottom: 40,
    paddingTop: 8,
  },
  heroStage: {
    backgroundColor: '#F7FBFF',
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 18,
    position: 'relative',
    gap: 12,
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
    fontSize: 12,
    letterSpacing: 1.3,
  },
  heroTitle: {
    fontSize: 30,
    lineHeight: 36,
  },
  heroSubtitle: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 19,
    maxWidth: 420,
  },
  heroCountPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  heroCountText: {
    color: '#2563EB',
    fontSize: 13,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricCard: {
    borderRadius: 18,
    flex: 1,
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  metricLabel: {
    color: '#475569',
    fontSize: 11,
  },
  metricValue: {
    fontSize: 19,
    lineHeight: 22,
  },
  quickActionsCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 14,
    gap: 10,
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
    fontSize: 18,
  },
  sectionHint: {
    color: '#64748B',
    flex: 1,
    fontSize: 13,
    textAlign: 'right',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  actionCard: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    gap: 7,
    justifyContent: 'center',
    minHeight: 76,
    paddingHorizontal: 6,
    paddingVertical: 10,
    textDecorationLine: 'none',
    width: '31.5%',
  },
  actionBadge: {
    borderRadius: 999,
    minWidth: 36,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  actionBadgeText: {
    fontSize: 11,
    textAlign: 'center',
  },
  actionLabel: {
    fontSize: 13,
    lineHeight: 17,
    maxWidth: 68,
    textAlign: 'center',
  },
  panel: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  refreshButton: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  refreshButtonText: {
    fontSize: 13,
  },
  searchInput: {
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 52,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  queryMetaRow: {
    flexDirection: 'row',
    gap: 10,
  },
  queryMetaCard: {
    borderRadius: 16,
    flex: 1,
    gap: 5,
    minHeight: 64,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  queryMetaLabel: {
    color: '#64748B',
    fontSize: 11,
  },
  queryMetaValue: {
    fontSize: 14,
  },
  selectCard: {
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    gap: 5,
    minHeight: 64,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectLabel: {
    color: '#64748B',
    fontSize: 11,
  },
  selectValue: {
    fontSize: 14,
  },
  resultBanner: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  resultBannerText: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 18,
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
  orderCard: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 14,
    position: 'relative',
    padding: 16,
    paddingRight: 88,
    textDecorationLine: 'none',
  },
  orderTopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  orderTopCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  orderName: {
    fontSize: 18,
    lineHeight: 22,
  },
  orderCode: {
    color: '#64748B',
    fontSize: 13,
  },
  workflowBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  workflowBadgeFloating: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    position: 'absolute',
    right: 16,
    top: 16,
  },
  workflowBadgeText: {
    fontSize: 12,
  },
  orderMiddleRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  orderMetaBlock: {
    flex: 1,
    gap: 5,
    minWidth: 106,
  },
  infoPairLabel: {
    color: '#94A3B8',
    fontSize: 11,
  },
  infoPairValue: {
    color: '#0F172A',
    fontSize: 14,
  },
  orderAmountRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  orderAmountLabel: {
    color: '#64748B',
    fontSize: 11,
  },
  orderAmountValueLeft: {
    color: '#0F172A',
    fontSize: 18,
    lineHeight: 22,
    textAlign: 'left',
  },
  orderBottomRow: {
    borderTopColor: '#E2E8F0',
    borderTopWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 2,
    paddingTop: 14,
  },
  orderStatePair: {
    gap: 5,
    minWidth: 74,
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
