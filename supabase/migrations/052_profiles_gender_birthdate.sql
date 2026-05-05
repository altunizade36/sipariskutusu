-- Add gender and birth_date fields to profiles table
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT NULL
    CHECK (gender IS NULL OR gender IN ('Kadın', 'Erkek', 'Belirtmem')),
  ADD COLUMN IF NOT EXISTS birth_date TEXT DEFAULT NULL;
