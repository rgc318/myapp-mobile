import { useState } from 'react';
import { Image } from 'expo-image';
import { Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { formatDisplayUom } from '@/lib/display-uom';
import { convertQtyToStockQty, formatConvertedQty, type UomConversion } from '@/lib/uom-conversion';

export type PurchaseOrderEditorField = 'qty' | 'price' | 'warehouse' | 'uom';

export type PurchaseOrderEditorItem = {
  id: string;
  itemCode: string;
  itemName: string;
  qty: string;
  price: string;
  warehouse: string;
  uom: string;
  imageUrl?: string | null;
  stockUom?: string | null;
  totalQty?: number | null;
  standardBuyingRate?: number | null;
  allUoms?: string[];
  uomConversions?: UomConversion[];
  warehouseStockDetails?: { warehouse: string; company: string | null; qty: number }[];
};

type PurchaseOrderItemGroupsProps = {
  items: PurchaseOrderEditorItem[];
  editable?: boolean;
  showReplaceItem?: boolean;
  surface: string;
  surfaceMuted: string;
  borderColor: string;
  tintColor: string;
  expandedRows?: Record<string, boolean>;
  onToggleRow?: (itemId: string, nextExpanded: boolean) => void;
  onReplaceItem?: (item: PurchaseOrderEditorItem) => void;
  onAddWarehouseRow?: (rows: PurchaseOrderEditorItem[]) => void;
  onAdjustItemQty?: (itemId: string, delta: number) => void;
  onChangeItem?: (itemId: string, field: PurchaseOrderEditorField, value: string) => void;
  onRemoveItem?: (itemId: string) => void;
  onOpenPicker?: (itemId: string, field: 'warehouse' | 'uom') => void;
  emptyTitle?: string;
  emptyHint?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
};

function formatQty(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }

  return formatConvertedQty(value);
}

function formatMoney(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }

  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 2,
  }).format(value);
}

function groupPurchaseItems(items: PurchaseOrderEditorItem[]) {
  const groups = new Map<
    string,
    {
      itemCode: string;
      itemName: string;
      rows: PurchaseOrderEditorItem[];
    }
  >();

  items.forEach((item) => {
    const key = item.itemCode || item.id;
    const existing = groups.get(key);
    if (existing) {
      existing.rows.push(item);
      return;
    }
    groups.set(key, {
      itemCode: item.itemCode,
      itemName: item.itemName,
      rows: [item],
    });
  });

  return Array.from(groups.values());
}

function DetailInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailInfoRow}>
      <ThemedText style={styles.detailInfoLabel}>{label}</ThemedText>
      <ThemedText style={styles.detailInfoValue} type="defaultSemiBold">
        {value}
      </ThemedText>
    </View>
  );
}

