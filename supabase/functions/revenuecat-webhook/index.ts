import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const WEBHOOK_SECRET = Deno.env.get('REVENUECAT_WEBHOOK_SECRET') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const PLAN_ENTITLEMENTS: Record<string, PlanLimits> = {
  free: {
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
  },
  starter: {
    plan: 'starter',
    max_active_products: 20,
    daily_story_limit: 3,
    monthly_credit_grant: 15,
    active_instagram_product_limit: 999,
    discovery_multiplier: 1.05,
    can_use_advanced_stats: false,
    can_use_store_badge: false,
    store_badge_label: null,
    can_use_homepage_showcase: false,
    support_priority: 'normal',
  },
  plus: {
    plan: 'plus',
    max_active_products: 50,
    daily_story_limit: 8,
    monthly_credit_grant: 50,
    active_instagram_product_limit: 999,
    discovery_multiplier: 1.12,
    can_use_advanced_stats: true,
    can_use_store_badge: false,
    store_badge_label: null,
    can_use_homepage_showcase: false,
    support_priority: 'normal',
  },
  pro: {
    plan: 'pro',
    max_active_products: 200,
    daily_story_limit: 25,
    monthly_credit_grant: 150,
    active_instagram_product_limit: 999,
    discovery_multiplier: 1.25,
    can_use_advanced_stats: true,
    can_use_store_badge: true,
    store_badge_label: 'Pro Satıcı',
    can_use_homepage_showcase: false,
    support_priority: 'high',
  },
  elite: {
    plan: 'elite',
    max_active_products: 999999,
    daily_story_limit: 999999,
    monthly_credit_grant: 400,
    active_instagram_product_limit: 999999,
    discovery_multiplier: 1.5,
    can_use_advanced_stats: true,
    can_use_store_badge: true,
    store_badge_label: 'Elite Satıcı',
    can_use_homepage_showcase: true,
    support_priority: 'vip',
  },
};

const CREDIT_PRODUCTS: Record<string, number> = {
  'com.sipariskutusu.credits.30': 30,
  'com.sipariskutusu.credits.80': 80,
  'com.sipariskutusu.credits.180': 180,
  'com.sipariskutusu.credits.420': 420,
  'com.sipariskutusu.credits.1000': 1000,
};

function planFromProductId(productId: string): string {
  if (!productId) return 'free';
  if (productId.includes('starter')) return 'starter';
  if (productId.includes('plus')) return 'plus';
  if (productId.includes('pro')) return 'pro';
  if (productId.includes('elite')) return 'elite';
  return 'free';
}

function billingPeriodFromProductId(productId: string): string {
  if (productId.includes('yearly') || productId.includes('annual')) return 'yearly';
  return 'monthly';
}

