import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type ViewStyle,
} from 'react-native';

import { colors, radius, spacing, typography } from '@/theme/tokens';

type Variant = 'primary' | 'secondary' | 'outline' | 'danger' | 'success' | 'ghost';

interface Props extends Omit<PressableProps, 'children' | 'style'> {
  title: string;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle | ViewStyle[];
  size?: 'sm' | 'md' | 'lg';
}

const variants: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.primary, fg: colors.white },
  secondary: { bg: colors.slate900, fg: colors.white },
  outline: { bg: colors.white, fg: colors.foreground, border: colors.border },
  danger: { bg: colors.danger, fg: colors.white },
  success: { bg: colors.success, fg: colors.white },
  ghost: { bg: 'transparent', fg: colors.foreground },
};

const sizes: Record<NonNullable<Props['size']>, { paddingV: number; paddingH: number; fontSize: number }> =
  {
    sm: { paddingV: spacing.sm, paddingH: spacing.md, fontSize: typography.sizes.sm },
    md: { paddingV: spacing.md, paddingH: spacing.lg, fontSize: typography.sizes.md },
    lg: { paddingV: spacing.lg, paddingH: spacing.xl, fontSize: typography.sizes.lg },
  };

export default function Button({
  title,
  variant = 'primary',
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  size = 'md',
  ...rest
}: Props) {
  const v = variants[variant];
  const s = sizes[size];
  return (
    <Pressable
      {...rest}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: v.bg,
          borderColor: v.border ?? 'transparent',
          borderWidth: v.border ? 1 : 0,
          paddingVertical: s.paddingV,
          paddingHorizontal: s.paddingH,
          opacity: disabled || loading ? 0.6 : pressed ? 0.9 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        Array.isArray(style) ? style : style ? [style] : [],
      ]}
    >
      <View style={styles.inner}>
        {loading ? (
          <ActivityIndicator color={v.fg} />
        ) : (
          <Text style={[styles.label, { color: v.fg, fontSize: s.fontSize }]}>{title}</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  label: {
    fontWeight: typography.weights.semibold,
  },
});
