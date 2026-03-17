import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { formatCurrencyValue } from '@/lib/display-currency';
import { listSalesInvoices, type SalesInvoiceListItem } from '@/services/master-data';
import { listSalesOrderSummaries, type SalesOrderSummaryItem } from '@/services/sales';

type TabKey = 'orders' | 'invoices';

function orderStatusText(item: SalesOrderSummaryItem) {
  if (item.status === 'cancelled') {
    return '\u5df2\u53d6\u6d88';
  }

  if (item.completionStatus === 'completed') {
    return '\u5df2\u5b8c\u6210';
  }

  if (item.paymentStatus === 'paid') {
    return '\u5df2\u7ed3\u6e05';
  }

  if (item.fulfillmentStatus === 'shipped') {
    return '\u5df2\u51fa\u8d27';
  }

  if (item.fulfillmentStatus === 'partial') {
    return '\u90e8\u5206\u51fa\u8d27';
  }

  if (item.status === 'submitted' && item.fulfillmentStatus === 'pending') {
    return '\u5f85\u51fa\u8d27';
  }

  if (item.status === 'draft') {
    return '\u8349\u7a3f';
  }

  if (item.status.trim()) {
    return item.status === 'submitted' ? '\u5df2\u63d0\u4ea4' : item.status;
  }

  return item.docstatus === 1 ? '\u5df2\u63d0\u4ea4' : '\u8349\u7a3f';
}

function invoiceStatusText(item: SalesInvoiceListItem) {
  if (item.outstandingAmount === null) {
    return item.status || '\u5f85\u786e\u8ba4';
  }

  if (item.outstandingAmount <= 0) {
    return '\u5df2\u7ed3\u6e05';
  }

  return item.outstandingAmount < (item.grandTotal ?? 0) ? '\u90e8\u5206\u6536\u6b3e' : '\u672a\u7ed3\u6e05';
}

