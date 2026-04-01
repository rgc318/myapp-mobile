import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { DateFieldInput } from '@/components/date-field-input';
import { LinkOptionInput } from '@/components/link-option-input';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { normalizeAppError } from '@/lib/app-error';
import { getTodayIsoDate, isValidIsoDate } from '@/lib/date-value';
import { useFeedback } from '@/providers/feedback-provider';
import {
  fetchReturnSourceContext,
  getReturnSourceOptions,
  searchReturnSourceOptions,
  submitReturnDocument,
  type ReturnBusinessType,
  type ReturnSourceContext,
  type ReturnSourceDoctype,
  type ReturnSubmissionResult,
} from '@/services/returns';

type ReturnCreateScreenProps = {
  businessType: ReturnBusinessType;
  title: string;
  description: string;
};

function formatMoney(value: number | null, currency = 'CNY') {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }

  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatStatusLabel(status: string) {
  switch (status) {
    case 'submitted':
      return '已提交';
    case 'draft':
      return '草稿';
    case 'cancelled':
      return '已作废';
    default:
      return status || '未确认';
  }
}

function formatQty(value: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function buildSourceLabel(sourceDoctype: ReturnSourceDoctype) {
  switch (sourceDoctype) {
    case 'Delivery Note':
      return '基于发货单退货';
    case 'Sales Invoice':
      return '基于销售发票退货';
    case 'Purchase Receipt':
      return '基于收货单退货';
    case 'Purchase Invoice':
      return '基于采购发票退货';
    default:
      return sourceDoctype;
  }
}

function buildSuggestedActionHint(result: ReturnSubmissionResult) {
  switch (result.nextActions.suggestedNextAction) {
    case 'review_refund':
      return '退货单已生成。如果来源发票已收款，下一步建议核对客户退款。';
    case 'review_supplier_refund':
      return '退货单已生成。如果来源发票已付款，下一步建议核对供应商退款或应付冲减。';
    default:
      return '退货单已生成，可以先查看退货单或返回来源单据继续处理。';
  }
}

function buildDocumentRoute(doctype: ReturnSourceDoctype, name: string) {
  switch (doctype) {
    case 'Delivery Note':
      return { pathname: '/sales/delivery/create' as const, params: { deliveryNote: name } };
    case 'Sales Invoice':
      return { pathname: '/sales/invoice/create' as const, params: { salesInvoice: name } };
    case 'Purchase Receipt':
      return { pathname: '/purchase/receipt/create' as const, params: { receiptName: name } };
    case 'Purchase Invoice':
      return { pathname: '/purchase/invoice/create' as const, params: { purchaseInvoice: name } };
    default:
      return null;
  }
}

export function ReturnCreateScreen({ businessType, title, description }: ReturnCreateScreenProps) {
  const router = useRouter();
  const params = useLocalSearchParams<{ sourceDoctype?: string; sourceName?: string }>();
  const { showError, showSuccess } = useFeedback();

  const sourceOptions = useMemo(() => getReturnSourceOptions(businessType), [businessType]);
  const initialSourceDoctype = sourceOptions.includes(params.sourceDoctype as ReturnSourceDoctype)
    ? (params.sourceDoctype as ReturnSourceDoctype)
    : sourceOptions[0];

  const [sourceDoctype, setSourceDoctype] = useState<ReturnSourceDoctype>(initialSourceDoctype);
  const [sourceName, setSourceName] = useState(typeof params.sourceName === 'string' ? params.sourceName.trim() : '');
  const [postingDate, setPostingDate] = useState(getTodayIsoDate());
  const [remarks, setRemarks] = useState('');
  const [context, setContext] = useState<ReturnSourceContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedResult, setSubmittedResult] = useState<ReturnSubmissionResult | null>(null);
  const [qtyDraft, setQtyDraft] = useState<Record<string, string>>({});

  const surface = useThemeColor({}, 'surface');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');
  const successColor = useThemeColor({}, 'success');
  const warningColor = useThemeColor({}, 'warning');
  const dangerColor = useThemeColor({}, 'danger');
  const textColor = useThemeColor({}, 'text');

  useEffect(() => {
    if (typeof params.sourceName === 'string') {
      setSourceName(params.sourceName.trim());
    }

    if (sourceOptions.includes(params.sourceDoctype as ReturnSourceDoctype)) {
      setSourceDoctype(params.sourceDoctype as ReturnSourceDoctype);
    }
  }, [params.sourceDoctype, params.sourceName, sourceOptions]);

  useEffect(() => {
    let cancelled = false;

    async function loadContext() {
      const trimmedSourceName = sourceName.trim();
      if (!trimmedSourceName) {
        setContext(null);
        setQtyDraft({});
        return;
      }

      setIsLoading(true);
      try {
        const nextContext = await fetchReturnSourceContext(sourceDoctype, trimmedSourceName);
        if (!cancelled) {
          setContext(nextContext);
          setQtyDraft(
            (nextContext?.items ?? []).reduce<Record<string, string>>((acc, item) => {
              const defaultQty = item.defaultReturnQty ?? item.maxReturnableQty ?? item.sourceQty ?? 0;
              acc[item.detailId] = defaultQty > 0 ? String(defaultQty) : '';
              return acc;
            }, {}),
          );
        }
      } catch (error) {
        if (!cancelled) {
          setContext(null);
          setQtyDraft({});
          showError(normalizeAppError(error).message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadContext();
    return () => {
      cancelled = true;
    };
  }, [showError, sourceDoctype, sourceName]);

  const selectedItems = useMemo(() => {
    return (context?.items ?? [])
      .map((item) => {
        const rawValue = qtyDraft[item.detailId] ?? '';
        const qty = rawValue.trim() ? Number(rawValue) : 0;
        return {
          item,
          qty,
          isValid:
            Number.isFinite(qty) &&
            qty > 0 &&
            (item.maxReturnableQty === null || item.maxReturnableQty === undefined || qty <= item.maxReturnableQty),
        };
      })
      .filter((entry) => entry.qty > 0);
  }, [context?.items, qtyDraft]);

  const selectedQtyTotal = useMemo(
    () => selectedItems.reduce((sum, entry) => sum + (Number.isFinite(entry.qty) ? entry.qty : 0), 0),
    [selectedItems],
  );

  const selectedAmountEstimate = useMemo(() => {
    return selectedItems.reduce((sum, entry) => {
      const maxQty = entry.item.maxReturnableQty ?? entry.item.sourceQty ?? 0;
      if (!maxQty || !entry.item.amount) {
        return sum;
      }
      return sum + (entry.item.amount / maxQty) * entry.qty;
    }, 0);
  }, [selectedItems]);

  const hasInvalidQty = (context?.items ?? []).some((item) => {
    const rawValue = qtyDraft[item.detailId] ?? '';
    if (!rawValue.trim()) {
      return false;
    }
    const qty = Number(rawValue);
    return (
      !Number.isFinite(qty) ||
      qty <= 0 ||
      (item.maxReturnableQty !== null && item.maxReturnableQty !== undefined && qty > item.maxReturnableQty)
    );
  });

  const handleViewDocument = (doctype: ReturnSourceDoctype, name: string) => {
    const route = buildDocumentRoute(doctype, name);
    if (!route) {
      return;
    }
    router.push(route as any);
  };

  const handleSubmit = async () => {
    const trimmedSourceName = sourceName.trim();
    if (!trimmedSourceName) {
      showError('请先选择退货来源单据。');
      return;
    }
    if (!isValidIsoDate(postingDate)) {
      showError('请先选择有效退货日期。');
      return;
    }
    if (!context) {
      showError('请先读取来源单据，再提交退货。');
      return;
    }
    if (!context.canProcessReturn) {
      showError('当前来源单据暂不允许继续退货，请先确认单据状态。');
      return;
    }
    if (!selectedItems.length) {
      showError('请至少保留一条退货数量大于 0 的明细。');
      return;
    }
    if (hasInvalidQty) {
      showError('退货数量必须大于 0，且不能超过可退数量。');
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await submitReturnDocument({
        businessType,
        sourceDoctype,
        sourceName: trimmedSourceName,
        postingDate,
        remarks,
        returnItems: selectedItems.map(({ item, qty }) => ({
          [item.detailSubmitKey]: item.detailId,
          qty,
        })),
      });
      setSubmittedResult(result);
      showSuccess(result.message);
    } catch (error) {
      showError(normalizeAppError(error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const footer = submittedResult ? (
    <View style={styles.footerActions}>
      <Pressable
        onPress={() => handleViewDocument(submittedResult.sourceDoctype, submittedResult.sourceName)}
        style={[styles.footerSecondaryButton, { borderColor }]}>
        <ThemedText style={[styles.footerSecondaryButtonText, { color: tintColor }]} type="defaultSemiBold">
          返回来源单据
        </ThemedText>
      </Pressable>
      <Pressable
        onPress={() => handleViewDocument(submittedResult.returnDoctype, submittedResult.returnDocument)}
        style={[styles.footerPrimaryButton, { backgroundColor: tintColor }]}>
        <ThemedText style={styles.footerPrimaryButtonText} type="defaultSemiBold">
          查看退货单
        </ThemedText>
      </Pressable>
    </View>
  ) : (
    <Pressable
      disabled={isSubmitting}
      onPress={handleSubmit}
      style={[styles.footerPrimaryButton, { backgroundColor: isSubmitting ? surfaceMuted : tintColor }]}>
      <ThemedText style={styles.footerPrimaryButtonText} type="defaultSemiBold">
        {isSubmitting ? '正在创建退货单...' : '提交退货'}
      </ThemedText>
    </Pressable>
  );

  return (
    <AppShell title={title} description={description} compactHeader contentCard={false} footer={footer}>
      <ScrollView contentContainerStyle={styles.container}>
        {submittedResult ? (
          <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
            <View style={styles.resultHeader}>
              <View style={[styles.resultBadge, { backgroundColor: '#EAF7EF' }]}>
                <ThemedText style={{ color: successColor }} type="defaultSemiBold">
                  已创建
                </ThemedText>
              </View>
              <ThemedText style={styles.resultTitle} type="title">
                退货单已生成
              </ThemedText>
              <ThemedText style={styles.resultDoc} type="defaultSemiBold">
                {submittedResult.returnDocument}
              </ThemedText>
              <ThemedText style={styles.resultHint}>{buildSuggestedActionHint(submittedResult)}</ThemedText>
            </View>

            <View style={styles.resultSummaryGrid}>
              <MetricCard
                label="退货明细"
                value={`${submittedResult.summary.itemCount} 条`}
                backgroundColor={surfaceMuted}
              />
              <MetricCard
                label="退货数量"
                value={formatQty(submittedResult.summary.totalQty)}
                backgroundColor={surfaceMuted}
              />
              <MetricCard
                label="预计退货金额"
                value={formatMoney(submittedResult.summary.returnAmountEstimate, context?.currency || 'CNY')}
                backgroundColor={surfaceMuted}
              />
              <MetricCard
                label="退货方式"
                value={submittedResult.summary.isPartialReturn ? '部分退货' : '整单退货'}
                backgroundColor={surfaceMuted}
              />
            </View>
          </View>
        ) : (
          <>
            <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
              <View style={styles.switchWrap}>
                {sourceOptions.map((option) => {
                  const active = sourceDoctype === option;
                  return (
                    <Pressable
                      key={option}
                      onPress={() => {
                        setSourceDoctype(option);
                        setSourceName('');
                        setContext(null);
                        setQtyDraft({});
                        setSubmittedResult(null);
                      }}
                      style={[
                        styles.switchOption,
                        {
                          backgroundColor: active ? '#FFFFFF' : surfaceMuted,
                          borderColor: active ? tintColor : borderColor,
                        },
                      ]}>
                      <ThemedText style={styles.switchText} type="defaultSemiBold">
                        {buildSourceLabel(option)}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              <LinkOptionInput
                label="来源单据"
                loadOptions={(query) => searchReturnSourceOptions(businessType, sourceDoctype, query)}
                onChangeText={(value) => {
                  setSourceName(value);
                  setSubmittedResult(null);
                }}
                placeholder="搜索来源单据号"
                value={sourceName}
              />

              <DateFieldInput
                errorText={!isValidIsoDate(postingDate) ? '请选择有效退货日期。' : undefined}
                helperText="默认今天，用于记录本次退货过账日期。"
                label="退货日期"
                onChange={setPostingDate}
                value={postingDate}
              />

              <View style={styles.field}>
                <ThemedText style={styles.label} type="defaultSemiBold">
                  备注
                </ThemedText>
                <TextInput
                  multiline
                  onChangeText={setRemarks}
                  placeholder="可选，记录退货原因"
                  style={[styles.input, styles.textarea, { backgroundColor: surfaceMuted, borderColor }]}
                  value={remarks}
                />
              </View>
            </View>

            {isLoading ? (
              <View style={[styles.loadingCard, { backgroundColor: surface, borderColor }]}>
                <ActivityIndicator color={tintColor} />
                <ThemedText>正在读取退货来源单据...</ThemedText>
              </View>
            ) : null}

            {!isLoading && context ? (
              <>
                <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
                  <View style={styles.sectionHeader}>
                    <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
                      来源单据
                    </ThemedText>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor:
                            context.documentStatus === 'cancelled'
                              ? '#FDECEC'
                              : context.documentStatus === 'submitted'
                                ? '#EAF2FF'
                                : '#FFF5E6',
                        },
                      ]}>
                      <ThemedText
                        style={{
                          color:
                            context.documentStatus === 'cancelled'
                              ? dangerColor
                              : context.documentStatus === 'submitted'
                                ? tintColor
                                : warningColor,
                        }}
                        type="defaultSemiBold">
                        {formatStatusLabel(context.documentStatus)}
                      </ThemedText>
                    </View>
                  </View>

                  <ThemedText style={styles.sourceName} type="title">
                    {context.sourceName}
                  </ThemedText>
                  <ThemedText style={styles.sourceMeta}>{context.sourceLabel}</ThemedText>

                  <View style={styles.partyRow}>
                    <ThemedText style={styles.partyName} type="defaultSemiBold">
                      {context.partyDisplayName || context.partyName || '未识别往来方'}
                    </ThemedText>
                    {context.contactDisplayName ? (
                      <ThemedText style={styles.partyMeta}>{context.contactDisplayName}</ThemedText>
                    ) : null}
                  </View>

                  <View style={styles.metricGrid}>
                    <MetricCard
                      label="来源金额"
                      value={formatMoney(context.primaryAmount, context.currency)}
                      backgroundColor={surfaceMuted}
                    />
                    <MetricCard
                      label="剩余结算"
                      value={formatMoney(context.outstandingAmount, context.currency)}
                      backgroundColor={surfaceMuted}
                    />
                    <MetricCard label="公司" value={context.company || '—'} backgroundColor={surfaceMuted} />
                    <MetricCard
                      label="来源日期"
                      value={context.postingDate || context.dueDate || '—'}
                      backgroundColor={surfaceMuted}
                    />
                  </View>

                  {!context.canProcessReturn ? (
                    <View style={[styles.noticeCard, { backgroundColor: '#FFF5E6' }]}>
                      <ThemedText style={{ color: warningColor }} type="defaultSemiBold">
                        当前来源单据暂不允许继续退货，请先回到来源单据确认状态。
                      </ThemedText>
                    </View>
                  ) : null}
                </View>

                <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
                  <View style={styles.sectionHeader}>
                    <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
                      退货明细
                    </ThemedText>
                    <ThemedText style={styles.sectionHint}>默认带出可退数量，可直接改为部分退货。</ThemedText>
                  </View>

                  {context.items.map((item) => {
                    const currentValue = qtyDraft[item.detailId] ?? '';
                    const numericValue = currentValue.trim() ? Number(currentValue) : 0;
                    const isInvalid =
                      currentValue.trim().length > 0 &&
                      (!Number.isFinite(numericValue) ||
                        numericValue <= 0 ||
                        (item.maxReturnableQty !== null &&
                          item.maxReturnableQty !== undefined &&
                          numericValue > item.maxReturnableQty));

                    return (
                      <View key={item.detailId} style={[styles.itemCard, { backgroundColor: surfaceMuted }]}>
                        <View style={styles.itemHeader}>
                          <View style={styles.itemHeaderMain}>
                            <ThemedText style={styles.itemName} type="defaultSemiBold">
                              {item.itemName || item.itemCode}
                            </ThemedText>
                            <ThemedText style={styles.itemMeta}>{`编码 ${item.itemCode || '未填'}${
                              item.warehouse ? ` · 仓库 ${item.warehouse}` : ''
                            }`}</ThemedText>
                          </View>
                          <View style={styles.itemAmountWrap}>
                            <ThemedText style={styles.itemAmountLabel}>来源金额</ThemedText>
                            <ThemedText style={styles.itemAmount} type="defaultSemiBold">
                              {formatMoney(item.amount, context.currency)}
                            </ThemedText>
                          </View>
                        </View>

                        <View style={styles.itemMetrics}>
                          <ThemedText style={styles.itemMetric}>{`来源数量 ${formatQty(item.sourceQty)} ${item.uom || ''}`}</ThemedText>
                          <ThemedText style={styles.itemMetric}>{`可退数量 ${formatQty(item.maxReturnableQty)} ${item.uom || ''}`}</ThemedText>
                        </View>

                        <View style={styles.qtyEditorRow}>
                          <ThemedText style={styles.qtyLabel} type="defaultSemiBold">
                            本次退货
                          </ThemedText>
                          <TextInput
                            keyboardType="decimal-pad"
                            onChangeText={(value) =>
                              setQtyDraft((prev) => ({
                                ...prev,
                                [item.detailId]: value.replace(/[^0-9.]/g, ''),
                              }))
                            }
                            placeholder="0"
                            style={[
                              styles.qtyInput,
                              {
                                backgroundColor: '#FFFFFF',
                                borderColor: isInvalid ? dangerColor : borderColor,
                                color: textColor,
                              },
                            ]}
                            value={currentValue}
                          />
                        </View>
                        {isInvalid ? (
                          <ThemedText style={[styles.inlineError, { color: dangerColor }]}>
                            数量必须大于 0，且不能超过可退数量。
                          </ThemedText>
                        ) : null}
                      </View>
                    );
                  })}
                </View>

                <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
                  <View style={styles.sectionHeader}>
                    <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
                      提交前确认
                    </ThemedText>
                    <ThemedText style={styles.sectionHint}>
                      退货单会独立创建，原来源单据保留业务事实，后续退款按链路单独处理。
                    </ThemedText>
                  </View>
                  <View style={styles.summaryRow}>
                    <ThemedText style={styles.summaryLabel}>本次退货行数</ThemedText>
                    <ThemedText style={styles.summaryValue} type="defaultSemiBold">
                      {selectedItems.length} 条
                    </ThemedText>
                  </View>
                  <View style={styles.summaryRow}>
                    <ThemedText style={styles.summaryLabel}>本次退货数量</ThemedText>
                    <ThemedText style={styles.summaryValue} type="defaultSemiBold">
                      {formatQty(selectedQtyTotal)}
                    </ThemedText>
                  </View>
                  <View style={styles.summaryRow}>
                    <ThemedText style={styles.summaryLabel}>预计退货金额</ThemedText>
                    <ThemedText style={[styles.summaryValue, { color: warningColor }]} type="defaultSemiBold">
                      {formatMoney(selectedAmountEstimate, context.currency)}
                    </ThemedText>
                  </View>
                </View>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </AppShell>
  );
}

function MetricCard({
  label,
  value,
  backgroundColor,
}: {
  label: string;
  value: string;
  backgroundColor: string;
}) {
  return (
    <View style={[styles.metricCard, { backgroundColor }]}>
      <ThemedText style={styles.metricLabel}>{label}</ThemedText>
      <ThemedText style={styles.metricValue} type="defaultSemiBold">
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
    paddingHorizontal: 18,
    paddingBottom: 96,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  switchWrap: {
    gap: 10,
  },
  switchOption: {
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  switchText: {
    fontSize: 14,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 14,
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 52,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  textarea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  loadingCard: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    padding: 18,
  },
  sectionHeader: {
    alignItems: 'flex-start',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 18,
  },
  sectionHint: {
    color: '#71859D',
    fontSize: 13,
    lineHeight: 19,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sourceName: {
    fontSize: 22,
  },
  sourceMeta: {
    color: '#71859D',
    fontSize: 14,
  },
  partyRow: {
    gap: 4,
  },
  partyName: {
    fontSize: 18,
  },
  partyMeta: {
    color: '#71859D',
    fontSize: 14,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    borderRadius: 18,
    gap: 8,
    minHeight: 88,
    minWidth: '47%',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  metricLabel: {
    color: '#71859D',
    fontSize: 13,
  },
  metricValue: {
    fontSize: 16,
  },
  noticeCard: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  itemCard: {
    borderRadius: 20,
    gap: 12,
    padding: 14,
  },
  itemHeader: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  itemHeaderMain: {
    flex: 1,
    gap: 4,
  },
  itemName: {
    fontSize: 17,
  },
  itemMeta: {
    color: '#71859D',
    fontSize: 13,
  },
  itemAmountWrap: {
    alignItems: 'flex-end',
    gap: 4,
  },
  itemAmountLabel: {
    color: '#71859D',
    fontSize: 12,
  },
  itemAmount: {
    fontSize: 16,
  },
  itemMetrics: {
    gap: 4,
  },
  itemMetric: {
    color: '#5B6B7F',
    fontSize: 13,
  },
  qtyEditorRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  qtyLabel: {
    fontSize: 14,
  },
  qtyInput: {
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 46,
    minWidth: 120,
    paddingHorizontal: 14,
    paddingVertical: 10,
    textAlign: 'right',
  },
  inlineError: {
    fontSize: 12,
    lineHeight: 18,
  },
  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    color: '#71859D',
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 16,
  },
  footerPrimaryButton: {
    alignItems: 'center',
    borderRadius: 18,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 18,
  },
  footerPrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  footerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  footerSecondaryButton: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
  },
  footerSecondaryButtonText: {
    fontSize: 15,
  },
  resultHeader: {
    alignItems: 'flex-start',
    gap: 10,
  },
  resultBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  resultTitle: {
    fontSize: 24,
  },
  resultDoc: {
    fontSize: 17,
  },
  resultHint: {
    color: '#5B6B7F',
    fontSize: 14,
    lineHeight: 21,
  },
  resultSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
