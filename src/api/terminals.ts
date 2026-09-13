import { api } from "./client";

export type TerminalProvider =
  | "manual"
  | "bog_link"
  | "tbc_tpay"
  | "ecr_bridge";
export type TerminalTxStatus =
  | "pending"
  | "sent"
  | "awaiting_confirm"
  | "approved"
  | "declined"
  | "cancelled"
  | "timeout"
  | "failed";

export interface Terminal {
  id: string;
  name: string;
  provider: TerminalProvider;
  provider_display: string;
  ecr_protocol: string;
  terminal_id: string;
  is_active: boolean;
  is_default: boolean;
  is_online: boolean;
  is_link: boolean;
  auto_receipt: boolean;
  timeout_seconds: number;
  configured: boolean;
  last_seen_at: string | null;
  last_error: string;
}

export interface TerminalTransaction {
  id: string;
  terminal: string;
  terminal_name: string;
  provider: TerminalProvider;
  kind: "sale" | "refund";
  amount: string;
  tip: string;
  total: string;
  currency: string;
  status: TerminalTxStatus;
  status_display: string;
  is_open: boolean;
  order: string | null;
  order_number: string;
  session: string | null;
  order_ids: string[];
  payment_id: string | null;
  receipt_number: string;
  external_id: string;
  auth_code: string;
  card_mask: string;
  rrn: string;
  pay_url: string;
  error: string;
  sent_to: string;
  expires_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface TerminalsSummary {
  awaiting: number;
  declined_today: number;
  offline_bridges: number;
  terminals: number;
}

const BASE = "/api/v1/dashboard/terminals";

export async function listTerminals(): Promise<Terminal[]> {
  return (await api.get<Terminal[]>(`${BASE}/terminals/`)).data;
}

export async function terminalsSummary(): Promise<TerminalsSummary> {
  return (await api.get<TerminalsSummary>(`${BASE}/summary/`)).data;
}

export async function startTerminalSale(body: {
  terminal_id: string;
  amount: string;
  tip_amount?: string;
  order_id?: string;
  order_ids?: string[];
  session_id?: string;
  send_to?: string;
}): Promise<TerminalTransaction> {
  return (await api.post<TerminalTransaction>(`${BASE}/transactions/`, body))
    .data;
}

export async function getTerminalTransaction(
  id: string,
): Promise<TerminalTransaction> {
  return (await api.get<TerminalTransaction>(`${BASE}/transactions/${id}/`))
    .data;
}

export async function confirmTerminalTransaction(
  id: string,
  extra?: { auth_code?: string; card_mask?: string },
): Promise<TerminalTransaction> {
  return (
    await api.post<TerminalTransaction>(
      `${BASE}/transactions/${id}/confirm/`,
      extra ?? {},
    )
  ).data;
}

export async function declineTerminalTransaction(
  id: string,
  reason = "",
): Promise<TerminalTransaction> {
  return (
    await api.post<TerminalTransaction>(`${BASE}/transactions/${id}/decline/`, {
      reason,
    })
  ).data;
}

export async function cancelTerminalTransaction(
  id: string,
): Promise<TerminalTransaction> {
  return (
    await api.post<TerminalTransaction>(`${BASE}/transactions/${id}/cancel/`)
  ).data;
}

export async function sendTerminalLink(
  id: string,
  to: string,
): Promise<TerminalTransaction> {
  return (
    await api.post<TerminalTransaction>(
      `${BASE}/transactions/${id}/send-link/`,
      { to },
    )
  ).data;
}

export async function listTerminalTransactions(params?: {
  status?: string;
  order?: string;
  session?: string;
}): Promise<TerminalTransaction[]> {
  return (
    await api.get<TerminalTransaction[]>(`${BASE}/transactions/`, { params })
  ).data;
}

export function terminalErrorCode(err: unknown): string | null {
  const data = (err as { response?: { data?: { error?: { code?: string } } } })
    .response?.data;
  return data?.error?.code ?? null;
}
