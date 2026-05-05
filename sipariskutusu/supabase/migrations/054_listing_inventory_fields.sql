-- Migration: 054_listing_inventory_fields.sql
-- Adds stok / envanter takip alanlarını listings tablosuna ekler.
-- Mevcut yapı korunur, yalnızca yeni opsiyonel alanlar eklenir.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS low_stock_threshold     integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS stock_tracking_enabled  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_sold_out             boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_visible              boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_stock_update_at    timestamptz;

-- Negatif stok önleme
ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_stock_non_negative;
ALTER TABLE public.listings
  ADD CONSTRAINT listings_stock_non_negative CHECK (stock >= 0);

ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_low_stock_threshold_non_negative;
ALTER TABLE public.listings
  ADD CONSTRAINT listings_low_stock_threshold_non_negative CHECK (low_stock_threshold >= 0);

-- Otomatik is_sold_out & last_stock_update_at trigger
CREATE OR REPLACE FUNCTION public.listings_inventory_sync()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.stock_tracking_enabled THEN
    NEW.is_sold_out := COALESCE(NEW.stock, 0) <= 0;
  ELSE
    NEW.is_sold_out := false;
  END IF;

  IF (TG_OP = 'INSERT')
     OR (NEW.stock IS DISTINCT FROM OLD.stock)
     OR (NEW.stock_tracking_enabled IS DISTINCT FROM OLD.stock_tracking_enabled)
     OR (NEW.low_stock_threshold IS DISTINCT FROM OLD.low_stock_threshold) THEN
    NEW.last_stock_update_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listings_inventory_sync_trigger ON public.listings;
CREATE TRIGGER listings_inventory_sync_trigger
BEFORE INSERT OR UPDATE OF stock, stock_tracking_enabled, low_stock_threshold
ON public.listings
FOR EACH ROW
EXECUTE FUNCTION public.listings_inventory_sync();

-- İndeksler: hızlı stok filtreleme
CREATE INDEX IF NOT EXISTS listings_seller_inventory_idx
  ON public.listings(seller_id, stock_tracking_enabled, is_sold_out);

-- RLS NOTU:
-- listings tablosunun mevcut owner-update politikaları (seller_id / owner_id eşleşmesi)
-- stok alanlarını da kapsadığı için BURADA EK BIR UPDATE POLICY EKLEMIYORUZ.
-- En az ayrıcalık (least-privilege) prensibi gereği yeni geniş kapsamlı bir
-- policy eklemek mevcut sıkı kuralları gevşetebilir; uygulama tarafında
-- updateListingStock zaten .or(seller_id.eq.uid,owner_id.eq.uid) ile filtreliyor
-- ve mevcut RLS bu güncellemeyi yetkisiz isteklerde reddedecektir.

COMMENT ON COLUMN public.listings.low_stock_threshold     IS 'Az kaldı uyarısı için eşik (varsayılan 3)';
COMMENT ON COLUMN public.listings.stock_tracking_enabled  IS 'Satıcı stok takibini açık mı tutuyor';
COMMENT ON COLUMN public.listings.is_sold_out             IS 'Stok sıfır + takip açıksa otomatik true';
COMMENT ON COLUMN public.listings.is_visible              IS 'Satışta göster / gizle anahtarı';
COMMENT ON COLUMN public.listings.last_stock_update_at    IS 'Son stok güncelleme zamanı';
