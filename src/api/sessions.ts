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

export interface MarkCashPaidResponse {
  success: boolean;
  data?: {
    transaction_id: string;
    amount: string;
    covered_order_numbers: string[];
  };
}

/**
 * Record a cash payment covering every unpaid order on the session. The
 * backend creates a `cash_settle` BogTransaction whose completed status
 * satisfies the close-session guard, so the table can then be closed
 * cleanly through the normal flow.
 */
export async function markTableSessionCashPaid(id: string): Promise<MarkCashPaidResponse> {
  const res = await api.post<MarkCashPaidResponse>(
    `/api/v1/dashboard/tables/sessions/${id}/mark-cash-paid/`,
    {}
  );
  return res.data;
}
