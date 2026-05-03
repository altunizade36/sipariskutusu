import AsyncStorage from '@react-native-async-storage/async-storage';
import { MARKETPLACE_CATEGORIES } from '../constants/marketplaceCategories';

const IG_CONNECTION_KEY = 'instagram_connection_v2';
const IG_CONTENT_CACHE_KEY = 'instagram_content_cache_v2';
const IG_LAST_SYNC_KEY = 'instagram_last_sync_v2';
const IG_CONTENT_STATUS_KEY = 'instagram_content_status_v2';
const IG_SYNC_STATE_KEY = 'instagram_sync_state_v2';
const IG_SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 dakika

export type InstagramMediaType = 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'token_expired' | 'api_limit' | 'offline';
export type ImportStatus =
  | 'imported_from_instagram'
  | 'auto_draft'
  | 'needs_review'
  | 'ready_to_publish'
  | 'published'
  | 'rejected';

export type ContentStatus = {
  isHidden: boolean;
  convertedProductId: string | null;
  isDeleted: boolean;
};
export type ContentStatusMap = Record<string, ContentStatus>;

export type SyncState = {
  status: SyncStatus;
  lastSyncAt: string | null;
  error: string | null;
};

export type InstagramPost = {
  id: string;
  mediaType: InstagramMediaType;
  mediaUrl: string;
  thumbnailUrl?: string;
  caption: string;
  timestamp: string;
  likeCount: number;
  commentsCount: number;
  permalink: string;
  status: ImportStatus;
  parsedDraft?: ParsedProductDraft;
};

export type InstagramReel = {
  id: string;
  mediaUrl: string;
  thumbnailUrl: string;
  caption: string;
  timestamp: string;
  likeCount: number;
  commentsCount: number;
  viewCount: number;
  permalink: string;
  status: ImportStatus;
};

export type InstagramStory = {
  id: string;
  mediaType: 'IMAGE' | 'VIDEO';
  mediaUrl: string;
  timestamp: string;
  expiresAt: string;
  viewCount: number;
  isActive: boolean;
};

export type ParsedProductDraft = {
  title: string;
  price: number | null;
  categoryId: string | null;
  categoryName: string | null;
  subCategoryId: string | null;
  subCategoryName: string | null;
  description: string;
  sizes: string;
  colors: string;
  city: string | null;
  stockStatus: 'in_stock' | 'out_of_stock' | 'limited' | null;
  deliveryType: 'Kargo' | 'Elden' | 'Görüşülür' | null;
  confidence: number;
  missingFields: string[];
  autoFields: string[];
};

export type InstagramConnection = {
  connected: boolean;
  accountId: string | null;
  username: string | null;
  displayName: string | null;
  profilePicUrl: string | null;
  followersCount: number;
  mediaCount: number;
  accountType: 'BUSINESS' | 'CREATOR' | null;
  connectedAt: string | null;
  tokenExpiresAt: string | null;
};

const TR_COLORS = [
  'siyah', 'beyaz', 'kırmızı', 'mavi', 'yeşil', 'sarı', 'mor', 'pembe',
  'turuncu', 'gri', 'kahverengi', 'lacivert', 'ekru', 'krem', 'bej',
  'açık mavi', 'koyu mavi', 'mint', 'bordo', 'indigo', 'fuşya', 'rose',
];

const TR_CITIES = [
  'istanbul', 'ankara', 'izmir', 'bursa', 'antalya', 'adana', 'konya',
  'gaziantep', 'mersin', 'kayseri', 'diyarbakır', 'trabzon', 'erzurum',
  'eskişehir', 'samsun', 'denizli', 'şanlıurfa', 'malatya', 'kocaeli',
];

