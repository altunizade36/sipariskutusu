-- ============================================================
-- 003_chat_linkage_system.sql
-- Chat system integration with listing_id relationship
-- Establishes seller logic and message flow
-- ============================================================

-- ============================================================
-- CONVERSATION TABLE UPDATES
-- conversations tablosunda listing_id zaten var
-- Gerekli policies ve triggers'ı ekle
-- ============================================================

-- Konuşma oluştururken listing_id doğrulaması
CREATE OR REPLACE FUNCTION create_conversation_with_listing(
  p_buyer_id UUID,
  p_seller_id UUID,
  p_listing_id UUID
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_conversation_id UUID;
  v_existing_id UUID;
BEGIN
  -- Aynı listing için zaten varsa onu döndür
  SELECT id INTO v_existing_id 
  FROM public.conversations
  WHERE listing_id = p_listing_id
    AND buyer_id = p_buyer_id
    AND seller_id = p_seller_id
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  -- Yeni konuşma oluştur
  INSERT INTO public.conversations (
    listing_id,
    buyer_id,
    seller_id,
    last_message_at
  )
  VALUES (p_listing_id, p_buyer_id, p_seller_id, NOW())
  RETURNING id INTO v_conversation_id;

  RETURN v_conversation_id;
END;
$$;

-- Mesaj gönderirken konuşmayı güncelle
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.conversations
  SET
    last_message = NEW.body,
    last_message_at = NEW.created_at,
    buyer_unread = CASE 
      WHEN NEW.sender_id = seller_id THEN buyer_unread + 1 
      ELSE buyer_unread 
    END,
    seller_unread = CASE 
      WHEN NEW.sender_id = buyer_id THEN seller_unread + 1 
      ELSE seller_unread 
    END
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_message_created ON public.messages;
CREATE TRIGGER on_message_created
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_on_message();

-- ============================================================
-- SELLER LOGIC - Satıcı ilanları ve mesaj yönetimi
-- ============================================================

-- Satıcı ilanını güncelleyebilir
CREATE OR REPLACE FUNCTION seller_can_update_listing(
  p_listing_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_seller_id UUID;
BEGIN
  SELECT seller_id INTO v_seller_id 
  FROM public.listings 
  WHERE id = p_listing_id;
  
  RETURN v_seller_id = p_user_id;
END;
$$;

-- Satıcı ilanını silebilir
CREATE OR REPLACE FUNCTION seller_can_delete_listing(
  p_listing_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_seller_id UUID;
BEGIN
  SELECT seller_id INTO v_seller_id 
  FROM public.listings 
  WHERE id = p_listing_id;
  
  RETURN v_seller_id = p_user_id;
END;
$$;

-- Satıcı ilanında gelen mesajları görebilir
CREATE OR REPLACE FUNCTION seller_can_view_conversation_for_listing(
  p_listing_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_seller_id UUID;
BEGIN
  SELECT seller_id INTO v_seller_id 
  FROM public.listings 
  WHERE id = p_listing_id;
  
  RETURN v_seller_id = p_user_id;
END;
$$;

-- ============================================================
-- SECURITY POLICIES - Mesaj erişim kontrolleri
-- ============================================================

-- Konuşma tarafları mesaj gönderebilir
DROP POLICY IF EXISTS "Konuşma tarafları mesaj gönderebilir" ON public.messages;
CREATE POLICY "Konuşma tarafları mesaj gönderebilir"
  ON public.messages FOR INSERT
  WITH CHECK (
    EXISTS(
      SELECT 1 FROM public.conversations
      WHERE id = conversation_id
        AND (buyer_id = auth.uid() OR seller_id = auth.uid())
    )
  );

-- Mesaj yazarı silebilir
DROP POLICY IF EXISTS "Mesaj yazarı silebilir" ON public.messages;
CREATE POLICY "Mesaj yazarı silebilir"
  ON public.messages FOR DELETE
  USING (auth.uid() = sender_id);

-- Konuşma tarafları mesaj okuyabilir
DROP POLICY IF EXISTS "Konuşma tarafları mesaj okur" ON public.messages;
CREATE POLICY "Konuşma tarafları mesaj okur"
  ON public.messages FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM public.conversations
      WHERE id = conversation_id
        AND (buyer_id = auth.uid() OR seller_id = auth.uid())
    )
  );

-- ============================================================
-- CONVERSATION POLICIES - Konuşma erişim kontrolleri
-- ============================================================

DROP POLICY IF EXISTS "Konuşma tarafları okuyabilir" ON public.conversations;
CREATE POLICY "Konuşma tarafları okuyabilir"
  ON public.conversations FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

DROP POLICY IF EXISTS "Alıcı konuşma başlatır" ON public.conversations;
CREATE POLICY "Alıcı konuşma başlatır"
  ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "Taraflar konuşmayı güncelleyebilir" ON public.conversations;
CREATE POLICY "Taraflar konuşmayı güncelleyebilir"
  ON public.conversations FOR UPDATE
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- ============================================================
-- INDEXES - Performans optimizasyonu
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_conversations_listing_id 
  ON public.conversations(listing_id);

CREATE INDEX IF NOT EXISTS idx_conversations_buyer_seller 
  ON public.conversations(buyer_id, seller_id);

CREATE INDEX IF NOT EXISTS idx_conversations_listing_buyer_seller 
  ON public.conversations(listing_id, buyer_id, seller_id);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id 
  ON public.messages(conversation_id);

CREATE INDEX IF NOT EXISTS idx_messages_sender_id 
  ON public.messages(sender_id);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created 
  ON public.messages(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_listings_seller_status 
  ON public.listings(seller_id, status);

-- ============================================================
-- FUNCTIONS - Yardımcı fonksiyonlar
-- ============================================================

-- Listing'e ait konuşmaları getir
CREATE OR REPLACE FUNCTION get_conversations_for_listing(
  p_listing_id UUID,
  p_user_id UUID
)
RETURNS TABLE(
  id UUID,
  buyer_id UUID,
  seller_id UUID,
  listing_id UUID,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  buyer_unread INT,
  seller_unread INT,
  created_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Kullanıcı satıcı olmalı
  PERFORM 1 FROM public.listings
  WHERE id = p_listing_id AND seller_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Yetkiniz yok';
  END IF;

  RETURN QUERY
  SELECT 
    c.id,
    c.buyer_id,
    c.seller_id,
    c.listing_id,
    c.last_message,
    c.last_message_at,
    c.buyer_unread,
    c.seller_unread,
    c.created_at
  FROM public.conversations c
  WHERE c.listing_id = p_listing_id
  ORDER BY c.last_message_at DESC NULLS LAST;
END;
$$;

-- Satıcının ilanlarıyla ilgili tüm konuşmaları getir
CREATE OR REPLACE FUNCTION get_seller_all_conversations(
  p_seller_id UUID
)
RETURNS TABLE(
  id UUID,
  buyer_id UUID,
  seller_id UUID,
  listing_id UUID,
  listing_title TEXT,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  seller_unread INT,
  created_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.buyer_id,
    c.seller_id,
    c.listing_id,
    l.title,
    c.last_message,
    c.last_message_at,
    c.seller_unread,
    c.created_at
  FROM public.conversations c
  LEFT JOIN public.listings l ON c.listing_id = l.id
  WHERE c.seller_id = p_seller_id
  ORDER BY c.last_message_at DESC NULLS LAST;
END;
$$;

-- Alıcının tüm konuşmalarını getir
CREATE OR REPLACE FUNCTION get_buyer_all_conversations(
  p_buyer_id UUID
)
RETURNS TABLE(
  id UUID,
  buyer_id UUID,
  seller_id UUID,
  listing_id UUID,
  seller_name TEXT,
  seller_avatar TEXT,
  listing_title TEXT,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  buyer_unread INT,
  created_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.buyer_id,
    c.seller_id,
    c.listing_id,
    p.full_name,
    p.avatar_url,
    l.title,
    c.last_message,
    c.last_message_at,
    c.buyer_unread,
    c.created_at
  FROM public.conversations c
  LEFT JOIN public.profiles p ON c.seller_id = p.id
  LEFT JOIN public.listings l ON c.listing_id = l.id
  WHERE c.buyer_id = p_buyer_id
  ORDER BY c.last_message_at DESC NULLS LAST;
END;
$$;

-- ============================================================
-- GRANTS - Yetkiler
-- ============================================================

GRANT EXECUTE ON FUNCTION create_conversation_with_listing TO authenticated;
GRANT EXECUTE ON FUNCTION seller_can_update_listing TO authenticated;
GRANT EXECUTE ON FUNCTION seller_can_delete_listing TO authenticated;
GRANT EXECUTE ON FUNCTION seller_can_view_conversation_for_listing TO authenticated;
GRANT EXECUTE ON FUNCTION get_conversations_for_listing TO authenticated;
GRANT EXECUTE ON FUNCTION get_seller_all_conversations TO authenticated;
GRANT EXECUTE ON FUNCTION get_buyer_all_conversations TO authenticated;
