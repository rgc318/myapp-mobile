import { Link, useSegments } from 'expo-router';
import type { Href } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { MobilePageHeader } from '@/components/mobile-page-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WorkflowQuickNav } from '@/components/workflow-quick-nav';
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
  footer?: ReactNode;
};

export function AppShell({
  title,
  description,
  children,
  actions = [],
  contentCard = true,
  compactHeader = false,
  footer,
}: AppShellProps) {
  const segments = useSegments();
  const isTabRoot = segments[0] === '(tabs)';
  const showWorkflowQuickNav = !isTabRoot;
  const surface = useThemeColor({}, 'surface');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');

  return (
    <View style={[styles.screen, { backgroundColor: useThemeColor({}, 'background') }]}>
      <MobilePageHeader showBack={!isTabRoot} title={title} />

      <ScrollView contentContainerStyle={styles.container}>
        <ThemedView
          lightColor={surfaceMuted}
          darkColor={surfaceMuted}
          style={[compactHeader ? styles.headerCompact : styles.header, { borderColor }]}>
          <ThemedText style={[styles.eyebrow, { color: tintColor }]}>RGC WHOLESALE FLOW</ThemedText>
          <ThemedText style={styles.description}>{description}</ThemedText>
        </ThemedView>

        {showWorkflowQuickNav ? <WorkflowQuickNav /> : null}

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

        {children && !contentCard ? <View style={styles.contentPlain}>{children}</View> : null}
      </ScrollView>

      {footer ? <View style={[styles.footer, { borderTopColor: borderColor }]}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    gap: 18,
    padding: 18,
    paddingBottom: 48,
    paddingTop: 14,
  },
  header: {
    borderRadius: 28,
    borderWidth: 1,
    gap: 10,
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
  footer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