export default function DocsTabScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('orders');
  const [query, setQuery] = useState('');
  const [orders, setOrders] = useState<SalesOrderSummaryItem[]>([]);
  const [invoices, setInvoices] = useState<SalesInvoiceListItem[]>([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const surface = useThemeColor({}, 'surface');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');

  const handleSearch = async (nextQuery?: string, nextTab?: TabKey) => {
    const keyword = (nextQuery ?? query).trim();
    const activeTab = nextTab ?? tab;

    try {
      setIsLoading(true);
      setQuery(keyword);

      if (activeTab === 'orders') {
        const nextOrders = await listSalesOrderSummaries(keyword);
        setOrders(nextOrders);
        setMessage(
          nextOrders.length
            ? `\u5171\u627e\u5230 ${nextOrders.length} \u6761\u9500\u552e\u8ba2\u5355\u3002`
            : '\u672a\u627e\u5230\u5339\u914d\u7684\u9500\u552e\u8ba2\u5355\u3002',
        );
        return;
      }

      const nextInvoices = await listSalesInvoices(keyword);
      setInvoices(nextInvoices);
      setMessage(
        nextInvoices.length
          ? `\u5171\u627e\u5230 ${nextInvoices.length} \u6761\u9500\u552e\u53d1\u7968\u3002`
          : '\u672a\u627e\u5230\u5339\u914d\u7684\u9500\u552e\u53d1\u7968\u3002',
      );
    } catch (error) {
      if (activeTab === 'orders') {
        setOrders([]);
      } else {
        setInvoices([]);
      }
      setMessage(error instanceof Error ? error.message : '\u5355\u636e\u67e5\u8be2\u5931\u8d25\u3002');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void handleSearch('', tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const isOrderTab = tab === 'orders';

  return (
    <AppShell
      compactHeader
      contentCard={false}
      description={'\u652f\u6301\u9500\u552e\u8ba2\u5355\u4e0e\u9500\u552e\u53d1\u7968\u53cc\u67e5\u8be2\uff0c\u4fbf\u4e8e\u7ee7\u7eed\u67e5\u770b\u8be6\u60c5\u3001\u5f00\u7968\u4e0e\u6536\u6b3e\u3002'}
      title={'\u5355\u636e\u67e5\u8be2'}>
      <View style={[styles.tabBar, { backgroundColor: surfaceMuted, borderColor }]}> 
        <Pressable onPress={() => setTab('orders')} style={[styles.tabButton, isOrderTab && { backgroundColor: surface }]}> 
          <ThemedText style={[styles.tabText, isOrderTab && { color: tintColor }]} type="defaultSemiBold">{'\u9500\u552e\u8ba2\u5355'}</ThemedText>
        </Pressable>
        <Pressable onPress={() => setTab('invoices')} style={[styles.tabButton, !isOrderTab && { backgroundColor: surface }]}> 
          <ThemedText style={[styles.tabText, !isOrderTab && { color: tintColor }]} type="defaultSemiBold">{'\u9500\u552e\u53d1\u7968'}</ThemedText>
        </Pressable>
      </View>

      <View style={[styles.searchCard, { backgroundColor: surface, borderColor }]}> 
        <View style={[styles.searchInputWrap, { backgroundColor: surfaceMuted, borderColor }]}> 
          <IconSymbol color={tintColor} name="magnifyingglass" size={18} />
          <TextInput
            autoCorrect={false}
            onChangeText={setQuery}
            onSubmitEditing={() => void handleSearch()}
            placeholder={isOrderTab ? '\u641c\u7d22\u9500\u552e\u8ba2\u5355\u53f7 / \u5ba2\u6237' : '\u641c\u7d22\u9500\u552e\u53d1\u7968\u53f7 / \u5ba2\u6237'}
            placeholderTextColor="rgba(31,42,55,0.45)"
            style={styles.searchInput}
            value={query}
          />
        </View>

        <Pressable onPress={() => void handleSearch()} style={[styles.searchButton, { backgroundColor: tintColor }]}> 
          <ThemedText style={styles.searchButtonText} type="defaultSemiBold">
            {isLoading ? '\u67e5\u8be2\u4e2d...' : '\u5f00\u59cb\u67e5\u8be2'}
          </ThemedText>
        </Pressable>
      </View>

      <View style={[styles.summaryCard, { backgroundColor: surface, borderColor }]}> 
        <ThemedText type="defaultSemiBold">{isOrderTab ? '\u9500\u552e\u8ba2\u5355' : '\u9500\u552e\u53d1\u7968'}</ThemedText>
        <ThemedText style={styles.summaryText}>{message || '\u53ef\u6309\u5355\u53f7\u6216\u5ba2\u6237\u540d\u79f0\u7ee7\u7eed\u67e5\u8be2\u3002'}</ThemedText>
      </View>

      <View style={styles.resultList}>
        {isOrderTab
          ? orders.map((order) => (
              <Pressable
                key={order.name}
                onPress={() => router.push(`/sales/order/${order.name}`)}
                style={[styles.docCard, { backgroundColor: surface, borderColor }]}>
                <View style={styles.headerRow}>
                  <ThemedText style={styles.docName} numberOfLines={1} type="defaultSemiBold">{order.name}</ThemedText>
                </View>

                <View style={styles.contentRow}>
                  <View style={styles.infoColumn}>
                    <ThemedText style={styles.customerName} numberOfLines={1} type="defaultSemiBold">{order.customer || '\u672a\u586b\u5199\u5ba2\u6237'}</ThemedText>
                    <View style={styles.metaLine}>
                      <ThemedText style={styles.metaLabel}>{'\u516c\u53f8'}</ThemedText>
                      <ThemedText style={styles.metaValue} numberOfLines={1}>{order.company || '\u2014'}</ThemedText>
                    </View>
                    <View style={styles.metaLine}>
                      <ThemedText style={styles.metaLabel}>{'\u65e5\u671f'}</ThemedText>
                      <ThemedText style={styles.metaValue}>{order.transactionDate || '\u2014'}</ThemedText>
                    </View>
                  </View>

                  <View style={styles.sideColumn}>
                    <View style={[styles.statusPill, { backgroundColor: surfaceMuted }]}>
                      <ThemedText style={[styles.statusText, { color: tintColor }]} type="defaultSemiBold">{orderStatusText(order)}</ThemedText>
                    </View>
                    <ThemedText style={styles.amountText} type="defaultSemiBold">{formatCurrencyValue(order.grandTotal, 'CNY')}</ThemedText>
                    <ThemedText style={styles.footerHint}>
                      {order.outstandingAmount !== null
                        ? `\u672a\u6536 ${formatCurrencyValue(order.outstandingAmount, 'CNY')}`
                        : '\u70b9\u51fb\u67e5\u770b\u8be6\u60c5'}
                    </ThemedText>
                  </View>
                </View>
              </Pressable>
            ))
          : invoices.map((invoice) => (
              <View key={invoice.name} style={[styles.docCard, { backgroundColor: surface, borderColor }]}>
                <View style={styles.headerRow}>
                  <ThemedText style={styles.docName} numberOfLines={1} type="defaultSemiBold">{invoice.name}</ThemedText>
                </View>

                <View style={styles.contentRow}>
                  <View style={styles.infoColumn}>
                    <ThemedText style={styles.customerName} numberOfLines={1} type="defaultSemiBold">{invoice.customer || '\u672a\u586b\u5199\u5ba2\u6237'}</ThemedText>
                    <View style={styles.metaLine}>
                      <ThemedText style={styles.metaLabel}>{'\u516c\u53f8'}</ThemedText>
                      <ThemedText style={styles.metaValue} numberOfLines={1}>{invoice.company || '\u2014'}</ThemedText>
                    </View>
                    <View style={styles.metaLine}>
                      <ThemedText style={styles.metaLabel}>{'\u65e5\u671f'}</ThemedText>
                      <ThemedText style={styles.metaValue}>{invoice.postingDate || '\u2014'}</ThemedText>
                    </View>
                  </View>

                  <View style={styles.sideColumn}>
                    <View style={[styles.statusPill, { backgroundColor: surfaceMuted }]}>
                      <ThemedText style={[styles.statusText, { color: tintColor }]} type="defaultSemiBold">{invoiceStatusText(invoice)}</ThemedText>
                    </View>
                    <ThemedText style={styles.amountText} type="defaultSemiBold">{formatCurrencyValue(invoice.grandTotal, invoice.currency)}</ThemedText>
                    <ThemedText style={styles.outstandingText} type="defaultSemiBold">{'\u672a\u6536 '}{formatCurrencyValue(invoice.outstandingAmount, invoice.currency)}</ThemedText>
                  </View>
                </View>
              </View>
            ))}

        {((isOrderTab && !orders.length) || (!isOrderTab && !invoices.length)) ? (
          <View style={[styles.emptyCard, { backgroundColor: surfaceMuted, borderColor }]}> 
            <ThemedText type="defaultSemiBold">{'\u6682\u65e0\u67e5\u8be2\u7ed3\u679c'}</ThemedText>
            <ThemedText>{isOrderTab ? '\u4f60\u53ef\u4ee5\u8f93\u5165\u8ba2\u5355\u53f7\u6216\u5ba2\u6237\u540d\u79f0\u67e5\u8be2\u9500\u552e\u8ba2\u5355\u3002' : '\u4f60\u53ef\u4ee5\u8f93\u5165\u53d1\u7968\u53f7\u6216\u5ba2\u6237\u540d\u79f0\u67e5\u8be2\u9500\u552e\u53d1\u7968\u3002'}</ThemedText>
          </View>
        ) : null}
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 4,
  },
  tabButton: {
    alignItems: 'center',
    borderRadius: 14,
    flex: 1,
    justifyContent: 'center',
    minHeight: 40,
  },
  tabText: {
    color: '#475569',
    fontSize: 14,
  },
  searchCard: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  searchInputWrap: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    minHeight: 38,
    paddingVertical: 0,
  },
  searchButton: {
    alignItems: 'center',
    borderRadius: 16,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchButtonText: {
    color: '#FFF',
  },
  summaryCard: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    padding: 16,
  },
  summaryText: {
    color: '#5F6B7A',
    lineHeight: 20,
  },
  resultList: {
    gap: 12,
  },
  docCard: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
  },
  docName: {
    color: '#0F172A',
    fontSize: 18,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusText: {
    fontSize: 12,
  },
  contentRow: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
  },
  infoColumn: {
    flex: 1,
    gap: 8,
    minWidth: 0,
  },
  sideColumn: {
    alignItems: 'flex-end',
    flexShrink: 0,
    gap: 8,
    minWidth: 120,
  },
  customerName: {
    color: '#0F172A',
    fontSize: 15,
  },
  metaLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  metaLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  metaValue: {
    color: '#475569',
    fontSize: 13,
  },
  amountText: {
    color: '#A86518',
    fontSize: 20,
    textAlign: 'right',
  },
  footerHint: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'right',
  },
  outstandingText: {
    color: '#2563EB',
    fontSize: 13,
    textAlign: 'right',
  },
  emptyCard: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    padding: 16,
  },
});
