import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getAppPreferences } from '@/lib/app-preferences';

type PreferenceSummaryProps = {
  title?: string;
};

export function PreferenceSummary({
  title = '当前默认设置',
}: PreferenceSummaryProps) {
  const preferences = getAppPreferences();
  const borderColor = useThemeColor({}, 'border');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');

  return (
    <View style={[styles.card, { backgroundColor: surfaceMuted, borderColor }]}>
      <ThemedText type="defaultSemiBold">{title}</ThemedText>

      <View style={styles.rows}>
        <View style={styles.row}>
          <ThemedText style={styles.label}>默认公司</ThemedText>
          <ThemedText style={styles.value}>{preferences.defaultCompany}</ThemedText>
        </View>

        <View style={styles.row}>
          <ThemedText style={styles.label}>默认仓库</ThemedText>
          <ThemedText style={styles.value}>{preferences.defaultWarehouse}</ThemedText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  rows: {
    gap: 8,
  },
  row: {
    gap: 3,
  },
  label: {
    color: '#71859D',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  value: {
    fontSize: 15,
    lineHeight: 21,
  },
});