type PlanLimits = {
  plan: string;
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
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' } });
  }

  try {
    if (WEBHOOK_SECRET) {
      const authHeader = req.headers.get('Authorization') ?? '';
      if (authHeader !== WEBHOOK_SECRET) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
      }
    }

    const payload = await req.json();
    const event = payload.event;
    if (!event) return new Response(JSON.stringify({ error: 'No event' }), { status: 400 });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const eventId: string = event.id ?? `${event.type}_${event.app_user_id}_${Date.now()}`;
    const appUserId: string = event.app_user_id ?? '';
    const eventType: string = event.type ?? '';
    const productId: string = event.product_id ?? '';
    const transactionId: string = event.transaction_id ?? '';
    const originalTransactionId: string = event.original_transaction_id ?? '';
    const expiresAtMs: number | null = event.expiration_at_ms ?? null;
    const purchasedAtMs: number | null = event.purchased_at_ms ?? null;
    const entitlementIds: string[] = event.entitlement_ids ?? [];
    const platform: string = event.store ?? '';

    const { data: existingEvent } = await supabase
      .from('revenuecat_events')
      .select('id')
      .eq('event_id', eventId)
      .maybeSingle();

    if (existingEvent) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'duplicate' }), { status: 200 });
    }

    const userId: string | null = appUserId || null;

    await supabase.from('revenuecat_events').insert({
      event_id: eventId,
      app_user_id: appUserId,
      user_id: userId,
      event_type: eventType,
      product_id: productId || null,
      entitlement_id: entitlementIds[0] ?? null,
      transaction_id: transactionId || null,
      original_transaction_id: originalTransactionId || null,
      raw_payload: payload,
    });

    switch (eventType) {
      case 'INITIAL_PURCHASE': {
        if (CREDIT_PRODUCTS[productId]) {
          await handleCreditPurchase(supabase, userId, productId, transactionId);
        } else {
          await handleSubscriptionPurchase(supabase, userId, appUserId, productId, platform, purchasedAtMs, expiresAtMs, 'active', entitlementIds);
        }
        break;
      }

      case 'RENEWAL': {
        const plan = planFromProductId(productId);
        const limits = PLAN_ENTITLEMENTS[plan] ?? PLAN_ENTITLEMENTS.free;
        const expiresAt = expiresAtMs ? new Date(expiresAtMs).toISOString() : null;

        await supabase.from('subscriptions').update({
          status: 'active',
          expires_at: expiresAt,
          auto_renewing: true,
          updated_at: new Date().toISOString(),
        }).eq('revenuecat_app_user_id', appUserId);

        if (userId && limits.monthly_credit_grant > 0) {
          const { data: sub } = await supabase
            .from('subscriptions')
            .select('last_credit_grant_at')
            .eq('revenuecat_app_user_id', appUserId)
            .maybeSingle();

          const lastGrant = sub?.last_credit_grant_at ? new Date(sub.last_credit_grant_at) : null;
          const now = new Date();
          const grantedThisMonth = lastGrant && lastGrant.getMonth() === now.getMonth() && lastGrant.getFullYear() === now.getFullYear();

          if (!grantedThisMonth) {
            await grantMonthlyCredits(supabase, userId, limits.monthly_credit_grant, plan, appUserId);
          }
        }
        break;
      }

      case 'CANCELLATION': {
        const expiresAt = expiresAtMs ? new Date(expiresAtMs).toISOString() : null;
        await supabase.from('subscriptions').update({
          status: 'cancelled',
          expires_at: expiresAt,
          auto_renewing: false,
          updated_at: new Date().toISOString(),
        }).eq('revenuecat_app_user_id', appUserId);
        break;
      }

      case 'UNCANCELLATION': {
        const expiresAt = expiresAtMs ? new Date(expiresAtMs).toISOString() : null;
        await supabase.from('subscriptions').update({
          status: 'active',
          expires_at: expiresAt,
          auto_renewing: true,
          updated_at: new Date().toISOString(),
        }).eq('revenuecat_app_user_id', appUserId);
        break;
      }

      case 'EXPIRATION': {
        await supabase.from('subscriptions').update({
          status: 'expired',
          auto_renewing: false,
          updated_at: new Date().toISOString(),
        }).eq('revenuecat_app_user_id', appUserId);

        if (userId) {
          await downgradeToFree(supabase, userId);
        }
        break;
      }

      case 'BILLING_ISSUE': {
        await supabase.from('subscriptions').update({
          status: 'billing_issue',
          updated_at: new Date().toISOString(),
        }).eq('revenuecat_app_user_id', appUserId);
        break;
      }

      case 'PRODUCT_CHANGE': {
        const newProductId: string = event.new_product_id ?? productId;
        const plan = planFromProductId(newProductId);
        const limits = PLAN_ENTITLEMENTS[plan] ?? PLAN_ENTITLEMENTS.free;
        const expiresAt = expiresAtMs ? new Date(expiresAtMs).toISOString() : null;

        await supabase.from('subscriptions').update({
          plan,
          product_id: newProductId,
          billing_period: billingPeriodFromProductId(newProductId),
          entitlement: entitlementIds[0] ?? plan,
          expires_at: expiresAt,
          status: 'active',
          updated_at: new Date().toISOString(),
        }).eq('revenuecat_app_user_id', appUserId);

        if (userId) {
          await upsertEntitlement(supabase, userId, limits);
        }
        break;
      }

      case 'NON_RENEWING_PURCHASE': {
        if (CREDIT_PRODUCTS[productId]) {
          await handleCreditPurchase(supabase, userId, productId, transactionId);
        }
        break;
      }

      case 'SUBSCRIPTION_PAUSED': {
        await supabase.from('subscriptions').update({
          status: 'paused',
          updated_at: new Date().toISOString(),
        }).eq('revenuecat_app_user_id', appUserId);
        break;
      }

      case 'TRANSFER': {
        const newUserId: string = event.new_app_user_id ?? '';
        if (newUserId && userId) {
          await supabase.from('subscriptions')
            .update({ user_id: newUserId, revenuecat_app_user_id: newUserId, updated_at: new Date().toISOString() })
            .eq('revenuecat_app_user_id', appUserId);
        }
        break;
      }

      default:
        break;
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    console.error('RevenueCat webhook error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});

async function handleSubscriptionPurchase(
  supabase: ReturnType<typeof createClient>,
  userId: string | null,
  appUserId: string,
  productId: string,
  platform: string,
  purchasedAtMs: number | null,
  expiresAtMs: number | null,
  status: string,
  entitlementIds: string[],
) {
  const plan = planFromProductId(productId);
  const limits = PLAN_ENTITLEMENTS[plan] ?? PLAN_ENTITLEMENTS.free;
  const startedAt = purchasedAtMs ? new Date(purchasedAtMs).toISOString() : new Date().toISOString();
  const expiresAt = expiresAtMs ? new Date(expiresAtMs).toISOString() : null;

  const { data: existing } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('revenuecat_app_user_id', appUserId)
    .maybeSingle();

  const now = new Date().toISOString();
  const subData = {
    user_id: userId,
    revenuecat_app_user_id: appUserId,
    entitlement: entitlementIds[0] ?? plan,
    plan,
    product_id: productId,
    billing_period: billingPeriodFromProductId(productId),
    platform,
    status,
    started_at: startedAt,
    expires_at: expiresAt,
    auto_renewing: true,
    updated_at: now,
  };

  if (existing) {
    await supabase.from('subscriptions').update(subData).eq('id', existing.id);
  } else {
    await supabase.from('subscriptions').insert({ ...subData, created_at: now });
  }

  if (userId) {
    await upsertEntitlement(supabase, userId, limits);
    if (limits.monthly_credit_grant > 0) {
      await grantMonthlyCredits(supabase, userId, limits.monthly_credit_grant, plan, appUserId);
    }
  }
}

async function handleCreditPurchase(
  supabase: ReturnType<typeof createClient>,
  userId: string | null,
  productId: string,
  transactionId: string,
) {
  if (!userId) return;

  const creditAmount = CREDIT_PRODUCTS[productId];
  if (!creditAmount) return;

  const { data: existing } = await supabase
    .from('credit_transactions')
    .select('id')
    .eq('revenuecat_transaction_id', transactionId)
    .maybeSingle();

  if (existing) return;

  await supabase.rpc('add_credits', {
    p_user_id: userId,
    p_amount: creditAmount,
    p_type: 'purchase',
    p_reason: `Kredi satın alındı: ${productId}`,
    p_product_id: productId,
    p_transaction_id: transactionId,
  }).catch(async () => {
    const { data: wallet } = await supabase
      .from('credit_wallets')
      .select('balance, lifetime_purchased')
      .eq('user_id', userId)
      .maybeSingle();

    if (wallet) {
      await supabase.from('credit_wallets').update({
        balance: (wallet.balance ?? 0) + creditAmount,
        lifetime_purchased: (wallet.lifetime_purchased ?? 0) + creditAmount,
        updated_at: new Date().toISOString(),
      }).eq('user_id', userId);
    } else {
      await supabase.from('credit_wallets').insert({
        user_id: userId,
        balance: creditAmount,
        lifetime_purchased: creditAmount,
        lifetime_spent: 0,
      });
    }

    await supabase.from('credit_transactions').insert({
      user_id: userId,
      type: 'purchase',
      amount: creditAmount,
      reason: `Kredi satın alındı: ${productId}`,
      product_id: productId,
      revenuecat_transaction_id: transactionId,
    });
  });
}

async function grantMonthlyCredits(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  amount: number,
  plan: string,
  appUserId: string,
) {
  const { data: wallet } = await supabase
    .from('credit_wallets')
    .select('balance, lifetime_purchased')
    .eq('user_id', userId)
    .maybeSingle();

  if (wallet) {
    await supabase.from('credit_wallets').update({
      balance: (wallet.balance ?? 0) + amount,
      lifetime_purchased: (wallet.lifetime_purchased ?? 0) + amount,
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId);
  } else {
    await supabase.from('credit_wallets').insert({
      user_id: userId,
      balance: amount,
      lifetime_purchased: amount,
      lifetime_spent: 0,
    });
  }

  await supabase.from('credit_transactions').insert({
    user_id: userId,
    type: 'monthly_grant',
    amount,
    reason: `Aylık kredi: ${plan} paketi`,
  });

  await supabase.from('subscriptions').update({
    last_credit_grant_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('revenuecat_app_user_id', appUserId);
}

async function upsertEntitlement(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  limits: PlanLimits,
) {
  const { data: existing } = await supabase
    .from('user_entitlements')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  const data = {
    user_id: userId,
    plan: limits.plan,
    max_active_products: limits.max_active_products,
    daily_story_limit: limits.daily_story_limit,
    monthly_credit_grant: limits.monthly_credit_grant,
    active_instagram_product_limit: limits.active_instagram_product_limit,
    discovery_multiplier: limits.discovery_multiplier,
    can_use_advanced_stats: limits.can_use_advanced_stats,
    can_use_store_badge: limits.can_use_store_badge,
    store_badge_label: limits.store_badge_label,
    can_use_homepage_showcase: limits.can_use_homepage_showcase,
    support_priority: limits.support_priority,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    await supabase.from('user_entitlements').update(data).eq('user_id', userId);
  } else {
    await supabase.from('user_entitlements').insert(data);
  }
}

async function downgradeToFree(supabase: ReturnType<typeof createClient>, userId: string) {
  await upsertEntitlement(supabase, userId, PLAN_ENTITLEMENTS.free);
}
