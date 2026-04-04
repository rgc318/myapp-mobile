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
import {
  fetchBusinessReport,
  fetchCashflowEntries,
  fetchCashflowReport,
  fetchPurchaseReport,
  fetchSalesReport,
  type BusinessCashflowRow,
  type BusinessCashflowTrendRow,
  type CashflowEntriesPage,
  type CashflowReport,
  type BusinessPartySummaryRow,
  type BusinessReport,
} from '@/services/reports';
import { searchCompanies } from '@/services/sales';

type RangeMode = 'month' | 'quarter' | 'year' | 'custom';
type AnalysisRangeMode = 'month' | 'quarter' | 'year' | 'custom';
type SalesAnalysisView = 'amount' | 'customer' | 'trend' | 'product';
type PurchaseAnalysisView = 'amount' | 'supplier' | 'trend' | 'product';
type TrendGranularity = 'day' | 'week' | 'month' | 'year';
type CustomPeriodMode = 'date' | 'month' | 'year';
type PeriodPickerMode = 'date' | 'month' | 'year';
type CustomRangeDraftState = {
  mode: CustomPeriodMode;
  dateFrom: string;
  dateTo: string;
  year: string;
  month: string;
};

const RANGE_OPTIONS: { value: RangeMode; label: string; days?: number }[] = [
  { value: 'month', label: '本月' },
  { value: 'quarter', label: '本季' },
  { value: 'year', label: '本年' },
  { value: 'custom', label: '自定义' },
];

const ANALYSIS_RANGE_OPTIONS: { value: AnalysisRangeMode; label: string }[] = [
  { value: 'month', label: '本月' },
  { value: 'quarter', label: '本季' },
  { value: 'year', label: '本年' },
  { value: 'custom', label: '自定义' },
];
const CUSTOM_PERIOD_OPTIONS: { value: CustomPeriodMode; label: string }[] = [
  { value: 'date', label: '按日期' },
  { value: 'month', label: '按月份' },
  { value: 'year', label: '按年份' },
];
const CASHFLOW_ENTRIES_PAGE_SIZE = 50;
const PERIOD_PICKER_ITEM_HEIGHT = 42;
const PERIOD_PICKER_ITEM_GAP = 8;
const PERIOD_PICKER_VIEWPORT_HEIGHT = 240;
const PERIOD_PICKER_CENTER_PADDING = PERIOD_PICKER_VIEWPORT_HEIGHT / 2 - PERIOD_PICKER_ITEM_HEIGHT / 2;

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
    salesTrend: [],
    salesProductSummary: [],
    purchaseSummary: [],
    purchaseTrend: [],
    purchaseProductSummary: [],
    receivableSummary: [],
    payableSummary: [],
    cashflowSummary: [],
    cashflowTrend: [],
  },
  meta: {
    company: null,
    dateFrom: '',
    dateTo: '',
    limit: 0,
  },
};

const EMPTY_CASHFLOW_REPORT: CashflowReport = {
  overview: {
    receivedAmountTotal: 0,
    paidAmountTotal: 0,
    netCashflowTotal: 0,
  },
  trend: [],
  meta: {
    company: null,
    dateFrom: '',
    dateTo: '',
  },
};

const EMPTY_CASHFLOW_ENTRIES: CashflowEntriesPage = {
  rows: [],
  pagination: {
    page: 1,
    pageSize: CASHFLOW_ENTRIES_PAGE_SIZE,
    totalCount: 0,
    hasMore: false,
  },
  meta: {
    company: null,
    dateFrom: '',
    dateTo: '',
  },
};

