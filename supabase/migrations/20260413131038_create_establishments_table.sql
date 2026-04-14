/*
  # Create establishments table

  1. New Tables
    - `establishments` - Business listings
      - `id` (uuid, primary key)
      - `owner_id` (uuid, references profiles)
      - `name` (text)
      - `address`, `city`, `postal_code` (text)
      - `latitude`, `longitude` (float)
      - `category`, `subcategory` (text)
      - `description`, `phone`, `website` (text)
      - `is_pro`, `is_sponsor`, `is_verified` (boolean)
      - `pro_expires_at` (timestamptz)
      - `stripe_subscription_id`, `stripe_customer_id` (text)
      - `banner_url`, `logo_url` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Public read for authenticated users
    - Owners can insert, update, delete their own establishments
*/

CREATE TABLE IF NOT EXISTS establishments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES profiles(id),
  name text NOT NULL,
  address text NOT NULL,
  city text NOT NULL,
  postal_code text DEFAULT '',
  latitude float NOT NULL,
  longitude float NOT NULL,
  category text NOT NULL,
  subcategory text NOT NULL,
  description text DEFAULT '',
  phone text DEFAULT '',
  website text DEFAULT '',
  is_pro boolean DEFAULT false,
  pro_expires_at timestamptz,
  stripe_subscription_id text,
  stripe_customer_id text,
  banner_url text,
  logo_url text,
  is_sponsor boolean DEFAULT false,
  is_verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE establishments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view establishments"
  ON establishments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone anon can view establishments"
  ON establishments FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Owners can insert establishments"
  ON establishments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update their establishments"
  ON establishments FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can delete their establishments"
  ON establishments FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);
