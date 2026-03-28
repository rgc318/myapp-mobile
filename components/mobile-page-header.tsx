import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';

type MobilePageHeaderProps = {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: ReactNode;
  sideWidth?: number;
};

export function MobilePageHeader({
  title,
  showBack = false,
  onBack,
  rightAction,
  sideWidth = 72,
}: MobilePageHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const background = useThemeColor({}, 'background');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: background,
          borderBottomColor: borderColor,
          paddingTop: Math.max(insets.top, 6),
        },
      ]}>
      <View style={styles.row}>
        <View style={[styles.side, { minWidth: sideWidth, width: sideWidth }]}>
          {showBack ? (
            <Pressable
              hitSlop={10}
              onPress={() => {
                if (onBack) {
                  onBack();
                  return;
                }
                router.back();
              }}
              style={styles.iconButton}>
              <IconSymbol color={tintColor} name="chevron.left" size={22} />
            </Pressable>
          ) : (
            <View style={styles.sidePlaceholder} />
          )}
        </View>

        <View pointerEvents="none" style={[styles.titleWrap, { left: sideWidth, right: sideWidth }]}>
          <ThemedText numberOfLines={1} style={styles.title} type="defaultSemiBold">
            {title}
          </ThemedText>
        </View>

        <View style={[styles.side, styles.sideRight, { minWidth: sideWidth, width: sideWidth }]}>
          {rightAction ? rightAction : <View style={styles.sidePlaceholder} />}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 42,
    position: 'relative',
  },
  side: {
    alignItems: 'flex-start',
    zIndex: 1,
  },
  sideRight: {
    alignItems: 'flex-end',
    marginLeft: 'auto',
  },
  iconButton: {
    alignItems: 'center',
    borderRadius: 999,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  sidePlaceholder: {
    height: 34,
    width: 34,
  },
  titleWrap: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    position: 'absolute',
    top: 0,
  },
  title: {
    fontSize: 17,
    lineHeight: 20,
    textAlign: 'center',
  },
});
