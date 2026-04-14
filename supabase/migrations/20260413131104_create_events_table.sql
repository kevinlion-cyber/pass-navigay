/*
  # Create events table

  1. New Tables
    - `events` - Events linked to establishments
      - `id` (uuid, primary key)
      - `establishment_id` (uuid, references establishments, cascade delete)
      - `title`, `description` (text)
      - `event_date`, `end_date` (timestamptz)
      - `address` (text)
      - `latitude`, `longitude` (float)
      - `theme` (text)
      - `price` (numeric)
      - `is_free` (boolean)
      - `image_url` (text)
      - `is_featured` (boolean)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Public read
    - Only establishment owners can manage
*/

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid REFERENCES establishments(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  event_date timestamptz NOT NULL,
  end_date timestamptz,
  address text DEFAULT '',
  latitude float,
  longitude float,
  theme text DEFAULT '',
  price numeric(10,2) DEFAULT 0,
  is_free boolean DEFAULT true,
  image_url text,
  is_featured boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view events"
  ON events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anon can view events"
  ON events FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Establishment owners can insert events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM establishments
      WHERE establishments.id = establishment_id
      AND establishments.owner_id = auth.uid()
    )
  );

CREATE POLICY "Establishment owners can update events"
  ON events FOR UPDATE
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

CREATE POLICY "Establishment owners can delete events"
  ON events FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM establishments
      WHERE establishments.id = establishment_id
      AND establishments.owner_id = auth.uid()
    )
  );
