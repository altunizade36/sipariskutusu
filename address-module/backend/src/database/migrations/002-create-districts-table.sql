CREATE TABLE IF NOT EXISTS districts (
  id SERIAL PRIMARY KEY,
  province_id INT NOT NULL REFERENCES provinces(id) ON DELETE RESTRICT,
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  normalized_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT uq_districts_province_normalized_name UNIQUE (province_id, normalized_name)
);

CREATE INDEX IF NOT EXISTS idx_districts_province_id ON districts (province_id);
CREATE INDEX IF NOT EXISTS idx_districts_normalized_name ON districts (normalized_name);
