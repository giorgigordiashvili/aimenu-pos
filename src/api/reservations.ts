import { api } from './client';

export type ReservationStatus =
  | 'pending_payment'
  | 'pending'
  | 'confirmed'
  | 'waitlist'
  | 'seated'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export interface Reservation {
  id: string;
  confirmation_code: string;
  restaurant?: string;
  guest_name: string;
  guest_phone: string;
  guest_email?: string;
  reservation_date: string;
  reservation_time: string;
  party_size: number;
  duration?: string;
  table?: string;
  table_number?: string;
  status: ReservationStatus | { value: string };
  status_display?: string;
  source?: string;
  source_display?: string;
  special_requests?: string;
  internal_notes?: string;
  can_cancel?: boolean;
  can_modify?: boolean;
  is_upcoming?: boolean;
  created_at: string;
  updated_at?: string;
}

interface Paginated<T> {
  count: number;
  next?: string | null;
  previous?: string | null;
  results: T[];
}

export async function listTodayReservations(params?: {
  ordering?: string;
  page?: number;
  pageSize?: number;
}): Promise<Paginated<Reservation>> {
  const response = await api.get<Paginated<Reservation>>(
    '/api/v1/dashboard/reservations/today/',
    {
      params: {
        ordering: params?.ordering ?? 'reservation_time',
        page: params?.page,
        page_size: params?.pageSize ?? 100,
      },
    }
  );
  return response.data;
}

export async function listUpcomingReservations(params?: {
  ordering?: string;
  page?: number;
  pageSize?: number;
}): Promise<Paginated<Reservation>> {
  const response = await api.get<Paginated<Reservation>>(
    '/api/v1/dashboard/reservations/upcoming/',
    {
      params: {
        ordering: params?.ordering ?? 'reservation_date',
        page: params?.page,
        page_size: params?.pageSize ?? 100,
      },
    }
  );
  return response.data;
}

export async function getReservation(id: string): Promise<Reservation> {
  const response = await api.get<Reservation>(`/api/v1/dashboard/reservations/${id}/`);
  return response.data;
}

export async function setReservationStatus(
  id: string,
  status: ReservationStatus,
  notes?: string
): Promise<Reservation> {
  const response = await api.post<Reservation>(
    `/api/v1/dashboard/reservations/${id}/status/`,
    { status, notes }
  );
  return response.data;
}

export function resolveReservationStatus(raw: Reservation['status']): ReservationStatus {
  if (typeof raw === 'string') return raw as ReservationStatus;
  if (raw && typeof raw === 'object' && 'value' in raw) return raw.value as ReservationStatus;
  return 'pending';
}