export function PurchaseOrderItemGroups({
  items,
  editable = true,
  showReplaceItem = false,
  surface,
  surfaceMuted,
  borderColor,
  tintColor,
  expandedRows,
  onToggleRow,
  onReplaceItem,
  onAddWarehouseRow,
  onAdjustItemQty,
  onChangeItem,
  onRemoveItem,
  onOpenPicker,
  emptyTitle = '先从商品搜索页选择采购商品',
  emptyHint = '选中商品后，这里会按商品分组展示，并在组内继续填写仓库、数量和采购价。',
  emptyActionLabel = '去选择商品',
  onEmptyAction,
}: PurchaseOrderItemGroupsProps) {
  const [pendingRemove, setPendingRemove] = useState<{ id: string; name: string } | null>(null);
  const groupedItems = groupPurchaseItems(items);

  if (!groupedItems.length) {
    return (
      <View style={[styles.emptyState, { backgroundColor: surfaceMuted }]}>
        <ThemedText type="defaultSemiBold">{emptyTitle}</ThemedText>
        <ThemedText>{emptyHint}</ThemedText>
        {onEmptyAction ? (
          <Pressable
            onPress={onEmptyAction}
            style={[styles.emptyActionButton, { backgroundColor: surface, borderColor }]}>
            <ThemedText style={[styles.emptyActionText, { color: tintColor }]} type="defaultSemiBold">
              {emptyActionLabel}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <>
      <View style={styles.list}>
        {groupedItems.map((group, groupIndex) => {
        const leadRow = group.rows[0];
        const stockUom = leadRow.stockUom || leadRow.uom || '';
        const incomingQty = group.rows.reduce((sum, row) => {
          const qty = Number(row.qty);
          if (!Number.isFinite(qty)) {
            return sum;
          }
          const converted =
            convertQtyToStockQty({
              qty,
              uom: row.uom || stockUom,
              stockUom: leadRow.stockUom || stockUom,
              uomConversions: row.uomConversions ?? leadRow.uomConversions,
            }) ?? qty;
          return sum + converted;
        }, 0);
        const projectedTotal =
          typeof leadRow.totalQty === 'number' ? leadRow.totalQty + incomingQty : null;
        const groupReferenceBuyingRate =
          typeof leadRow.standardBuyingRate === 'number' ? leadRow.standardBuyingRate : null;
        const groupReferenceUnit = formatDisplayUom(leadRow.stockUom || leadRow.uom || '');
        const groupPurchaseAmount = group.rows.reduce((sum, row) => {
          const qty = Number(row.qty);
          const price = Number(row.price);
          if (!Number.isFinite(qty) || !Number.isFinite(price)) {
            return sum;
          }
          return sum + qty * price;
        }, 0);

        return (
          <View
            key={group.itemCode || group.rows[0].id}
            style={[
              styles.groupBlock,
              { backgroundColor: surfaceMuted },
              groupIndex > 0 ? styles.groupBlockStacked : null,
            ]}>
            <View style={styles.groupHeader}>
              <View style={styles.groupLead}>
                <View style={[styles.groupThumbWrap, { backgroundColor: surface }]}>
                  {leadRow.imageUrl ? (
                    <Image contentFit="cover" source={leadRow.imageUrl} style={styles.groupThumbImage} />
                  ) : (
                    <IconSymbol color={tintColor} name="shippingbox.fill" size={20} />
                  )}
                </View>
                <View style={styles.groupCopy}>
                  <ThemedText style={styles.groupLabel} type="defaultSemiBold">
                    采购商品 {groupIndex + 1}
                  </ThemedText>
                  <ThemedText style={styles.groupTitle} type="defaultSemiBold">
                    {group.itemName || group.itemCode}
                  </ThemedText>
                  <ThemedText style={styles.groupMeta}>编码 {group.itemCode}</ThemedText>
                  <View style={styles.groupInfoRow}>
                    {groupReferenceBuyingRate != null ? (
                      <ThemedText style={styles.groupInfoText}>
                        参考进货价{' '}
                        <ThemedText type="defaultSemiBold">
                          {formatMoney(groupReferenceBuyingRate)}
                        </ThemedText>
                        {groupReferenceUnit ? ` / ${groupReferenceUnit}` : ''}
                      </ThemedText>
                    ) : null}
                    <ThemedText style={styles.groupInfoText}>
                      本次采购额{' '}
                      <ThemedText style={styles.amountHighlightText} type="defaultSemiBold">
                        {formatMoney(groupPurchaseAmount)}
                      </ThemedText>
                    </ThemedText>
                  </View>
                </View>
              </View>

              {(editable && (showReplaceItem || onAddWarehouseRow)) ? (
                <View style={styles.groupActions}>
                  {showReplaceItem && onReplaceItem && group.rows.length === 1 ? (
                    <Pressable
                      onPress={() => onReplaceItem(group.rows[0])}
                      style={[styles.groupActionButton, styles.groupActionSecondary, { backgroundColor: surface, borderColor }]}>
                      <ThemedText style={[styles.groupActionText, { color: tintColor }]} type="defaultSemiBold">
                        更换商品
                      </ThemedText>
                    </Pressable>
                  ) : null}
                  {onAddWarehouseRow ? (
                    <Pressable
                      onPress={() => onAddWarehouseRow(group.rows)}
                      style={[styles.groupActionButton, styles.groupActionPrimary, { backgroundColor: tintColor }]}>
                      <ThemedText style={styles.groupActionPrimaryText} type="defaultSemiBold">
                        新增仓库行
                      </ThemedText>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>

            <View style={[styles.groupSummaryBar, { backgroundColor: surface }]}>
              <ThemedText style={styles.groupSummaryText}>
                总库存 <ThemedText type="defaultSemiBold">{formatQty(leadRow.totalQty)} {stockUom ? formatDisplayUom(stockUom) : ''}</ThemedText>
              </ThemedText>
              <ThemedText style={styles.groupSummaryDivider}>·</ThemedText>
              <ThemedText style={styles.groupSummaryText}>
                本次入库后 <ThemedText type="defaultSemiBold">{formatQty(projectedTotal)} {stockUom ? formatDisplayUom(stockUom) : ''}</ThemedText>
              </ThemedText>
              <ThemedText style={styles.groupSummaryDivider}>·</ThemedText>
              <ThemedText style={styles.groupSummaryText}>
                已拆分 <ThemedText type="defaultSemiBold">{group.rows.length}</ThemedText> 条仓库行
              </ThemedText>
            </View>

            <View style={styles.subRowList}>
              {group.rows.map((item, rowIndex) => {
                const currentWarehouseStock =
                  item.warehouseStockDetails?.find((entry) => entry.warehouse === item.warehouse)?.qty ?? null;
                const rowQty = Number(item.qty);
                const incomingStockQty =
                  Number.isFinite(rowQty) && rowQty > 0
                    ? convertQtyToStockQty({
                        qty: rowQty,
                        uom: item.uom || item.stockUom,
                        stockUom: item.stockUom,
                        uomConversions: item.uomConversions,
                      }) ?? rowQty
                    : 0;
                const projectedWarehouseStock =
                  typeof currentWarehouseStock === 'number'
                    ? currentWarehouseStock + incomingStockQty
                    : null;
                const rowUnit = item.uom || item.stockUom || '';
                const rowDisplayUnit = formatDisplayUom(rowUnit);
                const rowPriceNumber = Number(item.price);
                const rowSubtotal =
                  Number.isFinite(rowQty) && Number.isFinite(rowPriceNumber)
                    ? rowQty * rowPriceNumber
                    : null;
                const isExpanded = editable
                  ? (expandedRows?.[item.id] ?? group.rows.length === 1)
                  : true;
                const requestRemoveItem = () => {
                  if (!onRemoveItem) {
                    return;
                  }
                  setPendingRemove({ id: item.id, name: item.itemName || item.itemCode });
                };

                return (
                  <View
                    key={item.id}
                    style={[
                      styles.subRowSection,
                      { backgroundColor: surface },
                      rowIndex > 0 ? [styles.subRowSectionDivider, { borderTopColor: borderColor }] : null,
                    ]}>
                    <View style={styles.subRowHeader}>
                      <View style={styles.subRowCopy}>
                        <View style={styles.subRowTitleRow}>
                          <View style={styles.subRowBadge}>
                            <ThemedText style={styles.subRowBadgeText} type="defaultSemiBold">
                              仓库分配 {rowIndex + 1}
                            </ThemedText>
                          </View>
                          <ThemedText style={styles.subRowSummaryText}>
                            {item.warehouse || '未选仓库'} · 数量 {item.qty || '0'} · 单价 {item.price || '默认'}
                          </ThemedText>
                        </View>
                        <View style={styles.subRowSummaryInline}>
                          <ThemedText style={styles.subRowMetaCompact}>
                            当前仓库 {formatQty(currentWarehouseStock)} {item.stockUom ? formatDisplayUom(item.stockUom) : ''}
                          </ThemedText>
                          <ThemedText style={styles.subRowSummaryDivider}>→</ThemedText>
                          <ThemedText style={styles.subRowMetaCompact}>
                            入库后 {formatQty(projectedWarehouseStock)} {item.stockUom ? formatDisplayUom(item.stockUom) : ''}
                          </ThemedText>
                        </View>
                      </View>

                      {editable ? (
                        <View style={styles.subRowHeaderActions}>
                          {onRemoveItem ? (
                            <Pressable onPress={requestRemoveItem} style={[styles.subRowRemove, { borderColor }]}>
                              <ThemedText style={styles.subRowRemoveText} type="defaultSemiBold">
                                删除
                              </ThemedText>
                            </Pressable>
                          ) : null}
                        </View>
                      ) : null}
                    </View>

                    {editable ? (
                      isExpanded ? (
                        <View style={styles.subRowEditBody}>
                          <View style={styles.subRowGrid}>
                            <View style={styles.subRowField}>
                              <ThemedText style={styles.fieldLabel} type="defaultSemiBold">
                                采购数量 {rowUnit ? `(${rowDisplayUnit})` : ''}
                              </ThemedText>
                              <View style={[styles.qtyStepper, { backgroundColor: surfaceMuted, borderColor }]}>
                                <Pressable
                                  disabled={(Number(item.qty) || 0) <= 1}
                                  onPress={() => onAdjustItemQty?.(item.id, -1)}
                                  style={[
                                    styles.qtyActionButton,
                                    (Number(item.qty) || 0) <= 1 ? styles.qtyActionButtonDisabled : null,
                                  ]}>
                                  <ThemedText style={[styles.qtyActionText, { color: tintColor }]} type="defaultSemiBold">
                                    -
                                  </ThemedText>
                                </Pressable>
                                <TextInput
                                  keyboardType="decimal-pad"
                                  onChangeText={(value) => onChangeItem?.(item.id, 'qty', value)}
                                  placeholder="数量"
                                  style={[
                                    styles.qtyInput,
                                    styles.textInputReset,
                                    Platform.OS === 'web' ? styles.webTextInputReset : null,
                                  ]}
                                  value={item.qty}
                                />
                                <Pressable onPress={() => onAdjustItemQty?.(item.id, 1)} style={styles.qtyActionButton}>
                                  <ThemedText style={[styles.qtyActionText, { color: tintColor }]} type="defaultSemiBold">
                                    +
                                  </ThemedText>
                                </Pressable>
                              </View>
                            </View>
                            <View style={styles.subRowField}>
                              <ThemedText style={styles.fieldLabel} type="defaultSemiBold">
                                实际采购价 {rowUnit ? `(元/${rowDisplayUnit})` : ''}
                              </ThemedText>
                              <View style={[styles.priceInputWrap, { backgroundColor: surfaceMuted, borderColor }]}>
                                <ThemedText style={styles.pricePrefix}>¥</ThemedText>
                                <TextInput
                                  keyboardType="decimal-pad"
                                  onChangeText={(value) => onChangeItem?.(item.id, 'price', value)}
                                  placeholder="单价"
                                  style={[
                                    styles.priceInput,
                                    styles.textInputReset,
                                    Platform.OS === 'web' ? styles.webTextInputReset : null,
                                  ]}
                                  value={item.price}
                                />
                              </View>
                            </View>
                          </View>

                          <View style={styles.subRowGrid}>
                            <View style={styles.subRowField}>
                              <ThemedText style={styles.fieldLabel} type="defaultSemiBold">
                                采购单位
                              </ThemedText>
                              <Pressable
                                onPress={() => onOpenPicker?.(item.id, 'uom')}
                                style={[styles.compactInfoBox, { backgroundColor: surfaceMuted, borderColor }]}>
                                <ThemedText style={styles.compactInfoValue} type="defaultSemiBold">
                                  {rowUnit ? rowDisplayUnit : '选择单位'}
                                </ThemedText>
                              </Pressable>
                            </View>

                            <View style={styles.subRowField}>
                              <ThemedText style={styles.fieldLabel} type="defaultSemiBold">
                                小计
                              </ThemedText>
                              <View style={[styles.compactResultBox, { backgroundColor: surface }]}>
                                <ThemedText style={styles.amountHighlightText} type="defaultSemiBold">
                                  {formatMoney(rowSubtotal)}
                                </ThemedText>
                              </View>
                            </View>
                          </View>

                          <View style={styles.subRowField}>
                            <ThemedText style={styles.fieldLabel} type="defaultSemiBold">
                              入库仓库
                            </ThemedText>
                            <Pressable
                              onPress={() => onOpenPicker?.(item.id, 'warehouse')}
                              style={[styles.selectorButton, { backgroundColor: surfaceMuted, borderColor }]}>
                              <ThemedText style={styles.selectorButtonText}>
                                {item.warehouse || '选择入库仓库'}
                              </ThemedText>
                            </Pressable>
                          </View>

                        </View>
                      ) : null
                    ) : (
                      <View style={styles.readonlyBody}>
                        <DetailInfoRow label="采购数量" value={item.qty || '—'} />
                        <DetailInfoRow label="实际采购价" value={item.price ? formatMoney(Number(item.price)) : '未设置'} />
                        <DetailInfoRow label="小计" value={formatMoney(rowSubtotal)} />
                        <DetailInfoRow label="入库仓库" value={item.warehouse || '未指定仓库'} />
                        <DetailInfoRow label="单位" value={item.uom ? rowDisplayUnit : '未设置单位'} />
                      </View>
                    )}

                    {editable && onToggleRow ? (
                      <View style={styles.subRowFooterActions}>
                        <Pressable
                          onPress={() => onToggleRow(item.id, !isExpanded)}
                          style={[styles.subRowToggle, { borderColor }]}>
                          <ThemedText style={[styles.subRowToggleText, { color: tintColor }]} type="defaultSemiBold">
                            {isExpanded ? '收起' : '编辑'}
                          </ThemedText>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        );
        })}
      </View>

      <Modal
        animationType="fade"
        onRequestClose={() => setPendingRemove(null)}
        transparent
        visible={Boolean(pendingRemove)}>
        <View style={styles.dialogBackdrop}>
          <Pressable onPress={() => setPendingRemove(null)} style={StyleSheet.absoluteFill} />
          <View style={styles.dialogCard}>
            <ThemedText style={styles.dialogTitle} type="defaultSemiBold">
              删除仓库分配
            </ThemedText>
            <ThemedText style={styles.dialogMessage}>
              确认删除 {pendingRemove?.name || '当前商品'} 的这条仓库分配吗？
            </ThemedText>
            <View style={styles.dialogActions}>
              <Pressable onPress={() => setPendingRemove(null)} style={[styles.dialogButton, styles.dialogGhostButton]}>
                <ThemedText style={styles.dialogGhostText} type="defaultSemiBold">
                  取消
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (pendingRemove && onRemoveItem) {
                    onRemoveItem(pendingRemove.id);
                  }
                  setPendingRemove(null);
                }}
                style={[styles.dialogButton, styles.dialogDangerButton]}>
                <ThemedText style={styles.dialogDangerText} type="defaultSemiBold">
                  删除
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 12,
  },
  groupBlock: {
    borderRadius: 20,
    gap: 12,
    padding: 14,
  },
  groupBlockStacked: {
    marginTop: 2,
  },
  groupHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  groupLead: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  groupThumbWrap: {
    alignItems: 'center',
    borderRadius: 18,
    height: 52,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 52,
  },
  groupThumbImage: {
    height: '100%',
    width: '100%',
  },
  groupCopy: {
    flex: 1,
    gap: 2,
  },
  groupLabel: {
    color: '#2563EB',
    fontSize: 12,
  },
  groupTitle: {
    fontSize: 17,
  },
  groupMeta: {
    color: '#64748B',
    fontSize: 12,
  },
  groupInfoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  groupInfoText: {
    color: '#64748B',
    fontSize: 12,
  },
  groupActions: {
    gap: 8,
  },
  groupActionButton: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 42,
    minWidth: 102,
    paddingHorizontal: 12,
  },
  groupActionPrimary: {
    borderWidth: 0,
  },
  groupActionSecondary: {
    borderWidth: 1,
  },
  groupActionText: {
    fontSize: 13,
  },
  groupActionPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13,
  },
  groupSummaryBar: {
    alignItems: 'center',
    borderRadius: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  groupSummaryText: {
    color: '#475569',
    fontSize: 13,
  },
  groupSummaryDivider: {
    color: '#94A3B8',
    fontSize: 13,
  },
  subRowList: {
    gap: 10,
  },
  subRowSection: {
    borderRadius: 18,
    gap: 12,
    padding: 14,
  },
  subRowSectionDivider: {
    borderTopWidth: 1,
  },
  subRowHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  subRowCopy: {
    flex: 1,
    gap: 6,
  },
  subRowTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subRowBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  subRowBadgeText: {
    color: '#2563EB',
    fontSize: 12,
  },
  subRowSummaryText: {
    color: '#475569',
    flex: 1,
    fontSize: 12,
  },
  subRowSummaryInline: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  subRowMetaCompact: {
    color: '#64748B',
    fontSize: 12,
  },
  subRowSummaryDivider: {
    color: '#94A3B8',
    fontSize: 12,
  },
  subRowHeaderActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  subRowFooterActions: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  subRowToggle: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  subRowToggleText: {
    fontSize: 12,
  },
  subRowRemove: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  subRowRemoveText: {
    color: '#DC2626',
    fontSize: 12,
  },
  subRowEditBody: {
    gap: 12,
  },
  subRowGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  subRowField: {
    flex: 1,
    gap: 8,
  },
  fieldLabel: {
    fontSize: 14,
  },
  qtyStepper: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 56,
    overflow: 'hidden',
  },
  qtyActionButton: {
    alignItems: 'center',
    flexShrink: 0,
    height: '100%',
    justifyContent: 'center',
    width: 40,
  },
  qtyActionButtonDisabled: {
    opacity: 0.35,
  },
  qtyActionText: {
    fontSize: 22,
  },
  qtyInput: {
    color: '#0F172A',
    flexGrow: 1,
    flexShrink: 1,
    fontSize: 18,
    minHeight: 56,
    minWidth: 52,
    paddingHorizontal: 0,
    textAlign: 'center',
  },
  priceInputWrap: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 56,
    paddingHorizontal: 12,
  },
  pricePrefix: {
    color: '#64748B',
    fontSize: 16,
    marginRight: 6,
  },
  priceInput: {
    color: '#0F172A',
    flex: 1,
    fontSize: 18,
    minHeight: 56,
  },
  compactInfoBox: {
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: 14,
  },
  compactInfoValue: {
    fontSize: 18,
  },
  compactResultBox: {
    borderRadius: 16,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: 14,
  },
  selectorButton: {
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  selectorButtonText: {
    fontSize: 15,
  },
  readonlyBody: {
    gap: 10,
  },
  detailInfoRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  detailInfoLabel: {
    color: '#475569',
    fontSize: 14,
  },
  detailInfoValue: {
    color: '#0F172A',
    flex: 1,
    fontSize: 15,
    textAlign: 'right',
  },
  amountHighlightText: {
    color: '#C2410C',
    fontSize: 16,
  },
  emptyState: {
    borderRadius: 18,
    gap: 8,
    padding: 16,
  },
  emptyActionButton: {
    alignSelf: 'flex-start',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  emptyActionText: {
    fontSize: 13,
  },
  textInputReset: {
    includeFontPadding: false,
    margin: 0,
    padding: 0,
  },
  webTextInputReset: {
    outlineStyle: 'none',
  },
  dialogBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  dialogCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    gap: 14,
    maxWidth: 360,
    padding: 20,
    width: '100%',
  },
  dialogTitle: {
    color: '#0F172A',
    fontSize: 18,
  },
  dialogMessage: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 21,
  },
  dialogActions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
  },
  dialogButton: {
    alignItems: 'center',
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 88,
    paddingHorizontal: 16,
  },
  dialogGhostButton: {
    backgroundColor: '#F8FAFC',
  },
  dialogDangerButton: {
    backgroundColor: '#DC2626',
  },
  dialogGhostText: {
    color: '#0F172A',
    fontSize: 14,
  },
  dialogDangerText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
});
