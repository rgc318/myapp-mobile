import { Image, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { resolveDisplayUom } from '@/lib/display-uom';
import { sanitizeDecimalInput, sanitizeIntegerInput } from '@/lib/numeric-input';
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

type WarehouseEntryEditorProps = {
  warehouse?: string | null;
  warehouseStockLabel?: string | null;
  warehouseStockTone?: 'default' | 'warning' | 'danger';
  salesMode: SalesMode;
  uom: string | null;
  uomDisplay?: string | null;
  wholesaleReferenceLabel: string;
  retailReferenceLabel: string;
  conversionSummary?: string | null;
  stockReferenceSummary?: string | null;
  qty: number;
  priceText: string;
  lineAmountLabel: string;
  onChangeSalesMode: (value: SalesMode) => void;
  onChangePrice: (value: string) => void;
  onChangeQty: (value: string) => void;
  onDecreaseQty: () => void;
  onIncreaseQty: () => void;
  onRemove: () => void;
  compact?: boolean;
  readOnly?: boolean;
};

type GroupedWarehouseLine = WarehouseEntryEditorProps & {
  key: string;
};

export type SalesOrderItemEditorProps = {
  itemCode: string;
  itemName: string;
  nickname?: string | null;
  specification?: string | null;
  imageUrl?: string | null;
  lineAmountLabel: string;
  warehouse?: string | null;
  warehouseStockLabel?: string | null;
  warehouseStockTone?: 'default' | 'warning' | 'danger';
  salesMode: SalesMode;
  uom: string | null;
  uomDisplay?: string | null;
  wholesaleReferenceLabel: string;
  retailReferenceLabel: string;
  conversionSummary?: string | null;
  stockReferenceSummary?: string | null;
  qty: number;
  priceText: string;
  onChangeSalesMode: (value: SalesMode) => void;
  onChangePrice: (value: string) => void;
  onChangeQty: (value: string) => void;
  onDecreaseQty: () => void;
  onIncreaseQty: () => void;
  onRemove: () => void;
  groupedLines?: GroupedWarehouseLine[];
  groupedSummaryLabel?: string;
};

function WarehouseEntryEditor({
  warehouse,
  warehouseStockLabel,
  warehouseStockTone = 'default',
  salesMode,
  uom,
  uomDisplay,
  wholesaleReferenceLabel,
  retailReferenceLabel,
  conversionSummary,
  stockReferenceSummary,
  qty,
  priceText,
  lineAmountLabel,
  onChangeSalesMode,
  onChangePrice,
  onChangeQty,
  onDecreaseQty,
  onIncreaseQty,
  onRemove,
  compact = false,
  readOnly = false,
}: WarehouseEntryEditorProps) {
  const surface = useThemeColor({}, 'surface');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const dangerColor = useThemeColor({}, 'danger');
  const tintColor = useThemeColor({}, 'tint');
  const warningColor = useThemeColor({}, 'warning');
  const warehouseStockColor =
    warehouseStockTone === 'danger'
      ? dangerColor
      : warehouseStockTone === 'warning'
        ? warningColor
        : '#64748B';

  return (
    <View style={[styles.itemRow, compact ? styles.itemRowCompact : null, { backgroundColor: surface, borderColor }]}>
      <View style={styles.itemMain}>
        <View style={styles.itemHeaderRow}>
          <View style={styles.itemHeaderCopy}>
            <ThemedText numberOfLines={1} style={styles.itemTitle} type="defaultSemiBold">
              {compact ? `仓库 ${warehouse || '未指定仓库'}` : '商品'}
            </ThemedText>
            {!compact ? <ThemedText style={styles.itemSubline}>{'仓库 '} {warehouse || '未指定仓库'}</ThemedText> : null}
          </View>

          <View style={[styles.itemHeaderAside, compact ? styles.itemHeaderAsideCompact : null]}>
            {compact && warehouseStockLabel ? (
              <ThemedText style={[styles.itemWarehouseStock, { color: warehouseStockColor }]} type="defaultSemiBold">
                {warehouseStockLabel}
              </ThemedText>
            ) : null}
            {!compact ? (
              <ThemedText style={[styles.itemAmountInline, { color: warningColor }]} type="defaultSemiBold">
                {lineAmountLabel}
              </ThemedText>
            ) : null}
            {!readOnly ? (
              <Pressable onPress={onRemove} style={[styles.removeButton, { borderColor }]}>
                <ThemedText style={[styles.textAction, { color: dangerColor }]}>{'删除'}</ThemedText>
              </Pressable>
            ) : null}
          </View>
        </View>

        {readOnly ? (
          <>
            <View style={styles.readonlySummaryRow}>
              {conversionSummary ? (
                <ThemedText style={styles.readonlyModeSummary} numberOfLines={1} type="defaultSemiBold">
                  {conversionSummary}
                </ThemedText>
              ) : (
                <View style={styles.readonlySummarySpacer} />
              )}
              <View style={styles.readonlyMetricsRow}>
                <ThemedText style={[styles.readonlyMetricValue, { color: warningColor }]} type="defaultSemiBold">
                  {priceText ? `¥ ${priceText}` : '—'}
                </ThemedText>
                <ThemedText style={styles.readonlyMetricMultiply}>x</ThemedText>
                <ThemedText style={styles.readonlyMetricQty} type="defaultSemiBold">
                  {qty}
                </ThemedText>
                <ThemedText style={styles.readonlyMetricUom} type="defaultSemiBold">
                  {uom ? resolveDisplayUom(uom, uomDisplay) : '未设置'}
                </ThemedText>
              </View>
            </View>
            {stockReferenceSummary ? <ThemedText style={styles.itemHintText}>{stockReferenceSummary}</ThemedText> : null}
          </>
        ) : (
          <>
        <View style={styles.itemEditRow}>
          <View style={styles.itemEditBlockMode}>
            {!compact ? (
              <View style={styles.itemModeHeader}>
                <ThemedText style={styles.itemEditLabel}>{'销售模式'}</ThemedText>
              </View>
            ) : null}
            <SalesModeSwitch onChange={onChangeSalesMode} value={salesMode} />
            <View style={styles.itemModeReferences}>
              <View
                style={[
                  styles.itemModeReferenceBlock,
                  salesMode === 'wholesale' && styles.itemModeReferenceBlockActive,
                ]}>
                <ThemedText
                  style={[
                    styles.itemModeReferenceText,
                    salesMode === 'wholesale' && styles.itemModeReferenceTextActive,
                  ]}
                  type="defaultSemiBold">
                  {wholesaleReferenceLabel}
                </ThemedText>
              </View>
              <View
                style={[
                  styles.itemModeReferenceBlock,
                  salesMode === 'retail' && styles.itemModeReferenceBlockActive,
                ]}>
                <ThemedText
                  style={[
                    styles.itemModeReferenceText,
                    salesMode === 'retail' && styles.itemModeReferenceTextActive,
                  ]}
                  type="defaultSemiBold">
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
                onChangeText={(value) => onChangeQty(sanitizeIntegerInput(value))}
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

          <View style={styles.itemEditBlockUom}>
            <ThemedText style={styles.itemEditLabel}>{'单位'}</ThemedText>
            <View style={styles.uomDisplayWrap}>
              <ThemedText style={styles.uomDisplayText} type="defaultSemiBold">
                {uom ? resolveDisplayUom(uom, uomDisplay) : '未设置'}
              </ThemedText>
            </View>
          </View>

          <View style={styles.itemEditBlockPrice}>
            <ThemedText style={styles.itemEditLabel}>{'单价'}</ThemedText>
            <View style={[styles.priceInputWrap, { backgroundColor: surfaceMuted, borderColor }]}>
              <ThemedText style={styles.pricePrefix}>{'¥'}</ThemedText>
              <TextInput
                keyboardType="numeric"
                onChangeText={(value) => onChangePrice(sanitizeDecimalInput(value))}
                style={styles.priceInput}
                value={priceText}
              />
            </View>
          </View>
        </View>

        {!compact && (conversionSummary || stockReferenceSummary) ? (
          <View style={[styles.itemHintCard, { backgroundColor: surfaceMuted, borderColor }]}>
            {conversionSummary ? <ThemedText style={styles.itemHintText}>{conversionSummary}</ThemedText> : null}
            {stockReferenceSummary ? <ThemedText style={styles.itemHintText}>{stockReferenceSummary}</ThemedText> : null}
          </View>
        ) : null}
          </>
        )}
      </View>
    </View>
  );
}

export function SalesOrderItemEditor({
  itemCode,
  itemName,
  nickname,
  specification,
  imageUrl,
  lineAmountLabel,
  warehouse,
  warehouseStockLabel,
  warehouseStockTone,
  salesMode,
  uom,
  uomDisplay,
  wholesaleReferenceLabel,
  retailReferenceLabel,
  conversionSummary,
  stockReferenceSummary,
  qty,
  priceText,
  onChangeSalesMode,
  onChangePrice,
  onChangeQty,
  onDecreaseQty,
  onIncreaseQty,
  onRemove,
  groupedLines,
  groupedSummaryLabel,
}: SalesOrderItemEditorProps) {
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const warningColor = useThemeColor({}, 'warning');
  const primaryLabel = nickname?.trim() || itemName || itemCode;
  const secondaryLabel = nickname?.trim() && itemName && nickname.trim() !== itemName ? itemName : '';

  if (groupedLines?.length) {
    return (
      <View style={[styles.groupCard, { backgroundColor: surfaceMuted, borderColor }]}>
        <View style={styles.groupHeader}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.itemThumbImage} />
          ) : (
            <View style={[styles.itemThumb, { backgroundColor: '#FFFFFF' }]}>
              <IconSymbol color="#28B7D7" name="shippingbox.fill" size={20} />
            </View>
          )}

          <View style={styles.groupCopy}>
            <ThemedText numberOfLines={1} style={styles.groupTitle} type="defaultSemiBold">
              {primaryLabel}
            </ThemedText>
            {secondaryLabel ? (
              <ThemedText numberOfLines={1} style={styles.groupSubtitle}>
                {secondaryLabel}
              </ThemedText>
            ) : null}
            {specification ? (
              <ThemedText numberOfLines={1} style={styles.groupSpecification}>
                规格 {specification}
              </ThemedText>
            ) : null}
            <ThemedText style={styles.groupMeta}>{'编码 '} {itemCode}</ThemedText>
            {groupedSummaryLabel ? (
              <ThemedText style={styles.groupSummary} type="defaultSemiBold">
                {groupedSummaryLabel}
              </ThemedText>
            ) : null}
          </View>

          <ThemedText style={[styles.groupAmount, { color: warningColor }]} type="defaultSemiBold">
            {lineAmountLabel}
          </ThemedText>
        </View>

        <View style={styles.groupRows}>
          {groupedLines.map((line) => (
            <WarehouseEntryEditor
              compact
              conversionSummary={line.conversionSummary}
              key={line.key}
              lineAmountLabel={line.lineAmountLabel}
              onChangePrice={line.onChangePrice}
              onChangeQty={line.onChangeQty}
              onChangeSalesMode={line.onChangeSalesMode}
              onDecreaseQty={line.onDecreaseQty}
              onIncreaseQty={line.onIncreaseQty}
              onRemove={line.onRemove}
              priceText={line.priceText}
              qty={line.qty}
              readOnly={line.readOnly}
              retailReferenceLabel={line.retailReferenceLabel}
              salesMode={line.salesMode}
              stockReferenceSummary={line.stockReferenceSummary}
              uom={line.uom}
              uomDisplay={line.uomDisplay}
              warehouse={line.warehouse}
              warehouseStockLabel={line.warehouseStockLabel}
              warehouseStockTone={line.warehouseStockTone}
              wholesaleReferenceLabel={line.wholesaleReferenceLabel}
            />
          ))}
        </View>
      </View>
    );
  }

  return (
    <WarehouseEntryEditor
      compact={false}
      conversionSummary={conversionSummary}
      lineAmountLabel={lineAmountLabel}
      onChangePrice={onChangePrice}
      onChangeQty={onChangeQty}
      onChangeSalesMode={onChangeSalesMode}
      onDecreaseQty={onDecreaseQty}
      onIncreaseQty={onIncreaseQty}
      onRemove={onRemove}
      priceText={priceText}
      qty={qty}
      readOnly={false}
      retailReferenceLabel={retailReferenceLabel}
      salesMode={salesMode}
      stockReferenceSummary={stockReferenceSummary}
      uom={uom}
      uomDisplay={uomDisplay}
      warehouse={warehouse}
      warehouseStockLabel={warehouseStockLabel}
      warehouseStockTone={warehouseStockTone}
      wholesaleReferenceLabel={wholesaleReferenceLabel}
    />
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
    justifyContent: 'center',
    minHeight: 40,
  },
  salesModeSwitchText: {
    color: '#475569',
    fontSize: 14,
  },
  groupCard: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 12,
  },
  groupHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  groupCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  groupTitle: {
    fontSize: 16,
  },
  groupSubtitle: {
    color: '#607086',
    fontSize: 12,
  },
  groupSpecification: {
    color: '#2F5FAE',
    fontSize: 13,
  },
  groupMeta: {
    color: '#64748B',
    fontSize: 12,
  },
  groupSummary: {
    color: '#2563EB',
    fontSize: 13,
  },
  groupAmount: {
    fontSize: 18,
  },
  groupRows: {
    gap: 10,
  },
  itemRow: {
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  itemRowCompact: {
    gap: 0,
    padding: 8,
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
  },
  itemHeaderCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  itemHeaderAside: {
    alignItems: 'flex-end',
    gap: 4,
  },
  itemHeaderAsideCompact: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
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
  itemWarehouseStock: {
    fontSize: 14,
  },
  itemSubline: {
    color: '#6B7280',
    fontSize: 12,
  },
  readonlySummaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginTop: 8,
  },
  readonlySummarySpacer: {
    flex: 1,
  },
  readonlyModeSummary: {
    color: '#475569',
    flex: 1,
    fontSize: 14,
  },
  readonlyMetricsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
    flexShrink: 0,
  },
  readonlyMetricValue: {
    fontSize: 18,
  },
  readonlyMetricMultiply: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '700',
  },
  readonlyMetricQty: {
    color: '#2563EB',
    fontSize: 18,
  },
  readonlyMetricUom: {
    color: '#0F172A',
    fontSize: 16,
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
  },
  itemModeReferences: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: 10,
  },
  itemModeReferenceBlock: {
    borderRadius: 10,
    flex: 1,
    justifyContent: 'center',
    minHeight: 32,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  itemModeReferenceBlockActive: {
    backgroundColor: 'rgba(59,130,246,0.08)',
  },
  itemModeReferenceText: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  itemModeReferenceTextActive: {
    color: '#2563EB',
  },
  itemEditBlockCompact: {
    flexShrink: 0,
    gap: 4,
    width: 110,
  },
  itemEditBlockUom: {
    flexShrink: 0,
    gap: 4,
    minWidth: 64,
  },
  itemEditBlockPrice: {
    flex: 1,
    gap: 4,
  },
  itemHintCard: {
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  itemHintText: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
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
  uomDisplayWrap: {
    justifyContent: 'center',
    minHeight: 36,
    paddingRight: 2,
  },
  uomDisplayText: {
    color: '#1D4ED8',
    fontSize: 15,
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
