-- Persistent store posts for Instagram-style store feeds.

CREATE TABLE IF NOT EXISTS public.store_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual', 'instagram')),
  source_id TEXT,
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  caption TEXT,
  title TEXT NOT NULL,
  post_type TEXT NOT NULL DEFAULT 'product' CHECK (post_type IN ('product', 'campaign', 'collection')),
  media_type TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video', 'carousel')),
  like_count INT NOT NULL DEFAULT 0,
  comment_count INT NOT NULL DEFAULT 0,
  linked_listing_id UUID REFERENCES public.listings(id) ON DELETE SET NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  original_timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, source_type, source_id)
);

CREATE INDEX IF NOT EXISTS store_posts_store_created_idx
  ON public.store_posts(store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS store_posts_seller_idx
  ON public.store_posts(seller_id);

CREATE INDEX IF NOT EXISTS store_posts_linked_listing_idx
  ON public.store_posts(linked_listing_id)
  WHERE linked_listing_id IS NOT NULL;

ALTER TABLE public.store_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_posts_public_read" ON public.store_posts;
CREATE POLICY "store_posts_public_read"
  ON public.store_posts
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "store_posts_owner_insert" ON public.store_posts;
CREATE POLICY "store_posts_owner_insert"
  ON public.store_posts
  FOR INSERT
  WITH CHECK (
    auth.uid() = seller_id
    AND EXISTS (
      SELECT 1
      FROM public.stores s
      WHERE s.id = store_posts.store_id
        AND s.seller_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "store_posts_owner_update" ON public.store_posts;
CREATE POLICY "store_posts_owner_update"
  ON public.store_posts
  FOR UPDATE
  USING (
    auth.uid() = seller_id
    AND EXISTS (
      SELECT 1
      FROM public.stores s
      WHERE s.id = store_posts.store_id
        AND s.seller_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = seller_id
    AND EXISTS (
      SELECT 1
      FROM public.stores s
      WHERE s.id = store_posts.store_id
        AND s.seller_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "store_posts_owner_delete" ON public.store_posts;
CREATE POLICY "store_posts_owner_delete"
  ON public.store_posts
  FOR DELETE
  USING (
    auth.uid() = seller_id
    AND EXISTS (
      SELECT 1
      FROM public.stores s
      WHERE s.id = store_posts.store_id
        AND s.seller_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.set_store_posts_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_store_posts_updated_at ON public.store_posts;
CREATE TRIGGER trg_store_posts_updated_at
BEFORE UPDATE ON public.store_posts
FOR EACH ROW
EXECUTE FUNCTION public.set_store_posts_updated_at();
