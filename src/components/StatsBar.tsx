import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors, radius, shadows, spacing, typography } from '@/theme/tokens';

type Tone = 'warning' | 'success' | 'accent';

interface StatCardProps {
  tone: Tone;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number | string;
  style?: ViewStyle;
}

const palettes: Record<Tone, { bg: string; fg: string }> = {
  warning: { bg: colors.warning, fg: colors.white },
  success: { bg: colors.success, fg: colors.white },
  accent: { bg: colors.accent, fg: colors.white },
};

function StatCard({ tone, icon, label, value, style }: StatCardProps) {
  const p = palettes[tone];
  return (
    <View style={[styles.card, style]}>
      <View style={[styles.iconBubble, { backgroundColor: p.bg }]}>
        <Ionicons name={icon} size={22} color={p.fg} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardLabel}>{label}</Text>
        <Text style={styles.cardValue}>{value}</Text>
      </View>
    </View>
  );
}

interface StatsBarProps {
  pending: number;
  confirmed: number;
  todayTotal: number;
  labels: { pending: string; confirmed: string; today: string };
}

export default function StatsBar({ pending, confirmed, todayTotal, labels }: StatsBarProps) {
  return (
    <View style={styles.row}>
      <StatCard tone='warning' icon='time-outline' label={labels.pending} value={pending} />
      <StatCard
        tone='success'
        icon='checkmark-circle-outline'
        label={labels.confirmed}
        value={confirmed}
      />
      <StatCard tone='accent' icon='calendar-outline' label={labels.today} value={todayTotal} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    flexWrap: 'wrap',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minWidth: 180,
    flex: 1,
    ...shadows.sm,
  },
  iconBubble: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  cardLabel: {
    fontSize: typography.sizes.sm,
    color: colors.muted,
  },
  cardValue: {
    fontSize: typography.sizes.xxxl,
    fontWeight: typography.weights.bold,
    color: colors.foreground,
    marginTop: 2,
  },
});
