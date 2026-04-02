import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { ProductPickerSheet, ProductSelectorField, ProductTextField } from '@/components/product-form-controls';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useFeedback } from '@/providers/feedback-provider';
import { fetchSupplierDetail, saveSupplier, setSupplierDisabled, type SupplierDetail } from '@/services/suppliers';
import { checkLinkOptionExists, searchLinkOptions } from '@/services/master-data';

function SectionHeader({ title, hint }: { title: string; hint: string }) {
  return (
    <View style={styles.sectionHeader}>
      <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
        {title}
      </ThemedText>
      <ThemedText style={styles.sectionHint}>{hint}</ThemedText>
    </View>
  );
}

function buildAddressPreview(detail: SupplierDetail | null) {
  return (
    detail?.defaultAddress?.addressDisplay ||
    detail?.defaultAddress?.addressLine1 ||
    detail?.recentAddresses?.[0]?.addressDisplay ||
    '未设置默认地址'
  );
}

export default function SupplierDetailScreen() {
  const router = useRouter();
  const { supplierName } = useLocalSearchParams<{ supplierName: string }>();
  const { showError, showSuccess } = useFeedback();
  const tintColor = useThemeColor({}, 'tint');
  const surface = useThemeColor({}, 'surface');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const success = useThemeColor({}, 'success');
  const danger = useThemeColor({}, 'danger');

  const [detail, setDetail] = useState<SupplierDetail | null>(null);
  const [supplierDisplayName, setSupplierDisplayName] = useState('');
  const [supplierType, setSupplierType] = useState<'Company' | 'Individual'>('Company');
  const [supplierGroup, setSupplierGroup] = useState('');
  const [defaultCurrency, setDefaultCurrency] = useState('');
  const [remarks, setRemarks] = useState('');
  const [mobileNo, setMobileNo] = useState('');
  const [emailId, setEmailId] = useState('');
  const [contactDisplayName, setContactDisplayName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [county, setCounty] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('');
  const [pincode, setPincode] = useState('');
  const [addressPhone, setAddressPhone] = useState('');
  const [addressEmail, setAddressEmail] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [masterPickerVisible, setMasterPickerVisible] = useState(false);
  const [masterPickerTarget, setMasterPickerTarget] = useState<'supplierGroup' | 'currency' | null>(null);
  const [masterPickerQuery, setMasterPickerQuery] = useState('');
  const [masterPickerOptions, setMasterPickerOptions] = useState<string[]>([]);

  const hydrateDraft = useCallback((next: SupplierDetail | null) => {
    setDetail(next);
    setSupplierDisplayName(next?.displayName ?? next?.supplierName ?? '');
    setSupplierType(next?.supplierType === 'Individual' ? 'Individual' : 'Company');
    setSupplierGroup(next?.supplierGroup ?? '');
    setDefaultCurrency(next?.defaultCurrency ?? 'CNY');
    setRemarks(next?.remarks ?? '');
    setMobileNo(next?.mobileNo ?? '');
    setEmailId(next?.emailId ?? '');
    setContactDisplayName(next?.defaultContact?.displayName ?? '');
    setContactPhone(next?.defaultContact?.phone ?? next?.mobileNo ?? '');
    setContactEmail(next?.defaultContact?.email ?? next?.emailId ?? '');
    setAddressLine1(next?.defaultAddress?.addressLine1 ?? '');
    setAddressLine2(next?.defaultAddress?.addressLine2 ?? '');
    setCity(next?.defaultAddress?.city ?? '');
    setCounty(next?.defaultAddress?.county ?? '');
    setState(next?.defaultAddress?.state ?? '');
    setCountry(next?.defaultAddress?.country ?? '');
    setPincode(next?.defaultAddress?.pincode ?? '');
    setAddressPhone(next?.defaultAddress?.phone ?? '');
    setAddressEmail(next?.defaultAddress?.email ?? '');
    setEnabled(!Boolean(next?.disabled));
  }, []);

  useEffect(() => {
    if (!masterPickerVisible || !masterPickerTarget) {
      return;
    }

    let cancelled = false;
    async function loadOptions() {
      try {
        const doctype = masterPickerTarget === 'supplierGroup' ? 'Supplier Group' : 'Currency';
        const options = await searchLinkOptions(doctype, masterPickerQuery);
        if (!cancelled) {
          setMasterPickerOptions(options.map((option) => option.value.trim()).filter(Boolean));
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

  const loadDetail = useCallback(
    async (refresh = false) => {
      if (!supplierName) {
        return;
      }
      try {
        if (refresh) {
          setIsRefreshing(true);
        }
        const next = await fetchSupplierDetail(supplierName);
        hydrateDraft(next);
      } catch (error) {
        showError(error instanceof Error ? error.message : '加载供应商详情失败');
      } finally {
        setIsRefreshing(false);
      }
    },
    [supplierName, hydrateDraft, showError],
  );

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const handleOpenMasterPicker = (target: 'supplierGroup' | 'currency') => {
    setMasterPickerTarget(target);
    setMasterPickerQuery('');
    setMasterPickerVisible(true);
  };

  const handleSelectMasterOption = (value: string) => {
    if (masterPickerTarget === 'supplierGroup') {
      setSupplierGroup(value);
    }
    if (masterPickerTarget === 'currency') {
      setDefaultCurrency(value);
    }
    setMasterPickerVisible(false);
    setMasterPickerTarget(null);
    setMasterPickerQuery('');
  };

  const handleSave = async () => {
    if (!detail) {
      return;
    }

    if (!supplierDisplayName.trim()) {
      showError('请先填写供应商名称。');
      return;
    }

    if (supplierGroup.trim()) {
      const exists = await checkLinkOptionExists('Supplier Group', supplierGroup.trim());
      if (!exists) {
        showError('供应商分组不存在，请从候选项中选择。');
        return;
      }
    }

    if (defaultCurrency.trim()) {
      const exists = await checkLinkOptionExists('Currency', defaultCurrency.trim());
      if (!exists) {
        showError('默认币种不存在，请从候选项中选择。');
        return;
      }
    }

    try {
      setIsSaving(true);
      const saved = await saveSupplier(detail.name, {
        supplierName: supplierDisplayName.trim(),
        supplierType,
        supplierGroup: supplierGroup.trim() || undefined,
        defaultCurrency: defaultCurrency.trim() || undefined,
        remarks: remarks.trim() || undefined,
        mobileNo: mobileNo.trim() || undefined,
        emailId: emailId.trim() || undefined,
        defaultContact:
          contactDisplayName.trim() || contactPhone.trim() || contactEmail.trim()
            ? {
                displayName: contactDisplayName.trim() || undefined,
                phone: contactPhone.trim() || undefined,
                email: contactEmail.trim() || undefined,
              }
            : undefined,
        defaultAddress:
          addressLine1.trim() || city.trim() || country.trim() || addressPhone.trim() || addressEmail.trim()
            ? {
                addressLine1: addressLine1.trim() || undefined,
                addressLine2: addressLine2.trim() || undefined,
                city: city.trim() || undefined,
                county: county.trim() || undefined,
                state: state.trim() || undefined,
                country: country.trim() || undefined,
                pincode: pincode.trim() || undefined,
                phone: addressPhone.trim() || undefined,
                email: addressEmail.trim() || undefined,
                addressType: 'Billing',
              }
            : undefined,
        disabled: !enabled,
      });

      if (!saved) {
        throw new Error('保存供应商失败');
      }

      hydrateDraft(saved);
      setIsEditing(false);
      showSuccess(`供应商 ${saved.displayName} 已保存`);
    } catch (error) {
      showError(error instanceof Error ? error.message : '保存供应商失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleDisabled = async () => {
    if (!detail) {
      return;
    }

    try {
      const next = await setSupplierDisabled(detail.name, !detail.disabled);
      if (!next) {
        throw new Error('更新供应商状态失败');
      }
      hydrateDraft(next);
      showSuccess(`供应商 ${next.displayName} 已${next.disabled ? '停用' : '启用'}`);
    } catch (error) {
      showError(error instanceof Error ? error.message : '更新供应商状态失败');
    }
  };

  return (
    <AppShell
      compactHeader
      contentCard={false}
      description="查看供应商默认联系人、默认地址和结算币种，并维护后续采购流程的建议值。"
      footer={
        <View style={styles.footerBar}>
          <Pressable onPress={() => router.replace('/common/suppliers')} style={styles.footerSecondary}>
            <ThemedText style={{ color: tintColor }} type="defaultSemiBold">
              返回供应商
            </ThemedText>
          </Pressable>
          {isEditing ? (
            <Pressable
              onPress={() => void handleSave()}
              style={[styles.footerPrimary, { backgroundColor: tintColor, opacity: isSaving ? 0.72 : 1 }]}>
              <ThemedText style={styles.footerPrimaryText} type="defaultSemiBold">
                {isSaving ? '保存中…' : '保存供应商'}
              </ThemedText>
            </Pressable>
          ) : (
            <Pressable onPress={() => setIsEditing(true)} style={[styles.footerPrimary, { backgroundColor: tintColor }]}>
              <ThemedText style={styles.footerPrimaryText} type="defaultSemiBold">
                编辑供应商
              </ThemedText>
            </Pressable>
          )}
        </View>
      }
      title={detail?.displayName || '供应商详情'}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl onRefresh={() => void loadDetail(true)} refreshing={isRefreshing} />}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.heroCard, { backgroundColor: surface, borderColor }]}> 
          <View style={styles.heroGlowBlue} />
          <View style={styles.heroGlowAmber} />
          <View style={styles.heroTopRow}>
            <View style={styles.heroMainCopy}>
              <ThemedText style={styles.heroEyebrow}>SUPPLIER PROFILE</ThemedText>
              <ThemedText style={styles.heroTitle} type="defaultSemiBold">
                {detail?.displayName || detail?.supplierName || supplierName || '供应商'}
              </ThemedText>
              <ThemedText style={styles.heroMeta}>编码 {detail?.name || supplierName || '—'}</ThemedText>
              <ThemedText style={styles.heroSubMeta}>
                {(detail?.supplierGroup || '未设置供应商分组') + (detail?.supplierType ? ` · ${detail.supplierType}` : '')}
              </ThemedText>
            </View>
            <View
              style={[
                styles.heroStatusChip,
                { backgroundColor: detail?.disabled ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)' },
              ]}>
              <ThemedText
                style={[styles.heroStatusChipText, { color: detail?.disabled ? danger : success }]}
                type="defaultSemiBold">
                {detail?.disabled ? '已停用' : '启用中'}
              </ThemedText>
            </View>
          </View>

          <View style={styles.heroStatsRow}>
            <View style={[styles.heroStatCard, { backgroundColor: surfaceMuted }]}> 
              <ThemedText style={styles.heroStatLabel}>默认币种</ThemedText>
              <ThemedText style={styles.heroStatValue} type="defaultSemiBold">
                {detail?.defaultCurrency || '未设置'}
              </ThemedText>
            </View>
            <View style={[styles.heroStatCard, { backgroundColor: surfaceMuted }]}> 
              <ThemedText style={styles.heroStatLabel}>默认联系人</ThemedText>
              <ThemedText style={styles.heroStatValue} type="defaultSemiBold">
                {detail?.defaultContact?.displayName || '未设置'}
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={[styles.summaryCard, { backgroundColor: surface, borderColor }]}> 
          <View style={styles.summaryCardHeader}>
            <View>
              <ThemedText style={styles.summaryCardTitle} type="defaultSemiBold">
                运行状态
              </ThemedText>
              <ThemedText style={styles.summaryCardHint}>启停状态会直接影响采购单据是否还能继续选择这家供应商。</ThemedText>
            </View>
            <View style={styles.enabledRow}>
              <ThemedText style={styles.enabledLabel}>{enabled ? '启用中' : '已停用'}</ThemedText>
              <Switch onValueChange={() => void handleToggleDisabled()} value={enabled} />
            </View>
          </View>

          <View style={styles.summaryGrid}>
            <View style={[styles.summaryMetricCard, { backgroundColor: surfaceMuted }]}> 
              <ThemedText style={styles.summaryMetricLabel}>联系信息</ThemedText>
              <ThemedText style={styles.summaryMetricValue} type="defaultSemiBold">
                {detail?.mobileNo || detail?.defaultContact?.phone || '未设置'}
              </ThemedText>
              <ThemedText numberOfLines={1} style={styles.summaryMetricHint}>
                {detail?.emailId || detail?.defaultContact?.email || '未设置邮箱'}
              </ThemedText>
            </View>
            <View style={[styles.summaryMetricCard, { backgroundColor: surfaceMuted }]}> 
              <ThemedText style={styles.summaryMetricLabel}>默认地址</ThemedText>
              <ThemedText numberOfLines={2} style={styles.summaryMetricValue} type="defaultSemiBold">
                {buildAddressPreview(detail)}
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <SectionHeader hint="维护采购流程默认使用的主体、分组与结算信息。" title="基础资料" />
          <ProductTextField
            editable={isEditing}
            label="供应商名称"
            onChangeText={setSupplierDisplayName}
            placeholder="输入供应商名称"
            value={supplierDisplayName}
          />
          <View style={styles.segmentedWrap}>
            {[
              { label: '公司主体', value: 'Company' as const },
              { label: '个人主体', value: 'Individual' as const },
            ].map((option) => {
              const active = supplierType === option.value;
              return (
                <Pressable
                  disabled={!isEditing}
                  key={option.value}
                  onPress={() => setSupplierType(option.value)}
                  style={[
                    styles.segmentedOption,
                    active ? { borderColor: tintColor, backgroundColor: '#EAF2FF' } : null,
                    !isEditing ? styles.segmentedOptionDisabled : null,
                  ]}>
                  <ThemedText style={[styles.segmentedText, active ? { color: tintColor } : null]} type="defaultSemiBold">
                    {option.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.rowFields}>
            <View style={styles.rowField}>
              <ProductSelectorField
                disabled={!isEditing}
                label="供应商分组"
                onPress={() => handleOpenMasterPicker('supplierGroup')}
                value={supplierGroup}
              />
            </View>
            <View style={styles.rowField}>
              <ProductSelectorField
                disabled={!isEditing}
                label="默认币种"
                onPress={() => handleOpenMasterPicker('currency')}
                value={defaultCurrency}
              />
            </View>
          </View>

          <View style={styles.rowFields}>
            <View style={styles.rowField}>
              <ProductTextField editable={isEditing} label="供应商电话" onChangeText={setMobileNo} placeholder="输入供应商电话" value={mobileNo} />
            </View>
            <View style={styles.rowField}>
              <ProductTextField editable={isEditing} label="供应商邮箱" onChangeText={setEmailId} placeholder="输入供应商邮箱" value={emailId} />
            </View>
          </View>

          <ProductTextField editable={isEditing} label="供应商备注" multiline onChangeText={setRemarks} placeholder="补充账期、对公账户或合作说明" value={remarks} />
        </View>

        <View style={styles.sectionBlock}>
          <SectionHeader hint="采购单据里的默认联系人，会优先取这里维护的值。" title="默认联系人" />
          <ProductTextField editable={isEditing} label="联系人名称" onChangeText={setContactDisplayName} placeholder="例如 张三" value={contactDisplayName} />
          <View style={styles.rowFields}>
            <View style={styles.rowField}>
              <ProductTextField editable={isEditing} label="联系人电话" onChangeText={setContactPhone} placeholder="输入手机号" value={contactPhone} />
            </View>
            <View style={styles.rowField}>
              <ProductTextField editable={isEditing} label="联系人邮箱" onChangeText={setContactEmail} placeholder="输入邮箱，可留空" value={contactEmail} />
            </View>
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <SectionHeader hint="默认地址会直接带入采购单据，也用于后续发票和付款核对。" title="默认地址" />
          <ProductTextField editable={isEditing} label="地址行 1" onChangeText={setAddressLine1} placeholder="输入地址行 1" value={addressLine1} />
          <ProductTextField editable={isEditing} label="地址行 2" onChangeText={setAddressLine2} placeholder="输入地址行 2" value={addressLine2} />
          <View style={styles.rowFields}>
            <View style={styles.rowField}>
              <ProductTextField editable={isEditing} label="城市" onChangeText={setCity} placeholder="例如 上海" value={city} />
            </View>
            <View style={styles.rowField}>
              <ProductTextField editable={isEditing} label="区县" onChangeText={setCounty} placeholder="例如 闵行区" value={county} />
            </View>
          </View>
          <View style={styles.rowFields}>
            <View style={styles.rowField}>
              <ProductTextField editable={isEditing} label="省 / 州" onChangeText={setState} placeholder="例如 上海" value={state} />
            </View>
            <View style={styles.rowField}>
              <ProductTextField editable={isEditing} label="国家" onChangeText={setCountry} placeholder="例如 China" value={country} />
            </View>
          </View>
          <View style={styles.rowFields}>
            <View style={styles.rowField}>
              <ProductTextField editable={isEditing} label="邮编" onChangeText={setPincode} placeholder="可留空" value={pincode} />
            </View>
            <View style={styles.rowField}>
              <ProductTextField editable={isEditing} label="地址电话" onChangeText={setAddressPhone} placeholder="可留空" value={addressPhone} />
            </View>
          </View>
          <ProductTextField editable={isEditing} label="地址邮箱" onChangeText={setAddressEmail} placeholder="可留空" value={addressEmail} />
        </View>
      </ScrollView>

      <ProductPickerSheet
        hint={masterPickerTarget === 'supplierGroup' ? '用于采购报表与主数据分层。' : '供应商默认结算币种。'}
        onChangeQuery={setMasterPickerQuery}
        onClose={() => {
          setMasterPickerVisible(false);
          setMasterPickerTarget(null);
          setMasterPickerQuery('');
        }}
        onSelect={handleSelectMasterOption}
        options={masterPickerOptions}
        placeholder={masterPickerTarget === 'supplierGroup' ? '搜索供应商分组' : '搜索币种'}
        query={masterPickerQuery}
        selectedValue={masterPickerTarget === 'supplierGroup' ? supplierGroup : defaultCurrency}
        title={masterPickerTarget === 'supplierGroup' ? '选择供应商分组' : '选择默认币种'}
        visible={masterPickerVisible}
      />
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
    paddingBottom: 140,
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
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderRadius: 999,
    height: 200,
    position: 'absolute',
    right: -70,
    top: -70,
    width: 200,
  },
  heroGlowAmber: {
    backgroundColor: 'rgba(251,191,36,0.14)',
    borderRadius: 999,
    height: 120,
    left: -20,
    position: 'absolute',
    top: 120,
    width: 120,
  },
  heroTopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  heroMainCopy: {
    flex: 1,
    gap: 4,
  },
  heroEyebrow: {
    color: '#2563EB',
    fontSize: 13,
    letterSpacing: 1.4,
  },
  heroTitle: {
    color: '#14213D',
    fontSize: 26,
    lineHeight: 30,
  },
  heroMeta: {
    color: '#64748B',
    fontSize: 14,
  },
  heroSubMeta: {
    color: '#4062D8',
    fontSize: 14,
  },
  heroStatusChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroStatusChipText: {
    fontSize: 12,
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  heroStatCard: {
    borderRadius: 18,
    flex: 1,
    gap: 4,
    minHeight: 88,
    padding: 14,
  },
  heroStatLabel: {
    color: '#64748B',
    fontSize: 13,
  },
  heroStatValue: {
    fontSize: 17,
    lineHeight: 23,
  },
  summaryCard: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  summaryCardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  summaryCardTitle: {
    fontSize: 18,
  },
  summaryCardHint: {
    color: '#64748B',
    maxWidth: 250,
  },
  enabledRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  enabledLabel: {
    color: '#64748B',
    fontSize: 13,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryMetricCard: {
    borderRadius: 18,
    flex: 1,
    gap: 4,
    minHeight: 92,
    padding: 14,
  },
  summaryMetricLabel: {
    color: '#64748B',
    fontSize: 13,
  },
  summaryMetricValue: {
    fontSize: 15,
    lineHeight: 21,
  },
  summaryMetricHint: {
    color: '#71859D',
    fontSize: 12,
  },
  sectionBlock: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D8E1EE',
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  sectionHeader: {
    gap: 4,
  },
  sectionTitle: {
    fontSize: 18,
  },
  sectionHint: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 20,
  },
  rowFields: {
    flexDirection: 'row',
    gap: 10,
  },
  rowField: {
    flex: 1,
  },
  segmentedWrap: {
    flexDirection: 'row',
    gap: 10,
  },
  segmentedOption: {
    alignItems: 'center',
    borderColor: '#D8E1EE',
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 12,
  },
  segmentedOptionDisabled: {
    opacity: 0.6,
  },
  segmentedText: {
    color: '#5B6B81',
    fontSize: 14,
  },
  footerBar: {
    flexDirection: 'row',
    gap: 12,
  },
  footerSecondary: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#C9D8EE',
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
  },
  footerPrimary: {
    alignItems: 'center',
    borderRadius: 18,
    flex: 1.2,
    justifyContent: 'center',
    minHeight: 52,
  },
  footerPrimaryText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
});
