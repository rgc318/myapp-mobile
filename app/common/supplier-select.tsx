import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { normalizeAppError } from '@/lib/app-error';
import { useFeedback } from '@/providers/feedback-provider';
import { fetchSuppliers, type SupplierSummary } from '@/services/purchases';

export default function SupplierSelectScreen() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const { showError } = useFeedback();
  const [searchKey, setSearchKey] = useState('');
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const surface = useThemeColor({}, 'surface');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const rows = await fetchSuppliers({ searchKey, limit: 24 });
        if (!cancelled) {
          setSuppliers(rows);
        }
      } catch (error) {
        if (!cancelled) {
          showError(normalizeAppError(error).message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchKey, showError]);

  const handleSelect = (supplierName: string) => {
    const target = typeof returnTo === 'string' && returnTo.trim() ? returnTo : '/purchase/order/create';
    router.push({
      pathname: target as any,
      params: { supplier: supplierName },
    });
  };

  return (
    <AppShell
      title="供应商选择"
      description="选择采购单要使用的供应商。这里会优先展示最近修改的供应商，并支持按名称快速搜索。"
      contentCard={false}>
      <View style={styles.content}>
        <View style={[styles.searchWrap, { backgroundColor: surface, borderColor }]}>
          <ThemedText style={styles.searchLabel} type="defaultSemiBold">
            搜索供应商
          </ThemedText>
          <TextInput
            autoCorrect={false}
            onChangeText={setSearchKey}
            placeholder="输入供应商名称"
            style={[styles.searchInput, { backgroundColor: surfaceMuted, borderColor }]}
            value={searchKey}
          />
        </View>

        <ScrollView contentContainerStyle={styles.list}>
          {isLoading ? (
            <View style={[styles.loadingCard, { backgroundColor: surface, borderColor }]}>
              <ActivityIndicator color={tintColor} />
              <ThemedText>正在读取供应商...</ThemedText>
            </View>
          ) : suppliers.length ? (
            suppliers.map((supplier) => (
              <Pressable
                key={supplier.name}
                onPress={() => handleSelect(supplier.name)}
                style={[styles.card, { backgroundColor: surface, borderColor }]}>
                <View style={styles.cardHeader}>
                  <ThemedText style={styles.cardTitle} type="defaultSemiBold">
                    {supplier.displayName}
                  </ThemedText>
                  {supplier.disabled ? (
                    <View style={[styles.badge, { backgroundColor: surfaceMuted }]}>
                      <ThemedText style={styles.badgeText} type="defaultSemiBold">
                        已停用
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
                <ThemedText style={styles.cardCode}>编码 {supplier.name}</ThemedText>
                <ThemedText style={styles.cardMeta}>
                  {supplier.supplierGroup || '未设置供应商分组'}
                  {supplier.supplierType ? ` · ${supplier.supplierType}` : ''}
                </ThemedText>
                {supplier.defaultContact?.displayName ? (
                  <ThemedText style={styles.cardHint}>
                    默认联系人 {supplier.defaultContact.displayName}
                  </ThemedText>
                ) : null}
                {supplier.defaultAddress?.addressDisplay ? (
                  <ThemedText numberOfLines={2} style={styles.cardHint}>
                    默认地址 {supplier.defaultAddress.addressDisplay}
                  </ThemedText>
                ) : null}
              </Pressable>
            ))
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: surface, borderColor }]}>
              <ThemedText type="defaultSemiBold">没有找到匹配的供应商</ThemedText>
              <ThemedText>可以换个关键词，或者先到后端确认 Supplier 主数据是否已创建。</ThemedText>
            </View>
          )}
        </ScrollView>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 14,
    paddingHorizontal: 18,
    paddingBottom: 40,
  },
  searchWrap: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 10,
    padding: 18,
  },
  searchLabel: {
    fontSize: 15,
  },
  searchInput: {
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 52,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  list: {
    gap: 12,
  },
  loadingCard: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    gap: 10,
    minHeight: 140,
    justifyContent: 'center',
    padding: 18,
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 8,
    padding: 18,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  cardTitle: {
    flex: 1,
    fontSize: 19,
    lineHeight: 25,
  },
  cardCode: {
    color: '#71859D',
    fontSize: 14,
  },
  cardMeta: {
    color: '#64748B',
    fontSize: 14,
  },
  cardHint: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 19,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    color: '#475569',
    fontSize: 12,
  },
  emptyCard: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 10,
    minHeight: 140,
    justifyContent: 'center',
    padding: 18,
  },
});
