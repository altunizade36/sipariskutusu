-- ============================================================
-- SİPARİŞKUTUSU — TAM VERİTABANI ŞEMASI
-- Supabase SQL Editor'da bir kere çalıştırın.
-- ============================================================

-- Eski migration'dan kalan çakışan tabloları temizle (yeni şemaya geçiş)
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.conversation_members CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;
DROP TABLE IF EXISTS public.cart_items CASCADE;
DROP TABLE IF EXISTS public.carts CASCADE;
DROP TABLE IF EXISTS public.order_items CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.favorites CASCADE;
DROP TABLE IF EXISTS public.product_images CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.seller_profiles CASCADE;
DROP TABLE IF EXISTS public.instagram_accounts CASCADE;
DROP TABLE IF EXISTS public.user_sessions CASCADE;
DROP TABLE IF EXISTS public.security_events CASCADE;

-- Uzantılar
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";       -- Metin araması için
CREATE EXTENSION IF NOT EXISTS "unaccent";       -- Türkçe arama için

-- ============================================================
-- 1. KULLANICILAR (profiles)
-- auth.users Supabase tarafından yönetilir; biz uzatıyoruz.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username       TEXT UNIQUE,
  full_name      TEXT,
  avatar_url     TEXT,
  phone          TEXT,
  city           TEXT,
  bio            TEXT,
  is_seller      BOOLEAN NOT NULL DEFAULT false,
  is_verified    BOOLEAN NOT NULL DEFAULT false,
  rating         NUMERIC(3,2) DEFAULT 0,
  rating_count   INT DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Yeni kullanıcı kaydolduğunda otomatik profil oluştur
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 2. MAĞAZA PROFİLLERİ
-- ============================================================
CREATE TABLE IF NOT EXISTS public.stores (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  username       TEXT UNIQUE,
  description    TEXT,
  avatar_url     TEXT,
  cover_url      TEXT,
  city           TEXT,
  email          TEXT,
  phone          TEXT,
  whatsapp       TEXT,
  default_stock  INT NOT NULL DEFAULT 1,
  delivery_info  TEXT NOT NULL DEFAULT 'Satici ile gorusulur',
  website        TEXT,
  category_id    TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  is_verified    BOOLEAN NOT NULL DEFAULT false,
  follower_count INT DEFAULT 0,
  rating         NUMERIC(3,2) DEFAULT 0,
  rating_count   INT DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. INSTAGRAM HESAP BAĞLANTILARI
-- ============================================================
CREATE TABLE IF NOT EXISTS public.instagram_accounts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  store_id          UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  instagram_user_id TEXT NOT NULL UNIQUE,
  username          TEXT NOT NULL,
  access_token      TEXT NOT NULL,          -- Şifreli saklanmalı (Vault)
  token_expires_at  TIMESTAMPTZ,
  followers_count   INT DEFAULT 0,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  connected_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at    TIMESTAMPTZ
);

-- ============================================================
-- 4. KATEGORİLER
-- ============================================================
CREATE TABLE IF NOT EXISTS public.categories (
  id          TEXT PRIMARY KEY,             -- 'elektronik', 'giyim' gibi slug
  name        TEXT NOT NULL,
  icon        TEXT,
  parent_id   TEXT REFERENCES public.categories(id),
  sort_order  INT DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true
);

-- Temel kategorileri doldur
INSERT INTO public.categories (id, name, icon, sort_order) VALUES
  ('elektronik',   'Elektronik',     'laptop-outline',     1),
  ('giyim',        'Giyim',          'shirt-outline',      2),
  ('ev-yasam',     'Ev & Yaşam',     'home-outline',       3),
  ('anne-bebek',   'Anne & Bebek',   'heart-outline',      4),
  ('spor',         'Spor',           'bicycle-outline',    5),
  ('kitap',        'Kitap & Hobi',   'book-outline',       6),
  ('otomotiv',     'Otomotiv',       'car-outline',        7),
  ('diger',        'Diğer',          'grid-outline',       8)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 5. İLANLAR (listings)
-- ============================================================
CREATE TYPE listing_condition AS ENUM ('new', 'like_new', 'good', 'fair', 'poor');
CREATE TYPE listing_status AS ENUM ('active', 'sold', 'paused', 'deleted');
CREATE TYPE delivery_type AS ENUM ('shipping', 'hand_delivery', 'both');

