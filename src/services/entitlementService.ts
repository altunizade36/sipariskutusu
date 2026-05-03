import { getSupabaseClient } from './supabase';

export type PlanName = 'free' | 'starter' | 'plus' | 'pro' | 'elite';

export type UserEntitlement = {
  id: string;
  user_id: string;
  plan: PlanName;
  max_active_products: number;
  daily_story_limit: number;
  monthly_credit_grant: number;
  active_instagram_product_limit: number;
  discovery_multiplier: number;
  can_use_advanced_stats: boolean;
  can_use_store_badge: boolean;
  store_badge_label: string | null;
  can_use_homepage_showcase: boolean;
  support_priority: string;
  updated_at: string;
};

export type CreditWallet = {
  id: string;
  user_id: string;
  balance: number;
  lifetime_purchased: number;
  lifetime_spent: number;
  updated_at: string;
};

export type CreditTransaction = {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  reason: string | null;
  product_id: string | null;
  revenuecat_transaction_id: string | null;
  created_at: string;
};

export type ActiveBoost = {
  id: string;
  user_id: string;
  type: string;
  product_id: string | null;
  story_id: string | null;
  store_id: string | null;
  credit_cost: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  created_at: string;
};

export type BoostType =
  | 'product_feature'
  | 'story_boost'
  | 'category_top'
  | 'discovery_boost'
  | 'store_feature'
  | 'homepage_showcase'
  | 'product_slot_5'
  | 'product_slot_10'
  | 'product_slot_25';

const BOOST_COSTS: Record<BoostType, { credits: number; durationHours: number }> = {
  product_feature:    { credits: 5,  durationHours: 24 },
  story_boost:        { credits: 3,  durationHours: 24 },
  category_top:       { credits: 8,  durationHours: 24 },
  discovery_boost:    { credits: 12, durationHours: 24 },
  store_feature:      { credits: 20, durationHours: 72 },
  homepage_showcase:  { credits: 40, durationHours: 24 },
  product_slot_5:     { credits: 30, durationHours: 720 },
  product_slot_10:    { credits: 50, durationHours: 720 },
  product_slot_25:    { credits: 100, durationHours: 720 },
};

const FREE_LIMITS: UserEntitlement = {
  id: '',
  user_id: '',
  plan: 'free',
  max_active_products: 10,
  daily_story_limit: 1,
  monthly_credit_grant: 0,
  active_instagram_product_limit: 10,
  discovery_multiplier: 1.0,
  can_use_advanced_stats: false,
  can_use_store_badge: false,
  store_badge_label: null,
  can_use_homepage_showcase: false,
  support_priority: 'normal',
  updated_at: '',
};

export async function getMyEntitlements(): Promise<UserEntitlement> {
  try {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return FREE_LIMITS;

    const { data, error } = await supabase
      .from('user_entitlements')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error || !data) return { ...FREE_LIMITS, user_id: user.id };
    return data as UserEntitlement;
  } catch {
    return FREE_LIMITS;
  }
}

export async function getMyWallet(): Promise<CreditWallet | null> {
  try {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('credit_wallets')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error || !data) return { id: '', user_id: user.id, balance: 0, lifetime_purchased: 0, lifetime_spent: 0, updated_at: '' };
    return data as CreditWallet;
  } catch {
    return null;
  }
}

export async function getMyCreditTransactions(limit = 50): Promise<CreditTransaction[]> {
  try {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return data as CreditTransaction[];
  } catch {
    return [];
  }
}

