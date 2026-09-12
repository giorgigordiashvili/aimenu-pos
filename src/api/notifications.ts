import { api } from "./client";

export interface NotificationRow {
  id: string;
  event: string;
  title: string;
  body: string;
  data: { kind?: string; id?: string; event?: string; sound?: boolean };
  url: string;
  read_at: string | null;
  created_at: string;
}

export interface UnreadCount {
  unread: number;
  latest_id: string | null;
}

export interface NotificationEvent {
  code: string;
  title: string;
  description: string;
  group: string;
  muted: boolean;
}

export interface NotificationPrefs {
  push: boolean;
  email: boolean;
  quiet_from: string | null;
  quiet_to: string | null;
  muted_events: string[];
  events: NotificationEvent[];
}

interface Paginated<T> {
  count: number;
  results: T[];
}

const BASE = "/api/v1/dashboard/notifications";

export async function listNotifications(params?: {
  unread?: boolean;
  page?: number;
}): Promise<Paginated<NotificationRow>> {
  const res = await api.get<Paginated<NotificationRow>>(`${BASE}/`, {
    params: {
      unread: params?.unread ? 1 : undefined,
      page: params?.page,
      page_size: 50,
    },
  });
  return res.data;
}

export async function unreadCount(): Promise<UnreadCount> {
  const res = await api.get<UnreadCount>(`${BASE}/unread-count/`);
  return res.data;
}

export async function markRead(ids?: string[]): Promise<UnreadCount> {
  const res = await api.post<UnreadCount>(`${BASE}/read/`, ids ? { ids } : {});
  return res.data;
}

export async function registerDevice(input: {
  token: string;
  kind?: "expo" | "web";
  platform?: string;
  app_version?: string;
}): Promise<void> {
  await api.post(`${BASE}/devices/`, { kind: "expo", ...input });
}

export async function removeDevice(token: string): Promise<void> {
  await api.delete(`${BASE}/devices/`, { data: { token } });
}

export async function getPrefs(): Promise<NotificationPrefs> {
  const res = await api.get<NotificationPrefs>(`${BASE}/prefs/`);
  return res.data;
}

export async function updatePrefs(
  input: Partial<Pick<NotificationPrefs, "push" | "email" | "muted_events">>,
): Promise<NotificationPrefs> {
  const res = await api.put<NotificationPrefs>(`${BASE}/prefs/`, input);
  return res.data;
}

export async function sendTestPush(): Promise<NotificationRow[]> {
  const res = await api.post<NotificationRow[]>(`${BASE}/test/`);
  return res.data;
}
