-- RevenueCat + Entitlement + Credit System Tables
-- Migration: 053_revenuecat_tables.sql

-- ─── subscriptions ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  revenuecat_app_user_id  text NOT NULL,
  entitlement             text,
  plan                    text NOT NULL DEFAULT 'free',
  product_id              text,
  billing_period          text,
  platform                text,
  status                  text NOT NULL DEFAULT 'active',
  started_at              timestamptz,
  expires_at              timestamptz,
  auto_renewing           boolean DEFAULT true,
  last_credit_grant_at    timestamptz,
  raw_payload             jsonb,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own subscription" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access subscriptions" ON public.subscriptions
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS subscriptions_revenuecat_app_user_id_idx ON public.subscriptions(revenuecat_app_user_id);

-- ─── user_entitlements ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_entitlements (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                       uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan                          text NOT NULL DEFAULT 'free',
  max_active_products           integer NOT NULL DEFAULT 10,
  daily_story_limit             integer NOT NULL DEFAULT 1,
  monthly_credit_grant          integer NOT NULL DEFAULT 0,
  active_instagram_product_limit integer NOT NULL DEFAULT 10,
  discovery_multiplier          numeric(4,2) NOT NULL DEFAULT 1.0,
  can_use_advanced_stats        boolean NOT NULL DEFAULT false,
  can_use_store_badge           boolean NOT NULL DEFAULT false,
  store_badge_label             text,
  can_use_homepage_showcase     boolean NOT NULL DEFAULT false,
  support_priority              text NOT NULL DEFAULT 'normal',
  updated_at                    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own entitlements" ON public.user_entitlements
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access entitlements" ON public.user_entitlements
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS user_entitlements_user_id_idx ON public.user_entitlements(user_id);

-- ─── credit_wallets ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.credit_wallets (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  balance             integer NOT NULL DEFAULT 0,
  lifetime_purchased  integer NOT NULL DEFAULT 0,
  lifetime_spent      integer NOT NULL DEFAULT 0,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own wallet" ON public.credit_wallets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access wallets" ON public.credit_wallets
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS credit_wallets_user_id_idx ON public.credit_wallets(user_id);

-- ─── credit_transactions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type                      text NOT NULL,
  amount                    integer NOT NULL,
  reason                    text,
  product_id                text,
  revenuecat_transaction_id text,
  created_at                timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own transactions" ON public.credit_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access transactions" ON public.credit_transactions
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS credit_transactions_user_id_idx ON public.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS credit_transactions_rc_tx_idx ON public.credit_transactions(revenuecat_transaction_id);

-- ─── revenuecat_events ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.revenuecat_events (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id                 text NOT NULL UNIQUE,
  app_user_id              text NOT NULL,
  user_id                  uuid,
  event_type               text NOT NULL,
  product_id               text,
  entitlement_id           text,
  transaction_id           text,
  original_transaction_id  text,
  raw_payload              jsonb NOT NULL,
  created_at               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.revenuecat_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access rc_events" ON public.revenuecat_events
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS revenuecat_events_event_id_idx ON public.revenuecat_events(event_id);
CREATE INDEX IF NOT EXISTS revenuecat_events_app_user_id_idx ON public.revenuecat_events(app_user_id);

-- ─── boosts ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.boosts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        text NOT NULL,
  product_id  text,
  story_id    uuid,
  store_id    uuid,
  credit_cost integer NOT NULL DEFAULT 0,
  starts_at   timestamptz NOT NULL DEFAULT now(),
  ends_at     timestamptz NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.boosts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own boosts" ON public.boosts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own boosts" ON public.boosts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access boosts" ON public.boosts
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS boosts_user_id_idx ON public.boosts(user_id);
CREATE INDEX IF NOT EXISTS boosts_is_active_idx ON public.boosts(is_active);
CREATE INDEX IF NOT EXISTS boosts_ends_at_idx ON public.boosts(ends_at);

-- ─── usage_counters ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.usage_counters (
  id                                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date                              date NOT NULL DEFAULT CURRENT_DATE,
  published_products_count          integer NOT NULL DEFAULT 0,
  stories_created_count             integer NOT NULL DEFAULT 0,
  instagram_products_published_count integer NOT NULL DEFAULT 0,
  created_at                        timestamptz NOT NULL DEFAULT now(),
  updated_at                        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own usage" ON public.usage_counters
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access usage" ON public.usage_counters
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS usage_counters_user_date_idx ON public.usage_counters(user_id, date);

-- ─── Helper: upsert free entitlement for new users ────────────────────────────
CREATE OR REPLACE FUNCTION public.ensure_user_entitlement(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_entitlements (user_id, plan, max_active_products, daily_story_limit, monthly_credit_grant, active_instagram_product_limit, discovery_multiplier, can_use_advanced_stats, can_use_store_badge, store_badge_label, can_use_homepage_showcase, support_priority)
  VALUES (p_user_id, 'free', 10, 1, 0, 10, 1.0, false, false, null, false, 'normal')
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.credit_wallets (user_id, balance, lifetime_purchased, lifetime_spent)
  VALUES (p_user_id, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;
