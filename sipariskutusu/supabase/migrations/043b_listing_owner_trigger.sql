-- 043b: Apply trigger, index, and policy for listing owner_id
-- (owner_id column was already added separately)

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
