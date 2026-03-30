import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateFieldInput } from '@/components/date-field-input';
import { LinkOptionInput } from '@/components/link-option-input';
import { MobilePageHeader } from '@/components/mobile-page-header';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { normalizeAppError } from '@/lib/app-error';
import { getAppPreferences } from '@/lib/app-preferences';
import { getTodayIsoDate, isValidIsoDate } from '@/lib/date-value';
import { formatDisplayUom } from '@/lib/display-uom';
import {
  clearPurchaseOrderDraft,
  getPurchaseOrderDraft,
  getPurchaseOrderDraftForm,
  removePurchaseOrderDraftItem,
  replacePurchaseOrderDraft,
  updatePurchaseOrderDraftForm,
  type PurchaseOrderDraftItem,
} from '@/lib/purchase-order-draft';
import { convertQtyToStockQty, formatConvertedQty } from '@/lib/uom-conversion';
import { useFeedback } from '@/providers/feedback-provider';
import { searchLinkOptions } from '@/services/master-data';
import { fetchProductDetail } from '@/services/products';
import {
  companyExists,
  fetchPurchaseCompanyContext,
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

const DRAFT_METADATA_VERSION = 'purchase-buying-rate-v1';

function buildDraftMetadataKey(itemId: string, company: string, warehouse: string) {
  return `${DRAFT_METADATA_VERSION}::${itemId}::${company.trim()}::${warehouse.trim()}`;
}

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

function resolveFormDefaultWarehouse(
  draftForm: ReturnType<typeof getPurchaseOrderDraftForm>,
) {
  if (draftForm.defaultWarehouse.trim()) {
    return draftForm.defaultWarehouse;
  }

  if (draftForm.defaultWarehouseTouched) {
    return '';
  }

  return '';
}

export default function PurchaseOrderCreateScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { supplier: supplierParam, returnTo } = useLocalSearchParams<{ supplier?: string; returnTo?: string }>();
  const preferences = getAppPreferences();
  const { showError, showSuccess } = useFeedback();
  const initialDraftForm = getPurchaseOrderDraftForm();
  const today = getTodayIsoDate();

  const [supplier, setSupplier] = useState(
    typeof supplierParam === 'string' && supplierParam.trim() ? supplierParam : initialDraftForm.supplier,
  );
  const [company, setCompany] = useState(initialDraftForm.company || preferences.defaultCompany);
  const [remarks, setRemarks] = useState(initialDraftForm.remarks);
  const [supplierRef, setSupplierRef] = useState(initialDraftForm.supplierRef);
  const [transactionDate, setTransactionDate] = useState(
    initialDraftForm.transactionDate || today,
  );
  const [scheduleDate, setScheduleDate] = useState(
    initialDraftForm.scheduleDate || today,
  );
  const [defaultWarehouse, setDefaultWarehouse] = useState(
    resolveFormDefaultWarehouse(initialDraftForm),
  );
  const [defaultWarehouseTouched, setDefaultWarehouseTouched] = useState(initialDraftForm.defaultWarehouseTouched === true);
  const [draftItems, setDraftItems] = useState<PurchaseOrderDraftItem[]>(() => getPurchaseOrderDraft());
  const [supplierContext, setSupplierContext] = useState<SupplierPurchaseContext | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [supplierError, setSupplierError] = useState('');
  const [companyError, setCompanyError] = useState('');
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [showSupplierDetails, setShowSupplierDetails] = useState(false);
  const [expandedItemRows, setExpandedItemRows] = useState<Record<string, boolean>>({});
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
  const allowLeaveRef = useRef(false);
  const pendingNavigationActionRef = useRef<any>(null);

  const surface = useThemeColor({}, 'surface');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');

  useEffect(() => {
    if (typeof supplierParam === 'string' && supplierParam.trim()) {
      setSupplier(supplierParam.trim());
      setSupplierError('');
    }
  }, [supplierParam]);

  useEffect(() => {
    const trimmedDefaultWarehouse = defaultWarehouse.trim();
    if (!trimmedDefaultWarehouse || !draftItems.some((item) => !item.warehouse.trim())) {
      return;
    }

    setDraftItems((currentItems) => {
      let changed = false;
      const nextItems = currentItems.map((item) => {
        if (item.warehouse.trim()) {
          return item;
        }
        changed = true;
        return { ...item, warehouse: trimmedDefaultWarehouse };
      });

      if (!changed) {
        return currentItems;
      }

      replacePurchaseOrderDraft(nextItems);
      return nextItems;
    });
  }, [defaultWarehouse, draftItems]);

  useEffect(() => {
    if (isFocused) {
      setDraftItems(getPurchaseOrderDraft());
      const nextDraftForm = getPurchaseOrderDraftForm();
      setSupplier(
        typeof supplierParam === 'string' && supplierParam.trim() ? supplierParam.trim() : nextDraftForm.supplier,
      );
      setCompany(nextDraftForm.company || preferences.defaultCompany);
      setRemarks(nextDraftForm.remarks);
      setSupplierRef(nextDraftForm.supplierRef);
      setTransactionDate(nextDraftForm.transactionDate || today);
      setScheduleDate(nextDraftForm.scheduleDate || today);
      setDefaultWarehouse(resolveFormDefaultWarehouse(nextDraftForm));
      setDefaultWarehouseTouched(nextDraftForm.defaultWarehouseTouched === true);
    }
  }, [isFocused, preferences.defaultCompany, supplierParam, today]);

  useEffect(() => {
    const trimmedCompany = company.trim();

    if (!trimmedCompany) {
      if (!defaultWarehouseTouched) {
        setDefaultWarehouse('');
      }
      return;
    }

    let cancelled = false;

    fetchPurchaseCompanyContext(trimmedCompany)
      .then((context) => {
        if (cancelled || defaultWarehouseTouched) {
          return;
        }

        setDefaultWarehouse(context?.warehouse?.trim() || '');
      })
      .catch(() => {
        if (!cancelled && !defaultWarehouseTouched) {
          setDefaultWarehouse('');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [company, defaultWarehouseTouched]);

  useEffect(() => {
    updatePurchaseOrderDraftForm({
      supplier,
      company,
      remarks,
      supplierRef,
      transactionDate,
      scheduleDate,
      defaultWarehouse,
      defaultWarehouseTouched,
    });
  }, [company, defaultWarehouse, defaultWarehouseTouched, remarks, scheduleDate, supplier, supplierRef, transactionDate]);

  useEffect(() => {
    const activeKeys = new Set(
      draftItems
        .filter((item) => item.itemCode)
        .map((item) => buildDraftMetadataKey(item.id, company, item.warehouse)),
    );

    Object.keys(hydratedDraftKeysRef.current).forEach((key) => {
      if (!activeKeys.has(key)) {
        delete hydratedDraftKeysRef.current[key];
      }
    });

    const missingMetadataItems = draftItems.filter(
      (item) =>
        item.itemCode &&
        !hydratedDraftKeysRef.current[buildDraftMetadataKey(item.id, company, item.warehouse)] &&
        (!item.stockUom ||
          !item.allUoms?.length ||
          typeof item.totalQty !== 'number' ||
          !item.warehouseStockDetails?.length ||
          !item.imageUrl ||
          typeof item.standardBuyingRate !== 'number'),
    );

    if (!missingMetadataItems.length) {
      return;
    }

    let active = true;

    missingMetadataItems.forEach((item) => {
      hydratedDraftKeysRef.current[buildDraftMetadataKey(item.id, company, item.warehouse)] = true;
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
            standardBuyingRate:
              typeof item.standardBuyingRate === 'number'
                ? item.standardBuyingRate
                : detail.priceSummary?.standardBuyingRate ?? null,
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
    fetchSupplierPurchaseContext(trimmedSupplier, company.trim() || undefined)
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
        if (context?.suggestions.warehouse && !defaultWarehouseTouched) {
          setDefaultWarehouse((current) => current.trim() || context.suggestions.warehouse || '');
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
  }, [company, defaultWarehouseTouched, preferences.defaultCompany, showError, supplier]);

  const pickerItem = useMemo(
    () => (pickerTarget ? draftItems.find((item) => item.id === pickerTarget.itemId) ?? null : null),
    [draftItems, pickerTarget],
  );

  useEffect(() => {
    const trimmedCompany = company.trim();
    const warehouseCandidates = Array.from(
      new Set(
        [
          defaultWarehouse.trim(),
          ...draftItems.map((item) => item.warehouse.trim()),
        ].filter(Boolean),
      ),
    );

    Object.keys(warehouseCompanyCacheRef.current).forEach((warehouse) => {
      if (!warehouseCandidates.includes(warehouse)) {
        delete warehouseCompanyCacheRef.current[warehouse];
      }
    });

    if (!trimmedCompany || !warehouseCandidates.length) {
      return;
    }

    let active = true;
    const unresolvedWarehouses = warehouseCandidates.filter(
      (warehouse) => typeof warehouseCompanyCacheRef.current[warehouse] === 'undefined',
    );

    const validateDraftWarehouses = () => {
      const invalidWarehouses = warehouseCandidates.filter((warehouse) => {
        const warehouseCompany = warehouseCompanyCacheRef.current[warehouse];
        return Boolean(warehouseCompany && warehouseCompany !== trimmedCompany);
      });

      if (!invalidWarehouses.length) {
        return;
      }

      const invalidSet = new Set(invalidWarehouses);
      const shouldClearDefaultWarehouse = invalidSet.has(defaultWarehouse.trim());

      if (shouldClearDefaultWarehouse) {
        setDefaultWarehouse('');
        setDefaultWarehouseTouched(true);
      }

      setDraftItems((currentItems) => {
        let changed = false;
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
  }, [company, defaultWarehouse, draftItems, showError]);

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
                pickerItem.stockUom && uom === pickerItem.stockUom ? `${uom} · 基准单位（默认）` : `${uom} · 可选采购单位`,
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
  const hasDraftContent = useMemo(
    () =>
      Boolean(
        supplier.trim() ||
          (company.trim() && company.trim() !== preferences.defaultCompany.trim()) ||
          remarks.trim() ||
          supplierRef.trim() ||
          transactionDate !== today ||
          scheduleDate !== today ||
          draftItems.length,
      ),
    [company, draftItems.length, preferences.defaultCompany, remarks, scheduleDate, supplier, supplierRef, today, transactionDate],
  );

  const scrollToSection = (y: number) => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: Math.max(y - 16, 0), animated: true });
    });
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (allowLeaveRef.current || !hasDraftContent || isSubmitting) {
        return;
      }

      event.preventDefault();
      pendingNavigationActionRef.current = event.data.action;
      setShowLeaveConfirm(true);
    });

    return unsubscribe;
  }, [hasDraftContent, isSubmitting, navigation]);

  const handleItemChange = (itemId: string, field: keyof PurchaseOrderDraftItem, value: string) => {
    setDraftItems((currentItems) => {
      const nextItems = currentItems.map((item) => (item.id === itemId ? { ...item, [field]: value } : item));
      replacePurchaseOrderDraft(nextItems);
      return nextItems;
    });
  };

  const handleAdjustItemQty = (itemId: string, delta: number) => {
    setDraftItems((currentItems) => {
      const nextItems = currentItems.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        const currentQty = Number(item.qty);
        const safeQty = Number.isFinite(currentQty) ? currentQty : 0;
        const nextQty = Math.max(safeQty + delta, 1);
        return {
          ...item,
          qty: String(nextQty),
        };
      });
      replacePurchaseOrderDraft(nextItems);
      return nextItems;
    });
  };

  const handleAddItem = () => {
    router.push({
      pathname: '/purchase/order/item-search',
      params: {
        company,
        defaultWarehouse: defaultWarehouse.trim() || supplierContext?.suggestions.warehouse || '',
      },
    });
  };

  const handleRemoveItem = (itemId: string) => {
    removePurchaseOrderDraftItem(itemId);
    setDraftItems(getPurchaseOrderDraft());
    setExpandedItemRows((current) => {
      const next = { ...current };
      delete next[itemId];
      return next;
    });
  };

  const handleDefaultWarehouseChange = (value: string) => {
    setDefaultWarehouse(value);
    setDefaultWarehouseTouched(true);
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
    const nextId = buildDraftId();
    const baseRow = rows[0];
    const nextItems = [
      ...draftItems,
      {
        id: nextId,
        itemCode: baseRow.itemCode,
        itemName: baseRow.itemName,
        imageUrl: baseRow.imageUrl ?? null,
        qty: '1',
        price: baseRow.price,
        warehouse:
          defaultWarehouse.trim() ||
          supplierContext?.suggestions.warehouse ||
          '',
        uom: baseRow.stockUom || baseRow.uom,
        stockUom: baseRow.stockUom ?? null,
        totalQty: baseRow.totalQty ?? null,
        allUoms: baseRow.allUoms ?? [],
        uomConversions: baseRow.uomConversions ?? [],
        warehouseStockDetails: baseRow.warehouseStockDetails ?? [],
      },
    ];
    replacePurchaseOrderDraft(nextItems);
    setDraftItems(nextItems);
    setExpandedItemRows((current) => ({ ...current, [nextId]: true }));
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

    if (!isValidIsoDate(transactionDate) || !isValidIsoDate(scheduleDate)) {
      firstInvalidSection ??= 'basic';
    }

    if (!validItems.length) {
      firstInvalidSection ??= 'items';
    }

    if (firstInvalidSection) {
      showError(
        firstInvalidSection === 'basic'
          ? !isValidIsoDate(transactionDate)
            ? '请先选择有效下单日期。'
            : !isValidIsoDate(scheduleDate)
              ? '请先选择有效计划到货日期。'
              : '请先完善主体信息。'
          : '请至少填写一条有效的采购商品。',
      );
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
        defaultWarehouse: normalizeOptionalText(defaultWarehouse),
        currency: supplierContext?.suggestions.currency ?? supplierContext?.supplier.defaultCurrency ?? null,
        supplierRef,
        remarks,
      });

      if (!orderName) {
        throw new Error('采购订单创建成功，但未返回订单号。');
      }

      showSuccess(`采购订单 ${orderName} 已创建。`);
      clearPurchaseOrderDraft();
      allowLeaveRef.current = true;
      setDraftItems([]);
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
    const target = typeof returnTo === 'string' && returnTo.trim() ? returnTo : '/(tabs)/purchase';
    router.replace(target as never);
  };

  return (
    <SafeAreaView edges={[]} style={styles.page}>
      <MobilePageHeader
        onBack={() => {
          if (hasDraftContent && !allowLeaveRef.current && !isSubmitting) {
            setShowLeaveConfirm(true);
            return;
          }
          returnToPurchaseHome();
        }}
        showBack
        title="采购下单"
      />

      <ScrollView contentContainerStyle={styles.scrollContent} ref={scrollRef}>
        <View
          onLayout={(event) => {
            basicSectionYRef.current = event.nativeEvent.layout.y;
          }}
          style={[styles.card, styles.itemsCard, { backgroundColor: surface, borderColor }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderCopy}>
              <ThemedText style={styles.cardTitle} type="defaultSemiBold">
                主体信息
              </ThemedText>
              <ThemedText style={styles.sectionBody}>
                先确认供应商、公司和计划到货时间，再继续添加采购商品。
              </ThemedText>
            </View>
            <View style={[styles.sectionBadge, { backgroundColor: surfaceMuted }]}>
              <ThemedText style={[styles.sectionBadgeText, { color: tintColor }]} type="defaultSemiBold">
                必填优先
              </ThemedText>
            </View>
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

          {supplierContext && (supplierContext.suggestions.company || supplierContext.suggestions.warehouse) ? (
            <View style={[styles.inlineHintCard, { backgroundColor: surfaceMuted }]}>
              <View style={styles.inlineHintHeader}>
                <ThemedText style={styles.inlineHintTitle} type="defaultSemiBold">
                  供应商建议
                </ThemedText>
                {isLoadingContext ? <ActivityIndicator color={tintColor} size="small" /> : null}
              </View>
              <View style={styles.inlineHintGrid}>
                <View style={[styles.inlineHintChip, { backgroundColor: surface }]}>
                  <ThemedText style={styles.inlineHintLabel}>建议公司</ThemedText>
                  <ThemedText type="defaultSemiBold">
                    {supplierContext.suggestions.company || company.trim() || '未建议'}
                  </ThemedText>
                </View>
                <View style={[styles.inlineHintChip, { backgroundColor: surface }]}>
                  <ThemedText style={styles.inlineHintLabel}>建议仓库</ThemedText>
                  <ThemedText type="defaultSemiBold">
                    {supplierContext.suggestions.warehouse || '未建议仓库'}
                  </ThemedText>
                </View>
              </View>
            </View>
          ) : null}

          <View style={styles.dateGrid}>
            <View style={styles.dateBlock}>
              <DateFieldInput
                errorText={!isValidIsoDate(scheduleDate) ? '请选择有效计划到货日期。' : undefined}
                helperText="用于安排预期收货时间。"
                label="计划到货"
                onChange={setScheduleDate}
                value={scheduleDate}
              />
            </View>
            <View style={styles.dateBlock}>
              <DateFieldInput
                errorText={!isValidIsoDate(transactionDate) ? '请选择有效下单日期。' : undefined}
                helperText="默认今天，补录历史采购时可调整。"
                label="下单日期"
                onChange={setTransactionDate}
                value={transactionDate}
              />
            </View>
          </View>

          <Pressable onPress={() => setShowOptionalFields((current) => !current)} style={styles.foldHeader}>
            <ThemedText style={styles.foldTitle} type="defaultSemiBold">
              更多信息（可选）
            </ThemedText>
            <ThemedText style={[styles.foldAction, { color: tintColor }]} type="defaultSemiBold">
              {showOptionalFields ? '收起' : '展开'}
            </ThemedText>
          </Pressable>

          {showOptionalFields ? (
            <View style={styles.foldBody}>
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
          ) : null}

          {supplierContext ? (
            <>
              <Pressable onPress={() => setShowSupplierDetails((current) => !current)} style={styles.foldHeader}>
                <ThemedText style={styles.foldTitle} type="defaultSemiBold">
                  查看供应商资料
                </ThemedText>
                <ThemedText style={[styles.foldAction, { color: tintColor }]} type="defaultSemiBold">
                  {showSupplierDetails ? '收起' : '展开'}
                </ThemedText>
              </Pressable>

              {showSupplierDetails ? (
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
                    <ThemedText style={styles.contextLabel}>最近采购地址</ThemedText>
                    <ThemedText numberOfLines={3} type="defaultSemiBold">
                      {supplierContext.recentAddresses[0]?.addressDisplay || '暂无记录'}
                    </ThemedText>
                  </View>
                </View>
              ) : null}
            </>
          ) : null}
        </View>

        <View style={[styles.card, styles.overlayCard, { backgroundColor: surface, borderColor }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionAccent, { backgroundColor: tintColor }]} />
            <View style={styles.sectionHeaderCopy}>
              <ThemedText style={styles.cardTitle} type="defaultSemiBold">
                选择商品
              </ThemedText>
              <ThemedText style={styles.sectionHintText}>
                先确认新增商品默认带入哪个仓，再进入采购商品搜索页选择；后续明细仍可单独调整。
              </ThemedText>
            </View>
          </View>

          <View style={styles.itemControlField}>
            <LinkOptionInput
              helperText="未手动修改时会优先带当前公司的默认仓；如果当前公司没有默认仓，再尝试供应商建议仓。"
              inputActionText="切换"
              label="默认入库仓（新增商品默认带入）"
              loadOptions={(text) => searchWarehouses(text, company.trim() || undefined)}
              onChangeText={handleDefaultWarehouseChange}
              onOptionSelect={handleDefaultWarehouseChange}
              placeholder="未设置时优先带当前公司默认仓，其次供应商建议仓"
              value={defaultWarehouse}
            />
          </View>

          <Pressable
            onPress={handleAddItem}
            style={[styles.quickPickerCard, { backgroundColor: surfaceMuted, borderColor }]}>
            <View style={[styles.quickPickerIconWrap, { backgroundColor: surface }]}>
              <IconSymbol color={tintColor} name="shippingbox.fill" size={18} />
            </View>
            <View style={styles.quickPickerCopy}>
              <ThemedText style={styles.quickPickerLabel} type="defaultSemiBold">
                选择商品
              </ThemedText>
              <ThemedText style={styles.quickPickerHint}>
                进入采购商品搜索页选择，也可在页内扫码添加
              </ThemedText>
            </View>
            <View style={styles.quickPickerActionWrap}>
              <ThemedText style={[styles.textAction, { color: tintColor }]} type="defaultSemiBold">
                去选择
              </ThemedText>
            </View>
          </Pressable>
        </View>

        <View
          onLayout={(event) => {
            itemsSectionYRef.current = event.nativeEvent.layout.y;
          }}
          style={[styles.card, styles.itemsCardShell, { backgroundColor: surface, borderColor }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionAccent, { backgroundColor: tintColor }]} />
            <View style={styles.sectionHeaderCopy}>
              <ThemedText style={styles.cardTitle} type="defaultSemiBold">
                采购商品
              </ThemedText>
              <ThemedText style={styles.sectionHintText}>已选商品在这里按仓库拆分数量和采购价。</ThemedText>
            </View>
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
                const groupReferenceBuyingRate =
                  typeof groupLeadRow.standardBuyingRate === 'number' ? groupLeadRow.standardBuyingRate : null;
                const groupReferenceUnit = formatDisplayUom(groupLeadRow.stockUom || groupLeadRow.uom || '');
                const groupReferenceAmount =
                  typeof groupReferenceBuyingRate === 'number' ? groupIncomingQty * groupReferenceBuyingRate : null;

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
                        <View style={styles.groupInfoRow}>
                          <ThemedText style={styles.groupInfoText}>
                            参考进货价{' '}
                            <ThemedText type="defaultSemiBold">
                              {groupReferenceBuyingRate != null ? formatMoney(groupReferenceBuyingRate) : '未配置'}
                            </ThemedText>
                            {groupReferenceBuyingRate != null && groupReferenceUnit ? ` / ${groupReferenceUnit}` : ''}
                          </ThemedText>
                          <ThemedText style={styles.groupInfoText}>
                            参考金额{' '}
                            <ThemedText type="defaultSemiBold">
                              {groupReferenceAmount != null ? formatMoney(groupReferenceAmount) : '—'}
                            </ThemedText>
                          </ThemedText>
                        </View>
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
                                defaultWarehouse:
                                  group.rows[0].warehouse ||
                                  defaultWarehouse ||
                                  supplierContext?.suggestions.warehouse ||
                                  '',
                              },
                            })
                          }
                          style={[styles.groupActionButton, styles.groupActionSecondary, { backgroundColor: surface, borderColor }]}>
                          <ThemedText style={[styles.groupActionText, { color: tintColor }]} type="defaultSemiBold">
                            更换商品
                          </ThemedText>
                        </Pressable>
                      ) : null}
                      <Pressable
                        onPress={() => handleAddWarehouseRow(group.rows)}
                        style={[styles.groupActionButton, styles.groupActionPrimary, { backgroundColor: tintColor }]}>
                        <ThemedText style={styles.groupActionPrimaryText} type="defaultSemiBold">
                          新增仓库行
                        </ThemedText>
                      </Pressable>
                    </View>
                  </View>

                  <View style={[styles.groupSummaryBar, { backgroundColor: surface }]}>
                    <ThemedText style={styles.groupSummaryText}>
                      总库存 <ThemedText type="defaultSemiBold">{formatQty(groupLeadRow.totalQty)} {groupStockUom ? formatDisplayUom(groupStockUom) : ''}</ThemedText>
                    </ThemedText>
                    <ThemedText style={styles.groupSummaryDivider}>·</ThemedText>
                    <ThemedText style={styles.groupSummaryText}>
                      本次入库后 <ThemedText type="defaultSemiBold">{formatQty(projectedTotal)} {groupStockUom ? formatDisplayUom(groupStockUom) : ''}</ThemedText>
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
                      const isExpanded = expandedItemRows[item.id] ?? group.rows.length === 1;
                      const rowUnit = item.uom || item.stockUom || '';
                      const rowDisplayUnit = formatDisplayUom(rowUnit);
                      const rowPriceNumber = Number(item.price);
                      const rowSubtotal =
                        Number.isFinite(rowQty) && Number.isFinite(rowPriceNumber)
                          ? rowQty * rowPriceNumber
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
                          <View style={styles.subRowHeaderActions}>
                            <Pressable
                              onPress={() =>
                                setExpandedItemRows((current) => ({ ...current, [item.id]: !isExpanded }))
                              }
                              style={[styles.subRowToggle, { borderColor }]}>
                              <ThemedText style={[styles.subRowToggleText, { color: tintColor }]} type="defaultSemiBold">
                                {isExpanded ? '收起' : '编辑'}
                              </ThemedText>
                            </Pressable>
                            <Pressable onPress={() => handleRemoveItem(item.id)} style={[styles.subRowRemove, { borderColor }]}>
                              <ThemedText style={styles.subRowRemoveText} type="defaultSemiBold">
                                删除
                              </ThemedText>
                            </Pressable>
                          </View>
                        </View>

                        {isExpanded ? (
                          <View style={styles.subRowEditBody}>
                            <View style={styles.subRowGrid}>
                              <View style={styles.subRowField}>
                                <ThemedText style={styles.fieldLabel} type="defaultSemiBold">
                                  采购数量 {rowUnit ? `(${rowDisplayUnit})` : ''}
                                </ThemedText>
                                <View style={[styles.qtyStepper, { backgroundColor: surfaceMuted, borderColor }]}>
                                  <Pressable
                                    disabled={(Number(item.qty) || 0) <= 1}
                                    onPress={() => handleAdjustItemQty(item.id, -1)}
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
                                    onChangeText={(value) => handleItemChange(item.id, 'qty', value)}
                                    placeholder="数量"
                                    style={[
                                      styles.qtyInput,
                                      styles.textInputReset,
                                      Platform.OS === 'web' ? styles.webTextInputReset : null,
                                    ]}
                                    value={item.qty}
                                  />
                                  <Pressable onPress={() => handleAdjustItemQty(item.id, 1)} style={styles.qtyActionButton}>
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
                                    onChangeText={(value) => handleItemChange(item.id, 'price', value)}
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
                                  <ThemedText style={styles.fieldLabelHint}>
                                    {item.stockUom && item.uom && item.stockUom !== item.uom
                                      ? `（默认按${formatDisplayUom(item.stockUom)}带入，库存按${formatDisplayUom(item.stockUom)}换算）`
                                      : item.stockUom
                                        ? `（默认：${formatDisplayUom(item.stockUom)}基准单位）`
                                        : ''}
                                  </ThemedText>
                                </ThemedText>
                                <Pressable
                                  onPress={() => openPicker(item.id, 'uom')}
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
                                <View style={[styles.compactInfoBox, { backgroundColor: surfaceMuted, borderColor }]}>
                                  <ThemedText style={styles.compactInfoValueStrong} type="defaultSemiBold">
                                    {formatMoney(rowSubtotal)}
                                  </ThemedText>
                                </View>
                              </View>
                            </View>

                            <View style={styles.subRowField}>
                              <ThemedText style={styles.fieldLabel} type="defaultSemiBold">
                                入库仓库
                                <ThemedText style={styles.fieldLabelHint}>（留空时优先建议仓/默认仓）</ThemedText>
                              </ThemedText>
                              <Pressable
                                onPress={() => openPicker(item.id, 'warehouse')}
                                style={[styles.selectorButton, { backgroundColor: surfaceMuted, borderColor }]}>
                                <ThemedText style={styles.selectorButtonText}>
                                  {item.warehouse || '选择入库仓库'}
                                </ThemedText>
                              </Pressable>
                            </View>
                          </View>
                        ) : null}
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

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <View style={[styles.bottomBar, { backgroundColor: surface, borderTopColor: borderColor }]}>
        <View style={styles.bottomBarSummary}>
          <ThemedText style={styles.bottomBarTitle} type="defaultSemiBold">
            {itemCount ? `已选 ${itemCount} 条有效明细` : '先添加采购商品'}
          </ThemedText>
          <ThemedText style={styles.bottomBarMeta}>
            {itemCount
              ? `计划采购 ${formatQty(totalQty)} · 到货 ${scheduleDate || '未设置'}`
              : '完成主体信息后，从商品页继续添加采购明细。'}
          </ThemedText>
        </View>
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
                {pickerTarget?.field === 'warehouse' ? '选择入库仓库' : '选择采购单位'}
              </ThemedText>
              <ThemedText style={styles.sectionHintText}>
                {pickerTarget?.field === 'warehouse' ? '选择这一行商品最终入库的仓库。' : '默认优先使用商品基准单位，也可以改成其他可换算单位。'}
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

      <Modal
        animationType="fade"
        onRequestClose={() => setShowLeaveConfirm(false)}
        transparent
        visible={showLeaveConfirm}>
        <View style={styles.dialogBackdrop}>
          <View style={[styles.dialogCard, { backgroundColor: surface, borderColor }]}>
            <ThemedText style={styles.dialogTitle} type="defaultSemiBold">
              离开当前采购单？
            </ThemedText>
            <ThemedText style={styles.dialogText}>
              当前填写内容已经暂存为草稿。离开后可以稍后继续编辑，但本次内容还没有正式提交为采购订单。
            </ThemedText>
            <View style={styles.dialogActions}>
              <Pressable
                onPress={() => {
                  pendingNavigationActionRef.current = null;
                  setShowLeaveConfirm(false);
                }}
                style={[styles.dialogButton, styles.dialogGhostButton, { borderColor }]}>
                <ThemedText style={styles.dialogGhostText} type="defaultSemiBold">
                  继续填写
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowLeaveConfirm(false);
                  const pendingAction = pendingNavigationActionRef.current;
                  pendingNavigationActionRef.current = null;
                  allowLeaveRef.current = true;
                  if (pendingAction) {
                    navigation.dispatch(pendingAction);
                  } else {
                    returnToPurchaseHome();
                  }
                }}
                style={[styles.dialogButton, styles.dialogPrimaryButton, { backgroundColor: tintColor }]}>
                <ThemedText style={styles.dialogPrimaryText} type="defaultSemiBold">
                  离开页面
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  scrollContent: {
    gap: 12,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    overflow: 'visible',
    padding: 18,
  },
  overlayCard: {
    zIndex: 120,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  cardHeaderCopy: {
    flex: 1,
    gap: 4,
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
  sectionBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sectionBadgeText: {
    fontSize: 12,
  },
  textAction: {
    fontSize: 13,
  },
  quickPickerCard: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 76,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  quickPickerIconWrap: {
    alignItems: 'center',
    borderRadius: 16,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  quickPickerCopy: {
    flex: 1,
    gap: 4,
  },
  quickPickerLabel: {
    fontSize: 16,
  },
  quickPickerHint: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
  },
  quickPickerActionWrap: {
    justifyContent: 'center',
  },
  itemControlField: {
    zIndex: 30,
  },
  inlineHintCard: {
    borderRadius: 18,
    gap: 10,
    padding: 14,
  },
  inlineHintHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inlineHintTitle: {
    fontSize: 14,
  },
  inlineHintGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  inlineHintChip: {
    borderRadius: 14,
    flex: 1,
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inlineHintLabel: {
    color: '#64748B',
    fontSize: 12,
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
  itemsCardShell: {
    zIndex: 10,
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
    flexDirection: 'row',
    flex: 1,
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
  groupInfoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  groupInfoText: {
    color: '#71859D',
    fontSize: 12,
    lineHeight: 18,
  },
  groupActions: {
    alignItems: 'flex-end',
    flexShrink: 0,
    gap: 8,
  },
  groupActionButton: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  groupActionSecondary: {
    minWidth: 104,
  },
  groupActionPrimary: {
    borderWidth: 0,
    minWidth: 104,
  },
  groupActionText: {
    fontSize: 12,
  },
  groupActionPrimaryText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  groupSummaryBar: {
    alignItems: 'center',
    borderRadius: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  groupSummaryText: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
  },
  groupSummaryDivider: {
    color: '#CBD5E1',
    fontSize: 12,
  },
  subRowList: {
    gap: 10,
    zIndex: 10,
  },
  subRowSection: {
    borderRadius: 16,
    gap: 10,
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
    backgroundColor: '#E0EAFF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  subRowBadgeText: {
    color: '#2563EB',
    fontSize: 12,
  },
  subRowSummaryText: {
    color: '#475569',
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
    lineHeight: 18,
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
  subRowToggle: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  subRowToggleText: {
    fontSize: 12,
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
  qtyStepper: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 52,
    overflow: 'hidden',
  },
  qtyActionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    width: 38,
  },
  qtyActionButtonDisabled: {
    opacity: 0.35,
  },
  qtyActionText: {
    fontSize: 20,
    lineHeight: 20,
  },
  qtyInput: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    color: '#111827',
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    margin: 0,
    minHeight: 52,
    minWidth: 34,
    paddingHorizontal: 0,
    paddingVertical: 0,
    textAlign: 'center',
  },
  priceInputWrap: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 52,
    paddingHorizontal: 12,
  },
  pricePrefix: {
    color: '#94A3B8',
    fontSize: 14,
  },
  priceInput: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    color: '#0F172A',
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    margin: 0,
    minHeight: 52,
    minWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  textInputReset: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    margin: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  webTextInputReset: {
    outlineColor: 'transparent',
    outlineOffset: 0,
    outlineStyle: 'none',
    outlineWidth: 0,
  },
  fieldLabelHint: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '400',
  },
  compactInfoBox: {
    alignItems: 'flex-start',
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 14,
  },
  compactInfoValue: {
    fontSize: 16,
  },
  compactInfoValueStrong: {
    color: '#0F172A',
    fontSize: 16,
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
  foldHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 24,
  },
  foldTitle: {
    fontSize: 15,
  },
  foldAction: {
    fontSize: 13,
  },
  foldBody: {
    gap: 12,
  },
  bottomSpacer: {
    height: 120,
  },
  bottomBar: {
    borderTopWidth: 1,
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  bottomBarSummary: {
    gap: 2,
    paddingHorizontal: 4,
  },
  bottomBarTitle: {
    fontSize: 14,
  },
  bottomBarMeta: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
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
  dialogBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(15,23,42,0.28)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  dialogCard: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    padding: 20,
    width: '100%',
  },
  dialogTitle: {
    fontSize: 18,
  },
  dialogText: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 21,
  },
  dialogActions: {
    flexDirection: 'row',
    gap: 10,
  },
  dialogButton: {
    alignItems: 'center',
    borderRadius: 16,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 14,
  },
  dialogGhostButton: {
    borderWidth: 1,
  },
  dialogPrimaryButton: {
    borderWidth: 0,
  },
  dialogGhostText: {
    color: '#0F172A',
    fontSize: 14,
  },
  dialogPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
});
