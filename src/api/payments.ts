import { api } from "./client";

/** Ways staff can take money at the till. Online methods arrive via webhooks. */
export type StaffPaymentMethod = "cash" | "card_terminal" | "voucher" | "other";
export type PaymentMethod =
  | StaffPaymentMethod
  | "online_bog"
  | "online_flitt"
  | "online_tbc"
  | "card"
  | "mobile";

export interface PaymentAllocation {
  order: string;
  order_number: string;
  amount: string;
}

export interface PaymentRow {
  id: string;
  order: string | null;
  order_number?: string;
  session: string | null;
  shift: string | null;
  amount: string;
  tip_amount: string;
  total_amount: string;
  tendered?: string | null;
  change_given: string;
  payment_method: PaymentMethod;
  status: string;
  currency?: string;
  receipt_number: string;
  processed_by_name?: string;
  refunded_amount?: string;
  allocations?: PaymentAllocation[];
  notes?: string;
  completed_at: string | null;
  created_at: string;
}

export interface MethodTotals {
  count: number;
  amount: string;
  tips: string;
  total: string;
}

export interface ShiftReport {
  shift_number: number;
  opened_at: string;
  opened_by: string;
  until: string;
  opening_float: string;
  sales: string;
  tips: string;
  refunds: string;
  net_sales: string;
  payments_count: number;
  orders_count: number;
  by_method: Record<string, MethodTotals>;
  refunds_by_method: Record<string, { count: number; amount: string }>;
  paid_in: string;
  paid_out: string;
  movements: {
    kind: string;
    amount: string;
    reason: string;
    by: string;
    at: string;
  }[];
  cash_sales: string;
  cash_tips: string;
  cash_refunds: string;
  expected_cash: string;
  discounts: {
    orders_count: number;
    orders_amount: string;
    items_count: number;
    items_amount: string;
  };
  comps: { count: number; amount: string };
  voids: {
    count: number;
    amount: string;
    after_kitchen_count: number;
    after_kitchen_amount: string;
  };
  counted_cash?: string;
  difference?: string;
  closed_at?: string;
  closed_by?: string;
}

export interface CashShift {
  id: string;
  number: number;
  register: string;
  status: "open" | "closed";
  opened_by: string | null;
  opened_by_name: string;
  opened_at: string;
  closed_by: string | null;
  closed_by_name: string;
  closed_at: string | null;
  opening_float: string;
  counted_cash: string | null;
  expected_cash: string | null;
  difference: string | null;
  report: Partial<ShiftReport>;
  notes: string;
}

export interface CashMovement {
  id: string;
  kind: "paid_in" | "paid_out";
  amount: string;
  reason: string;
  created_by_name: string;
  created_at: string;
}

export interface ReasonOption {
  id: string | null;
  label: string;
  kind: "discount" | "comp" | "void" | "refund";
  requires_manager: boolean;
}

export interface RecordPaymentBody {
  method: StaffPaymentMethod;
  amount: string;
  tip_amount?: string;
  tendered?: string | null;
  order_id?: string;
  order_ids?: string[];
  session_id?: string;
  notes?: string;
}

export interface RecordPaymentResult {
  payment: PaymentRow;
  change: string;
  receipt_number: string;
  balance: string;
  paid_order_numbers: string[];
}

interface Paginated<T> {
  count: number;
  results: T[];
}

const BASE = "/api/v1/dashboard/payments";

/** The stable error code the ledger puts in `error.code` (409s), or null. */
export function ledgerErrorCode(err: unknown): string | null {
  const data = (err as { response?: { data?: { error?: { code?: string } } } })
    ?.response?.data;
  return data?.error?.code ?? null;
}

export function ledgerErrorMessage(err: unknown): string | null {
  const data = (
    err as { response?: { data?: { error?: { message?: string } } } }
  )?.response?.data;
  return data?.error?.message ?? null;
}

// ── shifts ──────────────────────────────────────────────────────────────────

export async function getCurrentShift(): Promise<CashShift | null> {
  const res = await api.get<CashShift | null>(`${BASE}/shifts/current/`);
  return res.data ?? null;
}

export async function openShift(body: {
  opening_float: string;
  register?: string;
  notes?: string;
}): Promise<CashShift> {
  const res = await api.post<CashShift>(`${BASE}/shifts/open/`, body);
  return res.data;
}

export async function closeShift(
  id: string,
  body: { counted_cash: string; notes?: string },
): Promise<CashShift> {
  const res = await api.post<CashShift>(`${BASE}/shifts/${id}/close/`, body);
  return res.data;
}

export async function getXReport(): Promise<{
  shift: CashShift;
  report: ShiftReport;
}> {
  const res = await api.get<{ shift: CashShift; report: ShiftReport }>(
    `${BASE}/shifts/current/x-report/`,
  );
  return res.data;
}

export async function listShifts(params?: {
  status?: "open" | "closed";
}): Promise<Paginated<CashShift>> {
  const res = await api.get<Paginated<CashShift>>(`${BASE}/shifts/`, {
    params: { status: params?.status, page_size: 100 },
  });
  return res.data;
}

export async function getShift(id: string): Promise<CashShift> {
  const res = await api.get<CashShift>(`${BASE}/shifts/${id}/`);
  return res.data;
}

export async function listMovements(shiftId: string): Promise<CashMovement[]> {
  const res = await api.get<CashMovement[]>(
    `${BASE}/shifts/${shiftId}/movements/`,
  );
  return Array.isArray(res.data) ? res.data : [];
}

export async function addMovement(
  shiftId: string,
  body: { kind: "paid_in" | "paid_out"; amount: string; reason: string },
): Promise<CashMovement> {
  const res = await api.post<CashMovement>(
    `${BASE}/shifts/${shiftId}/movements/`,
    body,
  );
  return res.data;
}

// ── payments ────────────────────────────────────────────────────────────────

export async function recordPayment(
  body: RecordPaymentBody,
): Promise<RecordPaymentResult> {
  const res = await api.post<RecordPaymentResult>(`${BASE}/record/`, body);
  return res.data;
}

/** Shares that add up exactly (remainder cents on the first shares). */
export function splitEvenly(total: number, ways: number): number[] {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / ways);
  const extra = cents - base * ways;
  return Array.from(
    { length: ways },
    (_, i) => (base + (i < extra ? 1 : 0)) / 100,
  );
}

export async function refundPayment(
  id: string,
  body: {
    amount: string;
    method?: string;
    reason?: string;
    reason_id?: string | null;
    reason_details?: string;
    order_id?: string | null;
  },
): Promise<unknown> {
  const res = await api.post(`${BASE}/${id}/refund/`, body);
  return res.data;
}

export async function listReasons(
  kind: ReasonOption["kind"],
): Promise<ReasonOption[]> {
  const res = await api.get<ReasonOption[]>(`${BASE}/reasons/`, {
    params: { kind },
  });
  return Array.isArray(res.data) ? res.data : [];
}

export async function listPayments(params?: {
  shift?: string;
  session?: string;
  order?: string;
}): Promise<Paginated<PaymentRow>> {
  const res = await api.get<Paginated<PaymentRow>>(`${BASE}/`, {
    params: { ...params, page_size: 100 },
  });
  return res.data;
}
