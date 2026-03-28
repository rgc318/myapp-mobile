import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Image } from 'expo-image';

import { LinkOptionInput } from '@/components/link-option-input';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { WorkflowQuickNav } from '@/components/workflow-quick-nav';
import { useThemeColor } from '@/hooks/use-theme-color';
import { normalizeAppError } from '@/lib/app-error';
import { getAppPreferences } from '@/lib/app-preferences';
import { formatDisplayUom } from '@/lib/display-uom';
import {
  clearPurchaseOrderDraft,
  getPurchaseOrderDraft,
  removePurchaseOrderDraftItem,
  replacePurchaseOrderDraft,
  type PurchaseOrderDraftItem,
} from '@/lib/purchase-order-draft';
import { convertQtyToStockQty, formatConvertedQty } from '@/lib/uom-conversion';
import { useFeedback } from '@/providers/feedback-provider';
import { searchLinkOptions } from '@/services/master-data';
import { fetchProductDetail } from '@/services/products';
import {
  companyExists,
  fetchSupplierPurchaseContext,
  getWarehouseCompany,
  searchCompanies,
  searchWarehouses,
  searchSuppliers,
  submitPurchaseOrder,
  supplierExists,
  warehouseExists,
  type PurchaseOrderItemInput,
  type SupplierPurchaseContext,
} from '@/services/purchases';

function normalizeOptionalText(value: string) {
  const trimmed = value.trim();
  return trimmed || '';
}

function normalizePositiveNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function buildDraftId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatQty(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }

  return formatConvertedQty(value);
}