CREATE TABLE IF NOT EXISTS public.listings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  store_id        UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  price           NUMERIC(10,2) NOT NULL,
  original_price  NUMERIC(10,2),
  currency        TEXT NOT NULL DEFAULT 'TRY',
  category_id     TEXT REFERENCES public.categories(id),
  condition       listing_condition NOT NULL DEFAULT 'good',
  status          listing_status NOT NULL DEFAULT 'active',
  delivery        delivery_type NOT NULL DEFAULT 'both',
  city            TEXT,
  district        TEXT,
  stock           INT NOT NULL DEFAULT 1,
  view_count      INT DEFAULT 0,
  favorite_count  INT DEFAULT 0,
  is_negotiable   BOOLEAN DEFAULT false,
  search_vector   TSVECTOR,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tam metin arama indeksi
CREATE INDEX IF NOT EXISTS listings_search_idx ON public.listings USING gin(search_vector);
CREATE INDEX IF NOT EXISTS listings_seller_idx ON public.listings(seller_id);
CREATE INDEX IF NOT EXISTS listings_category_idx ON public.listings(category_id);
CREATE INDEX IF NOT EXISTS listings_status_idx ON public.listings(status);
CREATE INDEX IF NOT EXISTS listings_price_idx ON public.listings(price);

-- Arama vektörünü otomatik güncelle
CREATE OR REPLACE FUNCTION listings_search_vector_trigger()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector := to_tsvector('turkish',
    coalesce(NEW.title, '') || ' ' ||
    coalesce(NEW.description, '') || ' ' ||
    coalesce(NEW.city, '')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listings_search_vector_update ON public.listings;
CREATE TRIGGER listings_search_vector_update
  BEFORE INSERT OR UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION listings_search_vector_trigger();

-- ============================================================
-- 6. İLAN GÖRSELLERİ
-- ============================================================
CREATE TABLE IF NOT EXISTS public.listing_images (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  sort_order  INT DEFAULT 0,
  is_cover    BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS listing_images_listing_idx ON public.listing_images(listing_id);

-- ============================================================
-- 7. FAVORİLER
-- ============================================================
CREATE TABLE IF NOT EXISTS public.favorites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  listing_id  UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, listing_id)
);

CREATE INDEX IF NOT EXISTS favorites_user_idx ON public.favorites(user_id);

-- ============================================================
-- 8. SİPARİŞLER
-- ============================================================
CREATE TYPE order_status AS ENUM (
  'pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'completed', 'cancelled', 'refunded'
);

CREATE TABLE IF NOT EXISTS public.orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id        UUID NOT NULL REFERENCES public.profiles(id),
  seller_id       UUID NOT NULL REFERENCES public.profiles(id),
  store_id        UUID REFERENCES public.stores(id),
  status          order_status NOT NULL DEFAULT 'pending',
  subtotal        NUMERIC(10,2) NOT NULL,
  shipping_fee    NUMERIC(10,2) NOT NULL DEFAULT 0,
  total           NUMERIC(10,2) NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'TRY',
  shipping_name   TEXT,
  shipping_phone  TEXT,
  shipping_addr   TEXT,
  shipping_city   TEXT,
  note            TEXT,
  tracking_number TEXT,
  paid_at         TIMESTAMPTZ,
  shipped_at      TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS orders_buyer_idx ON public.orders(buyer_id);
CREATE INDEX IF NOT EXISTS orders_seller_idx ON public.orders(seller_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON public.orders(status);

-- ============================================================
-- 9. SİPARİŞ KALEMLERİ
-- ============================================================
CREATE TABLE IF NOT EXISTS public.order_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  listing_id  UUID REFERENCES public.listings(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  price       NUMERIC(10,2) NOT NULL,
  quantity    INT NOT NULL DEFAULT 1,
  image_url   TEXT,
  variant     TEXT
);

-- ============================================================
-- 10. SEPET
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cart_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  listing_id  UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  quantity    INT NOT NULL DEFAULT 1,
  variant     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, listing_id, variant)
);

CREATE INDEX IF NOT EXISTS cart_items_user_idx ON public.cart_items(user_id);

-- ============================================================
-- 11. ADRESLER
-- ============================================================
CREATE TABLE IF NOT EXISTS public.addresses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title        TEXT NOT NULL DEFAULT 'Ev',
  full_name    TEXT NOT NULL,
  phone        TEXT NOT NULL,
  address_line TEXT NOT NULL,
  district     TEXT,
  city         TEXT NOT NULL,
  postal_code  TEXT,
  is_default   BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS addresses_user_idx ON public.addresses(user_id);

