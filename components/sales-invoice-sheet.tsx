import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { SalesInvoiceDetailV2 } from '@/services/sales';

function formatCurrency(value: number | null | undefined, currency = 'CNY') {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }

  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function SalesInvoiceSheet({ detail }: { detail: SalesInvoiceDetailV2 }) {
  return (
    <View style={styles.previewSheet}>
      <View style={styles.previewHeader}>
        <View>
          <ThemedText style={styles.brandText} type="defaultSemiBold">
            RGC WHOLESALE
          </ThemedText>
          <ThemedText style={styles.sheetTitle} type="title">
            销售发票
          </ThemedText>
        </View>
        <View style={styles.previewHeaderAside}>
          <ThemedText style={styles.previewNumber} type="defaultSemiBold">
            {detail.name}
          </ThemedText>
          <ThemedText style={styles.previewMeta}>开票日期 {detail.postingDate || '—'}</ThemedText>
          <ThemedText style={styles.previewMeta}>到期日期 {detail.dueDate || '—'}</ThemedText>
        </View>
      </View>

      <View style={styles.infoGrid}>
        <View style={styles.infoCard}>
          <ThemedText style={styles.infoLabel}>客户</ThemedText>
          <ThemedText style={styles.infoValue} type="defaultSemiBold">
            {detail.customer || '未配置'}
          </ThemedText>
        </View>
        <View style={styles.infoCard}>
          <ThemedText style={styles.infoLabel}>联系电话</ThemedText>
          <ThemedText style={styles.infoValue} type="defaultSemiBold">
            {detail.contactPhone || '未配置'}
          </ThemedText>
        </View>
      </View>

      <View style={styles.addressCard}>
        <ThemedText style={styles.infoLabel}>收货地址</ThemedText>
        <ThemedText style={styles.addressText}>{detail.addressDisplay || '未配置收货地址'}</ThemedText>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <ThemedText style={styles.infoLabel}>发票金额</ThemedText>
          <ThemedText style={styles.summaryValue} type="defaultSemiBold">
            {formatCurrency(detail.receivableAmount ?? detail.grandTotal, detail.currency)}
          </ThemedText>
        </View>
        <View style={styles.summaryCard}>
          <ThemedText style={styles.infoLabel}>实收金额</ThemedText>
          <ThemedText style={styles.summaryValue} type="defaultSemiBold">
            {formatCurrency(detail.actualPaidAmount, detail.currency)}
          </ThemedText>
        </View>
        <View style={styles.summaryCard}>
          <ThemedText style={styles.infoLabel}>未收金额</ThemedText>
          <ThemedText style={styles.summaryValue} type="defaultSemiBold">
            {formatCurrency(detail.outstandingAmount, detail.currency)}
          </ThemedText>
        </View>
      </View>

      <View style={styles.tableHeader}>
        <ThemedText style={[styles.tableCell, styles.tableCellName]} type="defaultSemiBold">
          商品
        </ThemedText>
        <ThemedText style={styles.tableCell} type="defaultSemiBold">
          数量
        </ThemedText>
        <ThemedText style={styles.tableCell} type="defaultSemiBold">
          单价
        </ThemedText>
        <ThemedText style={[styles.tableCell, styles.tableCellAmount]} type="defaultSemiBold">
          金额
        </ThemedText>
      </View>

      {detail.items.map((item, index) => (
        <View key={`${item.itemCode}-${index}`} style={[styles.tableRow, index > 0 ? styles.tableDivider : null]}>
          <View style={[styles.tableCell, styles.tableCellName]}>
            <ThemedText style={styles.itemName} type="defaultSemiBold">
              {item.itemName}
            </ThemedText>
            <ThemedText style={styles.itemMeta}>{item.itemCode}</ThemedText>
          </View>
          <ThemedText style={styles.tableCell}>{`${item.qty ?? '—'} ${item.uom || ''}`}</ThemedText>
          <ThemedText style={styles.tableCell}>{formatCurrency(item.rate, detail.currency)}</ThemedText>
          <ThemedText style={[styles.tableCell, styles.tableCellAmount]}>
            {formatCurrency(item.amount, detail.currency)}
          </ThemedText>
        </View>
      ))}

      <View style={styles.sheetFooter}>
        <View style={styles.sheetFooterBlock}>
          <ThemedText style={styles.infoLabel}>来源订单</ThemedText>
          <ThemedText style={styles.footerValue}>{detail.salesOrders.join('、') || '未关联'}</ThemedText>
        </View>
        <View style={styles.sheetFooterBlock}>
          <ThemedText style={styles.infoLabel}>来源发货单</ThemedText>
          <ThemedText style={styles.footerValue}>{detail.deliveryNotes.join('、') || '未关联'}</ThemedText>
        </View>
      </View>

      {detail.remarks ? (
        <View style={styles.remarksBlock}>
          <ThemedText style={styles.infoLabel}>发票备注</ThemedText>
          <ThemedText style={styles.footerValue}>{detail.remarks}</ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  previewSheet: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D7DEE7',
    borderRadius: 24,
    borderWidth: 1,
    gap: 18,
    padding: 20,
  },
  previewHeader: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
  },
  brandText: {
    color: '#2563EB',
    fontSize: 12,
    letterSpacing: 1.2,
  },
  sheetTitle: {
    color: '#0F172A',
    fontSize: 28,
    marginTop: 6,
  },
  previewHeaderAside: {
    alignItems: 'flex-end',
    gap: 6,
  },
  previewNumber: {
    color: '#111827',
    fontSize: 15,
  },
  previewMeta: {
    color: '#64748B',
    fontSize: 12,
  },
  infoGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  infoCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    flex: 1,
    gap: 8,
    padding: 14,
  },
  infoLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  infoValue: {
    color: '#0F172A',
    fontSize: 16,
  },
  addressCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    gap: 8,
    padding: 14,
  },
  addressText: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 22,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryCard: {
    borderColor: '#E2E8F0',
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    padding: 14,
  },
  summaryValue: {
    color: '#111827',
    fontSize: 16,
  },
  tableHeader: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tableRow: {
    flexDirection: 'row',
    paddingBottom: 10,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  tableDivider: {
    borderTopColor: '#E2E8F0',
    borderTopWidth: 1,
  },
  tableCell: {
    color: '#334155',
    flex: 1,
    fontSize: 13,
  },
  tableCellName: {
    flex: 2.2,
  },
  tableCellAmount: {
    textAlign: 'right',
  },
  itemName: {
    color: '#0F172A',
    fontSize: 14,
  },
  itemMeta: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
  },
  sheetFooter: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 8,
  },
  sheetFooterBlock: {
    flex: 1,
    gap: 6,
  },
  footerValue: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 20,
  },
  remarksBlock: {
    gap: 6,
  },
});