function getAvailableUoms(item: PurchaseOrderDraftItem) {
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

export default function PurchaseOrderCreateScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { supplier: supplierParam } = useLocalSearchParams<{ supplier?: string }>();
  const preferences = getAppPreferences();
  const { showError, showSuccess } = useFeedback();

  const [supplier, setSupplier] = useState(typeof supplierParam === 'string' ? supplierParam : '');
  const [company, setCompany] = useState(preferences.defaultCompany);
  const [remarks, setRemarks] = useState('');
  const [supplierRef, setSupplierRef] = useState('');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10));
  const [scheduleDate, setScheduleDate] = useState(new Date().toISOString().slice(0, 10));
  const [draftItems, setDraftItems] = useState<PurchaseOrderDraftItem[]>(() => getPurchaseOrderDraft());
  const [supplierContext, setSupplierContext] = useState<SupplierPurchaseContext | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [supplierError, setSupplierError] = useState('');
  const [companyError, setCompanyError] = useState('');
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<{ itemId: string; field: 'warehouse' | 'uom' } | null>(null);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerOptions, setPickerOptions] = useState<{ label: string; value: string; description?: string }[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const basicSectionYRef = useRef(0);
  const itemsSectionYRef = useRef(0);
  const hydratedDraftKeysRef = useRef<Record<string, true>>({});
  const warehouseCompanyCacheRef = useRef<Record<string, string | null>>({});

  const surface = useThemeColor({}, 'surface');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');
  const successColor = useThemeColor({}, 'success');

  useEffect(() => {
    if (typeof supplierParam === 'string' && supplierParam.trim()) {
      setSupplier(supplierParam.trim());
      setSupplierError('');
    }
  }, [supplierParam]);

  useEffect(() => {
    if (isFocused) {
      setDraftItems(getPurchaseOrderDraft());
    }
  }, [isFocused]);

  useEffect(() => {
    const activeKeys = new Set(
      draftItems
        .filter((item) => item.itemCode)
        .map((item) => `${item.id}::${company.trim()}::${item.warehouse.trim()}`),
    );

    Object.keys(hydratedDraftKeysRef.current).forEach((key) => {
      if (!activeKeys.has(key)) {
        delete hydratedDraftKeysRef.current[key];
      }
    });

    const missingMetadataItems = draftItems.filter(
      (item) =>
        item.itemCode &&
        !hydratedDraftKeysRef.current[`${item.id}::${company.trim()}::${item.warehouse.trim()}`] &&
        (!item.stockUom ||
          !item.allUoms?.length ||
          typeof item.totalQty !== 'number' ||
          !item.warehouseStockDetails?.length ||
          !item.imageUrl),
    );

    if (!missingMetadataItems.length) {
      return;
    }

    let active = true;

    missingMetadataItems.forEach((item) => {
      hydratedDraftKeysRef.current[`${item.id}::${company.trim()}::${item.warehouse.trim()}`] = true;
    });

    void Promise.all(
      missingMetadataItems.map(async (item) => {
        const detail = await fetchProductDetail(item.itemCode, {
          warehouse: item.warehouse || undefined,
          company: item.warehouse ? undefined : company || undefined,
        });
        if (!active || !detail) {
          return null;
        }

        return {
          id: item.id,
          detail,
        };
      }),
    ).then((results) => {
      if (!active) {
        return;
      }

      const detailMap = new Map(results.filter(Boolean).map((entry) => [entry.id, entry.detail]));
      if (!detailMap.size) {
        return;
      }

      setDraftItems((currentItems) => {
        const nextItems = currentItems.map((item) => {
          const detail = detailMap.get(item.id);
          if (!detail) {
            return item;
          }

          return {
            ...item,
            imageUrl: item.imageUrl || detail.imageUrl || null,
            stockUom: item.stockUom || detail.stockUom || null,
            totalQty: typeof detail.totalQty === 'number' ? detail.totalQty : item.totalQty ?? null,
            allUoms: item.allUoms?.length ? item.allUoms : detail.allUoms,
            uomConversions: item.uomConversions?.length ? item.uomConversions : detail.uomConversions,
            warehouseStockDetails: item.warehouseStockDetails?.length
              ? item.warehouseStockDetails
              : detail.warehouseStockDetails,
          };
        });
        const changed = JSON.stringify(nextItems) !== JSON.stringify(currentItems);
        if (!changed) {
          return currentItems;
        }
        replacePurchaseOrderDraft(nextItems);
        return nextItems;
      });
    });

    return () => {
      active = false;
    };
  }, [company, draftItems]);

  useEffect(() => {
    const trimmedSupplier = supplier.trim();
    if (!trimmedSupplier) {
      setSupplierContext(null);
      return;
    }

    let cancelled = false;
    setIsLoadingContext(true);
    fetchSupplierPurchaseContext(trimmedSupplier)
      .then((context) => {
        if (cancelled) {
          return;
        }
        setSupplierContext(context);
        if (context?.suggestions.company && !company.trim()) {
          setCompany(context.suggestions.company);
        }
        if (context?.suggestions.company && company === preferences.defaultCompany) {
          setCompany(context.suggestions.company);
        }
        if (context?.suggestions.warehouse) {
          setDraftItems((currentItems) => {
            const nextItems = currentItems.map((item) =>
              item.warehouse.trim() ? item : { ...item, warehouse: context.suggestions.warehouse || '' },
            );
            replacePurchaseOrderDraft(nextItems);
            return nextItems;
          });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setSupplierContext(null);
          showError(normalizeAppError(error).message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingContext(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [company, preferences.defaultCompany, showError, supplier]);

  const pickerItem = useMemo(
    () => (pickerTarget ? draftItems.find((item) => item.id === pickerTarget.itemId) ?? null : null),
    [draftItems, pickerTarget],
  );

  useEffect(() => {
    const trimmedCompany = company.trim();
    const activeWarehouses = Array.from(
      new Set(
        draftItems
          .map((item) => item.warehouse.trim())
          .filter(Boolean),
      ),
    );

    Object.keys(warehouseCompanyCacheRef.current).forEach((warehouse) => {
      if (!activeWarehouses.includes(warehouse)) {
        delete warehouseCompanyCacheRef.current[warehouse];
      }
    });

    if (!trimmedCompany || !activeWarehouses.length) {
      return;
    }

    let active = true;
    const unresolvedWarehouses = activeWarehouses.filter(
      (warehouse) => typeof warehouseCompanyCacheRef.current[warehouse] === 'undefined',
    );

    const validateDraftWarehouses = () => {
      const invalidWarehouses = activeWarehouses.filter((warehouse) => {
        const warehouseCompany = warehouseCompanyCacheRef.current[warehouse];
        return Boolean(warehouseCompany && warehouseCompany !== trimmedCompany);
      });

      if (!invalidWarehouses.length) {
        return;
      }

      setDraftItems((currentItems) => {
        let changed = false;
        const invalidSet = new Set(invalidWarehouses);
        const nextItems = currentItems.map((item) => {
          if (invalidSet.has(item.warehouse.trim())) {
            changed = true;
            return { ...item, warehouse: '' };
          }
          return item;
        });

        if (!changed) {
          return currentItems;
        }

        replacePurchaseOrderDraft(nextItems);
        return nextItems;
      });

      showError(`已清除不属于当前公司 ${trimmedCompany} 的仓库，请重新选择。`);
    };

    if (!unresolvedWarehouses.length) {
      validateDraftWarehouses();
      return;
    }

    void Promise.all(
      unresolvedWarehouses.map(async (warehouse) => ({
        warehouse,
        company: await getWarehouseCompany(warehouse),
      })),
    ).then((rows) => {
      if (!active) {
        return;
      }

      rows.forEach(({ warehouse, company: warehouseCompany }) => {
        warehouseCompanyCacheRef.current[warehouse] = warehouseCompany;
      });

      validateDraftWarehouses();
    });

    return () => {
      active = false;
    };
  }, [company, draftItems, showError]);

  useEffect(() => {
    if (!pickerVisible || !pickerTarget || !pickerItem) {
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setPickerLoading(true);
      try {
        let nextOptions: { label: string; value: string; description?: string }[] = [];

        if (pickerTarget.field === 'warehouse') {
          nextOptions = await searchWarehouses(pickerQuery, company.trim() || undefined);
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

          nextOptions = localOptions.length
            ? localOptions
            : await searchLinkOptions('UOM', pickerQuery, ['uom_name']);
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
  }, [company, pickerItem, pickerQuery, pickerTarget, pickerVisible]);

  const validItems = useMemo(
    () =>
      draftItems
        .map((item): PurchaseOrderItemInput | null => {
          const itemCode = normalizeOptionalText(item.itemCode);
          const qty = normalizePositiveNumber(item.qty);
          if (!itemCode || qty === null) {
            return null;
          }
          const price =
            item.price.trim() && Number.isFinite(Number(item.price)) ? Number(item.price) : null;
          return {
            itemCode,
            qty,
            warehouse: normalizeOptionalText(item.warehouse),
            uom: normalizeOptionalText(item.uom),
            price,
          };
        })
        .filter((item): item is PurchaseOrderItemInput => Boolean(item)),
    [draftItems],
  );

  const groupedDraftItems = useMemo(() => {
    const groups = new Map<
      string,
      {
        itemCode: string;
        itemName: string;
        rows: PurchaseOrderDraftItem[];
      }
    >();

    draftItems.forEach((item) => {
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
  }, [draftItems]);

  const itemCount = validItems.length;
  const totalQty = validItems.reduce((sum, item) => sum + item.qty, 0);

  const scrollToSection = (y: number) => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: Math.max(y - 16, 0), animated: true });
    });
  };

  const handleItemChange = (itemId: string, field: keyof PurchaseOrderDraftItem, value: string) => {
    setDraftItems((currentItems) => {
      const nextItems = currentItems.map((item) => (item.id === itemId ? { ...item, [field]: value } : item));
      replacePurchaseOrderDraft(nextItems);
      return nextItems;
    });
  };

  const handleAddItem = () => {
    router.push({
      pathname: '/purchase/order/item-search',
      params: {
        company,
        warehouse: supplierContext?.suggestions.warehouse || preferences.defaultWarehouse,
      },
    });
  };

  const handleRemoveItem = (itemId: string) => {
    removePurchaseOrderDraftItem(itemId);
    setDraftItems(getPurchaseOrderDraft());
  };

  const closePicker = () => {
    setPickerVisible(false);
    setPickerTarget(null);
    setPickerQuery('');
    setPickerOptions([]);
    setPickerLoading(false);
  };

  const openPicker = (itemId: string, field: 'warehouse' | 'uom') => {
    setPickerTarget({ itemId, field });
    setPickerVisible(true);
    setPickerQuery('');
  };

  const handleSelectPickerValue = (value: string) => {
    if (!pickerTarget) {
      return;
    }
    handleItemChange(pickerTarget.itemId, pickerTarget.field, value);
    closePicker();
  };

  const handleAddWarehouseRow = (rows: PurchaseOrderDraftItem[]) => {
    const baseRow = rows[0];
    const nextItems = [
      ...draftItems,
      {
        id: buildDraftId(),
        itemCode: baseRow.itemCode,
        itemName: baseRow.itemName,
        imageUrl: baseRow.imageUrl ?? null,
        qty: '1',
        price: baseRow.price,
        warehouse: supplierContext?.suggestions.warehouse || preferences.defaultWarehouse || '',
        uom: baseRow.uom,
        stockUom: baseRow.stockUom ?? null,
        totalQty: baseRow.totalQty ?? null,
        allUoms: baseRow.allUoms ?? [],
        uomConversions: baseRow.uomConversions ?? [],
        warehouseStockDetails: baseRow.warehouseStockDetails ?? [],
      },
    ];
    replacePurchaseOrderDraft(nextItems);
    setDraftItems(nextItems);
  };

  const handleSubmit = async () => {
    const trimmedSupplier = supplier.trim();
    const trimmedCompany = company.trim();
    let firstInvalidSection: 'basic' | 'items' | null = null;

    setSupplierError('');
    setCompanyError('');

    if (!trimmedSupplier) {
      setSupplierError('请先选择供应商。');
      firstInvalidSection ??= 'basic';
    }

    if (!trimmedCompany) {
      setCompanyError('请先填写公司。');
      firstInvalidSection ??= 'basic';
    }

    if (!validItems.length) {
      firstInvalidSection ??= 'items';
    }

    if (firstInvalidSection) {
      showError(firstInvalidSection === 'basic' ? '请先完善主体信息。' : '请至少填写一条有效的采购商品。');
      scrollToSection(firstInvalidSection === 'basic' ? basicSectionYRef.current : itemsSectionYRef.current);
      return;
    }

    try {
      setIsSubmitting(true);

      const [supplierOk, companyOk] = await Promise.all([
        supplierExists(trimmedSupplier),
        companyExists(trimmedCompany),
      ]);

      if (!supplierOk) {
        setSupplierError('当前供应商不存在，请重新选择。');
        scrollToSection(basicSectionYRef.current);
        return;
      }

      if (!companyOk) {
        setCompanyError('当前公司不存在，请重新填写。');
        scrollToSection(basicSectionYRef.current);
        return;
      }

      const warehouses = await Promise.all(
        validItems
          .map((item) => item.warehouse?.trim())
          .filter(Boolean)
          .map((warehouse) => warehouseExists(warehouse as string)),
      );

      if (warehouses.includes(false)) {
        showError('有采购明细使用了不存在的仓库，请检查后再提交。');
        return;
      }

      const orderName = await submitPurchaseOrder({
        supplier: trimmedSupplier,
        company: trimmedCompany,
        items: validItems,
        transactionDate,
        scheduleDate,
        defaultWarehouse: preferences.defaultWarehouse,
        currency: supplierContext?.suggestions.currency ?? supplierContext?.supplier.defaultCurrency ?? null,
        supplierRef,
        remarks,
      });

      if (!orderName) {
        throw new Error('采购订单创建成功，但未返回订单号。');
      }

      showSuccess(`采购订单 ${orderName} 已创建。`);
      clearPurchaseOrderDraft();
      router.replace({
        pathname: '/purchase/order/[orderName]',
        params: { orderName },
      });
    } catch (error) {
      showError(normalizeAppError(error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const returnToPurchaseHome = () => {
    router.replace('/(tabs)/purchase');
  };

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.scrollContent} ref={scrollRef}>
        <View style={styles.topBar}>
          <Pressable onPress={returnToPurchaseHome} style={styles.iconCircle}>
            <IconSymbol color="#111827" name="chevron.left" size={20} />
          </Pressable>

          <ThemedText style={styles.topTitle} type="title">
            采购下单
          </ThemedText>

          <Pressable
            onPress={() =>
              router.push({
                pathname: '/common/supplier-select',
                params: { returnTo: '/purchase/order/create' },
              })
            }
            style={styles.topAction}>
            <ThemedText style={{ color: tintColor }} type="defaultSemiBold">
              选供应商
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.quickNavWrap}>
          <WorkflowQuickNav compact />
        </View>

        <View style={[styles.heroCard, { backgroundColor: surface, borderColor }]}>
          <View style={styles.heroHeader}>
            <View style={styles.heroCopy}>
              <ThemedText style={styles.heroEyebrow}>PURCHASE ORDER</ThemedText>
              <ThemedText style={styles.heroTitle} type="title">
                新建采购订单
              </ThemedText>
              <ThemedText style={styles.heroSubtitle}>
                先完成主体信息，再录入采购商品和入库分配。
              </ThemedText>
            </View>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/common/supplier-select',
                  params: { returnTo: '/purchase/order/create' },
                })
              }
              style={[styles.heroAction, { backgroundColor: surfaceMuted }]}>
              <ThemedText style={[styles.heroActionText, { color: tintColor }]} type="defaultSemiBold">
                选供应商
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.heroStatGrid}>
            <View style={[styles.metricCard, { backgroundColor: surfaceMuted }]}>
              <ThemedText style={styles.metricLabel}>有效明细</ThemedText>
              <ThemedText style={styles.metricValue} type="defaultSemiBold">
                {itemCount}
              </ThemedText>
            </View>
            <View style={[styles.metricCard, { backgroundColor: surfaceMuted }]}>
              <ThemedText style={styles.metricLabel}>计划采购数量</ThemedText>
              <ThemedText style={styles.metricValue} type="defaultSemiBold">
                {totalQty}
              </ThemedText>
            </View>
            <View style={[styles.metricCard, { backgroundColor: surfaceMuted }]}>
              <ThemedText style={styles.metricLabel}>计划到货</ThemedText>
              <ThemedText style={styles.metricValueSmall} type="defaultSemiBold">
                {scheduleDate || '未设置'}
              </ThemedText>
            </View>
          </View>

          <ThemedText style={styles.heroSummaryText}>
            {supplier.trim()
              ? `当前供应商 ${supplier.trim()}，公司 ${company.trim() || '未填写'}。`
              : '先在下方选择供应商和公司，再继续录入采购商品。'}
          </ThemedText>
        </View>

        <View
          onLayout={(event) => {
            basicSectionYRef.current = event.nativeEvent.layout.y;
          }}
          style={[styles.card, styles.itemsCard, { backgroundColor: surface, borderColor }]}>
          <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle} type="defaultSemiBold">
              基本信息
            </ThemedText>
            <ThemedText style={[styles.sectionHint, { color: tintColor }]} type="defaultSemiBold">
              先定主体
            </ThemedText>
          </View>

          <LinkOptionInput
            errorText={supplierError}
            label="供应商"
            loadOptions={searchSuppliers}
            onChangeText={(value) => {
              setSupplier(value);
              if (supplierError) {
                setSupplierError('');
              }
            }}
            placeholder="搜索供应商"
            value={supplier}
          />

          <LinkOptionInput
            errorText={companyError}
            helperText="建议使用当前账号默认公司，或沿用供应商上下文建议值。"
            label="公司"
            loadOptions={searchCompanies}
            onChangeText={(value) => {
              setCompany(value);
              if (companyError) {
                setCompanyError('');
              }
            }}
            placeholder="搜索公司"
            value={company}
          />

          <View style={styles.dateGrid}>
            <View style={styles.dateBlock}>
              <ThemedText style={styles.fieldLabel} type="defaultSemiBold">
                下单日期
              </ThemedText>
              <TextInput
                onChangeText={setTransactionDate}
                placeholder="YYYY-MM-DD"
                style={[styles.input, { backgroundColor: surfaceMuted, borderColor }]}
                value={transactionDate}
              />
            </View>
            <View style={styles.dateBlock}>
              <ThemedText style={styles.fieldLabel} type="defaultSemiBold">
                计划到货
              </ThemedText>
              <TextInput
                onChangeText={setScheduleDate}
                placeholder="YYYY-MM-DD"
                style={[styles.input, { backgroundColor: surfaceMuted, borderColor }]}
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
            <View style={[styles.sectionAccent, { backgroundColor: tintColor }]} />
            <View style={styles.sectionHeaderCopy}>
              <ThemedText style={styles.cardTitle} type="defaultSemiBold">
                采购商品
              </ThemedText>
              <ThemedText style={styles.sectionHintText}>商品明细决定本次采购数量与入库分配</ThemedText>
            </View>
            <Pressable onPress={handleAddItem}>
              <ThemedText style={[styles.textAction, { color: tintColor }]} type="defaultSemiBold">
                选择商品
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.itemList}>
            {groupedDraftItems.length ? (
              groupedDraftItems.map((group, groupIndex) => {
                const groupLeadRow = group.rows[0];
                const groupStockUom = groupLeadRow.stockUom || groupLeadRow.uom || '';
                const groupIncomingQty = group.rows.reduce((sum, row) => {
                  const qty = Number(row.qty);
                  if (!Number.isFinite(qty)) {
                    return sum;
                  }
                  const converted =
                    convertQtyToStockQty({
                      qty,
                      uom: row.uom || groupStockUom,
                      stockUom: groupLeadRow.stockUom || groupStockUom,
                      uomConversions: row.uomConversions ?? groupLeadRow.uomConversions,
                    }) ?? qty;
                  return sum + converted;
                }, 0);
                const projectedTotal =
                  typeof groupLeadRow.totalQty === 'number' ? groupLeadRow.totalQty + groupIncomingQty : null;

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
                        {groupLeadRow.imageUrl ? (
                          <Image contentFit="cover" source={groupLeadRow.imageUrl} style={styles.groupThumbImage} />
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
                    <View style={styles.groupActions}>
                      {group.rows.length === 1 ? (
                        <Pressable
                          onPress={() =>
                            router.push({
                              pathname: '/purchase/order/item-search',
                              params: {
                                lineId: group.rows[0].id,
                                company,
                                warehouse:
                                  group.rows[0].warehouse ||
                                  supplierContext?.suggestions.warehouse ||
                                  preferences.defaultWarehouse,
                              },
                            })
                          }
                          style={[styles.groupActionButton, { backgroundColor: surface, borderColor }]}>
                          <ThemedText style={[styles.groupActionText, { color: tintColor }]} type="defaultSemiBold">
                            更换商品
                          </ThemedText>
                        </Pressable>
                      ) : null}
                      <Pressable
                        onPress={() => handleAddWarehouseRow(group.rows)}
                        style={[styles.groupActionButton, { backgroundColor: surface, borderColor }]}>
                        <ThemedText style={[styles.groupActionText, { color: tintColor }]} type="defaultSemiBold">
                          新增仓库行
                        </ThemedText>
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.groupMetricRow}>
                    <View style={[styles.groupMetricCard, { backgroundColor: surface }]}>
                      <ThemedText style={styles.groupMetricLabel}>总库存</ThemedText>
                      <ThemedText style={styles.groupMetricValue} type="defaultSemiBold">
                        {formatQty(groupLeadRow.totalQty)} {groupStockUom ? formatDisplayUom(groupStockUom) : ''}
                      </ThemedText>
                    </View>
                    <View style={[styles.groupMetricCard, { backgroundColor: surface }]}>
                      <ThemedText style={styles.groupMetricLabel}>本次入库后</ThemedText>
                      <ThemedText style={styles.groupMetricValue} type="defaultSemiBold">
                        {formatQty(projectedTotal)} {groupStockUom ? formatDisplayUom(groupStockUom) : ''}
                      </ThemedText>
                    </View>
                  </View>

                  <View style={[styles.groupNotice, { backgroundColor: surface }]}>
                    <ThemedText style={styles.groupHint}>同商品多仓入库时，在这里继续拆分仓库子行。</ThemedText>
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
                            <View style={styles.subRowBadge}>
                              <ThemedText style={styles.subRowBadgeText} type="defaultSemiBold">
                                仓库分配 {rowIndex + 1}
                              </ThemedText>
                            </View>
                            <ThemedText style={styles.subRowMeta}>这一行会生成一条采购明细，适合拆分到不同仓库。</ThemedText>
                          </View>
                          <Pressable onPress={() => handleRemoveItem(item.id)} style={[styles.subRowRemove, { borderColor }]}>
                            <ThemedText style={styles.subRowRemoveText} type="defaultSemiBold">
                              删除
                            </ThemedText>
                          </Pressable>
                        </View>

                        <View style={styles.subRowInventoryRow}>
                          <View style={[styles.subRowInventoryCard, { backgroundColor: surfaceMuted }]}>
                            <ThemedText style={styles.subRowInventoryLabel}>当前仓库库存</ThemedText>
                            <ThemedText style={styles.subRowInventoryValue} type="defaultSemiBold">
                              {formatQty(currentWarehouseStock)} {item.stockUom ? formatDisplayUom(item.stockUom) : ''}
                            </ThemedText>
                          </View>
                          <View style={[styles.subRowInventoryCard, { backgroundColor: surfaceMuted }]}>
                            <ThemedText style={styles.subRowInventoryLabel}>入库后库存</ThemedText>
                            <ThemedText style={styles.subRowInventoryValue} type="defaultSemiBold">
                              {formatQty(projectedWarehouseStock)} {item.stockUom ? formatDisplayUom(item.stockUom) : ''}
                            </ThemedText>
                          </View>
                        </View>

                        <View style={styles.subRowGrid}>
                          <View style={styles.subRowField}>
                            <ThemedText style={styles.fieldLabel} type="defaultSemiBold">
                              数量
                            </ThemedText>
                            <TextInput
                              keyboardType="decimal-pad"
                              onChangeText={(value) => handleItemChange(item.id, 'qty', value)}
                              placeholder="数量"
                              style={[styles.input, { backgroundColor: surfaceMuted, borderColor }]}
                              value={item.qty}
                            />
                          </View>
                          <View style={styles.subRowField}>
                            <ThemedText style={styles.fieldLabel} type="defaultSemiBold">
                              实际采购价
                            </ThemedText>
                            <TextInput
                              keyboardType="decimal-pad"
                              onChangeText={(value) => handleItemChange(item.id, 'price', value)}
                              placeholder="留空则沿用默认采购价"
                              style={[styles.input, { backgroundColor: surfaceMuted, borderColor }]}
                              value={item.price}
                            />
                          </View>
                        </View>

                        <View style={styles.subRowField}>
                          <ThemedText style={styles.fieldLabel} type="defaultSemiBold">
                            入库仓库
                          </ThemedText>
                          <Pressable
                            onPress={() => openPicker(item.id, 'warehouse')}
                            style={[styles.selectorButton, { backgroundColor: surfaceMuted, borderColor }]}>
                            <ThemedText style={styles.selectorButtonText}>
                              {item.warehouse || '选择入库仓库'}
                            </ThemedText>
                          </Pressable>
                          <ThemedText style={styles.selectorHint}>
                            未填写时会优先尝试使用供应商建议仓库或你的默认仓库。
                          </ThemedText>
                        </View>

                        <View style={styles.subRowField}>
                          <ThemedText style={styles.fieldLabel} type="defaultSemiBold">
                            单位
                          </ThemedText>
                          <Pressable
                            onPress={() => openPicker(item.id, 'uom')}
                            style={[styles.selectorButton, { backgroundColor: surfaceMuted, borderColor }]}>
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
                    )})}
                  </View>
                </View>
              )})
            ) : (
              <View style={[styles.emptyState, { backgroundColor: surfaceMuted }]}>
                <ThemedText type="defaultSemiBold">先从商品搜索页选择采购商品</ThemedText>
                <ThemedText>
                  选中商品后，这里会按商品分组展示，并在组内继续填写仓库、数量和采购价。
                </ThemedText>
                <Pressable
                  onPress={handleAddItem}
                  style={[styles.emptyActionButton, { backgroundColor: surface, borderColor }]}>
                  <ThemedText style={[styles.emptyActionText, { color: tintColor }]} type="defaultSemiBold">
                    去选择商品
                  </ThemedText>
                </Pressable>
              </View>
            )}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
          <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle} type="defaultSemiBold">
              供应商上下文
            </ThemedText>
            {isLoadingContext ? <ActivityIndicator color={tintColor} /> : null}
          </View>

          {supplierContext ? (
            <View style={styles.contextGrid}>
              <View style={[styles.contextBlock, { backgroundColor: surfaceMuted }]}>
                <ThemedText style={styles.contextLabel}>默认联系人</ThemedText>
                <ThemedText type="defaultSemiBold">
                  {supplierContext.defaultContact?.displayName || '未设置'}
                </ThemedText>
                {supplierContext.defaultContact?.phone ? (
                  <ThemedText>{supplierContext.defaultContact.phone}</ThemedText>
                ) : null}
              </View>
              <View style={[styles.contextBlock, { backgroundColor: surfaceMuted }]}>
                <ThemedText style={styles.contextLabel}>默认地址</ThemedText>
                <ThemedText numberOfLines={3} type="defaultSemiBold">
                  {supplierContext.defaultAddress?.addressDisplay || '未设置'}
                </ThemedText>
              </View>
              <View style={[styles.contextBlock, { backgroundColor: surfaceMuted }]}>
                <ThemedText style={styles.contextLabel}>建议公司 / 仓库</ThemedText>
                <ThemedText type="defaultSemiBold">
                  {supplierContext.suggestions.company || '未建议'}
                </ThemedText>
                <ThemedText>{supplierContext.suggestions.warehouse || '未建议仓库'}</ThemedText>
              </View>
              <View style={[styles.contextBlock, { backgroundColor: surfaceMuted }]}>
                <ThemedText style={styles.contextLabel}>最近采购地址</ThemedText>
                <ThemedText numberOfLines={3} type="defaultSemiBold">
                  {supplierContext.recentAddresses[0]?.addressDisplay || '暂无记录'}
                </ThemedText>
              </View>
            </View>
          ) : (
            <View style={[styles.emptyState, { backgroundColor: surfaceMuted }]}>
              <ThemedText type="defaultSemiBold">选择供应商后会自动读取默认信息</ThemedText>
              <ThemedText>这里会展示默认联系人、默认地址和建议仓库，方便你在下单后补充核对。</ThemedText>
            </View>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
          <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle} type="defaultSemiBold">
              提交前检查
            </ThemedText>
            <ThemedText style={[styles.summaryCount, { color: successColor }]} type="defaultSemiBold">
              {validItems.length} 条有效明细
            </ThemedText>
          </View>
          <ThemedText>
            当前会调用 `create_purchase_order`，创建并提交采购订单。后续收货、开票和付款将从采购订单详情页继续进入。
          </ThemedText>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <View style={[styles.bottomBar, { backgroundColor: surface, borderTopColor: borderColor }]}>
        <Pressable
          disabled={isSubmitting}
          onPress={handleSubmit}
          style={[
            styles.footerButton,
            { backgroundColor: isSubmitting ? surfaceMuted : tintColor },
          ]}>
          <ThemedText style={styles.footerButtonText} type="defaultSemiBold">
            {isSubmitting ? '正在提交采购订单...' : '提交采购订单'}
          </ThemedText>
        </Pressable>
      </View>

      <Modal animationType="slide" onRequestClose={closePicker} transparent visible={pickerVisible}>
        <View style={styles.modalBackdrop}>
          <Pressable onPress={closePicker} style={StyleSheet.absoluteFill} />
          <View style={[styles.modalSheet, { backgroundColor: surface }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle} type="title">
                {pickerTarget?.field === 'warehouse' ? '选择入库仓库' : '选择录入单位'}
              </ThemedText>
              <ThemedText style={styles.sectionHintText}>
                {pickerTarget?.field === 'warehouse' ? '选择这一行商品最终入库的仓库。' : '优先显示商品已配置单位。'}
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
                    const active = pickerTarget && pickerItem
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
                  <ThemedText type="defaultSemiBold">没有找到匹配选项</ThemedText>
                  <ThemedText>换个关键词试试。</ThemedText>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  scrollContent: {
    gap: 12,
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 12,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  iconCircle: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  topTitle: {
    fontSize: 18,
  },
  topAction: {
    alignItems: 'flex-end',
    minWidth: 72,
  },
  quickNavWrap: {
    marginBottom: 2,
  },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 16,
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
    gap: 6,
  },
  heroEyebrow: {
    color: '#2563EB',
    fontSize: 12,
    letterSpacing: 1.2,
  },
  heroTitle: {
    fontSize: 30,
    lineHeight: 36,
  },
  heroSubtitle: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 21,
  },
  heroAction: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroActionText: {
    fontSize: 13,
  },
  heroStatGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  heroSummaryText: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 20,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  sectionHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  sectionAccent: {
    alignSelf: 'stretch',
    borderRadius: 999,
    width: 4,
  },
  sectionHintText: {
    color: '#64748B',
    fontSize: 12,
  },
  cardTitle: {
    fontSize: 18,
    lineHeight: 24,
  },
  sectionBody: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 20,
  },
  sectionHint: {
    fontSize: 12,
  },
  textAction: {
    fontSize: 13,
  },
  dateGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  dateBlock: {
    flex: 1,
    gap: 8,
  },
  fieldBlock: {
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
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  textarea: {
    minHeight: 94,
    textAlignVertical: 'top',
  },
  contextGrid: {
    gap: 10,
  },
  contextBlock: {
    borderRadius: 18,
    gap: 6,
    padding: 14,
  },
  contextLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  metricCard: {
    borderRadius: 18,
    flex: 1,
    gap: 6,
    padding: 14,
  },
  metricLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  metricValue: {
    fontSize: 24,
    lineHeight: 28,
  },
  metricValueSmall: {
    fontSize: 15,
  },
  emptyState: {
    borderRadius: 18,
    gap: 8,
    padding: 16,
  },
  emptyActionButton: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 4,
    minHeight: 46,
    paddingHorizontal: 14,
  },
  emptyActionText: {
    fontSize: 14,
  },
  itemList: {
    gap: 12,
    zIndex: 1,
  },
  itemsCard: {
    overflow: 'visible',
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 16,
    position: 'relative',
    zIndex: 100,
  },
  groupBlock: {
    borderRadius: 18,
    gap: 12,
    padding: 14,
    zIndex: 5,
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
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    minWidth: 0,
  },
  groupThumbWrap: {
    alignItems: 'center',
    borderRadius: 16,
    height: 56,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 56,
  },
  groupThumbImage: {
    height: '100%',
    width: '100%',
  },
  groupCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  groupLabel: {
    color: '#2563EB',
    fontSize: 12,
  },
  groupTitle: {
    fontSize: 18,
    lineHeight: 24,
  },
  groupMeta: {
    color: '#64748B',
    fontSize: 12,
  },
  groupActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  groupActionButton: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  groupActionText: {
    fontSize: 13,
  },
  groupHint: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
  },
  groupMetricRow: {
    flexDirection: 'row',
    gap: 10,
  },
  groupMetricCard: {
    borderRadius: 14,
    flex: 1,
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  groupMetricLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  groupMetricValue: {
    fontSize: 15,
  },
  groupNotice: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  subRowList: {
    gap: 10,
    zIndex: 10,
  },
  subRowSection: {
    borderRadius: 16,
    gap: 12,
    padding: 12,
    zIndex: 20,
  },
  subRowSectionDivider: {
    borderTopWidth: 1,
    marginTop: 2,
  },
  subRowHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  subRowCopy: {
    flex: 1,
  },
  subRowBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E0EAFF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  subRowBadgeText: {
    color: '#2563EB',
    fontSize: 12,
  },
  subRowMeta: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  subRowInventoryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  subRowInventoryCard: {
    borderRadius: 14,
    flex: 1,
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  subRowInventoryLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  subRowInventoryValue: {
    fontSize: 14,
  },
  subRowRemove: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  subRowRemoveText: {
    color: '#DC2626',
    fontSize: 12,
  },
  subRowGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  subRowField: {
    flex: 1,
    gap: 8,
  },
  selectorButton: {
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 15,
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
  summaryCount: {
    fontSize: 13,
  },
  bottomSpacer: {
    height: 88,
  },
  bottomBar: {
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
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
    backgroundColor: 'rgba(15, 23, 42, 0.22)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 14,
    maxHeight: '72%',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 24,
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
});
