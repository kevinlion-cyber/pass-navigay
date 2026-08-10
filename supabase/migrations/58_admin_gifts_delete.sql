-- Suppression d'un cadeau offert par l'admin (page « Cadeaux offerts »).
-- Il manquait la policy DELETE : sans elle, la RLS rejette silencieusement la
-- suppression (0 ligne touchée), ce qui laissait le cadeau en place alors que
-- l'accès venait d'être retiré côté application. On l'ajoute, réservée aux admins.
CREATE POLICY "Admins can delete admin_gifts" ON admin_gifts
  FOR DELETE TO authenticated USING (public.is_admin());
