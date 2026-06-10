-- Add email column to profiles for easy querying in admin
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;

-- Backfill from auth.users
UPDATE profiles SET email = u.email
FROM auth.users u
WHERE profiles.id = u.id AND profiles.email IS NULL;

-- Add is_verified column for admin verification feature
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false;