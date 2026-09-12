import { api } from "./client";

/** The receipt-as-data contract from /dashboard/fiscal/payments/<id>/receipt/ (fiscal fields included). */
export interface FiscalReceipt {
  kind: string;
  fiscal: boolean;
  number: string;
  status:
    | "confirmed"
    | "queued"
    | "sent"
    | "failed"
    | "draft"
    | "cancelled"
    | "none";
  restaurant: {
    name: string;
    legal_name?: string;
    address?: string;
    phone?: string;
    tax_id_line?: string;
    vat_payer?: boolean;
  };
  vat_breakdown: { rate: string; net: string; vat: string; gross: string }[];
  labels?: { vat_note?: string };
  footer?: string;
}

export async function getPaymentReceipt(
  paymentId: string,
): Promise<FiscalReceipt | null> {
  try {
    const res = await api.get<FiscalReceipt>(
      `/api/v1/dashboard/fiscal/payments/${paymentId}/receipt/`,
    );
    return res.data ?? null;
  } catch {
    return null;
  }
}
