import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { ProductPickerSheet, ProductSelectorField, ProductTextField } from '@/components/product-form-controls';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useFeedback } from '@/providers/feedback-provider';
import { fetchCustomerDetail, saveCustomer, setCustomerDisabled, type CustomerDetail } from '@/services/customers';
import { checkLinkOptionExists, searchLinkOptions } from '@/services/master-data';

function buildAddressPreview(detail: CustomerDetail | null) {
  return (
    detail?.defaultAddress?.addressDisplay ||
    detail?.defaultAddress?.addressLine1 ||
    detail?.recentAddresses?.[0]?.addressDisplay ||
    '未设置默认地址'
  );
}

export default function CustomerDetailScreen() {
  const router = useRouter();
  const { customerName } = useLocalSearchParams<{ customerName: string }>();
  const { showError, showSuccess } = useFeedback();
  const tintColor = useThemeColor({}, 'tint');
  const surface = useThemeColor({}, 'surface');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const success = useThemeColor({}, 'success');
  const danger = useThemeColor({}, 'danger');

  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [customerDisplayName, setCustomerDisplayName] = useState('');
  const [customerType, setCustomerType] = useState<'Company' | 'Individual'>('Company');
  const [customerGroup, setCustomerGroup] = useState('');
  const [territory, setTerritory] = useState('');
  const [defaultCurrency, setDefaultCurrency] = useState('');
  const [defaultPriceList, setDefaultPriceList] = useState('');
  const [remarks, setRemarks] = useState('');
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
  const [masterPickerTarget, setMasterPickerTarget] = useState<'customerGroup' | 'territory' | 'priceList' | 'currency' | null>(null);
  const [masterPickerQuery, setMasterPickerQuery] = useState('');
  const [masterPickerOptions, setMasterPickerOptions] = useState<string[]>([]);

  const hydrateDraft = useCallback((next: CustomerDetail | null) => {
    setDetail(next);
    setCustomerDisplayName(next?.displayName ?? next?.customerName ?? '');
    setCustomerType(next?.customerType === 'Individual' ? 'Individual' : 'Company');
    setCustomerGroup(next?.customerGroup ?? '');
    setTerritory(next?.territory ?? '');
    setDefaultCurrency(next?.defaultCurrency ?? 'CNY');
    setDefaultPriceList(next?.defaultPriceList ?? '');
    setRemarks(next?.remarks ?? '');
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
        const doctype =
          masterPickerTarget === 'customerGroup'
            ? 'Customer Group'
            : masterPickerTarget === 'territory'
              ? 'Territory'
              : masterPickerTarget === 'priceList'
                ? 'Price List'
                : 'Currency';
        const options = await searchLinkOptions(doctype, masterPickerQuery);
        if (!cancelled) {
          setMasterPickerOptions(
            options
              .map((option) => option.value.trim())
              .filter(Boolean),
          );
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
      if (!customerName) {
        return;
      }
      try {
        if (refresh) {
          setIsRefreshing(true);
        }
        const next = await fetchCustomerDetail(customerName);
        hydrateDraft(next);
      } catch (error) {
        showError(error instanceof Error ? error.message : '加载客户详情失败');
      } finally {
        setIsRefreshing(false);
      }
    },
    [customerName, hydrateDraft, showError],
  );

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const handleOpenMasterPicker = (target: 'customerGroup' | 'territory' | 'priceList' | 'currency') => {
    setMasterPickerTarget(target);
    setMasterPickerQuery('');
    setMasterPickerVisible(true);
  };

  const handleSelectMasterOption = (value: string) => {
    if (masterPickerTarget === 'customerGroup') {
      setCustomerGroup(value);
    }
    if (masterPickerTarget === 'territory') {
      setTerritory(value);
    }
    if (masterPickerTarget === 'priceList') {
      setDefaultPriceList(value);
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

    if (!customerDisplayName.trim()) {
      showError('请先填写客户名称。');
      return;
    }

    if (customerGroup.trim()) {
      const exists = await checkLinkOptionExists('Customer Group', customerGroup.trim());
      if (!exists) {
        showError('客户分组不存在，请从候选项中选择。');
        return;
      }
    }

    if (territory.trim()) {
      const exists = await checkLinkOptionExists('Territory', territory.trim());
      if (!exists) {
        showError('销售区域不存在，请从候选项中选择。');
        return;
      }
    }

    if (defaultPriceList.trim()) {
      const exists = await checkLinkOptionExists('Price List', defaultPriceList.trim());
      if (!exists) {
        showError('默认价格表不存在，请从候选项中选择。');
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
      const saved = await saveCustomer(detail.name, {
        customerName: customerDisplayName.trim(),
        customerType,
        customerGroup: customerGroup.trim() || undefined,
        territory: territory.trim() || undefined,
        defaultCurrency: defaultCurrency.trim() || undefined,
        defaultPriceList: defaultPriceList.trim() || undefined,
        remarks: remarks.trim() || undefined,
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
                addressType: 'Shipping',
              }
            : undefined,
        disabled: !enabled,
      });

      if (!saved) {
        throw new Error('保存客户失败');
      }

      hydrateDraft(saved);
      setIsEditing(false);
      showSuccess(`客户 ${saved.displayName} 已保存`);
    } catch (error) {
      showError(error instanceof Error ? error.message : '保存客户失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleDisabled = async () => {
    if (!detail) {
      return;
    }

    try {
      const next = await setCustomerDisabled(detail.name, !detail.disabled);
      if (!next) {
        throw new Error('更新客户状态失败');
      }
      hydrateDraft(next);
      showSuccess(`客户 ${next.displayName} 已${next.disabled ? '停用' : '启用'}`);
    } catch (error) {
      showError(error instanceof Error ? error.message : '更新客户状态失败');
    }
  };

  return (
    <AppShell
      compactHeader
      contentCard={false}
      description="查看客户默认联系人、默认地址和价格表配置，并维护后续订单的建议值。"
      footer={
        <View style={styles.footerBar}>
          <Pressable onPress={() => router.replace('/common/customers')} style={styles.footerSecondary}>
            <ThemedText style={{ color: tintColor }} type="defaultSemiBold">
              返回客户
            </ThemedText>
          </Pressable>
          {isEditing ? (
            <Pressable
              onPress={() => void handleSave()}
              style={[styles.footerPrimary, { backgroundColor: tintColor, opacity: isSaving ? 0.72 : 1 }]}>
              <ThemedText style={styles.footerPrimaryText} type="defaultSemiBold">
                {isSaving ? '保存中…' : '保存客户'}
              </ThemedText>
            </Pressable>
          ) : (
            <Pressable onPress={() => setIsEditing(true)} style={[styles.footerPrimary, { backgroundColor: tintColor }]}>
              <ThemedText style={styles.footerPrimaryText} type="defaultSemiBold">
                编辑客户
              </ThemedText>
            </Pressable>
          )}
        </View>
      }
      title={detail?.displayName || '客户详情'}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl onRefresh={() => void loadDetail(true)} refreshing={isRefreshing} />}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.heroCard, { backgroundColor: surface, borderColor }]}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroMainCopy}>
              <ThemedText style={styles.heroTitle} type="defaultSemiBold">
                {detail?.displayName || detail?.customerName || customerName || '客户'}
              </ThemedText>
              <ThemedText style={styles.heroMeta}>编码 {detail?.name || customerName || '—'}</ThemedText>
            </View>
            <View
              style={[
                styles.statusChip,
                { backgroundColor: detail?.disabled ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)' },
              ]}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: detail?.disabled ? danger : success },
                ]}
              />
              <ThemedText
                style={[styles.statusChipText, { color: detail?.disabled ? danger : success }]}
                type="defaultSemiBold">
                {detail?.disabled ? '已停用' : '启用中'}
              </ThemedText>
            </View>
          </View>
          <View style={styles.heroMetricsRow}>
            <View style={[styles.metricCard, { backgroundColor: surfaceMuted }]}>
              <ThemedText style={styles.metricLabel}>默认联系人</ThemedText>
              <ThemedText style={styles.metricValue} type="defaultSemiBold">
                {detail?.defaultContact?.displayName || '未设置'}
              </ThemedText>
              <ThemedText style={styles.metricMeta}>{detail?.defaultContact?.phone || detail?.mobileNo || '暂无电话'}</ThemedText>
            </View>
            <View style={[styles.metricCard, { backgroundColor: surfaceMuted }]}>
              <ThemedText style={styles.metricLabel}>默认地址</ThemedText>
              <ThemedText numberOfLines={3} style={styles.metricValueSmall} type="defaultSemiBold">
                {buildAddressPreview(detail)}
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: surface, borderColor }]}>
          <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
            客户规则
          </ThemedText>
          <View style={[styles.ruleRow, { backgroundColor: surfaceMuted }]}>
            <View style={styles.ruleCopy}>
              <ThemedText style={styles.ruleLabel} type="defaultSemiBold">
                客户状态
              </ThemedText>
              <ThemedText style={styles.ruleHint}>停用后不会影响历史订单快照，但会减少后续新建单据时的建议使用。</ThemedText>
            </View>
            {isEditing ? (
              <Switch onValueChange={setEnabled} value={enabled} />
            ) : (
              <ThemedText style={styles.ruleValue} type="defaultSemiBold">
                {detail?.disabled ? '已停用' : '启用中'}
              </ThemedText>
            )}
          </View>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: surface, borderColor }]}>
          <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
            客户资料
          </ThemedText>
          {isEditing ? (
            <>
              <ProductTextField label="客户名称" onChangeText={setCustomerDisplayName} placeholder="输入客户名称" required value={customerDisplayName} />
              <View style={styles.segmentedWrap}>
                {[
                  { label: '公司客户', value: 'Company' as const },
                  { label: '个人客户', value: 'Individual' as const },
                ].map((option) => {
                  const active = customerType === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => setCustomerType(option.value)}
                      style={[styles.segmentedOption, active ? { borderColor: tintColor, backgroundColor: '#EAF2FF' } : null]}>
                      <ThemedText style={[styles.segmentedText, active ? { color: tintColor } : null]} type="defaultSemiBold">
                        {option.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.rowFields}>
                <View style={styles.rowField}>
                  <ProductSelectorField label="客户分组" onPress={() => handleOpenMasterPicker('customerGroup')} value={customerGroup} />
                </View>
                <View style={styles.rowField}>
                  <ProductSelectorField label="销售区域" onPress={() => handleOpenMasterPicker('territory')} value={territory} />
                </View>
              </View>
              <View style={styles.rowFields}>
                <View style={styles.rowField}>
                  <ProductSelectorField label="默认币种" onPress={() => handleOpenMasterPicker('currency')} value={defaultCurrency} />
                </View>
                <View style={styles.rowField}>
                  <ProductSelectorField label="默认价格表" onPress={() => handleOpenMasterPicker('priceList')} value={defaultPriceList} />
                </View>
              </View>
              <ProductTextField label="客户备注" multiline onChangeText={setRemarks} placeholder="补充账期、结算说明或业务备注" value={remarks} />
            </>
          ) : (
            <View style={styles.readOnlyList}>
              <View style={styles.readOnlyRow}>
                <ThemedText style={styles.readOnlyLabel}>客户类型</ThemedText>
                <ThemedText style={styles.readOnlyValue} type="defaultSemiBold">
                  {detail?.customerType === 'Individual' ? '个人客户' : '公司客户'}
                </ThemedText>
              </View>
              <View style={styles.readOnlyRow}>
                <ThemedText style={styles.readOnlyLabel}>客户分组</ThemedText>
                <ThemedText style={styles.readOnlyValue} type="defaultSemiBold">
                  {detail?.customerGroup || '未设置'}
                </ThemedText>
              </View>
              <View style={styles.readOnlyRow}>
                <ThemedText style={styles.readOnlyLabel}>销售区域</ThemedText>
                <ThemedText style={styles.readOnlyValue} type="defaultSemiBold">
                  {detail?.territory || '未设置'}
                </ThemedText>
              </View>
              <View style={styles.readOnlyRow}>
                <ThemedText style={styles.readOnlyLabel}>默认价格表</ThemedText>
                <ThemedText style={styles.readOnlyValue} type="defaultSemiBold">
                  {detail?.defaultPriceList || '未设置'}
                </ThemedText>
              </View>
              <View style={styles.readOnlyRow}>
                <ThemedText style={styles.readOnlyLabel}>客户备注</ThemedText>
                <ThemedText style={styles.readOnlyValue} type="defaultSemiBold">
                  {detail?.remarks || '暂无备注'}
                </ThemedText>
              </View>
            </View>
          )}
        </View>

        <View style={[styles.sectionCard, { backgroundColor: surface, borderColor }]}>
          <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
            默认联系人
          </ThemedText>
          {isEditing ? (
            <>
              <ProductTextField label="联系人名称" onChangeText={setContactDisplayName} placeholder="例如 张三" value={contactDisplayName} />
              <View style={styles.rowFields}>
                <View style={styles.rowField}>
                  <ProductTextField label="联系人电话" onChangeText={setContactPhone} placeholder="输入手机号" value={contactPhone} />
                </View>
                <View style={styles.rowField}>
                  <ProductTextField label="联系人邮箱" onChangeText={setContactEmail} placeholder="输入邮箱，可留空" value={contactEmail} />
                </View>
              </View>
            </>
          ) : (
            <View style={styles.readOnlyList}>
              <View style={styles.readOnlyRow}>
                <ThemedText style={styles.readOnlyLabel}>联系人名称</ThemedText>
                <ThemedText style={styles.readOnlyValue} type="defaultSemiBold">
                  {detail?.defaultContact?.displayName || '未设置'}
                </ThemedText>
              </View>
              <View style={styles.readOnlyRow}>
                <ThemedText style={styles.readOnlyLabel}>联系人电话</ThemedText>
                <ThemedText style={styles.readOnlyValue} type="defaultSemiBold">
                  {detail?.defaultContact?.phone || detail?.mobileNo || '未设置'}
                </ThemedText>
              </View>
              <View style={styles.readOnlyRow}>
                <ThemedText style={styles.readOnlyLabel}>联系人邮箱</ThemedText>
                <ThemedText style={styles.readOnlyValue} type="defaultSemiBold">
                  {detail?.defaultContact?.email || detail?.emailId || '未设置'}
                </ThemedText>
              </View>
            </View>
          )}
        </View>

        <View style={[styles.sectionCard, { backgroundColor: surface, borderColor }]}>
          <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
            默认地址
          </ThemedText>
          {isEditing ? (
            <>
              <ProductTextField label="地址行 1" onChangeText={setAddressLine1} placeholder="例如 北京市朝阳区测试客户路 100 号" value={addressLine1} />
              <ProductTextField label="地址行 2" onChangeText={setAddressLine2} placeholder="楼层、园区或补充说明，可留空" value={addressLine2} />
              <View style={styles.rowFields}>
                <View style={styles.rowField}>
                  <ProductTextField label="城市" onChangeText={setCity} placeholder="例如 北京" value={city} />
                </View>
                <View style={styles.rowField}>
                  <ProductTextField label="区县" onChangeText={setCounty} placeholder="例如 朝阳区" value={county} />
                </View>
              </View>
              <View style={styles.rowFields}>
                <View style={styles.rowField}>
                  <ProductTextField label="省份" onChangeText={setState} placeholder="例如 北京市" value={state} />
                </View>
                <View style={styles.rowField}>
                  <ProductTextField label="国家" onChangeText={setCountry} placeholder="例如 China" value={country} />
                </View>
              </View>
              <View style={styles.rowFields}>
                <View style={styles.rowField}>
                  <ProductTextField label="邮编" onChangeText={setPincode} placeholder="可留空" value={pincode} />
                </View>
                <View style={styles.rowField}>
                  <ProductTextField label="地址电话" onChangeText={setAddressPhone} placeholder="可留空" value={addressPhone} />
                </View>
              </View>
              <ProductTextField label="地址邮箱" onChangeText={setAddressEmail} placeholder="可留空" value={addressEmail} />
            </>
          ) : (
            <View style={styles.readOnlyList}>
              <View style={styles.readOnlyRow}>
                <ThemedText style={styles.readOnlyLabel}>默认地址</ThemedText>
                <ThemedText style={styles.readOnlyValue} type="defaultSemiBold">
                  {buildAddressPreview(detail)}
                </ThemedText>
              </View>
              {(detail?.recentAddresses?.length ?? 0) > 0 ? (
                <View style={styles.readOnlyRow}>
                  <ThemedText style={styles.readOnlyLabel}>最近订单地址</ThemedText>
                  <ThemedText style={styles.readOnlyValue} type="defaultSemiBold">
                    {detail?.recentAddresses?.[0]?.addressDisplay || detail?.recentAddresses?.[0]?.addressLine1 || '—'}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          )}
        </View>

        <View style={[styles.sectionCard, { backgroundColor: surface, borderColor }]}>
          <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
            风险操作
          </ThemedText>
          <ThemedText style={styles.sectionHint}>停用客户不会改写历史订单快照，但会影响后续下单建议值与选择范围。</ThemedText>
          <Pressable
            onPress={() => void handleToggleDisabled()}
            style={[styles.primaryDangerButton, { backgroundColor: detail?.disabled ? '#2F7D4A' : '#DC2626' }]}>
            <ThemedText style={styles.footerPrimaryText} type="defaultSemiBold">
              {detail?.disabled ? '重新启用客户' : '停用客户'}
            </ThemedText>
          </Pressable>
        </View>
      </ScrollView>

      <ProductPickerSheet
        hint="通过搜索选择系统中已有主数据。"
        onChangeQuery={setMasterPickerQuery}
        onClose={() => {
          setMasterPickerVisible(false);
          setMasterPickerTarget(null);
          setMasterPickerQuery('');
        }}
        onSelect={handleSelectMasterOption}
        options={masterPickerOptions}
        placeholder={
          masterPickerTarget === 'customerGroup'
            ? '搜索客户分组'
            : masterPickerTarget === 'territory'
              ? '搜索销售区域'
              : masterPickerTarget === 'priceList'
                ? '搜索价格表'
                : '搜索币种'
        }
        query={masterPickerQuery}
        selectedValue={
          masterPickerTarget === 'customerGroup'
            ? customerGroup
            : masterPickerTarget === 'territory'
              ? territory
              : masterPickerTarget === 'priceList'
                ? defaultPriceList
                : defaultCurrency
        }
        title={
          masterPickerTarget === 'customerGroup'
            ? '选择客户分组'
            : masterPickerTarget === 'territory'
              ? '选择销售区域'
              : masterPickerTarget === 'priceList'
                ? '选择默认价格表'
                : '选择默认币种'
        }
        visible={masterPickerVisible}
      />
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
    gap: 14,
    padding: 18,
  },
  heroTopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  heroMainCopy: {
    flex: 1,
    gap: 6,
  },
  heroTitle: {
    fontSize: 22,
    lineHeight: 28,
  },
  heroMeta: {
    color: '#64748B',
    fontSize: 14,
  },
  statusChip: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusDot: {
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  statusChipText: {
    fontSize: 14,
    lineHeight: 18,
  },
  heroMetricsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    borderRadius: 18,
    flex: 1,
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  metricLabel: {
    color: '#64748B',
    fontSize: 13,
  },
  metricValue: {
    fontSize: 18,
    lineHeight: 24,
  },
  metricValueSmall: {
    fontSize: 15,
    lineHeight: 21,
  },
  sectionCard: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    padding: 18,
  },
  sectionTitle: {
    fontSize: 18,
  },
  sectionHint: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 18,
  },
  ruleRow: {
    alignItems: 'center',
    borderRadius: 18,
    flexDirection: 'row',
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
    gap: 4,
  },
  readOnlyLabel: {
    color: '#64748B',
    fontSize: 13,
  },
  readOnlyValue: {
    fontSize: 16,
    lineHeight: 24,
  },
  rowFields: {
    flexDirection: 'row',
    gap: 12,
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
    backgroundColor: '#EFF3F7',
    borderColor: '#DEE4EA',
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 12,
  },
  segmentedText: {
    fontSize: 15,
  },
  primaryDangerButton: {
    alignItems: 'center',
    borderRadius: 18,
    justifyContent: 'center',
    minHeight: 48,
  },
  footerBar: {
    flexDirection: 'row',
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