export function parseCaption(caption: string): ParsedProductDraft {
  const lower = caption.toLowerCase();
  const autoFields: string[] = [];

  const priceMatch =
    caption.match(/₺\s?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)/i) ||
    caption.match(/(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)\s?(?:tl|₺|lira)/i) ||
    caption.match(/fiyat[ı:]\s*(\d+)/i);
  const rawPrice = priceMatch
    ? parseFloat(priceMatch[1].replace(/\./g, '').replace(',', '.'))
    : null;
  const price = rawPrice && rawPrice > 0 && rawPrice < 1000000 ? rawPrice : null;
  if (price) autoFields.push('price');

  let categoryId: string | null = null;
  let categoryName: string | null = null;
  let subCategoryId: string | null = null;
  let subCategoryName: string | null = null;
  let bestScore = 0;

  for (const cat of MARKETPLACE_CATEGORIES) {
    for (const sub of cat.subcategories) {
      for (const kw of sub.keywords) {
        if (lower.includes(kw.toLowerCase())) {
          const score = kw.length;
          if (score > bestScore) {
            bestScore = score;
            categoryId = cat.id;
            categoryName = cat.name;
            subCategoryId = sub.id;
            subCategoryName = sub.name;
          }
        }
      }
    }
  }
  if (categoryId) autoFields.push('category');

  const sizePatterns = [
    /\b(XS|S|M|L|XL|XXL|XXXL)(?:\s*[-\/]\s*(XS|S|M|L|XL|XXL|XXXL))*\b/i,
    /\b(\d{2})\s*[-–]\s*(\d{2})\s*(?:numara|beden|no\.?)?/i,
    /\b(\d{2})\s*(?:numara|beden|no\.?)\b/i,
  ];
  let sizes = '';
  for (const re of sizePatterns) {
    const m = caption.match(re);
    if (m) { sizes = m[0].trim(); break; }
  }
  if (sizes) autoFields.push('sizes');

  const foundColors: string[] = [];
  for (const c of TR_COLORS) {
    if (lower.includes(c)) foundColors.push(c);
  }
  const colors = foundColors.join(', ');
  if (colors) autoFields.push('colors');

  let city: string | null = null;
  for (const c of TR_CITIES) {
    if (lower.includes(c)) { city = c.charAt(0).toUpperCase() + c.slice(1); break; }
  }
  if (city) autoFields.push('city');

  let stockStatus: ParsedProductDraft['stockStatus'] = null;
  if (lower.includes('stokta') || lower.includes('stok var') || lower.includes('mevcut')) {
    stockStatus = 'in_stock';
  } else if (lower.includes('tükendi') || lower.includes('stok yok') || lower.includes('bitti')) {
    stockStatus = 'out_of_stock';
  } else if (lower.includes('son') || lower.includes('sınırlı stok') || lower.includes('az kaldı')) {
    stockStatus = 'limited';
  }

  let deliveryType: ParsedProductDraft['deliveryType'] = null;
  if (lower.includes('kargo') || lower.includes('gönderim') || lower.includes('teslimat')) {
    deliveryType = 'Kargo';
  } else if (lower.includes('elden') || lower.includes('yüz yüze')) {
    deliveryType = 'Elden';
  }

  const words = caption.split(/\s+/).filter(
    (w) => !w.startsWith('#') && !w.startsWith('@') && !/^[0-9₺]+/.test(w)
  );
  const cleanWords = words.slice(0, 6).join(' ').replace(/[^\w\sğüşıöçĞÜŞİÖÇ]/g, '').trim();
  const title = cleanWords.length > 3 ? cleanWords : (subCategoryName ?? categoryName ?? '');
  if (title && title.length > 3) autoFields.push('title');

  const missingFields: string[] = [];
  if (!price) missingFields.push('Fiyat eksik');
  if (!categoryId) missingFields.push('Kategori seçilmeli');
  if (!title || title.length < 3) missingFields.push('Ürün adı eksik');

  const filledCount = [price, categoryId, title.length > 3, sizes, colors, city].filter(Boolean).length;
  const confidence = Math.min(100, Math.round((filledCount / 6) * 100));

  return {
    title: title || '',
    price,
    categoryId,
    categoryName,
    subCategoryId,
    subCategoryName,
    description: caption,
    sizes,
    colors,
    city,
    stockStatus,
    deliveryType,
    confidence,
    missingFields,
    autoFields,
  };
}

