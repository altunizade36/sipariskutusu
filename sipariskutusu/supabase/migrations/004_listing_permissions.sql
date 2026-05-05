-- ============================================================
-- 004_listing_permissions.sql
-- Listing management permissions and owner-based access control
-- Ensures users can only edit/manage their own listings
-- ============================================================

-- ============================================================
-- LISTING UPDATE/DELETE POLICIES
-- ============================================================

-- Drop existing listing policies to avoid conflicts
DROP POLICY IF EXISTS "Aktif ilanları herkes okur" ON public.listings;
DROP POLICY IF EXISTS "Satıcı kendi ilanlarını yönetir" ON public.listings;

-- READ - Herkes aktif ilanları görebilir
CREATE POLICY "listings_read_active"
  ON public.listings FOR SELECT
  USING (status = 'active');

-- READ - Satıcı kendi deaktif ilanlarını görebilir
CREATE POLICY "listings_read_own_inactive"
  ON public.listings FOR SELECT
  USING (auth.uid() = seller_id);

-- CREATE - Giriş yapan kullanıcı ilan oluşturabilir
CREATE POLICY "listings_create"
  ON public.listings FOR INSERT
  WITH CHECK (auth.uid() = seller_id);

-- UPDATE - Satıcı kendi ilanını güncelleyebilir
CREATE POLICY "listings_update_own"
  ON public.listings FOR UPDATE
  USING (auth.uid() = seller_id);

-- DELETE - Satıcı kendi ilanını silebilir
CREATE POLICY "listings_delete_own"
  ON public.listings FOR DELETE
  USING (auth.uid() = seller_id);

-- ============================================================
-- LISTING MANAGEMENT FUNCTIONS
-- ============================================================

