import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

type WorkflowQuickNavProps = {
  compact?: boolean;
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

export function WorkflowQuickNav({ compact = false }: WorkflowQuickNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const activeKey = getActiveKey(pathname);

  return (
    <View style={[styles.wrap, compact ? styles.wrapCompact : null]}>
      <View style={styles.row}>
        {NAV_ITEMS.map((item) => {
          const isActive = item.key === activeKey;

          return (
            <Pressable
              key={item.key}
              onPress={() => router.replace(item.href)}
              style={[
                styles.button,
                isActive ? styles.buttonActive : styles.buttonIdle,
                compact ? styles.buttonCompact : null,
              ]}>
              <ThemedText
                style={isActive ? styles.buttonTextActive : styles.buttonTextIdle}
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
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  button: {
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 68,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  buttonCompact: {
    minWidth: 62,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  buttonIdle: {
    backgroundColor: '#F8FAFC',
    borderColor: '#D7DEE7',
  },
  buttonActive: {
    backgroundColor: '#EAF2FF',
    borderColor: '#93C5FD',
  },
  buttonTextIdle: {
    color: '#334155',
    fontSize: 13,
    textAlign: 'center',
  },
  buttonTextActive: {
    color: '#1D4ED8',
    fontSize: 13,
    textAlign: 'center',
  },
});
