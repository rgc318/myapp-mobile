import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { normalizeAppError } from '@/lib/app-error';
import { formatCurrencyValue } from '@/lib/display-currency';
import { formatDisplayUom } from '@/lib/display-uom';
import {
  clearSalesOrderDraft,
  getSalesOrderDraft,
  replaceSalesOrderDraft,
} from '@/lib/sales-order-draft';
import { fetchProductDetail } from '@/services/products';
import {
  cancelSalesOrderV2,
  createSalesInvoiceForOrderV2,
  getSalesOrderDetailV2,
  submitSalesOrderDeliveryV2,
  updateSalesOrderItemsV2,
  updateSalesOrderV2,
  type SalesOrderDetailV2,
} from '@/services/sales';

type EditableOrderItem = {
  itemCode: string;
  itemName: string;
  qty: number;
  rate: number | null;
  amount: number | null;
  warehouse: string;
  uom: string;
  imageUrl: string;
};

function EditableSalesItemRow({
  item,
  currency,
  surface,
  surfaceMuted,
  tintColor,
  onChangePrice,
  onChangeQty,
  onDecreaseQty,
  onIncreaseQty,
  onCycleUom,
  availableUoms,
  onRemove,
}: {
  item: EditableOrderItem;
  currency: string;
  surface: string;
  surfaceMuted: string;
  tintColor: string;
  onChangePrice: (value: string) => void;
  onChangeQty: (value: string) => void;
  onDecreaseQty: () => void;
  onIncreaseQty: () => void;
  onCycleUom: () => void;
  availableUoms: string[];
  onRemove: () => void;
}) {
  const lineAmount = (item.rate ?? 0) * item.qty;

  return (
    <View style={[styles.editItemCard, { backgroundColor: surface, borderColor: 'rgba(148,163,184,0.18)' }]}>
      <View style={styles.editItemRow}>
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.goodsImage} />
      ) : (
        <View style={[styles.goodsImage, styles.imageFallback, { backgroundColor: surfaceMuted }]}>
          <IconSymbol color="#28B7D7" name="shippingbox.fill" size={20} />
        </View>
      )}

      <View style={styles.editItemMain}>
        <View style={styles.editItemHeader}>
          <View style={styles.editItemHeaderCopy}>
            <ThemedText numberOfLines={1} style={styles.goodsName} type="defaultSemiBold">
              {item.itemName || item.itemCode}
            </ThemedText>
            <ThemedText style={styles.goodsSubMeta}>编码 {item.itemCode}</ThemedText>
            <ThemedText style={styles.goodsSubMeta}>仓库 {item.warehouse || '未指定仓库'}</ThemedText>
          </View>

          <View style={styles.editItemHeaderAside}>
            <ThemedText style={styles.goodsAmount} type="defaultSemiBold">
              {formatCurrencyValue(lineAmount, currency)}
            </ThemedText>
            <Pressable onPress={onRemove} style={styles.removeInlineButton}>
              <ThemedText style={styles.removeInlineText} type="defaultSemiBold">
                删除
              </ThemedText>
            </Pressable>
          </View>
        </View>

        <View style={styles.editItemControls}>
          <View style={styles.editItemControlRow}>
            <View style={[styles.inlineField, styles.qtyField, { backgroundColor: surfaceMuted }]}>
              <ThemedText style={styles.inlineFieldLabel}>数量</ThemedText>
              <View style={styles.qtyStepper}>
                <Pressable onPress={onDecreaseQty} style={styles.qtyStepperButton}>
                  <ThemedText style={[styles.qtyStepperButtonText, { color: tintColor }]} type="defaultSemiBold">
                    -
                  </ThemedText>
                </Pressable>
                <TextInput
                  keyboardType="number-pad"
                  onChangeText={onChangeQty}
                  style={styles.qtyStepperInput}
                  value={String(item.qty)}
                />
                <Pressable onPress={onIncreaseQty} style={styles.qtyStepperButton}>
                  <ThemedText style={[styles.qtyStepperButtonText, { color: tintColor }]} type="defaultSemiBold">
                    +
                  </ThemedText>
                </Pressable>
              </View>
            </View>
            <View style={[styles.inlineField, styles.uomField, { backgroundColor: surfaceMuted }]}>
              <ThemedText style={styles.inlineFieldLabel}>单位</ThemedText>
              <Pressable
                disabled={availableUoms.length <= 1}
                onPress={onCycleUom}
                style={[styles.uomSwitcher, availableUoms.length <= 1 && styles.uomSwitcherDisabled]}
              >
                <ThemedText style={styles.inlineStaticValue} type="defaultSemiBold">
                  {formatDisplayUom(item.uom)}
                </ThemedText>
                {availableUoms.length > 1 ? (
                  <ThemedText style={[styles.uomHint, { color: tintColor }]}>切换</ThemedText>
                ) : null}
              </Pressable>
            </View>
            <View style={[styles.priceChipField, { backgroundColor: surfaceMuted }]}>
              <ThemedText style={styles.inlineFieldLabel}>单价</ThemedText>
              <View style={styles.priceChipContent}>
                <ThemedText style={styles.pricePrefix} type="defaultSemiBold">
                  {currency === 'CNY' ? '¥' : currency}
                </ThemedText>
                <TextInput
                  keyboardType="decimal-pad"
                  onChangeText={onChangePrice}
                  style={styles.priceChipInput}
                  value={item.rate == null ? '' : String(item.rate)}
                />
              </View>
            </View>
          </View>
        </View>
      </View>
      </View>
    </View>
  );
}

