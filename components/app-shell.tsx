import { Link } from 'expo-router';
import type { Href } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';

type ActionLink = {
  href: Href;
  label: string;
  description?: string;
};

type AppShellProps = {
  title: string;
  description: string;
  children?: ReactNode;
  actions?: ActionLink[];
  contentCard?: boolean;
  compactHeader?: boolean;
};

export function AppShell({
  title,
  description,
  children,
  actions = [],
  contentCard = true,
  compactHeader = false,
}: AppShellProps) {
  const surface = useThemeColor({}, 'surface');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      style={{ backgroundColor: useThemeColor({}, 'background') }}>
      <ThemedView
        lightColor={surfaceMuted}
        darkColor={surfaceMuted}
        style={[compactHeader ? styles.headerCompact : styles.header, { borderColor }]}>
        <ThemedText style={[styles.eyebrow, { color: tintColor }]}>RGC WHOLESALE FLOW</ThemedText>
        <ThemedText type="title">{title}</ThemedText>
        <ThemedText style={styles.description}>{description}</ThemedText>
      </ThemedView>

      {actions.length ? (
        <View style={styles.actions}>
          {actions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              style={[styles.linkCard, { backgroundColor: surface, borderColor }]}>
              <ThemedText type="defaultSemiBold">{action.label}</ThemedText>
              {action.description ? <ThemedText>{action.description}</ThemedText> : null}
            </Link>
          ))}
        </View>
      ) : null}

      {children && contentCard ? (
        <ThemedView
          lightColor={surface}
          darkColor={surface}
          style={[styles.section, { borderColor }]}>
          {children}
        </ThemedView>
      ) : null}

      {children && !contentCard ? (
        <View style={styles.contentPlain}>
          {children}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 18,
    padding: 18,
    paddingBottom: 48,
  },
  header: {
    borderRadius: 28,
    borderWidth: 1,
    gap: 12,
    padding: 22,
  },
  headerCompact: {
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  description: {
    opacity: 0.82,
  },
  actions: {
    gap: 12,
  },
  linkCard: {
    borderRadius: 22,
    borderWidth: 1,
    minHeight: 92,
    padding: 18,
    textDecorationLine: 'none',
  },
  section: {
    borderRadius: 26,
    borderWidth: 1,
    gap: 12,
    padding: 20,
  },
  contentPlain: {
    gap: 12,
  },
});
