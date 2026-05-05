import { getSupabaseClient, isSupabaseConfigured } from './supabase';

export type DiscoverStore = {
  id: string;
  name: string;
  username: string;
  avatar: string;
  coverImage: string;
  city: string;
  category: string;
  followers: string;
  rating: number;
  headline: string;
  tags: string[];
  weeklyDrop: string;
  featured: boolean;
};

export type SellerStoreRow = {
  id: string;
  seller_id: string;
  name: string;
  username: string;
  description: string;
  city: string;
  avatar_url: string | null;
  cover_url: string | null;
  email: string;
  phone: string;
  whatsapp: string | null;
  website: string | null;
  instagram_handle?: string | null;
  category_id: string;
  default_stock: number;
  delivery_info: string;
  is_active: boolean;
  is_verified?: boolean;
};

async function syncSellerRole(userId: string) {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('profiles')
    .update({
      is_seller: true,
      role: 'seller',
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    throw error;
  }
}

function formatFollowers(count: number) {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}B`;
  }
  return `${count}`;
}

export async function fetchDiscoverStores(limit = 24): Promise<DiscoverStore[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('stores')
    .select('id,name,username,avatar_url,cover_url,city,category_id,follower_count,rating,description,is_verified')
    .eq('is_active', true)
    .order('follower_count', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []).map((store, index) => ({
    id: store.id,
    name: store.name,
    username: store.username ? `@${String(store.username).replace(/^@+/, '')}` : '@magaza',
    avatar: store.avatar_url || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=300&q=80',
    coverImage: store.cover_url || 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&q=80',
    city: store.city || 'Türkiye',
    category: store.category_id || 'Genel',
    followers: formatFollowers(Number(store.follower_count ?? 0)),
    rating: Number(store.rating ?? 0),
    headline: store.description || 'Güncel vitrinimizi incele ve yeni ürünleri keşfet.',
    tags: [store.category_id || 'Genel', 'Pazaryeri'],
    weeklyDrop: `${3 + (index % 7)} yeni ürün`,
    featured: Boolean(store.is_verified) || Number(store.follower_count ?? 0) > 1000,
  }));
}

export async function fetchStoreBySellerIdOrKey(sellerIdOrKey: string): Promise<DiscoverStore | null> {
  if (!isSupabaseConfigured || !sellerIdOrKey) return null;
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('stores')
    .select('id,name,username,avatar_url,cover_url,city,category_id,follower_count,rating,description,is_verified,seller_id')
    .or(`seller_id.eq.${sellerIdOrKey},id.eq.${sellerIdOrKey}`)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    name: data.name,
    username: data.username ? `@${String(data.username).replace(/^@+/, '')}` : '@magaza',
    avatar: data.avatar_url || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=300&q=80',
    coverImage: data.cover_url || 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&q=80',
    city: data.city || 'Türkiye',
    category: data.category_id || 'Genel',
    followers: formatFollowers(Number(data.follower_count ?? 0)),
    rating: Number(data.rating ?? 0),
    headline: data.description || 'Güncel vitrinimizi incele ve yeni ürünleri keşfet.',
    tags: [data.category_id || 'Genel', 'Pazaryeri'],
    weeklyDrop: '3 yeni ürün',
    featured: Boolean(data.is_verified) || Number(data.follower_count ?? 0) > 1000,
  };
}

export async function fetchMyStore(): Promise<SellerStoreRow | null> {
  const supabase = getSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('seller_id', user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const instagramAccount = await getInstagramAccount(data.id);

  return {
    ...data,
    instagram_handle: instagramAccount?.instagram_handle ?? null,
  } as SellerStoreRow;
}

export async function createSellerStore(input: {
  name: string;
  username: string;
  description: string;
  city: string;
  email: string;
  phone: string;
  whatsapp?: string;
  website?: string;
  defaultStock: number;
  deliveryInfo: string;
  avatar?: string;
  coverImage?: string;
  categoryId: string;
  instagramHandle?: string;
  acceptedTermsOfService: boolean;
  acceptedPrivacyPolicy: boolean;
  acceptedKVKK: boolean;
  acceptedPlatformLiability: boolean;
}): Promise<SellerStoreRow> {
  const supabase = getSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Giriş yapman gerekiyor.');

  // Terms acceptance validation
  if (!input.acceptedTermsOfService || !input.acceptedPrivacyPolicy || 
      !input.acceptedKVKK || !input.acceptedPlatformLiability) {
    throw new Error('Lütfen tüm şartları kabul edin.');
  }

  // Instagram handle validasyonu (sunucu tarafı)
  if (input.instagramHandle?.trim()) {
    const handle = input.instagramHandle.trim().replace(/^@+/, '');
    
    if (handle.length < 1 || handle.length > 30) {
      throw new Error('Instagram handle 1-30 karakter arasında olmalı');
    }
    
    if (!/^[a-zA-Z0-9_.]+$/.test(handle)) {
      throw new Error('Instagram handle sadece harf, sayı, underscore ve nokta içerebilir');
    }
    
    if (/^[_.]/.test(handle) || /[_.]$/.test(handle)) {
      throw new Error('Instagram handle nokta veya underscore ile başlayamaz/bitemez');
    }
  }

  const { data, error } = await supabase
    .from('stores')
    .insert({
      seller_id: user.id,
      name: input.name,
      username: input.username.replace(/^@+/, ''),
      description: input.description,
      city: input.city,
      email: input.email,
      phone: input.phone,
      whatsapp: input.whatsapp || null,
      website: input.website || null,
      category_id: input.categoryId,
      default_stock: input.defaultStock,
      delivery_info: input.deliveryInfo,
      avatar_url: input.avatar || null,
      cover_url: input.coverImage || null,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;

  await syncSellerRole(user.id);
  
  // Instagram handle kaydı oluştur (varsa)
  if (input.instagramHandle?.trim()) {
    await supabase
      .from('instagram_accounts')
      .insert({
        store_id: data.id,
        instagram_handle: input.instagramHandle.trim().replace(/^@+/, ''),
        verified: false,
      })
      .select()
      .single();
  }

  // Terms acceptance kaydı oluştur
  await supabase
    .from('store_terms_acceptance')
    .insert({
      store_id: data.id,
      seller_id: user.id,
      accepted_terms_of_service: input.acceptedTermsOfService,
      accepted_privacy_policy: input.acceptedPrivacyPolicy,
      accepted_kvkk: input.acceptedKVKK,
      accepted_platform_liability: input.acceptedPlatformLiability,
      accepted_ip_address: null, // Frontend IP eklenilebilir
      accepted_user_agent: null, // Frontend UA eklenilebilir
    });
  
  return {
    ...data,
    instagram_handle: input.instagramHandle?.trim().replace(/^@+/, '') || null,
  } as SellerStoreRow;
}

export async function updateSellerStore(
  storeId: string,
  updates: Partial<{
    name: string;
    username: string;
    description: string;
    city: string;
    email: string;
    phone: string;
    whatsapp: string;
    website: string;
    defaultStock: number;
    deliveryInfo: string;
    avatar: string;
    coverImage: string;
    categoryId: string;
    instagramHandle: string;
  }>,
): Promise<SellerStoreRow> {
  const supabase = getSupabaseClient();
  const payload: Record<string, unknown> = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.username !== undefined) payload.username = updates.username.replace(/^@+/, '');
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.city !== undefined) payload.city = updates.city;
  if (updates.email !== undefined) payload.email = updates.email;
  if (updates.phone !== undefined) payload.phone = updates.phone;
  if (updates.whatsapp !== undefined) payload.whatsapp = updates.whatsapp;
  if (updates.website !== undefined) payload.website = updates.website;
  if (updates.defaultStock !== undefined) payload.default_stock = updates.defaultStock;
  if (updates.deliveryInfo !== undefined) payload.delivery_info = updates.deliveryInfo;
  if (updates.avatar !== undefined) payload.avatar_url = updates.avatar;
  if (updates.coverImage !== undefined) payload.cover_url = updates.coverImage;
  if (updates.categoryId !== undefined) payload.category_id = updates.categoryId;

  const { data, error } = await supabase
    .from('stores')
    .update(payload)
    .eq('id', storeId)
    .select()
    .single();

  if (error) throw error;

  if (updates.instagramHandle !== undefined) {
    const handle = updates.instagramHandle.trim();

    if (handle) {
      await updateInstagramAccount(storeId, handle);
    }
  }

  const instagramAccount = await getInstagramAccount(storeId);
  return {
    ...data,
    instagram_handle: instagramAccount?.instagram_handle ?? null,
  } as SellerStoreRow;
}

export async function getInstagramAccount(storeId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('instagram_accounts')
    .select('*')
    .eq('store_id', storeId)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows found, bu durumda null dönüş normaldir
    throw error;
  }
  
  return data || null;
}

export async function updateInstagramAccount(storeId: string, handle: string) {
  const supabase = getSupabaseClient();
  
  // Validasyon
  if (!handle.trim()) {
    throw new Error('Instagram handle bos olamaz');
  }
  
  const cleanHandle = handle.trim().replace(/^@+/, '');
  
  if (cleanHandle.length < 1 || cleanHandle.length > 30) {
    throw new Error('Instagram handle 1-30 karakter arasında olmalı');
  }
  
  if (!/^[a-zA-Z0-9_.]+$/.test(cleanHandle)) {
    throw new Error('Instagram handle sadece harf, sayı, underscore ve nokta içerebilir');
  }
  
  if (/^[_.]/.test(cleanHandle) || /[_.]$/.test(cleanHandle)) {
    throw new Error('Instagram handle nokta veya underscore ile başlayamaz/bitemez');
  }

  const existing = await getInstagramAccount(storeId);
  
  if (existing) {
    // Güncelle
    const { data, error } = await supabase
      .from('instagram_accounts')
      .update({ instagram_handle: cleanHandle })
      .eq('store_id', storeId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } else {
    // Yeni oluştur
    const { data, error } = await supabase
      .from('instagram_accounts')
      .insert({
        store_id: storeId,
        instagram_handle: cleanHandle,
        verified: false,
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
}