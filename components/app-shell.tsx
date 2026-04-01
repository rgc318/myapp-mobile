import { Link, useSegments } from 'expo-router';
import type { Href } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { MobilePageHeader } from '@/components/mobile-page-header';
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
  headerRightAction?: ReactNode;
  headerSideWidth?: number;
  footer?: ReactNode;
  footerNoShadow?: boolean;
};

export function AppShell({
  title,
  children,
  actions = [],
  contentCard = true,
  headerRightAction,
  headerSideWidth,
  footer,
  footerNoShadow = false,
}: AppShellProps) {
  const segments = useSegments();
  const isTabRoot = segments[0] === '(tabs)';
  const surface = useThemeColor({}, 'surface');
  const borderColor = useThemeColor({}, 'border');

  return (
    <View style={[styles.screen, { backgroundColor: useThemeColor({}, 'background') }]}>
      <MobilePageHeader
        rightAction={headerRightAction}
        sideWidth={headerSideWidth}
        showBack={!isTabRoot}
        title={title}
      />

      <ScrollView contentContainerStyle={styles.container}>
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

      {footer ? (
        <View style={[styles.footer, { borderTopColor: borderColor }, footerNoShadow ? styles.footerFlat : null]}>
          {footer}
        </View>
      ) : null}
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
  footerFlat: {
    borderTopWidth: 0,
    elevation: 0,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
});
