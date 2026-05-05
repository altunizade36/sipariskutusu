import { getSupabaseClient } from './supabase';

export type InventoryItem = {
  id: string;
  title: string;
  price: number;
  cover_url: string | null;
  category_label: string | null;
  stock: number;
  low_stock_threshold: number;
  stock_tracking_enabled: boolean;
  is_sold_out: boolean;
  is_visible: boolean;
  last_stock_update_at: string | null;
  status: string | null;
};

export type StockStatus = 'in_stock' | 'low_stock' | 'sold_out' | 'untracked';

export type InventoryStats = {
  total: number;
  inStock: number;
  lowStock: number;
  soldOut: number;
  untracked: number;
  updatedToday: number;
};

export type StockUpdateInput = {
  stock?: number;
  low_stock_threshold?: number;
  stock_tracking_enabled?: boolean;
  is_visible?: boolean;
};

export function classifyStock(item: Pick<InventoryItem, 'stock' | 'low_stock_threshold' | 'stock_tracking_enabled' | 'is_sold_out'>): StockStatus {
  if (!item.stock_tracking_enabled) return 'untracked';
  if (item.is_sold_out || item.stock <= 0) return 'sold_out';
  if (item.stock <= Math.max(0, item.low_stock_threshold)) return 'low_stock';
  return 'in_stock';
}

function pickCover(rawImages: unknown): string | null {
  if (!Array.isArray(rawImages) || rawImages.length === 0) return null;
  const sorted = [...rawImages].sort((a: any, b: any) => {
    if (a?.is_cover && !b?.is_cover) return -1;
    if (!a?.is_cover && b?.is_cover) return 1;
    return (a?.sort_order ?? 0) - (b?.sort_order ?? 0);
  });
  const first = sorted[0] as { url?: string } | undefined;
  return first?.url ?? null;
}

/** Bir satıcının kendi envanterini getirir. */
export async function fetchMyInventory(userId: string): Promise<InventoryItem[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('listings')
    .select(
      'id, title, price, stock, low_stock_threshold, stock_tracking_enabled, is_sold_out, is_visible, last_stock_update_at, status, category_id, listing_images(url, is_cover, sort_order)'
    )
    .or(`seller_id.eq.${userId},owner_id.eq.${userId}`)
    .neq('status', 'deleted')
    .order('updated_at', { ascending: false })
    .limit(500);

  if (error) {
    // Kolon henüz migrate edilmediyse — minimal fallback
    if ((error as { code?: string }).code === '42703') {
      const { data: fallback, error: fallbackError } = await supabase
        .from('listings')
        .select('id, title, price, stock, status, category_id, listing_images(url, is_cover, sort_order)')
        .eq('seller_id', userId)
        .neq('status', 'deleted')
        .order('updated_at', { ascending: false })
        .limit(500);
      if (fallbackError) {
        throw new Error(`Envanter yüklenemedi: ${fallbackError.message}`);
      }
      return (fallback ?? []).map((row: any) => ({
        id: row.id,
        title: row.title,
        price: Number(row.price ?? 0),
        cover_url: pickCover(row.listing_images),
        category_label: row.category_id ?? null,
        stock: Number(row.stock ?? 0),
        low_stock_threshold: 3,
        stock_tracking_enabled: false,
        is_sold_out: false,
        is_visible: true,
        last_stock_update_at: null,
        status: row.status ?? null,
      }));
    }
    throw new Error(`Envanter yüklenemedi: ${error.message}`);
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    title: row.title,
    price: Number(row.price ?? 0),
    cover_url: pickCover(row.listing_images),
    category_label: row.category_id ?? null,
    stock: Number(row.stock ?? 0),
    low_stock_threshold: Number(row.low_stock_threshold ?? 3),
    stock_tracking_enabled: Boolean(row.stock_tracking_enabled),
    is_sold_out: Boolean(row.is_sold_out),
    is_visible: row.is_visible !== false,
    last_stock_update_at: row.last_stock_update_at ?? null,
    status: row.status ?? null,
  }));
}

export function computeInventoryStats(items: InventoryItem[]): InventoryStats {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  return items.reduce<InventoryStats>(
    (acc, item) => {
      acc.total += 1;
      const status = classifyStock(item);
      if (status === 'in_stock') acc.inStock += 1;
      else if (status === 'low_stock') acc.lowStock += 1;
      else if (status === 'sold_out') acc.soldOut += 1;
      else acc.untracked += 1;
      if (item.last_stock_update_at && new Date(item.last_stock_update_at).getTime() >= todayMs) {
        acc.updatedToday += 1;
      }
      return acc;
    },
    { total: 0, inStock: 0, lowStock: 0, soldOut: 0, untracked: 0, updatedToday: 0 }
  );
}

/** Satıcının kendi ürününün stok bilgisini günceller. */
export async function updateListingStock(
  userId: string,
  listingId: string,
  input: StockUpdateInput
): Promise<InventoryItem> {
  const supabase = getSupabaseClient();

  const payload: Record<string, unknown> = {};
  if (typeof input.stock === 'number') {
    if (!Number.isFinite(input.stock) || input.stock < 0) {
      throw new Error('Stok adedi negatif olamaz.');
    }
    payload.stock = Math.floor(input.stock);
  }
  if (typeof input.low_stock_threshold === 'number') {
    if (!Number.isFinite(input.low_stock_threshold) || input.low_stock_threshold < 0) {
      throw new Error('Minimum stok limiti negatif olamaz.');
    }
    payload.low_stock_threshold = Math.floor(input.low_stock_threshold);
  }
  if (typeof input.stock_tracking_enabled === 'boolean') {
    payload.stock_tracking_enabled = input.stock_tracking_enabled;
  }
  if (typeof input.is_visible === 'boolean') {
    payload.is_visible = input.is_visible;
  }

  if (Object.keys(payload).length === 0) {
    throw new Error('Güncellenecek alan bulunamadı.');
  }

  const { data, error } = await supabase
    .from('listings')
    .update(payload)
    .eq('id', listingId)
    .or(`seller_id.eq.${userId},owner_id.eq.${userId}`)
    .select(
      'id, title, price, stock, low_stock_threshold, stock_tracking_enabled, is_sold_out, is_visible, last_stock_update_at, status, category_id, listing_images(url, is_cover, sort_order)'
    )
    .single();

  if (error) {
    throw new Error(`Stok güncellenemedi: ${error.message}`);
  }

  const row: any = data;
  return {
    id: row.id,
    title: row.title,
    price: Number(row.price ?? 0),
    cover_url: pickCover(row.listing_images),
    category_label: row.category_id ?? null,
    stock: Number(row.stock ?? 0),
    low_stock_threshold: Number(row.low_stock_threshold ?? 3),
    stock_tracking_enabled: Boolean(row.stock_tracking_enabled),
    is_sold_out: Boolean(row.is_sold_out),
    is_visible: row.is_visible !== false,
    last_stock_update_at: row.last_stock_update_at ?? null,
    status: row.status ?? null,
  };
}
