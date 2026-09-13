import { api } from "./client";

import type { RecordPaymentResult } from "./payments";

export interface GiftCardLookup {
  id: string | null;
  masked_code: string;
  balance: string;
  currency: string;
  status: string;
  is_usable: boolean;
  expires_at: string | null;
  error_code: string;
}

export interface GiftCardRow {
  id: string;
  code: string;
  masked_code: string;
  initial_value: string;
  balance: string;
  currency: string;
  status: string;
  status_display: string;
  is_usable: boolean;
  kind: "physical" | "digital";
  recipient_name: string;
  recipient_phone: string;
  created_at: string;
}

const BASE = "/api/v1/dashboard/gift-cards";

export async function lookupGiftCard(code: string): Promise<GiftCardLookup> {
  try {
    return (
      await api.get<GiftCardLookup>(`${BASE}/lookup/`, { params: { code } })
    ).data;
  } catch (err) {
    const data = (
      err as { response?: { status?: number; data?: GiftCardLookup } }
    ).response;
    if (data?.status === 404 && data.data) return data.data;
    throw err;
  }
}

export async function redeemGiftCard(body: {
  code: string;
  amount: string;
  order_id?: string;
  order_ids?: string[];
  session_id?: string;
}): Promise<RecordPaymentResult & { card_balance: string }> {
  return (
    await api.post<RecordPaymentResult & { card_balance: string }>(
      `${BASE}/redeem/`,
      body,
    )
  ).data;
}

export async function sellGiftCard(body: {
  amount: string;
  method: "cash" | "card_terminal" | "other";
  tendered?: string;
  kind: "physical" | "digital";
  recipient_name?: string;
  recipient_phone?: string;
  purchaser_name?: string;
  message?: string;
}): Promise<GiftCardRow> {
  return (await api.post<GiftCardRow>(`${BASE}/sell/`, body)).data;
}

export function giftCardErrorCode(err: unknown): string | null {
  const data = (err as { response?: { data?: { error?: { code?: string } } } })
    .response?.data;
  return data?.error?.code ?? null;
}
