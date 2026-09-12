import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { MyRestaurantInfo } from '@/api/restaurants';
import Button from '@/components/Button';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme/tokens';

/**
 * Pick which restaurant this device works for. Shown after login when the
 * user belongs to several (a restaurant and the shared bar next to it, say),
 * and from Settings to switch.
 */
export default function SelectRestaurantScreen() {
  const router = useRouter();
  const t = useT();
  const qc = useQueryClient();
  const { restaurants, restaurantsLoaded, restaurantSlug, setRestaurantSlug, refreshRestaurants } =
    useAuth();
  const [manual, setManual] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  async function choose(slug: string) {
    setBusy(slug);
    try {
      await setRestaurantSlug(slug);
      qc.invalidateQueries();
      router.replace('/(tabs)/reservations');
    } finally {
      setBusy(null);
    }
  }

  const canClose = !!restaurantSlug;

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.title}>{t.restaurantPicker.title}</Text>
          <Text style={styles.subtitle}>{t.restaurantPicker.subtitle}</Text>
        </View>
        {canClose ? (
          <Pressable onPress={() => router.back()} style={styles.closeBtn} accessibilityLabel='close'>
            <Ionicons name='close' size={20} color={colors.slate700} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps='handled'>
        {!restaurantsLoaded ? (
          <ActivityIndicator size='large' color={colors.primary} style={{ marginTop: spacing.xxl }} />
        ) : restaurants.length === 0 ? (
          <Text style={styles.empty}>{t.restaurantPicker.empty}</Text>
        ) : (
          restaurants.map(r => (
            <RestaurantRow
              key={r.slug}
              restaurant={r}
              active={r.slug === restaurantSlug}
              busy={busy === r.slug}
              onPress={() => choose(r.slug)}
              ownerLabel={t.restaurantPicker.owner}
              venueLabel={t.restaurantPicker.venue}
            />
          ))
        )}

        <View style={styles.manualCard}>
          <Text style={styles.manualLabel}>{t.restaurantPicker.manualLabel}</Text>
          <TextInput
            style={styles.input}
            autoCapitalize='none'
            autoCorrect={false}
            value={manual}
            onChangeText={setManual}
            placeholder={t.restaurantPicker.manualHint}
            placeholderTextColor={colors.slate400}
            onSubmitEditing={() => manual.trim() && choose(manual)}
            returnKeyType='go'
          />
          <View style={styles.manualActions}>
            <Button
              title={t.restaurantPicker.use}
              variant='outline'
              onPress={() => choose(manual)}
              disabled={!manual.trim() || !!busy}
            />
            <Button title={t.restaurantPicker.refresh} variant='ghost' onPress={() => refreshRestaurants()} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function RestaurantRow({
  restaurant,
  active,
  busy,
  onPress,
  ownerLabel,
  venueLabel,
}: {
  restaurant: MyRestaurantInfo;
  active: boolean;
  busy: boolean;
  onPress: () => void;
  ownerLabel: string;
  venueLabel: string;
}) {
  const initial = restaurant.name.trim().charAt(0).toUpperCase() || '?';
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [styles.row, active && styles.rowActive, pressed && { opacity: 0.96 }]}
      testID={`restaurant-${restaurant.slug}`}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.rowTitle}>{restaurant.name}</Text>
        <Text style={styles.rowMeta}>
          {restaurant.is_owner ? ownerLabel : restaurant.role}
          {restaurant.venue ? `  ·  ${venueLabel}: ${restaurant.venue.name}` : ''}
        </Text>
      </View>
      {busy ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <Ionicons
          name={active ? 'checkmark-circle' : 'chevron-forward'}
          size={22}
          color={active ? colors.primary : colors.slate400}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: spacing.xl,
    paddingBottom: spacing.md,
  },
  title: { fontSize: typography.sizes.xxl, fontWeight: typography.weights.bold, color: colors.foreground },
  subtitle: { fontSize: typography.sizes.md, color: colors.muted, marginTop: spacing.xxs },
  closeBtn: { padding: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surface },
  content: { padding: spacing.xl, paddingTop: 0, gap: spacing.md, maxWidth: 640, width: '100%', alignSelf: 'center' },
  empty: { color: colors.muted, textAlign: 'center', marginVertical: spacing.xl, fontSize: typography.sizes.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
  },
  rowActive: { borderColor: colors.primary },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.white, fontSize: typography.sizes.lg, fontWeight: typography.weights.bold },
  rowTitle: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, color: colors.foreground },
  rowMeta: { fontSize: typography.sizes.sm, color: colors.muted },
  manualCard: {
    marginTop: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
  },
  manualLabel: { fontSize: typography.sizes.sm, color: colors.muted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    fontSize: typography.sizes.md,
    color: colors.foreground,
    backgroundColor: colors.white,
  },
  manualActions: { flexDirection: 'row', gap: spacing.sm },
});
