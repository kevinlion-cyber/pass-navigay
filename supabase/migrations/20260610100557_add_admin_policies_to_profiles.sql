-- Allow admins to update any profile (for is_verified, is_premium, etc.)
CREATE POLICY "Admins can update any profile" ON profiles FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true));

-- Allow admins to delete any profile
CREATE POLICY "Admins can delete any profile" ON profiles FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true));

-- Allow admins to insert profiles (for create member)
CREATE POLICY "Admins can insert profiles" ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true) OR auth.uid() = id);