-- İlanı güncellemeden önce sahipliği doğrula
CREATE OR REPLACE FUNCTION check_listing_ownership(
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

  IF v_seller_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN v_seller_id = p_user_id;
END;
$$;

-- İlanı güvenli bir şekilde güncelle
CREATE OR REPLACE FUNCTION update_listing_safely(
  p_listing_id UUID,
  p_user_id UUID,
  p_title TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_price NUMERIC DEFAULT NULL,
  p_status listing_status DEFAULT NULL,
  p_stock INT DEFAULT NULL
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Sahiplik doğrulaması
  IF NOT check_listing_ownership(p_listing_id, p_user_id) THEN
    RAISE EXCEPTION 'Bu ilana yetkiniz yok';
  END IF;

  -- Güncelle
  UPDATE public.listings
  SET
    title = COALESCE(p_title, title),
    description = COALESCE(p_description, description),
    price = COALESCE(p_price, price),
    status = COALESCE(p_status, status),
    stock = COALESCE(p_stock, stock),
    updated_at = NOW()
  WHERE id = p_listing_id
  RETURNING json_build_object(
    'id', id,
    'title', title,
    'price', price,
    'status', status,
    'stock', stock,
    'updated_at', updated_at
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- İlanı güvenli bir şekilde sil
CREATE OR REPLACE FUNCTION delete_listing_safely(
  p_listing_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Sahiplik doğrulaması
  IF NOT check_listing_ownership(p_listing_id, p_user_id) THEN
    RAISE EXCEPTION 'Bu ilana yetkiniz yok';
  END IF;

  -- Soft delete - status = 'deleted'
  UPDATE public.listings
  SET status = 'deleted', updated_at = NOW()
  WHERE id = p_listing_id;

  RETURN TRUE;
END;
$$;

-- ============================================================
-- LISTING IMAGE PERMISSIONS
-- ============================================================

DROP POLICY IF EXISTS "Herkes ilan görsellerini okur" ON public.listing_images;
DROP POLICY IF EXISTS "Satıcı kendi görsellerini yönetir" ON public.listing_images;

-- READ - Herkes aktif ilan görsellerini görebilir
CREATE POLICY "listing_images_read"
  ON public.listing_images FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM public.listings
      WHERE id = listing_id AND status = 'active'
    )
  );

-- READ - Satıcı kendi ilanının tüm görsellerini görebilir
CREATE POLICY "listing_images_read_own"
  ON public.listing_images FOR SELECT
  USING (
    auth.uid() = (
      SELECT seller_id FROM public.listings WHERE id = listing_id
    )
  );

-- CREATE - Satıcı kendi ilanına görsel ekleyebilir
CREATE POLICY "listing_images_create_own"
  ON public.listing_images FOR INSERT
  WITH CHECK (
    auth.uid() = (
      SELECT seller_id FROM public.listings WHERE id = listing_id
    )
  );

-- UPDATE - Satıcı kendi görsellerini düzenleyebilir
CREATE POLICY "listing_images_update_own"
  ON public.listing_images FOR UPDATE
  USING (
    auth.uid() = (
      SELECT seller_id FROM public.listings WHERE id = listing_id
    )
  );

-- DELETE - Satıcı kendi görsellerini silebilir
CREATE POLICY "listing_images_delete_own"
  ON public.listing_images FOR DELETE
  USING (
    auth.uid() = (
      SELECT seller_id FROM public.listings WHERE id = listing_id
    )
  );

-- ============================================================
-- CART ITEMS SECURITY
-- ============================================================

DROP POLICY IF EXISTS "Kendi sepetini yönetir" ON public.cart_items;

CREATE POLICY "cart_items_read_own"
  ON public.cart_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "cart_items_create_own"
  ON public.cart_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "cart_items_update_own"
  ON public.cart_items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "cart_items_delete_own"
  ON public.cart_items FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- FAVORITES SECURITY
-- ============================================================

DROP POLICY IF EXISTS "Kendi favorilerini yönetir" ON public.favorites;

CREATE POLICY "favorites_read_own"
  ON public.favorites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "favorites_create_own"
  ON public.favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "favorites_delete_own"
  ON public.favorites FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- ORDER PERMISSIONS
-- ============================================================

DROP POLICY IF EXISTS "Alıcı/satıcı kendi siparişini okur" ON public.orders;
DROP POLICY IF EXISTS "Alıcı sipariş oluşturur" ON public.orders;
DROP POLICY IF EXISTS "Satıcı sipariş günceller" ON public.orders;

CREATE POLICY "orders_read_own"
  ON public.orders FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "orders_create_as_buyer"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "orders_update_as_seller"
  ON public.orders FOR UPDATE
  USING (auth.uid() = seller_id);

-- ============================================================
-- NOTIFICATION PERMISSIONS
-- ============================================================

DROP POLICY IF EXISTS "Kendi bildirimlerini okur" ON public.notifications;
DROP POLICY IF EXISTS "Kendi bildirimlerini günceller" ON public.notifications;

CREATE POLICY "notifications_read_own"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "notifications_delete_own"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- AUDIT LOGGING - İşlem kaydı
-- ============================================================

CREATE TABLE IF NOT EXISTS public.listing_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'publish', 'unpublish')),
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS listing_audit_log_listing_idx 
  ON public.listing_audit_log(listing_id);

CREATE INDEX IF NOT EXISTS listing_audit_log_user_idx 
  ON public.listing_audit_log(user_id);

CREATE INDEX IF NOT EXISTS listing_audit_log_action_idx 
  ON public.listing_audit_log(action);

-- Listing güncellemelerini logla
CREATE OR REPLACE FUNCTION log_listing_changes()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.listing_audit_log (
    listing_id,
    user_id,
    action,
    old_data,
    new_data
  )
  VALUES (
    NEW.id,
    auth.uid(),
    CASE
      WHEN TG_OP = 'INSERT' THEN 'create'
      WHEN TG_OP = 'UPDATE' THEN 'update'
      WHEN TG_OP = 'DELETE' THEN 'delete'
    END,
    CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listing_audit_trigger ON public.listings;
CREATE TRIGGER listing_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION log_listing_changes();

-- ============================================================
-- GRANTS
-- ============================================================

GRANT EXECUTE ON FUNCTION check_listing_ownership TO authenticated;
GRANT EXECUTE ON FUNCTION update_listing_safely TO authenticated;
GRANT EXECUTE ON FUNCTION delete_listing_safely TO authenticated;
