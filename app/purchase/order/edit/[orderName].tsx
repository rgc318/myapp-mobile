import { useEffect, useMemo, useRef, useState } from 'react';
import type { Href } from 'expo-router';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Image } from 'expo-image';

import { AppShell } from '@/components/app-shell';
import { DateFieldInput } from '@/components/date-field-input';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { normalizeAppError } from '@/lib/app-error';
import { getAppPreferences } from '@/lib/app-preferences';
import { isValidIsoDate } from '@/lib/date-value';
import { formatDisplayUom } from '@/lib/display-uom';
import { convertQtyToStockQty, formatConvertedQty, type UomConversion } from '@/lib/uom-conversion';
import { useFeedback } from '@/providers/feedback-provider';
import { fetchProductDetail } from '@/services/products';
import {
  fetchPurchaseOrderDetail,
  getWarehouseCompany,
  searchWarehouses,
  updatePurchaseOrder,
  updatePurchaseOrderItems,
  type PurchaseOrderDetail,
} from '@/services/purchases';

type EditablePurchaseOrderItem = {
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
  allUoms?: string[];
  uomConversions?: UomConversion[];
  warehouseStockDetails?: { warehouse: string; company: string | null; qty: number }[];
};

function buildEditableId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizePositiveNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formatQty(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }

  return formatConvertedQty(value);
}

function getAvailableUoms(item: EditablePurchaseOrderItem) {
  const values = new Set<string>();
  if (item.uom) {
    values.add(item.uom);
  }
  if (item.stockUom) {
    values.add(item.stockUom);
  }
  item.allUoms?.forEach((uom) => {
    if (uom) {
      values.add(uom);
    }
  });
  return Array.from(values);
}

function buildItemsSignature(
  items: {
    itemCode: string;
    qty: string;
    price: string;
    warehouse: string;
    uom: string;
  }[],
) {
  return JSON.stringify(
    items.map((item) => ({
      itemCode: item.itemCode,
      qty: item.qty.trim(),
      price: item.price.trim(),
      warehouse: item.warehouse.trim(),
      uom: item.uom.trim(),
    })),
  );
}

