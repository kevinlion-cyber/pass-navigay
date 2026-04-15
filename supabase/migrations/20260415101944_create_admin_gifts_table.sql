/*
  # Create admin_gifts table for tracking gifted Premium/Pro periods

  1. New Tables
    - `admin_gifts`
      - `id` (uuid, primary key) - unique gift identifier
      - `recipient_id` (uuid, not null) - ID of the user or establishment receiving the gift
      - `recipient_type` (text, not null) - either 'user' or 'establishment'
      - `gift_type` (text, not null) - either 'premium' or 'pro'
      - `days_added` (int, not null) - number of days gifted
      - `new_expiry` (timestamptz, not null) - the new expiration date after applying the gift
      - `note` (text) - optional internal admin note
      - `created_at` (timestamptz) - when the gift was created

  2. Security
    - Enable RLS on `admin_gifts` table
    - Only authenticated admin users should access this table (handled at app level)
    - No public read/write policies - access is through service role or admin-only logic
*/

CREATE TABLE IF NOT EXISTS admin_gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL,
  recipient_type text NOT NULL CHECK (recipient_type IN ('user', 'establishment')),
  gift_type text NOT NULL CHECK (gift_type IN ('premium', 'pro')),
  days_added int NOT NULL,
  new_expiry timestamptz NOT NULL,
  note text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_gifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read admin_gifts"
  ON admin_gifts
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert admin_gifts"
  ON admin_gifts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
