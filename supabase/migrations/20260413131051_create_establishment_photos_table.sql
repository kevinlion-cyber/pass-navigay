/*
  # Create establishment photos table

  1. New Tables
    - `establishment_photos` - Gallery photos for pro establishments
      - `id` (uuid, primary key)
      - `establishment_id` (uuid, references establishments, cascade delete)
      - `url` (text)
      - `caption` (text)
      - `order_index` (int)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Public read
    - Only establishment owners can insert/update/delete
*/

CREATE TABLE IF NOT EXISTS establishment_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid REFERENCES establishments(id) ON DELETE CASCADE,
  url text NOT NULL,
  caption text DEFAULT '',
  order_index int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE establishment_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view establishment photos"
  ON establishment_photos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anon can view establishment photos"
  ON establishment_photos FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Establishment owners can insert photos"
  ON establishment_photos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM establishments
      WHERE establishments.id = establishment_id
      AND establishments.owner_id = auth.uid()
    )
  );

CREATE POLICY "Establishment owners can update photos"
  ON establishment_photos FOR UPDATE
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

CREATE POLICY "Establishment owners can delete photos"
  ON establishment_photos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM establishments
      WHERE establishments.id = establishment_id
      AND establishments.owner_id = auth.uid()
    )
  );