export async function getMyActiveBoosts(): Promise<ActiveBoost[]> {
  try {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('boosts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .gt('ends_at', now)
      .order('ends_at', { ascending: true });

    if (error || !data) return [];
    return data as ActiveBoost[];
  } catch {
    return [];
  }
}

export async function getMyAllBoosts(limit = 50): Promise<ActiveBoost[]> {
  try {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('boosts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return data as ActiveBoost[];
  } catch {
    return [];
  }
}

export async function getMySubscription() {
  try {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

export async function canPublishProduct(): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const ent = await getMyEntitlements();
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { allowed: false, reason: 'Giriş yapman gerekiyor.' };

    const { count, error } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('status', ['active', 'published']);

    if (error) return { allowed: true };
    const current = count ?? 0;
    const limit = ent.max_active_products >= 999999 ? Infinity : ent.max_active_products;
    if (current >= limit) {
      return {
        allowed: false,
        reason: `${ent.plan === 'free' ? 'Ücretsiz' : ent.plan.charAt(0).toUpperCase() + ent.plan.slice(1)} paketin en fazla ${ent.max_active_products} aktif ürüne izin veriyor. Paketini yükselt.`,
      };
    }
    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}

export async function canPublishInstagramProduct(): Promise<{ allowed: boolean; reason?: string }> {
  return { allowed: true };
}

export async function canCreateStory(): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const ent = await getMyEntitlements();
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { allowed: false, reason: 'Giriş yapman gerekiyor.' };

    if (ent.daily_story_limit >= 999999) return { allowed: true };

    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('usage_counters')
      .select('stories_created_count')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle();

    if (error) return { allowed: true };
    const todayCount = data?.stories_created_count ?? 0;
    if (todayCount >= ent.daily_story_limit) {
      return {
        allowed: false,
        reason: `Günlük hikaye limitine ulaştın (${ent.daily_story_limit}/${ent.daily_story_limit}). Daha fazla hikaye için paketini yükselt.`,
      };
    }
    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}

export async function canUseAdvancedStats(): Promise<boolean> {
  try {
    const ent = await getMyEntitlements();
    return ent.can_use_advanced_stats;
  } catch {
    return false;
  }
}

export async function getDiscoveryMultiplier(): Promise<number> {
  try {
    const ent = await getMyEntitlements();
    return ent.discovery_multiplier;
  } catch {
    return 1.0;
  }
}

export async function getStoreBadge(): Promise<{ hasBadge: boolean; label: string | null }> {
  try {
    const ent = await getMyEntitlements();
    return { hasBadge: ent.can_use_store_badge, label: ent.store_badge_label };
  } catch {
    return { hasBadge: false, label: null };
  }
}

export async function canStartBoost(type: BoostType): Promise<{ allowed: boolean; reason?: string; cost: number }> {
  try {
    const cost = BOOST_COSTS[type]?.credits ?? 0;
    const wallet = await getMyWallet();
    const balance = wallet?.balance ?? 0;

    if (balance < cost) {
      return {
        allowed: false,
        reason: `Yeterli krediniz yok. Bu boost ${cost} kredi gerektiriyor, bakiyeniz: ${balance} kredi.`,
        cost,
      };
    }
    return { allowed: true, cost };
  } catch {
    return { allowed: false, reason: 'Boost başlatılamadı.', cost: 0 };
  }
}

export async function spendCreditsAndCreateBoost(
  type: BoostType,
  targetId: string,
  targetField: 'product_id' | 'story_id' | 'store_id' = 'product_id',
): Promise<{ success: boolean; reason?: string }> {
  try {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, reason: 'Giriş yapman gerekiyor.' };

    const boost = BOOST_COSTS[type];
    if (!boost) return { success: false, reason: 'Geçersiz boost türü.' };

    const canCheck = await canStartBoost(type);
    if (!canCheck.allowed) return { success: false, reason: canCheck.reason };

    const wallet = await getMyWallet();
    if (!wallet) return { success: false, reason: 'Cüzdan bulunamadı.' };

    await supabase.from('credit_wallets').update({
      balance: wallet.balance - boost.credits,
      lifetime_spent: wallet.lifetime_spent + boost.credits,
      updated_at: new Date().toISOString(),
    }).eq('user_id', user.id);

    await supabase.from('credit_transactions').insert({
      user_id: user.id,
      type: 'spend',
      amount: -boost.credits,
      reason: `Boost: ${type}`,
    });

    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + boost.durationHours * 3600 * 1000);

    await supabase.from('boosts').insert({
      user_id: user.id,
      type,
      [targetField]: targetId,
      credit_cost: boost.credits,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      is_active: true,
    });

    return { success: true };
  } catch (err) {
    return { success: false, reason: err instanceof Error ? err.message : 'Boost başlatılamadı.' };
  }
}

export function getPlanDisplayName(plan: PlanName): string {
  const names: Record<PlanName, string> = {
    free: 'Ücretsiz',
    starter: 'Starter',
    plus: 'Plus',
    pro: 'Pro',
    elite: 'Elite',
  };
  return names[plan] ?? plan;
}

export function getBoostCost(type: BoostType): number {
  return BOOST_COSTS[type]?.credits ?? 0;
}

export function getBoostDurationHours(type: BoostType): number {
  return BOOST_COSTS[type]?.durationHours ?? 24;
}

export async function ensureWalletExists(userId: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('credit_wallets')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!data) {
      await supabase.from('credit_wallets').insert({
        user_id: userId,
        balance: 0,
        lifetime_purchased: 0,
        lifetime_spent: 0,
      });
    }

    const { data: ent } = await supabase
      .from('user_entitlements')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!ent) {
      await supabase.from('user_entitlements').insert({
        user_id: userId,
        plan: 'free',
        max_active_products: 10,
        daily_story_limit: 1,
        monthly_credit_grant: 0,
        active_instagram_product_limit: 10,
        discovery_multiplier: 1.0,
        can_use_advanced_stats: false,
        can_use_store_badge: false,
        store_badge_label: null,
        can_use_homepage_showcase: false,
        support_priority: 'normal',
      });
    }
  } catch {
    // silently ignore
  }
}
