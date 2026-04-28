/**
 * profileService.ts
 * Kullanıcı profili okuma/güncelleme, avatar yükleme.
 */

import { getSupabaseClient } from './supabase';

export type UserRole = 'buyer' | 'seller' | 'admin';

export interface Profile {
  id: string;
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  city?: string | null;
  bio?: string | null;
  role?: UserRole | null;
  is_seller: boolean;
  is_verified: boolean;
  is_comment_blocked?: boolean;
  rating: number;
  rating_count: number;
  created_at: string;
}

export interface SellerAccountSnapshot {
  store_id: string;
  store_name: string;
  store_username: string;
  whatsapp: string | null;
  instagram_handle: string | null;
  website: string | null;
  category_id: string | null;
  is_verified: boolean;
}

export interface AccountCoreProfile extends Profile {
  resolved_role: UserRole;
  seller_profile: SellerAccountSnapshot | null;
}

function resolveProfileRole(profile: Profile | null): UserRole {
  if (!profile) {
    return 'buyer';
  }

  if (profile.role === 'admin') {
    return 'admin';
  }

  if (profile.role === 'seller' || profile.is_seller) {
    return 'seller';
  }

  return 'buyer';
}

export async function fetchMyProfile(): Promise<Profile | null> {
  const supabase = getSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) throw error;
  return data as Profile;
}

export async function fetchMyAccountCore(): Promise<AccountCoreProfile | null> {
  const supabase = getSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const profile = await fetchMyProfile();
  if (!profile) {
    return null;
  }

  const { data: store } = await supabase
    .from('stores')
    .select('id,name,username,whatsapp,website,category_id,is_verified')
    .eq('seller_id', user.id)
    .maybeSingle();

  let instagramHandle: string | null = null;
  if (store?.id) {
    const { data: instagramAccount } = await supabase
      .from('instagram_accounts')
      .select('instagram_handle')
      .eq('store_id', store.id)
      .maybeSingle();

    instagramHandle = (instagramAccount?.instagram_handle as string | null | undefined) ?? null;
  }

  return {
    ...profile,
    resolved_role: resolveProfileRole(profile),
    seller_profile: store
      ? {
          store_id: String(store.id),
          store_name: String(store.name ?? ''),
          store_username: String(store.username ?? ''),
          whatsapp: (store.whatsapp as string | null | undefined) ?? null,
          instagram_handle: instagramHandle,
          website: (store.website as string | null | undefined) ?? null,
          category_id: (store.category_id as string | null | undefined) ?? null,
          is_verified: Boolean(store.is_verified),
        }
      : null,
  };
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data as Profile;
}

export interface UpdateProfileInput {
  username?: string;
  full_name?: string;
  phone?: string;
  city?: string;
  bio?: string;
}

export async function updateProfile(updates: UpdateProfileInput): Promise<void> {
  const supabase = getSupabaseClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('Giriş yapmanız gerekiyor.');

  const { error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', user.id);

  if (error) throw error;
}

export async function uploadAvatar(uri: string): Promise<string> {
  const supabase = getSupabaseClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('Giriş yapmanız gerekiyor.');

  const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `${user.id}/avatar.${ext}`;

  const response = await fetch(uri);
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from('profile-images')
    .upload(path, arrayBuffer, {
      contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('profile-images').getPublicUrl(path);
  const avatarUrl = data.publicUrl;

  await updateProfile({ ...{}, ...{} });
  await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', user.id);

  return avatarUrl;
}
