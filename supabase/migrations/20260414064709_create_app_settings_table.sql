/*
  # Create app_settings table

  1. New Tables
    - `app_settings`
      - `key` (text, primary key) - Setting identifier
      - `value` (text) - Setting value
      - `updated_at` (timestamptz) - Last update timestamp

  2. Seed Data
    - disclaimer_text
    - onboarding_title
    - onboarding_text
    - maintenance_mode

  3. Security
    - Enable RLS on `app_settings` table
    - Allow authenticated users to read settings
    - Allow service role to update settings (admin operations via service key)
*/

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read app settings"
  ON app_settings
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update app settings"
  ON app_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can insert app settings"
  ON app_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

INSERT INTO app_settings (key, value) VALUES
  ('disclaimer_text', 'Pour ta securite et celle des autres, ne rejoins personne dans un lieu isole et ne partage pas d informations personnelles sensibles trop rapidement.'),
  ('onboarding_title', 'Decouvre les lieux LGBT-friendly pres de chez toi'),
  ('onboarding_text', 'Trouve des lieux surs, decouvre des evenements et rejoins une communaute bienveillante.'),
  ('maintenance_mode', 'false')
ON CONFLICT (key) DO NOTHING;
