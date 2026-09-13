import { api } from "./client";

import type { RecordPaymentResult } from "./payments";

export interface HouseAccountRow {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  credit_limit: string;
  balance: string;
  available: string | null;
  status: "active" | "suspended" | "closed";
  status_display: string;
  require_signature: boolean;
  authorised_names: string;
  customer_name: string;
  last_payment_at: string | null;
}

const BASE = "/api/v1/dashboard/house-accounts";

export async function listHouseAccounts(q = ""): Promise<HouseAccountRow[]> {
  return (
    await api.get<HouseAccountRow[]>(`${BASE}/`, {
      params: { q: q || undefined },
    })
  ).data;
}

export async function lookupHouseAccount(
  phone: string,
): Promise<HouseAccountRow | null> {
  try {
    return (
      await api.get<HouseAccountRow>(`${BASE}/lookup/`, { params: { phone } })
    ).data;
  } catch (err) {
    if ((err as { response?: { status?: number } }).response?.status === 404)
      return null;
    throw err;
  }
}

export async function chargeHouseAccount(
  accountId: string,
  body: {
    amount: string;
    order_id?: string;
    order_ids?: string[];
    session_id?: string;
    signed_by?: string;
    note?: string;
  },
): Promise<RecordPaymentResult & { account: HouseAccountRow }> {
  return (
    await api.post<RecordPaymentResult & { account: HouseAccountRow }>(
      `${BASE}/${accountId}/charge/`,
      body,
    )
  ).data;
}

export async function settleHouseAccount(
  accountId: string,
  body: {
    amount: string;
    method: "cash" | "card_terminal" | "other";
    tendered?: string;
    note?: string;
  },
): Promise<{
  receipt_number: string;
  account: HouseAccountRow;
  change: string;
}> {
  return (
    await api.post<{
      receipt_number: string;
      account: HouseAccountRow;
      change: string;
    }>(`${BASE}/${accountId}/settle/`, body)
  ).data;
}

export function houseAccountErrorCode(err: unknown): string | null {
  const data = (err as { response?: { data?: { error?: { code?: string } } } })
    .response?.data;
  return data?.error?.code ?? null;
}
