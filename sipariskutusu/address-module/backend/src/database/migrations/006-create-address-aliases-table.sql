CREATE TABLE IF NOT EXISTS address_aliases (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('province', 'district', 'neighborhood', 'street', 'address')),
  entity_id INT NOT NULL,
  alias VARCHAR(200) NOT NULL,
  normalized_alias VARCHAR(200) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT uq_address_alias_entity_alias UNIQUE (entity_type, entity_id, normalized_alias)
);

CREATE INDEX IF NOT EXISTS idx_address_aliases_entity_ref ON address_aliases (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_address_aliases_normalized_alias ON address_aliases (normalized_alias);

CREATE TABLE IF NOT EXISTS address_search_logs (
  id SERIAL PRIMARY KEY,
  query TEXT NOT NULL,
  normalized_query TEXT NOT NULL,
  result_count INT NOT NULL DEFAULT 0,
  request_ip VARCHAR(64),
  user_agent VARCHAR(300),
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_address_search_logs_normalized_query ON address_search_logs (normalized_query);

CREATE TABLE IF NOT EXISTS imported_location_sources (
  id SERIAL PRIMARY KEY,
  source_name VARCHAR(120) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_hash VARCHAR(128) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  total_rows INT NOT NULL DEFAULT 0,
  inserted_rows INT NOT NULL DEFAULT 0,
  failed_rows INT NOT NULL DEFAULT 0,
  failure_report_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT uq_import_source_hash UNIQUE (source_name, file_hash)
);

CREATE TABLE IF NOT EXISTS address_validation_results (
  id SERIAL PRIMARY KEY,
  input_text TEXT NOT NULL,
  normalized_text TEXT NOT NULL,
  input_hash VARCHAR(128) NOT NULL,
  is_valid BOOLEAN NOT NULL DEFAULT FALSE,
  confidence_score NUMERIC(5,4) NOT NULL DEFAULT 0,
  validation_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
