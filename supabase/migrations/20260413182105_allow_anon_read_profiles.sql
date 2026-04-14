/*
  # Allow anonymous users to read profiles

  1. Security Changes
    - Add SELECT policy for anonymous users on `profiles` table
    - This allows the Members page to be visible without logging in

  2. Important Notes
    - Only SELECT is allowed for anonymous users
    - Insert, update, delete remain restricted to authenticated users
*/

CREATE POLICY "Anonymous users can view profiles"
  ON profiles FOR SELECT
  TO anon
  USING (true);
