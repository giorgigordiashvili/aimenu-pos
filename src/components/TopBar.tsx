import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLocale } from '@/i18n';
import { colors, radius, shadows, spacing, typography } from '@/theme/tokens';

interface Props {
  title: string;
  subtitle?: string;
}

function formatToday(locale: string): string {
  const d = new Date();
  try {
    return d.toLocaleDateString(locale === 'ka' ? 'ka-GE' : 'en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return d.toDateString();
  }
}

export default function TopBar({ title, subtitle }: Props) {
  const { locale, setLocale } = useLocale();
  return (
    <View style={styles.root}>
      <View style={styles.left}>
        <View style={styles.logo}>
          <Text style={styles.logoMark}>Z</Text>
        </View>
        <View style={{ gap: 2 }}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      <View style={styles.right}>
        <Pressable
          onPress={() => setLocale(locale === 'ka' ? 'en' : 'ka')}
          style={styles.locale}
        >
          <Ionicons name='globe-outline' size={14} color={colors.slate600} />
          <Text style={styles.localeText}>{locale === 'ka' ? 'GEO' : 'ENG'}</Text>
          <Ionicons name='chevron-down' size={14} color={colors.slate500} />
        </Pressable>
        <View style={styles.date}>
          <Ionicons name='calendar-outline' size={14} color={colors.slate600} />
          <Text style={styles.dateText}>{formatToday(locale)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    gap: spacing.lg,
    flexWrap: 'wrap',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
    minWidth: 220,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  logoMark: {
    color: colors.white,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.foreground,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.muted,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  locale: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  localeText: {
    fontSize: typography.sizes.sm,
    color: colors.foreground,
    fontWeight: typography.weights.semibold,
  },
  date: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateText: {
    fontSize: typography.sizes.sm,
    color: colors.foreground,
    fontWeight: typography.weights.medium,
  },
});
