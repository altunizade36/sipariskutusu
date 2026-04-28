-- Adds explicit listing owner support while preserving existing seller_id based RLS.
-- owner_id is kept in sync with seller_id so auth.uid() owns newly published listings.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

UPDATE public.listings
SET owner_id = COALESCE(owner_id, seller_id)
WHERE owner_id IS NULL;

CREATE OR REPLACE FUNCTION public.sync_listing_owner_fields()
RETURNS TRIGGER AS $$
BEGIN
  NEW.owner_id := COALESCE(NEW.owner_id, NEW.seller_id, auth.uid());
  NEW.seller_id := COALESCE(NEW.seller_id, NEW.owner_id, auth.uid());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS sync_listing_owner_fields_trigger ON public.listings;
CREATE TRIGGER sync_listing_owner_fields_trigger
  BEFORE INSERT OR UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.sync_listing_owner_fields();

CREATE INDEX IF NOT EXISTS listings_owner_idx ON public.listings(owner_id);

DROP POLICY IF EXISTS "Satıcı kendi ilanlarını yönetir" ON public.listings;
CREATE POLICY "Satıcı kendi ilanlarını yönetir" ON public.listings
  FOR ALL
  USING (auth.uid() = COALESCE(owner_id, seller_id))
  WITH CHECK (auth.uid() = COALESCE(owner_id, seller_id));