function getBusinessStatusLabel(detail: SalesOrderDetailV2 | null) {
  if (!detail) {
    return '未加载';
  }

  if (detail.documentStatus === 'cancelled') {
    return '已作废';
  }
  if (detail.completionStatus === 'completed') {
    return '已完成';
  }
  if (detail.paymentStatus === 'paid') {
    return '已结清';
  }
  if (detail.fulfillmentStatus === 'shipped') {
    return '已出货';
  }
  if (detail.fulfillmentStatus === 'partial') {
    return '部分出货';
  }
  if (detail.documentStatus === 'submitted') {
    return '待出货';
  }
  return '草稿';
}

function getStatusTone(detail: SalesOrderDetailV2 | null) {
  if (!detail) {
    return { backgroundColor: '#E2E8F0', color: '#475569' };
  }

  if (detail.documentStatus === 'cancelled') {
    return { backgroundColor: '#FEE2E2', color: '#B91C1C' };
  }
  if (detail.completionStatus === 'completed' || detail.paymentStatus === 'paid') {
    return { backgroundColor: '#DCFCE7', color: '#15803D' };
  }
  if (detail.fulfillmentStatus === 'partial') {
    return { backgroundColor: '#FEF3C7', color: '#B45309' };
  }
  return { backgroundColor: '#DBEAFE', color: '#1D4ED8' };
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <ThemedText style={styles.infoLabel}>{label}</ThemedText>
      <ThemedText style={styles.infoValue} type="defaultSemiBold">
        {value}
      </ThemedText>
    </View>
  );
}

