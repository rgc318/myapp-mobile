import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MobilePageHeader } from '@/components/mobile-page-header';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { normalizeAppError } from '@/lib/app-error';
import { getAppPreferences } from '@/lib/app-preferences';
import { formatCurrencyValue } from '@/lib/display-currency';
import { useFeedback } from '@/providers/feedback-provider';
import { type LinkOption } from '@/services/master-data';
import { fetchBusinessReport, type BusinessCashflowRow, type BusinessPartySummaryRow, type BusinessReport } from '@/services/reports';
import { searchCompanies } from '@/services/sales';

type RangeMode = 'today' | '7d' | '30d';

const RANGE_OPTIONS: { value: RangeMode; label: string; days: number }[] = [
  { value: 'today', label: '今天', days: 1 },
  { value: '7d', label: '近 7 天', days: 7 },
  { value: '30d', label: '近 30 天', days: 30 },
];

const EMPTY_REPORT: BusinessReport = {
  overview: {
    salesAmountTotal: 0,
    purchaseAmountTotal: 0,
    receivedAmountTotal: 0,
    paidAmountTotal: 0,
    netCashflowTotal: 0,
    receivableOutstandingTotal: 0,
    payableOutstandingTotal: 0,
  },
  tables: {
    salesSummary: [],
    purchaseSummary: [],
    receivableSummary: [],
    payableSummary: [],
    cashflowSummary: [],
  },
  meta: {
    company: null,
    dateFrom: '',
    dateTo: '',
    limit: 0,
  },
};

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function resolveDateRange(mode: RangeMode) {
  const end = new Date();
  const start = new Date();
  const option = RANGE_OPTIONS.find((item) => item.value === mode) ?? RANGE_OPTIONS[2];
  start.setDate(end.getDate() - (option.days - 1));
  return {
    dateFrom: toIsoDate(start),
    dateTo: toIsoDate(end),
  };
}

function formatMoney(value?: number) {
  return formatCurrencyValue(value ?? 0, 'CNY');
}

function OverviewMetric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <View style={[styles.metricCard, { borderColor: `${accent}33`, backgroundColor: `${accent}0F` }]}>
      <ThemedText style={styles.metricLabel}>{label}</ThemedText>
      <ThemedText style={[styles.metricValue, { color: accent }]} type="defaultSemiBold">
        {value}
      </ThemedText>
    </View>
  );
}

function PartyTableSection({
  title,
  hint,
  rows,
  amountLabel,
  surface,
  borderColor,
  amountTone,
}: {
  title: string;
  hint: string;
  rows: BusinessPartySummaryRow[];
  amountLabel: string;
  surface: string;
  borderColor: string;
  amountTone: string;
}) {
  return (
    <View style={[styles.sectionCard, { backgroundColor: surface, borderColor }]}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderText}>
          <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
            {title}
          </ThemedText>
          <ThemedText style={styles.sectionHint}>{hint}</ThemedText>
        </View>
      </View>

      {rows.length ? (
        rows.map((row) => (
          <View key={`${title}-${row.name}`} style={[styles.tableRow, { borderTopColor: borderColor }]}>
            <View style={styles.tableRowMain}>
              <ThemedText style={styles.rowTitle} type="defaultSemiBold">
                {row.name}
              </ThemedText>
              <ThemedText style={styles.rowMeta}>{row.count} 笔</ThemedText>
            </View>
            <View style={styles.tableRowSide}>
              <ThemedText style={styles.rowMeta}>{amountLabel}</ThemedText>
              <ThemedText style={[styles.rowAmount, { color: amountTone }]} type="defaultSemiBold">
                {formatMoney(row.amount ?? row.totalAmount ?? 0)}
              </ThemedText>
              {row.outstandingAmount != null ? (
                <ThemedText style={styles.rowSubAmount}>未结 {formatMoney(row.outstandingAmount)}</ThemedText>
              ) : null}
            </View>
          </View>
        ))
      ) : (
        <ThemedText style={styles.emptyText}>当前筛选范围内暂无数据。</ThemedText>
      )}
    </View>
  );
}

