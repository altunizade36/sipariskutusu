/**
 * orderService.ts
 * Sipariş oluşturma, listeleme, durum güncelleme.
 */

import { getSupabaseClient } from './supabase';
import { trackOrderPlaced } from './monitoring';
import { dispatchNotification } from './notificationService';
import { backendRequest, isBackendApiConfigured, isBackendStrictMode } from './backendApiClient';

export type OrderStatus =
  | 'pending' | 'confirmed' | 'preparing' | 'shipped'
  | 'delivered' | 'completed' | 'cancelled' | 'refunded';

export interface OrderItem {
  listing_id: string;
  title: string;
  price: number;
  quantity: number;
  image_url?: string;
  variant?: string;
}

export interface CreateOrderInput {
  seller_id: string;
  store_id?: string;
  items: OrderItem[];
  shipping_fee?: number;
  shipping_name: string;
  shipping_phone: string;
  shipping_addr: string;
  shipping_city: string;
  note?: string;
}

export interface Order {
  id: string;
  buyer_id: string;
  seller_id: string;
  store_id?: string | null;
  status: OrderStatus;
  subtotal: number;
  shipping_fee: number;
  total: number;
  currency: string;
  shipping_name?: string;
  shipping_phone?: string;
  shipping_addr?: string;
  shipping_city?: string;
  note?: string;
  tracking_number?: string;
  paid_at?: string;
  shipped_at?: string;
  delivered_at?: string;
  created_at: string;
  order_items?: OrderItem[];
}

const allowedOrderStatusTransitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: ['completed', 'refunded'],
  completed: [],
  cancelled: [],
  refunded: [],
};

const orderStatusCopy: Record<OrderStatus, { title: string; body: string }> = {
  pending: { title: 'Sipariş alındı', body: 'Siparişiniz alındı ve onay bekliyor.' },
  confirmed: { title: 'Sipariş onaylandı', body: 'Siparişiniz satıcı tarafından onaylandı.' },
  preparing: { title: 'Sipariş hazırlanıyor', body: 'Siparişiniz hazırlanma aşamasına geçti.' },
  shipped: { title: 'Sipariş kargoya verildi', body: 'Siparişiniz kargoya verildi.' },
  delivered: { title: 'Sipariş teslim edildi', body: 'Siparişiniz teslim edildi olarak işaretlendi.' },
  completed: { title: 'Sipariş tamamlandı', body: 'Sipariş süreci tamamlandı.' },
  cancelled: { title: 'Sipariş iptal edildi', body: 'Siparişiniz iptal edildi.' },
  refunded: { title: 'Sipariş iade edildi', body: 'Siparişiniz için iade işlemi yapıldı.' },
};

function notifyOrderStatusChange(
  orderId: string,
  status: OrderStatus,
  buyerId: string,
  sellerId: string,
  actorId?: string,
) {
  const recipients = [buyerId, sellerId].filter((id) => Boolean(id) && id !== actorId);
  if (recipients.length === 0) {
    return;
  }

  const copy = orderStatusCopy[status];
  dispatchNotification({
    channels: ['push'],
    userIds: recipients,
    push: {
      title: copy.title,
      body: copy.body,
      data: {
        kind: 'order_status_changed',
        orderId,
        status,
      },
    },
  }).catch(() => {
    // Keep status update flow stable even if notification dispatch fails.
  });
}

function assertOrderPayload(payload: unknown): Order {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Siparis cevabi gecersiz formatta.');
  }

  const parsed = payload as Partial<Order>;
  if (!parsed.id || typeof parsed.id !== 'string') {
    throw new Error('Siparis cevabinda id zorunlu.');
  }

  if (!parsed.status || typeof parsed.status !== 'string') {
    throw new Error('Siparis cevabinda status zorunlu.');
  }

  if (typeof parsed.total !== 'number' || !Number.isFinite(parsed.total)) {
    throw new Error('Siparis cevabinda total gecersiz.');
  }

  if (!parsed.created_at || typeof parsed.created_at !== 'string') {
    throw new Error('Siparis cevabinda created_at zorunlu.');
  }

  return parsed as Order;
}