-- ============================================================
-- 12. MESAJLAR (konuşmalar)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id      UUID REFERENCES public.listings(id) ON DELETE SET NULL,
  buyer_id        UUID NOT NULL REFERENCES public.profiles(id),
  seller_id       UUID NOT NULL REFERENCES public.profiles(id),
  last_message    TEXT,
  last_message_at TIMESTAMPTZ,
  buyer_unread    INT DEFAULT 0,
  seller_unread   INT DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(listing_id, buyer_id, seller_id)
);

CREATE INDEX IF NOT EXISTS conversations_buyer_idx   ON public.conversations(buyer_id);
CREATE INDEX IF NOT EXISTS conversations_seller_idx  ON public.conversations(seller_id);

CREATE TABLE IF NOT EXISTS public.messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES public.profiles(id),
  body            TEXT NOT NULL,
  attachment_url  TEXT,
  is_read         BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS messages_conv_idx ON public.messages(conversation_id);

-- ============================================================
-- 13. DEĞERLENDİRMELER
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES public.orders(id),
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id),
  reviewed_id UUID NOT NULL REFERENCES public.profiles(id),
  rating      INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(order_id, reviewer_id)
);

-- Değerlendirme eklenince profil puanını güncelle
CREATE OR REPLACE FUNCTION update_profile_rating()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.profiles
  SET
    rating = (SELECT AVG(rating) FROM public.reviews WHERE reviewed_id = NEW.reviewed_id),
    rating_count = (SELECT COUNT(*) FROM public.reviews WHERE reviewed_id = NEW.reviewed_id)
  WHERE id = NEW.reviewed_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_review_created ON public.reviews;
CREATE TRIGGER on_review_created
  AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION update_profile_rating();

-- ============================================================
-- 14. BİLDİRİMLER
-- ============================================================
CREATE TYPE notification_type AS ENUM (
  'order_placed', 'order_shipped', 'order_delivered',
  'new_message', 'new_review', 'price_drop', 'favorite_sold',
  'system'
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type        notification_type NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT,
  data        JSONB,
  is_read     BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications(user_id, is_read);

-- ============================================================
-- 15. HİKAYELER (Instagram benzeri)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.stories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  store_id    UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  listing_id  UUID REFERENCES public.listings(id) ON DELETE SET NULL,
  image_url   TEXT NOT NULL,
  caption     TEXT,
  view_count  INT DEFAULT 0,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 16. GÜVENLİK OLAYLARI
-- ============================================================
CREATE TABLE IF NOT EXISTS public.security_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  severity    TEXT NOT NULL DEFAULT 'low',
  description TEXT,
  ip_address  TEXT,
  device_info TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS security_events_user_idx ON public.security_events(user_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) — KİM NE GÖREBİLİR
-- ============================================================

ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_images    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events   ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "Herkes profil okuyabilir"       ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Kendi profilini güncelleyebilir" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- STORES
CREATE POLICY "Herkes mağaza okuyabilir"       ON public.stores FOR SELECT USING (is_active = true);
CREATE POLICY "Sahip mağaza yönetir"           ON public.stores FOR ALL USING (auth.uid() = seller_id);

-- INSTAGRAM
CREATE POLICY "Kendi instagram hesabını yönetir" ON public.instagram_accounts FOR ALL USING (auth.uid() = user_id);

-- LISTINGS
CREATE POLICY "Aktif ilanları herkes okur"     ON public.listings FOR SELECT USING (status = 'active');
CREATE POLICY "Satıcı kendi ilanlarını yönetir" ON public.listings FOR ALL USING (auth.uid() = seller_id);

-- LISTING IMAGES
CREATE POLICY "Herkes ilan görsellerini okur"  ON public.listing_images FOR SELECT USING (true);
CREATE POLICY "Satıcı kendi görsellerini yönetir" ON public.listing_images
  FOR ALL USING (
    auth.uid() = (SELECT seller_id FROM public.listings WHERE id = listing_id)
  );

-- FAVORITES
CREATE POLICY "Kendi favorilerini yönetir"     ON public.favorites FOR ALL USING (auth.uid() = user_id);

-- ORDERS
CREATE POLICY "Alıcı/satıcı kendi siparişini okur" ON public.orders
  FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
CREATE POLICY "Alıcı sipariş oluşturur"        ON public.orders FOR INSERT WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Satıcı sipariş günceller"       ON public.orders FOR UPDATE USING (auth.uid() = seller_id);

-- ORDER ITEMS
CREATE POLICY "Sipariş sahibi kalemleri görür" ON public.order_items
  FOR SELECT USING (
    auth.uid() = (SELECT buyer_id FROM public.orders WHERE id = order_id)
    OR
    auth.uid() = (SELECT seller_id FROM public.orders WHERE id = order_id)
  );
CREATE POLICY "Sipariş oluşturucusu kalem ekler" ON public.order_items
  FOR INSERT WITH CHECK (
    auth.uid() = (SELECT buyer_id FROM public.orders WHERE id = order_id)
  );

-- CART
CREATE POLICY "Kendi sepetini yönetir"         ON public.cart_items FOR ALL USING (auth.uid() = user_id);

-- ADDRESSES
CREATE POLICY "Kendi adreslerini yönetir"      ON public.addresses FOR ALL USING (auth.uid() = user_id);

-- CONVERSATIONS
CREATE POLICY "Konuşma tarafları okuyabilir"   ON public.conversations
  FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
CREATE POLICY "Alıcı konuşma başlatır"         ON public.conversations
  FOR INSERT WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Taraflar konuşmayı güncelleyebilir" ON public.conversations
  FOR UPDATE USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- MESSAGES
CREATE POLICY "Konuşma tarafları mesaj okur"   ON public.messages
  FOR SELECT USING (
    auth.uid() = (SELECT buyer_id FROM public.conversations WHERE id = conversation_id)
    OR
    auth.uid() = (SELECT seller_id FROM public.conversations WHERE id = conversation_id)
  );
CREATE POLICY "Konuşma tarafları mesaj gönderir" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND (
      auth.uid() = (SELECT buyer_id FROM public.conversations WHERE id = conversation_id)
      OR
      auth.uid() = (SELECT seller_id FROM public.conversations WHERE id = conversation_id)
    )
  );

