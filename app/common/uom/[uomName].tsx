import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { ProductTextField } from '@/components/product-form-controls';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useFeedback } from '@/providers/feedback-provider';
import { deleteUom, fetchUomDetail, saveUom, setUomDisabled, type UomDetail } from '@/services/uoms';

function buildUsageSummary(detail: UomDetail | null) {
  const total = detail?.usageSummary?.totalReferences ?? 0;
  if (!total) {
    return '当前还没有业务引用，可安全继续调整说明、启停和整数规则。';
  }

  const topRefs = (detail?.usageSummary?.doctypes ?? [])
    .slice(0, 3)
    .map((row) => `${row.doctype}.${row.fieldname}（${row.count}）`)
    .join('、');

  return topRefs ? `已发现 ${total} 条引用，主要分布在 ${topRefs}。` : `已发现 ${total} 条业务引用。`;
}

function HeroStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <View style={[styles.heroStatCard, { borderColor: `${accent}33`, backgroundColor: `${accent}12` }]}>
      <ThemedText style={styles.heroStatLabel}>{label}</ThemedText>
      <ThemedText style={[styles.heroStatValue, { color: accent }]} type="defaultSemiBold">
        {value}
      </ThemedText>
    </View>
  );
}

export default function UomDetailScreen() {
  const router = useRouter();
  const { uomName } = useLocalSearchParams<{ uomName: string }>();
  const { showError, showSuccess } = useFeedback();
  const tintColor = useThemeColor({}, 'tint');
  const surface = useThemeColor({}, 'surface');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const danger = useThemeColor({}, 'danger');
  const success = useThemeColor({}, 'success');
  const warning = useThemeColor({}, 'warning');

  const [detail, setDetail] = useState<UomDetail | null>(null);
  const [symbol, setSymbol] = useState('');
  const [description, setDescription] = useState('');
  const [mustBeWholeNumber, setMustBeWholeNumber] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const hydrateDraft = useCallback((next: UomDetail | null) => {
    setDetail(next);
    setSymbol(next?.symbol ?? '');
    setDescription(next?.description ?? '');
    setMustBeWholeNumber(Boolean(next?.mustBeWholeNumber));
    setEnabled(Boolean(next?.enabled));
  }, []);

  const loadDetail = useCallback(
    async (refresh = false) => {
      if (!uomName) {
        return;
      }
      try {
        if (refresh) {
          setIsRefreshing(true);
        } else {
        }
        const next = await fetchUomDetail(uomName);
        hydrateDraft(next);
      } catch (error) {
        showError(error instanceof Error ? error.message : '加载单位详情失败');
      } finally {
        setIsRefreshing(false);
      }
    },
    [hydrateDraft, showError, uomName],
  );

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const usageSummaryText = useMemo(() => buildUsageSummary(detail), [detail]);
  const hasReferences = (detail?.usageSummary?.totalReferences ?? 0) > 0;
  const displayName = detail?.displayName || detail?.uomName || uomName || '单位';
  const currentEnabled = isEditing ? enabled : Boolean(detail?.enabled);
  const currentWholeNumber = isEditing ? mustBeWholeNumber : Boolean(detail?.mustBeWholeNumber);
  const topReferences = (detail?.usageSummary?.doctypes ?? []).slice(0, 4);

  const handleSave = async () => {
    if (!detail) {
      return;
    }

    try {
      setIsSaving(true);
      const saved = await saveUom(detail.name, {
        symbol: symbol.trim() || undefined,
        description: description.trim() || undefined,
        enabled,
        mustBeWholeNumber,
      });

      if (!saved) {
        throw new Error('保存单位失败');
      }

      hydrateDraft(saved);
      setIsEditing(false);
      showSuccess(`单位 ${saved.displayName || saved.uomName} 已保存`);
    } catch (error) {
      showError(error instanceof Error ? error.message : '保存单位失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleEnabled = async () => {
    if (!detail) {
      return;
    }

    try {
      const next = await setUomDisabled(detail.name, Boolean(detail.enabled));
      if (!next) {
        throw new Error('更新单位状态失败');
      }
      hydrateDraft(next);
      showSuccess(`单位 ${next.displayName || next.uomName} 已${next.enabled ? '启用' : '停用'}`);
    } catch (error) {
      showError(error instanceof Error ? error.message : '更新单位状态失败');
    }
  };

  const handleDelete = () => {
    if (!detail) {
      return;
    }

    Alert.alert('删除单位', `确认删除单位 ${detail.displayName || detail.uomName || detail.name}？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '确认删除',
        style: 'destructive',
        onPress: async () => {
          try {
            const deleted = await deleteUom(detail.name);
            showSuccess(`单位 ${detail.displayName || deleted?.uomName || detail.uomName} 已删除`);
            router.replace('/common/uoms');
          } catch (error) {
            showError(error instanceof Error ? error.message : '删除单位失败');
          }
        },
      },
    ]);
  };

  return (
    <AppShell
      compactHeader
      contentCard={false}
      description="查看单位引用情况，并维护说明、启停状态和整数规则。"
      footer={
        <View style={styles.footerBar}>
          <Pressable onPress={() => router.replace('/common/uoms')} style={styles.footerSecondary}>
            <ThemedText style={{ color: tintColor }} type="defaultSemiBold">
              返回单位
            </ThemedText>
          </Pressable>
          {isEditing ? (
            <Pressable
              onPress={() => void handleSave()}
              style={[styles.footerPrimary, { backgroundColor: tintColor, opacity: isSaving ? 0.72 : 1 }]}>
              <ThemedText style={styles.footerPrimaryText} type="defaultSemiBold">
                {isSaving ? '保存中…' : '保存单位'}
              </ThemedText>
            </Pressable>
          ) : (
            <Pressable onPress={() => setIsEditing(true)} style={[styles.footerPrimary, { backgroundColor: tintColor }]}>
              <ThemedText style={styles.footerPrimaryText} type="defaultSemiBold">
                编辑单位
              </ThemedText>
            </Pressable>
          )}
        </View>
      }
      title={detail?.displayName || detail?.uomName || '单位详情'}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl onRefresh={() => void loadDetail(true)} refreshing={isRefreshing} />}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.heroCard, { backgroundColor: surface, borderColor }]}>
          <View style={styles.heroGlowBlue} />
          <View style={styles.heroGlowAmber} />
          <View style={styles.heroTopRow}>
            <View style={styles.heroMainCopy}>
              <ThemedText style={styles.heroEyebrow}>UNIT PROFILE</ThemedText>
              <ThemedText style={styles.heroTitle} type="defaultSemiBold">
                {displayName}
              </ThemedText>
              <ThemedText style={styles.heroMeta}>编码 {detail?.name || uomName || '—'}</ThemedText>
              <ThemedText style={styles.heroDescription}>
                在这里统一维护单位的显示语义、整数录入规则和启停状态，避免商品与单据继续出现口径分裂。
              </ThemedText>
            </View>
            <View style={styles.heroStatusWrap}>
              <View
                style={[
                  styles.statusChip,
                  styles.primaryStatusChip,
                  { backgroundColor: currentEnabled ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)' },
                ]}>
                <ThemedText
                  style={[styles.statusChipText, { color: currentEnabled ? success : danger }]}
                  type="defaultSemiBold">
                  {currentEnabled ? '启用中' : '已停用'}
                </ThemedText>
              </View>
              <View
                style={[
                  styles.statusChip,
                  styles.secondaryStatusChip,
                  {
                    backgroundColor: currentWholeNumber ? 'rgba(245,158,11,0.12)' : 'rgba(59,130,246,0.12)',
                  },
                ]}>
                <ThemedText
                  style={[styles.statusChipText, { color: currentWholeNumber ? warning : tintColor }]}
                  type="defaultSemiBold">
                  {currentWholeNumber ? '必须整数' : '允许小数'}
                </ThemedText>
              </View>
            </View>
          </View>

          <View style={styles.heroMetricsRow}>
            <HeroStat accent="#2563EB" label="单位符号" value={detail?.symbol || '未设置'} />
            <HeroStat accent="#059669" label="引用总数" value={`${detail?.usageSummary?.totalReferences ?? 0}`} />
            <HeroStat accent="#D97706" label="录入规则" value={currentWholeNumber ? '整数' : '小数'} />
          </View>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: surface, borderColor }]}>
          <View style={styles.sectionHeaderCopy}>
            <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
              基本信息
            </ThemedText>
            <ThemedText style={styles.sectionHint}>保持显示名称、系统编码和单位符号的区分，前台统一展示中文语义，系统内部继续使用稳定编码。</ThemedText>
          </View>
          <View style={styles.summaryGrid}>
            <View style={[styles.summaryCard, { backgroundColor: surfaceMuted }]}>
              <ThemedText style={styles.summaryLabel}>显示名称</ThemedText>
              <ThemedText style={styles.summaryValue} type="defaultSemiBold">
                {displayName}
              </ThemedText>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: surfaceMuted }]}>
              <ThemedText style={styles.summaryLabel}>单位符号</ThemedText>
              <ThemedText style={styles.summaryValue} type="defaultSemiBold">
                {detail?.symbol || '未设置'}
              </ThemedText>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: surfaceMuted }]}>
              <ThemedText style={styles.summaryLabel}>系统编码</ThemedText>
              <ThemedText numberOfLines={2} style={styles.summaryValue} type="defaultSemiBold">
                {detail?.name || '未设置'}
              </ThemedText>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: surfaceMuted }]}>
              <ThemedText style={styles.summaryLabel}>当前状态</ThemedText>
              <ThemedText style={styles.summaryValue} type="defaultSemiBold">
                {currentEnabled ? '启用中' : '已停用'}
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: surface, borderColor }]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderCopy}>
              <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
                单位规则
              </ThemedText>
              <ThemedText style={styles.sectionHint}>{usageSummaryText}</ThemedText>
            </View>
            {hasReferences ? (
              <View style={[styles.referenceBadge, { backgroundColor: 'rgba(245,158,11,0.14)' }]}>
                <ThemedText style={[styles.referenceBadgeText, { color: warning }]} type="defaultSemiBold">
                  已有引用
                </ThemedText>
              </View>
            ) : (
              <View style={[styles.referenceBadge, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
                <ThemedText style={[styles.referenceBadgeText, { color: success }]} type="defaultSemiBold">
                  可自由调整
                </ThemedText>
              </View>
            )}
          </View>
          <View style={[styles.ruleRow, { backgroundColor: surfaceMuted }]}>
            <View style={styles.ruleCopy}>
              <ThemedText style={styles.ruleLabel} type="defaultSemiBold">
                必须为整数
              </ThemedText>
              <ThemedText style={styles.ruleHint}>已被引用的单位不能随意修改这个规则。</ThemedText>
            </View>
            {isEditing ? (
              <Switch onValueChange={setMustBeWholeNumber} value={mustBeWholeNumber} />
            ) : (
              <ThemedText style={styles.ruleValue} type="defaultSemiBold">
                {detail?.mustBeWholeNumber ? '是' : '否'}
              </ThemedText>
            )}
          </View>

          <View style={[styles.ruleRow, { backgroundColor: surfaceMuted }]}>
            <View style={styles.ruleCopy}>
              <ThemedText style={styles.ruleLabel} type="defaultSemiBold">
                单位状态
              </ThemedText>
              <ThemedText style={styles.ruleHint}>停用后不会直接删除历史引用，但会减少新使用。</ThemedText>
            </View>
            {isEditing ? (
              <Switch onValueChange={setEnabled} value={enabled} />
            ) : (
              <ThemedText style={styles.ruleValue} type="defaultSemiBold">
                {detail?.enabled ? '启用中' : '已停用'}
              </ThemedText>
            )}
          </View>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: surface, borderColor }]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderCopy}>
              <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
                引用概览
              </ThemedText>
              <ThemedText style={styles.sectionHint}>修改前先看一下这个单位已经在哪些业务对象里被使用，避免误伤旧数据。</ThemedText>
            </View>
            <View
              style={[
                styles.referenceBadge,
                { backgroundColor: hasReferences ? 'rgba(245,158,11,0.14)' : 'rgba(16,185,129,0.12)' },
              ]}>
              <ThemedText
                style={[styles.referenceBadgeText, { color: hasReferences ? warning : success }]}
                type="defaultSemiBold">
                {hasReferences ? `${detail?.usageSummary?.totalReferences ?? 0} 条引用` : '暂无引用'}
              </ThemedText>
            </View>
          </View>

          <View style={[styles.referenceSummaryCard, { backgroundColor: surfaceMuted }]}>
            <ThemedText style={styles.referenceSummaryText}>{usageSummaryText}</ThemedText>
          </View>

          {topReferences.length ? (
            <View style={styles.referenceList}>
              {topReferences.map((row) => (
                <View key={`${row.doctype}-${row.fieldname}`} style={[styles.referenceRow, { backgroundColor: surfaceMuted }]}>
                  <View style={styles.referenceCopy}>
                    <ThemedText style={styles.referenceName} type="defaultSemiBold">
                      {row.doctype}
                    </ThemedText>
                    <ThemedText style={styles.referenceField}>{row.fieldname}</ThemedText>
                  </View>
                  <ThemedText style={styles.referenceCount} type="defaultSemiBold">
                    {row.count}
                  </ThemedText>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View style={[styles.sectionCard, { backgroundColor: surface, borderColor }]}>
          <View style={styles.sectionHeaderCopy}>
            <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
              单位资料
            </ThemedText>
            <ThemedText style={styles.sectionHint}>维护显示符号和业务说明。单位名称和系统编码当前作为系统识别字段，不在这里直接改名。</ThemedText>
          </View>
          {isEditing ? (
            <>
              <ProductTextField editable={false} label="单位名称" value={detail?.uomName || detail?.name || ''} />
              <ProductTextField editable={false} label="系统编码" value={detail?.name || ''} />
              <ProductTextField label="单位符号" onChangeText={setSymbol} placeholder="例如 ct、pcs，可留空" value={symbol} />
              <ProductTextField
                label="单位说明"
                multiline
                onChangeText={setDescription}
                placeholder="补充使用场景或业务说明"
                value={description}
              />
            </>
          ) : (
            <View style={styles.readOnlyList}>
              <View style={styles.readOnlyRow}>
                <ThemedText style={styles.readOnlyLabel}>单位名称</ThemedText>
                <ThemedText style={styles.readOnlyValue} type="defaultSemiBold">
                  {detail?.uomName || detail?.name || '未设置'}
                </ThemedText>
              </View>
              <View style={styles.readOnlyRow}>
                <ThemedText style={styles.readOnlyLabel}>系统编码</ThemedText>
                <ThemedText style={styles.readOnlyValue} type="defaultSemiBold">
                  {detail?.name || '未设置'}
                </ThemedText>
              </View>
              <View style={styles.readOnlyRow}>
                <ThemedText style={styles.readOnlyLabel}>单位符号</ThemedText>
                <ThemedText style={styles.readOnlyValue} type="defaultSemiBold">
                  {detail?.symbol || '未设置'}
                </ThemedText>
              </View>
              <View style={styles.readOnlyRow}>
                <ThemedText style={styles.readOnlyLabel}>单位说明</ThemedText>
                <ThemedText style={styles.readOnlyValue} type="defaultSemiBold">
                  {detail?.description || '暂无说明'}
                </ThemedText>
              </View>
            </View>
          )}
        </View>

        <View style={[styles.sectionCard, { backgroundColor: surface, borderColor }]}>
          <View style={styles.sectionHeaderCopy}>
            <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
              风险操作
            </ThemedText>
            <ThemedText style={styles.sectionHint}>已被引用的单位不允许直接删除，建议先停用并逐步迁移引用。</ThemedText>
          </View>
          <View style={styles.dangerActions}>
            <Pressable
              onPress={() => void handleToggleEnabled()}
              style={[styles.secondaryDangerButton, { borderColor: detail?.enabled ? warning : success }]}>
              <ThemedText
                style={{ color: detail?.enabled ? warning : success }}
                type="defaultSemiBold">
                {detail?.enabled ? '停用单位' : '重新启用'}
              </ThemedText>
            </Pressable>
            <Pressable
              disabled={hasReferences}
              onPress={handleDelete}
              style={[styles.primaryDangerButton, { backgroundColor: hasReferences ? '#FECACA' : '#DC2626', opacity: hasReferences ? 0.55 : 1 }]}>
              <ThemedText style={styles.footerPrimaryText} type="defaultSemiBold">
                {hasReferences ? '已有引用，暂不可删' : '删除单位'}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
    paddingBottom: 24,
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
    backgroundColor: 'rgba(59,130,246,0.16)',
    borderRadius: 999,
    height: 164,
    position: 'absolute',
    right: -36,
    top: -56,
    width: 164,
  },
  heroGlowAmber: {
    backgroundColor: 'rgba(251,191,36,0.14)',
    borderRadius: 999,
    bottom: -74,
    height: 148,
    left: -52,
    position: 'absolute',
    width: 148,
  },
  heroTopRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  heroMainCopy: {
    flex: 1,
    gap: 6,
  },
  heroEyebrow: {
    color: '#2563EB',
    fontSize: 12,
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 34,
  },
  heroMeta: {
    color: '#64748B',
    fontSize: 14,
  },
  heroDescription: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 21,
    maxWidth: '92%',
  },
  heroStatusWrap: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-end',
  },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  primaryStatusChip: {
    minWidth: 70,
  },
  secondaryStatusChip: {
    opacity: 0.94,
  },
  statusChipText: {
    fontSize: 13,
  },
  heroMetricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  heroStatCard: {
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    gap: 6,
    minHeight: 88,
    minWidth: '30%',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  heroStatLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  heroStatValue: {
    fontSize: 24,
    lineHeight: 30,
  },
  sectionCard: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryCard: {
    borderRadius: 18,
    gap: 6,
    minHeight: 88,
    minWidth: '47%',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  summaryLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  summaryValue: {
    fontSize: 18,
    lineHeight: 24,
  },
  sectionHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  sectionHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  sectionTitle: {
    fontSize: 20,
  },
  sectionHint: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 18,
  },
  referenceBadge: {
    borderRadius: 999,
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  referenceBadgeText: {
    fontSize: 12,
  },
  referenceSummaryCard: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  referenceSummaryText: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 21,
  },
  referenceList: {
    gap: 10,
  },
  referenceRow: {
    alignItems: 'center',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  referenceCopy: {
    flex: 1,
    gap: 3,
  },
  referenceName: {
    fontSize: 15,
  },
  referenceField: {
    color: '#64748B',
    fontSize: 13,
  },
  referenceCount: {
    color: '#0F172A',
    fontSize: 18,
    minWidth: 32,
    textAlign: 'right',
  },
  ruleRow: {
    alignItems: 'center',
    borderRadius: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  ruleCopy: {
    flex: 1,
    gap: 4,
  },
  ruleLabel: {
    fontSize: 16,
  },
  ruleHint: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 18,
  },
  ruleValue: {
    fontSize: 16,
  },
  readOnlyList: {
    gap: 12,
  },
  readOnlyRow: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  readOnlyLabel: {
    color: '#64748B',
    fontSize: 13,
  },
  readOnlyValue: {
    fontSize: 16,
    lineHeight: 24,
  },
  dangerActions: {
    gap: 12,
  },
  secondaryDangerButton: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryDangerButton: {
    alignItems: 'center',
    borderRadius: 18,
    justifyContent: 'center',
    minHeight: 48,
  },
  footerBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  footerSecondary: {
    alignItems: 'center',
    borderColor: '#1677FF',
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
    color: '#FFF',
    fontSize: 16,
  },
});
