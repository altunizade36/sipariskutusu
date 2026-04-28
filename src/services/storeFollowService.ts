import { getSupabaseClient } from './supabase';

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function getUserId() {
  const supabase = getSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error('Giriş yapmanız gerekiyor.');
  }
  return user.id;
}

export async function fetchStoreFollowState(storeId: string) {
  if (!isUuid(storeId)) {
    return { isFollowing: false, followerCount: 0 };
  }

  const supabase = getSupabaseClient();
  const userId = await getUserId();

  const [{ data: followRow }, { data: storeRow }] = await Promise.all([
    supabase
      .from('store_follows')
      .select('id')
      .eq('store_id', storeId)
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('stores')
      .select('follower_count')
      .eq('id', storeId)
      .maybeSingle(),
  ]);

  return {
    isFollowing: Boolean(followRow),
    followerCount: Number(storeRow?.follower_count ?? 0),
  };
}

export async function followStore(storeId: string) {
  if (!isUuid(storeId)) {
    return;
  }

  const supabase = getSupabaseClient();
  const userId = await getUserId();

  const { data: existing } = await supabase
    .from('store_follows')
    .select('id')
    .eq('store_id', storeId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    return;
  }

  await supabase
    .from('store_follows')
    .insert({ store_id: storeId, user_id: userId });

  await supabase.rpc('increment_store_followers', { store_id: storeId });
}

export async function fetchFollowedStoreIds(storeIds: string[]) {
  const uuidStoreIds = storeIds.filter((id) => isUuid(id));

  if (uuidStoreIds.length === 0) {
    return [] as string[];
  }

  const supabase = getSupabaseClient();
  const userId = await getUserId();

  const { data, error } = await supabase
    .from('store_follows')
    .select('store_id')
    .eq('user_id', userId)
    .in('store_id', uuidStoreIds);

  if (error) {
    throw error;
  }

  return (data ?? []).map((item) => item.store_id as string);
}

export async function unfollowStore(storeId: string) {
  if (!isUuid(storeId)) {
    return;
  }

  const supabase = getSupabaseClient();
  const userId = await getUserId();

  const { data: deleted } = await supabase
    .from('store_follows')
    .delete()
    .select('id')
    .eq('store_id', storeId)
    .eq('user_id', userId);

  if (!deleted || deleted.length === 0) {
    return;
  }

  await supabase.rpc('decrement_store_followers', { store_id: storeId });
}
