import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

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
import {
  createSalesOrder,
  searchProducts,
  type ProductSearchItem,
} from '@/services/gateway';
import {
  checkLinkOptionExists,
  searchLinkOptions,
  type LinkOption,
} from '@/services/master-data';

const MONEY = new Intl.NumberFormat('zh-CN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type MessageTone = 'info' | 'success' | 'error';

type TopFieldRowProps = {
  label: string;
  value: string;
  errorText?: string;
  helperText?: string;
  placeholder: string;
  loadOptions: (query: string) => Promise<LinkOption[]>;
  onChangeText: (value: string) => void;
};

function formatMoney(value: number) {
  return MONEY.format(value);
}

function TopFieldRow({
                       label,
                       value,
                       errorText,
                       helperText,
                       placeholder,
                       loadOptions,
                       onChangeText,
                     }: TopFieldRowProps) {
  return (
    <View style={styles.infoFieldBlock}>
      <ThemedText style={styles.infoFieldLabel} type="defaultSemiBold">
        {label}
      </ThemedText>
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
  );
}

function SummaryMetric({
                         label,
                         value,
                         valueStyle,
                       }: {
  label: string;
  value: string;
  valueStyle?: any;
}) {
  return (
    <View style={styles.summaryMetric}>
      <ThemedText style={styles.summaryMetricLabel}>{label}</ThemedText>
      <ThemedText style={valueStyle} type="defaultSemiBold">
        {value}
      </ThemedText>
    </View>
  );
}

function SummaryRow({
                      label,
                      value,
                      strong,
                    }: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.amountRow}>
      <ThemedText style={strong ? styles.amountLabelStrong : styles.amountLabel}>
        {label}
      </ThemedText>
      <ThemedText
        style={strong ? styles.amountValueStrong : styles.amountValue}
        type="defaultSemiBold">
        {value}
      </ThemedText>
    </View>
  );
}