const MOCK_POSTS: Omit<InstagramPost, 'parsedDraft'>[] = [
  {
    id: 'ig_post_1',
    mediaType: 'IMAGE',
    mediaUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80',
    caption: 'Yeni sezon Nike Air Max sneaker 1250 TL 36-44 numara siyah ve beyaz stokta kargo ile gönderim yapılıyor #ayakkabı #sneaker #nike',
    timestamp: new Date(Date.now() - 2 * 86400000).toISOString(),
    likeCount: 284,
    commentsCount: 18,
    permalink: 'https://instagram.com/p/abc123',
    status: 'auto_draft',
  },
  {
    id: 'ig_post_2',
    mediaType: 'IMAGE',
    mediaUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80',
    caption: 'Yazlık elbise koleksiyonumuz geldi 💃 S M L XL beden seçenekleri mevcut Fiyat: 450₺ İstanbul teslimat mümkün #elbise #yaz #moda',
    timestamp: new Date(Date.now() - 5 * 86400000).toISOString(),
    likeCount: 512,
    commentsCount: 43,
    permalink: 'https://instagram.com/p/def456',
    status: 'auto_draft',
  },
  {
    id: 'ig_post_3',
    mediaType: 'CAROUSEL_ALBUM',
    mediaUrl: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&q=80',
    caption: 'Deri ceket modeli — lacivert ve siyah renk seçeneği var 2800 TL kargo ücretsiz İstanbul 42-52 beden #ceket #deri #erkekgiyim',
    timestamp: new Date(Date.now() - 7 * 86400000).toISOString(),
    likeCount: 197,
    commentsCount: 9,
    permalink: 'https://instagram.com/p/ghi789',
    status: 'needs_review',
  },
  {
    id: 'ig_post_4',
    mediaType: 'IMAGE',
    mediaUrl: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80',
    caption: 'Yeni koleksiyon çantalar geldi 👜 Farklı renk seçenekleri: krem, bordo, siyah Fiyatlar 350₺ den başlıyor kargo var #çanta #aksesuar',
    timestamp: new Date(Date.now() - 10 * 86400000).toISOString(),
    likeCount: 445,
    commentsCount: 67,
    permalink: 'https://instagram.com/p/jkl012',
    status: 'auto_draft',
  },
  {
    id: 'ig_post_5',
    mediaType: 'IMAGE',
    mediaUrl: 'https://images.unsplash.com/photo-1493217465235-252dd9c0d632?w=600&q=80',
    caption: 'Oversize sweatshirt 🔥 Unisex S-XL beden gri ve siyah renk 380 TL #sweatshirt #oversize #streetwear stokta',
    timestamp: new Date(Date.now() - 14 * 86400000).toISOString(),
    likeCount: 891,
    commentsCount: 112,
    permalink: 'https://instagram.com/p/mno345',
    status: 'published',
  },
  {
    id: 'ig_post_6',
    mediaType: 'IMAGE',
    mediaUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80',
    caption: 'Klasik saat koleksiyonu erkek 🕐 İstanbul elden teslim mümkün 1800 TL son 3 adet kaldı #saat #aksesuar #erkek',
    timestamp: new Date(Date.now() - 18 * 86400000).toISOString(),
    likeCount: 223,
    commentsCount: 31,
    permalink: 'https://instagram.com/p/pqr678',
    status: 'auto_draft',
  },
];

const MOCK_REELS: InstagramReel[] = [
  {
    id: 'ig_reel_1',
    mediaUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1588117305388-c2631a279f82?w=600&q=80',
    caption: 'Yeni sezon koleksiyonu unboxing 📦 Harika fırsatlar #moda #trend',
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    likeCount: 1240,
    commentsCount: 89,
    viewCount: 15420,
    permalink: 'https://instagram.com/reel/abc',
    status: 'imported_from_instagram',
  },
  {
    id: 'ig_reel_2',
    mediaUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=600&q=80',
    caption: 'Stil rehberi: Yazlık kombin önerileri 💫 Tüm parçalar mağazamızda mevcut',
    timestamp: new Date(Date.now() - 3 * 86400000).toISOString(),
    likeCount: 876,
    commentsCount: 54,
    viewCount: 9820,
    permalink: 'https://instagram.com/reel/def',
    status: 'imported_from_instagram',
  },
  {
    id: 'ig_reel_3',
    mediaUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1523381294911-8d3cead13475?w=600&q=80',
    caption: 'Müşteri incelemesi: "Bu sezon en çok beğendiğim ürün!" 🌟 Stok sınırlı 650 TL',
    timestamp: new Date(Date.now() - 6 * 86400000).toISOString(),
    likeCount: 2103,
    commentsCount: 178,
    viewCount: 41200,
    permalink: 'https://instagram.com/reel/ghi',
    status: 'imported_from_instagram',
  },
];

