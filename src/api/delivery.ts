import { api } from "./client";

export type PlatformCode = "glovo" | "wolt" | "bolt_food";

export interface PlatformStatusRow {
  platform: PlatformCode;
  label: string;
  implemented: boolean;
  is_enabled: boolean;
  configured: boolean;
  store_external_id: string;
  auto_accept: boolean;
  prep_time_minutes: number;
  sandbox: boolean;
  online: boolean;
  paused_until: string | null;
  last_menu_sync_at: string | null;
  last_menu_sync_status: string;
  orders_today: number;
  awaiting_accept: number;
}

export interface StoreStatus {
  online: boolean;
  paused_until: string | null;
  live: Record<string, unknown> | null;
}

const BASE = "/api/v1/dashboard/delivery";

export async function listPlatforms(): Promise<PlatformStatusRow[]> {
  const res = await api.get<PlatformStatusRow[]>(`${BASE}/platforms/`);
  return res.data;
}

/** Hide the store on the platform for a while (kitchen swamped). */
export async function pausePlatform(
  code: PlatformCode,
  minutes: number,
): Promise<StoreStatus> {
  const res = await api.post<StoreStatus>(`${BASE}/platforms/${code}/pause/`, {
    minutes,
  });
  return res.data;
}

export async function resumePlatform(code: PlatformCode): Promise<StoreStatus> {
  const res = await api.post<StoreStatus>(`${BASE}/platforms/${code}/resume/`);
  return res.data;
}

export async function syncPlatformMenu(
  code: PlatformCode,
  kind: "full" | "updates" = "updates",
): Promise<void> {
  await api.post(`${BASE}/platforms/${code}/menu-sync/`, { kind });
}
