import { api } from "./client";

export type WaitlistStatus =
  | "waiting"
  | "notified"
  | "seated"
  | "left"
  | "cancelled"
  | "no_show";

export interface WaitlistEntry {
  id: string;
  date: string;
  position: number;
  name: string;
  phone: string;
  party_size: number;
  quoted_minutes: number;
  status: WaitlistStatus;
  status_display: string;
  is_open: boolean;
  source: "pos" | "self" | "reservation";
  notes: string;
  notified_at: string | null;
  notify_count: number;
  seated_at: string | null;
  left_at: string | null;
  table: string | null;
  table_number: string;
  session: string | null;
  reservation: string | null;
  reservation_code: string;
  estimated_ready_at: string | null;
  waited_minutes: number;
  created_at: string;
}

export interface WaitlistSummary {
  waiting: number;
  notified: number;
  longest_wait: number;
  seated_today: number;
}

const BASE = "/api/v1/dashboard/waitlist";

export async function listWaitlist(all = false): Promise<WaitlistEntry[]> {
  return (
    await api.get<WaitlistEntry[]>(`${BASE}/entries/`, {
      params: { all: all ? "1" : undefined },
    })
  ).data;
}

export async function waitlistSummary(): Promise<WaitlistSummary> {
  return (await api.get<WaitlistSummary>(`${BASE}/summary/`)).data;
}

export async function estimateWait(partySize: number): Promise<number> {
  const res = await api.get<{ party_size: number; minutes: number }>(
    `${BASE}/estimate/`,
    { params: { party_size: partySize } },
  );
  return res.data.minutes;
}

export async function addWalkIn(body: {
  name: string;
  phone?: string;
  party_size: number;
  quoted_minutes?: number | null;
  notes?: string;
}): Promise<WaitlistEntry> {
  return (await api.post<WaitlistEntry>(`${BASE}/entries/`, body)).data;
}

export async function updateWaitlistEntry(
  id: string,
  body: Partial<{
    name: string;
    phone: string;
    party_size: number;
    quoted_minutes: number;
    notes: string;
    position: number;
  }>,
): Promise<WaitlistEntry> {
  return (await api.patch<WaitlistEntry>(`${BASE}/entries/${id}/`, body)).data;
}

export async function notifyWaitlist(id: string): Promise<WaitlistEntry> {
  return (await api.post<WaitlistEntry>(`${BASE}/entries/${id}/notify/`)).data;
}

export async function seatWaitlist(
  id: string,
  tableId: string,
): Promise<WaitlistEntry> {
  return (
    await api.post<WaitlistEntry>(`${BASE}/entries/${id}/seat/`, {
      table_id: tableId,
    })
  ).data;
}

export async function markWaitlist(
  id: string,
  status: "left" | "no-show" | "cancel",
): Promise<WaitlistEntry> {
  return (await api.post<WaitlistEntry>(`${BASE}/entries/${id}/${status}/`))
    .data;
}

export async function reservationToWaitlist(
  reservationId: string,
): Promise<WaitlistEntry> {
  return (
    await api.post<WaitlistEntry>(
      `${BASE}/reservations/${reservationId}/to-waitlist/`,
    )
  ).data;
}

export function waitlistErrorCode(err: unknown): string | null {
  const data = (err as { response?: { data?: { error?: { code?: string } } } })
    .response?.data;
  return data?.error?.code ?? null;
}