-- REVIEWS
CREATE POLICY "Herkes değerlendirme okur"      ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Değerlendirme sahibi ekler"     ON public.reviews
  FOR INSERT WITH CHECK (auth.uid() = reviewer_id);

-- NOTIFICATIONS
CREATE POLICY "Kendi bildirimlerini okur"      ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Kendi bildirimlerini günceller" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- STORIES
CREATE POLICY "Herkes hikaye okur"             ON public.stories
  FOR SELECT USING (expires_at > NOW());
CREATE POLICY "Kendi hikayelerini yönetir"     ON public.stories
  FOR ALL USING (auth.uid() = user_id);

-- SECURITY EVENTS
CREATE POLICY "Kendi güvenlik olaylarını okur" ON public.security_events
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- STORAGE BUCKET TANIMLARI
-- Bu komutları Storage > Buckets menüsünde de yapabilirsiniz.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('listing-images',  'listing-images',  true,  5242880,  ARRAY['image/jpeg','image/png','image/webp']),
  ('avatars',         'avatars',         true,  2097152,  ARRAY['image/jpeg','image/png','image/webp']),
  ('store-banners',   'store-banners',   true,  5242880,  ARRAY['image/jpeg','image/png','image/webp']),
  ('story-images',    'story-images',    true,  10485760, ARRAY['image/jpeg','image/png','image/webp','video/mp4']),
  ('message-files',   'message-files',   false, 10485760, ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS
CREATE POLICY "Herkes ilan görseli okur"
  ON storage.objects FOR SELECT USING (bucket_id = 'listing-images');
CREATE POLICY "Giriş yapan ilan görseli yükler"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'listing-images' AND auth.uid() IS NOT NULL);
CREATE POLICY "Kendi ilan görselini siler"
  ON storage.objects FOR DELETE USING (bucket_id = 'listing-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Herkes avatar okur"
  ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Kendi avatarını yükler"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Kendi avatarını siler"
  ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Herkes mağaza banner okur"
  ON storage.objects FOR SELECT USING (bucket_id = 'store-banners');
CREATE POLICY "Mağaza sahibi banner yükler"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'store-banners' AND auth.uid() IS NOT NULL);

CREATE POLICY "Herkes hikaye görsellerini okur"
  ON storage.objects FOR SELECT USING (bucket_id = 'story-images');
CREATE POLICY "Giriş yapan hikaye yükler"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'story-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Konuşma tarafı dosya okur"
  ON storage.objects FOR SELECT USING (bucket_id = 'message-files' AND auth.uid() IS NOT NULL);
CREATE POLICY "Giriş yapan mesaj dosyası yükler"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'message-files' AND auth.uid() IS NOT NULL);

-- ============================================================
-- REALTİME (canlı güncellemeler) — hangi tablolar anlık olsun
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
