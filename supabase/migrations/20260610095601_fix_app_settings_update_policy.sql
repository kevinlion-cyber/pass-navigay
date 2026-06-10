-- Fix the UPDATE policy on app_settings to include WITH CHECK clause (needed for upsert)
DROP POLICY IF EXISTS "Admins can update app settings" ON app_settings;
CREATE POLICY "Admins can update app settings" ON app_settings FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true));