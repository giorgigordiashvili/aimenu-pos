/**
 * Design tokens for AiMenu POS.
 *
 * Mirrors the restaurant-frontend colour palette so the staff-facing app
 * feels visually consistent with the customer site. Override individual
 * values once the Figma design nodes land.
 */

export const colors = {
  background: '#F6F7FB',
  surface: '#FFFFFF',
  foreground: '#101828',
  muted: '#6A7282',
  mutedStrong: '#4A5565',
  primary: '#EC003F',
  primaryDark: '#BE123C',
  primaryTint: '#FFF1F2',
  success: '#7CCF00',
  successDark: '#5F9908',
  successTint: '#ECFCCB',
  warning: '#FF6900',
  warningDark: '#7B3306',
  warningTint: '#FFEDD4',
  danger: '#EC003F',
  dangerTint: '#FEE2E2',
  info: '#155DFC',
  infoTint: '#DBEAFE',
  accent: '#8E51FF',
  accentTint: '#EDE9FE',
  highlight: '#FEE685',
  highlightSoft: '#FEF9C3',
  border: '#EBEBEB',
  borderSoft: '#F3F4F6',
  borderStrong: '#CBD5E1',
  slate50: '#F9FAFB',
  slate100: '#F3F4F6',
  slate200: '#E5E7EB',
  slate300: '#D1D5DC',
  slate400: '#99A1AF',
  slate500: '#6A7282',
  slate600: '#4A5565',
  slate700: '#364153',
  slate800: '#1E2939',
  slate900: '#101828',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 9999,
} as const;

export const typography = {
  sizes: {
    xs: 11,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    xxl: 22,
    xxxl: 28,
    display: 36,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
} as const;

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
} as const;
