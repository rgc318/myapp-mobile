import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useFeedback } from '@/providers/feedback-provider';
import { fetchCustomers, type CustomerDetail } from '@/services/customers';

function HeroStat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <View style={[styles.heroStatCard, { borderColor: `${accent}33`, backgroundColor: `${accent}12` }]}>
      <ThemedText style={styles.heroStatLabel}>{label}</ThemedText>
      <ThemedText style={[styles.heroStatValue, { color: accent }]} type="defaultSemiBold">
        {value}
      </ThemedText>
    </View>
  );
}

function CustomerCard({ item, onOpen }: { item: CustomerDetail; onOpen: (name: string) => void }) {
  const surface = useThemeColor({}, 'surface');
  const borderColor = useThemeColor({}, 'border');
  const success = useThemeColor({}, 'success');
  const danger = useThemeColor({}, 'danger');
  const tintColor = useThemeColor({}, 'tint');
  const muted = useThemeColor({}, 'surfaceMuted');

  const customerLabel = item.displayName || item.customerName || item.name;
  const shortCode = item.name.length > 22 ? `${item.name.slice(0, 22)}...` : item.name;
  const contactLine = [item.defaultContact?.displayName, item.mobileNo || item.defaultContact?.phone]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable onPress={() => onOpen(item.name)} style={[styles.card, { backgroundColor: surface, borderColor }]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleWrap}>
          <ThemedText numberOfLines={2} style={styles.cardTitle} type="defaultSemiBold">
            {customerLabel}
          </ThemedText>
          <ThemedText numberOfLines={1} style={styles.cardMeta}>
            客户编码: {shortCode}
          </ThemedText>
        </View>
        <View
          style={[
            styles.statusChip,
            { backgroundColor: item.disabled ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)' },
          ]}>
          <ThemedText
            style={[styles.statusChipText, { color: item.disabled ? danger : success }]}
            type="defaultSemiBold">
            {item.disabled ? '已停用' : '启用中'}
          </ThemedText>
        </View>
      </View>

      <View style={styles.tagRow}>
        <ThemedText style={styles.tagLabel}>分组</ThemedText>
        <View style={[styles.tag, { backgroundColor: muted }]}>
          <ThemedText style={[styles.tagText, { color: tintColor }]} type="defaultSemiBold">
            {item.customerGroup || '未分组'}
          </ThemedText>
        </View>
        {item.defaultPriceList ? (
          <>
            <ThemedText style={styles.tagLabel}>价格表</ThemedText>
            <View style={[styles.tag, { backgroundColor: 'rgba(251,146,60,0.14)' }]}>
              <ThemedText style={[styles.tagText, { color: '#C2410C' }]} type="defaultSemiBold">
                {item.defaultPriceList}
              </ThemedText>
            </View>
          </>
        ) : null}
      </View>

      <View style={[styles.infoPanel, { backgroundColor: muted }]}>
        <View style={styles.infoRow}>
          <ThemedText style={styles.infoLabel}>默认联系人</ThemedText>
          <ThemedText numberOfLines={1} style={styles.infoValue} type="defaultSemiBold">
            {item.defaultContact?.displayName || '未设置'}
          </ThemedText>
        </View>
        <View style={styles.infoRow}>
          <ThemedText style={styles.infoLabel}>联系信息</ThemedText>
          <ThemedText numberOfLines={1} style={styles.infoValue} type="defaultSemiBold">
            {contactLine || item.emailId || '未设置'}
          </ThemedText>
        </View>
        <View style={styles.infoRow}>
          <ThemedText style={styles.infoLabel}>默认地址</ThemedText>
          <ThemedText numberOfLines={1} style={styles.infoValue} type="defaultSemiBold">
            {item.defaultAddress?.city || item.defaultAddress?.country || '未设置'}
          </ThemedText>
        </View>
        <View style={styles.infoRow}>
          <ThemedText style={styles.infoLabel}>最近更新</ThemedText>
          <ThemedText numberOfLines={1} style={styles.infoValue} type="defaultSemiBold">
            {item.modified ? item.modified.slice(0, 10) : '—'}
          </ThemedText>
        </View>
      </View>
    </Pressable>
  );
}

