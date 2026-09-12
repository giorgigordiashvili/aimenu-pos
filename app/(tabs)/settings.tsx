import { useState } from "react";
import { useRouter, type Href } from "expo-router";
import {
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Button from "@/components/Button";
import TopBar from "@/components/TopBar";
import { useAuth } from "@/context/AuthContext";
import { useLocale } from "@/i18n";
import { money } from "@/lib/money";
import { useShift } from "@/lib/useShift";
import { usePrinters } from "@/lib/usePrinters";
import { useDeliveryPlatforms } from "@/lib/useDeliveryPlatforms";
import { useNotifications } from "@/lib/useNotifications";
import {
  getPrefs,
  sendTestPush,
  updatePrefs,
  type NotificationPrefs,
} from "@/api/notifications";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { testPrinter } from "@/api/printing";
import {
  pausePlatform,
  resumePlatform,
  syncPlatformMenu,
  type PlatformCode,
} from "@/api/delivery";
import { colors, radius, spacing, typography } from "@/theme/tokens";

export default function SettingsScreen() {
  const { signOut, restaurantSlug, currentRestaurant, restaurants } = useAuth();
  const router = useRouter();
  const { t, locale, setLocale } = useLocale();
  const shift = useShift();
  const printers = usePrinters();
  const delivery = useDeliveryPlatforms();
  const notifications = useNotifications();
  const qc = useQueryClient();
  const prefsQuery = useQuery({
    queryKey: ["notification-prefs"],
    queryFn: getPrefs,
    enabled: notifications.enabled,
  });
  const [testNote, setTestNote] = useState("");
  const savePrefs = async (patch: Partial<NotificationPrefs>) => {
    const next = await updatePrefs(patch);
    qc.setQueryData(["notification-prefs"], next);
  };
  const toggleMute = (code: string) => {
    const prefs = prefsQuery.data;
    if (!prefs) return;
    const muted = prefs.muted_events.includes(code)
      ? prefs.muted_events.filter((c) => c !== code)
      : [...prefs.muted_events, code];
    savePrefs({ muted_events: muted }).catch(() => {});
  };
  const [platformBusy, setPlatformBusy] = useState<PlatformCode | null>(null);
  const [platformNote, setPlatformNote] = useState<string>("");
  const runPlatform = async (
    code: PlatformCode,
    fn: () => Promise<unknown>,
  ) => {
    setPlatformBusy(code);
    setPlatformNote("");
    try {
      await fn();
      await delivery.refetch();
    } catch {
      setPlatformNote(t.delivery.failed);
    } finally {
      setPlatformBusy(null);
    }
  };

  function handleSignOut() {
    const run = async () => {
      await signOut();
      router.replace("/login");
    };
    if (Platform.OS === "web") {
      if (
        typeof globalThis.confirm === "function" &&
        !globalThis.confirm(t.settings.signOutConfirm)
      ) {
        return;
      }
      run();
      return;
    }
    Alert.alert(t.settings.signOutConfirm, t.settings.signOutConfirmBody, [
      { text: t.settings.cancel, style: "cancel" },
      { text: t.settings.signOut, style: "destructive", onPress: run },
    ]);
  }

  return (
    <SafeAreaView style={styles.root}>
      <TopBar title={t.settings.title} />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.settings.restaurant}</Text>
          <Text style={styles.currentName}>
            {currentRestaurant?.name ?? restaurantSlug ?? "—"}
          </Text>
          <Text style={styles.cardBody}>
            {currentRestaurant?.venue
              ? `${t.restaurantPicker.venue}: ${currentRestaurant.venue.name}`
              : t.settings.restaurantHint}
          </Text>
          <Button
            title={
              restaurants.length > 1
                ? t.settings.switchRestaurant
                : t.settings.changeRestaurant
            }
            variant="outline"
            fullWidth
            onPress={() => router.push("/restaurants/select")}
          />
        </View>

        {shift.enabled ? (
          <View style={styles.card} testID="cash-card">
            <Text style={styles.cardTitle}>{t.cash.title}</Text>
            <Text style={styles.currentName}>
              {shift.shift
                ? `${t.cash.shiftOpen.replace("{n}", String(shift.shift.number))} · ${t.cash.openingFloat} ${money(shift.shift.opening_float)}`
                : t.cash.noShift}
            </Text>
            <Button
              title={t.cash.history}
              variant="outline"
              fullWidth
              onPress={() => router.push("/cash" as Href)}
            />
          </View>
        ) : null}

        {notifications.enabled ? (
          <View style={styles.card} testID="notifications-card">
            <Text style={styles.cardTitle}>
              {t.notifications.settingsTitle}
            </Text>
            <Text style={styles.cardBody}>{t.notifications.webHint}</Text>
            {prefsQuery.data ? (
              <>
                <Pressable
                  onPress={() =>
                    savePrefs({ push: !prefsQuery.data?.push }).catch(() => {})
                  }
                  style={styles.printerRow}
                  testID="toggle-push"
                >
                  <View
                    style={[
                      styles.printerDot,
                      {
                        backgroundColor: prefsQuery.data.push
                          ? colors.success
                          : colors.border,
                      },
                    ]}
                  />
                  <Text style={styles.printerName}>{t.notifications.push}</Text>
                </Pressable>
                <Text style={[styles.cardBody, { marginTop: 8 }]}>
                  {t.notifications.mute}
                </Text>
                {prefsQuery.data.events.map((e) => (
                  <Pressable
                    key={e.code}
                    onPress={() => toggleMute(e.code)}
                    style={styles.printerRow}
                    testID={`mute-${e.code}`}
                  >
                    <View
                      style={[
                        styles.printerDot,
                        {
                          backgroundColor: e.muted
                            ? colors.border
                            : colors.success,
                        },
                      ]}
                    />
                    <Text style={styles.printerName}>
                      {e.title}
                      <Text style={{ color: colors.muted }}>
                        {" · "}
                        {e.description}
                      </Text>
                    </Text>
                  </Pressable>
                ))}
              </>
            ) : null}
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <Pressable
                onPress={() =>
                  sendTestPush()
                    .then(() => {
                      setTestNote(t.notifications.testSent);
                      notifications.refetch();
                    })
                    .catch(() => setTestNote(t.delivery.failed))
                }
                style={styles.printerTest}
                testID="send-test-push"
              >
                <Text style={styles.printerTestText}>
                  {t.notifications.sendTest}
                </Text>
              </Pressable>
            </View>
            {testNote ? <Text style={styles.cardBody}>{testNote}</Text> : null}
          </View>
        ) : null}

        {delivery.enabled ? (
          <View style={styles.card} testID="delivery-card">
            <Text style={styles.cardTitle}>{t.delivery.platforms}</Text>
            {delivery.platforms.length === 0 ? (
              <Text style={styles.cardBody}>{t.delivery.none}</Text>
            ) : (
              delivery.platforms.map((p) => (
                <View key={p.platform} style={styles.printerRow}>
                  <View
                    style={[
                      styles.printerDot,
                      {
                        backgroundColor: p.online
                          ? colors.success
                          : colors.warning,
                      },
                    ]}
                  />
                  <Text style={styles.printerName}>
                    {p.label} ·{" "}
                    {p.online
                      ? t.delivery.online
                      : t.delivery.pausedUntil.replace(
                          "{time}",
                          p.paused_until
                            ? new Date(p.paused_until).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "",
                        )}
                    {` · ${p.orders_today} ${t.delivery.ordersToday}`}
                    {p.awaiting_accept
                      ? ` · ${p.awaiting_accept} ${t.delivery.awaiting}`
                      : ""}
                  </Text>
                  {delivery.canPause ? (
                    p.online ? (
                      <>
                        <Pressable
                          disabled={platformBusy === p.platform}
                          onPress={() =>
                            runPlatform(p.platform, () =>
                              pausePlatform(p.platform, 30),
                            )
                          }
                          style={styles.printerTest}
                          testID={`pause-${p.platform}-30`}
                        >
                          <Text style={styles.printerTestText}>
                            {t.delivery.pause} {t.delivery.pause30}
                          </Text>
                        </Pressable>
                        <Pressable
                          disabled={platformBusy === p.platform}
                          onPress={() =>
                            runPlatform(p.platform, () =>
                              pausePlatform(p.platform, 60),
                            )
                          }
                          style={styles.printerTest}
                        >
                          <Text style={styles.printerTestText}>
                            {t.delivery.pause60}
                          </Text>
                        </Pressable>
                      </>
                    ) : (
                      <Pressable
                        disabled={platformBusy === p.platform}
                        onPress={() =>
                          runPlatform(p.platform, () =>
                            resumePlatform(p.platform),
                          )
                        }
                        style={styles.printerTest}
                        testID={`resume-${p.platform}`}
                      >
                        <Text style={styles.printerTestText}>
                          {t.delivery.resume}
                        </Text>
                      </Pressable>
                    )
                  ) : null}
                  {delivery.canSyncMenu ? (
                    <Pressable
                      disabled={platformBusy === p.platform}
                      onPress={() =>
                        runPlatform(p.platform, async () => {
                          await syncPlatformMenu(p.platform, "updates");
                          setPlatformNote(t.delivery.synced);
                        })
                      }
                      style={styles.printerTest}
                    >
                      <Text style={styles.printerTestText}>
                        {t.delivery.syncMenu}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ))
            )}
            {platformNote ? (
              <Text style={styles.cardBody}>{platformNote}</Text>
            ) : null}
          </View>
        ) : null}

        {printers.enabled ? (
          <View style={styles.card} testID="printers-card">
            <Text style={styles.cardTitle}>{t.printing.printers}</Text>
            {printers.printers.length === 0 ? (
              <Text style={styles.cardBody}>{t.printing.noPrinter}</Text>
            ) : (
              printers.printers.map((p) => (
                <View key={p.id} style={styles.printerRow}>
                  <View
                    style={[
                      styles.printerDot,
                      {
                        backgroundColor:
                          p.connection !== "bridge" || p.is_online
                            ? colors.success
                            : colors.danger,
                      },
                    ]}
                  />
                  <Text style={styles.printerName}>
                    {p.name} · {p.kind} · {p.paper}mm ·{" "}
                    {p.connection !== "bridge" || p.is_online
                      ? t.printing.online
                      : t.printing.offline}
                    {p.queued_jobs
                      ? ` · ${p.queued_jobs} ${t.printing.queued}`
                      : ""}
                    {p.last_error ? ` · ${p.last_error}` : ""}
                  </Text>
                  {printers.canManage && p.connection === "bridge" ? (
                    <Pressable
                      onPress={() =>
                        testPrinter(p.id).then(() => printers.refetch())
                      }
                      style={styles.printerTest}
                    >
                      <Text style={styles.printerTestText}>
                        {t.printing.testPage}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ))
            )}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.loyalty.title}</Text>
          <Text style={styles.cardBody}>{t.loyalty.codeHint}</Text>
          <Button
            title={t.loyalty.openButton}
            variant="primary"
            fullWidth
            onPress={() => router.push("/loyalty/redeem")}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.settings.account}</Text>
          <Text style={styles.cardBody}>{t.settings.accountBody}</Text>
          <Button
            title={t.settings.signOut}
            variant="danger"
            fullWidth
            onPress={handleSignOut}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.settings.language}</Text>
          <View style={styles.localeRow}>
            <LocaleButton
              active={locale === "ka"}
              label="ქართული"
              onPress={() => setLocale("ka")}
            />
            <LocaleButton
              active={locale === "en"}
              label="English"
              onPress={() => setLocale("en")}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.settings.about}</Text>
          <Text style={styles.cardBody}>AiMenu POS · v0.1.0</Text>
          <Text style={styles.cardBody}>
            {process.env.EXPO_PUBLIC_API_URL ?? "https://admin.aimenu.ge"}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function LocaleButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.localeBtn, active && styles.localeBtnActive]}
    >
      <Text
        style={[styles.localeBtnText, active && styles.localeBtnTextActive]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  printerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
  },
  printerDot: { width: 10, height: 10, borderRadius: 5 },
  printerName: { flex: 1, fontSize: 13, color: colors.foreground },
  printerTest: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  printerTestText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.foreground,
  },
  root: { flex: 1, backgroundColor: colors.background },
  body: {
    padding: spacing.xl,
    gap: spacing.lg,
    maxWidth: 640,
    width: "100%",
    alignSelf: "center",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.xl,
    gap: spacing.md,
  },
  cardTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.foreground,
  },
  cardBody: {
    fontSize: typography.sizes.md,
    color: colors.muted,
    lineHeight: 22,
  },
  currentName: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.foreground,
  },
  localeRow: { flexDirection: "row", gap: spacing.sm },
  localeBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  localeBtnActive: {
    backgroundColor: colors.foreground,
    borderColor: colors.foreground,
  },
  localeBtnText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.foreground,
  },
  localeBtnTextActive: {
    color: colors.white,
  },
});
