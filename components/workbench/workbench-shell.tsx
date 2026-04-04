import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { WORKBENCH_SIZE } from '@/constants/workbench-size';

type IconName = ComponentProps<typeof IconSymbol>['name'];

type GlowShape = {
  backgroundColor: string;
  borderRadius: number;
  bottom?: number;
  height: number;
  left?: number;
  opacity?: number;
  right?: number;
  top?: number;
  transform?: { rotate: string }[];
  width: number;
};

export type WorkbenchMetricItem = {
  active?: boolean;
  backgroundColor: string;
  borderColor: string;
  key: string;
  label: string;
  onPress?: () => void;
  textColor: string;
  value: number | string;
};

export type WorkbenchQuickActionItem = {
  href?: string;
  icon: IconName;
  label: string;
  onPress: () => void;
  toneBackground: string;
  toneBorder: string;
  toneText: string;
};

type WorkbenchHeroCardProps = {
  borderColor: string;
  countText: string;
  description: string;
  eyebrow: string;
  glows: GlowShape[];
  metrics: WorkbenchMetricItem[];
  title: string;
};

type WorkbenchSectionCardProps = {
  actionSlot?: ReactNode;
  backgroundColor: string;
  borderColor: string;
  children: ReactNode;
  hint: string;
  title: string;
};

type WorkbenchQuickActionsCardProps = {
  actions: WorkbenchQuickActionItem[];
  backgroundColor: string;
  borderColor: string;
  hint: string;
  title: string;
};

