import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { can } from "@/api/restaurants";
import { listFloorTables, type FloorTable } from "@/api/tables";
import {
  addWalkIn,
  estimateWait,
  listWaitlist,
  markWaitlist,
  notifyWaitlist,
  seatWaitlist,
  waitlistErrorCode,
  type WaitlistEntry,
} from "@/api/waitlist";
import Button from "@/components/Button";
import Sheet from "@/components/Sheet";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/i18n";
import { useNow } from "@/lib/useNow";
import { colors, radius, spacing, typography } from "@/theme/tokens";

function minutesSince(iso: string, now: number): number {
  return Math.max(Math.round((now - new Date(iso).getTime()) / 60000), 0);
}

/** Today's walk-in queue on the Tables tab: add, notify, seat, left. */
export default function WaitlistPanel() {
  const t = useT();
  const qc = useQueryClient();
  const now = useNow(30_000);
  const { currentRestaurant } = useAuth();
  const canManage = can(currentRestaurant, "reservations", "update");
  const [addOpen, setAddOpen] = useState(false);
  const [seatFor, setSeatFor] = useState<WaitlistEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["waitlist"],
    queryFn: () => listWaitlist(false),
    refetchInterval: 15_000,
  });
  const tables = useQuery({
    queryKey: ["floor-tables"],
    queryFn: listFloorTables,
    enabled: !!seatFor,
  });

  const fail = (err: unknown) => {
    const code = waitlistErrorCode(err);
    const known = code
      ? (t.waitlist.errors as Record<string, string>)[code]
      : undefined;
    setError(known ?? t.waitlist.errors.generic);
  };
  const refresh = () => {
    setError(null);
    qc.invalidateQueries({ queryKey: ["waitlist"] });
    qc.invalidateQueries({ queryKey: ["active-sessions"] });
    qc.invalidateQueries({ queryKey: ["floor-tables"] });
  };
  const notify = useMutation({
    mutationFn: notifyWaitlist,
    onSuccess: refresh,
    onError: fail,
  });
  const mark = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: "left" | "no-show" | "cancel";
    }) => markWaitlist(id, status),
    onSuccess: refresh,
    onError: fail,
  });
  const seat = useMutation({
    mutationFn: ({ id, tableId }: { id: string; tableId: string }) =>
      seatWaitlist(id, tableId),
    onSuccess: () => {
      setSeatFor(null);
      refresh();
    },
    onError: fail,
  });

  const rows = list.data ?? [];

  return (
    <View style={styles.wrap} testID="waitlist-panel">
      <View style={styles.head}>
        <Text style={styles.title}>
          {t.waitlist.title} · {rows.length}
        </Text>
        {canManage ? (
          <Button
            title={t.waitlist.addWalkIn}
            variant="primary"
            size="sm"
            onPress={() => setAddOpen(true)}
            testID="add-walk-in"
          />
        ) : null}
      </View>
      {error ? (
        <Pressable onPress={() => setError(null)}>
          <Text style={styles.error}>{error}</Text>
        </Pressable>
      ) : null}
      {rows.length === 0 ? (
        <Text style={styles.empty}>{t.waitlist.empty}</Text>
      ) : (
        rows.map((e) => {
          const waited = minutesSince(e.created_at, now);
          const over = waited > e.quoted_minutes;
          return (
            <View key={e.id} style={styles.row} testID={`waitlist-${e.id}`}>
              <View style={styles.pos}>
                <Text style={styles.posText}>{e.position}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.name}>
                  {e.name} · {e.party_size} 👤
                  {e.status === "notified"
                    ? ` · 🔔 ${t.waitlist.notified}`
                    : ""}
                  {e.source === "self" ? " · QR" : ""}
                  {e.reservation_code ? ` · ${e.reservation_code}` : ""}
                </Text>
                <Text style={[styles.meta, over && { color: colors.danger }]}>
                  {t.waitlist.waited
                    .replace("{waited}", String(waited))
                    .replace("{quoted}", String(e.quoted_minutes))}
                  {e.notes ? ` · ${e.notes}` : ""}
                </Text>
                {e.phone ? (
                  <Pressable onPress={() => Linking.openURL(`tel:${e.phone}`)}>
                    <Text style={styles.phone}>{e.phone}</Text>
                  </Pressable>
                ) : null}
              </View>
              {canManage ? (
                <View style={styles.actions}>
                  <Pressable
                    onPress={() => notify.mutate(e.id)}
                    style={styles.iconBtn}
                    accessibilityLabel={t.waitlist.notify}
                    testID={`notify-${e.id}`}
                  >
                    <Ionicons
                      name="notifications-outline"
                      size={20}
                      color={colors.info}
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => setSeatFor(e)}
                    style={[styles.iconBtn, styles.seatBtn]}
                    accessibilityLabel={t.waitlist.seat}
                    testID={`seat-${e.id}`}
                  >
                    <Text style={styles.seatText}>{t.waitlist.seat}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => mark.mutate({ id: e.id, status: "left" })}
                    style={styles.iconBtn}
                    accessibilityLabel={t.waitlist.left}
                  >
                    <Ionicons
                      name="exit-outline"
                      size={20}
                      color={colors.slate500}
                    />
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })
      )}

      <AddWalkInSheet
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={() => {
          setAddOpen(false);
          refresh();
        }}
      />

      <Sheet
        visible={!!seatFor}
        title={t.waitlist.seatTitle.replace("{name}", seatFor?.name ?? "")}
        subtitle={seatFor ? `${seatFor.party_size} 👤` : undefined}
        onClose={() => setSeatFor(null)}
        maxWidth={520}
      >
        <View style={styles.tableGrid}>
          {(tables.data ?? [])
            .filter((x: FloorTable) => x.is_active)
            .sort(
              (a, b) =>
                (a.status === "available" ? -1 : 1) -
                (b.status === "available" ? -1 : 1),
            )
            .map((x: FloorTable) => {
              const fits = x.capacity >= (seatFor?.party_size ?? 1);
              const free = x.status === "available";
              return (
                <Pressable
                  key={x.id}
                  onPress={() =>
                    seatFor && seat.mutate({ id: seatFor.id, tableId: x.id })
                  }
                  style={[
                    styles.tableChip,
                    !free && styles.tableChipBusy,
                    !fits && styles.tableChipSmall,
                  ]}
                  testID={`seat-table-${x.number}`}
                >
                  <Text style={styles.tableNumber}>
                    {x.display_name ?? x.number}
                  </Text>
                  <Text style={styles.tableMeta}>
                    {x.capacity} 👤{free ? "" : ` · ${t.waitlist.occupied}`}
                  </Text>
                </Pressable>
              );
            })}
        </View>
      </Sheet>
    </View>
  );
}

