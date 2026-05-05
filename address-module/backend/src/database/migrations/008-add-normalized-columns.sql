ALTER TABLE provinces
  ADD COLUMN IF NOT EXISTS slug VARCHAR(140);

ALTER TABLE districts
  ADD COLUMN IF NOT EXISTS slug VARCHAR(160);

ALTER TABLE neighborhoods
  ADD COLUMN IF NOT EXISTS slug VARCHAR(220);

ALTER TABLE streets
  ADD COLUMN IF NOT EXISTS slug VARCHAR(240);

CREATE INDEX IF NOT EXISTS idx_provinces_slug ON provinces (slug);
CREATE INDEX IF NOT EXISTS idx_districts_slug ON districts (slug);
CREATE INDEX IF NOT EXISTS idx_neighborhoods_slug ON neighborhoods (slug);
CREATE INDEX IF NOT EXISTS idx_streets_slug ON streets (slug);
