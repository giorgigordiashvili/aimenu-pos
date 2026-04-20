import { api } from './client';

export interface LoyaltyValidateResponse {
  id: string;
  code: string;
  status: string;
  expires_at: string;
  issued_at: string;
  redeemed_at: string | null;
  customer_name: string;
  program: {
    id: string;
    name: string;
    threshold: number;
    reward_quantity: number;
    trigger_item_detail?: { id: string; name: string };
    reward_item_detail?: { id: string; name: string };
  };
}

export async function validateLoyaltyCode(code: string): Promise<LoyaltyValidateResponse> {
  const response = await api.post<LoyaltyValidateResponse>(
    '/api/v1/dashboard/loyalty/redeem/validate/',
    { code }
  );
  return response.data;
}

export async function confirmLoyaltyCode(
  code: string,
  orderId?: string
): Promise<LoyaltyValidateResponse> {
  const response = await api.post<LoyaltyValidateResponse>(
    '/api/v1/dashboard/loyalty/redeem/confirm/',
    { code, order_id: orderId },
  );
  return response.data;
}
