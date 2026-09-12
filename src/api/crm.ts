import { api } from "./client";

export interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  email: string;
  tags: string[];
  notes: string;
  marketing_opt_in: boolean;
  visits: number;
  orders_count: number;
  total_spend: string;
  avg_ticket: string;
  last_visit_at: string | null;
  last_rating: number | null;
  days_since_visit: number | null;
}

/** Who is this phone number? Resolves to null when unknown. */
export async function lookupCustomer(
  phone: string,
): Promise<CustomerRow | null> {
  try {
    const res = await api.get<CustomerRow>(
      "/api/v1/dashboard/crm/customers/lookup/",
      { params: { phone } },
    );
    return res.data;
  } catch {
    return null;
  }
}
