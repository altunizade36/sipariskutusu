CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS gin_provinces_normalized_name_trgm
  ON provinces USING GIN (normalized_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS gin_districts_normalized_name_trgm
  ON districts USING GIN (normalized_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS gin_neighborhoods_normalized_name_trgm
  ON neighborhoods USING GIN (normalized_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS gin_streets_normalized_name_trgm
  ON streets USING GIN (normalized_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS gin_addresses_normalized_full_text_trgm
  ON addresses USING GIN (normalized_full_text gin_trgm_ops);

CREATE INDEX IF NOT EXISTS gin_addresses_full_text_tsv
  ON addresses USING GIN (to_tsvector('simple', normalized_full_text));
