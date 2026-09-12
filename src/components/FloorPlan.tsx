import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
} from "react-native";

import type { TableSessionRow } from "@/api/sessions";
import {
  defaultSize,
  type FloorTable,
  type LayoutItem,
  type TableSectionRow,
  type TableShape,
} from "@/api/tables";
import Button from "@/components/Button";
import Sheet from "@/components/Sheet";
import { useT } from "@/i18n";
import { money } from "@/lib/money";
import { colors, radius, spacing, typography } from "@/theme/tokens";

const GRID = 10;

export interface Draft {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
}

export type Drafts = Record<string, Draft>;

interface Props {
  sections: TableSectionRow[];
  tables: FloorTable[];
  sessionsByTable: Record<string, TableSessionRow>;
  editing: boolean;
  drafts: Drafts;
  onDraftsChange: (next: Drafts) => void;
  onPressTable: (table: FloorTable) => void;
  onAddTable?: (body: {
    number: string;
    capacity: number;
    shape: TableShape;
    section: string | null;
  }) => Promise<void>;
  now: number;
}

/** Where a table sits: its saved place, or an automatic slot when it was never placed. */
export function initialDrafts(tables: FloorTable[]): Drafts {
  const out: Drafts = {};
  const perSection: Record<string, number> = {};
  for (const t of tables) {
    const key = t.section ?? "_";
    const i = perSection[key] ?? 0;
    perSection[key] = i + 1;
    const size =
      t.width && t.height
        ? { width: t.width, height: t.height }
        : defaultSize(t.shape);
    const placed =
      t.position_x !== null &&
      t.position_y !== null &&
      (t.position_x > 0 || t.position_y > 0);
    out[t.id] = {
      x: placed ? t.position_x! : 40 + (i % 6) * 150,
      y: placed ? t.position_y! : 40 + Math.floor(i / 6) * 150,
      w: size.width,
      h: size.height,
      rotation: t.rotation ?? 0,
    };
  }
  return out;
}

export function toLayoutItems(drafts: Drafts, ids: string[]): LayoutItem[] {
  return ids
    .filter((id) => drafts[id])
    .map((id) => ({
      id,
      position_x: Math.round(drafts[id].x),
      position_y: Math.round(drafts[id].y),
      rotation: drafts[id].rotation,
      width: Math.round(drafts[id].w),
      height: Math.round(drafts[id].h),
    }));
}

const STATUS_TONE: Record<string, { bg: string; border: string; fg: string }> =
  {
    available: {
      bg: colors.successTint,
      border: colors.success,
      fg: colors.successDark,
    },
    occupied: {
      bg: colors.warningTint,
      border: colors.warning,
      fg: colors.warningDark,
    },
    reserved: { bg: colors.infoTint, border: colors.info, fg: colors.info },
    unavailable: {
      bg: colors.slate100,
      border: colors.slate300,
      fg: colors.slate500,
    },
  };