function CashflowSection({
  rows,
  surface,
  borderColor,
}: {
  rows: BusinessCashflowRow[];
  surface: string;
  borderColor: string;
}) {
  return (
    <View style={[styles.sectionCard, { backgroundColor: surface, borderColor }]}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderText}>
          <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
            资金流水
          </ThemedText>
          <ThemedText style={styles.sectionHint}>看最近实际收款 / 付款记录，先做真实资金视角。</ThemedText>
        </View>
      </View>

      {rows.length ? (
        rows.map((row) => {
          const accent = row.direction === 'in' ? '#16A34A' : row.direction === 'out' ? '#DC2626' : '#475569';
          const directionLabel = row.direction === 'in' ? '收入' : row.direction === 'out' ? '支出' : '划转';
          return (
            <View key={row.name ?? `${row.postingDate}-${row.party}`} style={[styles.tableRow, { borderTopColor: borderColor }]}>
              <View style={styles.tableRowMain}>
                <View style={[styles.flowChip, { backgroundColor: `${accent}18` }]}>
                  <ThemedText style={[styles.flowChipText, { color: accent }]} type="defaultSemiBold">
                    {directionLabel}
                  </ThemedText>
                </View>
                <ThemedText style={styles.rowTitle} type="defaultSemiBold">
                  {row.party || row.partyType || '未识别对象'}
                </ThemedText>
                <ThemedText style={styles.rowMeta}>
                  {(row.postingDate || '无日期') + (row.modeOfPayment ? ` · ${row.modeOfPayment}` : '')}
                </ThemedText>
              </View>
              <View style={styles.tableRowSide}>
                <ThemedText style={[styles.rowAmount, { color: accent }]} type="defaultSemiBold">
                  {formatMoney(row.amount)}
                </ThemedText>
                {row.referenceNo ? <ThemedText style={styles.rowSubAmount}>凭证 {row.referenceNo}</ThemedText> : null}
              </View>
            </View>
          );
        })
      ) : (
        <ThemedText style={styles.emptyText}>当前筛选范围内暂无资金流水。</ThemedText>
      )}
    </View>
  );
}

