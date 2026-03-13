import { Link } from 'expo-router';
import type { Href } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

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
};

export function AppShell({ title, description, children, actions = [] }: AppShellProps) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">{title}</ThemedText>
        <ThemedText>{description}</ThemedText>
      </ThemedView>

      {actions.length ? (
        <View style={styles.actions}>
          {actions.map((action) => (
            <Link key={action.label} href={action.href} style={styles.linkCard}>
              <ThemedText type="defaultSemiBold">{action.label}</ThemedText>
              {action.description ? <ThemedText>{action.description}</ThemedText> : null}
            </Link>
          ))}
        </View>
      ) : null}

      {children ? <ThemedView style={styles.section}>{children}</ThemedView> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    borderRadius: 20,
    gap: 10,
    padding: 18,
  },
  actions: {
    gap: 12,
  },
  linkCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D9DDE3',
    padding: 16,
    textDecorationLine: 'none',
  },
  section: {
    borderRadius: 20,
    gap: 10,
    padding: 18,
  },
});