export default function FloorPlan({
  sections,
  tables,
  sessionsByTable,
  editing,
  drafts,
  onDraftsChange,
  onPressTable,
  onAddTable,
  now,
}: Props) {
  const t = useT();
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);

  const activeSection = useMemo(() => {
    if (sections.length === 0) return null;
    return sections.find((s) => s.id === sectionId) ?? sections[0];
  }, [sections, sectionId]);
  useEffect(() => {
    if (!editing) setSelected(null);
  }, [editing]);

  const visible = tables.filter((tb) =>
    activeSection ? tb.section === activeSection.id : !tb.section,
  );
  const floorW = activeSection?.floor_width ?? 1000;
  const floorH = activeSection?.floor_height ?? 700;
  const scale = containerWidth > 0 ? containerWidth / floorW : 0.5;

  function update(id: string, patch: Partial<Draft>) {
    const cur = drafts[id];
    if (!cur) return;
    const next = { ...cur, ...patch };
    next.x = Math.max(0, Math.min(floorW - next.w, next.x));
    next.y = Math.max(0, Math.min(floorH - next.h, next.y));
    onDraftsChange({ ...drafts, [id]: next });
  }

  return (
    <View style={styles.root}>
      <View style={styles.sectionTabs}>
        {sections.map((s) => (
          <Pressable
            key={s.id}
            onPress={() => setSectionId(s.id)}
            style={[
              styles.sectionTab,
              activeSection?.id === s.id && styles.sectionTabActive,
            ]}
          >
            <Text
              style={[
                styles.sectionTabText,
                activeSection?.id === s.id && styles.sectionTabTextActive,
              ]}
            >
              {s.name}
            </Text>
          </Pressable>
        ))}
        {editing && onAddTable ? (
          <Pressable
            onPress={() => setAddOpen(true)}
            style={[styles.sectionTab, styles.addTab]}
          >
            <Ionicons name="add" size={16} color={colors.primary} />
            <Text style={[styles.sectionTabText, { color: colors.primary }]}>
              {t.floor.addTable}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {activeSection?.background_note ? (
        <Text style={styles.note}>{activeSection.background_note}</Text>
      ) : null}

      <View
        style={[
          styles.canvas,
          { height: floorH * scale },
          editing && styles.canvasEditing,
        ]}
        onLayout={(e: LayoutChangeEvent) =>
          setContainerWidth(e.nativeEvent.layout.width)
        }
        testID="floor-canvas"
      >
        {editing ? (
          <GridDots
            width={containerWidth}
            height={floorH * scale}
            step={50 * scale}
          />
        ) : null}
        {visible.map((tb) => (
          <FloorTableView
            key={tb.id}
            table={tb}
            draft={drafts[tb.id]}
            scale={scale}
            session={sessionsByTable[tb.id]}
            editing={editing}
            selected={selected === tb.id}
            now={now}
            onPress={() => (editing ? setSelected(tb.id) : onPressTable(tb))}
            onMove={(dx, dy) => {
              const d = drafts[tb.id];
              update(tb.id, { x: d.x + dx / scale, y: d.y + dy / scale });
            }}
            onRelease={() => {
              const d = drafts[tb.id];
              update(tb.id, {
                x: Math.round(d.x / GRID) * GRID,
                y: Math.round(d.y / GRID) * GRID,
              });
            }}
          />
        ))}
        {visible.length === 0 ? (
          <Text style={styles.empty}>{t.floor.noTables}</Text>
        ) : null}
      </View>

      {editing && selected && drafts[selected] ? (
        <View style={styles.tools} testID="layout-tools">
          <Text style={styles.toolsTitle}>
            {t.tablesScreen.tableLabel}{" "}
            {tables.find((x) => x.id === selected)?.number}
          </Text>
          <View style={styles.toolsRow}>
            <Tool
              icon="refresh"
              label={t.floor.rotate}
              onPress={() =>
                update(selected, {
                  rotation: (drafts[selected].rotation + 90) % 360,
                })
              }
            />
            <Tool
              icon="remove"
              label={t.floor.narrower}
              onPress={() =>
                update(selected, { w: Math.max(40, drafts[selected].w - 20) })
              }
            />
            <Tool
              icon="add"
              label={t.floor.wider}
              onPress={() =>
                update(selected, { w: Math.min(600, drafts[selected].w + 20) })
              }
            />
            <Tool
              icon="chevron-up"
              label={t.floor.shorter}
              onPress={() =>
                update(selected, { h: Math.max(40, drafts[selected].h - 20) })
              }
            />
            <Tool
              icon="chevron-down"
              label={t.floor.taller}
              onPress={() =>
                update(selected, { h: Math.min(600, drafts[selected].h + 20) })
              }
            />
          </View>
        </View>
      ) : null}

      <AddTableSheet
        visible={addOpen}
        sectionId={activeSection?.id ?? null}
        onClose={() => setAddOpen(false)}
        onAdd={async (body) => {
          if (onAddTable) await onAddTable(body);
          setAddOpen(false);
        }}
      />
    </View>
  );
}

function GridDots({
  width,
  height,
  step,
}: {
  width: number;
  height: number;
  step: number;
}) {
  if (!width || !step) return null;
  const cols = Math.floor(width / step);
  const rows = Math.floor(height / step);
  const dots = [];
  for (let r = 1; r < rows; r++) {
    for (let c = 1; c < cols; c++) {
      dots.push(
        <View
          key={`${r}-${c}`}
          style={[styles.dot, { left: c * step, top: r * step }]}
        />,
      );
    }
  }
  return <>{dots}</>;
}

function Tool({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.tool}>
      <Ionicons name={icon} size={18} color={colors.foreground} />
      <Text style={styles.toolText}>{label}</Text>
    </Pressable>
  );
}

