CREATE TABLE IF NOT EXISTS streets (
  id SERIAL PRIMARY KEY,
  province_id INT NOT NULL REFERENCES provinces(id) ON DELETE RESTRICT,
  district_id INT NOT NULL REFERENCES districts(id) ON DELETE RESTRICT,
  neighborhood_id INT NOT NULL REFERENCES neighborhoods(id) ON DELETE RESTRICT,
  code VARCHAR(40) UNIQUE,
  name VARCHAR(200) NOT NULL,
  normalized_name VARCHAR(200) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('cadde', 'sokak', 'bulvar', 'meydan', 'kume evler', 'diger')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT uq_street_neighborhood_name_type UNIQUE (neighborhood_id, normalized_name, type)
);

CREATE INDEX IF NOT EXISTS idx_streets_province_id ON streets (province_id);
CREATE INDEX IF NOT EXISTS idx_streets_district_id ON streets (district_id);
CREATE INDEX IF NOT EXISTS idx_streets_neighborhood_id ON streets (neighborhood_id);
CREATE INDEX IF NOT EXISTS idx_streets_normalized_name ON streets (normalized_name);
