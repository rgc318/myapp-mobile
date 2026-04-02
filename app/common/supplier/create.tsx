import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { ProductPickerSheet, ProductSelectorField, ProductTextField } from '@/components/product-form-controls';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useFeedback } from '@/providers/feedback-provider';
import { createSupplier } from '@/services/suppliers';
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

export default function SupplierCreateScreen() {
  const router = useRouter();
  const { showError, showSuccess } = useFeedback();
  const tintColor = useThemeColor({}, 'tint');
  const surface = useThemeColor({}, 'surface');
  const borderColor = useThemeColor({}, 'border');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');

  const [supplierName, setSupplierName] = useState('');
  const [supplierType, setSupplierType] = useState<'Company' | 'Individual'>('Company');
  const [supplierGroup, setSupplierGroup] = useState('');
  const [defaultCurrency, setDefaultCurrency] = useState('CNY');
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
  const [isSaving, setIsSaving] = useState(false);

  const [masterPickerVisible, setMasterPickerVisible] = useState(false);
  const [masterPickerTarget, setMasterPickerTarget] = useState<'supplierGroup' | 'currency' | null>(null);
  const [masterPickerQuery, setMasterPickerQuery] = useState('');
  const [masterPickerOptions, setMasterPickerOptions] = useState<string[]>([]);

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

  const completion = useMemo(() => {
    let score = 0;
    if (supplierName.trim()) score += 1;
    if (supplierGroup.trim()) score += 1;
    if (contactDisplayName.trim() || contactPhone.trim() || contactEmail.trim()) score += 1;
    if (addressLine1.trim() && city.trim() && country.trim()) score += 1;
    return score;
  }, [addressLine1, city, contactDisplayName, contactEmail, contactPhone, country, supplierGroup, supplierName]);

  const handleCreate = async () => {
    if (!supplierName.trim()) {
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
      const created = await createSupplier({
        supplierName: supplierName.trim(),
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
      });

      if (!created) {
        throw new Error('供应商创建失败');
      }

      showSuccess(`供应商 ${created.displayName} 已创建`);
      router.replace({
        pathname: '/common/supplier/[supplierName]',
        params: { supplierName: created.name },
      });
    } catch (error) {
      showError(error instanceof Error ? error.message : '创建供应商失败');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppShell
      compactHeader
      contentCard={false}
      description="新增供应商主数据，补充默认联系人、默认地址和结算币种，用于采购、发票和付款流程。"
      footer={
        <View style={styles.footerBar}>
          <Pressable onPress={() => router.replace('/common/suppliers')} style={styles.footerSecondary}>
            <ThemedText style={{ color: tintColor }} type="defaultSemiBold">
              返回供应商
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => void handleCreate()}
            style={[styles.footerPrimary, { backgroundColor: tintColor, opacity: isSaving ? 0.72 : 1 }]}>
            <ThemedText style={styles.footerPrimaryText} type="defaultSemiBold">
              {isSaving ? '创建中…' : '创建供应商'}
            </ThemedText>
          </Pressable>
        </View>
      }
      title="新增供应商">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.heroCard, { backgroundColor: surface, borderColor }]}> 
          <View style={styles.heroGlowBlue} />
          <View style={styles.heroGlowGreen} />
          <View style={styles.heroHeader}>
            <View style={styles.heroCopy}>
              <ThemedText style={styles.heroEyebrow}>NEW SUPPLIER</ThemedText>
              <ThemedText style={styles.heroTitle} type="title">
                新建供应商档案
              </ThemedText>
              <ThemedText style={styles.heroDescription}>先录主数据，再让采购、收货、开票和付款共享同一套联系人与地址信息。</ThemedText>
            </View>
            <View style={[styles.heroBadge, { backgroundColor: 'rgba(37,99,235,0.10)' }]}>
              <ThemedText style={styles.heroBadgeLabel}>完成度</ThemedText>
              <ThemedText style={[styles.heroBadgeValue, { color: tintColor }]} type="defaultSemiBold">
                {completion}/4
              </ThemedText>
            </View>
          </View>
          <View style={styles.heroTipsRow}>
            {['主数据', '联系人', '默认地址', '结算币种'].map((label) => (
              <View key={label} style={[styles.tipChip, { backgroundColor: surfaceMuted }]}> 
                <ThemedText style={styles.tipChipText} type="defaultSemiBold">
                  {label}
                </ThemedText>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <SectionHeader hint="定义供应商名称、主体类型和默认结算信息。" title="基础资料" />
          <ProductTextField label="供应商名称" onChangeText={setSupplierName} placeholder="例如 MA Inc." required value={supplierName} />
          <View style={styles.segmentedWrap}>
            {[
              { label: '公司主体', value: 'Company' as const },
              { label: '个人主体', value: 'Individual' as const },
            ].map((option) => {
              const active = supplierType === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setSupplierType(option.value)}
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
              <ProductSelectorField label="供应商分组" onPress={() => handleOpenMasterPicker('supplierGroup')} value={supplierGroup} />
            </View>
            <View style={styles.rowField}>
              <ProductSelectorField label="默认币种" onPress={() => handleOpenMasterPicker('currency')} value={defaultCurrency} />
            </View>
          </View>
          <View style={styles.rowFields}>
            <View style={styles.rowField}>
              <ProductTextField label="供应商电话" onChangeText={setMobileNo} placeholder="输入主联系电话" value={mobileNo} />
            </View>
            <View style={styles.rowField}>
              <ProductTextField label="供应商邮箱" onChangeText={setEmailId} placeholder="输入主邮箱，可留空" value={emailId} />
            </View>
          </View>
          <ProductTextField label="供应商备注" multiline onChangeText={setRemarks} placeholder="补充账期、对公账户或合作说明" value={remarks} />
        </View>

        <View style={styles.sectionBlock}>
          <SectionHeader hint="用于采购沟通和异常处理，建议至少留下一个主联系人。" title="默认联系人" />
          <ProductTextField label="联系人名称" onChangeText={setContactDisplayName} placeholder="例如 张三" value={contactDisplayName} />
          <View style={styles.rowFields}>
            <View style={styles.rowField}>
              <ProductTextField label="联系人电话" onChangeText={setContactPhone} placeholder="输入手机号" value={contactPhone} />
            </View>
            <View style={styles.rowField}>
              <ProductTextField label="联系人邮箱" onChangeText={setContactEmail} placeholder="输入邮箱，可留空" value={contactEmail} />
            </View>
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <SectionHeader hint="默认地址会直接带入采购单据，建议补齐城市和国家。" title="默认地址" />
          <ProductTextField label="地址行 1" onChangeText={setAddressLine1} placeholder="例如 上海市闵行区测试供应商路 88 号" value={addressLine1} />
          <ProductTextField label="地址行 2" onChangeText={setAddressLine2} placeholder="楼层、园区或补充描述，可留空" value={addressLine2} />
          <View style={styles.rowFields}>
            <View style={styles.rowField}>
              <ProductTextField label="城市" onChangeText={setCity} placeholder="例如 上海" value={city} />
            </View>
            <View style={styles.rowField}>
              <ProductTextField label="区县" onChangeText={setCounty} placeholder="例如 闵行区" value={county} />
            </View>
          </View>
          <View style={styles.rowFields}>
            <View style={styles.rowField}>
              <ProductTextField label="省 / 州" onChangeText={setState} placeholder="例如 上海" value={state} />
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
    right: -80,
    top: -70,
    width: 200,
  },
  heroGlowGreen: {
    backgroundColor: 'rgba(34,197,94,0.10)',
    borderRadius: 999,
    height: 120,
    left: -30,
    position: 'absolute',
    top: 120,
    width: 120,
  },
  heroHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  heroCopy: {
    flex: 1,
    gap: 6,
  },
  heroEyebrow: {
    color: '#2563EB',
    fontSize: 13,
    letterSpacing: 1.4,
  },
  heroTitle: {
    color: '#14213D',
    fontSize: 30,
    lineHeight: 34,
  },
  heroDescription: {
    color: '#5B6B81',
  },
  heroBadge: {
    borderRadius: 18,
    gap: 4,
    minWidth: 88,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  heroBadgeLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  heroBadgeValue: {
    fontSize: 22,
    lineHeight: 26,
  },
  heroTipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tipChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tipChipText: {
    color: '#4B5563',
    fontSize: 12,
    lineHeight: 16,
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
