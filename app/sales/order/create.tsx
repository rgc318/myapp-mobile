import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { LinkOptionInput } from '@/components/link-option-input';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getAppPreferences } from '@/lib/app-preferences';
import {
  addItemToSalesOrderDraft,
  clearSalesOrderDraft,
  getSalesOrderDraft,
  removeSalesOrderDraftItem,
  updateSalesOrderDraftField,
  updateSalesOrderDraftQty,
} from '@/lib/sales-order-draft';
import { useAuth } from '@/providers/auth-provider';
import { createSalesOrder, searchProducts, type ProductSearchItem } from '@/services/gateway';
import { checkLinkOptionExists, searchLinkOptions } from '@/services/master-data';

function TopFieldRow({
  label,
  value,
  errorText,
  helperText,
  placeholder,
  loadOptions,
  onChangeText,
}: {
  label: string;
  value: string;
  errorText?: string;
  helperText?: string;
  placeholder: string;
  loadOptions: (query: string) => Promise<any[]>;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.topFieldRow}>
      <ThemedText style={styles.topFieldLabel} type="defaultSemiBold">
        {label}
      </ThemedText>
      <View style={styles.topFieldInputWrap}>
        <LinkOptionInput
          errorText={errorText}
          helperText={helperText}
          label=""
          loadOptions={loadOptions}
          onChangeText={onChangeText}
          placeholder={placeholder}
          value={value}
        />
      </View>
    </View>
  );
}

