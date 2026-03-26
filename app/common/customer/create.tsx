import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { ProductPickerSheet, ProductSelectorField, ProductTextField } from '@/components/product-form-controls';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useFeedback } from '@/providers/feedback-provider';
import { createCustomer } from '@/services/customers';
import { checkLinkOptionExists, searchLinkOptions } from '@/services/master-data';

export default function CustomerCreateScreen() {
  const router = useRouter();
  const { showError, showSuccess } = useFeedback();
  const tintColor = useThemeColor({}, 'tint');

  const [customerName, setCustomerName] = useState('');
  const [customerType, setCustomerType] = useState<'Company' | 'Individual'>('Company');
  const [customerGroup, setCustomerGroup] = useState('');
  const [territory, setTerritory] = useState('');
  const [defaultCurrency, setDefaultCurrency] = useState('CNY');
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
  const [country, setCountry] = useState('China');
  const [pincode, setPincode] = useState('');
  const [addressPhone, setAddressPhone] = useState('');
  const [addressEmail, setAddressEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [masterPickerVisible, setMasterPickerVisible] = useState(false);
  const [masterPickerTarget, setMasterPickerTarget] = useState<'customerGroup' | 'territory' | 'priceList' | 'currency' | null>(null);
  const [masterPickerQuery, setMasterPickerQuery] = useState('');
  const [masterPickerOptions, setMasterPickerOptions] = useState<string[]>([]);

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

  const handleCreate = async () => {
    if (!customerName.trim()) {
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
      const created = await createCustomer({
        customerName: customerName.trim(),
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
      });

      if (!created) {
        throw new Error('客户创建失败');
      }

      showSuccess(`客户 ${created.displayName} 已创建`);
      router.replace({
        pathname: '/common/customer/[customerName]',
        params: { customerName: created.name },
      });
    } catch (error) {
      showError(error instanceof Error ? error.message : '创建客户失败');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppShell
      compactHeader
      contentCard={false}
      description="新增客户主数据，补充默认联系人、地址和价格表，用于订单、发货、开票和收款流程。"
      footer={
        <View style={styles.footerBar}>
          <Pressable onPress={() => router.replace('/common/customers')} style={styles.footerSecondary}>
            <ThemedText style={{ color: tintColor }} type="defaultSemiBold">
              返回客户
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => void handleCreate()}
            style={[styles.footerPrimary, { backgroundColor: tintColor, opacity: isSaving ? 0.72 : 1 }]}>
            <ThemedText style={styles.footerPrimaryText} type="defaultSemiBold">
              {isSaving ? '创建中…' : '创建客户'}
            </ThemedText>
          </Pressable>
        </View>
      }
      title="新增客户">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.sectionBlock}>
          <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
            客户资料
          </ThemedText>
          <ProductTextField label="客户名称" onChangeText={setCustomerName} placeholder="例如 Palmer Productions Ltd." required value={customerName} />
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
        </View>

        <View style={styles.sectionBlock}>
          <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
            默认联系人
          </ThemedText>
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
          <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
            默认地址
          </ThemedText>
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
    gap: 16,
    paddingBottom: 20,
  },
  sectionBlock: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
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
