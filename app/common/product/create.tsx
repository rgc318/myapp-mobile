import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useFeedback } from '@/providers/feedback-provider';
import { createProduct } from '@/services/products';

function toNumberOrNull(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function ProductField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');

  return (
    <View style={styles.fieldBlock}>
      <ThemedText style={styles.fieldLabel} type="defaultSemiBold">
        {label}
      </ThemedText>
      <TextInput
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(31,42,55,0.38)"
        style={[multiline ? styles.textarea : styles.textInput, { backgroundColor: surfaceMuted, borderColor }]}
        textAlignVertical={multiline ? 'top' : 'center'}
        value={value}
      />
    </View>
  );
}

export default function ProductCreateScreen() {
  const router = useRouter();
  const { showError, showSuccess } = useFeedback();
  const tintColor = useThemeColor({}, 'tint');

  const [itemName, setItemName] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [stockUom, setStockUom] = useState('Nos');
  const [wholesaleDefaultUom, setWholesaleDefaultUom] = useState('Box');
  const [retailDefaultUom, setRetailDefaultUom] = useState('Nos');
  const [standardRate, setStandardRate] = useState('');
  const [wholesaleRate, setWholesaleRate] = useState('');
  const [retailRate, setRetailRate] = useState('');
  const [standardBuyingRate, setStandardBuyingRate] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleCreate = async () => {
    if (!itemName.trim()) {
      showError('请先填写商品名称。');
      return;
    }

    try {
      setIsSaving(true);
      const created = await createProduct({
        itemName: itemName.trim(),
        itemCode: itemCode.trim() || undefined,
        nickname: nickname.trim() || undefined,
        description: description.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
        stockUom: stockUom.trim() || undefined,
        wholesaleDefaultUom: wholesaleDefaultUom.trim() || undefined,
        retailDefaultUom: retailDefaultUom.trim() || undefined,
        standardRate: toNumberOrNull(standardRate),
        wholesaleRate: toNumberOrNull(wholesaleRate),
        retailRate: toNumberOrNull(retailRate),
        standardBuyingRate: toNumberOrNull(standardBuyingRate),
      });

      if (!created) {
        throw new Error('商品创建失败');
      }

      showSuccess(`商品 ${created.itemName} 已创建`);
      router.replace({
        pathname: '/common/product/[itemCode]',
        params: { itemCode: created.itemCode },
      });
    } catch (error) {
      showError(error instanceof Error ? error.message : '创建商品失败');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppShell
      compactHeader
      contentCard={false}
      description="录入商品基础资料、多价格和默认批发/零售单位。"
      footer={
        <View style={styles.footerBar}>
          <Pressable onPress={() => router.back()} style={styles.footerSecondary}>
            <ThemedText style={{ color: tintColor }} type="defaultSemiBold">
              返回商品
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => void handleCreate()}
            style={[styles.footerPrimary, { backgroundColor: tintColor, opacity: isSaving ? 0.72 : 1 }]}>
            <ThemedText style={styles.footerPrimaryText} type="defaultSemiBold">
              {isSaving ? '创建中…' : '创建商品'}
            </ThemedText>
          </Pressable>
        </View>
      }
      title="新增商品">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.sectionBlock}>
          <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
            基础信息
          </ThemedText>
          <ProductField label="商品名称" onChangeText={setItemName} placeholder="例如 可口可乐 500ml" value={itemName} />
          <ProductField label="商品编码" onChangeText={setItemCode} placeholder="可留空，由系统生成" value={itemCode} />
          <ProductField label="商品昵称" onChangeText={setNickname} placeholder="如常用简称或别名" value={nickname} />
          <ProductField label="图片地址" onChangeText={setImageUrl} placeholder="输入商品图片 URL" value={imageUrl} />
          <ProductField label="描述" multiline onChangeText={setDescription} placeholder="补充规格、备注或说明" value={description} />
        </View>

        <View style={styles.sectionBlock}>
          <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
            单位与价格
          </ThemedText>
          <View style={styles.rowFields}>
            <View style={styles.rowField}>
              <ProductField label="库存单位" onChangeText={setStockUom} placeholder="例如 Nos" value={stockUom} />
            </View>
            <View style={styles.rowField}>
              <ProductField label="批发默认单位" onChangeText={setWholesaleDefaultUom} placeholder="例如 Box" value={wholesaleDefaultUom} />
            </View>
          </View>
          <View style={styles.rowFields}>
            <View style={styles.rowField}>
              <ProductField label="零售默认单位" onChangeText={setRetailDefaultUom} placeholder="例如 Nos" value={retailDefaultUom} />
            </View>
            <View style={styles.rowField}>
              <ProductField label="标准售价" onChangeText={setStandardRate} placeholder="例如 99" value={standardRate} />
            </View>
          </View>
          <View style={styles.rowFields}>
            <View style={styles.rowField}>
              <ProductField label="批发价" onChangeText={setWholesaleRate} placeholder="例如 68" value={wholesaleRate} />
            </View>
            <View style={styles.rowField}>
              <ProductField label="零售价" onChangeText={setRetailRate} placeholder="例如 9.9" value={retailRate} />
            </View>
          </View>
          <ProductField label="采购价" onChangeText={setStandardBuyingRate} placeholder="例如 55" value={standardBuyingRate} />
        </View>
      </ScrollView>
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
  fieldBlock: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 14,
  },
  textInput: {
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  textarea: {
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 108,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowFields: {
    flexDirection: 'row',
    gap: 12,
  },
  rowField: {
    flex: 1,
  },
  footerBar: {
    flexDirection: 'row',
    gap: 12,
  },
  footerSecondary: {
    alignItems: 'center',
    borderColor: 'rgba(59,130,246,0.24)',
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
    color: '#FFFFFF',
  },
});
