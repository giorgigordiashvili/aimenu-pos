import { api } from "./client";

export interface SessionOrdersSummary {
  counts: Record<string, number>;
  total_orders: number;
  non_terminal: number;
  grand_total: string;
  paid_total?: string;
  balance?: string;
  all_terminal: boolean;
  unpaid_count: number;
  unpaid_order_numbers: string[];
  unpaid_total: string;
  all_paid: boolean;
}

export interface SessionBillOrder {
  id: string;
  order_number: string;
  status: string;
  customer_name: string;
  subtotal: string;
  discount_amount: string;
  total: string;
  paid: string;
  balance: string;
  is_paid: boolean;
  items_count: number;
  created_at: string;
}

export interface SessionBill {
  session_id: string;
  table_number: string;
  payment_mode: string;
  orders: SessionBillOrder[];
  grand_total: string;
  paid_total: string;
  balance: string;
  payments: {
    id: string;
    order_number?: string;
    amount: string;
    tip_amount: string;
    total_amount: string;
    change_given: string;
    payment_method: string;
    status: string;
    receipt_number: string;
    completed_at: string | null;
  }[];
}

export interface TableRow {
  id: string;
  number: string;
  name?: string;
  section?: string | null;
  section_name?: string;
  capacity?: number;
  status?: string;
  is_active?: boolean;
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

export async function listActiveTableSessions(): Promise<
  Paginated<TableSessionRow>
> {
  const res = await api.get<Paginated<TableSessionRow>>(
    "/api/v1/dashboard/tables/sessions/",
    {
      params: { status: "active", page_size: 100 },
    },
  );
  return res.data;
}

export async function closeTableSession(
  id: string,
  force = false,
): Promise<void> {
  await api.post(
    `/api/v1/dashboard/tables/sessions/${id}/close/`,
    force ? { force: true } : {},
  );
}

export interface MarkCashPaidResponse {
  transaction_id: string;
  payment_id: string;
  receipt_number: string;
  amount: string;
  change: string;
  covered_order_numbers: string[];
}

/**
 * Record one cash payment covering every unpaid order on the session
 * (a ledger Payment allocated across them). Kept for the simple
 * "paid in cash" path; PaymentSheet uses /dashboard/payments/record/.
 */
export async function markTableSessionCashPaid(
  id: string,
  tendered?: string,
): Promise<MarkCashPaidResponse> {
  const res = await api.post<MarkCashPaidResponse>(
    `/api/v1/dashboard/tables/sessions/${id}/mark-cash-paid/`,
    tendered ? { tendered } : {},
  );
  return res.data;
}

export async function getSessionBill(id: string): Promise<SessionBill> {
  const res = await api.get<SessionBill>(
    `/api/v1/dashboard/tables/sessions/${id}/bill/`,
  );
  return res.data;
}

export async function listTables(): Promise<TableRow[]> {
  const res = await api.get<Paginated<TableRow> | TableRow[]>(
    "/api/v1/dashboard/tables/",
    { params: { page_size: 200 } },
  );
  const data = res.data as Paginated<TableRow> | TableRow[];
  return Array.isArray(data) ? data : (data.results ?? []);
}
