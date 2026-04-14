/*
  # Create promotions table

  1. New Tables
    - `promotions` - Coupons and promotions for establishments
      - `id` (uuid, primary key)
      - `establishment_id` (uuid, references establishments, cascade delete)
      - `title`, `description` (text)
      - `promo_type` (text: percentage/fixed/offer)
      - `value` (numeric)
      - `image_url` (text)
      - `valid_from`, `valid_until` (timestamptz)
      - `is_recurring` (boolean)
      - `recurrence_rule` (text)
      - `max_uses`, `current_uses` (int)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Public read
    - Only establishment owners can manage
*/

CREATE TABLE IF NOT EXISTS promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid REFERENCES establishments(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  promo_type text NOT NULL,
  value numeric(10,2),
  image_url text,
  valid_from timestamptz NOT NULL,
  valid_until timestamptz NOT NULL,
  is_recurring boolean DEFAULT false,
  recurrence_rule text DEFAULT '',
  max_uses int,
  current_uses int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view promotions"
  ON promotions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anon can view promotions"
  ON promotions FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Establishment owners can insert promotions"
  ON promotions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM establishments
      WHERE establishments.id = establishment_id
      AND establishments.owner_id = auth.uid()
    )
  );

CREATE POLICY "Establishment owners can update promotions"
  ON promotions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM establishments
      WHERE establishments.id = establishment_id
      AND establishments.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM establishments
      WHERE establishments.id = establishment_id
      AND establishments.owner_id = auth.uid()
    )
  );

CREATE POLICY "Establishment owners can delete promotions"
  ON promotions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM establishments
      WHERE establishments.id = establishment_id
      AND establishments.owner_id = auth.uid()
    )
  );