function SearchResultRow({
                           item,
                           onAdd,
                         }: {
  item: ProductSearchItem;
  onAdd: (item: ProductSearchItem) => void;
}) {
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');

  return (
    <View style={[styles.searchResultRow, { borderColor }]}>
      <View
        style={[styles.searchResultThumb, { backgroundColor: surfaceMuted }]}>
        <IconSymbol color={tintColor} name="shippingbox.fill" size={18} />
      </View>

      <View style={styles.searchResultMain}>
        <ThemedText numberOfLines={1} type="defaultSemiBold">
          {item.itemName || item.itemCode}
        </ThemedText>
        <ThemedText style={styles.searchResultMeta}>
          {item.itemCode} · 库存 {item.stockQty ?? '-'} · {item.uom || '件'}
        </ThemedText>
      </View>

      <View style={styles.searchResultAside}>
        <ThemedText style={styles.searchResultPrice} type="defaultSemiBold">
          ¥ {item.price ?? '-'}
        </ThemedText>
        <Pressable onPress={() => onAdd(item)} style={styles.textActionButton}>
          <ThemedText
            style={[styles.textAction, { color: tintColor }]}
            type="defaultSemiBold">
            加入
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

function SalesItemRow({
                        itemCode,
                        itemName,
                        price,
                        qty,
                        warehouse,
                        onChangePrice,
                        onChangeQty,
                        onRemove,
                      }: {
  itemCode: string;
  itemName: string;
  price: number | null;
  qty: number;
  warehouse?: string | null;
  onChangePrice: (value: string) => void;
  onChangeQty: (value: string) => void;
  onRemove: () => void;
}) {
  const surface = useThemeColor({}, 'surface');
  const borderColor = useThemeColor({}, 'border');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const dangerColor = useThemeColor({}, 'danger');
  const lineAmount = (price ?? 0) * qty;

  return (
    <View style={[styles.itemRow, { backgroundColor: surface, borderColor }]}>
      <View style={[styles.itemThumb, { backgroundColor: surfaceMuted }]}>
        <IconSymbol color="#28B7D7" name="shippingbox.fill" size={20} />
      </View>

      <View style={styles.itemMain}>
        <View style={styles.itemTitleRow}>
          <ThemedText numberOfLines={1} style={styles.itemTitle} type="defaultSemiBold">
            {itemName || itemCode}
          </ThemedText>
          <ThemedText style={styles.itemAmountInline} type="defaultSemiBold">
            ¥ {formatMoney(lineAmount)}
          </ThemedText>
        </View>

        <ThemedText style={styles.itemSubline}>编码 {itemCode}</ThemedText>
        <ThemedText style={styles.itemSubline}>
          仓库 {warehouse || '未设置'}
        </ThemedText>

        <View style={styles.itemEditRow}>
          <View style={styles.itemEditBlock}>
            <ThemedText style={styles.itemEditLabel}>数量</ThemedText>
            <TextInput
              keyboardType="numeric"
              onChangeText={onChangeQty}
              style={[styles.itemInput, { backgroundColor: surfaceMuted, borderColor }]}
              value={String(qty)}
            />
          </View>

          <View style={styles.itemEditBlock}>
            <ThemedText style={styles.itemEditLabel}>单价</ThemedText>
            <TextInput
              keyboardType="numeric"
              onChangeText={onChangePrice}
              style={[styles.itemInput, { backgroundColor: surfaceMuted, borderColor }]}
              value={price === null ? '' : String(price)}
            />
          </View>

          <Pressable onPress={onRemove} style={styles.removeButton}>
            <ThemedText style={[styles.textAction, { color: dangerColor }]}>
              删除
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function SalesOrderCreateScreen() {
  const router = useRouter();
  const preferences = getAppPreferences();
  const { profile } = useAuth();

  const [customer, setCustomer] = useState('Palmer Productions Ltd.');
  const [company, setCompany] = useState(preferences.defaultCompany);
  const [remarks, setRemarks] = useState('');
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<ProductSearchItem[]>([]);
  const [draftItems, setDraftItems] = useState(getSalesOrderDraft());
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<MessageTone>('info');
  const [customerError, setCustomerError] = useState('');
  const [companyError, setCompanyError] = useState('');
  const [showOrderMeta, setShowOrderMeta] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const postingDate = new Date().toISOString().slice(0, 10);

  const surface = useThemeColor({}, 'surface');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');
  const background = useThemeColor({}, 'background');
  const accentSoft = useThemeColor({}, 'accentSoft');
  const dangerColor = useThemeColor({}, 'danger');

  const syncDraft = () => {
    setDraftItems([...getSalesOrderDraft()]);
  };

  const setStatusMessage = (text: string, tone: MessageTone) => {
    setMessage(text);
    setMessageTone(tone);
  };

  const totalQty = useMemo(
    () => draftItems.reduce((sum, item) => sum + item.qty, 0),
    [draftItems],
  );

  const goodsAmount = useMemo(
    () => draftItems.reduce((sum, item) => sum + (item.price ?? 0) * item.qty, 0),
    [draftItems],
  );

  const discountAmount = 0;
  const freightAmount = 0;
  const receivableAmount = goodsAmount - discountAmount + freightAmount;
  const paidNowAmount = 0;

  const loadCustomers = (query: string) => searchLinkOptions('Customer', query);
  const loadCompanies = (query: string) => searchLinkOptions('Company', query);

  const addProduct = (item: ProductSearchItem) => {
    addItemToSalesOrderDraft(item);
    syncDraft();
    setStatusMessage('', 'info');
  };

  const handleSearch = async () => {
    const keyword = searchText.trim();

    if (!keyword) {
      setSearchResults([]);
      setStatusMessage('请先输入商品名称或商品编码。', 'error');
      return;
    }

    setIsSearching(true);
    setStatusMessage('', 'info');

    try {
      const rows = await searchProducts(keyword, {
        company: company || undefined,
        limit: 12,
      });
      setSearchResults(rows);

      if (!rows.length) {
        setStatusMessage('没有找到匹配的商品。', 'info');
      }
    } catch (error) {
      setSearchResults([]);
      setStatusMessage(
        error instanceof Error ? error.message : '搜索失败，请稍后重试。',
        'error',
      );
    } finally {
      setIsSearching(false);
    }
  };

  const validateLinks = async () => {
    let valid = true;

    setCustomerError('');
    setCompanyError('');

    if (!customer.trim()) {
      setCustomerError('请先选择客户。');
      valid = false;
    }

    if (!company.trim()) {
      setCompanyError('请先选择公司。');
      valid = false;
    }

    if (!draftItems.length) {
      setStatusMessage('还没有销售商品，请先选择商品。', 'error');
      valid = false;
    }

    if (!valid) {
      return false;
    }

    const [customerOk, companyOk] = await Promise.all([
      checkLinkOptionExists('Customer', customer),
      checkLinkOptionExists('Company', company),
    ]);

    if (!customerOk) {
      setCustomerError('客户不存在，请重新选择。');
      valid = false;
    }

    if (!companyOk) {
      setCompanyError('公司不存在，请重新选择。');
      valid = false;
    }

    return valid;
  };

  const handleSubmit = async () => {
    setStatusMessage('', 'info');

    const valid = await validateLinks();
    if (!valid) {
      return;
    }

    setIsSubmitting(true);

    try {
      await createSalesOrder({
        customer,
        company,
        posting_date: postingDate,
        remarks: remarks.trim() || undefined,
        items: draftItems.map((item) => ({
          item_code: item.itemCode,
          qty: item.qty,
          price: item.price ?? undefined,
          warehouse: item.warehouse || preferences.defaultWarehouse || undefined,
          uom: item.uom || undefined,
        })),
      });

      clearSalesOrderDraft();
      syncDraft();
      setSearchResults([]);
      setSearchText('');
      setRemarks('');
      setStatusMessage('销售单已创建。', 'success');
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : '提交失败，请稍后重试。',
        'error',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const messageColor =
    messageTone === 'success'
      ? tintColor
      : messageTone === 'error'
        ? dangerColor
        : '#6B7280';

  return (
    <View style={[styles.page, { backgroundColor: background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.iconCircle}>
            <IconSymbol color="#111827" name="chevron.left" size={20} />
          </Pressable>

          <ThemedText style={styles.topTitle} type="title">
            销售单
          </ThemedText>

          <Pressable
            onPress={() => setStatusMessage('AI 开单功能开发中。', 'info')}
            style={styles.aiTrigger}>
            <ThemedText style={{ color: tintColor }} type="defaultSemiBold">
              AI开单
            </ThemedText>
          </Pressable>
        </View>

        <View style={[styles.heroCard, { backgroundColor: surface, borderColor }]}>
          <View style={styles.heroHeader}>
            <View>
              <ThemedText type="title">销售单</ThemedText>
              <ThemedText style={styles.heroSubtitle}>销售单工作台</ThemedText>
            </View>
            <View style={[styles.statusPill, { backgroundColor: accentSoft }]}>
              <ThemedText
                style={[styles.statusPillText, { color: tintColor }]}
                type="defaultSemiBold">
                Draft
              </ThemedText>
            </View>
          </View>

          <TopFieldRow
            errorText={customerError}
            helperText="选择当前订单的往来客户"
            label="客户"
            loadOptions={loadCustomers}
            onChangeText={setCustomer}
            placeholder="请选择客户"
            value={customer}
          />

          <View style={styles.heroMetaGrid}>
            <SummaryMetric
              label="时间"
              value={postingDate}
              valueStyle={styles.heroMetaValue}
            />
            <SummaryMetric
              label="业务员"
              value={profile?.fullName || profile?.name || 'admin'}
              valueStyle={styles.heroMetaValue}
            />
          </View>

          <View style={styles.heroStatGrid}>
            <SummaryMetric
              label="已选商品"
              value={`${totalQty}项`}
              valueStyle={styles.heroStatValue}
            />
            <SummaryMetric
              label="当前应收"
              value={`¥ ${formatMoney(receivableAmount)}`}
              valueStyle={styles.heroReceivableValue}
            />
          </View>
        </View>

        <View
          style={[styles.quickActionsCard, { backgroundColor: surface, borderColor }]}>
          <Pressable
            onPress={() => setStatusMessage('请使用下方搜索框添加商品。', 'info')}
            style={styles.quickActionButton}>
            <View style={[styles.quickActionIcon, { backgroundColor: accentSoft }]}>
              <IconSymbol color={tintColor} name="cart.fill.badge.plus" size={18} />
            </View>
            <View>
              <ThemedText style={styles.quickActionLabel} type="defaultSemiBold">
                选择商品
              </ThemedText>
              <ThemedText style={styles.quickActionHint}>搜索后加入本单</ThemedText>
            </View>
          </Pressable>

          <View style={[styles.quickActionDivider, { backgroundColor: borderColor }]} />

          <Pressable
            onPress={() => setStatusMessage('扫码添加功能开发中。', 'info')}
            style={styles.quickActionButton}>
            <View style={[styles.quickActionIcon, { backgroundColor: accentSoft }]}>
              <IconSymbol color={tintColor} name="barcode.viewfinder" size={18} />
            </View>
            <View>
              <ThemedText style={styles.quickActionLabel} type="defaultSemiBold">
                扫码添加
              </ThemedText>
              <ThemedText style={styles.quickActionHint}>预留扫码入口</ThemedText>
            </View>
          </Pressable>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: surface, borderColor }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionAccent, { backgroundColor: tintColor }]} />
            <View>
              <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
                销售商品
              </ThemedText>
              <ThemedText style={styles.sectionHint}>商品明细决定订单金额</ThemedText>
            </View>
          </View>

          <View style={[styles.searchBar, { backgroundColor: surfaceMuted, borderColor }]}>
            <IconSymbol color={tintColor} name="magnifyingglass" size={16} />
            <TextInput
              onChangeText={setSearchText}
              placeholder="搜索商品名称 / 商品编号"
              placeholderTextColor="#9CA3AF"
              style={styles.searchInput}
              value={searchText}
            />
            <Pressable
              onPress={handleSearch}
              style={[styles.searchButton, { backgroundColor: tintColor }]}>
              {isSearching ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <ThemedText style={styles.searchButtonText} type="defaultSemiBold">
                  搜索
                </ThemedText>
              )}
            </Pressable>
          </View>

          {!!message && (
            <ThemedText style={[styles.bannerText, { color: messageColor }]}>
              {message}
            </ThemedText>
          )}

          {searchResults.length > 0 && (
            <View style={styles.resultList}>
              {searchResults.map((item) => (
                <SearchResultRow item={item} key={item.itemCode} onAdd={addProduct} />
              ))}
            </View>
          )}

          {isSearching && !searchResults.length && (
            <ThemedText style={styles.mutedHint}>正在搜索...</ThemedText>
          )}

          {!draftItems.length && !searchResults.length && !isSearching && (
            <ThemedText style={styles.emptyText}>
              还没有销售商品，请先选择商品。
            </ThemedText>
          )}

          {!!draftItems.length && (
            <>
              <ThemedText style={styles.draftHint}>
                商品的仓库信息跟随明细项携带，无需在订单头单独维护。
              </ThemedText>

              <View style={styles.itemList}>
                {draftItems.map((item) => (
                  <SalesItemRow
                    itemCode={item.itemCode}
                    itemName={item.itemName}
                    key={item.itemCode}
                    onChangePrice={(value) => {
                      updateSalesOrderDraftField(
                        item.itemCode,
                        'price',
                        value === '' ? null : Number(value) || 0,
                      );
                      syncDraft();
                    }}
                    onChangeQty={(value) => {
                      updateSalesOrderDraftQty(item.itemCode, Number(value) || 0);
                      syncDraft();
                    }}
                    onRemove={() => {
                      removeSalesOrderDraftItem(item.itemCode);
                      syncDraft();
                    }}
                    price={item.price}
                    qty={item.qty}
                    warehouse={item.warehouse || preferences.defaultWarehouse}
                  />
                ))}
              </View>
            </>
          )}

          <View style={[styles.sectionFooter, { borderTopColor: borderColor }]}>
            <ThemedText style={styles.sectionFooterText}>
              合计 已选 {totalQty} 项
            </ThemedText>
            <ThemedText style={styles.sectionFooterAmount} type="defaultSemiBold">
              ¥ {formatMoney(goodsAmount)}
            </ThemedText>
          </View>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: surface, borderColor }]}>
          <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
            金额汇总
          </ThemedText>

          <SummaryRow label="商品合计" value={`¥ ${formatMoney(goodsAmount)}`} />
          <SummaryRow label="整单折扣" value={`¥ ${formatMoney(discountAmount)}`} />
          <SummaryRow
            label="折后金额"
            value={`¥ ${formatMoney(goodsAmount - discountAmount)}`}
          />
          <SummaryRow label="运费" value={`¥ ${formatMoney(freightAmount)}`} />

          <View style={[styles.amountStrongWrap, { backgroundColor: accentSoft }]}>
            <SummaryRow label="应收" strong value={`¥ ${formatMoney(receivableAmount)}`} />
          </View>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: surface, borderColor }]}>
          <Pressable
            onPress={() => setShowOrderMeta((current) => !current)}
            style={styles.foldHeader}>
            <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
              发货信息
            </ThemedText>
            <ThemedText style={styles.foldAction}>
              {showOrderMeta ? '收起' : '展开'}
            </ThemedText>
          </Pressable>

          {showOrderMeta && (
            <View style={styles.foldBody}>
              <TopFieldRow
                errorText={companyError}
                helperText="默认发货方公司，通常无需频繁调整"
                label="公司"
                loadOptions={loadCompanies}
                onChangeText={setCompany}
                placeholder="请选择公司"
                value={company}
              />

              <View style={[styles.infoNotice, { backgroundColor: surfaceMuted }]}>
                <ThemedText style={styles.infoNoticeText}>
                  仓库信息跟随商品明细携带，系统会在提交时自动带出。
                </ThemedText>
              </View>
            </View>
          )}
        </View>

        <View style={[styles.sectionCard, { backgroundColor: surface, borderColor }]}>
          <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
            备注
          </ThemedText>
          <TextInput
            multiline
            numberOfLines={5}
            onChangeText={setRemarks}
            placeholder="在这里输入备注..."
            placeholderTextColor="#9CA3AF"
            style={[styles.notesInput, { backgroundColor: surfaceMuted, borderColor }]}
            textAlignVertical="top"
            value={remarks}
          />
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <View style={[styles.bottomBar, { backgroundColor: surface, borderTopColor: borderColor }]}>
        <View>
          <ThemedText style={styles.bottomPrimaryAmount} type="defaultSemiBold">
            应收: ¥ {formatMoney(receivableAmount)}
          </ThemedText>
          <ThemedText style={styles.bottomSecondaryAmount}>
            本次实收: ¥ {formatMoney(paidNowAmount)}
          </ThemedText>
        </View>

        <View style={styles.bottomActions}>
          <Pressable
            onPress={() => setStatusMessage('收款功能开发中。', 'info')}
            style={[styles.secondaryButton, { borderColor }]}>
            <ThemedText style={styles.secondaryButtonText} type="defaultSemiBold">
              收款
            </ThemedText>
          </Pressable>

          <Pressable
            disabled={isSubmitting}
            onPress={handleSubmit}
            style={[
              styles.primaryButton,
              { backgroundColor: tintColor, opacity: isSubmitting ? 0.7 : 1 },
            ]}>
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <ThemedText style={styles.primaryButtonText} type="defaultSemiBold">
                保存
              </ThemedText>
            )}
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
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 12,
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
  aiTrigger: {
    alignItems: 'flex-end',
    minWidth: 56,
  },
  heroCard: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 14,
    padding: 16,
  },
  heroHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroSubtitle: {
    color: '#5F6B7A',
    fontSize: 13,
    marginTop: 4,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusPillText: {
    fontSize: 12,
  },
  infoFieldBlock: {
    gap: 8,
  },
  infoFieldLabel: {
    fontSize: 14,
  },
  heroMetaGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  heroStatGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  heroMetaValue: {
    fontSize: 18,
  },
  heroStatValue: {
    fontSize: 18,
  },
  heroReceivableValue: {
    color: '#C97A1E',
    fontSize: 20,
    fontWeight: '700',
  },
  summaryMetric: {
    backgroundColor: '#F5F7FA',
    borderRadius: 18,
    flex: 1,
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  summaryMetricLabel: {
    color: '#6B7280',
    fontSize: 12,
  },
  quickActionsCard: {
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  quickActionButton: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 76,
    paddingHorizontal: 12,
  },
  quickActionIcon: {
    alignItems: 'center',
    borderRadius: 14,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  quickActionDivider: {
    width: 1,
  },
  quickActionLabel: {
    fontSize: 16,
  },
  quickActionHint: {
    color: '#8B95A7',
    fontSize: 12,
    marginTop: 2,
  },
  sectionCard: {
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  sectionAccent: {
    borderRadius: 999,
    height: 18,
    width: 4,
  },
  sectionTitle: {
    fontSize: 18,
  },
  sectionHint: {
    color: '#8B95A7',
    fontSize: 12,
    marginTop: 2,
  },
  searchBar: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  searchInput: {
    color: '#111827',
    flex: 1,
    fontSize: 15,
    paddingVertical: 10,
  },
  searchButton: {
    borderRadius: 999,
    minWidth: 66,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  searchButtonText: {
    color: '#FFFFFF',
    textAlign: 'center',
  },
  bannerText: {
    fontSize: 13,
  },
  resultList: {
    gap: 10,
  },
  searchResultRow: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  searchResultThumb: {
    alignItems: 'center',
    borderRadius: 14,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  searchResultMain: {
    flex: 1,
    gap: 4,
  },
  searchResultMeta: {
    color: '#6B7280',
    fontSize: 12,
  },
  searchResultAside: {
    alignItems: 'flex-end',
    gap: 8,
  },
  searchResultPrice: {
    color: '#1F2937',
  },
  textActionButton: {
    paddingVertical: 2,
  },
  textAction: {
    fontSize: 13,
  },
  emptyText: {
    color: '#374151',
    fontSize: 15,
    paddingVertical: 8,
  },
  mutedHint: {
    color: '#6B7280',
    fontSize: 13,
  },
  draftHint: {
    color: '#6B7280',
    fontSize: 13,
  },
  itemList: {
    gap: 12,
  },
  itemRow: {
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  itemThumb: {
    alignItems: 'center',
    borderRadius: 16,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  itemMain: {
    flex: 1,
    gap: 4,
  },
  itemTitleRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemTitle: {
    flex: 1,
    fontSize: 16,
    marginRight: 12,
  },
  itemAmountInline: {
    color: '#2D3748',
    fontSize: 18,
  },
  itemSubline: {
    color: '#6B7280',
    fontSize: 12,
  },
  itemEditRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  itemEditBlock: {
    flex: 1,
    gap: 6,
  },
  itemEditLabel: {
    color: '#6B7280',
    fontSize: 12,
  },
  itemInput: {
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 14,
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  removeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    minWidth: 44,
    paddingHorizontal: 4,
  },
  sectionFooter: {
    alignItems: 'center',
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  sectionFooterText: {
    fontSize: 16,
  },
  sectionFooterAmount: {
    color: '#A86518',
    fontSize: 20,
  },
  amountRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 28,
  },
  amountLabel: {
    color: '#6B7280',
    fontSize: 14,
  },
  amountValue: {
    color: '#1F2937',
    fontSize: 16,
  },
  amountStrongWrap: {
    borderRadius: 16,
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  amountLabelStrong: {
    color: '#7C4A10',
    fontSize: 15,
  },
  amountValueStrong: {
    color: '#C97A1E',
    fontSize: 26,
  },
  foldHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  foldAction: {
    color: '#6B7280',
    fontSize: 14,
  },
  foldBody: {
    gap: 12,
  },
  infoNotice: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  infoNoticeText: {
    color: '#6B7280',
    fontSize: 13,
    lineHeight: 20,
  },
  notesInput: {
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 128,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bottomSpacer: {
    height: 92,
  },
  bottomBar: {
    alignItems: 'center',
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  bottomPrimaryAmount: {
    color: '#C97A1E',
    fontSize: 22,
  },
  bottomSecondaryAmount: {
    color: '#6B7280',
    fontSize: 14,
    marginTop: 4,
  },
  bottomActions: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 72,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: '#1D4ED8',
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 16,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 78,
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: '#FFFFFF',
  },
});
