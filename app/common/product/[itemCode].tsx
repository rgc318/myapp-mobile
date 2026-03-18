import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { formatDisplayUom } from '@/lib/display-uom';
import { fetchProductDetail, saveProductBasicInfo, type ProductDetail } from '@/services/products';

function formatPrice(value: string) {
  return value.trim() ? `\u00A5 ${value}` : '\u2014';
}

export default function ProductDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    itemCode?: string;
    itemName?: string;
    price?: string;
    stockQty?: string;
    uom?: string;
    warehouse?: string;
    imageUrl?: string;
  }>();

  const itemCode = typeof params.itemCode === 'string' ? params.itemCode : '';
  const initialName = typeof params.itemName === 'string' ? params.itemName : itemCode;
  const initialPrice = typeof params.price === 'string' ? params.price : '';
  const initialStock = typeof params.stockQty === 'string' ? params.stockQty : '';
  const initialUom = typeof params.uom === 'string' ? params.uom : '';
  const initialWarehouse = typeof params.warehouse === 'string' ? params.warehouse : '';
  const initialImageUrl = typeof params.imageUrl === 'string' ? params.imageUrl : '';

  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [draftName, setDraftName] = useState(initialName);
  const [draftDescription, setDraftDescription] = useState('');
  const [draftNickname, setDraftNickname] = useState('');

  const background = useThemeColor({}, 'background');
  const surface = useThemeColor({}, 'surface');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');

  useEffect(() => {
    if (!itemCode) {
      return;
    }

    let active = true;
    setIsLoading(true);

    void fetchProductDetail(itemCode)
      .then((nextDetail) => {
        if (!active || !nextDetail) {
          return;
        }

        setDetail(nextDetail);
        setDraftName(nextDetail.itemName || itemCode);
        setDraftDescription(nextDetail.description || '');
        setDraftNickname(nextDetail.nickname || '');
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [itemCode]);

  const handleSave = async () => {
    if (!itemCode) {
      return;
    }

    try {
      setIsSaving(true);
      const nextDetail = await saveProductBasicInfo({
        itemCode,
        itemName: draftName,
        description: draftDescription,
        nickname: draftNickname,
        imageUrl: detail?.imageUrl || initialImageUrl,
        standardRate: detail?.price ?? null,
        warehouse: detail?.warehouse || initialWarehouse,
      });
      if (nextDetail) {
        setDetail(nextDetail);
        setDraftNickname(nextDetail.nickname || '');
      }
      setMessage('\u5546\u54c1\u57fa\u7840\u4fe1\u606f\u5df2\u66f4\u65b0');
      setIsEditing(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '\u4fdd\u5b58\u5931\u8d25');
    } finally {
      setIsSaving(false);
    }
  };

  const displayName = detail?.itemName || draftName || initialName || itemCode;
  const displayImage = detail?.imageUrl || initialImageUrl;
  const displayUom = formatDisplayUom(detail?.stockUom || initialUom);
  const displayGroup = detail?.itemGroup || '\u672a\u5206\u7c7b';
  const displayDescription = detail?.description || draftDescription || '\u6682\u65e0\u5907\u6ce8';
  const displayNickname = detail?.nickname || draftNickname || '\u6682\u65e0\u6635\u79f0';
  const disabledText = detail?.disabled ? '\u5df2\u7981\u7528' : '\u542f\u7528\u4e2d';

  return (
    <View style={[styles.page, { backgroundColor: background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.iconCircle}>
            <IconSymbol color="#111827" name="chevron.left" size={20} />
          </Pressable>
          <ThemedText style={styles.topTitle} type="title">{'\u5546\u54c1\u8be6\u60c5'}</ThemedText>
          <Pressable onPress={() => setIsEditing((current) => !current)} style={styles.editTrigger}>
            <ThemedText style={{ color: tintColor }} type="defaultSemiBold">
              {isEditing ? '\u53d6\u6d88' : '\u7f16\u8f91'}
            </ThemedText>
          </Pressable>
        </View>

        <View style={[styles.heroCard, { backgroundColor: surface, borderColor }]}> 
          <View style={[styles.imageFrame, { backgroundColor: surfaceMuted }]}> 
            {displayImage ? (
              <Image contentFit="cover" source={displayImage} style={styles.heroImage} />
            ) : (
              <IconSymbol color={tintColor} name="photo" size={28} />
            )}
          </View>

          <View style={styles.heroCopy}>
            <ThemedText style={styles.heroTitle} type="title">{displayName}</ThemedText>
            <ThemedText style={styles.heroMeta}>{'\u5546\u54c1\u6635\u79f0\uff1a'} {displayNickname}</ThemedText>
            <ThemedText style={styles.heroMeta}>{'\u7f16\u7801 / \u8d27\u53f7\uff1a'} {itemCode || '\u2014'}</ThemedText>
            <ThemedText style={styles.heroMeta}>{'\u5546\u54c1\u7c7b\u522b\uff1a'} {displayGroup}</ThemedText>
            <ThemedText style={styles.heroMeta}>{'\u5355\u4f4d\uff1a'} {displayUom}</ThemedText>
            <ThemedText style={styles.heroMeta}>{'\u72b6\u6001\uff1a'} {disabledText}</ThemedText>
          </View>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: surface, borderColor }]}> 
          <ThemedText style={styles.sectionTitle} type="defaultSemiBold">{'\u4ef7\u683c\u4e0e\u5e93\u5b58'}</ThemedText>
          <View style={styles.infoRow}><ThemedText>{'\u5f53\u524d\u4ed3\u5e93'}</ThemedText><ThemedText type="defaultSemiBold">{detail?.warehouse || initialWarehouse || '\u672a\u6307\u5b9a\u4ed3\u5e93'}</ThemedText></View>
          <View style={styles.infoRow}><ThemedText>{'\u5f53\u524d\u5e93\u5b58'}</ThemedText><ThemedText type="defaultSemiBold">{detail?.stockQty != null ? String(detail.stockQty) : initialStock || '\u2014'}</ThemedText></View>
          <View style={styles.infoRow}><ThemedText>{'\u53c2\u8003\u4ef7\u683c'}</ThemedText><ThemedText type="defaultSemiBold">{formatPrice(String(detail?.price ?? initialPrice ?? ''))}</ThemedText></View>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: surface, borderColor }]}> 
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle} type="defaultSemiBold">{'\u57fa\u7840\u4fe1\u606f'}</ThemedText>
            {isLoading ? <ActivityIndicator size="small" /> : null}
          </View>

          {isEditing ? (
            <View style={styles.formBlock}>
              <View style={styles.fieldBlock}>
                <ThemedText style={styles.fieldLabel} type="defaultSemiBold">{'\u5546\u54c1\u540d\u79f0'}</ThemedText>
                <TextInput
                  onChangeText={setDraftName}
                  placeholder={'\u8f93\u5165\u5546\u54c1\u540d\u79f0'}
                  placeholderTextColor="#9CA3AF"
                  style={[styles.textInput, { backgroundColor: surfaceMuted, borderColor }]}
                  value={draftName}
                />
              </View>

              <View style={styles.fieldBlock}>
                <ThemedText style={styles.fieldLabel} type="defaultSemiBold">{'\u5546\u54c1\u6635\u79f0'}</ThemedText>
                <TextInput
                  onChangeText={setDraftNickname}
                  placeholder={'\u8f93\u5165\u5546\u54c1\u6635\u79f0'}
                  placeholderTextColor="#9CA3AF"
                  style={[styles.textInput, { backgroundColor: surfaceMuted, borderColor }]}
                  value={draftNickname}
                />
              </View>

              <View style={styles.fieldBlock}>
                <ThemedText style={styles.fieldLabel} type="defaultSemiBold">{'\u5907\u6ce8 / \u8bf4\u660e'}</ThemedText>
                <TextInput
                  multiline
                  numberOfLines={5}
                  onChangeText={setDraftDescription}
                  placeholder={'\u8f93\u5165\u5546\u54c1\u63cf\u8ff0\u6216\u5907\u6ce8'}
                  placeholderTextColor="#9CA3AF"
                  style={[styles.textarea, { backgroundColor: surfaceMuted, borderColor }]}
                  textAlignVertical="top"
                  value={draftDescription}
                />
              </View>

              <Pressable disabled={isSaving} onPress={() => void handleSave()} style={[styles.primaryButton, { backgroundColor: tintColor, opacity: isSaving ? 0.7 : 1 }]}>
                <ThemedText style={styles.primaryButtonText} type="defaultSemiBold">
                  {isSaving ? '\u4fdd\u5b58\u4e2d...' : '\u4fdd\u5b58\u57fa\u7840\u4fe1\u606f'}
                </ThemedText>
              </Pressable>
            </View>
          ) : (
            <View style={styles.formBlock}>
              <View style={styles.infoRow}><ThemedText>{'\u5546\u54c1\u540d\u79f0'}</ThemedText><ThemedText type="defaultSemiBold">{displayName}</ThemedText></View>
              <View style={styles.infoRow}><ThemedText>{'\u5546\u54c1\u6635\u79f0'}</ThemedText><ThemedText type="defaultSemiBold">{displayNickname}</ThemedText></View>
              <View style={styles.descriptionBlock}>
                <ThemedText style={styles.fieldLabel} type="defaultSemiBold">{'\u8be6\u7ec6\u63cf\u8ff0'}</ThemedText>
                <ThemedText style={styles.descriptionText}>{displayDescription}</ThemedText>
              </View>
            </View>
          )}

          {message ? <ThemedText style={[styles.messageText, { color: tintColor }]}>{message}</ThemedText> : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { gap: 14, padding: 14, paddingBottom: 36 },
  topBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  iconCircle: { alignItems: 'center', height: 36, justifyContent: 'center', width: 36 },
  topTitle: { fontSize: 18 },
  editTrigger: { minWidth: 48, alignItems: 'flex-end' },
  heroCard: { borderRadius: 22, borderWidth: 1, flexDirection: 'row', gap: 14, padding: 16 },
  imageFrame: { alignItems: 'center', borderRadius: 20, height: 108, justifyContent: 'center', overflow: 'hidden', width: 108 },
  heroImage: { height: '100%', width: '100%' },
  heroCopy: { flex: 1, gap: 6 },
  heroTitle: { fontSize: 22 },
  heroMeta: { color: '#5F6B7A', fontSize: 14 },
  sectionCard: { borderRadius: 20, borderWidth: 1, gap: 12, padding: 16 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 18 },
  infoRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 28 },
  formBlock: { gap: 12 },
  fieldBlock: { gap: 6 },
  fieldLabel: { fontSize: 13 },
  textInput: { borderRadius: 14, borderWidth: 1, fontSize: 15, minHeight: 46, paddingHorizontal: 12, paddingVertical: 8 },
  textarea: { borderRadius: 14, borderWidth: 1, fontSize: 15, minHeight: 110, paddingHorizontal: 12, paddingVertical: 10 },
  primaryButton: { alignItems: 'center', borderRadius: 16, justifyContent: 'center', minHeight: 46, paddingHorizontal: 16, paddingVertical: 10 },
  primaryButtonText: { color: '#FFF' },
  descriptionBlock: { gap: 6 },
  descriptionText: { color: '#4B5563', lineHeight: 22 },
  messageText: { fontSize: 13 },
});