function toIsoDate(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function resolveDateRange(mode: RangeMode) {
  const end = new Date();
  const start = new Date(end);
  if (mode === 'month') {
    start.setDate(1);
    return { dateFrom: toIsoDate(start), dateTo: toIsoDate(end) };
  }
  if (mode === 'quarter') {
    const quarterStartMonth = Math.floor(end.getMonth() / 3) * 3;
    start.setMonth(quarterStartMonth, 1);
    return { dateFrom: toIsoDate(start), dateTo: toIsoDate(end) };
  }
  if (mode === 'year') {
    start.setMonth(0, 1);
    return { dateFrom: toIsoDate(start), dateTo: toIsoDate(end) };
  }
  start.setMonth(end.getMonth(), 1);
  return { dateFrom: toIsoDate(start), dateTo: toIsoDate(end) };
}

function endOfMonth(year: number, month: number) {
  return new Date(year, month, 0);
}

function daysInMonth(year: number, month: number) {
  return endOfMonth(year, month).getDate();
}

function parseIsoDateParts(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    const today = new Date();
    return {
      year: today.getFullYear(),
      month: today.getMonth() + 1,
      day: today.getDate(),
    };
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function createInitialCustomDraft(baseRange: { dateFrom: string; dateTo: string }): CustomRangeDraftState {
  const today = new Date();
  return {
    mode: 'date',
    dateFrom: baseRange.dateFrom,
    dateTo: baseRange.dateTo,
    year: String(today.getFullYear()),
    month: String(today.getMonth() + 1).padStart(2, '0'),
  };
}

function resolveCustomDraftRange(draft: CustomRangeDraftState) {
  if (draft.mode === 'date') {
    const dateFrom = draft.dateFrom.trim();
    const dateTo = draft.dateTo.trim();
    if (!isValidIsoDate(dateFrom) || !isValidIsoDate(dateTo)) {
      return { error: '请填写有效日期，格式为 YYYY-MM-DD。' };
    }
    if (dateFrom > dateTo) {
      return { error: '开始日期不能晚于结束日期。' };
    }
    return { dateFrom, dateTo };
  }

  if (!/^\d{4}$/.test(draft.year.trim())) {
    return { error: '请输入四位年份，例如 2026。' };
  }

  const year = Number(draft.year.trim());
  const today = new Date();

  if (draft.mode === 'year') {
    const dateFrom = `${year}-01-01`;
    const dateTo = year === today.getFullYear() ? toIsoDate(today) : `${year}-12-31`;
    return { dateFrom, dateTo };
  }

  if (!/^\d{1,2}$/.test(draft.month.trim())) {
    return { error: '请输入 1-12 月。' };
  }

  const month = Number(draft.month.trim());
  if (month < 1 || month > 12) {
    return { error: '月份必须在 1 到 12 之间。' };
  }
  const monthText = String(month).padStart(2, '0');
  const dateFrom = `${year}-${monthText}-01`;
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;
  const dateTo = isCurrentMonth ? toIsoDate(today) : toIsoDate(endOfMonth(year, month));
  return { dateFrom, dateTo };
}

function describeCustomDraft(draft: CustomRangeDraftState, appliedRange?: { dateFrom: string; dateTo: string }) {
  if (draft.mode === 'month' && /^\d{4}$/.test(draft.year.trim()) && /^\d{1,2}$/.test(draft.month.trim())) {
    return `查看 ${draft.year} 年 ${String(Number(draft.month)).padStart(2, '0')} 月`;
  }
  if (draft.mode === 'year' && /^\d{4}$/.test(draft.year.trim())) {
    return `查看 ${draft.year} 全年`;
  }
  if (appliedRange?.dateFrom && appliedRange?.dateTo) {
    return `${appliedRange.dateFrom} ~ ${appliedRange.dateTo}`;
  }
  return '手动选择时间区间';
}

function formatYearMonth(year: number, month: number) {
  return `${year} 年 ${String(month).padStart(2, '0')} 月`;
}

function buildIsoDateFromParts(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  return toIsoDateLocal(date) === value;
}

function daysBetween(dateFrom: string, dateTo: string) {
  const from = new Date(`${dateFrom}T00:00:00`);
  const to = new Date(`${dateTo}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return 0;
  }
  return Math.max(1, Math.floor((to.getTime() - from.getTime()) / 86400000) + 1);
}

function resolveAutoGranularity(
  mode: AnalysisRangeMode,
  customRange: { dateFrom: string; dateTo: string },
): TrendGranularity {
  if (mode === 'month') {
    return 'month';
  }
  if (mode === 'quarter') {
    return 'week';
  }
  if (mode === 'year') {
    return 'year';
  }
  const days = daysBetween(customRange.dateFrom, customRange.dateTo);
  if (days <= 21) {
    return 'week';
  }
  if (days <= 180) {
    return 'month';
  }
  return 'year';
}

function granularityLabel(granularity: TrendGranularity) {
  if (granularity === 'week') {
    return '按天';
  }
  if (granularity === 'month') {
    return '按日';
  }
  if (granularity === 'year') {
    return '按月';
  }
  return '按小时';
}

function formatMoney(value?: number) {
  return formatCurrencyValue(value ?? 0, 'CNY');
}

function PickerField({
  label,
  value,
  borderColor,
  onPress,
}: {
  label: string;
  value: string;
  borderColor: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.block}>
      <ThemedText style={styles.quickPeriodLabel}>{label}</ThemedText>
      <Pressable onPress={onPress} style={[styles.pickerField, { borderColor }]}>
        <ThemedText style={styles.pickerFieldValue} type="defaultSemiBold">
          {value}
        </ThemedText>
        <ThemedText style={styles.pickerFieldAction} type="defaultSemiBold">
          选择
        </ThemedText>
      </Pressable>
    </View>
  );
}

function PeriodPickerModal({
  visible,
  mode,
  title,
  initialYear,
  initialMonth,
  initialDay,
  accentColor,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  mode: PeriodPickerMode;
  title: string;
  initialYear: number;
  initialMonth?: number;
  initialDay?: number;
  accentColor: string;
  onClose: () => void;
  onConfirm: (value: { year: number; month?: number; day?: number }) => void;
}) {
  const surface = useThemeColor({}, 'surface');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const textColor = useThemeColor({}, 'text');
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: currentYear - 1999 + 5 }, (_, index) => 2000 + index);
  const monthOptions = Array.from({ length: 12 }, (_, index) => index + 1);
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth ?? 1);
  const [day, setDay] = useState(initialDay ?? 1);
  const yearScrollRef = useRef<ScrollView | null>(null);
  const monthScrollRef = useRef<ScrollView | null>(null);
  const dayScrollRef = useRef<ScrollView | null>(null);
  const hasAutoCenteredRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      hasAutoCenteredRef.current = false;
      return;
    }
    setYear(initialYear);
    setMonth(initialMonth ?? 1);
    setDay(initialDay ?? 1);
  }, [initialDay, initialMonth, initialYear, visible]);

  useEffect(() => {
    const maxDay = daysInMonth(year, month);
    if (day > maxDay) {
      setDay(maxDay);
    }
  }, [day, month, year]);

  const dayOptions = Array.from({ length: daysInMonth(year, month) }, (_, index) => index + 1);

  const scrollToCenteredOption = useCallback((ref: ScrollView | null, index: number) => {
    if (!ref || index < 0) {
      return;
    }
    const rawOffset = index * (PERIOD_PICKER_ITEM_HEIGHT + PERIOD_PICKER_ITEM_GAP);
    ref.scrollTo({ animated: false, y: Math.max(0, rawOffset) });
  }, []);

  useEffect(() => {
    if (!visible) {
      return;
    }
    if (hasAutoCenteredRef.current) {
      return;
    }
    const timer = setTimeout(() => {
      scrollToCenteredOption(yearScrollRef.current, yearOptions.indexOf(year));
      if (mode !== 'year') {
        scrollToCenteredOption(monthScrollRef.current, monthOptions.indexOf(month));
      }
      if (mode === 'date') {
        scrollToCenteredOption(dayScrollRef.current, dayOptions.indexOf(day));
      }
      hasAutoCenteredRef.current = true;
    }, 0);
    return () => clearTimeout(timer);
  }, [visible, mode, initialYear, initialMonth, initialDay, yearOptions, monthOptions, dayOptions, scrollToCenteredOption, year, month, day]);

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <Pressable onPress={onClose} style={styles.periodPickerBackdrop}>
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={[styles.periodPickerSheet, { backgroundColor: surface, borderColor }]}>
          <ThemedText style={styles.periodPickerTitle} type="title">
            {title}
          </ThemedText>
          <ThemedText style={styles.periodPickerHint}>
            通过滑动选择真实日历时间，月底天数会自动按实际月份变化。
          </ThemedText>

          <View style={styles.periodPickerColumns}>
            <View style={styles.periodPickerColumn}>
              <ThemedText style={styles.periodPickerLabel}>年份</ThemedText>
              <ScrollView
                ref={yearScrollRef}
                contentContainerStyle={styles.periodPickerList}
                showsVerticalScrollIndicator={false}
                style={[styles.periodPickerScroller, { backgroundColor: surfaceMuted, borderColor }]}>
                <View style={styles.periodPickerEdgeSpacer} />
                {yearOptions.map((option) => {
                  const active = option === year;
                  return (
                    <Pressable
                      key={`year-${option}`}
                      onPress={() => setYear(option)}
                      style={[styles.periodPickerOption, active ? { backgroundColor: accentColor } : null]}>
                      <ThemedText
                        style={[styles.periodPickerOptionText, active ? styles.periodPickerOptionTextActive : { color: textColor }]}
                        type="defaultSemiBold">
                        {option}
                      </ThemedText>
                    </Pressable>
                  );
                })}
                <View style={styles.periodPickerEdgeSpacer} />
              </ScrollView>
            </View>

            {mode !== 'year' ? (
              <View style={styles.periodPickerColumn}>
                <ThemedText style={styles.periodPickerLabel}>月份</ThemedText>
                <ScrollView
                  ref={monthScrollRef}
                  contentContainerStyle={styles.periodPickerList}
                  showsVerticalScrollIndicator={false}
                  style={[styles.periodPickerScroller, { backgroundColor: surfaceMuted, borderColor }]}>
                  <View style={styles.periodPickerEdgeSpacer} />
                  {monthOptions.map((option) => {
                    const active = option === month;
                    return (
                      <Pressable
                        key={`month-${option}`}
                        onPress={() => setMonth(option)}
                        style={[styles.periodPickerOption, active ? { backgroundColor: accentColor } : null]}>
                        <ThemedText
                          style={[styles.periodPickerOptionText, active ? styles.periodPickerOptionTextActive : { color: textColor }]}
                          type="defaultSemiBold">
                          {String(option).padStart(2, '0')} 月
                        </ThemedText>
                      </Pressable>
                      );
                    })}
                  <View style={styles.periodPickerEdgeSpacer} />
                </ScrollView>
              </View>
            ) : null}

            {mode === 'date' ? (
              <View style={styles.periodPickerColumn}>
                <ThemedText style={styles.periodPickerLabel}>日期</ThemedText>
                <ScrollView
                  ref={dayScrollRef}
                  contentContainerStyle={styles.periodPickerList}
                  showsVerticalScrollIndicator={false}
                  style={[styles.periodPickerScroller, { backgroundColor: surfaceMuted, borderColor }]}>
                  <View style={styles.periodPickerEdgeSpacer} />
                  {dayOptions.map((option) => {
                    const active = option === day;
                    return (
                      <Pressable
                        key={`day-${option}`}
                        onPress={() => setDay(option)}
                        style={[styles.periodPickerOption, active ? { backgroundColor: accentColor } : null]}>
                        <ThemedText
                          style={[styles.periodPickerOptionText, active ? styles.periodPickerOptionTextActive : { color: textColor }]}
                          type="defaultSemiBold">
                          {String(option).padStart(2, '0')} 日
                        </ThemedText>
                      </Pressable>
                      );
                    })}
                  <View style={styles.periodPickerEdgeSpacer} />
                </ScrollView>
              </View>
            ) : null}
          </View>

          <View style={styles.periodPickerPreview}>
            <ThemedText style={styles.periodPickerPreviewLabel}>当前选择</ThemedText>
            <ThemedText style={styles.periodPickerPreviewValue} type="defaultSemiBold">
              {mode === 'year'
                ? `${year} 年`
                : mode === 'month'
                  ? formatYearMonth(year, month)
                  : buildIsoDateFromParts(year, month, day)}
            </ThemedText>
          </View>

          <View style={styles.periodPickerActions}>
            <Pressable onPress={onClose} style={[styles.periodPickerButton, styles.periodPickerGhostButton, { borderColor }]}>
              <ThemedText style={styles.periodPickerGhostText} type="defaultSemiBold">
                取消
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => onConfirm({ year, month: mode === 'year' ? undefined : month, day: mode === 'date' ? day : undefined })}
              style={[styles.periodPickerButton, { backgroundColor: accentColor }]}>
              <ThemedText style={styles.periodPickerPrimaryText} type="defaultSemiBold">
                确认
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function normalizeTopRows(rows: BusinessPartySummaryRow[], maxItems = 5) {
  return [...rows]
    .sort((a, b) => (b.amount ?? b.totalAmount ?? 0) - (a.amount ?? a.totalAmount ?? 0))
    .slice(0, maxItems)
    .map((row) => ({
      name: row.name,
      amount: row.amount ?? row.totalAmount ?? 0,
    }));
}

function toCashflowDailySeries(rows: BusinessCashflowRow[]) {
  const grouped = new Map<string, { inAmount: number; outAmount: number }>();
  rows.forEach((row) => {
    const date = row.postingDate || '未知日期';
    const prev = grouped.get(date) ?? { inAmount: 0, outAmount: 0 };
    if (row.direction === 'in') {
      prev.inAmount += row.amount || 0;
    } else if (row.direction === 'out') {
      prev.outAmount += row.amount || 0;
    }
    grouped.set(date, prev);
  });
  return [...grouped.entries()]
    .map(([date, amounts]) => ({ date, ...amounts }))
    .sort((a, b) => (a.date > b.date ? 1 : -1));
}

type CashflowTrendMode = 'daily' | 'weekly' | 'monthly';

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toCashflowTrendSeries(
  trendRows: BusinessCashflowTrendRow[],
  fallbackRows: BusinessCashflowRow[],
  mode: CashflowTrendMode,
  dateFrom: string,
  dateTo: string,
) {
  const trendMap = new Map(
    (trendRows || []).map((row) => [row.trendDate, { inAmount: row.inAmount || 0, outAmount: row.outAmount || 0 }]),
  );
  const dailyMapSource = trendMap.size
    ? trendMap
    : new Map(
        toCashflowDailySeries(fallbackRows).map((point) => [
          point.date,
          { inAmount: point.inAmount || 0, outAmount: point.outAmount || 0 },
        ]),
      );

  const fromDate = new Date(`${dateFrom}T00:00:00`);
  const toDate = new Date(`${dateTo}T00:00:00`);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || fromDate > toDate) {
    return [];
  }

  if (mode === 'daily') {
    const points: { key: string; label: string; inAmount: number; outAmount: number }[] = [];
    for (let d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
      const key = toIsoDateLocal(d);
      const entry = dailyMapSource.get(key) ?? { inAmount: 0, outAmount: 0 };
      points.push({
        key,
        label: key.slice(5),
        inAmount: entry.inAmount,
        outAmount: entry.outAmount,
      });
    }
    return points;
  }

  if (mode === 'weekly') {
    const points: { key: string; label: string; inAmount: number; outAmount: number }[] = [];
    for (let cursor = startOfWeek(fromDate); cursor <= toDate; cursor.setDate(cursor.getDate() + 7)) {
      const weekStart = new Date(cursor);
      const weekEnd = new Date(cursor);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const clampedStart = weekStart < fromDate ? new Date(fromDate) : weekStart;
      const clampedEnd = weekEnd > toDate ? new Date(toDate) : weekEnd;
      let inAmount = 0;
      let outAmount = 0;
      for (let d = new Date(clampedStart); d <= clampedEnd; d.setDate(d.getDate() + 1)) {
        const entry = dailyMapSource.get(toIsoDateLocal(d));
        inAmount += entry?.inAmount || 0;
        outAmount += entry?.outAmount || 0;
      }
      const key = toIsoDateLocal(weekStart);
      points.push({
        key,
        label: key.slice(5),
        inAmount,
        outAmount,
      });
    }
    return points;
  }

  const points: { key: string; label: string; inAmount: number; outAmount: number }[] = [];
  const monthCursor = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
  const monthEndLimit = new Date(toDate.getFullYear(), toDate.getMonth(), 1);
  for (; monthCursor <= monthEndLimit; monthCursor.setMonth(monthCursor.getMonth() + 1)) {
    const monthStart = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
    const monthEnd = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0);
    const clampedStart = monthStart < fromDate ? new Date(fromDate) : monthStart;
    const clampedEnd = monthEnd > toDate ? new Date(toDate) : monthEnd;
    let inAmount = 0;
    let outAmount = 0;
    for (let d = new Date(clampedStart); d <= clampedEnd; d.setDate(d.getDate() + 1)) {
      const entry = dailyMapSource.get(toIsoDateLocal(d));
      inAmount += entry?.inAmount || 0;
      outAmount += entry?.outAmount || 0;
    }
    const key = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`;
    points.push({
      key,
      label: `${String(monthStart.getMonth() + 1).padStart(2, '0')}月`,
      inAmount,
      outAmount,
    });
  }
  return points;
}

function resolveCashflowTrendMode(
  mode: AnalysisRangeMode,
  customRange: { dateFrom: string; dateTo: string },
): CashflowTrendMode {
  if (mode === 'month') {
    return 'daily';
  }
  if (mode === 'quarter') {
    return 'weekly';
  }
  if (mode === 'year') {
    return 'monthly';
  }
  const days = daysBetween(customRange.dateFrom, customRange.dateTo);
  if (days <= 31) {
    return 'daily';
  }
  if (days <= 180) {
    return 'weekly';
  }
  return 'monthly';
}

function toIsoDateLocal(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function buildTrendBuckets(
  dailyRows: BusinessReport['tables']['salesTrend'] | BusinessReport['tables']['purchaseTrend'],
  hourlyRows: BusinessReport['tables']['salesTrendHourly'] | BusinessReport['tables']['purchaseTrendHourly'],
  granularity: TrendGranularity,
  anchorDate: string,
) {
  const anchor = new Date(`${anchorDate || toIsoDate(new Date())}T00:00:00`);
  const dayMap = new Map((dailyRows || []).map((row) => [row.trendDate, row]));
  const hourMap = new Map((hourlyRows || []).map((row) => [row.trendHour, row]));

  if (granularity === 'day') {
    return Array.from({ length: 24 }, (_, hour) => ({
      key: `${hour}`,
      label: `${String(hour).padStart(2, '0')}:00`,
      amount: hourMap.get(hour)?.amount || 0,
      count: hourMap.get(hour)?.count || 0,
    }));
  }

  if (granularity === 'week') {
    const start = new Date(anchor);
    start.setDate(anchor.getDate() - 6);
    return Array.from({ length: 7 }, (_, index) => {
      const current = new Date(start);
      current.setDate(start.getDate() + index);
      const key = toIsoDateLocal(current);
      const row = dayMap.get(key);
      return {
        key,
        label: key.slice(5),
        amount: row?.amount || 0,
        count: row?.count || 0,
      };
    });
  }

  if (granularity === 'month') {
    const start = new Date(anchor);
    start.setDate(anchor.getDate() - 29);
    return Array.from({ length: 30 }, (_, index) => {
      const current = new Date(start);
      current.setDate(start.getDate() + index);
      const key = toIsoDateLocal(current);
      const row = dayMap.get(key);
      return {
        key,
        label: key.slice(5),
        amount: row?.amount || 0,
        count: row?.count || 0,
      };
    });
  }

  const monthMap = new Map<string, { amount: number; count: number }>();
  (dailyRows || []).forEach((row) => {
    const key = row.trendDate.slice(0, 7);
    const prev = monthMap.get(key) ?? { amount: 0, count: 0 };
    prev.amount += row.amount || 0;
    prev.count += row.count || 0;
    monthMap.set(key, prev);
  });
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(anchor.getFullYear(), anchor.getMonth() - 11 + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const row = monthMap.get(key);
    return {
      key,
      label: `${String(d.getMonth() + 1).padStart(2, '0')}月`,
      amount: row?.amount || 0,
      count: row?.count || 0,
    };
  });
}

function formatCompactAmount(value: number) {
  const abs = Math.abs(value);
  if (abs >= 100000000) {
    return `${(value / 100000000).toFixed(1)}亿`;
  }
  if (abs >= 10000) {
    return `${(value / 10000).toFixed(1)}万`;
  }
  return `${Math.round(value)}`;
}

function TrendScrollableChart({
  color,
  series,
  chartWidth,
}: {
  color: string;
  series: { label: string; amount: number }[];
  chartWidth: number;
}) {
  const maxValue = Math.max(...series.map((item) => item.amount), 1);
  const innerWidth = Math.max(Math.max(220, chartWidth - 32), series.length * 58);
  const totalAmount = series.reduce((sum, item) => sum + (item.amount || 0), 0);
  const avgAmount = totalAmount / Math.max(series.length, 1);
  const topPoint = series.reduce(
    (best, current) => (current.amount > best.amount ? current : best),
    { label: '-', amount: 0 },
  );

  return (
    <View style={styles.trendMobileWrap}>
      <View style={styles.trendMetricRow}>
        <View style={styles.trendMetricItem}>
          <ThemedText style={styles.trendMetricLabel}>总额</ThemedText>
          <ThemedText style={[styles.trendMetricValue, { color }]} type="defaultSemiBold">
            {formatMoney(totalAmount)}
          </ThemedText>
        </View>
        <View style={styles.trendMetricItem}>
          <ThemedText style={styles.trendMetricLabel}>均值</ThemedText>
          <ThemedText style={styles.trendMetricValue} type="defaultSemiBold">
            {formatMoney(avgAmount)}
          </ThemedText>
        </View>
        <View style={styles.trendMetricItem}>
          <ThemedText style={styles.trendMetricLabel}>峰值</ThemedText>
          <ThemedText numberOfLines={1} style={styles.trendMetricValue} type="defaultSemiBold">
            {`${topPoint.label} · ${formatCompactAmount(topPoint.amount)}`}
          </ThemedText>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator style={styles.trendScrollArea} contentContainerStyle={styles.trendScrollContent}>
        <View style={[styles.trendColumnsRow, { width: innerWidth }]}>
          {series.map((item) => {
            const heightRatio = maxValue > 0 ? item.amount / maxValue : 0;
            const barHeight = Math.max(4, Math.round(heightRatio * 130));
            return (
              <View key={`trend-column-${item.key}`} style={styles.trendColumnItem}>
                <ThemedText numberOfLines={1} style={styles.trendColumnValue}>
                  {formatCompactAmount(item.amount)}
                </ThemedText>
                <View style={styles.trendBarTrack}>
                  <View style={[styles.trendBarFill, { height: barHeight, backgroundColor: color }]} />
                </View>
                <ThemedText numberOfLines={1} style={styles.trendColumnLabel}>
                  {item.label}
                </ThemedText>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function ProductBubbleChartSection({
  title,
  hint,
  color,
  qtyLabel,
  rows,
  surface,
  borderColor,
}: {
  title: string;
  hint: string;
  color: string;
  qtyLabel: string;
  rows: BusinessReport['tables']['salesProductSummary'] | BusinessReport['tables']['purchaseProductSummary'];
  surface: string;
  borderColor: string;
}) {
  const displayRows = [...rows].slice(0, 8);
  const maxAmount = Math.max(...displayRows.map((row) => row.amount || 0), 1);

  return (
    <View style={[styles.chartCard, { backgroundColor: surface, borderColor }]}>
      <ThemedText style={styles.chartTitle} type="defaultSemiBold">
        {title}
      </ThemedText>
      <ThemedText style={styles.chartHint}>{hint}</ThemedText>
      {displayRows.length ? (
        <>
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator style={styles.productListScroll} contentContainerStyle={styles.productListScrollContent}>
            {displayRows.map((row, index) => (
              <View key={`${title}-summary-${row.itemKey}`} style={styles.productBarRow}>
                <View style={styles.productBarHeader}>
                  <ThemedText numberOfLines={1} style={styles.productBarName} type="defaultSemiBold">
                    {row.itemName}
                  </ThemedText>
                  <ThemedText style={[styles.productBarAmount, { color }]} type="defaultSemiBold">
                    {formatMoney(row.amount)}
                  </ThemedText>
                </View>
                <View style={styles.productBarTrack}>
                  <View
                    style={[
                      styles.productBarFill,
                      {
                        backgroundColor: color,
                        width: `${Math.max(5, ((row.amount || 0) / maxAmount) * 100)}%`,
                      },
                    ]}
                  />
                </View>
                <ThemedText style={styles.productBarMeta}>
                  {`#${index + 1} · ${qtyLabel} ${row.qty}`}
                </ThemedText>
              </View>
            ))}
          </ScrollView>
          <ThemedText style={styles.chartFootnote}>已按金额排序，条越长代表金额越高。可在此区域上下滚动查看。</ThemedText>
        </>
      ) : (
        <ThemedText style={styles.emptyText}>当前区间暂无商品数据。</ThemedText>
      )}
    </View>
  );
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
        <>
          <ThemedText style={styles.tableScrollHint}>{`共 ${rows.length} 条，区域内上下滑动查看更多`}</ThemedText>
          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator
            style={styles.tableScroll}
            contentContainerStyle={styles.tableScrollContent}>
            {rows.map((row) => (
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
            ))}
          </ScrollView>
        </>
      ) : (
        <ThemedText style={styles.emptyText}>当前筛选范围内暂无数据。</ThemedText>
      )}
    </View>
  );
}

function CashflowSection({
  rows,
  totalCount,
  hasMore,
  isLoadingMore,
  onLoadMore,
  surface,
  borderColor,
}: {
  rows: BusinessCashflowRow[];
  totalCount: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
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
        <>
          <ThemedText style={styles.tableScrollHint}>{`已加载 ${rows.length} / ${Math.max(totalCount, rows.length)} 条，区域内上下滑动查看更多`}</ThemedText>
          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator
            style={styles.tableScroll}
            contentContainerStyle={styles.tableScrollContent}>
            {rows.map((row) => {
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
            })}
          </ScrollView>
          {hasMore ? (
            <Pressable
              disabled={isLoadingMore}
              onPress={onLoadMore}
              style={[styles.tableLoadMoreButton, { borderColor, backgroundColor: surface }]}>
              <ThemedText style={styles.tableLoadMoreText} type="defaultSemiBold">
                {isLoadingMore ? '正在加载更多...' : `加载更多 (${rows.length}/${totalCount})`}
              </ThemedText>
            </Pressable>
          ) : null}
        </>
      ) : (
        <ThemedText style={styles.emptyText}>当前筛选范围内暂无资金流水。</ThemedText>
      )}
    </View>
  );
}

function CustomerPieSection({
  title,
  hint,
  color,
  emptyLabel,
  countLabel,
  rows,
  surface,
  borderColor,
}: {
  title: string;
  hint: string;
  color: string;
  emptyLabel: string;
  countLabel: string;
  rows: { name: string; amount: number }[];
  surface: string;
  borderColor: string;
}) {
  const displayRows = [...rows].slice(0, 8);
  const maxAmount = Math.max(...displayRows.map((row) => row.amount || 0), 1);
  const totalAmount = rows.reduce((sum, row) => sum + (row.amount || 0), 0);

  return (
    <View style={[styles.chartCard, { backgroundColor: surface, borderColor }]}>
      <ThemedText style={styles.chartTitle} type="defaultSemiBold">
        {title}
      </ThemedText>
      <ThemedText style={styles.chartHint}>{hint}</ThemedText>
      {displayRows.length ? (
        <>
          <View style={styles.distributionSummary}>
            <ThemedText style={styles.distributionSummaryLabel}>{`${countLabel}总额`}</ThemedText>
            <ThemedText style={[styles.distributionSummaryValue, { color }]} type="defaultSemiBold">
              {formatMoney(totalAmount)}
            </ThemedText>
          </View>
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator style={styles.productListScroll} contentContainerStyle={styles.productListScrollContent}>
            {displayRows.map((row, index) => {
              const pct = totalAmount > 0 ? ((row.amount || 0) / totalAmount) * 100 : 0;
              return (
                <View key={`${title}-distribution-${row.name}`} style={styles.productBarRow}>
                  <View style={styles.productBarHeader}>
                    <ThemedText numberOfLines={1} style={styles.productBarName} type="defaultSemiBold">
                      {row.name}
                    </ThemedText>
                    <ThemedText style={[styles.productBarAmount, { color }]} type="defaultSemiBold">
                      {formatMoney(row.amount)}
                    </ThemedText>
                  </View>
                  <View style={styles.productBarTrack}>
                    <View
                      style={[
                        styles.productBarFill,
                        {
                          backgroundColor: color,
                          width: `${Math.max(5, ((row.amount || 0) / maxAmount) * 100)}%`,
                        },
                      ]}
                    />
                  </View>
                  <ThemedText style={styles.productBarMeta}>{`#${index + 1} · 占比 ${pct.toFixed(1)}%`}</ThemedText>
                </View>
              );
            })}
          </ScrollView>
          <ThemedText style={styles.chartFootnote}>已按金额排序，条越长代表金额越高，可在此区域上下滚动查看更多。</ThemedText>
        </>
      ) : (
        <ThemedText style={styles.emptyText}>{emptyLabel}</ThemedText>
      )}
    </View>
  );
}

function CashflowContrastCard({
  rows,
  trendRows,
  surface,
  borderColor,
  rangeMode,
  onRangeModeChange,
  customRangeDraft,
  customRangeApplied,
  onCustomRangeDraftChange,
  onApplyCustomRange,
  customRangeError,
  isLoading,
}: {
  rows: BusinessCashflowRow[];
  trendRows: BusinessCashflowTrendRow[];
  surface: string;
  borderColor: string;
  rangeMode: AnalysisRangeMode;
  onRangeModeChange: (mode: AnalysisRangeMode) => void;
  customRangeDraft: CustomRangeDraftState;
  customRangeApplied: { dateFrom: string; dateTo: string };
  onCustomRangeDraftChange: (range: CustomRangeDraftState) => void;
  onApplyCustomRange: () => void;
  customRangeError: string;
  isLoading: boolean;
}) {
  const [chartWidth, setChartWidth] = useState(0);
  const trendMode = resolveCashflowTrendMode(rangeMode, customRangeApplied);
  const activeRange = rangeMode === 'custom' ? customRangeApplied : resolveDateRange(rangeMode);
  const series = toCashflowTrendSeries(trendRows, rows, trendMode, activeRange.dateFrom, activeRange.dateTo);
  const inAmount = series.reduce((sum, row) => sum + row.inAmount, 0);
  const outAmount = series.reduce((sum, row) => sum + row.outAmount, 0);
  const net = inAmount - outAmount;
  const maxValue = Math.max(...series.map((p) => Math.max(p.inAmount, p.outAmount)), 1);
  const innerWidth = Math.max(Math.max(220, chartWidth), Math.max(2, series.length) * 56);

  return (
    <View
      onLayout={(event) => setChartWidth(event.nativeEvent.layout.width - 32)}
      style={[styles.chartCard, { backgroundColor: surface, borderColor }]}>
      <ThemedText style={styles.chartTitle} type="defaultSemiBold">
        资金趋势图
      </ThemedText>
      <ThemedText style={styles.chartHint}>按流水记录自动聚合，绿色是收入，红色是支出。</ThemedText>
      <View style={styles.cashflowSummaryRow}>
        <View style={styles.cashflowSummaryItem}>
          <ThemedText style={styles.cashflowSummaryLabel}>收入</ThemedText>
          <ThemedText style={styles.cashflowSummaryIn} type="defaultSemiBold">
            {formatMoney(inAmount)}
          </ThemedText>
        </View>
        <View style={styles.cashflowSummaryItem}>
          <ThemedText style={styles.cashflowSummaryLabel}>支出</ThemedText>
          <ThemedText style={styles.cashflowSummaryOut} type="defaultSemiBold">
            {formatMoney(outAmount)}
          </ThemedText>
        </View>
        <View style={styles.cashflowSummaryItem}>
          <ThemedText style={styles.cashflowSummaryLabel}>净现金流</ThemedText>
          <ThemedText style={[styles.cashflowSummaryNet, net >= 0 ? styles.cashflowSummaryNetUp : styles.cashflowSummaryNetDown]} type="defaultSemiBold">
            {formatMoney(net)}
          </ThemedText>
        </View>
      </View>
      <View style={styles.moduleRangeRow}>
        {ANALYSIS_RANGE_OPTIONS.map((option) => {
          const active = rangeMode === option.value;
          return (
            <Pressable
              key={`cashflow-range-${option.value}`}
              onPress={() => onRangeModeChange(option.value)}
              style={[styles.moduleRangeChip, active ? styles.cashflowModeChipActive : null]}>
              <ThemedText style={[styles.moduleRangeText, active ? styles.moduleRangeTextActive : null]} type="defaultSemiBold">
                {option.label}
              </ThemedText>
            </Pressable>
          );
        })}
        {isLoading ? <ActivityIndicator size="small" color="#0F766E" /> : null}
      </View>
      {rangeMode === 'custom' ? (
        <CustomRangeEditor
          accentColor="#0F766E"
          appliedRange={customRangeApplied}
          borderColor={borderColor}
          draft={customRangeDraft as CustomRangeDraftState}
          error={customRangeError}
          onApply={onApplyCustomRange}
          onDraftChange={(next) => onCustomRangeDraftChange(next as typeof customRangeDraft)}
        />
      ) : null}
      <ThemedText style={styles.trendAutoLabel}>
        {`自动粒度：${trendMode === 'daily' ? '按日' : trendMode === 'weekly' ? '按周' : '按月'}`}
      </ThemedText>
      {series.length > 0 && chartWidth > 0 ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator style={styles.trendScrollArea} contentContainerStyle={styles.trendScrollContent}>
            <View style={[styles.cashflowBarsRow, { width: innerWidth }]}>
              {series.map((item) => {
                const inHeight = Math.max(2, Math.round((item.inAmount / maxValue) * 130));
                const outHeight = Math.max(2, Math.round((item.outAmount / maxValue) * 130));
                return (
                  <View key={`cashflow-col-${item.key}`} style={styles.cashflowBarCol}>
                    <View style={styles.cashflowBarValues}>
                      <ThemedText numberOfLines={1} style={styles.cashflowBarValueIn}>
                        {formatCompactAmount(item.inAmount)}
                      </ThemedText>
                      <ThemedText numberOfLines={1} style={styles.cashflowBarValueOut}>
                        {formatCompactAmount(item.outAmount)}
                      </ThemedText>
                    </View>
                    <View style={styles.cashflowBarTrackWrap}>
                      <View style={styles.cashflowBarTrack}>
                        <View style={[styles.cashflowBarFillIn, { height: inHeight }]} />
                      </View>
                      <View style={styles.cashflowBarTrack}>
                        <View style={[styles.cashflowBarFillOut, { height: outHeight }]} />
                      </View>
                    </View>
                    <ThemedText numberOfLines={1} style={styles.cashflowBarLabel}>
                      {item.label}
                    </ThemedText>
                  </View>
                );
              })}
            </View>
          </ScrollView>
          <View style={styles.lineLegendRow}>
            <View style={styles.lineLegendItem}>
              <View style={[styles.lineLegendSwatch, { backgroundColor: '#16A34A' }]} />
              <ThemedText style={styles.lineLegendLabel}>收入</ThemedText>
            </View>
            <View style={styles.lineLegendItem}>
              <View style={[styles.lineLegendSwatch, { backgroundColor: '#DC2626' }]} />
              <ThemedText style={styles.lineLegendLabel}>支出</ThemedText>
            </View>
            <ThemedText style={styles.lineLegendHint}>{`${activeRange.dateFrom} ~ ${activeRange.dateTo} · ${series.length} 个时间点`}</ThemedText>
          </View>
        </>
      ) : (
        <ThemedText style={styles.emptyText}>当前区间暂无资金流水，无法绘制趋势图。</ThemedText>
      )}
      <View style={[styles.netTag, { backgroundColor: net >= 0 ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)' }]}>
        <ThemedText
          style={[styles.netTagText, { color: net >= 0 ? '#166534' : '#991B1B' }]}
          type="defaultSemiBold">
          {`净现金流 ${formatMoney(net)}`}
        </ThemedText>
      </View>
    </View>
  );
}

function CustomRangeEditor({
  accentColor,
  borderColor,
  draft,
  appliedRange,
  error,
  onDraftChange,
  onApply,
}: {
  accentColor: string;
  borderColor: string;
  draft: CustomRangeDraftState;
  appliedRange: { dateFrom: string; dateTo: string };
  error: string;
  onDraftChange: (next: CustomRangeDraftState) => void;
  onApply: (nextDraft: CustomRangeDraftState) => void;
}) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerMode, setPickerMode] = useState<PeriodPickerMode>('date');
  const [pickerTarget, setPickerTarget] = useState<'dateFrom' | 'dateTo' | 'month' | 'year'>('dateFrom');

  const openDatePicker = (target: 'dateFrom' | 'dateTo') => {
    setPickerTarget(target);
    setPickerMode('date');
    setPickerVisible(true);
  };

  const openMonthPicker = () => {
    setPickerTarget('month');
    setPickerMode('month');
    setPickerVisible(true);
  };

  const openYearPicker = () => {
    setPickerTarget('year');
    setPickerMode('year');
    setPickerVisible(true);
  };

  const pickerSource =
    pickerTarget === 'dateFrom'
      ? parseIsoDateParts(draft.dateFrom)
      : pickerTarget === 'dateTo'
        ? parseIsoDateParts(draft.dateTo)
        : {
            year: Number(draft.year) || new Date().getFullYear(),
            month: Number(draft.month) || new Date().getMonth() + 1,
            day: 1,
          };

  const handlePickerConfirm = (value: { year: number; month?: number; day?: number }) => {
    let nextDraft: CustomRangeDraftState;
    if (pickerTarget === 'dateFrom' || pickerTarget === 'dateTo') {
      const nextDate = buildIsoDateFromParts(value.year, value.month ?? 1, value.day ?? 1);
      nextDraft = { ...draft, [pickerTarget]: nextDate };
    } else if (pickerTarget === 'month') {
      nextDraft = {
        ...draft,
        year: String(value.year),
        month: String(value.month ?? 1).padStart(2, '0'),
      };
    } else {
      nextDraft = {
        ...draft,
        year: String(value.year),
      };
    }
    onDraftChange(nextDraft);
    onApply(nextDraft);
    setPickerVisible(false);
  };

  return (
    <View style={[styles.moduleCustomRangeCard, { backgroundColor: '#F8FAFC', borderColor }]}>
      <View style={styles.customPeriodModeRow}>
        {CUSTOM_PERIOD_OPTIONS.map((option) => {
          const active = draft.mode === option.value;
          return (
            <Pressable
              key={`custom-period-${option.value}`}
              onPress={() => onDraftChange({ ...draft, mode: option.value })}
              style={[
                styles.customPeriodModeChip,
                active ? { backgroundColor: accentColor, borderColor: accentColor } : { borderColor, backgroundColor: '#FFFFFF' },
              ]}>
              <ThemedText style={[styles.customPeriodModeText, active ? styles.customPeriodModeTextActive : null]} type="defaultSemiBold">
                {option.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <ThemedText style={styles.customRangeHint}>{describeCustomDraft(draft, appliedRange)}</ThemedText>

      {draft.mode === 'date' ? (
        <View style={styles.customRangeGrid}>
          <PickerField borderColor={borderColor} label="开始日期" onPress={() => openDatePicker('dateFrom')} value={draft.dateFrom} />
          <PickerField borderColor={borderColor} label="结束日期" onPress={() => openDatePicker('dateTo')} value={draft.dateTo} />
        </View>
      ) : null}

      {draft.mode === 'month' ? (
        <PickerField
          borderColor={borderColor}
          label="查看月份"
          onPress={openMonthPicker}
          value={formatYearMonth(Number(draft.year) || new Date().getFullYear(), Number(draft.month) || new Date().getMonth() + 1)}
        />
      ) : null}

      {draft.mode === 'year' ? (
        <PickerField borderColor={borderColor} label="查看年份" onPress={openYearPicker} value={`${draft.year || new Date().getFullYear()} 年`} />
      ) : null}

      {error ? <ThemedText style={styles.customRangeError}>{error}</ThemedText> : null}

      <PeriodPickerModal
        accentColor={accentColor}
        initialDay={pickerSource.day}
        initialMonth={pickerSource.month}
        initialYear={pickerSource.year}
        mode={pickerMode}
        onClose={() => setPickerVisible(false)}
        onConfirm={handlePickerConfirm}
        title={
          pickerTarget === 'dateFrom'
            ? '选择开始日期'
            : pickerTarget === 'dateTo'
              ? '选择结束日期'
              : pickerTarget === 'month'
                ? '选择月份'
                : '选择年份'
        }
        visible={pickerVisible}
      />
    </View>
  );
}

export default function ReportsScreen() {
  const preferences = getAppPreferences();
  const { showError } = useFeedback();

  const [rangeMode, setRangeMode] = useState<RangeMode>('month');
  const initialRange = resolveDateRange('month');
  const [customRangeDraft, setCustomRangeDraft] = useState<CustomRangeDraftState>(createInitialCustomDraft(initialRange));
  const [customRangeApplied, setCustomRangeApplied] = useState<{ dateFrom: string; dateTo: string }>({
    dateFrom: initialRange.dateFrom,
    dateTo: initialRange.dateTo,
  });
  const [customRangeError, setCustomRangeError] = useState('');
  const [salesRangeMode, setSalesRangeMode] = useState<AnalysisRangeMode>('month');
  const [purchaseRangeMode, setPurchaseRangeMode] = useState<AnalysisRangeMode>('month');
  const [salesCustomRangeDraft, setSalesCustomRangeDraft] = useState<CustomRangeDraftState>(createInitialCustomDraft(initialRange));
  const [salesCustomRangeApplied, setSalesCustomRangeApplied] = useState<{ dateFrom: string; dateTo: string }>({
    dateFrom: initialRange.dateFrom,
    dateTo: initialRange.dateTo,
  });
  const [salesCustomRangeError, setSalesCustomRangeError] = useState('');
  const [purchaseCustomRangeDraft, setPurchaseCustomRangeDraft] = useState<CustomRangeDraftState>(createInitialCustomDraft(initialRange));
  const [purchaseCustomRangeApplied, setPurchaseCustomRangeApplied] = useState<{ dateFrom: string; dateTo: string }>({
    dateFrom: initialRange.dateFrom,
    dateTo: initialRange.dateTo,
  });
  const [purchaseCustomRangeError, setPurchaseCustomRangeError] = useState('');
  const [cashflowRangeMode, setCashflowRangeMode] = useState<AnalysisRangeMode>('month');
  const [cashflowCustomRangeDraft, setCashflowCustomRangeDraft] = useState<CustomRangeDraftState>(createInitialCustomDraft(initialRange));
  const [cashflowCustomRangeApplied, setCashflowCustomRangeApplied] = useState<{ dateFrom: string; dateTo: string }>({
    dateFrom: initialRange.dateFrom,
    dateTo: initialRange.dateTo,
  });
  const [cashflowCustomRangeError, setCashflowCustomRangeError] = useState('');
  const [salesAnalysisView, setSalesAnalysisView] = useState<SalesAnalysisView>('amount');
  const [purchaseAnalysisView, setPurchaseAnalysisView] = useState<PurchaseAnalysisView>('amount');
  const [salesTrendWidth, setSalesTrendWidth] = useState(0);
  const [purchaseTrendWidth, setPurchaseTrendWidth] = useState(0);
  const [queryCompany, setQueryCompany] = useState<string | null>(preferences.defaultCompany);
  const [report, setReport] = useState<BusinessReport>(EMPTY_REPORT);
  const [salesAnalysisReport, setSalesAnalysisReport] = useState<BusinessReport>(EMPTY_REPORT);
  const [purchaseAnalysisReport, setPurchaseAnalysisReport] = useState<BusinessReport>(EMPTY_REPORT);
  const [cashflowReport, setCashflowReport] = useState<CashflowReport>(EMPTY_CASHFLOW_REPORT);
  const [cashflowEntries, setCashflowEntries] = useState<CashflowEntriesPage>(EMPTY_CASHFLOW_ENTRIES);
  const [isLoading, setIsLoading] = useState(false);
  const [isSalesLoading, setIsSalesLoading] = useState(false);
  const [isPurchaseLoading, setIsPurchaseLoading] = useState(false);
  const [isCashflowLoading, setIsCashflowLoading] = useState(false);
  const [isCashflowLoadingMore, setIsCashflowLoadingMore] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [companyQuery, setCompanyQuery] = useState('');
  const [companyOptions, setCompanyOptions] = useState<LinkOption[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    sales: false,
    purchase: false,
    receivable: false,
    payable: false,
    cashflow: false,
  });
  const hasMountedFiltersRef = useRef(false);

  const surface = useThemeColor({}, 'surface');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const background = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');
  const salesTopRows = normalizeTopRows(salesAnalysisReport.tables.salesSummary);
  const purchaseTopRows = normalizeTopRows(purchaseAnalysisReport.tables.purchaseSummary);
  const salesTrendGranularity = resolveAutoGranularity(salesRangeMode, salesCustomRangeApplied);
  const purchaseTrendGranularity = resolveAutoGranularity(purchaseRangeMode, purchaseCustomRangeApplied);
  const salesTrendSeries = buildTrendBuckets(
    salesAnalysisReport.tables.salesTrend || [],
    salesAnalysisReport.tables.salesTrendHourly || [],
    salesTrendGranularity,
    salesAnalysisReport.meta.dateTo || '',
  );
  const purchaseTrendSeries = buildTrendBuckets(
    purchaseAnalysisReport.tables.purchaseTrend || [],
    purchaseAnalysisReport.tables.purchaseTrendHourly || [],
    purchaseTrendGranularity,
    purchaseAnalysisReport.meta.dateTo || '',
  );
  const salesCollectionRate =
    salesAnalysisReport.overview.salesAmountTotal > 0
      ? `${((salesAnalysisReport.overview.receivedAmountTotal / salesAnalysisReport.overview.salesAmountTotal) * 100).toFixed(1)}%`
      : '0.0%';
  const purchasePaymentRate =
    purchaseAnalysisReport.overview.purchaseAmountTotal > 0
      ? `${((purchaseAnalysisReport.overview.paidAmountTotal / purchaseAnalysisReport.overview.purchaseAmountTotal) * 100).toFixed(1)}%`
      : '0.0%';
  const toggleSection = useCallback((key: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const loadReport = useCallback(async () => {
    const { dateFrom, dateTo } =
      rangeMode === 'custom' ? customRangeApplied : resolveDateRange(rangeMode);
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
  }, [customRangeApplied, queryCompany, rangeMode, showError]);

  const loadSalesAnalysisReport = useCallback(async () => {
    const { dateFrom, dateTo } =
      salesRangeMode === 'custom' ? salesCustomRangeApplied : resolveDateRange(salesRangeMode);
    try {
      setIsSalesLoading(true);
      const next = await fetchSalesReport({
        company: queryCompany,
        dateFrom,
        dateTo,
        limit: 8,
      });
      setSalesAnalysisReport(next);
    } catch (error) {
      showError(normalizeAppError(error).message);
    } finally {
      setIsSalesLoading(false);
    }
  }, [queryCompany, salesCustomRangeApplied, salesRangeMode, showError]);

  const loadPurchaseAnalysisReport = useCallback(async () => {
    const { dateFrom, dateTo } =
      purchaseRangeMode === 'custom' ? purchaseCustomRangeApplied : resolveDateRange(purchaseRangeMode);
    try {
      setIsPurchaseLoading(true);
      const next = await fetchPurchaseReport({
        company: queryCompany,
        dateFrom,
        dateTo,
        limit: 8,
      });
      setPurchaseAnalysisReport(next);
    } catch (error) {
      showError(normalizeAppError(error).message);
    } finally {
      setIsPurchaseLoading(false);
    }
  }, [purchaseCustomRangeApplied, purchaseRangeMode, queryCompany, showError]);

  const loadCashflowReport = useCallback(async () => {
    const { dateFrom, dateTo } =
      cashflowRangeMode === 'custom' ? cashflowCustomRangeApplied : resolveDateRange(cashflowRangeMode);
    try {
      setIsCashflowLoading(true);
      const [nextReport, nextEntries] = await Promise.all([
        fetchCashflowReport({
          company: queryCompany,
          dateFrom,
          dateTo,
        }),
        fetchCashflowEntries({
          company: queryCompany,
          dateFrom,
          dateTo,
          page: 1,
          pageSize: CASHFLOW_ENTRIES_PAGE_SIZE,
        }),
      ]);
      setCashflowReport(nextReport);
      setCashflowEntries(nextEntries);
    } catch (error) {
      showError(normalizeAppError(error).message);
    } finally {
      setIsCashflowLoading(false);
    }
  }, [cashflowCustomRangeApplied, cashflowRangeMode, queryCompany, showError]);

  const loadMoreCashflowEntries = useCallback(async () => {
    if (isCashflowLoadingMore || !cashflowEntries.pagination.hasMore) {
      return;
    }

    const { dateFrom, dateTo } =
      cashflowRangeMode === 'custom' ? cashflowCustomRangeApplied : resolveDateRange(cashflowRangeMode);

    try {
      setIsCashflowLoadingMore(true);
      const nextPage = cashflowEntries.pagination.page + 1;
      const nextEntries = await fetchCashflowEntries({
        company: queryCompany,
        dateFrom,
        dateTo,
        page: nextPage,
        pageSize: cashflowEntries.pagination.pageSize || CASHFLOW_ENTRIES_PAGE_SIZE,
      });

      setCashflowEntries((current) => {
        const seen = new Set(current.rows.map((row) => row.name ?? `${row.postingDate}-${row.party}-${row.amount}`));
        const mergedRows = [
          ...current.rows,
          ...nextEntries.rows.filter((row) => !seen.has(row.name ?? `${row.postingDate}-${row.party}-${row.amount}`)),
        ];
        return {
          ...nextEntries,
          rows: mergedRows,
        };
      });
    } catch (error) {
      showError(normalizeAppError(error).message);
    } finally {
      setIsCashflowLoadingMore(false);
    }
  }, [
    cashflowCustomRangeApplied,
    cashflowEntries.pagination.hasMore,
    cashflowEntries.pagination.page,
    cashflowEntries.pagination.pageSize,
    cashflowRangeMode,
    isCashflowLoadingMore,
    queryCompany,
    showError,
  ]);

  useFocusEffect(
    useCallback(() => {
      void loadReport();
      void loadSalesAnalysisReport();
      void loadPurchaseAnalysisReport();
      void loadCashflowReport();
    }, [loadCashflowReport, loadPurchaseAnalysisReport, loadReport, loadSalesAnalysisReport]),
  );

  useEffect(() => {
    if (!hasMountedFiltersRef.current) {
      hasMountedFiltersRef.current = true;
      return;
    }
    void loadReport();
  }, [loadReport, queryCompany, rangeMode]);

  useEffect(() => {
    void loadSalesAnalysisReport();
  }, [loadSalesAnalysisReport, queryCompany, salesRangeMode]);

  useEffect(() => {
    void loadPurchaseAnalysisReport();
  }, [loadPurchaseAnalysisReport, purchaseRangeMode, queryCompany]);

  useEffect(() => {
    void loadCashflowReport();
  }, [cashflowRangeMode, loadCashflowReport, queryCompany]);

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

  const applyCustomRange = useCallback((draftOverride?: CustomRangeDraftState) => {
    const resolved = resolveCustomDraftRange(draftOverride ?? customRangeDraft);
    if (resolved.error || !resolved.dateFrom || !resolved.dateTo) {
      setCustomRangeError(resolved.error || '请检查时间范围。');
      return;
    }
    setCustomRangeError('');
    setCustomRangeApplied({ dateFrom: resolved.dateFrom, dateTo: resolved.dateTo });
    setRangeMode('custom');
  }, [customRangeDraft]);

  const applySalesCustomRange = useCallback((draftOverride?: CustomRangeDraftState) => {
    const resolved = resolveCustomDraftRange(draftOverride ?? salesCustomRangeDraft);
    if (resolved.error || !resolved.dateFrom || !resolved.dateTo) {
      setSalesCustomRangeError(resolved.error || '请检查时间范围。');
      return;
    }
    setSalesCustomRangeError('');
    setSalesCustomRangeApplied({ dateFrom: resolved.dateFrom, dateTo: resolved.dateTo });
    setSalesRangeMode('custom');
  }, [salesCustomRangeDraft]);

  const applyPurchaseCustomRange = useCallback((draftOverride?: CustomRangeDraftState) => {
    const resolved = resolveCustomDraftRange(draftOverride ?? purchaseCustomRangeDraft);
    if (resolved.error || !resolved.dateFrom || !resolved.dateTo) {
      setPurchaseCustomRangeError(resolved.error || '请检查时间范围。');
      return;
    }
    setPurchaseCustomRangeError('');
    setPurchaseCustomRangeApplied({ dateFrom: resolved.dateFrom, dateTo: resolved.dateTo });
    setPurchaseRangeMode('custom');
  }, [purchaseCustomRangeDraft]);

  const applyCashflowCustomRange = useCallback((draftOverride?: CustomRangeDraftState) => {
    const resolved = resolveCustomDraftRange(draftOverride ?? cashflowCustomRangeDraft);
    if (resolved.error || !resolved.dateFrom || !resolved.dateTo) {
      setCashflowCustomRangeError(resolved.error || '请检查时间范围。');
      return;
    }
    setCashflowCustomRangeError('');
    setCashflowCustomRangeApplied({ dateFrom: resolved.dateFrom, dateTo: resolved.dateTo });
    setCashflowRangeMode('custom');
  }, [cashflowCustomRangeDraft]);

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
                {report.meta.dateFrom && report.meta.dateTo ? `${report.meta.dateFrom} ~ ${report.meta.dateTo}` : '本月'}
              </ThemedText>
            </View>
          </View>

          <View style={styles.filterRow}>
            {RANGE_OPTIONS.map((option) => {
              const active = option.value === rangeMode;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    setCustomRangeError('');
                    setRangeMode(option.value);
                  }}
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

          {rangeMode === 'custom' ? (
            <View style={[styles.customRangeCard, { backgroundColor: surfaceMuted, borderColor }]}>
              <ThemedText style={styles.customRangeTitle} type="defaultSemiBold">
                自定义时间区间
              </ThemedText>
              <CustomRangeEditor
                accentColor={tintColor}
                appliedRange={customRangeApplied}
                borderColor={borderColor}
                draft={customRangeDraft}
                error={customRangeError}
                onApply={applyCustomRange}
                onDraftChange={setCustomRangeDraft}
              />
            </View>
          ) : null}

          <View style={styles.toolbarRow}>
            <Pressable onPress={() => setPickerVisible(true)} style={[styles.toolbarButton, { backgroundColor: surfaceMuted, borderColor }]}>
              <ThemedText style={styles.toolbarLabel}>查询公司</ThemedText>
              <ThemedText style={styles.toolbarValue} type="defaultSemiBold">
                {queryCompany || '全部公司'}
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => {
                void loadReport();
                void loadSalesAnalysisReport();
                void loadPurchaseAnalysisReport();
                void loadCashflowReport();
              }}
              style={[styles.refreshButton, { backgroundColor: tintColor }]}>
              {isLoading || isSalesLoading || isPurchaseLoading || isCashflowLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <IconSymbol name="arrow.clockwise" size={18} color="#FFFFFF" />
              )}
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

        <View style={[styles.salesModuleCard, { backgroundColor: surface, borderColor }]}>
          <View style={styles.salesModuleHeader}>
            <ThemedText style={styles.salesModuleTitle} type="defaultSemiBold">
              销售分析
            </ThemedText>
            <ThemedText style={styles.salesModuleHint}>切换不同视角，查看销售结构与趋势。</ThemedText>
          </View>
          <View style={styles.salesTabs}>
            {(
              [
                ['amount', '销售额'],
                ['customer', '客户'],
                ['trend', '趋势'],
                ['product', '商品'],
              ] as const
            ).map(([key, label]) => {
              const active = salesAnalysisView === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setSalesAnalysisView(key)}
                  style={[
                    styles.salesTab,
                    active ? { backgroundColor: tintColor, borderColor: tintColor } : { backgroundColor: surfaceMuted, borderColor },
                  ]}>
                  <ThemedText style={[styles.salesTabText, active ? styles.salesTabTextActive : null]} type="defaultSemiBold">
                    {label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.moduleRangeRow}>
            {ANALYSIS_RANGE_OPTIONS.map((option) => {
              const active = salesRangeMode === option.value;
              return (
                <Pressable
                  key={`sales-range-${option.value}`}
                  onPress={() => {
                    setSalesCustomRangeError('');
                    setSalesRangeMode(option.value);
                  }}
                  style={[styles.moduleRangeChip, active ? styles.moduleRangeChipActive : null]}>
                  <ThemedText style={[styles.moduleRangeText, active ? styles.moduleRangeTextActive : null]} type="defaultSemiBold">
                    {option.label}
                  </ThemedText>
                </Pressable>
              );
            })}
            {isSalesLoading ? <ActivityIndicator size="small" color={tintColor} /> : null}
          </View>
          {salesRangeMode === 'custom' ? (
            <CustomRangeEditor
              accentColor={tintColor}
              appliedRange={salesCustomRangeApplied}
              borderColor={borderColor}
              draft={salesCustomRangeDraft}
              error={salesCustomRangeError}
              onApply={applySalesCustomRange}
              onDraftChange={setSalesCustomRangeDraft}
            />
          ) : null}

          {salesAnalysisView === 'amount' ? (
            <View style={styles.salesAmountGrid}>
              <OverviewMetric accent="#2563EB" label="销售总额" value={formatMoney(salesAnalysisReport.overview.salesAmountTotal)} />
              <OverviewMetric accent="#16A34A" label="已收金额" value={formatMoney(salesAnalysisReport.overview.receivedAmountTotal)} />
              <OverviewMetric accent="#B45309" label="应收未结" value={formatMoney(salesAnalysisReport.overview.receivableOutstandingTotal)} />
              <OverviewMetric accent="#0F766E" label="回款率" value={salesCollectionRate} />
            </View>
          ) : null}

          {salesAnalysisView === 'customer' ? (
            <CustomerPieSection
              borderColor={borderColor}
              color="#2563EB"
              countLabel="客户"
              emptyLabel="当前筛选范围内暂无客户销售数据。"
              hint="客户贡献分布一图看清，右侧保留精确金额。"
              rows={salesTopRows}
              surface={surface}
              title="客户销售分布"
            />
          ) : null}

          {salesAnalysisView === 'trend' ? (
            <View
              onLayout={(event) => setSalesTrendWidth(Math.max(220, event.nativeEvent.layout.width - 10))}
              style={styles.salesTrendCard}>
              <ThemedText style={styles.trendAutoLabel}>{`自动粒度：${granularityLabel(salesTrendGranularity)}`}</ThemedText>
              {salesTrendSeries.length > 1 ? (
                <>
                  <ThemedText style={styles.trendScrollHint}>左右滑动可查看完整时间轴</ThemedText>
                  <TrendScrollableChart chartWidth={salesTrendWidth} color="#2563EB" series={salesTrendSeries} />
                </>
              ) : (
                <View style={styles.singleDayCard}>
                  <ThemedText style={styles.singleDayLabel}>销售趋势样本</ThemedText>
                  <ThemedText style={styles.singleDayDate} type="defaultSemiBold">
                    {salesTrendSeries[0]?.key || '暂无'}
                  </ThemedText>
                  <View style={styles.singleDaySplit}>
                    <View style={styles.singleDayMetric}>
                      <ThemedText style={styles.singleDayMeta}>订单数</ThemedText>
                      <ThemedText style={styles.singleDayIn} type="defaultSemiBold">
                        {String(salesTrendSeries[0]?.count || 0)}
                      </ThemedText>
                    </View>
                    <View style={styles.singleDayMetric}>
                      <ThemedText style={styles.singleDayMeta}>销售额</ThemedText>
                      <ThemedText style={styles.singleDayOut} type="defaultSemiBold">
                        {formatMoney(salesTrendSeries[0]?.amount || 0)}
                      </ThemedText>
                    </View>
                  </View>
                </View>
              )}
            </View>
          ) : null}

          {salesAnalysisView === 'product' ? (
            <ProductBubbleChartSection
              borderColor={borderColor}
              color="#2563EB"
              hint="按商品金额排序，条形分布更适合手机端快速比较。"
              qtyLabel="销量"
              rows={salesAnalysisReport.tables.salesProductSummary || []}
              surface={surface}
              title="商品销售分布"
            />
          ) : null}
        </View>

        <View style={[styles.salesModuleCard, { backgroundColor: surface, borderColor }]}>
          <View style={styles.salesModuleHeader}>
            <ThemedText style={styles.salesModuleTitle} type="defaultSemiBold">
              采购分析
            </ThemedText>
            <ThemedText style={styles.salesModuleHint}>切换不同视角，查看采购结构与走势。</ThemedText>
          </View>
          <View style={styles.salesTabs}>
            {(
              [
                ['amount', '采购额'],
                ['supplier', '供应商'],
                ['trend', '趋势'],
                ['product', '商品'],
              ] as const
            ).map(([key, label]) => {
              const active = purchaseAnalysisView === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setPurchaseAnalysisView(key)}
                  style={[
                    styles.salesTab,
                    active ? { backgroundColor: '#EA580C', borderColor: '#EA580C' } : { backgroundColor: surfaceMuted, borderColor },
                  ]}>
                  <ThemedText style={[styles.salesTabText, active ? styles.salesTabTextActive : null]} type="defaultSemiBold">
                    {label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.moduleRangeRow}>
            {ANALYSIS_RANGE_OPTIONS.map((option) => {
              const active = purchaseRangeMode === option.value;
              return (
                <Pressable
                  key={`purchase-range-${option.value}`}
                  onPress={() => {
                    setPurchaseCustomRangeError('');
                    setPurchaseRangeMode(option.value);
                  }}
                  style={[styles.moduleRangeChip, active ? styles.moduleRangeChipActiveOrange : null]}>
                  <ThemedText style={[styles.moduleRangeText, active ? styles.moduleRangeTextActive : null]} type="defaultSemiBold">
                    {option.label}
                  </ThemedText>
                </Pressable>
              );
            })}
            {isPurchaseLoading ? <ActivityIndicator size="small" color="#EA580C" /> : null}
          </View>
          {purchaseRangeMode === 'custom' ? (
            <CustomRangeEditor
              accentColor="#EA580C"
              appliedRange={purchaseCustomRangeApplied}
              borderColor={borderColor}
              draft={purchaseCustomRangeDraft}
              error={purchaseCustomRangeError}
              onApply={applyPurchaseCustomRange}
              onDraftChange={setPurchaseCustomRangeDraft}
            />
          ) : null}

          {purchaseAnalysisView === 'amount' ? (
            <View style={styles.salesAmountGrid}>
              <OverviewMetric accent="#EA580C" label="采购总额" value={formatMoney(purchaseAnalysisReport.overview.purchaseAmountTotal)} />
              <OverviewMetric accent="#DC2626" label="已付金额" value={formatMoney(purchaseAnalysisReport.overview.paidAmountTotal)} />
              <OverviewMetric accent="#7C3AED" label="应付未结" value={formatMoney(purchaseAnalysisReport.overview.payableOutstandingTotal)} />
              <OverviewMetric accent="#B45309" label="付款率" value={purchasePaymentRate} />
            </View>
          ) : null}

          {purchaseAnalysisView === 'supplier' ? (
            <CustomerPieSection
              borderColor={borderColor}
              color="#EA580C"
              countLabel="供应商"
              emptyLabel="当前筛选范围内暂无供应商采购数据。"
              hint="供应商采购额分布一图看清，右侧保留精确金额。"
              rows={purchaseTopRows}
              surface={surface}
              title="供应商采购分布"
            />
          ) : null}

          {purchaseAnalysisView === 'trend' ? (
            <View
              onLayout={(event) => setPurchaseTrendWidth(Math.max(220, event.nativeEvent.layout.width - 10))}
              style={styles.salesTrendCard}>
              <ThemedText style={styles.trendAutoLabel}>{`自动粒度：${granularityLabel(purchaseTrendGranularity)}`}</ThemedText>
              {purchaseTrendSeries.length > 1 ? (
                <>
                  <ThemedText style={styles.trendScrollHint}>左右滑动可查看完整时间轴</ThemedText>
                  <TrendScrollableChart chartWidth={purchaseTrendWidth} color="#EA580C" series={purchaseTrendSeries} />
                </>
              ) : (
                <View style={styles.singleDayCard}>
                  <ThemedText style={styles.singleDayLabel}>采购趋势样本</ThemedText>
                  <ThemedText style={styles.singleDayDate} type="defaultSemiBold">
                    {purchaseTrendSeries[0]?.key || '暂无'}
                  </ThemedText>
                  <View style={styles.singleDaySplit}>
                    <View style={styles.singleDayMetric}>
                      <ThemedText style={styles.singleDayMeta}>订单数</ThemedText>
                      <ThemedText style={styles.singleDayIn} type="defaultSemiBold">
                        {String(purchaseTrendSeries[0]?.count || 0)}
                      </ThemedText>
                    </View>
                    <View style={styles.singleDayMetric}>
                      <ThemedText style={styles.singleDayMeta}>采购额</ThemedText>
                      <ThemedText style={styles.singleDayOut} type="defaultSemiBold">
                        {formatMoney(purchaseTrendSeries[0]?.amount || 0)}
                      </ThemedText>
                    </View>
                  </View>
                </View>
              )}
            </View>
          ) : null}

          {purchaseAnalysisView === 'product' ? (
            <ProductBubbleChartSection
              borderColor={borderColor}
              color="#EA580C"
              hint="按商品采购金额排序，条形分布更适合手机端快速比较。"
              qtyLabel="采购量"
              rows={purchaseAnalysisReport.tables.purchaseProductSummary || []}
              surface={surface}
              title="商品采购分布"
            />
          ) : null}
        </View>

        <CashflowContrastCard
          borderColor={borderColor}
          customRangeDraft={cashflowCustomRangeDraft}
          customRangeApplied={cashflowCustomRangeApplied}
          customRangeError={cashflowCustomRangeError}
          isLoading={isCashflowLoading}
          onApplyCustomRange={applyCashflowCustomRange}
          onCustomRangeDraftChange={setCashflowCustomRangeDraft}
          onRangeModeChange={(mode) => {
            setCashflowCustomRangeError('');
            setCashflowRangeMode(mode);
          }}
          rangeMode={cashflowRangeMode}
          rows={cashflowEntries.rows}
          trendRows={cashflowReport.trend}
          surface={surface}
        />

        <View style={[styles.foldCard, { backgroundColor: surface, borderColor }]}>
          {(
            [
              ['sales', '销售汇总表', '客户聚合明细'],
              ['purchase', '采购汇总表', '供应商聚合明细'],
              ['receivable', '应收账款表', '客户应收压力'],
              ['payable', '应付账款表', '供应商应付结构'],
              ['cashflow', '资金流水', '收支流水明细'],
            ] as const
          ).map(([key, title, subtitle]) => (
            <Pressable key={key} onPress={() => toggleSection(key)} style={styles.foldRow}>
              <View style={styles.foldCopy}>
                <ThemedText style={styles.foldTitle} type="defaultSemiBold">
                  {title}
                </ThemedText>
                <ThemedText style={styles.foldSubtitle}>{subtitle}</ThemedText>
              </View>
              <View style={[styles.foldBadge, { backgroundColor: expandedSections[key] ? 'rgba(37,99,235,0.18)' : 'rgba(148,163,184,0.2)' }]}>
                <ThemedText style={[styles.foldBadgeText, expandedSections[key] ? styles.foldBadgeTextActive : null]} type="defaultSemiBold">
                  {expandedSections[key] ? '收起' : '展开'}
                </ThemedText>
              </View>
            </Pressable>
          ))}
        </View>

        {expandedSections.sales ? (
          <PartyTableSection
            amountLabel="销售额"
            amountTone="#2563EB"
            borderColor={borderColor}
            hint="按客户聚合，看谁贡献最多销售额。"
            rows={report.tables.salesSummary}
            surface={surface}
            title="销售汇总表"
          />
        ) : null}
        {expandedSections.purchase ? (
          <PartyTableSection
            amountLabel="采购额"
            amountTone="#EA580C"
            borderColor={borderColor}
            hint="按供应商聚合，看采购金额集中在哪些供应商。"
            rows={report.tables.purchaseSummary}
            surface={surface}
            title="采购汇总表"
          />
        ) : null}
        {expandedSections.receivable ? (
          <PartyTableSection
            amountLabel="应收总额"
            amountTone="#B45309"
            borderColor={borderColor}
            hint="按客户聚合，看未结应收压力。"
            rows={report.tables.receivableSummary}
            surface={surface}
            title="应收账款表"
          />
        ) : null}
        {expandedSections.payable ? (
          <PartyTableSection
            amountLabel="应付总额"
            amountTone="#7C3AED"
            borderColor={borderColor}
            hint="按供应商聚合，看待付款结构。"
            rows={report.tables.payableSummary}
            surface={surface}
            title="应付账款表"
          />
        ) : null}
        {expandedSections.cashflow ? (
          <CashflowSection
            borderColor={borderColor}
            hasMore={cashflowEntries.pagination.hasMore}
            isLoadingMore={isCashflowLoadingMore}
            onLoadMore={() => {
              void loadMoreCashflowEntries();
            }}
            rows={cashflowEntries.rows}
            surface={surface}
            totalCount={cashflowEntries.pagination.totalCount}
          />
        ) : null}

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
  customRangeCard: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    marginTop: 12,
    padding: 12,
  },
  customRangeTitle: {
    fontSize: 14,
  },
  customRangeGrid: {
    gap: 10,
  },
  customPeriodModeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  customPeriodModeChip: {
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 76,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  customPeriodModeText: {
    color: '#475569',
    fontSize: 12,
    textAlign: 'center',
  },
  customPeriodModeTextActive: {
    color: '#FFFFFF',
  },
  customRangeHint: {
    color: '#64748B',
    fontSize: 12,
  },
  quickPeriodLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  pickerField: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    minHeight: 54,
    paddingHorizontal: 14,
  },
  pickerFieldValue: {
    color: '#0F172A',
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
  },
  pickerFieldAction: {
    color: '#2563EB',
    fontSize: 14,
  },
  customRangeError: {
    color: '#DC2626',
    fontSize: 12,
  },
  customRangeApply: {
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 12,
  },
  customRangeApplyText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  periodPickerBackdrop: {
    backgroundColor: 'rgba(15, 23, 42, 0.36)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  periodPickerSheet: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 18,
  },
  periodPickerTitle: {
    fontSize: 20,
  },
  periodPickerHint: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 19,
  },
  periodPickerColumns: {
    flexDirection: 'row',
    gap: 10,
  },
  periodPickerColumn: {
    flex: 1,
    gap: 8,
  },
  periodPickerLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  periodPickerScroller: {
    borderRadius: 16,
    borderWidth: 1,
    maxHeight: 240,
  },
  periodPickerList: {
    gap: 8,
    padding: 10,
  },
  periodPickerEdgeSpacer: {
    height: PERIOD_PICKER_CENTER_PADDING,
  },
  periodPickerOption: {
    alignItems: 'center',
    borderRadius: 12,
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  periodPickerOptionText: {
    fontSize: 14,
  },
  periodPickerOptionTextActive: {
    color: '#FFFFFF',
  },
  periodPickerPreview: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  periodPickerPreviewLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  periodPickerPreviewValue: {
    color: '#0F172A',
    fontSize: 16,
  },
  periodPickerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  periodPickerButton: {
    alignItems: 'center',
    borderRadius: 14,
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
  },
  periodPickerGhostButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
  },
  periodPickerGhostText: {
    color: '#475569',
    fontSize: 14,
  },
  periodPickerPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
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
  chartCard: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  chartTitle: {
    fontSize: 20,
  },
  chartHint: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 4,
  },
  chartRow: {
    gap: 8,
  },
  chartAxisLabel: {
    color: '#64748B',
    fontSize: 10,
  },
  mobileBars: {
    gap: 8,
  },
  mobileBarRow: {
    gap: 5,
  },
  mobileBarHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  mobileBarName: {
    color: '#334155',
    flex: 1,
    fontSize: 12,
    marginRight: 8,
  },
  mobileBarAmount: {
    fontSize: 12,
  },
  mobileBarTrack: {
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    height: 7,
    overflow: 'hidden',
  },
  mobileBarFill: {
    borderRadius: 999,
    height: 7,
  },
  pieWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    marginTop: 2,
  },
  pieCenter: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 76,
    minWidth: 76,
    paddingHorizontal: 8,
    position: 'absolute',
  },
  pieCenterLabel: {
    color: '#64748B',
    fontSize: 10,
  },
  pieCenterValue: {
    color: '#0F172A',
    fontSize: 11,
    marginTop: 2,
    textAlign: 'center',
  },
  distributionSummary: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  distributionSummaryLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  distributionSummaryValue: {
    fontSize: 16,
  },
  pieLegend: {
    gap: 8,
  },
  pieLegendRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pieLegendMain: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    marginRight: 10,
  },
  pieLegendDot: {
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  pieLegendRank: {
    color: '#64748B',
    fontSize: 12,
    width: 14,
  },
  pieLegendName: {
    color: '#1E293B',
    flex: 1,
    fontSize: 13,
  },
  pieLegendRight: {
    alignItems: 'flex-end',
  },
  pieLegendPct: {
    color: '#64748B',
    fontSize: 11,
  },
  pieLegendAmt: {
    color: '#0F172A',
    fontSize: 12,
  },
  chartFootnote: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 4,
  },
  rankList: {
    gap: 9,
    marginTop: 10,
  },
  rankRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rankMain: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    marginRight: 12,
  },
  rankIndexDot: {
    alignItems: 'center',
    borderRadius: 999,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  rankIndexText: {
    fontSize: 12,
  },
  rankCopy: {
    flex: 1,
  },
  rankName: {
    color: '#1E293B',
    fontSize: 13,
  },
  rankMeta: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  rankAmount: {
    fontSize: 13,
  },
  singleDayCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    gap: 8,
    marginTop: 4,
    padding: 12,
  },
  singleDayLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  singleDayDate: {
    color: '#0F172A',
    fontSize: 15,
  },
  singleDaySplit: {
    flexDirection: 'row',
    gap: 20,
  },
  singleDayMetric: {
    gap: 3,
  },
  singleDayMeta: {
    color: '#94A3B8',
    fontSize: 11,
  },
  singleDayIn: {
    color: '#16A34A',
    fontSize: 14,
  },
  singleDayOut: {
    color: '#DC2626',
    fontSize: 14,
  },
  lineLegendRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 2,
  },
  lineLegendItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  lineLegendSwatch: {
    borderRadius: 999,
    height: 8,
    width: 18,
  },
  lineLegendLabel: {
    color: '#334155',
    fontSize: 12,
  },
  cashflowModeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  cashflowModeChip: {
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cashflowModeChipActive: {
    backgroundColor: '#0F766E',
  },
  cashflowModeText: {
    color: '#475569',
    fontSize: 12,
  },
  cashflowModeTextActive: {
    color: '#FFFFFF',
  },
  cashflowSummaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  cashflowSummaryItem: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  cashflowSummaryLabel: {
    color: '#64748B',
    fontSize: 11,
  },
  cashflowSummaryIn: {
    color: '#16A34A',
    fontSize: 14,
  },
  cashflowSummaryOut: {
    color: '#DC2626',
    fontSize: 14,
  },
  cashflowSummaryNet: {
    fontSize: 14,
  },
  cashflowSummaryNetUp: {
    color: '#0F766E',
  },
  cashflowSummaryNetDown: {
    color: '#991B1B',
  },
  cashflowBarsRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 10,
    minHeight: 188,
    paddingHorizontal: 2,
  },
  cashflowBarCol: {
    alignItems: 'center',
    gap: 6,
    width: 56,
  },
  cashflowBarValues: {
    alignItems: 'center',
    gap: 2,
  },
  cashflowBarValueIn: {
    color: '#16A34A',
    fontSize: 10,
  },
  cashflowBarValueOut: {
    color: '#DC2626',
    fontSize: 10,
  },
  cashflowBarTrackWrap: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 4,
    height: 130,
  },
  cashflowBarTrack: {
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    height: 130,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    width: 8,
  },
  cashflowBarFillIn: {
    backgroundColor: '#16A34A',
    borderRadius: 999,
    width: 8,
  },
  cashflowBarFillOut: {
    backgroundColor: '#DC2626',
    borderRadius: 999,
    width: 8,
  },
  cashflowBarLabel: {
    color: '#64748B',
    fontSize: 10,
  },
  lineLegendHint: {
    color: '#64748B',
    fontSize: 11,
  },
  netTag: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  netTagText: {
    fontSize: 13,
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
  tableScrollHint: {
    color: '#94A3B8',
    fontSize: 11,
    marginBottom: 6,
  },
  tableScroll: {
    maxHeight: 320,
  },
  tableScrollContent: {
    paddingBottom: 4,
  },
  tableLoadMoreButton: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 10,
    minHeight: 44,
    paddingHorizontal: 14,
  },
  tableLoadMoreText: {
    color: '#475569',
    fontSize: 13,
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
  salesModuleCard: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  salesModuleHeader: {
    gap: 4,
  },
  salesModuleTitle: {
    fontSize: 20,
  },
  salesModuleHint: {
    color: '#64748B',
    fontSize: 12,
  },
  salesTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  salesTab: {
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 72,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  salesTabText: {
    color: '#475569',
    fontSize: 12,
    textAlign: 'center',
  },
  salesTabTextActive: {
    color: '#FFFFFF',
  },
  salesAmountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  moduleRangeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: -2,
  },
  moduleRangeChip: {
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  moduleRangeChipActive: {
    backgroundColor: '#2563EB',
  },
  moduleRangeChipActiveOrange: {
    backgroundColor: '#EA580C',
  },
  moduleRangeText: {
    color: '#475569',
    fontSize: 12,
  },
  moduleRangeTextActive: {
    color: '#FFFFFF',
  },
  moduleCustomRangeCard: {
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    marginTop: 2,
    padding: 10,
  },
  salesTrendCard: {
    paddingTop: 6,
  },
  trendAutoLabel: {
    color: '#64748B',
    fontSize: 11,
    marginBottom: 6,
  },
  trendScrollHint: {
    color: '#64748B',
    fontSize: 11,
    marginBottom: 6,
  },
  trendMobileWrap: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
  },
  trendMetricRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  trendMetricItem: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    gap: 3,
    minHeight: 50,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  trendMetricLabel: {
    color: '#64748B',
    fontSize: 10,
  },
  trendMetricValue: {
    color: '#0F172A',
    fontSize: 12,
  },
  trendScrollArea: {
    flex: 1,
  },
  trendScrollContent: {
    paddingBottom: 2,
  },
  trendColumnsRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 8,
    minHeight: 174,
    paddingHorizontal: 2,
  },
  trendColumnItem: {
    alignItems: 'center',
    gap: 4,
    width: 50,
  },
  trendColumnValue: {
    color: '#334155',
    fontSize: 10,
  },
  trendBarTrack: {
    alignItems: 'center',
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    height: 130,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    width: 12,
  },
  trendBarFill: {
    borderRadius: 999,
    width: 12,
  },
  trendColumnLabel: {
    color: '#64748B',
    fontSize: 10,
  },
  productListScroll: {
    maxHeight: 360,
  },
  productListScrollContent: {
    gap: 12,
    paddingBottom: 4,
  },
  productBarRow: {
    gap: 7,
  },
  productBarHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  productBarName: {
    color: '#1E293B',
    flex: 1,
    fontSize: 15,
  },
  productBarAmount: {
    fontSize: 14,
  },
  productBarTrack: {
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    height: 8,
    overflow: 'hidden',
  },
  productBarFill: {
    borderRadius: 999,
    height: 8,
  },
  productBarMeta: {
    color: '#64748B',
    fontSize: 12,
  },
  productAxisNoteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  productAxisNote: {
    color: '#64748B',
    fontSize: 11,
  },
  foldCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  foldRow: {
    alignItems: 'center',
    borderBottomColor: '#E2E8F0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  foldCopy: {
    flex: 1,
    marginRight: 12,
  },
  foldTitle: {
    color: '#0F172A',
    fontSize: 15,
  },
  foldSubtitle: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  foldBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  foldBadgeText: {
    color: '#475569',
    fontSize: 12,
  },
  foldBadgeTextActive: {
    color: '#2563EB',
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