const MOCK_STORIES: InstagramStory[] = [
  {
    id: 'ig_story_1',
    mediaType: 'IMAGE',
    mediaUrl: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&q=80',
    timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
    expiresAt: new Date(Date.now() + 22 * 3600000).toISOString(),
    viewCount: 342,
    isActive: true,
  },
  {
    id: 'ig_story_2',
    mediaType: 'IMAGE',
    mediaUrl: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=600&q=80',
    timestamp: new Date(Date.now() - 5 * 3600000).toISOString(),
    expiresAt: new Date(Date.now() + 19 * 3600000).toISOString(),
    viewCount: 198,
    isActive: true,
  },
  {
    id: 'ig_story_3',
    mediaType: 'IMAGE',
    mediaUrl: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600&q=80',
    timestamp: new Date(Date.now() - 8 * 3600000).toISOString(),
    expiresAt: new Date(Date.now() + 16 * 3600000).toISOString(),
    viewCount: 89,
    isActive: true,
  },
];

export async function getContentStatusMap(): Promise<ContentStatusMap> {
  try {
    const raw = await AsyncStorage.getItem(IG_CONTENT_STATUS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

export async function setContentStatus(
  postId: string,
  update: Partial<ContentStatus>
): Promise<void> {
  const map = await getContentStatusMap();
  map[postId] = {
    isHidden: false,
    convertedProductId: null,
    isDeleted: false,
    ...(map[postId] ?? {}),
    ...update,
  };
  await AsyncStorage.setItem(IG_CONTENT_STATUS_KEY, JSON.stringify(map));
}

export async function getSyncState(): Promise<SyncState> {
  try {
    const raw = await AsyncStorage.getItem(IG_SYNC_STATE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { status: 'idle', lastSyncAt: null, error: null };
}

export async function setSyncState(state: SyncState): Promise<void> {
  await AsyncStorage.setItem(IG_SYNC_STATE_KEY, JSON.stringify(state));
}

export async function getLastInstagramSync(): Promise<Date | null> {
  try {
    const raw = await AsyncStorage.getItem(IG_LAST_SYNC_KEY);
    if (raw) return new Date(raw);
  } catch {}
  return null;
}

export async function setLastInstagramSync(): Promise<void> {
  await AsyncStorage.setItem(IG_LAST_SYNC_KEY, new Date().toISOString());
}

export async function shouldSyncInstagram(): Promise<boolean> {
  const last = await getLastInstagramSync();
  if (!last) return true;
  return Date.now() - last.getTime() >= IG_SYNC_INTERVAL_MS;
}

export async function getInstagramConnection(): Promise<InstagramConnection> {
  try {
    const raw = await AsyncStorage.getItem(IG_CONNECTION_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    connected: false,
    accountId: null,
    username: null,
    displayName: null,
    profilePicUrl: null,
    followersCount: 0,
    mediaCount: 0,
    accountType: null,
    connectedAt: null,
    tokenExpiresAt: null,
  };
}

export function isTokenExpired(connection: InstagramConnection): boolean {
  if (!connection.tokenExpiresAt) return false;
  return new Date(connection.tokenExpiresAt) < new Date();
}

export async function connectInstagramOAuth(): Promise<InstagramConnection> {
  await new Promise((r) => setTimeout(r, 2200));
  const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
  const conn: InstagramConnection = {
    connected: true,
    accountId: `ig_${Date.now()}`,
    username: 'demo_magaza',
    displayName: 'Demo Mağaza',
    profilePicUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&q=80',
    followersCount: 12450,
    mediaCount: MOCK_POSTS.length + MOCK_REELS.length,
    accountType: 'BUSINESS',
    connectedAt: new Date().toISOString(),
    tokenExpiresAt: expiresAt.toISOString(),
  };
  await AsyncStorage.setItem(IG_CONNECTION_KEY, JSON.stringify(conn));
  await setSyncState({ status: 'success', lastSyncAt: new Date().toISOString(), error: null });
  await setLastInstagramSync();
  return conn;
}

export async function connectInstagram(
  username: string,
  accountType: 'BUSINESS' | 'CREATOR'
): Promise<InstagramConnection> {
  const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
  const conn: InstagramConnection = {
    connected: true,
    accountId: `ig_${Date.now()}`,
    username: username.replace('@', ''),
    displayName: username.replace('@', '').replace(/_/g, ' '),
    profilePicUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&q=80',
    followersCount: Math.floor(Math.random() * 50000) + 1000,
    mediaCount: MOCK_POSTS.length + MOCK_REELS.length,
    accountType,
    connectedAt: new Date().toISOString(),
    tokenExpiresAt: expiresAt.toISOString(),
  };
  await AsyncStorage.setItem(IG_CONNECTION_KEY, JSON.stringify(conn));
  await setSyncState({ status: 'success', lastSyncAt: new Date().toISOString(), error: null });
  await setLastInstagramSync();
  return conn;
}

export async function disconnectInstagram(): Promise<void> {
  await AsyncStorage.removeItem(IG_CONNECTION_KEY);
  await AsyncStorage.removeItem(IG_CONTENT_CACHE_KEY);
  await AsyncStorage.removeItem(IG_SYNC_STATE_KEY);
  await AsyncStorage.removeItem(IG_LAST_SYNC_KEY);
}

export async function syncInstagramContent(): Promise<{
  posts: InstagramPost[];
  reels: InstagramReel[];
  stories: InstagramStory[];
}> {
  await setSyncState({ status: 'syncing', lastSyncAt: null, error: null });
  try {
    await new Promise((r) => setTimeout(r, 1500));
    const [posts, reels, stories] = await Promise.all([
      fetchInstagramPosts(),
      fetchInstagramReels(),
      fetchInstagramStories(),
    ]);
    const now = new Date().toISOString();
    await setSyncState({ status: 'success', lastSyncAt: now, error: null });
    await setLastInstagramSync();
    return { posts, reels, stories };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Senkronizasyon başarısız.';
    await setSyncState({ status: 'error', lastSyncAt: null, error: msg });
    throw err;
  }
}

export async function fetchInstagramPosts(): Promise<InstagramPost[]> {
  await new Promise((r) => setTimeout(r, 600));
  return MOCK_POSTS.map((p) => ({
    ...p,
    parsedDraft: parseCaption(p.caption),
  }));
}

export async function fetchInstagramReels(): Promise<InstagramReel[]> {
  await new Promise((r) => setTimeout(r, 400));
  return MOCK_REELS;
}

export async function fetchInstagramStories(): Promise<InstagramStory[]> {
  await new Promise((r) => setTimeout(r, 300));
  return MOCK_STORIES.filter((s) => new Date(s.expiresAt) > new Date());
}

export async function fetchInstagramContentThrottled(): Promise<{
  posts: InstagramPost[];
  reels: InstagramReel[];
  stories: InstagramStory[];
} | null> {
  const doSync = await shouldSyncInstagram();
  if (!doSync) return null;
  return syncInstagramContent();
}

export function formatIgCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}B`;
  return String(n);
}

export function formatSyncTime(isoString: string | null): string {
  if (!isoString) return 'Hiç senkronize edilmedi';
  const d = new Date(isoString);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  if (mins < 1) return 'Az önce';
  if (mins < 60) return `${mins} dk önce`;
  if (hours < 24) return `${hours} sa önce`;
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function statusLabel(status: ImportStatus): string {
  switch (status) {
    case 'imported_from_instagram': return 'İçe Aktarıldı';
    case 'auto_draft': return 'Otomatik Taslak';
    case 'needs_review': return 'İnceleme Bekliyor';
    case 'ready_to_publish': return 'Yayına Hazır';
    case 'published': return 'Yayında';
    case 'rejected': return 'Reddedildi';
  }
}

export function statusColor(status: ImportStatus): string {
  switch (status) {
    case 'imported_from_instagram': return '#6366F1';
    case 'auto_draft': return '#F59E0B';
    case 'needs_review': return '#EF4444';
    case 'ready_to_publish': return '#10B981';
    case 'published': return '#3B82F6';
    case 'rejected': return '#9CA3AF';
  }
}

export function syncStatusLabel(status: SyncStatus): string {
  switch (status) {
    case 'idle': return 'Bekliyor';
    case 'syncing': return 'Senkronize ediliyor...';
    case 'success': return 'Senkronize edildi';
    case 'error': return 'Hata oluştu';
    case 'token_expired': return 'Bağlantı yenilenmeli';
    case 'api_limit': return 'API limiti aşıldı';
    case 'offline': return 'Çevrimdışı';
  }
}

export function syncStatusColor(status: SyncStatus): string {
  switch (status) {
    case 'idle': return '#6B7280';
    case 'syncing': return '#3B82F6';
    case 'success': return '#10B981';
    case 'error': return '#EF4444';
    case 'token_expired': return '#F59E0B';
    case 'api_limit': return '#F59E0B';
    case 'offline': return '#6B7280';
  }
}
