import { api } from "./client";

export type OrderStatus =
  | "pending_payment"
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "served"
  | "completed"
  | "cancelled";

export interface OrderItemModifier {
  id: string;
  modifier_name: string;
  price_adjustment?: string;
}

export interface OrderItem {
  id: string;
  menu_item?: string;
  item_name: string;
  item_description?: string;
  unit_price: string;
  quantity?: number;
  total_price: string;
  /** Item-level discount (a comp discounts the whole line). */
  discount_amount?: string;
  net_price?: string;
  is_comped?: boolean;
  discount_reason_label?: string;
  status?: string;
  voided_at?: string | null;
  void_reason_label?: string;
  was_sent_to_kitchen?: boolean;
  preparation_station?: string;
  special_instructions?: string;
  modifiers: OrderItemModifier[];
}

export interface OrderDiscount {
  id: string;
  kind: "manual" | "loyalty_tier" | "promo";
  mode: "percent" | "fixed";
  value: string;
  amount: string;
  label: string;
  created_at: string;
}

export interface OrderPaymentBrief {
  id: string;
  payment_method: string;
  amount: string;
  tip_amount: string;
  receipt_number: string;
  status: string;
  completed_at: string | null;
}

export interface OrderListRow {
  id: string;
  order_number: string;
  order_type?: string;
  status?: OrderStatus | { value: string };
  source?: OrderSource;
  table?: string | null;
  table_number?: string;
  table_session?: string | null;
  customer_name?: string;
  subtotal?: string;
  discount_amount?: string;
  total?: string;
  items_count?: string | number;
  created_at: string;
}

export interface Order extends OrderListRow {
  subtotal?: string;
  tax_amount?: string;
  service_charge?: string;
  tip_amount?: string;
  server?: string | null;
  discount_amount?: string;
  discounts?: OrderDiscount[];
  wallet_applied?: string;
  paid_amount?: string;
  balance?: string;
  is_paid?: boolean;
  payments?: OrderPaymentBrief[];
  customer_phone?: string;
  customer_email?: string;
  customer_notes?: string;
  delivery_address?: string;
  estimated_ready_at?: string;
  confirmed_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  items: OrderItem[];
  updated_at?: string;
}

export type PreparationStation = "kitchen" | "bar" | "both";

/** One ticket on the kitchen screen (GET /dashboard/orders/kitchen/). */
export type OrderSource = "web" | "qr" | "pos" | "glovo" | "wolt" | "bolt_food";
export const PLATFORM_SOURCES: OrderSource[] = ["glovo", "wolt", "bolt_food"];

export interface KitchenOrderRow {
  id: string;
  order_number: string;
  order_type?: string;
  status: OrderStatus | { value: string };
  source?: OrderSource;
  external_id?: string;
  platform_order_code?: string;
  pickup_eta?: string | null;
  table_number?: string | null;
  customer_name?: string;
  customer_notes?: string;
  items: OrderItem[];
  elapsed_minutes: number;
  confirmed_at?: string | null;
  estimated_ready_at?: string | null;
  created_at: string;
}

export interface Paginated<T> {
  count: number;
  next?: string | null;
  previous?: string | null;
  results: T[];
}

export async function listOrders(params?: {
  status?: OrderStatus;
  ordering?: string;
  page?: number;
  pageSize?: number;
  search?: string;
  includePendingReservations?: boolean;
}): Promise<Paginated<OrderListRow>> {
  const response = await api.get<Paginated<OrderListRow>>(
    "/api/v1/dashboard/orders/",
    {
      params: {
        status: params?.status,
        ordering: params?.ordering ?? "-created_at",
        page: params?.page,
        page_size: params?.pageSize ?? 50,
        search: params?.search,
        include_pending_reservations: params?.includePendingReservations
          ? "true"
          : undefined,
      },
    },
  );
  return response.data;
}

export async function listKitchenOrders(params?: {
  pageSize?: number;
  statuses?: OrderStatus[];
}): Promise<Paginated<KitchenOrderRow>> {
  const response = await api.get<Paginated<KitchenOrderRow>>(
    "/api/v1/dashboard/orders/kitchen/",
    {
      params: {
        page_size: params?.pageSize ?? 100,
        status: params?.statuses?.join(",") || undefined,
      },
    },
  );
  return response.data;
}

export async function getOrder(id: string): Promise<Order> {
  const response = await api.get<Order>(`/api/v1/dashboard/orders/${id}/`);
  return response.data;
}