function assertOrderArrayPayload(payload: unknown): Order[] {
  if (!Array.isArray(payload)) {
    throw new Error('Siparis listesi dizi olmalidir.');
  }

  return payload.map((item) => assertOrderPayload(item));
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  if (!input.items.length) {
    throw new Error('Siparis olusturmak icin en az bir urun secilmelidir.');
  }

  const hasInvalidItem = input.items.some(
    (item) =>
      !item.listing_id ||
      item.quantity <= 0 ||
      !Number.isFinite(item.quantity) ||
      item.price <= 0 ||
      !Number.isFinite(item.price),
  );

  if (hasInvalidItem) {
    throw new Error('Siparis kalemleri gecersiz. Miktar ve fiyat pozitif olmalidir.');
  }

  if (isBackendApiConfigured) {
    try {
      const order = await backendRequest<Order>('/v1/orders', {
        method: 'POST',
        body: input,
        idempotencyKey: `order-create:${input.store_id ?? 'nostore'}:${input.seller_id}:${input.items
          .map((item) => `${item.listing_id}:${item.quantity}`)
          .join('|')}`,
        responseValidator: assertOrderPayload,
      });

      trackOrderPlaced(order.id, Number(order.total ?? 0));
      return order;
    } catch (error) {
      if (isBackendStrictMode) {
        throw error;
      }
    }
  }

  const supabase = getSupabaseClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('Giriş yapmanız gerekiyor.');

  const subtotal = input.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const shipping_fee = input.shipping_fee ?? 0;

  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      buyer_id: user.id,
      seller_id: input.seller_id,
      store_id: input.store_id ?? null,
      subtotal,
      shipping_fee,
      total: subtotal + shipping_fee,
      shipping_name: input.shipping_name,
      shipping_phone: input.shipping_phone,
      shipping_addr: input.shipping_addr,
      shipping_city: input.shipping_city,
      note: input.note ?? null,
    })
    .select()
    .single();

  if (error) throw error;

  const { error: itemsError } = await supabase.from('order_items').insert(
    input.items.map((item) => ({
      order_id: order.id,
      listing_id: item.listing_id,
      title: item.title,
      price: item.price,
      quantity: item.quantity,
      image_url: item.image_url ?? null,
      variant: item.variant ?? null,
    })),
  );

  if (itemsError) {
    await supabase.from('orders').delete().eq('id', order.id);
    throw new Error('Siparis kalemleri kaydedilemedi. Siparis geri alindi.');
  }

  trackOrderPlaced(order.id, Number(order.total ?? subtotal + shipping_fee));

  dispatchNotification({
    channels: ['push'],
    userIds: [user.id, input.seller_id],
    push: {
      title: 'Yeni sipariş güncellemesi',
      body: `#${order.id} numaralı sipariş oluşturuldu.`,
      data: {
        orderId: order.id,
        kind: 'order_placed',
      },
    },
  }).catch(() => {
    // Keep order success path stable even if notification service is unavailable.
  });

  return order as Order;
}

export async function fetchMyOrders(): Promise<Order[]> {
  if (isBackendApiConfigured) {
    try {
      return await backendRequest<Order[]>('/v1/orders/me', {
        method: 'GET',
        responseValidator: assertOrderArrayPayload,
      });
    } catch (error) {
      if (isBackendStrictMode) {
        throw error;
      }
    }
  }

  const supabase = getSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('buyer_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Order[];
}

export async function fetchMySalesOrders(): Promise<Order[]> {
  if (isBackendApiConfigured) {
    try {
      return await backendRequest<Order[]>('/v1/orders/sales', {
        method: 'GET',
        responseValidator: assertOrderArrayPayload,
      });
    } catch (error) {
      if (isBackendStrictMode) {
        throw error;
      }
    }
  }

  const supabase = getSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Order[];
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  trackingNumber?: string,
): Promise<void> {
  if (isBackendApiConfigured) {
    try {
      await backendRequest<void>(`/v1/orders/${orderId}/status`, {
        method: 'PATCH',
        body: {
          status,
          trackingNumber,
        },
        idempotencyKey: `order-status:${orderId}:${status}:${trackingNumber ?? 'none'}`,
      });

      return;
    } catch (error) {
      if (isBackendStrictMode) {
        throw error;
      }
    }
  }

  const supabase = getSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: existingOrder, error: orderFetchError } = await supabase
    .from('orders')
    .select('status, buyer_id, seller_id')
    .eq('id', orderId)
    .single();

  if (orderFetchError) {
    throw orderFetchError;
  }

  const currentStatus = (existingOrder?.status ?? null) as OrderStatus | null;
  if (!currentStatus) {
    throw new Error('Siparis durumu tespit edilemedi.');
  }

  const allowedTargets = allowedOrderStatusTransitions[currentStatus] ?? [];
  if (currentStatus !== status && !allowedTargets.includes(status)) {
    throw new Error(`Gecersiz siparis durum gecisi: ${currentStatus} -> ${status}`);
  }

  const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (trackingNumber) updates.tracking_number = trackingNumber;
  if (status === 'shipped') updates.shipped_at = new Date().toISOString();
  if (status === 'delivered') updates.delivered_at = new Date().toISOString();

  const { error } = await supabase.from('orders').update(updates).eq('id', orderId);
  if (error) throw error;

  if (currentStatus !== status) {
    notifyOrderStatusChange(
      orderId,
      status,
      existingOrder.buyer_id,
      existingOrder.seller_id,
      user?.id,
    );
  }
}