export default function ReportsScreen() {
  const preferences = getAppPreferences();
  const { showError } = useFeedback();

  const [rangeMode, setRangeMode] = useState<RangeMode>('30d');
  const [queryCompany, setQueryCompany] = useState<string | null>(preferences.defaultCompany);
  const [report, setReport] = useState<BusinessReport>(EMPTY_REPORT);
  const [isLoading, setIsLoading] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [companyQuery, setCompanyQuery] = useState('');
  const [companyOptions, setCompanyOptions] = useState<LinkOption[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const hasMountedFiltersRef = useRef(false);

  const surface = useThemeColor({}, 'surface');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const background = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');

  const loadReport = useCallback(async () => {
    const { dateFrom, dateTo } = resolveDateRange(rangeMode);
    try {
      setIsLoading(true);
      const next = await fetchBusinessReport({
        company: queryCompany,
        dateFrom,
        dateTo,
        limit: 8,
      });
      setReport(next);
    } catch (error) {
      showError(normalizeAppError(error).message);
    } finally {
      setIsLoading(false);
    }
  }, [queryCompany, rangeMode, showError]);

  useFocusEffect(
    useCallback(() => {
      void loadReport();
    }, [loadReport]),
  );

  useEffect(() => {
    if (!hasMountedFiltersRef.current) {
      hasMountedFiltersRef.current = true;
      return;
    }
    void loadReport();
  }, [loadReport, queryCompany, rangeMode]);

  useEffect(() => {
    if (!pickerVisible) {
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
  }, [companyQuery, pickerVisible]);

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: background }]}>
      <MobilePageHeader title="经营报表" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={[styles.heroCard, { backgroundColor: surface, borderColor }]}>
          <View style={styles.heroGlowA} />
          <View style={styles.heroGlowB} />
          <ThemedText style={styles.heroEyebrow}>BUSINESS REPORTS</ThemedText>
          <View style={styles.heroHeader}>
            <View style={styles.heroCopy}>
              <ThemedText style={styles.heroTitle} type="title">
                统计中心
              </ThemedText>
              <ThemedText style={styles.heroText}>
                先从最关键的销售、采购、应收应付和资金流水开始，把经营面先看清楚。
              </ThemedText>
            </View>
            <View style={[styles.heroBadge, { borderColor }]}>
              <ThemedText style={styles.heroBadgeValue} type="defaultSemiBold">
                {report.meta.dateFrom && report.meta.dateTo ? `${report.meta.dateFrom} ~ ${report.meta.dateTo}` : '近 30 天'}
              </ThemedText>
            </View>
          </View>

          <View style={styles.filterRow}>
            {RANGE_OPTIONS.map((option) => {
              const active = option.value === rangeMode;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setRangeMode(option.value)}
                  style={[
                    styles.filterChip,
                    { borderColor },
                    active ? { backgroundColor: tintColor, borderColor: tintColor } : { backgroundColor: surfaceMuted },
                  ]}>
                  <ThemedText style={[styles.filterChipText, active ? styles.filterChipTextActive : null]} type="defaultSemiBold">
                    {option.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.toolbarRow}>
            <Pressable onPress={() => setPickerVisible(true)} style={[styles.toolbarButton, { backgroundColor: surfaceMuted, borderColor }]}>
              <ThemedText style={styles.toolbarLabel}>查询公司</ThemedText>
              <ThemedText style={styles.toolbarValue} type="defaultSemiBold">
                {queryCompany || '全部公司'}
              </ThemedText>
            </Pressable>
            <Pressable onPress={() => void loadReport()} style={[styles.refreshButton, { backgroundColor: tintColor }]}>
              {isLoading ? <ActivityIndicator color="#FFFFFF" /> : <IconSymbol name="arrow.clockwise" size={18} color="#FFFFFF" />}
              <ThemedText style={styles.refreshButtonText} type="defaultSemiBold">
                刷新
              </ThemedText>
            </Pressable>
          </View>
        </View>

        <View style={styles.metricsGrid}>
          <OverviewMetric accent="#2563EB" label="销售额" value={formatMoney(report.overview.salesAmountTotal)} />
          <OverviewMetric accent="#EA580C" label="采购额" value={formatMoney(report.overview.purchaseAmountTotal)} />
          <OverviewMetric accent="#16A34A" label="收入" value={formatMoney(report.overview.receivedAmountTotal)} />
          <OverviewMetric accent="#DC2626" label="支出" value={formatMoney(report.overview.paidAmountTotal)} />
          <OverviewMetric accent="#0F766E" label="净现金流" value={formatMoney(report.overview.netCashflowTotal)} />
          <OverviewMetric accent="#B45309" label="应收未结" value={formatMoney(report.overview.receivableOutstandingTotal)} />
          <OverviewMetric accent="#7C3AED" label="应付未结" value={formatMoney(report.overview.payableOutstandingTotal)} />
        </View>

        <PartyTableSection
          amountLabel="销售额"
          amountTone="#2563EB"
          borderColor={borderColor}
          hint="按客户聚合，看谁贡献最多销售额。"
          rows={report.tables.salesSummary}
          surface={surface}
          title="销售汇总表"
        />

        <PartyTableSection
          amountLabel="采购额"
          amountTone="#EA580C"
          borderColor={borderColor}
          hint="按供应商聚合，看采购金额集中在哪些供应商。"
          rows={report.tables.purchaseSummary}
          surface={surface}
          title="采购汇总表"
        />

        <PartyTableSection
          amountLabel="应收总额"
          amountTone="#B45309"
          borderColor={borderColor}
          hint="按客户聚合，看未结应收压力。"
          rows={report.tables.receivableSummary}
          surface={surface}
          title="应收账款表"
        />

        <PartyTableSection
          amountLabel="应付总额"
          amountTone="#7C3AED"
          borderColor={borderColor}
          hint="按供应商聚合，看待付款结构。"
          rows={report.tables.payableSummary}
          surface={surface}
          title="应付账款表"
        />

        <CashflowSection borderColor={borderColor} rows={report.tables.cashflowSummary} surface={surface} />

        <View style={[styles.noteCard, { backgroundColor: surfaceMuted }]}>
          <ThemedText style={styles.noteTitle} type="defaultSemiBold">
            下一阶段
          </ThemedText>
          <ThemedText style={styles.noteText}>
            当前先保证销售、采购、应收应付、资金流水这 5 张表稳定可用。库存收发存、成本、毛利分析会在成本口径统一后继续补。
          </ThemedText>
        </View>
      </ScrollView>

      <Modal animationType="fade" onRequestClose={() => setPickerVisible(false)} transparent visible={pickerVisible}>
        <View style={styles.dialogBackdrop}>
          <View style={[styles.dialogCard, { backgroundColor: surface, borderColor }]}>
            <ThemedText style={styles.dialogTitle} type="defaultSemiBold">
              选择公司
            </ThemedText>
            <TextInput
              onChangeText={setCompanyQuery}
              placeholder="搜索公司"
              placeholderTextColor="rgba(15,23,42,0.4)"
              style={[styles.dialogInput, { backgroundColor: surfaceMuted, borderColor }]}
              value={companyQuery}
            />
            <Pressable
              onPress={() => {
                setQueryCompany(null);
                setPickerVisible(false);
              }}
              style={[styles.dialogOption, { borderColor }]}>
              <ThemedText style={styles.dialogOptionText} type="defaultSemiBold">
                全部公司
              </ThemedText>
            </Pressable>
            <ScrollView style={styles.dialogList}>
              {isLoadingCompanies ? <ActivityIndicator style={styles.dialogLoading} /> : null}
              {companyOptions.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    setQueryCompany(option.value);
                    setPickerVisible(false);
                  }}
                  style={[styles.dialogOption, { borderColor }]}>
                  <ThemedText style={styles.dialogOptionText} type="defaultSemiBold">
                    {option.label}
                  </ThemedText>
                  {option.description ? <ThemedText style={styles.dialogOptionHint}>{option.description}</ThemedText> : null}
                </Pressable>
              ))}
            </ScrollView>
            <Pressable onPress={() => setPickerVisible(false)} style={[styles.dialogClose, { backgroundColor: tintColor }]}>
              <ThemedText style={styles.dialogCloseText} type="defaultSemiBold">
                完成
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    gap: 14,
    padding: 14,
    paddingBottom: 36,
  },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 18,
    position: 'relative',
  },
  heroGlowA: {
    backgroundColor: 'rgba(37,99,235,0.10)',
    borderRadius: 999,
    height: 160,
    position: 'absolute',
    right: -36,
    top: -30,
    width: 160,
  },
  heroGlowB: {
    backgroundColor: 'rgba(234,88,12,0.10)',
    borderRadius: 999,
    bottom: -52,
    height: 130,
    left: -24,
    position: 'absolute',
    width: 130,
  },
  heroEyebrow: {
    color: '#2563EB',
    fontSize: 13,
    letterSpacing: 1.4,
    marginBottom: 10,
  },
  heroHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  heroCopy: {
    flex: 1,
    gap: 8,
  },
  heroTitle: {
    fontSize: 22,
  },
  heroText: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 21,
  },
  heroBadge: {
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 140,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroBadgeValue: {
    color: '#0F172A',
    fontSize: 12,
    textAlign: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 74,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  filterChipText: {
    color: '#475569',
    textAlign: 'center',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  toolbarRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  toolbarButton: {
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  toolbarLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  toolbarValue: {
    color: '#0F172A',
    fontSize: 16,
  },
  refreshButton: {
    alignItems: 'center',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minWidth: 110,
    paddingHorizontal: 16,
  },
  refreshButtonText: {
    color: '#FFFFFF',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    borderRadius: 18,
    borderWidth: 1,
    flexGrow: 1,
    minWidth: '47%',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  metricLabel: {
    color: '#64748B',
    fontSize: 12,
    marginBottom: 6,
  },
  metricValue: {
    fontSize: 19,
  },
  sectionCard: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  sectionHeader: {
    marginBottom: 6,
  },
  sectionHeaderText: {
    gap: 4,
  },
  sectionTitle: {
    fontSize: 20,
  },
  sectionHint: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 19,
  },
  tableRow: {
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  tableRowMain: {
    flex: 1,
    gap: 6,
  },
  tableRowSide: {
    alignItems: 'flex-end',
    gap: 4,
    maxWidth: 140,
  },
  rowTitle: {
    fontSize: 16,
  },
  rowMeta: {
    color: '#64748B',
    fontSize: 12,
  },
  rowAmount: {
    fontSize: 16,
  },
  rowSubAmount: {
    color: '#94A3B8',
    fontSize: 12,
  },
  emptyText: {
    color: '#94A3B8',
    paddingVertical: 14,
  },
  flowChip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  flowChipText: {
    fontSize: 12,
  },
  noteCard: {
    borderRadius: 20,
    gap: 8,
    padding: 16,
  },
  noteTitle: {
    fontSize: 16,
  },
  noteText: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 20,
  },
  dialogBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(15,23,42,0.35)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  dialogCard: {
    borderRadius: 24,
    borderWidth: 1,
    maxHeight: '80%',
    padding: 18,
    width: '100%',
  },
  dialogTitle: {
    fontSize: 20,
    marginBottom: 12,
  },
  dialogInput: {
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dialogList: {
    maxHeight: 280,
  },
  dialogLoading: {
    paddingVertical: 12,
  },
  dialogOption: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dialogOptionText: {
    fontSize: 16,
  },
  dialogOptionHint: {
    color: '#64748B',
    fontSize: 12,
  },
  dialogClose: {
    alignItems: 'center',
    borderRadius: 16,
    marginTop: 12,
    paddingVertical: 14,
  },
  dialogCloseText: {
    color: '#FFFFFF',
  },
});
