import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

type WorkflowQuickNavProps = {
  compact?: boolean;
  onBeforeNavigate?: () => boolean;
};

const NAV_ITEMS = [
  { key: 'home', label: '首页', href: '/(tabs)' as const },
  { key: 'sales', label: '销售', href: '/(tabs)/sales' as const },
  { key: 'purchase', label: '采购', href: '/(tabs)/purchase' as const },
  { key: 'docs', label: '单据', href: '/(tabs)/docs' as const },
];

function getActiveKey(pathname: string) {
  if (pathname === '/' || pathname === '/index') {
    return 'home';
  }

  if (pathname.startsWith('/sales')) {
    return 'sales';
  }

  if (pathname.startsWith('/purchase')) {
    return 'purchase';
  }

  if (pathname.startsWith('/docs')) {
    return 'docs';
  }

  return '';
}

export function WorkflowQuickNav({ compact = false, onBeforeNavigate }: WorkflowQuickNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const activeKey = getActiveKey(pathname);

  return (
    <View style={[styles.wrap, compact ? styles.wrapCompact : null]}>
      <View style={[styles.rail, compact ? styles.railCompact : null]}>
        {NAV_ITEMS.map((item) => {
          const isActive = item.key === activeKey;

          return (
            <Pressable
              key={item.key}
              onPress={() => {
                if (onBeforeNavigate && !onBeforeNavigate()) {
                  return;
                }
                router.replace(item.href);
              }}
              style={[
                styles.tab,
                compact ? styles.tabCompact : null,
                isActive ? styles.tabActive : null,
              ]}>
              <ThemedText
                style={isActive ? styles.tabTextActive : styles.tabTextIdle}
                type="defaultSemiBold">
                {item.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  wrapCompact: {
    marginTop: 2,
  },
  rail: {
    backgroundColor: '#EEF3F8',
    borderRadius: 18,
    flexDirection: 'row',
    padding: 4,
  },
  railCompact: {
    borderRadius: 16,
    padding: 3,
  },
  tab: {
    alignItems: 'center',
    borderRadius: 14,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  tabCompact: {
    minHeight: 38,
    paddingVertical: 8,
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  tabTextIdle: {
    color: '#475569',
    fontSize: 14,
    textAlign: 'center',
  },
  tabTextActive: {
    color: '#1D4ED8',
    fontSize: 14,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
});
