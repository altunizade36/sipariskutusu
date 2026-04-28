CREATE TABLE IF NOT EXISTS neighborhoods (
  id SERIAL PRIMARY KEY,
  province_id INT NOT NULL REFERENCES provinces(id) ON DELETE RESTRICT,
  district_id INT NOT NULL REFERENCES districts(id) ON DELETE RESTRICT,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  normalized_name VARCHAR(150) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('mahalle', 'koy')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT uq_neighborhood_district_name_type UNIQUE (district_id, normalized_name, type)
);

CREATE INDEX IF NOT EXISTS idx_neighborhoods_province_id ON neighborhoods (province_id);
CREATE INDEX IF NOT EXISTS idx_neighborhoods_district_id ON neighborhoods (district_id);
CREATE INDEX IF NOT EXISTS idx_neighborhoods_normalized_name ON neighborhoods (normalized_name);