export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
  options?: { notes?: string; cancellationReason?: string },
): Promise<Order> {
  const body: Record<string, string> = { status };
  if (options?.notes) body.notes = options.notes;
  if (status === "cancelled") {
    body.cancellation_reason =
      options?.cancellationReason ?? "Cancelled by staff";
  }
  const response = await api.patch<Order>(
    `/api/v1/dashboard/orders/${id}/status/`,
    body,
  );
  return response.data;
}

export async function updateOrderItemStatus(
  orderId: string,
  itemId: string,
  status: string,
  reason?: ReasonInput,
): Promise<unknown> {
  const response = await api.patch(
    `/api/v1/dashboard/orders/${orderId}/items/${itemId}/status/`,
    { status, ...(reason ?? {}) },
  );
  return response.data;
}

// ── money: discounts / comps / voids / split / move ─────────────────────────

export interface ReasonInput {
  reason_id?: string | null;
  reason_text?: string;
}

export async function applyOrderDiscount(
  orderId: string,
  body: { mode: "percent" | "fixed"; value: string } & ReasonInput,
): Promise<Order> {
  const response = await api.post<Order>(
    `/api/v1/dashboard/orders/${orderId}/discount/`,
    body,
  );
  return response.data;
}

/** Promo code on an open order (Promotions module). */
export async function applyPromoCode(
  orderId: string,
  code: string,
): Promise<Order> {
  const response = await api.post<Order>(
    `/api/v1/dashboard/promotions/orders/${orderId}/promo-code/`,
    { code },
  );
  return response.data;
}

export async function removePromoCode(orderId: string): Promise<Order> {
  const response = await api.delete<Order>(
    `/api/v1/dashboard/promotions/orders/${orderId}/promo-code/`,
  );
  return response.data;
}

export async function removeOrderDiscount(
  orderId: string,
  discountId?: string,
): Promise<Order> {
  const response = await api.delete<Order>(
    `/api/v1/dashboard/orders/${orderId}/discount/`,
    { data: discountId ? { discount_id: discountId } : {} },
  );
  return response.data;
}

export async function discountOrderItem(
  orderId: string,
  itemId: string,
  body: { mode: "percent" | "fixed"; value: string } & ReasonInput,
): Promise<Order> {
  const response = await api.post<Order>(
    `/api/v1/dashboard/orders/${orderId}/items/${itemId}/discount/`,
    body,
  );
  return response.data;
}

export async function clearOrderItemDiscount(
  orderId: string,
  itemId: string,
): Promise<Order> {
  const response = await api.delete<Order>(
    `/api/v1/dashboard/orders/${orderId}/items/${itemId}/discount/`,
  );
  return response.data;
}

export async function compOrderItem(
  orderId: string,
  itemId: string,
  reason: ReasonInput,
): Promise<Order> {
  const response = await api.post<Order>(
    `/api/v1/dashboard/orders/${orderId}/items/${itemId}/comp/`,
    reason,
  );
  return response.data;
}

export async function voidOrderItem(
  orderId: string,
  itemId: string,
  reason: ReasonInput,
): Promise<Order> {
  const response = await api.post<Order>(
    `/api/v1/dashboard/orders/${orderId}/items/${itemId}/void/`,
    reason,
  );
  return response.data;
}

export async function splitOrder(
  orderId: string,
  body: { item_ids: string[]; table_id?: string; session_id?: string },
): Promise<{ order: Order; new_order: Order }> {
  const response = await api.post<{ order: Order; new_order: Order }>(
    `/api/v1/dashboard/orders/${orderId}/split/`,
    body,
  );
  return response.data;
}

export async function moveOrder(
  orderId: string,
  tableId: string,
): Promise<Order> {
  const response = await api.post<Order>(
    `/api/v1/dashboard/orders/${orderId}/move/`,
    { table_id: tableId },
  );
  return response.data;
}

/** Stable `error.code` from an order-money endpoint (409/400), or null. */
export function orderErrorCode(err: unknown): string | null {
  const data = (err as { response?: { data?: { error?: { code?: string } } } })
    ?.response?.data;
  return data?.error?.code ?? null;
}

export function resolveOrderStatus(raw: OrderListRow["status"]): OrderStatus {
  if (typeof raw === "string") return raw as OrderStatus;
  if (raw && typeof raw === "object" && "value" in raw)
    return raw.value as OrderStatus;
  return "pending";
}
