-- ============================================================
-- 013_data_storage_hardening.sql
-- SQL veri tutarliligi ve performans sertlestirmesi
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'orders'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'orders_subtotal_non_negative'
    ) THEN
      ALTER TABLE public.orders
      ADD CONSTRAINT orders_subtotal_non_negative CHECK (subtotal >= 0);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'orders_shipping_fee_non_negative'
    ) THEN
      ALTER TABLE public.orders
      ADD CONSTRAINT orders_shipping_fee_non_negative CHECK (shipping_fee >= 0);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'orders_total_non_negative'
    ) THEN
      ALTER TABLE public.orders
      ADD CONSTRAINT orders_total_non_negative CHECK (total >= 0);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'orders_total_matches_subtotal_plus_shipping'
    ) THEN
      ALTER TABLE public.orders
      ADD CONSTRAINT orders_total_matches_subtotal_plus_shipping CHECK (total = subtotal + shipping_fee);
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'order_items'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'order_items_price_non_negative'
    ) THEN
      ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_price_non_negative CHECK (price >= 0);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'order_items_quantity_positive'
    ) THEN
      ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_quantity_positive CHECK (quantity > 0);
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'listings'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'listings_price_non_negative'
    ) THEN
      ALTER TABLE public.listings
      ADD CONSTRAINT listings_price_non_negative CHECK (price >= 0);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'listings_stock_non_negative'
    ) THEN
      ALTER TABLE public.listings
      ADD CONSTRAINT listings_stock_non_negative CHECK (stock >= 0);
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS orders_created_at_idx
  ON public.orders(created_at DESC);

CREATE INDEX IF NOT EXISTS order_items_order_id_idx
  ON public.order_items(order_id);

CREATE INDEX IF NOT EXISTS favorites_listing_idx
  ON public.favorites(listing_id);

CREATE INDEX IF NOT EXISTS listings_active_created_idx
  ON public.listings(status, created_at DESC)
  WHERE status = 'active';
