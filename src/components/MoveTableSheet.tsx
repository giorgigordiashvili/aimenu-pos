import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { listTables, type TableRow } from "@/api/sessions";
import Sheet from "@/components/Sheet";
import { useT } from "@/i18n";
import { colors, radius, spacing, typography } from "@/theme/tokens";

interface Props {
  visible: boolean;
  currentTableId?: string | null;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onPick: (table: TableRow) => void;
}

/** Grid of tables grouped by section; tap one to re-seat the order there. */
export default function MoveTableSheet({
  visible,
  currentTableId,
  loading,
  error,
  onClose,
  onPick,
}: Props) {
  const t = useT();
  const tables = useQuery({
    queryKey: ["tables"],
    queryFn: listTables,
    enabled: visible,
    staleTime: 30_000,
  });
  const groups = useMemo(() => {
    const out = new Map<string, TableRow[]>();
    for (const row of tables.data ?? []) {
      if (row.is_active === false) continue;
      const key = row.section_name ?? "";
      if (!out.has(key)) out.set(key, []);
      out.get(key)!.push(row);
    }
    return [...out.entries()];
  }, [tables.data]);

  return (
    <Sheet
      visible={visible}
      title={t.cash.move}
      subtitle={t.cash.moveHint}
      onClose={onClose}
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {tables.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {groups.map(([section, rows]) => (
        <View key={section || "_"} style={{ gap: spacing.sm }}>
          {section ? <Text style={styles.section}>{section}</Text> : null}
          <View style={styles.grid}>
            {rows.map((row) => {
              const isCurrent = row.id === currentTableId;
              const occupied = row.status === "occupied";
              return (
                <Pressable
                  key={row.id}
                  disabled={isCurrent || loading}
                  onPress={() => onPick(row)}
                  style={[
                    styles.table,
                    occupied && styles.tableOccupied,
                    isCurrent && styles.tableCurrent,
                  ]}
                  accessibilityRole="button"
                >
                  <Text style={styles.tableNumber}>{row.number}</Text>
                  {row.capacity ? (
                    <Text style={styles.tableSub}>{row.capacity} 👤</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  section: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  table: {
    width: 84,
    height: 64,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.success,
    backgroundColor: colors.successTint,
    alignItems: "center",
    justifyContent: "center",
  },
  tableOccupied: {
    borderColor: colors.warning,
    backgroundColor: colors.warningTint,
  },
  tableCurrent: {
    borderColor: colors.slate300,
    backgroundColor: colors.slate100,
    opacity: 0.6,
  },
  tableNumber: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.foreground,
  },
  tableSub: { fontSize: typography.sizes.xs, color: colors.muted },
  error: {
    color: colors.danger,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
});
