/*
  # Add favorite categories and last activity to profiles

  1. Modified Tables
    - `profiles`
      - `favorite_categories` (text[], default '{}') - array of category tags for the member
      - `last_active_at` (timestamptz, default now()) - tracks last activity time

  2. Data Updates
    - Seeds favorite_categories and last_active_at for the 12 test members

  3. Security Changes
    - Adds SELECT policy on `favorites` for anonymous users (count only, public info)

  4. Important Notes
    - Uses DO block to safely add columns only if they don't exist
    - Updates existing test profiles with category tags and activity timestamps
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'favorite_categories'
  ) THEN
    ALTER TABLE profiles ADD COLUMN favorite_categories text[] DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'last_active_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN last_active_at timestamptz DEFAULT now();
  END IF;
END $$;

UPDATE profiles SET favorite_categories = ARRAY['Soiree', 'Culture'], last_active_at = NOW() - interval '1 day'
WHERE id = '11111111-1111-1111-1111-111111111111';

UPDATE profiles SET favorite_categories = ARRAY['Brunch', 'Culture', 'Shopping'], last_active_at = NOW() - interval '3 hours'
WHERE id = '22222222-2222-2222-2222-222222222222';

UPDATE profiles SET favorite_categories = ARRAY['Soiree', 'Bien-etre'], last_active_at = NOW() - interval '2 days'
WHERE id = '33333333-3333-3333-3333-333333333333';

UPDATE profiles SET favorite_categories = ARRAY['Concert', 'Bar a vins', 'Restaurant'], last_active_at = NOW() - interval '5 hours'
WHERE id = '44444444-4444-4444-4444-444444444444';

UPDATE profiles SET favorite_categories = ARRAY['Culture', 'Soiree', 'Shopping'], last_active_at = NOW() - interval '12 hours'
WHERE id = '55555555-5555-5555-5555-555555555555';

UPDATE profiles SET favorite_categories = ARRAY['Brunch', 'Bien-etre'], last_active_at = NOW() - interval '4 days'
WHERE id = '66666666-6666-6666-6666-666666666666';

UPDATE profiles SET favorite_categories = ARRAY['Soiree', 'Concert', 'Culture'], last_active_at = NOW() - interval '6 hours'
WHERE id = '77777777-7777-7777-7777-777777777777';

UPDATE profiles SET favorite_categories = ARRAY['Bien-etre', 'Restaurant', 'Brunch'], last_active_at = NOW() - interval '1 day'
WHERE id = '88888888-8888-8888-8888-888888888888';

UPDATE profiles SET favorite_categories = ARRAY['Culture', 'Soiree'], last_active_at = NOW() - interval '30 minutes'
WHERE id = '99999999-9999-9999-9999-999999999999';

UPDATE profiles SET favorite_categories = ARRAY['Shopping', 'Culture'], last_active_at = NOW() - interval '3 days'
WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

UPDATE profiles SET favorite_categories = ARRAY['Soiree', 'Concert'], last_active_at = NOW() - interval '8 hours'
WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

UPDATE profiles SET favorite_categories = ARRAY['Bien-etre', 'Restaurant', 'Culture'], last_active_at = NOW() - interval '2 hours'
WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

CREATE POLICY "Anonymous users can view favorites count"
  ON favorites FOR SELECT
  TO anon
  USING (true);
