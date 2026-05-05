-- 049_add_username_to_profiles.sql
-- Add username column to profiles if it doesn't exist
-- Fixes: "column profiles_1.username does not exist" error

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'username'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN username TEXT UNIQUE;
  END IF;
END;
$$;

-- Backfill username from auth.users email prefix for existing rows
UPDATE public.profiles p
SET username = SPLIT_PART(u.email, '@', 1)
FROM auth.users u
WHERE u.id = p.id
  AND p.username IS NULL
  AND u.email IS NOT NULL;
