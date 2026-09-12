import { api } from "./client";

export type TableShape = "square" | "round" | "rectangle";
export type TableStatus = "available" | "occupied" | "reserved" | "unavailable";

export interface TableSectionRow {
  id: string;
  name: string;
  description?: string;
  display_order: number;
  is_active: boolean;
  floor_width: number;
  floor_height: number;
  background_note?: string;
  tables_count?: number;
  is_shared?: boolean;
}

export interface FloorTable {
  id: string;
  number: string;
  name?: string;
  display_name?: string;
  capacity: number;
  min_capacity?: number;
  status: TableStatus;
  is_active: boolean;
  section: string | null;
  section_name?: string;
  position_x: number | null;
  position_y: number | null;
  rotation: number;
  width: number;
  height: number;
  shape: TableShape;
  is_shared?: boolean;
}

export interface LayoutItem {
  id: string;
  position_x: number;
  position_y: number;
  rotation?: number;
  width?: number;
  height?: number;
}

interface Paginated<T> {
  count: number;
  results: T[];
}

function unwrap<T>(data: Paginated<T> | T[]): T[] {
  return Array.isArray(data) ? data : (data.results ?? []);
}

export async function listSections(): Promise<TableSectionRow[]> {
  const res = await api.get<Paginated<TableSectionRow> | TableSectionRow[]>(
    "/api/v1/dashboard/tables/sections/",
    { params: { page_size: 100 } },
  );
  return unwrap(res.data).filter((s) => s.is_active !== false);
}

export async function listFloorTables(): Promise<FloorTable[]> {
  const res = await api.get<Paginated<FloorTable> | FloorTable[]>(
    "/api/v1/dashboard/tables/",
    {
      params: { page_size: 300, active: "true" },
    },
  );
  return unwrap(res.data);
}

export async function saveLayout(tables: LayoutItem[]): Promise<FloorTable[]> {
  const res = await api.patch<FloorTable[]>(
    "/api/v1/dashboard/tables/layout/",
    { tables },
  );
  return res.data;
}

export async function createTable(body: {
  number: string;
  capacity: number;
  shape: TableShape;
  section?: string | null;
  position_x?: number;
  position_y?: number;
  width?: number;
  height?: number;
}): Promise<FloorTable> {
  const res = await api.post<FloorTable>("/api/v1/dashboard/tables/", {
    ...body,
    generate_qr: true,
  });
  return res.data;
}

export async function startSession(
  tableId: string,
  guestCount = 1,
): Promise<{ id: string }> {
  const res = await api.post<{ id: string }>(
    "/api/v1/dashboard/tables/sessions/start/",
    {
      table_id: tableId,
      guest_count: guestCount,
    },
  );
  return res.data;
}

/** Default footprint on the 1000-wide logical canvas by shape. */
export function defaultSize(shape: TableShape): {
  width: number;
  height: number;
} {
  if (shape === "rectangle") return { width: 160, height: 90 };
  return { width: 100, height: 100 };
}
