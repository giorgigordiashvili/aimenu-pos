import { api } from "./client";

export interface TimeEntryRow {
  id: string;
  staff_member: string;
  name: string;
  role: string;
  clock_in: string;
  clock_out: string | null;
  break_minutes: number;
  source: "pos" | "admin" | "auto";
  note: string;
  auto_closed: boolean;
  worked_minutes: number;
}

export interface ClockStatus {
  clocked_in: boolean;
  entry: TimeEntryRow | null;
  today_minutes: number;
  manager: boolean;
}

export interface RotaShiftRow {
  id: string;
  staff_member: string;
  name: string;
  date: string;
  start_time: string;
  end_time: string;
  label: string;
  note: string;
  published: boolean;
  hours: string;
}

const BASE = "/api/v1/dashboard/timekeeping";

export async function clockStatus(): Promise<ClockStatus> {
  const res = await api.get<ClockStatus>(`${BASE}/clock/`);
  return res.data;
}

export async function clock(
  action: "in" | "out",
  breakMinutes = 0,
): Promise<ClockStatus> {
  const res = await api.post<ClockStatus>(`${BASE}/clock/`, {
    action,
    break_minutes: breakMinutes,
  });
  return res.data;
}

export async function whosIn(): Promise<TimeEntryRow[]> {
  const res = await api.get<TimeEntryRow[]>(`${BASE}/whos-in/`);
  return res.data;
}

export async function myShifts(): Promise<RotaShiftRow[]> {
  const res = await api.get<RotaShiftRow[]>(`${BASE}/rota/mine/`);
  return res.data;
}
