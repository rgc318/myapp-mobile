import { Image, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getSalesModeLabel, type SalesMode } from '@/lib/sales-mode';

function SalesModeSwitch({
  value,
  onChange,
}: {
  value: SalesMode;
  onChange: (nextMode: SalesMode) => void;
}) {
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const tintColor = useThemeColor({}, 'tint');

  return (
    <View style={[styles.salesModeSwitch, { backgroundColor: surfaceMuted }]}>
      {(['wholesale', 'retail'] as SalesMode[]).map((mode) => {
        const active = value === mode;
        return (
          <Pressable
            key={mode}
            onPress={() => onChange(mode)}
            style={[
              styles.salesModeSwitchOption,
              active && { backgroundColor: '#FFFFFF', borderColor: tintColor },
            ]}>
            <ThemedText
              style={[styles.salesModeSwitchText, active && { color: tintColor }]}
              type="defaultSemiBold">
              {getSalesModeLabel(mode)}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

export type SalesOrderItemEditorProps = {
  itemCode: string;
  itemName: string;
  imageUrl?: string | null;
  lineAmountLabel: string;
  warehouse?: string | null;
  salesMode: SalesMode;
  uom: string | null;
  wholesaleReferenceLabel: string;
  retailReferenceLabel: string;
  qty: number;
  priceText: string;
  onChangeSalesMode: (value: SalesMode) => void;
  onChangePrice: (value: string) => void;
  onChangeQty: (value: string) => void;
  onDecreaseQty: () => void;
  onIncreaseQty: () => void;
  onRemove: () => void;
};

export function SalesOrderItemEditor({
  itemCode,
  itemName,
  imageUrl,
  lineAmountLabel,
  warehouse,
  salesMode,
  uom,
  wholesaleReferenceLabel,
  retailReferenceLabel,
  qty,
  priceText,
  onChangeSalesMode,
  onChangePrice,
  onChangeQty,
  onDecreaseQty,
  onIncreaseQty,
  onRemove,
}: SalesOrderItemEditorProps) {
  const surface = useThemeColor({}, 'surface');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const dangerColor = useThemeColor({}, 'danger');
  const tintColor = useThemeColor({}, 'tint');

  return (
    <View style={[styles.itemRow, { backgroundColor: surface, borderColor }]}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.itemThumbImage} />
      ) : (
        <View style={[styles.itemThumb, { backgroundColor: surfaceMuted }]}>
          <IconSymbol color="#28B7D7" name="shippingbox.fill" size={20} />
        </View>
      )}

      <View style={styles.itemMain}>
        <View style={styles.itemHeaderRow}>
          <View style={styles.itemHeaderCopy}>
            <ThemedText numberOfLines={1} style={styles.itemTitle} type="defaultSemiBold">
              {itemName || itemCode}
            </ThemedText>
            <ThemedText style={styles.itemSubline}>{'编码 '} {itemCode}</ThemedText>
            <ThemedText style={styles.itemSubline}>{'仓库 '} {warehouse || '未指定仓库'}</ThemedText>
          </View>

          <View style={styles.itemHeaderAside}>
            <ThemedText style={styles.itemAmountInline} type="defaultSemiBold">
              {lineAmountLabel}
            </ThemedText>
            <Pressable onPress={onRemove} style={[styles.removeButton, { borderColor }]}>
              <ThemedText style={[styles.textAction, { color: dangerColor }]}>{'删除'}</ThemedText>
            </Pressable>
          </View>
        </View>

        <View style={styles.itemEditRow}>
          <View style={styles.itemEditBlockMode}>
            <View style={styles.itemModeHeader}>
              <ThemedText style={styles.itemEditLabel}>{'销售模式'}</ThemedText>
              <ThemedText style={styles.itemModeHint}>{'当前单位 '} {uom || '未设置'}</ThemedText>
            </View>
            <SalesModeSwitch onChange={onChangeSalesMode} value={salesMode} />
            <View style={styles.itemModeReferences}>
              <View style={styles.itemModeReferencePill}>
                <ThemedText style={styles.itemModeReferenceText}>
                  {wholesaleReferenceLabel}
                </ThemedText>
              </View>
              <View style={styles.itemModeReferencePill}>
                <ThemedText style={styles.itemModeReferenceText}>
                  {retailReferenceLabel}
                </ThemedText>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.itemEditRow}>
          <View style={styles.itemEditBlockCompact}>
            <ThemedText style={styles.itemEditLabel}>{'数量'}</ThemedText>
            <View style={[styles.qtyStepper, { backgroundColor: surfaceMuted, borderColor }]}>
              <Pressable
                disabled={qty <= 1}
                onPress={onDecreaseQty}
                style={[styles.qtyActionButton, qty <= 1 && styles.qtyActionButtonDisabled]}>
                <ThemedText style={[styles.qtyActionText, { color: tintColor }]} type="defaultSemiBold">
                  -
                </ThemedText>
              </Pressable>
              <TextInput
                keyboardType="number-pad"
                onChangeText={onChangeQty}
                style={styles.qtyInput}
                value={String(qty)}
              />
              <Pressable onPress={onIncreaseQty} style={styles.qtyActionButton}>
                <ThemedText style={[styles.qtyActionText, { color: tintColor }]} type="defaultSemiBold">
                  +
                </ThemedText>
              </Pressable>
            </View>
          </View>

          <View style={styles.itemEditBlockPrice}>
            <ThemedText style={styles.itemEditLabel}>{'单价'}</ThemedText>
            <View style={[styles.priceInputWrap, { backgroundColor: surfaceMuted, borderColor }]}>
              <ThemedText style={styles.pricePrefix}>{'¥'}</ThemedText>
              <TextInput
                keyboardType="numeric"
                onChangeText={onChangePrice}
                style={styles.priceInput}
                value={priceText}
              />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  salesModeSwitch: {
    borderRadius: 14,
    flexDirection: 'row',
    padding: 3,
  },
  salesModeSwitchOption: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    minHeight: 40,
    justifyContent: 'center',
  },
  salesModeSwitchText: {
    color: '#475569',
    fontSize: 14,
  },
  itemRow: {
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  itemThumb: {
    alignItems: 'center',
    borderRadius: 18,
    height: 60,
    justifyContent: 'center',
    width: 60,
  },
  itemThumbImage: {
    borderRadius: 18,
    height: 60,
    width: 60,
  },
  itemMain: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  itemHeaderRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    minHeight: 60,
  },
  itemHeaderCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  itemHeaderAside: {
    alignItems: 'flex-end',
    gap: 8,
  },
  itemTitle: {
    flex: 1,
    fontSize: 16,
    marginRight: 12,
  },
  itemAmountInline: {
    color: '#2D3748',
    fontSize: 17,
  },
  itemSubline: {
    color: '#6B7280',
    fontSize: 12,
  },
  itemEditRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  itemEditBlockMode: {
    gap: 5,
    width: '100%',
  },
  itemModeHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemModeHint: {
    color: '#6B7280',
    fontSize: 12,
  },
  itemModeReferences: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  itemModeReferencePill: {
    backgroundColor: 'rgba(241,245,249,0.9)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  itemModeReferenceText: {
    color: '#475569',
    fontSize: 11,
  },
  itemEditBlockCompact: {
    flexShrink: 0,
    gap: 4,
    width: 110,
  },
  itemEditBlockPrice: {
    flex: 1,
    gap: 4,
  },
  itemEditLabel: {
    color: '#6B7280',
    fontSize: 11,
  },
  qtyStepper: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    height: 36,
    overflow: 'hidden',
  },
  qtyActionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    width: 30,
  },
  qtyActionButtonDisabled: {
    opacity: 0.35,
  },
  qtyActionText: {
    fontSize: 18,
    lineHeight: 18,
  },
  qtyInput: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '600',
    height: 36,
    minWidth: 34,
    paddingHorizontal: 2,
    textAlign: 'center',
    width: 42,
  },
  priceInputWrap: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    height: 36,
    paddingHorizontal: 10,
  },
  pricePrefix: {
    color: '#6B7280',
    fontSize: 13,
  },
  priceInput: {
    color: '#111827',
    flex: 1,
    fontSize: 15,
    height: 36,
    paddingVertical: 0,
  },
  removeButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 30,
    paddingHorizontal: 10,
  },
  textAction: {
    fontSize: 12,
  },
});