interface TableViewProps {
  table: FloorTable;
  draft?: Draft;
  scale: number;
  session?: TableSessionRow;
  editing: boolean;
  selected: boolean;
  now: number;
  onPress: () => void;
  onMove: (dx: number, dy: number) => void;
  onRelease: () => void;
}

function FloorTableView({
  table,
  draft,
  scale,
  session,
  editing,
  selected,
  now,
  onPress,
  onMove,
  onRelease,
}: TableViewProps) {
  const t = useT();
  const last = useRef({ x: 0, y: 0 });
  const moved = useRef(false);
  const handlers = useRef({ onMove, onRelease, onPress, editing });
  handlers.current = { onMove, onRelease, onPress, editing };
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) =>
        handlers.current.editing && (Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2),
      onPanResponderGrant: () => {
        last.current = { x: 0, y: 0 };
        moved.current = false;
      },
      onPanResponderMove: (_e, g) => {
        if (!handlers.current.editing) return;
        moved.current = true;
        handlers.current.onMove(g.dx - last.current.x, g.dy - last.current.y);
        last.current = { x: g.dx, y: g.dy };
      },
      onPanResponderRelease: () => {
        if (moved.current) handlers.current.onRelease();
        else handlers.current.onPress();
      },
      onPanResponderTerminate: () => {
        if (moved.current) handlers.current.onRelease();
      },
    }),
  ).current;
  if (!draft) return null;
  const status = session ? "occupied" : table.status;
  const tone = STATUS_TONE[status] ?? STATUS_TONE.available;
  const w = draft.w * scale;
  const h = draft.h * scale;
  const rotated = draft.rotation % 180 !== 0;
  const elapsed = session
    ? Math.max(
        Math.floor((now - new Date(session.started_at).getTime()) / 60_000),
        0,
      )
    : 0;
  const balance =
    session?.orders_summary?.balance ?? session?.orders_summary?.unpaid_total;
  const label = w > 70 && h > 50;
  return (
    <View
      {...pan.panHandlers}
      style={[
        styles.table,
        {
          left: draft.x * scale,
          top: draft.y * scale,
          width: w,
          height: h,
          backgroundColor: tone.bg,
          borderColor: selected ? colors.primary : tone.border,
          borderWidth: selected ? 3 : 2,
          borderRadius:
            table.shape === "round" ? Math.min(w, h) / 2 : radius.md,
          transform: [{ rotate: `${draft.rotation}deg` }],
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${t.tablesScreen.tableLabel} ${table.number}`}
      testID={`floor-table-${table.number}`}
    >
      <View
        style={{
          transform: [
            {
              rotate: rotated
                ? `-${draft.rotation}deg`
                : `-${draft.rotation}deg`,
            },
          ],
          alignItems: "center",
        }}
      >
        <Text
          style={[
            styles.tableNumber,
            {
              color: tone.fg,
              fontSize: label ? typography.sizes.lg : typography.sizes.sm,
            },
          ]}
        >
          {table.number}
        </Text>
        {label ? (
          session ? (
            <>
              {balance ? (
                <Text style={[styles.tableSub, { color: tone.fg }]}>
                  {money(balance)}
                </Text>
              ) : null}
              <Text style={[styles.tableSub, { color: tone.fg }]}>
                {t.floor.elapsed.replace("{min}", String(elapsed))}
              </Text>
            </>
          ) : (
            <Text style={[styles.tableSub, { color: tone.fg }]}>
              {table.capacity} 👤 ·{" "}
              {(t.floor.status as Record<string, string>)[status] ?? status}
            </Text>
          )
        ) : null}
      </View>
    </View>
  );
}

function AddTableSheet({
  visible,
  sectionId,
  onClose,
  onAdd,
}: {
  visible: boolean;
  sectionId: string | null;
  onClose: () => void;
  onAdd: (body: {
    number: string;
    capacity: number;
    shape: TableShape;
    section: string | null;
  }) => Promise<void>;
}) {
  const t = useT();
  const [number, setNumber] = useState("");
  const [capacity, setCapacity] = useState(4);
  const [shape, setShape] = useState<TableShape>("square");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (visible) {
      setNumber("");
      setCapacity(4);
      setShape("square");
      setError(null);
    }
  }, [visible]);
  return (
    <Sheet
      visible={visible}
      title={t.floor.addTable}
      onClose={onClose}
      maxWidth={440}
      footer={
        <>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            title={t.floor.addTable}
            variant="primary"
            size="lg"
            fullWidth
            disabled={!number.trim() || busy}
            loading={busy}
            onPress={async () => {
              setBusy(true);
              setError(null);
              try {
                await onAdd({
                  number: number.trim(),
                  capacity,
                  shape,
                  section: sectionId,
                });
              } catch (err) {
                const msg = (
                  err as {
                    response?: {
                      data?: { number?: string[]; detail?: string };
                    };
                  }
                )?.response?.data;
                setError(
                  msg?.number?.[0] ?? msg?.detail ?? t.cash.errors.generic,
                );
              } finally {
                setBusy(false);
              }
            }}
          />
        </>
      }
    >
      <Text style={styles.fieldLabel}>{t.floor.tableNumber}</Text>
      <TextInput
        value={number}
        onChangeText={setNumber}
        style={styles.input}
        autoFocus
      />
      <Text style={styles.fieldLabel}>{t.floor.seats}</Text>
      <View style={styles.stepper}>
        <Pressable
          onPress={() => setCapacity((c) => Math.max(1, c - 1))}
          style={styles.stepBtn}
        >
          <Ionicons name="remove" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={styles.stepValue}>{capacity}</Text>
        <Pressable
          onPress={() => setCapacity((c) => Math.min(30, c + 1))}
          style={styles.stepBtn}
        >
          <Ionicons name="add" size={20} color={colors.foreground} />
        </Pressable>
      </View>
      <Text style={styles.fieldLabel}>{t.floor.shape}</Text>
      <View style={styles.shapes}>
        {(["square", "round", "rectangle"] as TableShape[]).map((s) => (
          <Pressable
            key={s}
            onPress={() => setShape(s)}
            style={[styles.shapeChip, shape === s && styles.shapeChipActive]}
          >
            <Text
              style={[
                styles.shapeText,
                shape === s && { color: colors.primary },
              ]}
            >
              {t.floor.shapes[s]}
            </Text>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  sectionTabs: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  sectionTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  sectionTabActive: {
    backgroundColor: colors.slate900,
    borderColor: colors.slate900,
  },
  sectionTabText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.foreground,
  },
  sectionTabTextActive: { color: colors.white },
  addTab: { borderColor: colors.primary, borderStyle: "dashed" },
  note: { fontSize: typography.sizes.sm, color: colors.muted },
  canvas: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    position: "relative",
  },
  canvasEditing: { borderColor: colors.primary, borderStyle: "dashed" },
  dot: {
    position: "absolute",
    width: 2,
    height: 2,
    backgroundColor: colors.slate300,
    borderRadius: 1,
  },
  table: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    padding: 2,
  },
  tableNumber: { fontWeight: typography.weights.bold },
  tableSub: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  empty: {
    position: "absolute",
    top: 24,
    left: 24,
    color: colors.muted,
    fontSize: typography.sizes.sm,
  },
  tools: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  toolsTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.foreground,
  },
  toolsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tool: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toolText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.foreground,
  },
  fieldLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: typography.sizes.lg,
    color: colors.foreground,
  },
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.foreground,
  },
  shapes: { flexDirection: "row", gap: spacing.sm },
  shapeChip: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shapeChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
  },
  shapeText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.foreground,
  },
  error: {
    color: colors.danger,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
});