export function WorkbenchHeroCard({
  borderColor,
  countText,
  description,
  eyebrow,
  glows,
  metrics,
  title,
}: WorkbenchHeroCardProps) {
  return (
    <View style={[styles.heroCard, { borderColor }]}>
      <View style={styles.heroGlowWrap} pointerEvents="none">
        {glows.map((glow, index) => (
          <View
            key={`${title}-glow-${index}`}
            style={[
              styles.heroGlow,
              {
                backgroundColor: glow.backgroundColor,
                borderRadius: glow.borderRadius,
                bottom: glow.bottom,
                height: glow.height,
                left: glow.left,
                opacity: glow.opacity,
                right: glow.right,
                top: glow.top,
                transform: glow.transform,
                width: glow.width,
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.heroTopRow}>
        <View style={styles.heroCopy}>
          <ThemedText style={styles.heroEyebrow}>{eyebrow}</ThemedText>
          <ThemedText style={styles.heroTitle} type="title">
            {title}
          </ThemedText>
          <ThemedText style={styles.heroSubtitle}>{description}</ThemedText>
        </View>
        <View style={styles.heroCountPill}>
          <ThemedText style={styles.heroCountText} type="defaultSemiBold">
            {countText}
          </ThemedText>
        </View>
      </View>

      <View style={styles.metricRow}>
        {metrics.map((metric) => {
          const card = (
            <>
              <ThemedText style={[styles.metricLabel, { color: metric.active ? metric.textColor : '#475569' }]}>
                {metric.label}
              </ThemedText>
              <ThemedText style={[styles.metricValue, { color: metric.textColor }]} type="defaultSemiBold">
                {metric.value}
              </ThemedText>
            </>
          );

          if (!metric.onPress) {
            return (
              <View
                key={metric.key}
                style={[
                  styles.metricCard,
                  {
                    backgroundColor: metric.backgroundColor,
                    borderColor: metric.borderColor,
                  },
                ]}>
                {card}
              </View>
            );
          }

          return (
            <Pressable
              key={metric.key}
              onPress={metric.onPress}
              style={[
                styles.metricCard,
                {
                  backgroundColor: metric.backgroundColor,
                  borderColor: metric.borderColor,
                },
              ]}>
              {card}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function WorkbenchSectionCard({
  actionSlot,
  backgroundColor,
  borderColor,
  children,
  hint,
  title,
}: WorkbenchSectionCardProps) {
  return (
    <View style={[styles.sectionCard, { backgroundColor, borderColor }]}>
      <View style={styles.sectionHeader}>
        <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
          {title}
        </ThemedText>
        {actionSlot ?? <ThemedText style={styles.sectionHint}>{hint}</ThemedText>}
      </View>
      {children}
    </View>
  );
}

export function WorkbenchQuickActionsCard({
  actions,
  backgroundColor,
  borderColor,
  hint,
  title,
}: WorkbenchQuickActionsCardProps) {
  return (
    <WorkbenchSectionCard
      actionSlot={<ThemedText style={styles.sectionHint}>{hint}</ThemedText>}
      backgroundColor={backgroundColor}
      borderColor={borderColor}
      hint={hint}
      title={title}>
      <View style={styles.actionGrid}>
        {actions.map((action) => (
          <Pressable
            key={action.label}
            onPress={action.onPress}
            style={[
              styles.actionCard,
              {
                backgroundColor: action.toneBackground,
                borderColor: action.toneBorder,
              },
            ]}>
            <IconSymbol color={action.toneText} name={action.icon} size={20} />
            <ThemedText style={[styles.actionLabel, { color: action.toneText }]} type="defaultSemiBold">
              {action.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>
    </WorkbenchSectionCard>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: '#F7FBFF',
    borderRadius: WORKBENCH_SIZE.heroRadius,
    borderWidth: 1,
    gap: WORKBENCH_SIZE.heroGap,
    overflow: 'hidden',
    padding: WORKBENCH_SIZE.heroPadding,
    position: 'relative',
  },
  heroGlowWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  heroGlow: {
    position: 'absolute',
  },
  heroTopRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  heroCopy: {
    flex: 1,
    gap: 8,
  },
  heroEyebrow: {
    color: '#2563EB',
    fontSize: WORKBENCH_SIZE.heroEyebrowFontSize,
    letterSpacing: WORKBENCH_SIZE.heroEyebrowLetterSpacing,
  },
  heroTitle: {
    fontSize: WORKBENCH_SIZE.heroTitleFontSize,
    lineHeight: WORKBENCH_SIZE.heroTitleLineHeight,
  },
  heroSubtitle: {
    color: '#475569',
    fontSize: WORKBENCH_SIZE.heroSubtitleFontSize,
    lineHeight: WORKBENCH_SIZE.heroSubtitleLineHeight,
    maxWidth: 420,
  },
  heroCountPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    minWidth: WORKBENCH_SIZE.heroCountPillMinWidth,
    paddingHorizontal: WORKBENCH_SIZE.heroCountPillPaddingHorizontal,
    paddingVertical: WORKBENCH_SIZE.heroCountPillPaddingVertical,
  },
  heroCountText: {
    color: '#2563EB',
    fontSize: 13,
  },
  metricRow: {
    flexDirection: 'row',
    gap: WORKBENCH_SIZE.metricRowGap,
  },
  metricCard: {
    borderRadius: WORKBENCH_SIZE.metricCardRadius,
    borderWidth: 1,
    elevation: 2,
    flex: 1,
    gap: WORKBENCH_SIZE.metricCardGap,
    minHeight: WORKBENCH_SIZE.metricCardMinHeight,
    paddingHorizontal: WORKBENCH_SIZE.metricCardPaddingHorizontal,
    paddingVertical: WORKBENCH_SIZE.metricCardPaddingVertical,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
  },
  metricLabel: {
    fontSize: WORKBENCH_SIZE.metricLabelFontSize,
  },
  metricValue: {
    fontSize: WORKBENCH_SIZE.metricValueFontSize,
    lineHeight: WORKBENCH_SIZE.metricValueLineHeight,
  },
  sectionCard: {
    borderRadius: WORKBENCH_SIZE.sectionRadius,
    borderWidth: 1,
    gap: WORKBENCH_SIZE.sectionGap,
    padding: WORKBENCH_SIZE.sectionPadding,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: WORKBENCH_SIZE.sectionTitleFontSize,
  },
  sectionHint: {
    color: '#64748B',
    flex: 1,
    fontSize: WORKBENCH_SIZE.sectionHintFontSize,
    textAlign: 'right',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: WORKBENCH_SIZE.actionGridGap,
    justifyContent: 'space-between',
  },
  actionCard: {
    alignItems: 'center',
    borderRadius: WORKBENCH_SIZE.actionCardRadius,
    borderWidth: 1,
    gap: 10,
    justifyContent: 'center',
    minHeight: WORKBENCH_SIZE.actionCardMinHeight,
    paddingHorizontal: WORKBENCH_SIZE.actionCardPaddingHorizontal,
    paddingVertical: WORKBENCH_SIZE.actionCardPaddingVertical,
    width: '31.5%',
  },
  actionLabel: {
    fontSize: WORKBENCH_SIZE.actionLabelFontSize,
    lineHeight: WORKBENCH_SIZE.actionLabelLineHeight,
    maxWidth: WORKBENCH_SIZE.actionLabelMaxWidth,
    textAlign: 'center',
  },
});