function AddWalkInSheet({
  visible,
  onClose,
  onAdded,
}: {
  visible: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const t = useT();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [party, setParty] = useState(2);
  const [quoted, setQuoted] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const estimate = useQuery({
    queryKey: ["waitlist-estimate", party],
    queryFn: () => estimateWait(party),
    enabled: visible,
  });
  useEffect(() => {
    if (visible) {
      setName("");
      setPhone("");
      setParty(2);
      setQuoted("");
      setNotes("");
      setError(null);
    }
  }, [visible]);
  const add = useMutation({
    mutationFn: () =>
      addWalkIn({
        name: name.trim(),
        phone: phone.trim() || undefined,
        party_size: party,
        quoted_minutes: quoted.trim() ? Number(quoted) : undefined,
        notes: notes.trim() || undefined,
      }),
    onSuccess: onAdded,
    onError: (err) => {
      const code = waitlistErrorCode(err);
      const known = code
        ? (t.waitlist.errors as Record<string, string>)[code]
        : undefined;
      setError(known ?? t.waitlist.errors.generic);
    },
  });
  return (
    <Sheet
      visible={visible}
      title={t.waitlist.addWalkIn}
      onClose={onClose}
      maxWidth={480}
      testID="add-walk-in-sheet"
      footer={
        <>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            title={t.waitlist.add}
            variant="primary"
            size="lg"
            fullWidth
            disabled={!name.trim() || add.isPending}
            loading={add.isPending}
            onPress={() => add.mutate()}
            testID="walk-in-submit"
          />
        </>
      }
    >
      <View style={{ gap: spacing.md }}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t.waitlist.name}
          placeholderTextColor={colors.slate400}
          style={styles.input}
          testID="walk-in-name"
        />
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder={t.waitlist.phone}
          placeholderTextColor={colors.slate400}
          keyboardType="phone-pad"
          style={styles.input}
        />
        <View style={styles.stepper}>
          <Text style={styles.stepLabel}>{t.waitlist.party}</Text>
          <Pressable
            onPress={() => setParty((p) => Math.max(1, p - 1))}
            style={styles.stepBtn}
          >
            <Ionicons name="remove" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={styles.stepValue}>{party}</Text>
          <Pressable
            onPress={() => setParty((p) => Math.min(50, p + 1))}
            style={styles.stepBtn}
          >
            <Ionicons name="add" size={22} color={colors.foreground} />
          </Pressable>
        </View>
        <TextInput
          value={quoted}
          onChangeText={setQuoted}
          placeholder={
            estimate.data !== undefined
              ? t.waitlist.quotedPlaceholder.replace(
                  "{minutes}",
                  String(estimate.data),
                )
              : t.waitlist.quoted
          }
          placeholderTextColor={colors.slate400}
          keyboardType="number-pad"
          style={styles.input}
        />
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder={t.waitlist.notes}
          placeholderTextColor={colors.slate400}
          style={styles.input}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.foreground,
  },
  empty: { color: colors.muted, textAlign: "center", padding: spacing.xl },
  error: { color: colors.danger, fontSize: 13 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
  },
  pos: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.slate100,
    alignItems: "center",
    justifyContent: "center",
  },
  posText: { fontWeight: typography.weights.bold, color: colors.foreground },
  name: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.foreground,
  },
  meta: { fontSize: 13, color: colors.muted },
  phone: { fontSize: 13, color: colors.info },
  actions: { flexDirection: "row", gap: spacing.xs, alignItems: "center" },
  iconBtn: {
    padding: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  seatBtn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    paddingHorizontal: 12,
  },
  seatText: { color: colors.white, fontWeight: "700", fontSize: 13 },
  tableGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tableChip: {
    width: "31%",
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.success,
    backgroundColor: colors.successTint,
    alignItems: "center",
  },
  tableChipBusy: {
    borderColor: colors.border,
    backgroundColor: colors.slate50,
    opacity: 0.7,
  },
  tableChipSmall: { borderColor: colors.warning },
  tableNumber: {
    fontWeight: typography.weights.bold,
    color: colors.foreground,
  },
  tableMeta: { fontSize: 12, color: colors.muted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: typography.sizes.lg,
    color: colors.foreground,
    backgroundColor: colors.surface,
  },
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  stepLabel: {
    flex: 1,
    fontSize: typography.sizes.md,
    color: colors.foreground,
  },
  stepBtn: {
    padding: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    minWidth: 32,
    textAlign: "center",
  },
});
