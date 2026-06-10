-- Drop old restrictive insert policy since new admin-aware one covers it
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;