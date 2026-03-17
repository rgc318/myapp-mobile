import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { normalizeAppError } from '@/lib/app-error';
import { formatCurrencyValue } from '@/lib/display-currency';
import { formatDisplayUom } from '@/lib/display-uom';
import { type SalesOrderDetail as SalesOrderDetail, updateSalesOrderDetail } from '@/services/master-data';
import { getSalesOrderDetailV2 } from '@/services/sales';


function InfoRow({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <ThemedText style={styles.infoLabel}>{label}</ThemedText>
      <ThemedText style={[styles.infoValue, emphasis && styles.infoValueEmphasis]} type="defaultSemiBold">
        {value}
      </ThemedText>
    </View>
  );
}

export default function SalesOrderDetailScreen() {
  const { orderName } = useLocalSearchParams<{ orderName: string }>();
  const [detail, setDetail] = useState<SalesOrderDetail | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [deliveryDateInput, setDeliveryDateInput] = useState('');
  const [remarksInput, setRemarksInput] = useState('');
  const [contactPersonInput, setContactPersonInput] = useState('');

  const background = useThemeColor({}, 'background');
  const surface = useThemeColor({}, 'surface');
  const borderColor = useThemeColor({}, 'border');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');

  useEffect(() => {
    if (!orderName) {
      return;
    }

    let active = true;

    void getSalesOrderDetailV2(orderName)
      .then((nextDetail) => {
        if (!active) {
          return;
        }

        setDetail(nextDetail);
        setDeliveryDateInput(nextDetail?.deliveryDate ?? '');
        setRemarksInput(nextDetail?.remarks ?? '');
        setContactPersonInput(nextDetail?.contactPerson ?? '');
        setMessage(nextDetail ? '' : '\u672a\u627e\u5230\u5bf9\u5e94\u9500\u552e\u8ba2\u5355\u3002');
      })
      .catch((error) => {
        if (active) {
          const appError = normalizeAppError(error, '\u8ba2\u5355\u8be6\u60c5\u8bfb\u53d6\u5931\u8d25\u3002');
          setMessage(appError.message);
        }
      })

    return () => {
      active = false;
    };
  }, [orderName]);

  const totalQuantity = useMemo(
    () => detail?.items.reduce((count, item) => count + (item.qty ?? 0), 0) ?? 0,
    [detail],
  );

  const shippingAddress = detail?.addressDisplay || '\u672a\u914d\u7f6e\u6536\u8d27\u5730\u5740';
  const consignee = detail?.contactDisplay || detail?.contactPerson || '\u672a\u914d\u7f6e\u6536\u8d27\u4eba';
  const receivable = detail?.grandTotal ?? null;
  const currency = detail?.currency || 'CNY';

  async function handleSave() {
    if (!orderName) {
      return;
    }

    setIsSaving(true);
    setMessage('');

    try {
      const nextDetail = await updateSalesOrderDetail({
        orderName,
        deliveryDate: deliveryDateInput,
        remarks: remarksInput,
        contactPerson: contactPersonInput,
      });

      setDetail(nextDetail);
      setDeliveryDateInput(nextDetail?.deliveryDate ?? '');
      setRemarksInput(nextDetail?.remarks ?? '');
      setContactPersonInput(nextDetail?.contactPerson ?? '');
      setIsEditing(false);
      setMessage('\u8ba2\u5355\u4fe1\u606f\u5df2\u66f4\u65b0\u3002');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '\u8ba2\u5355\u4fe1\u606f\u4fdd\u5b58\u5931\u8d25\u3002');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <View style={[styles.screen, { backgroundColor: background }]}> 
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" style={styles.topIconButton}>
            <IconSymbol color="#0F172A" name="chevron.left" size={22} />
          </Pressable>
          <ThemedText style={styles.pageTitle} type="title">{'\u9500\u552e\u5355\u8be6\u60c5'}</ThemedText>
          <View style={styles.topActions}>
            <Pressable accessibilityRole="button" style={styles.topIconButton}>
              <IconSymbol color="#0F172A" name="paperplane.fill" size={18} />
            </Pressable>
            <Pressable accessibilityRole="button" style={styles.topIconButton}>
              <ThemedText style={styles.moreText}>{'...'}</ThemedText>
            </Pressable>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
          <View style={styles.orderHeadlineRow}>
            <View style={styles.orderHeadlineCopy}>
              <ThemedText style={styles.customerName} type="defaultSemiBold">{detail?.customer || '\u96f6\u552e\u5ba2\u6237'}</ThemedText>
              <ThemedText style={styles.statusText}>{detail?.status || '\u672a\u77e5\u72b6\u6001'}</ThemedText>
            </View>
            <ThemedText style={styles.orderDateText} type="defaultSemiBold">{detail?.transactionDate || '\u2014'}</ThemedText>
          </View>

          <View style={[styles.divider, { backgroundColor: borderColor }]} />

          <InfoRow label={'\u5355\u636e\u7f16\u53f7\uff1a'} value={detail?.name || orderName || '\u2014'} />
          <InfoRow label={'\u516c\u53f8\uff1a'} value={detail?.company || '\u2014'} />
          <InfoRow label={'\u4e1a\u52a1\u5458\uff1a'} value={consignee} />
          <InfoRow label={'\u4ea4\u8d27\u65f6\u95f4\uff1a'} value={detail?.deliveryDate || '\u672a\u8bbe\u7f6e'} />
          <InfoRow label={'\u6536\u8d27\u5730\u5740\uff1a'} value={shippingAddress} />
        </View>

        <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleWrap}>
              <View style={styles.sectionAccent} />
              <ThemedText style={styles.sectionTitle} type="defaultSemiBold">{'\u9500\u552e\u5546\u54c1'}</ThemedText>
            </View>
            <ThemedText style={styles.sectionCollapse}>{'^'}</ThemedText>
          </View>

          <View style={styles.goodsList}>
            {detail?.items?.length ? (
              detail.items.map((item, index) => (
                <View key={`${item.itemCode}-${index}`} style={styles.goodsRow}>
                  {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={styles.goodsImage} />
                  ) : (
                    <View style={[styles.goodsImage, styles.imageFallback, { backgroundColor: surfaceMuted }]}> 
                      <IconSymbol color="#94A3B8" name="photo" size={20} />
                    </View>
                  )}
                  <View style={styles.goodsBody}>
                    <ThemedText style={styles.goodsName} type="defaultSemiBold">{item.itemName || item.itemCode}</ThemedText>
                    <View style={styles.goodsMetricsRow}>
                      <ThemedText style={styles.goodsPriceValue} type="defaultSemiBold">{formatCurrencyValue(item.rate, currency)}</ThemedText>
                      <ThemedText style={styles.metricMultiply}>x</ThemedText>
                      <ThemedText style={styles.goodsQtyValue} type="defaultSemiBold">{item.qty ?? '\u2014'}</ThemedText>
                      <ThemedText style={styles.goodsUomValue} type="defaultSemiBold">{formatDisplayUom(item.uom)}</ThemedText>
                    </View>
                    <ThemedText style={styles.goodsSubMeta}>{item.warehouse || '\u672a\u6307\u5b9a\u4ed3\u5e93'}</ThemedText>
                  </View>
                  <ThemedText style={styles.goodsAmount} type="defaultSemiBold">{formatCurrencyValue(item.amount, currency)}</ThemedText>
                </View>
              ))
            ) : (
              <ThemedText style={styles.emptyText}>{'\u6682\u65e0\u5546\u54c1\u660e\u7ec6'}</ThemedText>
            )}
          </View>

          <View style={[styles.divider, { backgroundColor: borderColor }]} />

          <View style={styles.goodsSummaryRow}>
            <ThemedText style={styles.goodsSummaryText} type="defaultSemiBold">{`\u5408\u8ba1 \u5df2\u9009 ${totalQuantity} \uff0c`}</ThemedText>
            <ThemedText style={styles.goodsSummaryAmount} type="defaultSemiBold">{formatCurrencyValue(receivable, currency)}</ThemedText>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
          <InfoRow label={'\u6574\u5355\u6298\u6263\uff1a'} value={'100.00%'} />
          <InfoRow label={'\u6298\u540e\u91d1\u989d\uff1a'} value={formatCurrencyValue(receivable, currency)} />
          <InfoRow label={'\u8fd0\u8d39\uff1a'} value={formatCurrencyValue(0, currency)} />
          <InfoRow label={'\u672c\u5355\u5e94\u6536\uff1a'} value={formatCurrencyValue(receivable, currency)} emphasis />

          <View style={[styles.divider, { backgroundColor: borderColor }]} />

          <InfoRow label={'\u672c\u5355\u5b9e\u6536\uff1a'} value={`${formatCurrencyValue(receivable, currency)} | 现金`} />
        </View>

        <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
          <View style={styles.noteHeader}>
            <ThemedText style={styles.sectionTitle} type="defaultSemiBold">{'\u5907\u6ce8\uff1a'}</ThemedText>
            <Pressable accessibilityRole="button" onPress={() => setIsEditing((value) => !value)} style={styles.noteEditButton}>
              <ThemedText style={styles.noteEditText}>{isEditing ? '\u6536\u8d77' : '\u4fee\u6539'}</ThemedText>
            </Pressable>
          </View>

          {isEditing ? (
            <View style={styles.editPanel}>
              <View style={[styles.editField, { backgroundColor: surfaceMuted }]}> 
                <ThemedText style={styles.editFieldLabel}>{'\u6536\u8d27\u4eba'}</ThemedText>
                <TextInput
                  onChangeText={setContactPersonInput}
                  placeholder={'\u8f93\u5165\u6536\u8d27\u4eba'}
                  placeholderTextColor="#9AA3B2"
                  style={styles.editInput}
                  value={contactPersonInput}
                />
              </View>
              <View style={[styles.editField, { backgroundColor: surfaceMuted }]}> 
                <ThemedText style={styles.editFieldLabel}>{'\u4ea4\u8d27\u65e5\u671f'}</ThemedText>
                <TextInput
                  onChangeText={setDeliveryDateInput}
                  placeholder={'YYYY-MM-DD'}
                  placeholderTextColor="#9AA3B2"
                  style={styles.editInput}
                  value={deliveryDateInput}
                />
              </View>
              <View style={[styles.editField, styles.noteInputWrap, { backgroundColor: surfaceMuted }]}> 
                <ThemedText style={styles.editFieldLabel}>{'\u8ba2\u5355\u5907\u6ce8'}</ThemedText>
                <TextInput
                  multiline
                  numberOfLines={5}
                  onChangeText={setRemarksInput}
                  placeholder={'\u8f93\u5165\u8ba2\u5355\u5907\u6ce8'}
                  placeholderTextColor="#9AA3B2"
                  style={[styles.editInput, styles.noteInput]}
                  textAlignVertical="top"
                  value={remarksInput}
                />
              </View>
            </View>
          ) : (
            <ThemedText style={styles.noteText}>{detail?.remarks || '\u6682\u65e0\u5907\u6ce8'}</ThemedText>
          )}
        </View>

        {message ? <ThemedText style={styles.messageText}>{message}</ThemedText> : null}
      </ScrollView>

      <View style={[styles.bottomBar, { backgroundColor: background, borderTopColor: borderColor }]}> 
        {isEditing ? (
          <>
            <Pressable accessibilityRole="button" disabled={isSaving} onPress={() => {
              setContactPersonInput(detail?.contactPerson ?? '');
              setDeliveryDateInput(detail?.deliveryDate ?? '');
              setRemarksInput(detail?.remarks ?? '');
              setIsEditing(false);
            }} style={[styles.bottomButton, styles.bottomGhostButton, { borderColor }]}>
              <ThemedText style={styles.bottomGhostText}>{'\u53d6\u6d88'}</ThemedText>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={isSaving} onPress={handleSave} style={[styles.bottomButton, styles.bottomPrimaryButton]}>
              <ThemedText style={styles.bottomPrimaryText}>{isSaving ? '\u4fdd\u5b58\u4e2d...' : '\u4fdd\u5b58'}</ThemedText>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable accessibilityRole="button" onPress={() => setMessage('\u6253\u5370\u80fd\u529b\u5f85\u540e\u7eed\u63a5\u5165\u3002')} style={[styles.bottomButton, styles.bottomGhostButton, { borderColor }]}>
              <ThemedText style={styles.bottomGhostText}>{'\u6253\u5370'}</ThemedText>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setIsEditing(true)} style={[styles.bottomButton, styles.bottomGhostButton, { borderColor }]}>
              <ThemedText style={styles.bottomGhostText}>{'\u4fee\u6539'}</ThemedText>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    gap: 14,
    paddingBottom: 110,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  topActions: {
    flexDirection: 'row',
    gap: 6,
  },
  topIconButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  pageTitle: {
    flex: 1,
    fontSize: 20,
    textAlign: 'center',
  },
  moreText: {
    color: '#0F172A',
    fontSize: 20,
    lineHeight: 20,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  orderHeadlineRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  orderHeadlineCopy: {
    flex: 1,
    gap: 8,
  },
  customerName: {
    fontSize: 17,
  },
  statusText: {
    color: '#22C3D6',
    fontSize: 14,
    fontWeight: '700',
  },
  orderDateText: {
    color: '#475569',
    fontSize: 16,
    paddingLeft: 12,
  },
  divider: {
    height: 1,
    width: '100%',
  },
  infoRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  infoLabel: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '600',
  },
  infoValue: {
    color: '#0F172A',
    flex: 1,
    fontSize: 16,
    textAlign: 'right',
  },
  infoValueEmphasis: {
    color: '#22C3D6',
    fontSize: 17,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitleWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  sectionAccent: {
    backgroundColor: '#22C3D6',
    borderRadius: 999,
    height: 30,
    width: 4,
  },
  sectionTitle: {
    fontSize: 17,
  },
  sectionCollapse: {
    color: '#CBD5E1',
    fontSize: 18,
    transform: [{ rotate: '180deg' }],
  },
  goodsList: {
    gap: 20,
  },
  goodsRow: {
    flexDirection: 'row',
    gap: 14,
  },
  goodsImage: {
    borderRadius: 12,
    height: 60,
    width: 60,
  },
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  goodsBody: {
    flex: 1,
    gap: 8,
    justifyContent: 'center',
  },
  goodsName: {
    fontSize: 16,
    lineHeight: 22,
  },
  goodsMetricsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  goodsPriceValue: {
    color: '#A86518',
    fontSize: 15,
  },
  metricMultiply: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '700',
  },
  goodsQtyValue: {
    color: '#2563EB',
    fontSize: 16,
  },
  goodsUomValue: {
    color: '#0F172A',
    fontSize: 14,
  },
  goodsSubMeta: {
    color: '#64748B',
    fontSize: 13,
  },
  goodsAmount: {
    alignSelf: 'center',
    color: '#A86518',
    fontSize: 18,
    paddingLeft: 12,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
  },
  goodsSummaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  goodsSummaryText: {
    color: '#0F172A',
    fontSize: 16,
  },
  goodsSummaryAmount: {
    color: '#A86518',
    fontSize: 16,
  },
  noteHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  noteEditButton: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  noteEditText: {
    color: '#64748B',
    fontSize: 14,
  },
  noteText: {
    color: '#0F172A',
    fontSize: 15,
    minHeight: 88,
  },
  editPanel: {
    gap: 12,
  },
  editField: {
    borderRadius: 14,
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  editFieldLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  editInput: {
    color: '#0F172A',
    fontSize: 15,
    padding: 0,
  },
  noteInputWrap: {
    minHeight: 140,
  },
  noteInput: {
    minHeight: 96,
  },
  messageText: {
    color: '#DC2626',
    fontSize: 13,
    paddingHorizontal: 4,
  },
  bottomBar: {
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: 'row',
    gap: 12,
    left: 0,
    paddingBottom: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    position: 'absolute',
    right: 0,
  },
  bottomButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 54,
  },
  bottomGhostButton: {
    backgroundColor: '#FFFFFF',
  },
  bottomPrimaryButton: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  bottomGhostText: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '700',
  },
  bottomPrimaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