export default function SalesOrderDetailScreen() {
  const router = useRouter();
  const { orderName } = useLocalSearchParams<{ orderName: string }>();
  const isFocused = useIsFocused();
  const orderDraftScope = orderName ? `order-edit:${orderName}` : 'order-edit';

  const [detail, setDetail] = useState<SalesOrderDetailV2 | null>(null);
  const [message, setMessage] = useState('');
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [isEditingItems, setIsEditingItems] = useState(false);
  const [isEditingRemarks, setIsEditingRemarks] = useState(false);
  const [isSavingContact, setIsSavingContact] = useState(false);
  const [isSavingItems, setIsSavingItems] = useState(false);
  const [isSavingRemarks, setIsSavingRemarks] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isSubmittingDelivery, setIsSubmittingDelivery] = useState(false);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [deliveryDateInput, setDeliveryDateInput] = useState('');
  const [contactDisplayInput, setContactDisplayInput] = useState('');
  const [contactPhoneInput, setContactPhoneInput] = useState('');
  const [addressInput, setAddressInput] = useState('');
  const [remarksInput, setRemarksInput] = useState('');
  const [editableItems, setEditableItems] = useState<EditableOrderItem[]>([]);
  const [itemUomOptions, setItemUomOptions] = useState<Record<string, string[]>>({});

  const background = useThemeColor({}, 'background');
  const surface = useThemeColor({}, 'surface');
  const borderColor = useThemeColor({}, 'border');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const tintColor = useThemeColor({}, 'tint');

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
        setContactDisplayInput(nextDetail?.contactDisplay ?? nextDetail?.contactPerson ?? '');
        setContactPhoneInput(nextDetail?.contactPhone ?? '');
        setAddressInput(nextDetail?.addressDisplay ?? '');
        setRemarksInput(nextDetail?.remarks ?? '');
        setEditableItems(
          nextDetail?.items.map((item) => ({
            itemCode: item.itemCode,
            itemName: item.itemName,
            qty: item.qty ?? 1,
            rate: item.rate,
            amount: item.amount,
            warehouse: item.warehouse,
            uom: item.uom,
            imageUrl: item.imageUrl,
          })) ?? [],
        );
        setMessage(nextDetail ? '' : '未找到对应销售订单。');
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        const appError = normalizeAppError(error, '订单详情读取失败。');
        setMessage(appError.message);
      });

    return () => {
      active = false;
    };
  }, [orderName]);

  useEffect(() => {
    if (!isFocused || !isEditingItems) {
      return;
    }

    const scopedDraft = getSalesOrderDraft(orderDraftScope);
    if (!scopedDraft.length) {
      return;
    }

    setEditableItems(
      scopedDraft.map((item) => ({
        itemCode: item.itemCode,
        itemName: item.itemName,
        qty: item.qty,
        rate: item.price,
        amount: (item.price ?? 0) * item.qty,
        warehouse: item.warehouse ?? '',
        uom: item.uom ?? '',
        imageUrl: item.imageUrl ?? '',
      })),
    );
  }, [isEditingItems, isFocused, orderDraftScope]);

  useEffect(() => {
    if (!isEditingItems || !editableItems.length) {
      return;
    }

    const pendingItemCodes = Array.from(
      new Set(
        editableItems
          .map((item) => item.itemCode)
          .filter((itemCode) => itemCode && !(itemCode in itemUomOptions)),
      ),
    );

    if (!pendingItemCodes.length) {
      return;
    }

    let cancelled = false;

    void Promise.all(
      pendingItemCodes.map(async (itemCode) => {
        try {
          const productDetail = await fetchProductDetail(itemCode, {
            company: detail?.company || undefined,
          });
          const fallbackUoms = editableItems
            .filter((item) => item.itemCode === itemCode)
            .map((item) => item.uom)
            .filter(Boolean);
          const allUoms = productDetail?.allUoms?.length
            ? productDetail.allUoms
            : productDetail?.stockUom
              ? [productDetail.stockUom]
              : fallbackUoms;

          return [itemCode, Array.from(new Set(allUoms.filter(Boolean)))] as const;
        } catch {
          return [itemCode, []] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) {
        return;
      }

      setItemUomOptions((current) => {
        const next = { ...current };
        for (const [itemCode, allUoms] of entries) {
          next[itemCode] = allUoms;
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [detail?.company, editableItems, isEditingItems, itemUomOptions]);

  const statusTone = getStatusTone(detail);
  const businessStatus = getBusinessStatusLabel(detail);
  const isEditingAnySection = isEditingContact || isEditingItems || isEditingRemarks;
  const isEditingAllSections = isEditingContact && isEditingItems && isEditingRemarks;
  const totalQuantity = useMemo(
    () =>
      (isEditingItems ? editableItems : detail?.items ?? []).reduce((count, item) => count + (item.qty ?? 0), 0),
    [detail, editableItems, isEditingItems],
  );
  const editingGrandTotal = useMemo(
    () => editableItems.reduce((sum, item) => sum + (item.rate ?? 0) * item.qty, 0),
    [editableItems],
  );

  async function handleSaveContact() {
    if (!orderName) {
      return;
    }

    try {
      setIsSavingContact(true);
      setMessage('');
      const nextDetail = await updateSalesOrderV2({
        orderName,
        deliveryDate: deliveryDateInput,
        remarks: remarksInput,
        contactDisplay: contactDisplayInput,
        contactPhone: contactPhoneInput,
        shippingAddressText: addressInput,
      });

      setDetail(nextDetail);
      setIsEditingContact(false);
      setMessage('收货与联系人已更新。');
    } catch (error) {
      const appError = normalizeAppError(error, '订单保存失败。');
      setMessage(appError.message);
    } finally {
      setIsSavingContact(false);
    }
  }

  async function handleCancelOrder() {
    if (!orderName || !detail || detail.documentStatus === 'cancelled') {
      return;
    }

    try {
      setIsCancelling(true);
      setMessage('');
      const nextDetail = await cancelSalesOrderV2(orderName);
      setDetail(nextDetail);
      setIsEditingContact(false);
      setIsEditingItems(false);
      setIsEditingRemarks(false);
      setMessage('订单已作废。');
    } catch (error) {
      const appError = normalizeAppError(error, '订单作废失败。');
      setMessage(appError.message);
    } finally {
      setIsCancelling(false);
    }
  }

  async function handleSubmitDelivery() {
    if (!orderName || !detail?.canSubmitDelivery) {
      return;
    }

    try {
      setIsSubmittingDelivery(true);
      setMessage('');
      const result = await submitSalesOrderDeliveryV2(orderName);
      if (result.detail) {
        setDetail(result.detail);
      }
      setMessage(result.deliveryNote ? `发货成功，已创建发货单 ${result.deliveryNote}。` : '发货成功。');
    } catch (error) {
      const appError = normalizeAppError(error, '发货失败。');
      setMessage(appError.message);
    } finally {
      setIsSubmittingDelivery(false);
    }
  }

  async function handleCreateInvoice() {
    if (!orderName || !detail?.canCreateSalesInvoice) {
      return;
    }

    try {
      setIsCreatingInvoice(true);
      setMessage('');
      const result = await createSalesInvoiceForOrderV2(orderName);
      if (result.detail) {
        setDetail(result.detail);
      }
      setMessage(result.salesInvoice ? `开票成功，已创建销售发票 ${result.salesInvoice}。` : '开票成功。');
    } catch (error) {
      const appError = normalizeAppError(error, '开票失败。');
      setMessage(appError.message);
    } finally {
      setIsCreatingInvoice(false);
    }
  }

  function resetContactForm() {
    setDeliveryDateInput(detail?.deliveryDate ?? '');
    setContactDisplayInput(detail?.contactDisplay ?? detail?.contactPerson ?? '');
    setContactPhoneInput(detail?.contactPhone ?? '');
    setAddressInput(detail?.addressDisplay ?? '');
    setIsEditingContact(false);
  }

  function prepareAllEditingInputs() {
    const nextItems =
      detail?.items.map((item) => ({
        itemCode: item.itemCode,
        itemName: item.itemName,
        qty: item.qty ?? 1,
        rate: item.rate,
        amount: item.amount,
        warehouse: item.warehouse,
        uom: item.uom,
        imageUrl: item.imageUrl,
      })) ?? [];

    setDeliveryDateInput(detail?.deliveryDate ?? '');
    setContactDisplayInput(detail?.contactDisplay ?? detail?.contactPerson ?? '');
    setContactPhoneInput(detail?.contactPhone ?? '');
    setAddressInput(detail?.addressDisplay ?? '');
    setRemarksInput(detail?.remarks ?? '');
    setEditableItems(nextItems);
    syncScopedDraft(nextItems);
  }

  function updateEditableItem(index: number, patch: Partial<EditableOrderItem>) {
    setEditableItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              ...patch,
              amount: (patch.rate ?? item.rate ?? 0) * (patch.qty ?? item.qty),
            }
          : item,
      ),
    );
  }

  function removeEditableItem(index: number) {
    setEditableItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function syncScopedDraft(nextItems: EditableOrderItem[]) {
    replaceSalesOrderDraft(
      nextItems.map((item) => ({
        draftKey: [item.itemCode, item.warehouse ?? '', item.uom ?? ''].join('::'),
        itemCode: item.itemCode,
        itemName: item.itemName,
        imageUrl: item.imageUrl,
        qty: item.qty,
        price: item.rate,
        uom: item.uom,
        warehouse: item.warehouse,
      })),
      orderDraftScope,
    );
  }

  function startEditingContact() {
    setIsEditingItems(false);
    setIsEditingRemarks(false);
    setDeliveryDateInput(detail?.deliveryDate ?? '');
    setContactDisplayInput(detail?.contactDisplay ?? detail?.contactPerson ?? '');
    setContactPhoneInput(detail?.contactPhone ?? '');
    setAddressInput(detail?.addressDisplay ?? '');
    setIsEditingContact(true);
  }

  function startEditingItems() {
    setIsEditingContact(false);
    setIsEditingRemarks(false);
    const nextItems =
      detail?.items.map((item) => ({
        itemCode: item.itemCode,
        itemName: item.itemName,
        qty: item.qty ?? 1,
        rate: item.rate,
        amount: item.amount,
        warehouse: item.warehouse,
        uom: item.uom,
        imageUrl: item.imageUrl,
      })) ?? [];
    setEditableItems(nextItems);
    syncScopedDraft(nextItems);
    setIsEditingItems(true);
  }

  function resetItemsForm() {
    setEditableItems(
      detail?.items.map((item) => ({
        itemCode: item.itemCode,
        itemName: item.itemName,
        qty: item.qty ?? 1,
        rate: item.rate,
        amount: item.amount,
        warehouse: item.warehouse,
        uom: item.uom,
        imageUrl: item.imageUrl,
      })) ?? [],
    );
    clearSalesOrderDraft(orderDraftScope);
    setIsEditingItems(false);
  }

  async function handleSaveItems() {
    if (!orderName) {
      return;
    }

    try {
      setIsSavingItems(true);
      setMessage('');
      const itemUpdateResult = await updateSalesOrderItemsV2({
        orderName,
        items: editableItems.map((item) => ({
          itemCode: item.itemCode,
          qty: item.qty,
          price: item.rate,
          warehouse: item.warehouse,
          uom: item.uom,
        })),
      });

      if (itemUpdateResult.detail) {
        setDetail(itemUpdateResult.detail);
      }
      setIsEditingItems(false);
      clearSalesOrderDraft(orderDraftScope);

      if (itemUpdateResult.orderName !== orderName) {
        setMessage(`商品修改已生效，系统已生成新订单 ${itemUpdateResult.orderName}，原订单 ${itemUpdateResult.sourceOrderName || orderName} 已作废。`);
        router.replace({
          pathname: '/sales/order/[orderName]',
          params: { orderName: itemUpdateResult.orderName },
        });
      } else {
        setMessage('商品明细已更新。');
      }
    } catch (error) {
      const appError = normalizeAppError(error, '商品保存失败。');
      setMessage(appError.message);
    } finally {
      setIsSavingItems(false);
    }
  }

  function startEditingRemarks() {
    setIsEditingContact(false);
    setIsEditingItems(false);
    setRemarksInput(detail?.remarks ?? '');
    setIsEditingRemarks(true);
  }

  function resetRemarksForm() {
    setRemarksInput(detail?.remarks ?? '');
    setIsEditingRemarks(false);
  }

  async function handleSaveRemarks() {
    if (!orderName) {
      return;
    }

    try {
      setIsSavingRemarks(true);
      setMessage('');
      const nextDetail = await updateSalesOrderV2({
        orderName,
        remarks: remarksInput,
      });
      setDetail(nextDetail);
      setIsEditingRemarks(false);
      setMessage('订单备注已更新。');
    } catch (error) {
      const appError = normalizeAppError(error, '备注保存失败。');
      setMessage(appError.message);
    } finally {
      setIsSavingRemarks(false);
    }
  }

  function openProductSearch() {
    if (!orderName) {
      return;
    }

    syncScopedDraft(editableItems);
    router.push({
      pathname: '/common/product-search',
      params: {
        mode: 'order',
        draftScope: orderDraftScope,
        returnOrderName: orderName,
      },
    });
  }

  function resetAllForms() {
    resetContactForm();
    resetItemsForm();
    resetRemarksForm();
  }

  function startEditingAll() {
    prepareAllEditingInputs();
    setIsEditingContact(true);
    setIsEditingItems(true);
    setIsEditingRemarks(true);
  }

  const workflowAction = detail?.canSubmitDelivery
    ? {
        label: isSubmittingDelivery ? '出货中...' : '出货',
        onPress: handleSubmitDelivery,
        disabled: isSubmittingDelivery || isCreatingInvoice || isCancelling,
        tone: 'primary' as const,
      }
      : detail?.canCreateSalesInvoice
      ? {
          label: isCreatingInvoice ? '开票中...' : '开票',
          onPress: handleCreateInvoice,
          disabled: isCreatingInvoice || isSubmittingDelivery || isCancelling,
          tone: 'primary' as const,
        }
      : {
          label: '操作',
          onPress: startEditingContact,
          disabled: detail?.documentStatus === 'cancelled',
          tone: 'ghost' as const,
        };

  async function handleSaveAll() {
    if (!orderName) {
      return;
    }

    try {
      setIsSavingContact(true);
      setIsSavingItems(true);
      setIsSavingRemarks(true);
      setMessage('');

      const nextDetail = await updateSalesOrderV2({
        orderName,
        deliveryDate: deliveryDateInput,
        remarks: remarksInput,
        contactDisplay: contactDisplayInput,
        contactPhone: contactPhoneInput,
        shippingAddressText: addressInput,
      });

      let finalDetail = nextDetail;
      const itemUpdateResult = await updateSalesOrderItemsV2({
        orderName,
        items: editableItems.map((item) => ({
          itemCode: item.itemCode,
          qty: item.qty,
          price: item.rate,
          warehouse: item.warehouse,
          uom: item.uom,
        })),
      });

      if (itemUpdateResult.detail) {
        finalDetail = itemUpdateResult.detail;
      }

      setDetail(finalDetail);
      setIsEditingContact(false);
      setIsEditingItems(false);
      setIsEditingRemarks(false);
      clearSalesOrderDraft(orderDraftScope);

      if (itemUpdateResult.orderName !== orderName) {
        setMessage(`订单修改已生效，系统已生成新订单 ${itemUpdateResult.orderName}，原订单 ${itemUpdateResult.sourceOrderName || orderName} 已作废。`);
        router.replace({
          pathname: '/sales/order/[orderName]',
          params: { orderName: itemUpdateResult.orderName },
        });
      } else {
        setMessage('订单修改已保存。');
      }
    } catch (error) {
      const appError = normalizeAppError(error, '订单保存失败。');
      setMessage(appError.message);
    } finally {
      setIsSavingContact(false);
      setIsSavingItems(false);
      setIsSavingRemarks(false);
    }
  }

  const currentSaveHandler = isEditingAllSections
    ? handleSaveAll
    : isEditingItems
      ? handleSaveItems
      : isEditingRemarks
        ? handleSaveRemarks
        : handleSaveContact;
  const currentCancelHandler = isEditingAllSections
    ? resetAllForms
    : isEditingItems
      ? resetItemsForm
      : isEditingRemarks
        ? resetRemarksForm
        : resetContactForm;
  const isSavingCurrentSection = isEditingAllSections
    ? isSavingContact || isSavingItems || isSavingRemarks
    : isEditingItems
      ? isSavingItems
      : isEditingRemarks
        ? isSavingRemarks
        : isSavingContact;
  const currentSaveLabel = isEditingAllSections
    ? isSavingCurrentSection
      ? '保存订单中...'
      : '保存修改'
    : isEditingItems
      ? isSavingItems
        ? '保存商品中...'
        : '保存修改'
      : isEditingRemarks
        ? isSavingRemarks
          ? '保存备注中...'
          : '保存修改'
        : isSavingContact
          ? '保存信息中...'
          : '保存修改';

  function stepEditableItemQty(index: number, delta: number) {
    setEditableItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              qty: Math.max(1, item.qty + delta),
              amount: (item.rate ?? 0) * Math.max(1, item.qty + delta),
            }
          : item,
      ),
    );
  }

  function cycleEditableItemUom(index: number) {
    setEditableItems((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        const availableUoms = itemUomOptions[item.itemCode] ?? [];
        if (availableUoms.length <= 1) {
          return item;
        }

        const currentIndex = Math.max(availableUoms.indexOf(item.uom), 0);
        const nextUom = availableUoms[(currentIndex + 1) % availableUoms.length] ?? item.uom;

        return {
          ...item,
          uom: nextUom,
        };
      }),
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.topIconButton}>
            <IconSymbol color="#0F172A" name="chevron.left" size={22} />
          </Pressable>
          <ThemedText style={styles.pageTitle} type="title">
            销售单详情
          </ThemedText>
          {isEditingAnySection ? (
            <View style={styles.topActionPlaceholder} />
          ) : (
            <Pressable
              accessibilityRole="button"
              disabled={workflowAction.disabled}
              onPress={workflowAction.onPress}
              style={[
                styles.topActionButton,
                workflowAction.tone === 'primary' ? styles.topActionPrimaryButton : styles.topActionGhostButton,
                workflowAction.tone === 'ghost' ? { borderColor } : null,
              ]}
            >
              <ThemedText
                style={workflowAction.tone === 'primary' ? styles.topActionPrimaryText : styles.topActionGhostText}
                type="defaultSemiBold"
              >
                {workflowAction.label}
              </ThemedText>
            </Pressable>
          )}
        </View>

        <View style={[styles.heroCard, { backgroundColor: surface, borderColor }]}>
          <View style={styles.heroHeader}>
            <View style={styles.heroCopy}>
              <ThemedText style={styles.heroTitle} type="defaultSemiBold">
                {detail?.customer || '销售客户'}
              </ThemedText>
              <ThemedText style={styles.heroSubline}>{detail?.name || orderName || '—'}</ThemedText>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusTone.backgroundColor }]}>
              <ThemedText style={[styles.statusBadgeText, { color: statusTone.color }]} type="defaultSemiBold">
                {businessStatus}
              </ThemedText>
            </View>
          </View>

          <View style={styles.heroMetrics}>
            <View style={styles.metricCard}>
              <ThemedText style={styles.metricLabel}>订单金额</ThemedText>
              <ThemedText style={styles.metricValue} type="defaultSemiBold">
                {formatCurrencyValue(detail?.grandTotal ?? null, detail?.currency || 'CNY')}
              </ThemedText>
            </View>
            <View style={styles.metricCard}>
              <ThemedText style={styles.metricLabel}>未收金额</ThemedText>
              <ThemedText style={styles.metricValue} type="defaultSemiBold">
                {formatCurrencyValue(detail?.outstandingAmount ?? null, detail?.currency || 'CNY')}
              </ThemedText>
            </View>
            <View style={styles.metricCard}>
              <ThemedText style={styles.metricLabel}>下单日期</ThemedText>
              <ThemedText style={styles.metricValueSmall} type="defaultSemiBold">
                {detail?.transactionDate || '—'}
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
          <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
            订单概览
          </ThemedText>
          <InfoRow label="公司" value={detail?.company || '—'} />
          <InfoRow label="单据状态" value={detail?.documentStatus || '—'} />
          <InfoRow label="履约状态" value={detail?.fulfillmentStatus || '—'} />
          <InfoRow label="收款状态" value={detail?.paymentStatus || '—'} />
          <InfoRow label="交货日期" value={detail?.deliveryDate || '未设置'} />
        </View>

        <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
              收货与联系人
            </ThemedText>
            <Pressable onPress={isEditingContact ? resetContactForm : startEditingContact} style={styles.linkButton}>
              <ThemedText style={[styles.linkButtonText, { color: tintColor }]} type="defaultSemiBold">
                {isEditingContact ? '取消' : '修改'}
              </ThemedText>
            </Pressable>
          </View>

          {isEditingContact ? (
            <View style={styles.formBlock}>
              <View style={[styles.editField, { backgroundColor: surfaceMuted }]}>
                <ThemedText style={styles.editFieldLabel}>收货人 / 联系展示名</ThemedText>
                <TextInput
                  onChangeText={setContactDisplayInput}
                  placeholder="输入收货人"
                  placeholderTextColor="#9AA3B2"
                  style={styles.editInput}
                  value={contactDisplayInput}
                />
              </View>

              <View style={[styles.editField, { backgroundColor: surfaceMuted }]}>
                <ThemedText style={styles.editFieldLabel}>联系电话</ThemedText>
                <TextInput
                  onChangeText={setContactPhoneInput}
                  placeholder="输入联系电话"
                  placeholderTextColor="#9AA3B2"
                  style={styles.editInput}
                  value={contactPhoneInput}
                />
              </View>

              <View style={[styles.editField, { backgroundColor: surfaceMuted }]}>
                <ThemedText style={styles.editFieldLabel}>交货日期</ThemedText>
                <TextInput
                  onChangeText={setDeliveryDateInput}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9AA3B2"
                  style={styles.editInput}
                  value={deliveryDateInput}
                />
              </View>

              <View style={[styles.editField, styles.textareaField, { backgroundColor: surfaceMuted }]}>
                <ThemedText style={styles.editFieldLabel}>收货地址快照</ThemedText>
                <TextInput
                  multiline
                  numberOfLines={4}
                  onChangeText={setAddressInput}
                  placeholder="输入本单收货地址"
                  placeholderTextColor="#9AA3B2"
                  style={[styles.editInput, styles.textareaInput]}
                  textAlignVertical="top"
                  value={addressInput}
                />
              </View>

            </View>
          ) : (
            <View style={styles.infoStack}>
              <InfoRow label="收货人" value={detail?.contactDisplay || detail?.contactPerson || '未配置'} />
              <InfoRow label="联系电话" value={detail?.contactPhone || '未配置'} />
              <InfoRow label="收货地址" value={detail?.addressDisplay || '未配置收货地址'} />
            </View>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
              销售商品
            </ThemedText>
            <Pressable onPress={isEditingItems ? resetItemsForm : startEditingItems} style={styles.linkButton}>
              <ThemedText style={[styles.linkButtonText, { color: tintColor }]} type="defaultSemiBold">
                {isEditingItems ? '取消' : '修改商品'}
              </ThemedText>
            </Pressable>
          </View>

          {isEditingItems ? (
            <View style={styles.quickActionsCard}>
              <Pressable
                onPress={openProductSearch}
                style={[styles.quickActionButton, { backgroundColor: surfaceMuted, borderColor }]}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: surfaceMuted }]}>
                  <IconSymbol color={tintColor} name="cart.fill.badge.plus" size={18} />
                </View>
                <View style={styles.quickActionCopy}>
                  <ThemedText style={styles.quickActionLabel} type="defaultSemiBold">
                    添加或替换商品
                  </ThemedText>
                  <ThemedText style={styles.quickActionHint}>和创建订单一样，从专门搜索页选择商品</ThemedText>
                </View>
                <IconSymbol color={tintColor} name="chevron.right" size={18} />
              </Pressable>
            </View>
          ) : null}
          <View style={styles.goodsList}>
            {detail?.items?.length ? (
              (isEditingItems ? editableItems : detail.items).map((item, index) =>
                isEditingItems ? (
                  <EditableSalesItemRow
                    currency={detail?.currency || 'CNY'}
                    item={item as EditableOrderItem}
                    key={`${item.itemCode}-${index}`}
                    surface={surface}
                    onChangePrice={(value) =>
                      updateEditableItem(index, {
                        rate: value.trim() ? Number(value) || 0 : null,
                      })
                    }
                    onChangeQty={(value) =>
                      updateEditableItem(index, {
                        qty: Math.max(1, Number(value.replace(/[^0-9]/g, '')) || 1),
                      })
                    }
                    onDecreaseQty={() => stepEditableItemQty(index, -1)}
                    onIncreaseQty={() => stepEditableItemQty(index, 1)}
                    onCycleUom={() => cycleEditableItemUom(index)}
                    availableUoms={itemUomOptions[(item as EditableOrderItem).itemCode] ?? []}
                    onRemove={() => removeEditableItem(index)}
                    surfaceMuted={surfaceMuted}
                    tintColor={tintColor}
                  />
                ) : (
                  <View key={`${item.itemCode}-${index}`} style={styles.goodsListItem}>
                    <View style={styles.goodsRow}>
                      {item.imageUrl ? (
                        <Image source={{ uri: item.imageUrl }} style={styles.goodsImage} />
                      ) : (
                        <View style={[styles.goodsImage, styles.imageFallback, { backgroundColor: surfaceMuted }]}>
                          <IconSymbol color="#94A3B8" name="photo" size={20} />
                        </View>
                      )}
                      <View style={styles.goodsBody}>
                        <ThemedText style={styles.goodsName} type="defaultSemiBold">
                          {item.itemName || item.itemCode}
                        </ThemedText>
                        <ThemedText style={styles.goodsSubMeta}>{item.warehouse || '未指定仓库'}</ThemedText>
                        <View style={styles.goodsMetricsRow}>
                          <ThemedText style={styles.goodsPriceValue} type="defaultSemiBold">
                            {formatCurrencyValue(item.rate, detail?.currency || 'CNY')}
                          </ThemedText>
                          <ThemedText style={styles.metricMultiply}>x</ThemedText>
                          <ThemedText style={styles.goodsQtyValue} type="defaultSemiBold">
                            {item.qty ?? '—'}
                          </ThemedText>
                          <ThemedText style={styles.goodsUomValue} type="defaultSemiBold">
                            {formatDisplayUom(item.uom)}
                          </ThemedText>
                        </View>
                      </View>
                      <ThemedText style={styles.goodsAmount} type="defaultSemiBold">
                        {formatCurrencyValue(item.amount, detail?.currency || 'CNY')}
                      </ThemedText>
                    </View>
                    {index < detail.items.length - 1 ? (
                      <View style={[styles.goodsDivider, { backgroundColor: borderColor }]} />
                    ) : null}
                  </View>
                ),
              )
            ) : (
              <ThemedText style={styles.emptyText}>暂无商品明细</ThemedText>
            )}
          </View>

          <View style={[styles.divider, { backgroundColor: borderColor }]} />
          <InfoRow label="商品合计" value={`${totalQuantity} 件`} />
        </View>

        <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
          <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
            金额结算
          </ThemedText>
          <InfoRow label="订单金额" value={formatCurrencyValue(detail?.grandTotal ?? null, detail?.currency || 'CNY')} />
          <InfoRow label="已收金额" value={formatCurrencyValue(detail?.paidAmount ?? null, detail?.currency || 'CNY')} />
          <InfoRow label="未收金额" value={formatCurrencyValue(detail?.outstandingAmount ?? null, detail?.currency || 'CNY')} />
          {isEditingItems ? (
            <InfoRow label="商品编辑后金额" value={formatCurrencyValue(editingGrandTotal, detail?.currency || 'CNY')} />
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
              订单备注
            </ThemedText>
            <Pressable onPress={isEditingRemarks ? resetRemarksForm : startEditingRemarks} style={styles.linkButton}>
              <ThemedText style={[styles.linkButtonText, { color: tintColor }]} type="defaultSemiBold">
                {isEditingRemarks ? '取消' : '修改'}
              </ThemedText>
            </Pressable>
          </View>
          {isEditingRemarks ? (
            <View>
              <View style={[styles.editField, styles.textareaField, { backgroundColor: surfaceMuted }]}>
                <ThemedText style={styles.editFieldLabel}>本单备注</ThemedText>
                <TextInput
                  multiline
                  numberOfLines={5}
                  onChangeText={setRemarksInput}
                  placeholder="输入订单备注"
                  placeholderTextColor="#9AA3B2"
                  style={[styles.editInput, styles.textareaInput]}
                  textAlignVertical="top"
                  value={remarksInput}
                />
              </View>
            </View>
          ) : (
            <ThemedText style={styles.noteText}>{detail?.remarks || '暂无备注'}</ThemedText>
          )}
        </View>

        {message ? <ThemedText style={styles.messageText}>{message}</ThemedText> : null}
      </ScrollView>

      <View style={[styles.bottomBar, { backgroundColor: background, borderTopColor: borderColor }]}>
        {isEditingAnySection ? (
          <>
            <Pressable
              accessibilityRole="button"
              disabled={isSavingCurrentSection}
              onPress={currentCancelHandler}
              style={[styles.bottomButton, styles.bottomGhostButton, { borderColor }]}
            >
              <ThemedText style={styles.bottomGhostText}>取消修改</ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isSavingCurrentSection}
              onPress={currentSaveHandler}
              style={[styles.bottomButton, styles.bottomPrimaryButton]}
            >
              <ThemedText style={styles.bottomPrimaryText}>{currentSaveLabel}</ThemedText>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              accessibilityRole="button"
              disabled={isCancelling || isSubmittingDelivery || isCreatingInvoice || detail?.documentStatus === 'cancelled'}
              onPress={handleCancelOrder}
              style={[styles.bottomButton, styles.bottomDangerButton]}
            >
              <ThemedText style={styles.bottomDangerText}>
                {isCancelling ? '作废中...' : detail?.documentStatus === 'cancelled' ? '已作废' : '作废订单'}
              </ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={detail?.documentStatus === 'cancelled'}
              onPress={startEditingAll}
              style={[styles.bottomButton, styles.bottomPrimaryButton]}
            >
              <ThemedText style={styles.bottomPrimaryText}>编辑订单</ThemedText>
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
    paddingBottom: 112,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  topIconButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  topActionPlaceholder: {
    width: 72,
  },
  topActionButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 36,
    minWidth: 72,
    paddingHorizontal: 14,
  },
  topActionGhostButton: {
    backgroundColor: '#FFFFFF',
  },
  topActionPrimaryButton: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  topActionGhostText: {
    color: '#0F172A',
    fontSize: 13,
  },
  topActionPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13,
  },
  pageTitle: {
    flex: 1,
    fontSize: 20,
    textAlign: 'center',
  },
  heroCard: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 16,
    padding: 16,
  },
  heroHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroCopy: {
    flex: 1,
    gap: 6,
  },
  heroTitle: {
    fontSize: 20,
  },
  heroSubline: {
    color: '#64748B',
    fontSize: 13,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusBadgeText: {
    fontSize: 12,
  },
  heroMetrics: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    flex: 1,
    gap: 6,
    padding: 12,
  },
  metricLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  metricValue: {
    color: '#0F172A',
    fontSize: 16,
  },
  metricValueSmall: {
    color: '#0F172A',
    fontSize: 14,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 17,
  },
  linkButton: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  linkButtonText: {
    fontSize: 14,
  },
  infoStack: {
    gap: 10,
  },
  infoRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  infoLabel: {
    color: '#475569',
    fontSize: 14,
  },
  infoValue: {
    color: '#0F172A',
    flex: 1,
    fontSize: 15,
    textAlign: 'right',
  },
  goodsList: {
    gap: 12,
  },
  goodsListItem: {
    gap: 12,
  },
  goodsRow: {
    flexDirection: 'row',
    gap: 14,
  },
  goodsDivider: {
    height: 1,
    marginLeft: 74,
    opacity: 0.8,
  },
  editItemCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  editItemRow: {
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
    gap: 6,
    justifyContent: 'center',
  },
  editItemMain: {
    flex: 1,
    gap: 8,
    justifyContent: 'center',
  },
  editItemHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  editItemHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  editItemHeaderAside: {
    alignItems: 'flex-end',
    gap: 6,
    paddingLeft: 12,
  },
  editItemControls: {
    gap: 8,
  },
  editItemControlRow: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: 8,
  },
  goodsName: {
    fontSize: 15,
    lineHeight: 20,
  },
  goodsSubMeta: {
    color: '#64748B',
    fontSize: 13,
  },
  goodsMetricsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  goodsPriceValue: {
    color: '#A86518',
    fontSize: 14,
  },
  metricMultiply: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  goodsQtyValue: {
    color: '#2563EB',
    fontSize: 15,
  },
  goodsUomValue: {
    color: '#0F172A',
    fontSize: 13,
  },
  goodsAmount: {
    alignSelf: 'center',
    color: '#A86518',
    fontSize: 16,
    paddingLeft: 12,
  },
  inlineField: {
    borderRadius: 12,
    gap: 4,
    minHeight: 50,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  qtyField: {
    flex: 1.05,
  },
  uomField: {
    flex: 0.62,
  },
  inlineFieldLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  inlineFieldInput: {
    color: '#0F172A',
    fontSize: 14,
    padding: 0,
  },
  qtyStepper: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  qtyStepperButton: {
    alignItems: 'center',
    borderRadius: 10,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  qtyStepperButtonText: {
    fontSize: 20,
    lineHeight: 20,
  },
  qtyStepperInput: {
    color: '#0F172A',
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    minWidth: 28,
    padding: 0,
    textAlign: 'center',
  },
  priceChipField: {
    borderRadius: 14,
    flex: 0.82,
    gap: 4,
    minHeight: 50,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  priceChipContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  pricePrefix: {
    color: '#A86518',
    fontSize: 16,
  },
  priceChipInput: {
    color: '#0F172A',
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    padding: 0,
  },
  inlineStaticValue: {
    color: '#0F172A',
    fontSize: 16,
  },
  uomSwitcher: {
    alignItems: 'flex-start',
    gap: 2,
  },
  uomSwitcherDisabled: {
    opacity: 0.8,
  },
  uomHint: {
    fontSize: 11,
  },
  removeInlineButton: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  removeInlineText: {
    color: '#B91C1C',
    fontSize: 13,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
  },
  addProductPanel: {
    gap: 10,
  },
  quickActionsCard: {
    marginBottom: 10,
  },
  quickActionButton: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  quickActionIcon: {
    alignItems: 'center',
    borderRadius: 14,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  quickActionCopy: {
    flex: 1,
  },
  quickActionLabel: {
    color: '#0F172A',
    fontSize: 15,
  },
  quickActionHint: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  addProductSearchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  addProductSearchInput: {
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    fontSize: 14,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addProductSearchButton: {
    alignItems: 'center',
    borderRadius: 14,
    justifyContent: 'center',
    minWidth: 76,
    paddingHorizontal: 12,
  },
  addProductSearchButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
  },
  addProductResult: {
    alignItems: 'center',
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addProductResultCopy: {
    flex: 1,
    gap: 4,
    paddingRight: 10,
  },
  addProductResultTitle: {
    fontSize: 14,
  },
  addProductResultMeta: {
    color: '#64748B',
    fontSize: 12,
  },
  addProductResultPrice: {
    fontSize: 13,
  },
  divider: {
    height: 1,
    width: '100%',
  },
  formBlock: {
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
  textareaField: {
    minHeight: 128,
  },
  textareaInput: {
    minHeight: 90,
  },
  noteText: {
    color: '#0F172A',
    fontSize: 15,
    lineHeight: 22,
    minHeight: 72,
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
    minHeight: 52,
  },
  bottomSingleButton: {
    flex: 1,
  },
  bottomGhostButton: {
    backgroundColor: '#FFFFFF',
  },
  bottomPrimaryButton: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  bottomDangerButton: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FCA5A5',
  },
  bottomGhostText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '700',
  },
  bottomPrimaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  bottomDangerText: {
    color: '#B91C1C',
    fontSize: 15,
    fontWeight: '700',
  },
});
