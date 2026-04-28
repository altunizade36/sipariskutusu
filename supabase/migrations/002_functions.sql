-- ============================================================
-- 002_functions.sql — Yardımcı PostgreSQL fonksiyonları
-- Supabase SQL Editor'da çalıştırın (001_schema.sql'den sonra)
-- ============================================================

-- İlan görüntüleme sayısı artır
CREATE OR REPLACE FUNCTION increment_view_count(listing_id UUID)
RETURNS VOID LANGUAGE SQL SECURITY DEFINER AS $$
  UPDATE listings SET view_count = view_count + 1 WHERE id = listing_id;
$$;

-- Favori sayısı artır
CREATE OR REPLACE FUNCTION increment_favorite_count(listing_id UUID)
RETURNS VOID LANGUAGE SQL SECURITY DEFINER AS $$
  UPDATE listings SET favorite_count = favorite_count + 1 WHERE id = listing_id;
$$;

-- Favori sayısı azalt
CREATE OR REPLACE FUNCTION decrement_favorite_count(listing_id UUID)
RETURNS VOID LANGUAGE SQL SECURITY DEFINER AS $$
  UPDATE listings SET favorite_count = GREATEST(favorite_count - 1, 0) WHERE id = listing_id;
$$;

-- Okunmamış mesaj sayısı artır
CREATE OR REPLACE FUNCTION increment_unread(conv_id UUID, field TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  EXECUTE format(
    'UPDATE conversations SET %I = %I + 1 WHERE id = $1',
    field, field
  ) USING conv_id;
END;
$$;

-- Mağaza takipçi sayısı artır/azalt
CREATE OR REPLACE FUNCTION increment_store_followers(store_id UUID)
RETURNS VOID LANGUAGE SQL SECURITY DEFINER AS $$
  UPDATE stores SET follower_count = follower_count + 1 WHERE id = store_id;
$$;

CREATE OR REPLACE FUNCTION decrement_store_followers(store_id UUID)
RETURNS VOID LANGUAGE SQL SECURITY DEFINER AS $$
  UPDATE stores SET follower_count = GREATEST(follower_count - 1, 0) WHERE id = store_id;
$$;

-- Arama — tam metin + fiyat + şehir
CREATE OR REPLACE FUNCTION search_listings(
  q TEXT DEFAULT NULL,
  cat_id TEXT DEFAULT NULL,
  min_p NUMERIC DEFAULT NULL,
  max_p NUMERIC DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  page_num INT DEFAULT 0,
  page_size INT DEFAULT 20
)
RETURNS TABLE (
  id UUID, title TEXT, price NUMERIC, city TEXT, condition TEXT,
  created_at TIMESTAMPTZ, cover_url TEXT, seller_name TEXT, rank REAL
)
LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.title,
    l.price,
    l.city,
    l.condition::TEXT,
    l.created_at,
    (SELECT url FROM listing_images WHERE listing_id = l.id AND is_cover = true LIMIT 1) AS cover_url,
    p.full_name AS seller_name,
    CASE WHEN q IS NOT NULL THEN ts_rank(l.search_vector, to_tsquery('turkish', q)) ELSE 1.0 END AS rank
  FROM listings l
  LEFT JOIN profiles p ON p.id = l.seller_id
  WHERE
    l.status = 'active'
    AND (q IS NULL OR l.search_vector @@ to_tsquery('turkish', q))
    AND (cat_id IS NULL OR l.category_id = cat_id)
    AND (min_p IS NULL OR l.price >= min_p)
    AND (max_p IS NULL OR l.price <= max_p)
    AND (p_city IS NULL OR l.city ILIKE '%' || p_city || '%')
  ORDER BY rank DESC, l.created_at DESC
  LIMIT page_size OFFSET page_num * page_size;
END;
$$;

-- Bildirim oluştur (sipariş durumu değiştiğinde tetiklenir)
CREATE OR REPLACE FUNCTION notify_order_status_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status <> NEW.status THEN
    -- Alıcıya bildir
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      NEW.buyer_id,
      CASE NEW.status
        WHEN 'confirmed'  THEN 'order_placed'::notification_type
        WHEN 'shipped'    THEN 'order_shipped'::notification_type
        WHEN 'delivered'  THEN 'order_delivered'::notification_type
        ELSE 'system'::notification_type
      END,
      CASE NEW.status
        WHEN 'confirmed'  THEN 'Siparişiniz onaylandı'
        WHEN 'shipped'    THEN 'Siparişiniz kargoya verildi'
        WHEN 'delivered'  THEN 'Siparişiniz teslim edildi'
        WHEN 'cancelled'  THEN 'Siparişiniz iptal edildi'
        ELSE 'Sipariş güncellendi'
      END,
      NULL,
      jsonb_build_object('order_id', NEW.id, 'status', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_order_status_change ON public.orders;
CREATE TRIGGER on_order_status_change
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION notify_order_status_change();

-- Süresi dolmuş hikayeleri temizle (pg_cron ile günlük çalıştırın)
-- SELECT cron.schedule('clean-stories', '0 3 * * *', 'DELETE FROM stories WHERE expires_at < NOW()');
