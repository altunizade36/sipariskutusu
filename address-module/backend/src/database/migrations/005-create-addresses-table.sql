CREATE TABLE IF NOT EXISTS addresses (
  id SERIAL PRIMARY KEY,
  province_id INT NOT NULL REFERENCES provinces(id) ON DELETE RESTRICT,
  district_id INT NOT NULL REFERENCES districts(id) ON DELETE RESTRICT,
  neighborhood_id INT NOT NULL REFERENCES neighborhoods(id) ON DELETE RESTRICT,
  street_id INT REFERENCES streets(id) ON DELETE RESTRICT,
  building_no VARCHAR(20),
  unit_no VARCHAR(20),
  postal_code VARCHAR(10),
  full_text TEXT NOT NULL,
  normalized_full_text TEXT NOT NULL,
  snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  lat NUMERIC(10,7),
  lng NUMERIC(10,7),
  confidence_score NUMERIC(5,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_addresses_province_id ON addresses (province_id);
CREATE INDEX IF NOT EXISTS idx_addresses_district_id ON addresses (district_id);
CREATE INDEX IF NOT EXISTS idx_addresses_neighborhood_id ON addresses (neighborhood_id);
CREATE INDEX IF NOT EXISTS idx_addresses_street_id ON addresses (street_id);
CREATE INDEX IF NOT EXISTS idx_addresses_normalized_full_text ON addresses (normalized_full_text);