export default function PurchaseOrderEditScreen() {
  const { orderName } = useLocalSearchParams<{ orderName: string }>();
  const router = useRouter();
  const preferences = getAppPreferences();
  const { showError, showSuccess } = useFeedback();

  const [detail, setDetail] = useState<PurchaseOrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [transactionDate, setTransactionDate] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [supplierRef, setSupplierRef] = useState('');
  const [remarks, setRemarks] = useState('');
  const [editableItems, setEditableItems] = useState<EditablePurchaseOrderItem[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<{ itemId: string; field: 'warehouse' | 'uom' } | null>(null);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerOptions, setPickerOptions] = useState<{ label: string; value: string; description?: string }[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const metaSectionYRef = useRef(0);
  const itemsSectionYRef = useRef(0);
  const hydratedKeysRef = useRef<Record<string, true>>({});
  const warehouseCompanyCacheRef = useRef<Record<string, string | null>>({});
  const originalMetaRef = useRef('');
  const originalItemsRef = useRef('');

  const surface = useThemeColor({}, 'surface');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');
  const warningColor = useThemeColor({}, 'warning');
  const successColor = useThemeColor({}, 'success');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    fetchPurchaseOrderDetail(orderName || '')
      .then((nextDetail) => {
        if (cancelled || !nextDetail) {
          return;
        }

        setDetail(nextDetail);
        setTransactionDate(nextDetail.transactionDate || '');
        setScheduleDate(nextDetail.scheduleDate || '');
        setSupplierRef(nextDetail.supplierRef || '');
        setRemarks(nextDetail.remarks || '');

        const nextItems = nextDetail.items.map((item, index) => ({
          id: `${item.purchaseOrderItem || item.itemCode}-${index}`,
          itemCode: item.itemCode,
          itemName: item.itemName || item.itemCode,
          qty: typeof item.qty === 'number' ? String(item.qty) : '',
          price: typeof item.rate === 'number' ? String(item.rate) : '',
          warehouse: item.warehouse || '',
          uom: item.uom || '',
          imageUrl: null,
          stockUom: item.uom || null,
          totalQty: null,
          allUoms: item.uom ? [item.uom] : [],
          uomConversions: [],
          warehouseStockDetails: [],
        }));

        setEditableItems(nextItems);
        originalMetaRef.current = JSON.stringify({
          transactionDate: nextDetail.transactionDate || '',
          scheduleDate: nextDetail.scheduleDate || '',
          supplierRef: nextDetail.supplierRef || '',
          remarks: nextDetail.remarks || '',
        });
        originalItemsRef.current = buildItemsSignature(nextItems);
      })
      .catch((error) => {
        if (!cancelled) {
          showError(normalizeAppError(error).message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [orderName, showError]);

  useEffect(() => {
    if (!detail?.company) {
      return;
    }

    const activeWarehouses = Array.from(new Set(editableItems.map((item) => item.warehouse.trim()).filter(Boolean)));

    Object.keys(warehouseCompanyCacheRef.current).forEach((warehouse) => {
      if (!activeWarehouses.includes(warehouse)) {
        delete warehouseCompanyCacheRef.current[warehouse];
      }
    });

    if (!activeWarehouses.length) {
      return;
    }

    let active = true;
    const unresolved = activeWarehouses.filter((warehouse) => typeof warehouseCompanyCacheRef.current[warehouse] === 'undefined');

    const validateRows = () => {
      const invalid = activeWarehouses.filter((warehouse) => {
        const warehouseCompany = warehouseCompanyCacheRef.current[warehouse];
        return Boolean(warehouseCompany && warehouseCompany !== detail.company);
      });

      if (!invalid.length) {
        return;
      }

      setEditableItems((currentItems) =>
        currentItems.map((item) =>
          invalid.includes(item.warehouse.trim()) ? { ...item, warehouse: '' } : item,
        ),
      );
      showError(`已清除不属于当前公司 ${detail.company} 的仓库，请重新选择。`);
    };

    if (!unresolved.length) {
      validateRows();
      return;
    }

    void Promise.all(
      unresolved.map(async (warehouse) => ({
        warehouse,
        company: await getWarehouseCompany(warehouse),
      })),
    ).then((rows) => {
      if (!active) {
        return;
      }

      rows.forEach(({ warehouse, company }) => {
        warehouseCompanyCacheRef.current[warehouse] = company;
      });
      validateRows();
    });

    return () => {
      active = false;
    };
  }, [detail?.company, editableItems, showError]);

  useEffect(() => {
    if (!detail?.company) {
      return;
    }

    const keys = new Set(
      editableItems
        .filter((item) => item.itemCode)
        .map((item) => `${item.id}::${detail.company}::${item.warehouse.trim()}`),
    );

    Object.keys(hydratedKeysRef.current).forEach((key) => {
      if (!keys.has(key)) {
        delete hydratedKeysRef.current[key];
      }
    });

    const missing = editableItems.filter(
      (item) =>
        item.itemCode &&
        !hydratedKeysRef.current[`${item.id}::${detail.company}::${item.warehouse.trim()}`] &&
        (!item.stockUom ||
          !item.allUoms?.length ||
          typeof item.totalQty !== 'number' ||
          !item.warehouseStockDetails?.length ||
          !item.imageUrl),
    );

    if (!missing.length) {
      return;
    }

    let active = true;
    missing.forEach((item) => {
      hydratedKeysRef.current[`${item.id}::${detail.company}::${item.warehouse.trim()}`] = true;
    });

    void Promise.all(
      missing.map(async (item) => {
        const product = await fetchProductDetail(item.itemCode, {
          warehouse: item.warehouse || undefined,
          company: item.warehouse ? undefined : detail.company,
        });

        return product ? { id: item.id, product } : null;
      }),
    ).then((results) => {
      if (!active) {
        return;
      }

      const mapped = new Map(results.filter(Boolean).map((entry) => [entry.id, entry.product]));
      if (!mapped.size) {
        return;
      }

      setEditableItems((currentItems) =>
        currentItems.map((item) => {
          const product = mapped.get(item.id);
          if (!product) {
            return item;
          }

          return {
            ...item,
            imageUrl: item.imageUrl || product.imageUrl || null,
            stockUom: item.stockUom || product.stockUom || null,
            totalQty: typeof product.totalQty === 'number' ? product.totalQty : item.totalQty ?? null,
            allUoms: item.allUoms?.length ? item.allUoms : product.allUoms,
            uomConversions: item.uomConversions?.length ? item.uomConversions : product.uomConversions,
            warehouseStockDetails: item.warehouseStockDetails?.length ? item.warehouseStockDetails : product.warehouseStockDetails,
          };
        }),
      );
    });

    return () => {
      active = false;
    };
  }, [detail?.company, editableItems]);

  const pickerItem = useMemo(
    () => (pickerTarget ? editableItems.find((item) => item.id === pickerTarget.itemId) ?? null : null),
    [editableItems, pickerTarget],
  );

  useEffect(() => {
    if (!pickerVisible || !pickerTarget || !pickerItem || !detail?.company) {
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setPickerLoading(true);
      try {
        let nextOptions: { label: string; value: string; description?: string }[] = [];

        if (pickerTarget.field === 'warehouse') {
          nextOptions = await searchWarehouses(pickerQuery, detail.company);
        } else {
          const keyword = pickerQuery.trim().toLowerCase();
          const localOptions = getAvailableUoms(pickerItem)
            .filter((uom) => (keyword ? uom.toLowerCase().includes(keyword) : true))
            .map((uom) => ({
              label: formatDisplayUom(uom),
              value: uom,
              description:
                pickerItem.stockUom && uom === pickerItem.stockUom ? `${uom} · 库存单位` : `${uom} · 商品单位`,
            }));
          nextOptions = localOptions;
        }

        if (active) {
          setPickerOptions(nextOptions);
        }
      } finally {
        if (active) {
          setPickerLoading(false);
        }
      }
    }, 180);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [detail?.company, pickerItem, pickerQuery, pickerTarget, pickerVisible]);

  const groupedItems = useMemo(() => {
    const groups = new Map<
      string,
      {
        itemCode: string;
        itemName: string;
        rows: EditablePurchaseOrderItem[];
      }
    >();

    editableItems.forEach((item) => {
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
  }, [editableItems]);

  const validItems = useMemo(
    () =>
      editableItems
        .map((item) => {
          const qty = normalizePositiveNumber(item.qty);
          if (!item.itemCode.trim() || qty === null) {
            return null;
          }
          const price = item.price.trim() && Number.isFinite(Number(item.price)) ? Number(item.price) : null;

          return {
            itemCode: item.itemCode.trim(),
            qty,
            warehouse: item.warehouse.trim() || undefined,
            uom: item.uom.trim() || undefined,
            price,
          };
        })
        .filter((item): item is { itemCode: string; qty: number; warehouse?: string; uom?: string; price: number | null } => Boolean(item)),
    [editableItems],
  );

  const canEditItems = useMemo(() => {
    if (!detail) {
      return false;
    }
    if (detail.documentStatus === 'cancelled') {
      return false;
    }
    if (detail.purchaseReceipts.length || detail.purchaseInvoices.length) {
      return false;
    }
    if ((detail.receivedQty ?? 0) > 0) {
      return false;
    }
    return true;
  }, [detail]);

  const headerChanged = useMemo(
    () =>
      originalMetaRef.current !==
      JSON.stringify({
        transactionDate,
        scheduleDate,
        supplierRef,
        remarks,
      }),
    [remarks, scheduleDate, supplierRef, transactionDate],
  );

  const itemsChanged = useMemo(
    () => originalItemsRef.current !== buildItemsSignature(editableItems),
    [editableItems],
  );

  const actions = useMemo(() => {
    if (!detail?.name) {
      return [] as { href: Href; label: string; description?: string }[];
    }

    const nextActions = [] as { href: Href; label: string; description?: string }[];

    if (detail.canReceive) {
      nextActions.push({
        href: `/purchase/receipt/create?orderName=${encodeURIComponent(detail.name)}` as Href,
        label: '继续收货',
        description: '基于这张采购订单继续登记实际收货',
      });
    }

    if (detail.canCreateInvoice) {
      nextActions.push({
        href: `/purchase/invoice/create?orderName=${encodeURIComponent(detail.name)}` as Href,
        label: '继续开票',
        description: '进入采购开票流程',
      });
    }

    return nextActions;
  }, [detail]);

  const scrollToSection = (y: number) => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: Math.max(y - 16, 0), animated: true });
    });
  };

  const handleItemChange = (itemId: string, field: keyof EditablePurchaseOrderItem, value: string) => {
    setEditableItems((current) => current.map((item) => (item.id === itemId ? { ...item, [field]: value } : item)));
  };

  const openPicker = (itemId: string, field: 'warehouse' | 'uom') => {
    if (!canEditItems) {
      return;
    }
    setPickerTarget({ itemId, field });
    setPickerVisible(true);
    setPickerQuery('');
  };

  const closePicker = () => {
    setPickerVisible(false);
    setPickerTarget(null);
    setPickerQuery('');
    setPickerOptions([]);
    setPickerLoading(false);
  };

  const handleSelectPickerValue = (value: string) => {
    if (!pickerTarget) {
      return;
    }
    handleItemChange(pickerTarget.itemId, pickerTarget.field, value);
    closePicker();
  };

  const handleRemoveItem = (itemId: string) => {
    if (!canEditItems) {
      return;
    }

    setEditableItems((current) => current.filter((item) => item.id !== itemId));
  };

  const handleAddWarehouseRow = (rows: EditablePurchaseOrderItem[]) => {
    if (!canEditItems) {
      return;
    }

    const baseRow = rows[0];
    setEditableItems((current) => [
      ...current,
      {
        ...baseRow,
        id: buildEditableId(),
        qty: '1',
        warehouse: baseRow.warehouse,
      },
    ]);
  };

  const handleSave = async () => {
    if (!detail) {
      return;
    }

    if (!isValidIsoDate(transactionDate)) {
      showError('请先选择有效下单日期。');
      scrollToSection(metaSectionYRef.current);
      return;
    }

    if (!isValidIsoDate(scheduleDate)) {
      showError('请先选择有效计划到货日期。');
      scrollToSection(metaSectionYRef.current);
      return;
    }

    if (!headerChanged && !itemsChanged) {
      showError('当前没有可保存的修改。');
      return;
    }

    if (!validItems.length) {
      showError('请至少保留一条有效采购明细。');
      scrollToSection(itemsSectionYRef.current);
      return;
    }

    if (itemsChanged && !canEditItems) {
      showError('当前采购订单已有收货或开票记录，暂不允许修改商品明细。');
      scrollToSection(itemsSectionYRef.current);
      return;
    }

    try {
      setIsSaving(true);

      let nextOrderName = detail.name;
      let sourceOrderName = detail.name;

      if (itemsChanged) {
        const itemResult = await updatePurchaseOrderItems({
          orderName: detail.name,
          company: detail.company,
          scheduleDate,
          defaultWarehouse: preferences.defaultWarehouse,
          items: validItems,
        });

        nextOrderName = itemResult.orderName;
        sourceOrderName = itemResult.sourceOrderName;
      }

      if (headerChanged) {
        nextOrderName = await updatePurchaseOrder({
          orderName: nextOrderName,
          transactionDate,
          scheduleDate,
          supplierRef,
          remarks,
        });
      }

      showSuccess(
        itemsChanged && nextOrderName !== sourceOrderName
          ? `采购订单已更新，新单号为 ${nextOrderName}。`
          : `采购订单 ${nextOrderName} 已更新。`,
      );

      router.replace({
        pathname: '/purchase/order/[orderName]',
        params: { orderName: nextOrderName },
      });
    } catch (error) {
      showError(normalizeAppError(error).message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppShell
      actions={actions}
      compactHeader
      contentCard={false}
      description="编辑采购订单头信息和商品明细。若修改商品区，系统可能生成新的修订单号。"
      footer={
        <Pressable
          disabled={isSaving || (!headerChanged && !itemsChanged)}
          onPress={() => void handleSave()}
          style={[
            styles.footerButton,
            { backgroundColor: isSaving || (!headerChanged && !itemsChanged) ? surfaceMuted : tintColor },
          ]}>
          <ThemedText style={styles.footerButtonText} type="defaultSemiBold">
            {isSaving ? '正在保存采购订单...' : '保存采购订单'}
          </ThemedText>
        </Pressable>
      }
      title="编辑采购订单">
      <ScrollView contentContainerStyle={styles.container} ref={scrollRef}>
        {isLoading ? (
          <View style={[styles.loadingCard, { backgroundColor: surface, borderColor }]}>
            <ActivityIndicator />
            <ThemedText>正在读取采购订单...</ThemedText>
          </View>
        ) : detail ? (
          <>
            <View style={[styles.heroCard, { backgroundColor: surface, borderColor }]}>
              <View style={styles.heroHeader}>
                <View style={styles.heroCopy}>
                  <ThemedText style={styles.heroTitle} type="defaultSemiBold">
                    {detail.supplierName || detail.supplier}
                  </ThemedText>
                  <ThemedText style={styles.heroSubline}>{detail.name}</ThemedText>
                </View>
                <View style={[styles.statusChip, { backgroundColor: canEditItems ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.14)' }]}>
                  <ThemedText
                    style={{ color: canEditItems ? successColor : warningColor }}
                    type="defaultSemiBold">
                    {canEditItems ? '可编辑商品' : '仅可编辑头信息'}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.metaGrid}>
                <MetaBlock label="供应商" value={detail.supplierName || detail.supplier} />
                <MetaBlock label="我方公司" value={detail.company || '未设置'} />
                <MetaBlock label="状态" value={detail.documentStatus || '未知'} />
                <MetaBlock label="当前金额" value={typeof detail.orderAmountEstimate === 'number' ? `¥ ${detail.orderAmountEstimate}` : '—'} />
              </View>

              {!canEditItems ? (
                <View style={[styles.noticeCard, { backgroundColor: surfaceMuted }]}>
                  <ThemedText style={styles.noticeTitle} type="defaultSemiBold">
                    商品区已锁定
                  </ThemedText>
                  <ThemedText style={styles.noticeText}>
                    当前采购订单已经存在收货或开票记录，后端不允许继续修改商品明细。你仍然可以调整计划到货、备注和供应商单号等头部字段。
                  </ThemedText>
                </View>
              ) : (
                <View style={[styles.noticeCard, { backgroundColor: surfaceMuted }]}>
                  <ThemedText style={styles.noticeTitle} type="defaultSemiBold">
                    商品编辑说明
                  </ThemedText>
                  <ThemedText style={styles.noticeText}>
                    修改商品区时，后端会按 v2 规则整体替换采购明细；如果当前订单已提交，系统可能生成新的修订单号。
                  </ThemedText>
                </View>
              )}
            </View>

            <View
              onLayout={(event) => {
                metaSectionYRef.current = event.nativeEvent.layout.y;
              }}
              style={[styles.card, { backgroundColor: surface, borderColor }]}>
              <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
                头部信息
              </ThemedText>

              <View style={styles.fieldBlock}>
                <ThemedText style={styles.fieldLabel} type="defaultSemiBold">
                  供应商
                </ThemedText>
                <View style={[styles.readonlyField, { backgroundColor: surfaceMuted, borderColor }]}>
                  <ThemedText>{detail.supplierName || detail.supplier}</ThemedText>
                </View>
              </View>

              <View style={styles.fieldBlock}>
                <ThemedText style={styles.fieldLabel} type="defaultSemiBold">
                  我方公司
                </ThemedText>
                <View style={[styles.readonlyField, { backgroundColor: surfaceMuted, borderColor }]}>
                  <ThemedText>{detail.company || '未设置'}</ThemedText>
                </View>
              </View>

              <View style={styles.inlineGrid}>
                <View style={styles.inlineField}>
                  <DateFieldInput
                    errorText={!isValidIsoDate(transactionDate) ? '请选择有效下单日期。' : undefined}
                    helperText="采购单头部日期。"
                    label="下单日期"
                    onChange={setTransactionDate}
                    value={transactionDate}
                  />
                </View>
                <View style={styles.inlineField}>
                  <DateFieldInput
                    errorText={!isValidIsoDate(scheduleDate) ? '请选择有效计划到货日期。' : undefined}
                    helperText="用于收货计划安排。"
                    label="计划到货"
                    onChange={setScheduleDate}
                    value={scheduleDate}
                  />
                </View>
              </View>

              <View style={styles.fieldBlock}>
                <ThemedText style={styles.fieldLabel} type="defaultSemiBold">
                  供应商单号
                </ThemedText>
                <TextInput
                  onChangeText={setSupplierRef}
                  placeholder="可选，记录对方单号"
                  style={[styles.input, { backgroundColor: surfaceMuted, borderColor }]}
                  value={supplierRef}
                />
              </View>

              <View style={styles.fieldBlock}>
                <ThemedText style={styles.fieldLabel} type="defaultSemiBold">
                  备注
                </ThemedText>
                <TextInput
                  multiline
                  onChangeText={setRemarks}
                  placeholder="可选，记录本次采购补充说明"
                  style={[styles.input, styles.textarea, { backgroundColor: surfaceMuted, borderColor }]}
                  value={remarks}
                />
              </View>
            </View>

            <View
              onLayout={(event) => {
                itemsSectionYRef.current = event.nativeEvent.layout.y;
              }}
              style={[styles.card, { backgroundColor: surface, borderColor }]}>
              <View style={styles.sectionHeader}>
                <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
                  商品明细
                </ThemedText>
                <ThemedText style={[styles.sectionHint, { color: canEditItems ? tintColor : warningColor }]} type="defaultSemiBold">
                  {canEditItems ? '可修改' : '已锁定'}
                </ThemedText>
              </View>

              <View style={styles.groupList}>
                {groupedItems.map((group, groupIndex) => {
                  const leadRow = group.rows[0];
                  const stockUom = leadRow.stockUom || leadRow.uom || '';
                  const incomingQty = group.rows.reduce((sum, row) => {
                    const rowQty = Number(row.qty);
                    if (!Number.isFinite(rowQty)) {
                      return sum;
                    }
                    const converted =
                      convertQtyToStockQty({
                        qty: rowQty,
                        uom: row.uom || stockUom,
                        stockUom: leadRow.stockUom || stockUom,
                        uomConversions: row.uomConversions ?? leadRow.uomConversions,
                      }) ?? rowQty;
                    return sum + converted;
                  }, 0);
                  const projectedTotal = typeof leadRow.totalQty === 'number' ? leadRow.totalQty + incomingQty : null;

                  return (
                    <View
                      key={`${group.itemCode}-${groupIndex}`}
                      style={[styles.groupCard, { backgroundColor: surfaceMuted }]}>
                      <View style={styles.groupHeader}>
                        <View style={styles.groupLead}>
                          <View style={[styles.thumbWrap, { backgroundColor: surface }]}>
                            {leadRow.imageUrl ? (
                              <Image contentFit="cover" source={leadRow.imageUrl} style={styles.thumbImage} />
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
                          </View>
                        </View>
                        {canEditItems ? (
                          <Pressable
                            onPress={() => handleAddWarehouseRow(group.rows)}
                            style={[styles.actionButton, { backgroundColor: surface, borderColor }]}>
                            <ThemedText style={{ color: tintColor }} type="defaultSemiBold">
                              新增仓库行
                            </ThemedText>
                          </Pressable>
                        ) : null}
                      </View>

                      <View style={styles.metricRow}>
                        <View style={[styles.metricCard, { backgroundColor: surface }]}>
                          <ThemedText style={styles.metricLabel}>总库存</ThemedText>
                          <ThemedText style={styles.metricValue} type="defaultSemiBold">
                            {formatQty(leadRow.totalQty)} {stockUom ? formatDisplayUom(stockUom) : ''}
                          </ThemedText>
                        </View>
                        <View style={[styles.metricCard, { backgroundColor: surface }]}>
                          <ThemedText style={styles.metricLabel}>修改后预计</ThemedText>
                          <ThemedText style={styles.metricValue} type="defaultSemiBold">
                            {formatQty(projectedTotal)} {stockUom ? formatDisplayUom(stockUom) : ''}
                          </ThemedText>
                        </View>
                      </View>

                      <View style={styles.rowList}>
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

                          return (
                            <View
                              key={item.id}
                              style={[
                                styles.rowCard,
                                { backgroundColor: surface },
                                rowIndex > 0 ? [styles.rowDivider, { borderTopColor: borderColor }] : null,
                              ]}>
                              <View style={styles.rowHeader}>
                                <View style={styles.rowHeaderCopy}>
                                  <View style={styles.rowBadge}>
                                    <ThemedText style={styles.rowBadgeText} type="defaultSemiBold">
                                      仓库分配 {rowIndex + 1}
                                    </ThemedText>
                                  </View>
                                  <ThemedText style={styles.rowMeta}>
                                    这一行会形成最终采购明细中的一条商品行。
                                  </ThemedText>
                                </View>
                                {canEditItems ? (
                                  <Pressable onPress={() => handleRemoveItem(item.id)} style={[styles.removeButton, { borderColor }]}>
                                    <ThemedText style={styles.removeButtonText} type="defaultSemiBold">
                                      删除
                                    </ThemedText>
                                  </Pressable>
                                ) : null}
                              </View>

                              <View style={styles.inventoryRow}>
                                <View style={[styles.inventoryCard, { backgroundColor: surfaceMuted }]}>
                                  <ThemedText style={styles.inventoryLabel}>当前仓库库存</ThemedText>
                                  <ThemedText style={styles.inventoryValue} type="defaultSemiBold">
                                    {formatQty(currentWarehouseStock)} {item.stockUom ? formatDisplayUom(item.stockUom) : ''}
                                  </ThemedText>
                                </View>
                                <View style={[styles.inventoryCard, { backgroundColor: surfaceMuted }]}>
                                  <ThemedText style={styles.inventoryLabel}>修改后库存</ThemedText>
                                  <ThemedText style={styles.inventoryValue} type="defaultSemiBold">
                                    {formatQty(projectedWarehouseStock)} {item.stockUom ? formatDisplayUom(item.stockUom) : ''}
                                  </ThemedText>
                                </View>
                              </View>

                              <View style={styles.inlineGrid}>
                                <View style={styles.inlineField}>
                                  <ThemedText style={styles.fieldLabel} type="defaultSemiBold">
                                    数量
                                  </ThemedText>
                                  <TextInput
                                    editable={canEditItems}
                                    keyboardType="decimal-pad"
                                    onChangeText={(value) => handleItemChange(item.id, 'qty', value)}
                                    placeholder="数量"
                                    style={[styles.input, { backgroundColor: surfaceMuted, borderColor }]}
                                    value={item.qty}
                                  />
                                </View>
                                <View style={styles.inlineField}>
                                  <ThemedText style={styles.fieldLabel} type="defaultSemiBold">
                                    实际采购价
                                  </ThemedText>
                                  <TextInput
                                    editable={canEditItems}
                                    keyboardType="decimal-pad"
                                    onChangeText={(value) => handleItemChange(item.id, 'price', value)}
                                    placeholder="留空则沿用默认采购价"
                                    style={[styles.input, { backgroundColor: surfaceMuted, borderColor }]}
                                    value={item.price}
                                  />
                                </View>
                              </View>

                              <View style={styles.fieldBlock}>
                                <ThemedText style={styles.fieldLabel} type="defaultSemiBold">
                                  入库仓库
                                </ThemedText>
                                <Pressable
                                  disabled={!canEditItems}
                                  onPress={() => openPicker(item.id, 'warehouse')}
                                  style={[styles.selectorButton, { backgroundColor: surfaceMuted, borderColor, opacity: canEditItems ? 1 : 0.65 }]}>
                                  <ThemedText style={styles.selectorButtonText}>
                                    {item.warehouse || '选择入库仓库'}
                                  </ThemedText>
                                </Pressable>
                              </View>

                              <View style={styles.fieldBlock}>
                                <ThemedText style={styles.fieldLabel} type="defaultSemiBold">
                                  单位
                                </ThemedText>
                                <Pressable
                                  disabled={!canEditItems}
                                  onPress={() => openPicker(item.id, 'uom')}
                                  style={[styles.selectorButton, { backgroundColor: surfaceMuted, borderColor, opacity: canEditItems ? 1 : 0.65 }]}>
                                  <ThemedText style={styles.selectorButtonText}>
                                    {item.uom || '选择录入单位'}
                                  </ThemedText>
                                </Pressable>
                                <ThemedText style={styles.selectorHint}>
                                  {item.stockUom && item.uom && item.stockUom !== item.uom
                                    ? `库存单位 ${formatDisplayUom(item.stockUom)}，系统会按换算关系计算入库量。`
                                    : item.stockUom
                                      ? `当前库存单位 ${formatDisplayUom(item.stockUom)}。`
                                      : '优先展示商品已配置单位。'}
                                </ThemedText>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        ) : (
          <View style={[styles.loadingCard, { backgroundColor: surface, borderColor }]}>
            <ThemedText type="defaultSemiBold">没有读取到采购订单</ThemedText>
            <ThemedText>请确认采购订单是否存在，或稍后重试。</ThemedText>
          </View>
        )}
      </ScrollView>

      <Modal animationType="slide" onRequestClose={closePicker} transparent visible={pickerVisible}>
        <View style={styles.modalBackdrop}>
          <Pressable onPress={closePicker} style={StyleSheet.absoluteFill} />
          <View style={[styles.modalSheet, { backgroundColor: surface }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle} type="title">
                {pickerTarget?.field === 'warehouse' ? '选择入库仓库' : '选择录入单位'}
              </ThemedText>
              <ThemedText style={styles.modalHint}>
                {pickerTarget?.field === 'warehouse'
                  ? `仅显示公司 ${detail?.company || ''} 下的仓库。`
                  : '优先显示商品已配置单位。'}
              </ThemedText>
            </View>
            <View style={[styles.modalSearchWrap, { backgroundColor: surfaceMuted, borderColor }]}>
              <TextInput
                onChangeText={setPickerQuery}
                placeholder={pickerTarget?.field === 'warehouse' ? '搜索仓库名称' : '搜索单位名称'}
                placeholderTextColor="rgba(31,42,55,0.38)"
                style={styles.modalSearchInput}
                value={pickerQuery}
              />
            </View>
            <ScrollView contentContainerStyle={styles.modalList} showsVerticalScrollIndicator={false}>
              {pickerLoading ? (
                <View style={[styles.emptyState, { backgroundColor: surfaceMuted }]}>
                  <ThemedText type="defaultSemiBold">正在读取候选项...</ThemedText>
                </View>
              ) : pickerOptions.length ? (
                <View style={styles.modalSection}>
                  {pickerOptions.map((option) => {
                    const active =
                      pickerTarget && pickerItem
                        ? (pickerTarget.field === 'warehouse' ? pickerItem.warehouse : pickerItem.uom) === option.value
                        : false;

                    return (
                      <Pressable
                        key={`${option.value}-${option.label}`}
                        onPress={() => handleSelectPickerValue(option.value)}
                        style={[
                          styles.modalOption,
                          { backgroundColor: active ? 'rgba(59,130,246,0.08)' : surfaceMuted, borderColor },
                        ]}>
                        <View style={styles.modalOptionCopy}>
                          <ThemedText numberOfLines={1} type="defaultSemiBold">
                            {option.label}
                          </ThemedText>
                          {option.description ? (
                            <ThemedText style={styles.modalOptionMeta}>{option.description}</ThemedText>
                          ) : null}
                        </View>
                        <ThemedText style={{ color: tintColor }} type="defaultSemiBold">
                          {active ? '当前' : '选择'}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <View style={[styles.emptyState, { backgroundColor: surfaceMuted }]}>
                  <ThemedText type="defaultSemiBold">没有找到匹配项</ThemedText>
                  <ThemedText>换个关键词试试。</ThemedText>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </AppShell>
  );
}

function MetaBlock({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaBlock}>
      <ThemedText style={styles.metaLabel}>{label}</ThemedText>
      <ThemedText style={styles.metaValue} type="defaultSemiBold">
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    paddingBottom: 28,
  },
  loadingCard: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    gap: 10,
    padding: 20,
  },
  heroCard: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  heroHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  heroCopy: {
    flex: 1,
    gap: 4,
  },
  heroTitle: {
    fontSize: 22,
  },
  heroSubline: {
    color: '#64748B',
  },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metaBlock: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    flexBasis: '48%',
    gap: 4,
    padding: 12,
  },
  metaLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  metaValue: {
    fontSize: 15,
  },
  noticeCard: {
    borderRadius: 16,
    gap: 6,
    padding: 14,
  },
  noticeTitle: {
    fontSize: 14,
  },
  noticeText: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 19,
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 18,
  },
  sectionHint: {
    fontSize: 13,
  },
  fieldBlock: {
    gap: 8,
  },
  inlineGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  inlineField: {
    flex: 1,
    gap: 8,
  },
  fieldLabel: {
    fontSize: 14,
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  textarea: {
    minHeight: 94,
    textAlignVertical: 'top',
  },
  readonlyField: {
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 14,
  },
  groupList: {
    gap: 12,
  },
  groupCard: {
    borderRadius: 20,
    gap: 12,
    padding: 14,
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
  thumbWrap: {
    alignItems: 'center',
    borderRadius: 18,
    height: 52,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 52,
  },
  thumbImage: {
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
  actionButton: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    borderRadius: 16,
    flex: 1,
    gap: 4,
    padding: 12,
  },
  metricLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  metricValue: {
    fontSize: 15,
  },
  rowList: {
    gap: 10,
  },
  rowCard: {
    borderRadius: 18,
    gap: 12,
    padding: 14,
  },
  rowDivider: {
    borderTopWidth: 1,
  },
  rowHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  rowHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  rowBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  rowBadgeText: {
    color: '#2563EB',
    fontSize: 12,
  },
  rowMeta: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
  },
  removeButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  removeButtonText: {
    color: '#DC2626',
    fontSize: 12,
  },
  inventoryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inventoryCard: {
    borderRadius: 14,
    flex: 1,
    gap: 4,
    padding: 12,
  },
  inventoryLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  inventoryValue: {
    fontSize: 14,
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
  selectorHint: {
    color: '#71859D',
    fontSize: 13,
    lineHeight: 18,
    paddingLeft: 4,
  },
  footerButton: {
    alignItems: 'center',
    borderRadius: 16,
    justifyContent: 'center',
    minHeight: 52,
  },
  footerButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
  },
  modalBackdrop: {
    backgroundColor: 'rgba(15,23,42,0.22)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 14,
    maxHeight: '72%',
    paddingBottom: 24,
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  modalHandle: {
    alignSelf: 'center',
    backgroundColor: '#CBD5E1',
    borderRadius: 999,
    height: 5,
    width: 44,
  },
  modalHeader: {
    gap: 6,
  },
  modalTitle: {
    fontSize: 20,
  },
  modalHint: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 19,
  },
  modalSearchWrap: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  modalSearchInput: {
    fontSize: 15,
    minHeight: 48,
  },
  modalList: {
    gap: 12,
    paddingBottom: 8,
  },
  modalSection: {
    gap: 10,
  },
  modalOption: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  modalOptionCopy: {
    flex: 1,
    gap: 2,
  },
  modalOptionMeta: {
    color: '#71859D',
    fontSize: 13,
    lineHeight: 18,
  },
  emptyState: {
    borderRadius: 18,
    gap: 6,
    padding: 16,
  },
});
