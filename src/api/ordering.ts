import { api } from "./client";

export type CourierProvider = "own" | "wolt_drive" | "glovo_odr";
export type DeliveryStatus =
  | "pending"
  | "quoted"
  | "requested"
  | "accepted"
  | "assigned"
  | "picked_up"
  | "delivered"
  | "failed"
  | "cancelled";

export interface OrderingSummary {
  pickup_today: number;
  delivery_today: number;
  in_flight: number;
  failed: number;
  unverified_domains: number;
  paused: boolean;
}

export interface OrderingSettings {
  pickup_enabled: boolean;
  delivery_enabled: boolean;
  asap_enabled: boolean;
  scheduling_enabled: boolean;
  lead_minutes: number;
  delivery_extra_minutes: number;
  slot_interval_minutes: number;
  max_days_ahead: number;
  cutoff_minutes_before_close: number;
  min_order_pickup: string;
  min_order_delivery: string;
  free_delivery_over: string;
  packaging_fee: string;
  courier_provider: CourierProvider;
  auto_request_courier_on: "confirmed" | "ready" | "manual";
  pass_platform_fee_to_guest: boolean;
  paused_until: string | null;
  pause_reason: string;
}

export interface Courier {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  is_active: boolean;
  is_available: boolean;
  staff: string | null;
  staff_user_id: string | null;
}

export interface Delivery {
  id: string;
  order_id: string;
  order_number: string;
  order_status: string;
  provider: CourierProvider;
  provider_display: string;
  status: DeliveryStatus;
  status_display: string;
  courier_id: string | null;
  courier_name: string;
  courier_phone: string;
  external_id: string;
  tracking_url: string;
  quote: Record<string, unknown>;
  cost: string;
  fee_charged: string;
  pickup_eta: string | null;
  dropoff_eta: string | null;
  courier_lat: string | null;
  courier_lng: string | null;
  error: string;
  requested_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  customer_name: string;
  customer_phone: string;
  address: string;
  address_json: Record<string, string>;
  lat: string | null;
  lng: string | null;
  instructions: string;
  scheduled_for: string | null;
  total: string;
  is_paid: boolean;
  events: Array<Record<string, unknown>>;
  created_at: string;
}

/** Courier summary embedded on the order (OrderSerializer.delivery). */
export interface OrderDeliverySummary {
  id: string;
  provider: CourierProvider;
  status: DeliveryStatus;
  courier_name: string;
  courier_phone: string;
  tracking_url: string;
  pickup_eta: string | null;
  dropoff_eta: string | null;
  cost: string;
  error: string;
}

const BASE = "/api/v1/dashboard/ordering";

export async function orderingSummary(): Promise<OrderingSummary> {
  return (await api.get<OrderingSummary>(`${BASE}/summary/`)).data;
}

export async function orderingSettings(): Promise<OrderingSettings> {
  return (await api.get<OrderingSettings>(`${BASE}/settings/`)).data;
}

export async function pauseOnlineOrders(
  minutes: number,
  reason = "",
): Promise<OrderingSettings> {
  return (
    await api.post<OrderingSettings>(`${BASE}/pause/`, { minutes, reason })
  ).data;
}

export async function resumeOnlineOrders(): Promise<OrderingSettings> {
  return (await api.delete<OrderingSettings>(`${BASE}/pause/`)).data;
}

export async function listCouriers(activeOnly = true): Promise<Courier[]> {
  return (
    await api.get<Courier[]>(`${BASE}/couriers/`, {
      params: { active: activeOnly ? "1" : undefined },
    })
  ).data;
}

/** The signed-in user's own courier row; 404 when they are not a courier. */
export async function myCourier(): Promise<Courier | null> {
  try {
    return (await api.get<Courier>(`${BASE}/couriers/me/`)).data;
  } catch (err) {
    const status = (err as { response?: { status?: number } }).response?.status;
    if (status === 404) return null;
    throw err;
  }
}

export async function setMyAvailability(
  isAvailable: boolean,
): Promise<Courier> {
  return (
    await api.patch<Courier>(`${BASE}/couriers/me/`, {
      is_available: isAvailable,
    })
  ).data;
}

export async function listDeliveries(params?: {
  status?: "open" | DeliveryStatus | string;
  mine?: boolean;
}): Promise<Delivery[]> {
  return (
    await api.get<Delivery[]>(`${BASE}/deliveries/`, {
      params: { status: params?.status, mine: params?.mine ? "1" : undefined },
    })
  ).data;
}

export async function orderDelivery(orderId: string): Promise<Delivery | null> {
  try {
    return (await api.get<Delivery>(`${BASE}/orders/${orderId}/delivery/`))
      .data;
  } catch (err) {
    const status = (err as { response?: { status?: number } }).response?.status;
    if (status === 404) return null;
    throw err;
  }
}

export async function requestCourier(
  orderId: string,
  provider?: CourierProvider,
): Promise<Delivery> {
  return (
    await api.post<Delivery>(`${BASE}/orders/${orderId}/delivery/request/`, {
      provider,
    })
  ).data;
}

export async function assignCourier(
  orderId: string,
  courierId: string,
): Promise<Delivery> {
  return (
    await api.post<Delivery>(`${BASE}/orders/${orderId}/delivery/assign/`, {
      courier_id: courierId,
    })
  ).data;
}

export async function updateDelivery(
  orderId: string,
  status: "picked_up" | "delivered" | "failed",
  extra?: { lat?: number; lng?: number; note?: string },
): Promise<Delivery> {
  return (
    await api.post<Delivery>(`${BASE}/orders/${orderId}/delivery/update/`, {
      status,
      ...extra,
    })
  ).data;
}

export async function cancelCourier(
  orderId: string,
  reason = "",
): Promise<Delivery> {
  return (
    await api.post<Delivery>(`${BASE}/orders/${orderId}/delivery/cancel/`, {
      reason,
    })
  ).data;
}

/** Error code from a dispatch 409 ({success:false, error:{code}}). */
export function dispatchErrorCode(err: unknown): string | null {
  const data = (err as { response?: { data?: { error?: { code?: string } } } })
    .response?.data;
  return data?.error?.code ?? null;
}
