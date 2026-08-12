-- Visuels du site que l'administration doit pouvoir changer elle-même (logo de la
-- fenêtre d'accueil pour commencer). Tous les espaces existants concernent des
-- établissements, des événements ou des promotions : aucun n'accueille les visuels
-- du site lui-même. Kevin ne pouvait donc pas remplacer le « P » sans passer par du
-- code, ce qui revenait à nous appeler à chaque changement.
INSERT INTO storage.buckets (id, name, public)
VALUES ('site-assets', 'site-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Lecture par tout le monde : ces images s'affichent sur le site public.
DROP POLICY IF EXISTS "Public read for site assets" ON storage.objects;
CREATE POLICY "Public read for site assets" ON storage.objects
  FOR SELECT USING (bucket_id = 'site-assets');

-- Écriture réservée aux administrateurs : c'est l'identité visuelle du site, pas
-- un contenu que les membres ou les gérants peuvent remplacer.
DROP POLICY IF EXISTS "Admins upload site assets" ON storage.objects;
CREATE POLICY "Admins upload site assets" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'site-assets' AND public.is_admin());

DROP POLICY IF EXISTS "Admins update site assets" ON storage.objects;
CREATE POLICY "Admins update site assets" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'site-assets' AND public.is_admin())
  WITH CHECK (bucket_id = 'site-assets' AND public.is_admin());

DROP POLICY IF EXISTS "Admins delete site assets" ON storage.objects;
CREATE POLICY "Admins delete site assets" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'site-assets' AND public.is_admin());
