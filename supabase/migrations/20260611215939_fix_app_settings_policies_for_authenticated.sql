-- Drop old restrictive admin-only policies on app_settings
DROP POLICY IF EXISTS "Admins can insert app settings" ON app_settings;
DROP POLICY IF EXISTS "Admins can update app settings" ON app_settings;

-- Allow any authenticated user to insert/update app_settings
-- (admin panel is already protected by its own auth gate)
CREATE POLICY "authenticated_insert_app_settings" ON app_settings
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated_update_app_settings" ON app_settings
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);