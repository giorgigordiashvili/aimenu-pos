import { api } from './client';

export interface SessionOrdersSummary {
  counts: Record<string, number>;
  total_orders: number;
  non_terminal: number;
  grand_total: string;
  all_terminal: boolean;
  unpaid_count: number;
  unpaid_order_numbers: string[];
  unpaid_total: string;
  all_paid: boolean;
}

export interface CloseSessionError {
  code?: string;
  message: string;
  unpaid_order_numbers?: string[];
  unpaid_total?: string;
}

export interface TableSessionRow {
  id: string;
  table: string;
  table_number: string;
  guest_count: number;
  status: string;
  payment_mode: string;
  started_at: string;
  orders_summary: SessionOrdersSummary;
}

interface Paginated<T> {
  count: number;
  results: T[];
}

export async function listActiveTableSessions(): Promise<Paginated<TableSessionRow>> {
  const res = await api.get<Paginated<TableSessionRow>>('/api/v1/dashboard/tables/sessions/', {
    params: { status: 'active', page_size: 100 },
  });
  return res.data;
}

export async function closeTableSession(id: string, force = false): Promise<void> {
  await api.post(`/api/v1/dashboard/tables/sessions/${id}/close/`, force ? { force: true } : {});
}