export default function CustomersScreen() {
  const router = useRouter();
  const { showError } = useFeedback();
  const [query, setQuery] = useState('');
  const [disabledFilter, setDisabledFilter] = useState<number | null>(0);
  const [items, setItems] = useState<CustomerDetail[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const surface = useThemeColor({}, 'surface');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');

  const loadItems = useCallback(
    async (refresh = false) => {
      try {
        if (refresh) {
          setIsRefreshing(true);
        }
        const result = await fetchCustomers({
          searchKey: query.trim() || undefined,
          disabled: disabledFilter,
        });
        setItems(result.items);
      } catch (error) {
        showError(error instanceof Error ? error.message : '加载客户失败');
      } finally {
        setIsRefreshing(false);
      }
    },
    [disabledFilter, query, showError],
  );

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const summary = useMemo(
    () => ({
      activeCount: items.filter((item) => !item.disabled).length,
      pausedCount: items.filter((item) => item.disabled).length,
      contactCount: items.filter((item) => item.defaultContact?.displayName).length,
    }),
    [items],
  );

  return (
    <AppShell compactHeader contentCard={false} description="维护客户主数据、默认联系人和默认地址，供订单、开票和收款流程复用。" title="客户管理">
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl onRefresh={() => void loadItems(true)} refreshing={isRefreshing} />}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.heroCard, { backgroundColor: surface, borderColor }]}>
          <View style={styles.heroGlowBlue} />
          <View style={styles.heroGlowAmber} />
          <View style={styles.heroTopRow}>
            <View style={styles.heroCopy}>
              <ThemedText style={styles.heroEyebrow}>CUSTOMER HUB</ThemedText>
              <ThemedText style={styles.heroTitle} type="title">
                客户中心
              </ThemedText>
              <ThemedText style={styles.heroDescription}>
                统一维护客户档案、联系人、地址与价格表，减少订单和收款链路里的重复录入。
              </ThemedText>
            </View>
            <Pressable onPress={() => router.push('/common/customer/create')} style={[styles.primaryCta, { backgroundColor: tintColor }]}>
              <IconSymbol color="#FFFFFF" name="person.fill" size={16} />
              <ThemedText style={styles.primaryCtaText} type="defaultSemiBold">
                新增客户
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.heroStatsRow}>
            <HeroStat accent="#2563EB" label="启用中" value={String(summary.activeCount)} />
            <HeroStat accent="#16A34A" label="已设联系人" value={String(summary.contactCount)} />
            <HeroStat accent="#EA580C" label="已停用" value={String(summary.pausedCount)} />
          </View>
        </View>

        <View style={[styles.filterCard, { backgroundColor: surface, borderColor }]}>
          <View style={styles.filterHeader}>
            <View>
              <ThemedText style={styles.filterTitle} type="defaultSemiBold">
                检索与筛选
              </ThemedText>
              <ThemedText style={styles.filterHint}>支持按客户名称、编码、手机或邮箱快速定位。</ThemedText>
            </View>
            <Pressable onPress={() => setQuery('')} style={[styles.resetButton, { backgroundColor: surfaceMuted }]}>
              <ThemedText style={{ color: tintColor }} type="defaultSemiBold">
                清空
              </ThemedText>
            </Pressable>
          </View>

          <View style={[styles.searchBar, { backgroundColor: surfaceMuted, borderColor }]}>
            <IconSymbol color={tintColor} name="magnifyingglass" size={18} />
            <TextInput
              onChangeText={setQuery}
              placeholder="搜索客户名称、编码、手机号、邮箱"
              placeholderTextColor="rgba(31,42,55,0.42)"
              style={styles.searchInput}
              value={query}
            />
          </View>

          <View style={styles.segmentedWrap}>
            {[
              { label: '启用中', value: 0 as const },
              { label: '全部', value: null },
              { label: '已停用', value: 1 as const },
            ].map((option) => {
              const active = disabledFilter === option.value;
              return (
                <Pressable
                  key={option.label}
                  onPress={() => setDisabledFilter(option.value)}
                  style={[
                    styles.segmentedOption,
                    active
                      ? { backgroundColor: tintColor, borderColor: tintColor }
                      : { backgroundColor: surfaceMuted, borderColor },
                  ]}>
                  <ThemedText style={[styles.segmentedText, active ? styles.segmentedTextActive : null]} type="defaultSemiBold">
                    {option.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.listHeader}>
          <ThemedText style={styles.listTitle} type="defaultSemiBold">
            客户列表
          </ThemedText>
          <ThemedText style={styles.listMeta}>{items.length} 条结果</ThemedText>
        </View>

        <View style={styles.listWrap}>
          {items.length ? (
            items.map((item) => (
              <CustomerCard
                item={item}
                key={item.name}
                onOpen={(name) => router.push({ pathname: '/common/customer/[customerName]', params: { customerName: name } })}
              />
            ))
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: surface, borderColor }]}>
              <View style={styles.emptyIconWrap}>
                <IconSymbol color={tintColor} name="person.fill" size={24} />
              </View>
              <ThemedText style={styles.emptyTitle} type="defaultSemiBold">
                没有匹配的客户
              </ThemedText>
              <ThemedText style={styles.emptyHint}>换个关键词试试，或者直接新增一条客户主数据。</ThemedText>
            </View>
          )}
        </View>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 14,
    paddingBottom: 24,
  },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 16,
    position: 'relative',
    gap: 14,
  },
  heroGlowBlue: {
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderRadius: 999,
    height: 200,
    position: 'absolute',
    right: -78,
    top: -66,
    width: 200,
  },
  heroGlowAmber: {
    backgroundColor: 'rgba(251,191,36,0.14)',
    borderRadius: 999,
    height: 128,
    left: -36,
    position: 'absolute',
    top: 108,
    width: 128,
  },
  heroTopRow: {
    gap: 14,
  },
  heroCopy: {
    gap: 4,
  },
  heroEyebrow: {
    color: '#2563EB',
    fontSize: 12,
    letterSpacing: 1.4,
  },
  heroTitle: {
    color: '#14213D',
    fontSize: 24,
    lineHeight: 28,
  },
  heroDescription: {
    color: '#5B6B81',
    fontSize: 15,
    lineHeight: 22,
    maxWidth: '94%',
  },
  primaryCta: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 0,
  },
  primaryCtaText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 18,
    includeFontPadding: false,
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  heroStatCard: {
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    minHeight: 74,
    padding: 12,
  },
  heroStatLabel: {
    color: '#6B7280',
    fontSize: 12,
  },
  heroStatValue: {
    fontSize: 18,
    lineHeight: 22,
  },
  filterCard: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  filterHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  filterTitle: {
    fontSize: 17,
  },
  filterHint: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 240,
  },
  resetButton: {
    borderRadius: 999,
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  searchBar: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 50,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 10,
  },
  segmentedWrap: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentedOption: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 10,
  },
  segmentedText: {
    color: '#64748B',
    fontSize: 13,
  },
  segmentedTextActive: {
    color: '#FFFFFF',
  },
  listHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  listTitle: {
    fontSize: 18,
  },
  listMeta: {
    color: '#64748B',
    fontSize: 13,
  },
  listWrap: {
    gap: 10,
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  cardTitleWrap: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: 24,
    lineHeight: 30,
  },
  cardMeta: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 17,
  },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusChipText: {
    fontSize: 11,
  },
  tagRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: -2,
  },
  tagLabel: {
    color: '#6B7280',
    fontSize: 11,
    lineHeight: 14,
  },
  tag: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 11,
    lineHeight: 14,
  },
  infoPanel: {
    borderRadius: 14,
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  infoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  infoLabel: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 16,
  },
  infoValue: {
    flex: 1,
    fontSize: 13,
    lineHeight: 17,
    textAlign: 'right',
  },
  emptyCard: {
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    gap: 10,
    padding: 24,
  },
  emptyIconWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderRadius: 18,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  emptyTitle: {
    fontSize: 18,
  },
  emptyHint: {
    color: '#64748B',
    textAlign: 'center',
  },
});
