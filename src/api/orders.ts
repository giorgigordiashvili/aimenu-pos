import { api } from './client';

export type OrderStatus =
  | 'pending_payment'
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'completed'
  | 'cancelled';

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
  status?: string;
  preparation_station?: string;
  special_instructions?: string;
  modifiers: OrderItemModifier[];
}

export interface OrderListRow {
  id: string;
  order_number: string;
  order_type?: string;
  status?: OrderStatus | { value: string };
  table_number?: string;
  customer_name?: string;
  total?: string;
  items_count?: string | number;
  created_at: string;
}

export interface Order extends OrderListRow {
  subtotal?: string;
  tax_amount?: string;
  service_charge?: string;
  discount_amount?: string;
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

interface Paginated<T> {
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
  const response = await api.get<Paginated<OrderListRow>>('/api/v1/dashboard/orders/', {
    params: {
      status: params?.status,
      ordering: params?.ordering ?? '-created_at',
      page: params?.page,
      page_size: params?.pageSize ?? 50,
      search: params?.search,
      include_pending_reservations: params?.includePendingReservations ? 'true' : undefined,
    },
  });
  return response.data;
}

export async function listKitchenOrders(params?: {
  ordering?: string;
  page?: number;
  pageSize?: number;
}): Promise<Paginated<OrderListRow>> {
  const response = await api.get<Paginated<OrderListRow>>('/api/v1/dashboard/orders/kitchen/', {
    params: {
      ordering: params?.ordering ?? '-created_at',
      page: params?.page,
      page_size: params?.pageSize ?? 50,
    },
  });
  return response.data;
}

export async function getOrder(id: string): Promise<Order> {
  const response = await api.get<Order>(`/api/v1/dashboard/orders/${id}/`);
  return response.data;
}

export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
  options?: { notes?: string; cancellationReason?: string }
): Promise<Order> {
  const body: Record<string, string> = { status };
  if (options?.notes) body.notes = options.notes;
  if (status === 'cancelled') {
    body.cancellation_reason = options?.cancellationReason ?? 'Cancelled by staff';
  }
  const response = await api.patch<Order>(`/api/v1/dashboard/orders/${id}/status/`, body);
  return response.data;
}

export async function updateOrderItemStatus(
  orderId: string,
  itemId: string,
  status: string
): Promise<unknown> {
  const response = await api.patch(
    `/api/v1/dashboard/orders/${orderId}/items/${itemId}/status/`,
    { status }
  );
  return response.data;
}

export function resolveOrderStatus(raw: OrderListRow['status']): OrderStatus {
  if (typeof raw === 'string') return raw as OrderStatus;
  if (raw && typeof raw === 'object' && 'value' in raw) return raw.value as OrderStatus;
  return 'pending';
}
