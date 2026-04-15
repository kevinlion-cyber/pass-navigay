/*
  # Create promotion_uses table for tracking user promo redemptions

  1. New Tables
    - `promotion_uses`
      - `id` (uuid, primary key)
      - `promotion_id` (uuid, references promotions, on delete cascade)
      - `user_id` (uuid, references profiles)
      - `used_at` (timestamptz, default now())
      - Unique constraint on (promotion_id, user_id) to prevent double usage

  2. Security
    - Enable RLS on `promotion_uses`
    - Authenticated users can read their own promotion uses
    - Authenticated users can insert their own promotion uses
    - Authenticated users who own the establishment can read all uses for their promos

  3. Realtime
    - Enable realtime on `promotion_uses` for partner dashboard live updates
*/

CREATE TABLE IF NOT EXISTS promotion_uses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id),
  used_at timestamptz DEFAULT now(),
  UNIQUE(promotion_id, user_id)
);

ALTER TABLE promotion_uses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own promotion uses"
  ON promotion_uses
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own promotion uses"
  ON promotion_uses
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Establishment owners can read uses for their promos"
  ON promotion_uses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM promotions p
      JOIN establishments e ON e.id = p.establishment_id
      WHERE p.id = promotion_uses.promotion_id
      AND e.owner_id = auth.uid()
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE promotion_uses;