function SalesItemRow({
  itemCode,
  itemName,
  price,
  qty,
  onChangePrice,
  onChangeQty,
  onRemove,
}: {
  itemCode: string;
  itemName: string;
  price: number | null;
  qty: number;
  onChangePrice: (value: string) => void;
  onChangeQty: (value: string) => void;
  onRemove: () => void;
}) {
  const surface = useThemeColor({}, 'surface');
  const borderColor = useThemeColor({}, 'border');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const dangerColor = useThemeColor({}, 'danger');

  return (
    <View style={[styles.itemRow, { backgroundColor: surface, borderColor }]}>
      <View style={styles.itemMain}>
        <ThemedText numberOfLines={1} type="defaultSemiBold">
          {itemName || itemCode}
        </ThemedText>
        <ThemedText style={styles.itemSubline}>编码：{itemCode}</ThemedText>
        <View style={styles.itemEditRow}>
          <TextInput
            keyboardType="numeric"
            onChangeText={onChangeQty}
            style={[styles.itemInput, { backgroundColor: surfaceMuted, borderColor }]}
            value={String(qty)}
          />
          <TextInput
            keyboardType="numeric"
            onChangeText={onChangePrice}
            style={[styles.itemInput, { backgroundColor: surfaceMuted, borderColor }]}
            value={price === null ? '' : String(price)}
          />
        </View>
      </View>

      <View style={styles.itemAside}>
        <ThemedText type="defaultSemiBold">￥{price ?? 0}</ThemedText>
        <Pressable onPress={onRemove} style={styles.removeTextButton}>
          <ThemedText style={[styles.removeText, { color: dangerColor }]}>删除</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

export default function SalesOrderCreateScreen() {
  const preferences = getAppPreferences();
  const { profile } = useAuth();
  const [customer, setCustomer] = useState('Palmer Productions Ltd.');
  const [company, setCompany] = useState(preferences.defaultCompany);
  const [warehouse, setWarehouse] = useState(preferences.defaultWarehouse);
  const [postingDate, setPostingDate] = useState(new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState('');
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<ProductSearchItem[]>([]);
  const [draftItems, setDraftItems] = useState(getSalesOrderDraft());
  const [message, setMessage] = useState('');
  const [customerError, setCustomerError] = useState('');
  const [companyError, setCompanyError] = useState('');
  const [warehouseError, setWarehouseError] = useState('');
  const [showOrderMeta, setShowOrderMeta] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const surface = useThemeColor({}, 'surface');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');
  const background = useThemeColor({}, 'background');

  const syncDraft = () => {
    setDraftItems([...getSalesOrderDraft()]);
  };

  const handleSearch = async () => {
    const query = searchText.trim();
    if (!query) {
      setMessage('请输入商品名称或商品编号。');
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      const items = await searchProducts(query, { company, warehouse, limit: 8 });
      setSearchResults(items);
      setMessage(items.length ? `找到 ${items.length} 个商品。` : '没有找到匹配商品。');
    } catch (error) {
      setSearchResults([]);
      setMessage(error instanceof Error ? error.message : '商品搜索失败。');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddItem = (item: ProductSearchItem) => {
    addItemToSalesOrderDraft(item);
    updateSalesOrderDraftField(item.itemCode, 'warehouse', warehouse || item.warehouse || '');
    syncDraft();
    setMessage(`已将 ${item.itemName || item.itemCode} 加入销售商品。`);
  };

  const handleSubmit = async () => {
    setCustomerError('');
    setCompanyError('');
    setWarehouseError('');

    if (!customer.trim()) {
      setCustomerError('客户不能为空。');
      return;
    }
    if (!(await checkLinkOptionExists('Customer', customer))) {
      setCustomerError('客户不存在，请从候选项中选择有效客户。');
      return;
    }
    if (!company.trim()) {
      setCompanyError('公司不能为空。');
      return;
    }
    if (!(await checkLinkOptionExists('Company', company))) {
      setCompanyError('公司不存在，请从候选项中选择有效公司。');
      return;
    }
    if (!warehouse.trim()) {
      setWarehouseError('仓库不能为空。');
      return;
    }
    if (!(await checkLinkOptionExists('Warehouse', warehouse))) {
      setWarehouseError('仓库不存在，请从候选项中选择有效仓库。');
      return;
    }
    if (!draftItems.length) {
      setMessage('请先添加商品。');
      return;
    }

    try {
      const result = await createSalesOrder({
        customer,
        company,
        posting_date: postingDate,
        remarks,
        items: draftItems.map((item) => ({
          item_code: item.itemCode,
          qty: item.qty,
          price: item.price ?? undefined,
          warehouse: item.warehouse || warehouse,
          uom: item.uom ?? undefined,
        })),
      });
      clearSalesOrderDraft();
      setDraftItems([]);
      setSearchResults([]);
      setMessage(`销售订单已创建：${result?.order || result?.sales_order || '已提交'}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '销售下单失败。');
    }
  };

  const totalQty = draftItems.reduce((sum, item) => sum + item.qty, 0);
  const totalAmount = draftItems.reduce((sum, item) => sum + (item.price ?? 0) * item.qty, 0);

  return (
    <View style={[styles.page, { backgroundColor: background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.navBar, { backgroundColor: background }]}>
          <ThemedText style={styles.navAction}>×</ThemedText>
          <ThemedText style={styles.navTitle} type="defaultSemiBold">
            销售单
          </ThemedText>
          <ThemedText style={[styles.navAction, { color: '#7C3AED' }]} type="defaultSemiBold">
            AI开单
          </ThemedText>
        </View>

        <View style={[styles.infoPanel, { backgroundColor: surface, borderColor }]}>
          <TopFieldRow
            errorText={customerError}
            helperText=""
            label="客户"
            loadOptions={(query) => searchLinkOptions('Customer', query, ['customer_name'])}
            onChangeText={(value) => {
              setCustomer(value);
              if (customerError) {
                setCustomerError('');
              }
            }}
            placeholder="搜索客户"
            value={customer}
          />

          <View style={styles.simpleInfoRow}>
            <ThemedText style={styles.simpleInfoLabel} type="defaultSemiBold">
              时间
            </ThemedText>
            <TextInput
              onChangeText={setPostingDate}
              style={[styles.simpleInfoInput, { backgroundColor: surfaceMuted, borderColor }]}
              value={postingDate}
            />
          </View>

          <View style={styles.simpleInfoRow}>
            <ThemedText style={styles.simpleInfoLabel} type="defaultSemiBold">
              业务员
            </ThemedText>
            <ThemedText type="defaultSemiBold">{profile?.fullName || profile?.username || '当前账号'}</ThemedText>
          </View>
        </View>

        <View style={[styles.chooseBar, { backgroundColor: surface, borderColor }]}>
          <Pressable onPress={() => void handleSearch()} style={styles.chooseBarButton}>
            <IconSymbol color={tintColor} name="cart.fill" size={18} />
            <ThemedText type="defaultSemiBold">选择商品</ThemedText>
          </Pressable>
          <View style={[styles.chooseDivider, { backgroundColor: borderColor }]} />
          <Pressable style={styles.chooseBarButton}>
            <IconSymbol color={tintColor} name="magnifyingglass" size={18} />
            <ThemedText type="defaultSemiBold">扫码添加</ThemedText>
          </Pressable>
        </View>

        <View style={[styles.goodsSection, { backgroundColor: surface, borderColor }]}>
          <View style={styles.goodsHeader}>
            <View style={[styles.goodsAccent, { backgroundColor: tintColor }]} />
            <ThemedText type="defaultSemiBold">销售商品</ThemedText>
          </View>

          <View style={[styles.goodsSearchBar, { backgroundColor: surfaceMuted, borderColor }]}>
            <IconSymbol color={tintColor} name="magnifyingglass" size={18} />
            <TextInput
              autoCorrect={false}
              onChangeText={setSearchText}
              onSubmitEditing={() => void handleSearch()}
              placeholder="搜索商品名称 / 商品编号"
              placeholderTextColor="rgba(31,42,55,0.42)"
              style={styles.goodsSearchInput}
              value={searchText}
            />
            <Pressable onPress={() => void handleSearch()} style={[styles.goodsSearchButton, { backgroundColor: tintColor }]}>
              <ThemedText style={styles.goodsSearchButtonText} type="defaultSemiBold">
                {isSearching ? '搜索中' : '搜索'}
              </ThemedText>
            </Pressable>
          </View>

          {searchResults.length ? (
            <View style={styles.resultList}>
              {searchResults.map((item) => (
                <View key={item.itemCode} style={[styles.resultRow, { borderColor }]}>
                  <View style={styles.resultMain}>
                    <ThemedText numberOfLines={1} type="defaultSemiBold">
                      {item.itemName || item.itemCode}
                    </ThemedText>
                    <ThemedText style={styles.resultMeta}>
                      {item.itemCode} / 库存 {item.stockQty ?? '-'} / ￥{item.price ?? '-'}
                    </ThemedText>
                  </View>
                  <Pressable onPress={() => handleAddItem(item)} style={styles.resultAddTextButton}>
                    <ThemedText style={[styles.resultAddText, { color: tintColor }]} type="defaultSemiBold">
                      加入
                    </ThemedText>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          {draftItems.map((item) => (
            <SalesItemRow
              itemCode={item.itemCode}
              itemName={item.itemName}
              key={item.itemCode}
              onChangePrice={(value) => {
                updateSalesOrderDraftField(item.itemCode, 'price', value.trim() ? Number(value) || 0 : null);
                syncDraft();
              }}
              onChangeQty={(value) => {
                updateSalesOrderDraftQty(item.itemCode, Math.max(0, Number(value) || 0));
                syncDraft();
              }}
              onRemove={() => {
                removeSalesOrderDraftItem(item.itemCode);
                syncDraft();
              }}
              price={item.price}
              qty={item.qty}
            />
          ))}

          {!draftItems.length ? (
            <View style={styles.emptyGoods}>
              <ThemedText>还没有销售商品，请先选择商品。</ThemedText>
            </View>
          ) : null}

          <View style={[styles.summaryBar, { borderColor }]}>
            <ThemedText>合计 已选 {totalQty}</ThemedText>
            <ThemedText type="defaultSemiBold">￥ {totalAmount.toFixed(2)}</ThemedText>
          </View>
        </View>

        <View style={[styles.metaSection, { backgroundColor: surface, borderColor }]}>
          <Pressable onPress={() => setShowOrderMeta((value) => !value)} style={styles.metaToggleRow}>
            <ThemedText type="defaultSemiBold">发货信息</ThemedText>
            <ThemedText>{showOrderMeta ? '收起' : '展开'}</ThemedText>
          </Pressable>

          {showOrderMeta ? (
            <View style={styles.metaForm}>
              <LinkOptionInput
                errorText={companyError}
                helperText=""
                label="公司"
                loadOptions={(query) => searchLinkOptions('Company', query, ['abbr'])}
                onChangeText={(value) => {
                  setCompany(value);
                  if (companyError) {
                    setCompanyError('');
                  }
                }}
                placeholder="搜索公司"
                value={company}
              />
              <LinkOptionInput
                errorText={warehouseError}
                helperText=""
                label="仓库"
                loadOptions={(query) => searchLinkOptions('Warehouse', query, ['warehouse_name'])}
                onChangeText={(value) => {
                  setWarehouse(value);
                  if (warehouseError) {
                    setWarehouseError('');
                  }
                }}
                placeholder="搜索仓库"
                value={warehouse}
              />
            </View>
          ) : null}
        </View>

        <View style={[styles.metaSection, { backgroundColor: surface, borderColor }]}>
          <ThemedText type="defaultSemiBold">备注</ThemedText>
          <TextInput
            multiline
            onChangeText={setRemarks}
            placeholder="在这里输入备注..."
            style={[styles.remarksInput, { backgroundColor: surfaceMuted, borderColor }]}
            textAlignVertical="top"
            value={remarks}
          />
        </View>

        {message ? <ThemedText>{message}</ThemedText> : null}
      </ScrollView>

      <View style={[styles.bottomBar, { backgroundColor: surface, borderColor }]}>
        <View style={styles.bottomSummary}>
          <ThemedText style={styles.bottomDue}>应收: ￥ {totalAmount.toFixed(2)}</ThemedText>
          <ThemedText style={styles.bottomPaid}>本次实收: ￥{totalAmount.toFixed(2)}</ThemedText>
        </View>
        <View style={styles.bottomActions}>
          <Pressable style={[styles.bottomGhostButton, { borderColor }]}>
            <ThemedText style={{ color: tintColor }} type="defaultSemiBold">
              收款
            </ThemedText>
          </Pressable>
          <Pressable onPress={() => void handleSubmit()} style={[styles.bottomPrimaryButton, { backgroundColor: tintColor }]}>
            <ThemedText style={styles.bottomPrimaryText} type="defaultSemiBold">
              保存
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  scrollContent: {
    gap: 12,
    padding: 12,
    paddingBottom: 112,
  },
  navBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 34,
    paddingHorizontal: 4,
  },
  navAction: {
    fontSize: 24,
    minWidth: 48,
  },
  navTitle: {
    fontSize: 18,
  },
  infoPanel: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  topFieldRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minHeight: 44,
  },
  topFieldLabel: {
    minWidth: 52,
  },
  topFieldInputWrap: {
    flex: 1,
  },
  simpleInfoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  simpleInfoLabel: {
    minWidth: 52,
  },
  simpleInfoInput: {
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 36,
    minWidth: 120,
    paddingHorizontal: 10,
    textAlign: 'right',
  },
  chooseBar: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: 16,
  },
  chooseBarButton: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 40,
  },
  chooseDivider: {
    height: 24,
    width: StyleSheet.hairlineWidth,
  },
  goodsSection: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  goodsHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  goodsAccent: {
    borderRadius: 999,
    height: 16,
    width: 3,
  },
  goodsSearchBar: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  goodsSearchInput: {
    flex: 1,
    minHeight: 34,
    paddingVertical: 0,
  },
  goodsSearchButton: {
    alignItems: 'center',
    borderRadius: 10,
    justifyContent: 'center',
    minHeight: 30,
    minWidth: 54,
    paddingHorizontal: 10,
  },
  goodsSearchButtonText: {
    color: '#FFF',
  },
  resultList: {
    gap: 6,
  },
  resultRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  resultMain: {
    flex: 1,
    gap: 4,
  },
  resultMeta: {
    opacity: 0.64,
  },
  resultAddTextButton: {
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  resultAddText: {
    fontSize: 13,
  },
  itemRow: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    padding: 10,
  },
  itemMain: {
    flex: 1,
    gap: 4,
  },
  itemSubline: {
    opacity: 0.68,
  },
  itemEditRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  itemInput: {
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 34,
    minWidth: 72,
    paddingHorizontal: 10,
    textAlign: 'center',
  },
  itemAside: {
    alignItems: 'flex-end',
    gap: 8,
    minWidth: 68,
  },
  removeTextButton: {
    paddingVertical: 4,
  },
  removeText: {
    fontSize: 13,
  },
  emptyGoods: {
    paddingVertical: 8,
  },
  summaryBar: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 10,
  },
  metaSection: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  metaToggleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 28,
  },
  metaForm: {
    gap: 10,
  },
  remarksInput: {
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 96,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bottomBar: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    bottom: 0,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    left: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    position: 'absolute',
    right: 0,
  },
  bottomSummary: {
    flex: 1,
    gap: 2,
  },
  bottomDue: {
    color: '#D08A43',
    fontWeight: '700',
  },
  bottomPaid: {
    opacity: 0.7,
  },
  bottomActions: {
    flexDirection: 'row',
    gap: 8,
  },
  bottomGhostButton: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 42,
    minWidth: 72,
    paddingHorizontal: 14,
  },
  bottomPrimaryButton: {
    alignItems: 'center',
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 42,
    minWidth: 72,
    paddingHorizontal: 14,
  },
  bottomPrimaryText: {
    color: '#FFF',
  },
});
